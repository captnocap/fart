/**
 * Object Detection — two approaches to foreground segmentation + background replacement.
 *
 * Tab 1 "Border Detect": samples border pixels as background, auto-segments foreground.
 * Tab 2 "Seed Flood": user clicks a point on the subject, flood-fills outward by color
 *   similarity, then validates the boundary through 4 edge detection channels averaged
 *   into a consensus edge.
 *
 * All compute runs in Lua/GLSL. React just declares layout and buttons.
 */

import React, { useState, useRef } from 'react';
import { Box, Text, Image, Pressable, ScrollView, Native, CodeBlock, classifiers as S } from '../../../packages/core/src';
import type { LayoutEvent, LoveEvent } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { useObjectDetect, useFloodDetect, useImaging } from '../../../packages/imaging/src';
import type { DetectForegroundParams, FloodDetectParams } from '../../../packages/imaging/src';
import { Band, Half, CalloutBand, SectionLabel, PageColumn } from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#06b6d4',
  detect: '#22d3ee',
  flood: '#f59e0b',
  mask: '#a78bfa',
  composite: '#34d399',
  param: '#fbbf24',
  callout: 'rgba(6, 182, 212, 0.06)',
  calloutBorder: 'rgba(6, 182, 212, 0.30)',
  floodCallout: 'rgba(245, 158, 11, 0.06)',
  floodCalloutBorder: 'rgba(245, 158, 11, 0.30)',
};

// ── Static images ────────────────────────────────────────

const FG_SRC = 'lib/placeholders/avatar.png';
const BG_SRC = 'lib/placeholders/landscape.png';
const BORDER_OUTPUT = 'object_detect_result.png';
const FLOOD_OUTPUT = 'flood_detect_result.png';
const BORDER_MASK_OUTPUT = 'object_detect_mask.png';
const FLOOD_MASK_OUTPUT = 'flood_detect_mask.png';

// ── Code samples ─────────────────────────────────────────

const BORDER_CODE = `const { detectForeground,
        compositeBackground } = useObjectDetect();

const det = await detectForeground('avatar.png');
await compositeBackground(
  'avatar.png', 'landscape.png',
  det.maskId, 'output.png'
);`;

const FLOOD_CODE = `const { floodDetect,
        compositeBackground } = useFloodDetect();

// User clicked at (256, 300) on the robot
const det = await floodDetect(
  'avatar.png', 256, 300,
  { tolerance: 0.2 }
);
await compositeBackground(
  'avatar.png', 'landscape.png',
  det.maskId, 'output.png'
);`;

// ── Border detect presets ────────────────────────────────

const BORDER_PRESETS: { label: string; params: DetectForegroundParams }[] = [
  { label: 'Auto', params: {} },
  { label: 'Tight', params: { threshold: 0.15, softness: 0.04, morphRadius: 3, featherRadius: 2, edgeWeight: 1.0 } },
  { label: 'Soft', params: { threshold: 0.25, softness: 0.12, morphRadius: 2, featherRadius: 6, edgeWeight: 0.5 } },
  { label: 'Wide', params: { threshold: 0.35, softness: 0.15, morphRadius: 1, featherRadius: 4, edgeWeight: 0.3 } },
];

// ── Flood detect presets ─────────────────────────────────

const FLOOD_PRESETS: { label: string; params: FloodDetectParams }[] = [
  { label: 'Normal', params: { tolerance: 0.2 } },
  { label: 'Tight', params: { tolerance: 0.12, edgeStrength: 1.0, edgeThreshold: 0.05 } },
  { label: 'Loose', params: { tolerance: 0.35, edgeStrength: 0.6, edgeThreshold: 0.12 } },
  { label: 'Broad', params: { tolerance: 0.5, adaptive: true, edgeStrength: 0.8, featherRadius: 4 } },
];

// ── Source image dimensions (actual pixel size of avatar.png) ──

const SRC_W = 512;
const SRC_H = 512;

// ── Styles (hoisted) ─────────────────────────────────────

const S_ROOT = { width: '100%' as const, height: '100%' as const };
const S_HEADER = { paddingTop: 32, paddingBottom: 8, paddingLeft: 24, paddingRight: 24, alignItems: 'center' as const };
const S_TITLE = { fontSize: 28, fontWeight: 'bold' as const };
const S_SUBTITLE = { fontSize: 14, marginTop: 4 };
const S_TABS = { flexDirection: 'row' as const, justifyContent: 'center' as const, gap: 0, marginTop: 12, marginBottom: 16 };
const S_TAB = { paddingLeft: 20, paddingRight: 20, paddingTop: 10, paddingBottom: 10 };
const S_TAB_TXT = { fontSize: 14, fontWeight: 'bold' as const };
const S_PREVIEW_ROW = { flexDirection: 'row' as const, gap: 12, justifyContent: 'center' as const, paddingLeft: 16, paddingRight: 16 };
const S_PREVIEW_BOX = { borderRadius: 8, overflow: 'hidden' as const };
const S_PREVIEW_LABEL = { fontSize: 11, textAlign: 'center' as const, marginTop: 4, marginBottom: 2 };
const S_IMG = { width: 220, height: 220 };
const S_RESULT_IMG = { width: 280, height: 280 };
const S_ACTIONS = { flexDirection: 'row' as const, gap: 8, justifyContent: 'center' as const, paddingTop: 12, paddingBottom: 12 };
const S_BTN = { paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 8 };
const S_BTN_TXT = { fontSize: 13, fontWeight: 'bold' as const };
const S_PRESETS = { flexDirection: 'row' as const, gap: 6, justifyContent: 'center' as const, paddingBottom: 8 };
const S_PRESET_BTN = { paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 6 };
const S_PRESET_TXT = { fontSize: 12 };
const S_STATUS = { fontSize: 12, textAlign: 'center' as const, paddingTop: 4, paddingBottom: 8 };
const S_RESULT_WRAP = { alignItems: 'center' as const, paddingTop: 8, paddingBottom: 16 };
const S_SECTION = { paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16 };
const S_DIVIDER = { height: 1, marginTop: 16, marginBottom: 16 };

// ── Shared: Preset Row ───────────────────────────────────

function PresetRow({ items, active, onSelect, accentColor }: {
  items: { label: string }[];
  active: number;
  onSelect: (i: number) => void;
  accentColor: string;
}) {
  const c = useThemeColors();
  return (
    <Box style={S_PRESETS}>
      {items.map((p, i) => (
        <Pressable key={p.label} onPress={() => onSelect(i)}>
          <Box style={{
            ...S_PRESET_BTN,
            backgroundColor: i === active ? accentColor : c.bgElevated,
            borderWidth: 1,
            borderColor: i === active ? accentColor : c.border,
          }}>
            <Text style={{
              ...S_PRESET_TXT,
              color: i === active ? '#000' : c.text,
              fontWeight: i === active ? 'bold' as const : 'normal' as const,
            }}>
              {p.label}
            </Text>
          </Box>
        </Pressable>
      ))}
    </Box>
  );
}

// ── Tab 1: Border Detect ─────────────────────────────────

function BorderDetectPanel() {
  const c = useThemeColors();
  const { detectForeground, compositeBackground, releaseMask, processing, error } = useObjectDetect();
  const { apply } = useImaging();

  const [maskId, setMaskId] = useState<string | null>(null);
  const [hasResult, setHasResult] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [preset, setPreset] = useState(0);
  const [status, setStatus] = useState('Press Run All to detect + composite.');

  const runAll = async () => {
    if (maskId) { await releaseMask(maskId); setMaskId(null); }
    setHasResult(false);
    setHasMask(false);
    setStatus('Running border detection pipeline...');

    const params = BORDER_PRESETS[preset].params;
    const det = await detectForeground(FG_SRC, params);
    if (!det?.ok) { setStatus(`Failed: ${det?.error || 'unknown'}`); return; }
    setMaskId(det.maskId);

    await apply({ src: FG_SRC, operations: [{ op: 'detect_foreground', ...params }], output: BORDER_MASK_OUTPUT });
    setHasMask(true);

    const comp = await compositeBackground(FG_SRC, BG_SRC, det.maskId, BORDER_OUTPUT);
    if (!comp?.ok) { setStatus(`Composite failed: ${comp?.error || 'unknown'}`); return; }

    setHasResult(true);
    setStatus(`Done! ${comp.width}x${comp.height}`);
  };

  return (
    <Box>
      <SectionLabel color={C.detect} label="Preset" />
      <PresetRow items={BORDER_PRESETS} active={preset} onSelect={setPreset} accentColor={C.detect} />

      <Box style={S_ACTIONS}>
        <Pressable onPress={runAll}>
          <Box style={{ ...S_BTN, backgroundColor: C.detect }}>
            <Text style={{ ...S_BTN_TXT, color: '#000' }}>Run All</Text>
          </Box>
        </Pressable>
      </Box>

      <Text style={{ ...S_STATUS, color: error ? '#ef4444' : processing ? C.accent : c.muted }}>
        {processing ? 'Processing...' : error || status}
      </Text>

      {hasMask && (
        <Box>
          <SectionLabel color={C.mask} label="Detection Mask" />
          <Box style={S_RESULT_WRAP}>
            <Box style={{ ...S_PREVIEW_BOX, borderWidth: 2, borderColor: C.mask }}>
              <Native type="Imaging" src={BORDER_MASK_OUTPUT} operations="[]" style={S_IMG} />
            </Box>
          </Box>
        </Box>
      )}

      {hasResult && (
        <Box>
          <SectionLabel color={C.composite} label="Result" />
          <Box style={S_RESULT_WRAP}>
            <Box style={{ ...S_PREVIEW_BOX, borderWidth: 2, borderColor: C.composite }}>
              <Native type="Imaging" src={BORDER_OUTPUT} operations="[]" style={S_RESULT_IMG} />
            </Box>
          </Box>
        </Box>
      )}

      <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
        <Text style={{ fontSize: 12, color: c.text, lineHeight: 18 }}>
          {`Approach: Sample border pixels as "definite background", k-means cluster into 4 colors, GPU shader measures per-pixel distance to clusters, Sobel edge refines boundaries, morphological cleanup + feather.`}
        </Text>
      </CalloutBand>

      <Box style={{ ...S_DIVIDER, backgroundColor: c.border }} />
      <SectionLabel color={C.detect} label="Code" />
      <Box style={S_SECTION}>
        <CodeBlock value={BORDER_CODE} />
      </Box>
    </Box>
  );
}

// ── Tab 2: Seed Flood Detect ─────────────────────────────

/** Display size of the clickable foreground image */
const CLICK_IMG_SIZE = 280;

function FloodDetectPanel() {
  const c = useThemeColors();
  const { floodDetect, compositeBackground, releaseMask, processing, error } = useFloodDetect();

  const [maskId, setMaskId] = useState<string | null>(null);
  const [hasResult, setHasResult] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [preset, setPreset] = useState(0);
  const [seed, setSeed] = useState<{ x: number; y: number } | null>(null);
  const [status, setStatus] = useState('Click on the robot to place your seed point.');

  // Track the image element's screen position via onLayout on wrapper
  const imgRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const handleImgLayout = (e: LayoutEvent) => {
    imgRectRef.current = { x: e.x, y: e.y, w: e.width, h: e.height };
  };

  const handleImgClick = async (e: LoveEvent) => {
    const rect = imgRectRef.current;
    if (!rect || e.x == null || e.y == null) return;

    // Screen coords → element-local coords
    const localX = e.x - rect.x;
    const localY = e.y - rect.y;

    // Element-local → source image coords (element displays at CLICK_IMG_SIZE square)
    const scaleX = SRC_W / rect.w;
    const scaleY = SRC_H / rect.h;
    const imgX = Math.round(Math.max(0, Math.min(SRC_W - 1, localX * scaleX)));
    const imgY = Math.round(Math.max(0, Math.min(SRC_H - 1, localY * scaleY)));

    setSeed({ x: imgX, y: imgY });

    // Auto-run full pipeline on click
    if (maskId) { await releaseMask(maskId); setMaskId(null); }
    setHasResult(false);
    setHasMask(false);
    setStatus(`Flood filling from (${imgX}, ${imgY})...`);

    const params = FLOOD_PRESETS[preset].params;
    const det = await floodDetect(FG_SRC, imgX, imgY, { ...params, output: FLOOD_MASK_OUTPUT } as any);
    if (!det?.ok) { setStatus(`Failed: ${det?.error || 'unknown'}`); return; }
    setMaskId(det.maskId);
    setHasMask(true);

    const comp = await compositeBackground(FG_SRC, BG_SRC, det.maskId, FLOOD_OUTPUT);
    if (!comp?.ok) { setStatus(`Composite failed: ${comp?.error || 'unknown'}`); return; }

    setHasResult(true);
    setStatus(`Done! Seed (${imgX}, ${imgY}) — ${comp.width}x${comp.height}`);
  };

  // Compute crosshair position in display coords
  const crosshair = seed ? {
    left: (seed.x / SRC_W) * CLICK_IMG_SIZE,
    top: (seed.y / SRC_H) * CLICK_IMG_SIZE,
  } : null;

  return (
    <Box>
      {/* Clickable source image */}
      <SectionLabel color={C.flood} label="Click on the image to place seed" />
      <Box style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 8 }}>
        <Box
          onLayout={handleImgLayout}
          style={{ width: CLICK_IMG_SIZE, height: CLICK_IMG_SIZE, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: C.flood }}
        >
          <Image src={FG_SRC} onClick={handleImgClick} style={{ width: CLICK_IMG_SIZE, height: CLICK_IMG_SIZE }} />
          {crosshair && (
            <Box style={{
              position: 'absolute',
              left: crosshair.left - 8,
              top: crosshair.top - 8,
              width: 16,
              height: 16,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: '#ff3333',
              backgroundColor: 'rgba(255, 51, 51, 0.3)',
            }} />
          )}
        </Box>
        <Text style={{ fontSize: 11, color: c.muted, marginTop: 6 }}>
          {seed ? `Seed: (${seed.x}, ${seed.y})` : 'No seed selected'}
        </Text>
      </Box>

      {/* Tolerance preset */}
      <SectionLabel color={C.flood} label="Tolerance Preset" />
      <PresetRow items={FLOOD_PRESETS} active={preset} onSelect={setPreset} accentColor={C.flood} />

      <Text style={{ ...S_STATUS, color: error ? '#ef4444' : processing ? C.flood : c.muted }}>
        {processing ? 'Processing...' : error || status}
      </Text>

      {hasMask && (
        <Box>
          <SectionLabel color={C.mask} label="Flood Mask" />
          <Box style={S_RESULT_WRAP}>
            <Box style={{ ...S_PREVIEW_BOX, borderWidth: 2, borderColor: C.mask }}>
              <Native type="Imaging" src={FLOOD_MASK_OUTPUT} operations="[]" style={S_IMG} />
            </Box>
            {seed && (
              <Text style={{ ...S_PREVIEW_LABEL, color: C.mask, marginTop: 6 }}>
                {`Seed: (${seed.x}, ${seed.y})`}
              </Text>
            )}
          </Box>
        </Box>
      )}

      {hasResult && (
        <Box>
          <SectionLabel color={C.composite} label="Result" />
          <Box style={S_RESULT_WRAP}>
            <Box style={{ ...S_PREVIEW_BOX, borderWidth: 2, borderColor: C.composite }}>
              <Native type="Imaging" src={FLOOD_OUTPUT} operations="[]" style={S_RESULT_IMG} />
            </Box>
          </Box>
        </Box>
      )}

      <CalloutBand borderColor={C.floodCalloutBorder} bgColor={C.floodCallout}>
        <Text style={{ fontSize: 12, color: c.text, lineHeight: 18 }}>
          {`Approach: Click anywhere on the image to select a seed point. BFS flood fill expands outward by color similarity (adaptive mean). Boundary validated through 4 independent edge channels (Sobel, Laplacian, luminance gradient, chroma gradient) averaged into consensus edge. Morphological cleanup + feather.`}
        </Text>
      </CalloutBand>

      <Box style={{ ...S_DIVIDER, backgroundColor: c.border }} />
      <SectionLabel color={C.flood} label="Code" />
      <Box style={S_SECTION}>
        <CodeBlock value={FLOOD_CODE} />
      </Box>
    </Box>
  );
}

// ── Main Component ───────────────────────────────────────

export function ObjectDetectStory() {
  const c = useThemeColors();
  const [tab, setTab] = useState<'border' | 'flood'>('border');

  return (
    <ScrollView style={S_ROOT}>
      <PageColumn>
        {/* Header */}
        <Box style={S_HEADER}>
          <Text style={{ ...S_TITLE, color: c.text }}>Object Detection</Text>
          <Text style={{ ...S_SUBTITLE, color: c.muted }}>
            {`Two approaches to foreground segmentation + background replacement`}
          </Text>
        </Box>

        {/* Tab bar */}
        <Box style={S_TABS}>
          <Pressable onPress={() => setTab('border')}>
            <Box style={{
              ...S_TAB,
              backgroundColor: tab === 'border' ? C.detect : 'transparent',
              borderBottomWidth: 2,
              borderBottomColor: tab === 'border' ? C.detect : c.border,
              borderTopLeftRadius: 8,
              borderBottomLeftRadius: 0,
            }}>
              <Text style={{ ...S_TAB_TXT, color: tab === 'border' ? '#000' : c.muted }}>
                Border Detect
              </Text>
            </Box>
          </Pressable>
          <Pressable onPress={() => setTab('flood')}>
            <Box style={{
              ...S_TAB,
              backgroundColor: tab === 'flood' ? C.flood : 'transparent',
              borderBottomWidth: 2,
              borderBottomColor: tab === 'flood' ? C.flood : c.border,
              borderTopRightRadius: 8,
              borderBottomRightRadius: 0,
            }}>
              <Text style={{ ...S_TAB_TXT, color: tab === 'flood' ? '#000' : c.muted }}>
                Seed Flood
              </Text>
            </Box>
          </Pressable>
        </Box>

        {/* Source images (shared) */}
        <SectionLabel color={tab === 'border' ? C.detect : C.flood} label="Source Images" />
        <Box style={S_PREVIEW_ROW}>
          <Box>
            <Text style={{ ...S_PREVIEW_LABEL, color: tab === 'border' ? C.detect : C.flood }}>Foreground</Text>
            <Box style={{ ...S_PREVIEW_BOX, borderWidth: 2, borderColor: tab === 'border' ? C.detect : C.flood }}>
              <Image src={FG_SRC} style={S_IMG} />
            </Box>
          </Box>
          <Box>
            <Text style={{ ...S_PREVIEW_LABEL, color: C.composite }}>New Background</Text>
            <Box style={{ ...S_PREVIEW_BOX, borderWidth: 2, borderColor: C.composite }}>
              <Image src={BG_SRC} style={S_IMG} />
            </Box>
          </Box>
        </Box>

        <Box style={{ ...S_DIVIDER, backgroundColor: c.border }} />

        {/* Tab content */}
        {tab === 'border' ? <BorderDetectPanel /> : <FloodDetectPanel />}

        <Box style={{ height: 32 }} />
      </PageColumn>
    </ScrollView>
  );
}
