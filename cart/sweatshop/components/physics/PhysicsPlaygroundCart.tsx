// <PhysicsPlaygroundCart /> — live demo panel exercising the physics
// port: a ground plane, a falling stack, a distance-joint pendulum,
// spawn buttons, and user-controlled gravity + debug overlay. Acts as
// both a smoke test and the reference wiring for the API.

const React: any = require('react');
const { useCallback, useRef, useState } = React;

import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { PhysicsWorld } from './PhysicsWorld';
import { RigidBody, PhysicsMotion } from './RigidBody';
import { Collider } from './Collider';
import { Joint } from './Joint';
import { PhysicsDebugLayer } from './PhysicsDebugLayer';
import { usePhysics } from './usePhysics';

const ARENA_W = 640;
const ARENA_H = 360;
const BODY_COLORS = ['#ef5350', '#4fc3f7', '#66bb6a', '#ffa726', '#ab47bc', '#26c6da'];

export function PhysicsPlaygroundCart() {
  const [gravityY, setGravityY] = useState(800);
  const [gravityX, setGravityX] = useState(0);
  const [debug, setDebug] = useState(true);
  const [dynamicBodies, setDynamicBodies] = useState<Array<{ id: string; x: number; y: number; r: number; color: string }>>(() => initialStack());
  const seedRef = useRef<number>(0);

  const spawn = useCallback((count: number) => {
    setDynamicBodies((prev) => {
      const next = prev.slice();
      for (let i = 0; i < count; i++) {
        seedRef.current++;
        const id = 'dyn-' + seedRef.current;
        const r = 10 + (seedRef.current * 37) % 12;
        next.push({
          id,
          x: 80 + (seedRef.current * 53) % (ARENA_W - 160),
          y: 20 + (seedRef.current * 17) % 40,
          r,
          color: BODY_COLORS[seedRef.current % BODY_COLORS.length],
        });
      }
      return next;
    });
  }, []);
  const reset = useCallback(() => { seedRef.current = 0; setDynamicBodies(initialStack()); }, []);

  return React.createElement(Col, { style: { width: '100%', height: '100%', backgroundColor: COLORS.panelBg } },
    React.createElement(Row, {
      style: {
        padding: 10, gap: 10, alignItems: 'center', borderBottomWidth: 1, borderColor: COLORS.borderSoft,
      },
    },
      React.createElement(Text, { fontSize: 12, color: COLORS.textBright, style: { fontWeight: 'bold' } }, 'Physics Playground'),
      React.createElement(Box, { style: { flexGrow: 1 } }),
      GravityKnob({ label: 'gx', value: gravityX, step: 200, set: setGravityX }),
      GravityKnob({ label: 'gy', value: gravityY, step: 200, set: setGravityY }),
      React.createElement(Pressable, { onPress: () => setDebug(!debug) },
        React.createElement(Tag, { tone: debug ? COLORS.green : COLORS.textDim, label: debug ? 'debug: on' : 'debug: off' }),
      ),
      React.createElement(Pressable, { onPress: () => spawn(5) },
        React.createElement(Tag, { tone: COLORS.blue, label: '+5' }),
      ),
      React.createElement(Pressable, { onPress: () => spawn(20) },
        React.createElement(Tag, { tone: COLORS.blue, label: '+20' }),
      ),
      React.createElement(Pressable, { onPress: reset },
        React.createElement(Tag, { tone: COLORS.orange, label: 'reset' }),
      ),
    ),
    React.createElement(Box, { style: { flexGrow: 1, padding: 20, alignItems: 'center', justifyContent: 'center' } },
      React.createElement(Box, {
        style: {
          width: ARENA_W, height: ARENA_H, position: 'relative',
          borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
          overflow: 'hidden',
        },
      },
        React.createElement(PhysicsWorld, { gravity: [gravityX, gravityY], timeStep: 1 / 60, debug },
          // Ground — static, axis-aligned.
          React.createElement(RigidBody, { id: 'ground', type: 'static', x: ARENA_W / 2, y: ARENA_H - 10, shape: { kind: 'rectangle', width: ARENA_W, height: 20 } }),
          // Walls.
          React.createElement(RigidBody, { id: 'wall-l', type: 'static', x: 10, y: ARENA_H / 2, shape: { kind: 'rectangle', width: 20, height: ARENA_H } }),
          React.createElement(RigidBody, { id: 'wall-r', type: 'static', x: ARENA_W - 10, y: ARENA_H / 2, shape: { kind: 'rectangle', width: 20, height: ARENA_H } }),
          // Pendulum — static pivot + dynamic bob connected by a distance joint.
          React.createElement(RigidBody, { id: 'pivot', type: 'static', x: ARENA_W - 120, y: 40, shape: { kind: 'circle', radius: 4 } }),
          React.createElement(RigidBody, { id: 'bob', type: 'dynamic', x: ARENA_W - 60, y: 120, mass: 2, shape: { kind: 'circle', radius: 14 } }),
          React.createElement(Joint, { id: 'pendulum', kind: 'distance', bodyA: 'pivot', bodyB: 'bob', restLength: 90, stiffness: 1, damping: 0.05 }),
          // Dynamic bodies.
          ...dynamicBodies.map((d) =>
            React.createElement(RigidBody, { key: d.id, id: d.id, type: 'dynamic', x: d.x, y: d.y, shape: { kind: 'circle', radius: d.r, restitution: 0.25 } },
              React.createElement(Collider, { shape: 'circle', radius: d.r, density: 1, friction: 0.3, restitution: 0.25 }),
            ),
          ),
          // Visual layer — read live positions and paint shapes.
          React.createElement(ArenaVisuals, { ids: dynamicBodies.map((d) => ({ id: d.id, r: d.r, color: d.color })) }),
          // Debug overlay.
          debug ? React.createElement(PhysicsDebugLayer, {}) : null,
        ),
      ),
    ),
  );
}

function ArenaVisuals({ ids }: { ids: Array<{ id: string; r: number; color: string }> }) {
  return React.createElement(Box, { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } },
    ids.map((i) => React.createElement(PhysicsMotion, { key: i.id, id: i.id },
      (s: { position: { x: number; y: number } }) =>
        React.createElement(Box, {
          style: {
            position: 'absolute',
            left: s.position.x - i.r,
            top: s.position.y - i.r,
            width: i.r * 2,
            height: i.r * 2,
            borderRadius: i.r,
            backgroundColor: i.color,
          },
        }),
    )),
  );
}

function GravityKnob({ label, value, step, set }: { label: string; value: number; step: number; set: (n: number) => void }) {
  return React.createElement(Row, { style: { gap: 4, alignItems: 'center' } },
    React.createElement(Text, { fontSize: 9, color: COLORS.textMuted }, label),
    React.createElement(Pressable, { onPress: () => set(value - step) },
      React.createElement(Tag, { tone: COLORS.textDim, label: '−' }),
    ),
    React.createElement(Text, { fontSize: 10, color: COLORS.text, style: { minWidth: 40, textAlign: 'center' } }, String(value)),
    React.createElement(Pressable, { onPress: () => set(value + step) },
      React.createElement(Tag, { tone: COLORS.textDim, label: '+' }),
    ),
  );
}

function Tag({ tone, label }: { tone: string; label: string }) {
  return React.createElement(Box, {
    style: {
      paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
      borderRadius: 6, borderWidth: 1, borderColor: tone,
    },
  }, React.createElement(Text, { fontSize: 10, color: tone, style: { fontWeight: 'bold' } }, label));
}

function initialStack() {
  const out: Array<{ id: string; x: number; y: number; r: number; color: string }> = [];
  for (let i = 0; i < 6; i++) {
    out.push({ id: 'stack-' + i, x: 180 + (i % 3) * 40, y: 40 + Math.floor(i / 3) * 40, r: 16, color: BODY_COLORS[i % BODY_COLORS.length] });
  }
  return out;
}

// usePhysics re-export kept live so ESLint/users don't delete it — also used
// if someone imports "from '.../PhysicsPlaygroundCart'" for the dev surface.
export { usePhysics };
