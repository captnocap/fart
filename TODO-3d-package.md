# TODO: @ilovereact/3d — Declarative 3D Scenes in JSX via Love2D

## Vision

Write 3D scenes in JSX/TSX the same way react-three-fiber lets you write Three.js declaratively, but rendering through Love2D's GPU pipeline via g3d. The goal is `<Scene>`, `<Mesh>`, `<Camera>`, `<Light>` as first-class React components that participate in the same reconciler, state, and animation systems as the rest of iLoveReact.

```tsx
import { Scene, Mesh, Camera, AmbientLight, PointLight } from '@ilovereact/3d';
import { Box, Text } from '@ilovereact/core';

function MyApp() {
  const [spin, setSpin] = useState(0);

  return (
    <Box style={{ width: '100%', height: '100%' }}>
      {/* 3D viewport */}
      <Scene style={{ width: '100%', height: 400 }}>
        <Camera position={[0, 2, -5]} lookAt={[0, 0, 0]} />
        <AmbientLight intensity={0.3} />
        <PointLight position={[3, 5, -2]} color="#f5c2e7" />

        <Mesh model="sphere" texture="earth.png" position={[0, 0, 4]} rotation={[0, spin, 0]} />
        <Mesh model="cube" color="#89b4fa" position={[-2, 0, 2]} scale={0.5} />
      </Scene>

      {/* 2D UI overlaid below */}
      <Box style={{ padding: 12 }}>
        <Text style={{ fontSize: 14, color: '#cdd6f4' }}>3D Demo</Text>
      </Box>
    </Box>
  );
}
```

This is a massive experiment. The end goal is that someone can mix 2D UI and 3D viewports freely in the same component tree, using the same React patterns, animations, and theming.

## Foundation: g3d

[g3d](https://github.com/groverburger/g3d) is the base — MIT licensed, 760+ stars, pure Lua, built specifically for Love2D. It provides:

- Model loading from .obj files
- Texture mapping
- Camera system (first-person controls, projection modes)
- Transform API (translation, rotation, scale)
- Custom GLSL shader support
- Basic collision detection

### What g3d doesn't have (we build on top)

- No scene graph / node hierarchy
- No lighting system (texture-only)
- No material system
- No declarative API
- No integration with a reconciler
- No animation system
- Limited to .obj format
- No instancing or batching

## Package: `packages/3d/`

### Architecture

```
@ilovereact/3d
├── src/
│   ├── index.ts              # Public API exports
│   ├── Scene.tsx             # 3D viewport container (renders to Love2D canvas)
│   ├── Camera.tsx            # Camera component (perspective, orthographic, orbit)
│   ├── Mesh.tsx              # Renderable 3D object
│   ├── Light.tsx             # AmbientLight, PointLight, DirectionalLight, SpotLight
│   ├── Group.tsx             # Transform group (like Three.js Group)
│   ├── Primitive.tsx         # Built-in geometries (cube, sphere, plane, cylinder, torus)
│   ├── Model.tsx             # Load external .obj / .gltf models
│   ├── Material.tsx          # Material definitions (basic, phong, PBR)
│   ├── Text3D.tsx            # 3D text rendering
│   ├── Skybox.tsx            # Environment backgrounds
│   ├── Particles.tsx         # Particle system
│   ├── hooks/
│   │   ├── useFrame.ts       # Per-frame callback (like r3f useFrame)
│   │   ├── useModel.ts       # Load and cache models
│   │   ├── useTexture.ts     # Load and cache textures
│   │   ├── useCamera.ts      # Camera state and controls
│   │   ├── useRaycast.ts     # Mouse picking / raycasting
│   │   └── usePhysics.ts     # Basic physics integration
│   └── controls/
│       ├── OrbitControls.tsx  # Mouse orbit around target
│       ├── FlyControls.tsx   # Free-flight camera
│       └── FirstPerson.tsx   # FPS-style controls
│
lua/
├── g3d/                      # Vendored g3d (or submodule)
├── scene3d.lua               # Scene graph manager
├── lighting.lua              # Phong/PBR lighting shaders
├── materials.lua             # Material system
└── model_loader.lua          # Extended model loading (obj + gltf)
```

### How it integrates with the existing pipeline

The existing pipeline is: React reconciler → mutation commands → bridge → Lua layout → Lua painter.

For 3D:
1. `<Scene>` registers as a special node type in the reconciler
2. The Lua side creates a Love2D Canvas for the scene viewport
3. 3D children (Mesh, Light, Camera) are tracked in a Lua-side scene graph, separate from the 2D layout tree
4. Each frame, the 3D scene renders to its Canvas using g3d + our lighting/material extensions
5. The 2D painter draws the Canvas as an image at the Scene node's computed position
6. 2D UI can overlay on top or sit alongside — they're in the same layout tree

This means 3D viewports are just Box-like nodes in the layout. You can put them in a flex row next to other components, give them percentage widths, scroll them, etc.

### JSX Element Mapping

Following react-three-fiber's pattern — JSX elements map directly to Lua-side 3D objects:

```tsx
// JSX                          // Lua side
<Mesh />                     → g3d.newModel() with scene graph node
<Camera />                   → g3d.camera configuration
<PointLight />               → lighting.newPointLight()
<Group />                    → transform group node (matrix multiplication)
<Mesh model="sphere" />      → built-in primitive geometry
<Mesh model="robot.obj" />   → loaded .obj model
<Mesh model="scene.gltf" />  → loaded .gltf model (extension over g3d)
```

### Props are reactive

```tsx
// This re-renders the 3D scene when spin changes — no imperative API needed
<Mesh rotation={[0, spin, 0]} />

// Animate with existing iLoveReact springs
const y = useSpring(hovered ? 2 : 0);
<Mesh position={[0, y, 0]} />

// Events work like 2D
<Mesh onClick={() => setSelected(true)} onPointerEnter={() => setHovered(true)} />
```

### Primitives (built-in geometries)

```tsx
<Mesh geometry="box" />
<Mesh geometry="sphere" segments={32} />
<Mesh geometry="plane" width={10} height={10} />
<Mesh geometry="cylinder" radius={1} height={3} />
<Mesh geometry="torus" radius={2} tube={0.5} />
<Mesh geometry="cone" radius={1} height={2} />
```

These generate vertex data in Lua — no .obj file needed.

### Materials

```tsx
// Basic (unlit, texture or flat color)
<Mesh geometry="sphere">
  <BasicMaterial color="#89b4fa" />
</Mesh>

// Phong (diffuse + specular + ambient)
<Mesh geometry="sphere">
  <PhongMaterial color="#f5c2e7" shininess={32} specular="#ffffff" />
</Mesh>

// Textured
<Mesh geometry="sphere">
  <PhongMaterial map="earth.png" normalMap="earth_normal.png" />
</Mesh>

// Themed (reads from @ilovereact/theme)
<Mesh geometry="box">
  <ThemedMaterial colorToken="primary" />
</Mesh>
```

### Lighting

g3d has no lighting — we build it from scratch using Love2D GLSL shaders:

```tsx
<Scene>
  <AmbientLight color="#1a1a2e" intensity={0.2} />
  <PointLight position={[5, 5, 5]} color="#f5c2e7" intensity={1} decay={2} />
  <DirectionalLight direction={[0, -1, 0.5]} color="#ffffff" intensity={0.8} />
  <SpotLight position={[0, 10, 0]} target={[0, 0, 0]} angle={30} penumbra={0.5} />
</Scene>
```

Implemented as a multi-pass or forward-rendering shader that accumulates light contributions.

### useFrame hook

```tsx
function SpinningCube() {
  const meshRef = useRef();

  useFrame((dt) => {
    // Runs every Love2D frame, outside React reconciliation
    meshRef.current.rotation[1] += dt * 2;
  });

  return <Mesh ref={meshRef} geometry="box" color="#fab387" />;
}
```

### Mouse interaction / raycasting

```tsx
function ClickableSphere() {
  const [color, setColor] = useState('#89b4fa');

  return (
    <Mesh
      geometry="sphere"
      color={color}
      onClick={() => setColor('#f38ba8')}
      onPointerEnter={() => setCursor('pointer')}
    />
  );
}
```

Implemented via Lua-side ray-AABB or ray-triangle intersection from mouse coordinates through the camera projection.

## Model format support

| Format | Status | Notes |
|--------|--------|-------|
| .obj | g3d native | Vertices, UVs, normals. No materials file (.mtl) support in base g3d |
| .gltf / .glb | Build | Industry standard, supports PBR materials, animations, scenes. Parse in Lua or JS. |
| .fbx | Stretch | Complex binary format. Consider converting to glTF at build time. |
| Procedural | Build | Generate geometry from code (heightmaps, L-systems, SDF) |

## Storybook stories

| Story | Demonstrates |
|-------|-------------|
| 3D Primitives | All built-in geometries rotating slowly |
| Lighting Lab | Interactive light placement, color, intensity controls |
| Model Viewer | Load .obj/.gltf, orbit controls, material inspector |
| Mixed 2D + 3D | 3D viewport in a flex layout with 2D panels around it |
| Physics Playground | Falling boxes, collisions, constraints |
| Solar System | Orbiting planets, textures, camera fly-through |
| 3D Text | Text rendered as 3D geometry with depth |
| Shader Gallery | Custom vertex/fragment shaders on meshes |
| Theme Integration | 3D scene that reacts to theme changes |

## Research & open questions

1. **Performance budget** — g3d renders via Love2D's OpenGL pipeline. How many triangles can we push at 60fps alongside the 2D UI? Need benchmarking.
2. **Canvas isolation** — rendering 3D to a separate Canvas and compositing it into the 2D painter. Does Love2D handle this cleanly? Need prototype.
3. **Reconciler integration** — do 3D nodes go through the same react-reconciler as 2D nodes, or do we need a separate reconciler (like r3f has its own)? Starting with the same reconciler and special-casing 3D node types is simpler.
4. **glTF parsing in Lua** — complex format. May need a JS-side parser that sends vertex data through the bridge, or a Lua parser. The [cgltf](https://github.com/jkuhlmann/cgltf) C library could be compiled into a Love2D module.
5. **Depth buffer interaction** — if a 3D viewport overlaps 2D UI via z-index, how do the depth buffers interact? Probably need to flush depth between 3D and 2D passes.
6. **Shadow mapping** — requires rendering from light's perspective to a depth texture. Love2D supports this but adds complexity.
7. **Grid targets** — 3D makes no sense on terminal/CC. The package should be Love2D + web only, with a clear error on grid targets.

## Priority

1. **Proof of concept** — vendor g3d, get a `<Scene>` with a spinning `<Mesh>` rendering inside a 2D layout. Validate the Canvas compositing approach.
2. **Camera + controls** — OrbitControls, perspective/ortho switching
3. **Built-in primitives** — box, sphere, plane, cylinder, torus
4. **Lighting** — ambient + point lights via GLSL
5. **Model loading** — .obj with textures
6. **Mouse interaction** — raycasting, onClick/onPointerEnter
7. **useFrame** — per-frame imperative escape hatch
8. **Materials** — basic + phong + textured
9. **glTF support** — full scene loading
10. **Physics** — basic rigid body simulation
11. **Advanced** — shadows, particles, post-processing, PBR

## References

- [g3d — GitHub](https://github.com/groverburger/g3d) — the Lua 3D engine we wrap
- [g3d FPS example](https://github.com/groverburger/g3d_fps) — first-person controller reference
- [react-three-fiber](https://github.com/pmndrs/react-three-fiber) — the API design gold standard for declarative 3D in React
- [react-three-fiber docs](https://docs.pmnd.rs/react-three-fiber) — patterns for JSX → 3D object mapping
- [Love2D Mesh docs](https://love2d.org/wiki/Mesh) — underlying vertex mesh API
- [Love2D Shader docs](https://love2d.org/wiki/love.graphics.newShader) — GLSL shader API
- [Love2D Canvas docs](https://love2d.org/wiki/Canvas) — off-screen render targets
