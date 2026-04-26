import { useRef } from 'react';
import { Box, Effect } from '../../../../runtime/primitives';
import { AST_SAMPLE_FILES } from './sampleContract';

export type AstContractNodeArrays = {
  kind: number[];
  start: number[];
  end: number[];
  children: Array<number[] | 0>;
};

export type AstContractFile = {
  path: string;
  root: number;
  count: number;
  nodes: AstContractNodeArrays;
  tagColor?: string;
  selected?: boolean;
};

export type AstFingerprintFile = {
  path: string;
  root: number;
  count: number;
  kind: number[];
  start: number[];
  end: number[];
  firstChild: number[];
  nextSibling: number[];
  maxEnd: number;
  tagColor?: string;
  selected?: boolean;
};

export type AstFingerprintInputFile = AstContractFile | AstFingerprintFile;
export type FingerprintContractNodeArrays = AstContractNodeArrays;
export type FingerprintContractFile = AstContractFile;
export type FingerprintPreparedFile = AstFingerprintFile;
export type FingerprintInputFile = AstFingerprintInputFile;

export type AstQuiltProps = {
  files?: readonly AstFingerprintInputFile[];
  gridSide?: number;
};

export type AstTileProps = {
  file?: AstFingerprintInputFile;
  files?: readonly AstFingerprintInputFile[];
  tileIndex?: number;
};

const DEFAULT_GRID_SIDE = 12;
const DEFAULT_TILE_INDEX = 0;
const FRAME_SIZE = 648;
const EFFECT_SIZE = 620;
const TILE_FRAME_SIZE = 360;
const TILE_EFFECT_SIZE = 332;
const TILE_GAP = 4;
const DEFAULT_SAMPLE_SET: readonly AstContractFile[] = AST_SAMPLE_FILES;

type PixelWriter = (x: number, y: number, r: number, g: number, b: number, a: number) => void;
type Rgb = { r: number; g: number; b: number };

function clamp(value: number, lo: number, hi: number): number {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

function isPreparedFile(file: AstFingerprintInputFile): file is AstFingerprintFile {
  return Array.isArray((file as AstFingerprintFile).firstChild) && Array.isArray((file as AstFingerprintFile).nextSibling);
}

function parseHexColor(color?: string): Rgb | null {
  if (!color || color[0] !== '#') return null;
  if (color.length === 7) {
    return {
      r: parseInt(color.slice(1, 3), 16) || 0,
      g: parseInt(color.slice(3, 5), 16) || 0,
      b: parseInt(color.slice(5, 7), 16) || 0,
    };
  }
  if (color.length === 4) {
    return {
      r: parseInt(color[1] + color[1], 16) || 0,
      g: parseInt(color[2] + color[2], 16) || 0,
      b: parseInt(color[3] + color[3], 16) || 0,
    };
  }
  return null;
}

export function prepareAstFingerprintFile(input: AstFingerprintInputFile): AstFingerprintFile {
  if (isPreparedFile(input)) return input;

  const firstChild = new Array<number>(input.count).fill(0);
  const nextSibling = new Array<number>(input.count).fill(0);
  const children = input.nodes.children;

  for (let index = 0; index < input.count; index++) {
    const childList = children[index];
    if (!Array.isArray(childList) || childList.length === 0) continue;
    firstChild[index] = childList[0];
    for (let childIndex = 0; childIndex < childList.length - 1; childIndex++) {
      const current = childList[childIndex] - 1;
      if (current >= 0 && current < nextSibling.length) nextSibling[current] = childList[childIndex + 1];
    }
  }

  let maxEnd = 0;
  for (let index = 0; index < input.nodes.end.length; index++) {
    const end = input.nodes.end[index] || 0;
    if (end > maxEnd) maxEnd = end;
  }

  return {
    path: input.path,
    root: input.root,
    count: input.count,
    kind: input.nodes.kind,
    start: input.nodes.start,
    end: input.nodes.end,
    firstChild,
    nextSibling,
    maxEnd,
    tagColor: input.tagColor,
    selected: input.selected,
  };
}

export function prepareAstFingerprintFiles(inputs: readonly AstFingerprintInputFile[]): AstFingerprintFile[] {
  const prepared: AstFingerprintFile[] = [];
  for (let index = 0; index < inputs.length; index++) {
    const file = inputs[index];
    if (!file || file.count <= 0) continue;
    prepared.push(prepareAstFingerprintFile(file));
  }
  return prepared;
}

function usePreparedFiles(inputs?: readonly AstFingerprintInputFile[]): AstFingerprintFile[] {
  const source = inputs ?? DEFAULT_SAMPLE_SET;
  const ref = useRef<{ source: readonly AstFingerprintInputFile[]; prepared: AstFingerprintFile[] } | null>(null);
  if (!ref.current || ref.current.source !== source) {
    ref.current = { source, prepared: prepareAstFingerprintFiles(source) };
  }
  return ref.current.prepared;
}

function usePreparedFile(input?: AstFingerprintInputFile): AstFingerprintFile | null {
  const source = input ?? null;
  const ref = useRef<{ source: AstFingerprintInputFile | null; prepared: AstFingerprintFile | null } | null>(null);
  if (!ref.current || ref.current.source !== source) {
    ref.current = { source, prepared: source ? prepareAstFingerprintFile(source) : null };
  }
  return ref.current.prepared;
}

function fillRect(
  write: PixelWriter,
  maxWidth: number,
  maxHeight: number,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
  a: number,
) {
  const x0 = clamp(x | 0, 0, maxWidth);
  const y0 = clamp(y | 0, 0, maxHeight);
  const x1 = clamp((x + w) | 0, 0, maxWidth);
  const y1 = clamp((y + h) | 0, 0, maxHeight);
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) write(px, py, r, g, b, a);
  }
}

function strokeRect(
  write: PixelWriter,
  maxWidth: number,
  maxHeight: number,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
  a: number,
) {
  const x0 = clamp(x | 0, 0, maxWidth - 1);
  const y0 = clamp(y | 0, 0, maxHeight - 1);
  const x1 = clamp((x + w - 1) | 0, 0, maxWidth - 1);
  const y1 = clamp((y + h - 1) | 0, 0, maxHeight - 1);
  if (x1 <= x0 || y1 <= y0) return;
  for (let px = x0; px <= x1; px++) {
    write(px, y0, r, g, b, a);
    write(px, y1, r, g, b, a);
  }
  for (let py = y0 + 1; py < y1; py++) {
    write(x0, py, r, g, b, a);
    write(x1, py, r, g, b, a);
  }
}

function colorFor(effect: any, kindId: number, depth: number, time: number, inScan: boolean): Rgb {
  let hue = ((kindId * 137) % 360) + time * 22 + depth * 7;
  if (inScan) hue += 55;

  const wave = Math.sin(time * 2.2 - depth * 0.55);
  let value = 0.62 + 0.18 * wave;
  let saturation = 0.55;
  if (inScan) {
    value = Math.min(1, value + 0.25);
    saturation = 0.78;
  }

  const rgb = effect.hsv((((hue % 360) + 360) % 360) / 360, saturation, value);
  return {
    r: (rgb[0] * 255) | 0,
    g: (rgb[1] * 255) | 0,
    b: (rgb[2] * 255) | 0,
  };
}

function drawFingerprintNode(
  effect: any,
  write: PixelWriter,
  file: AstFingerprintFile,
  node: number,
  x: number,
  y: number,
  w: number,
  h: number,
  depth: number,
  time: number,
  scanPos: number,
  maxWidth: number,
  maxHeight: number,
) {
  if (w < 1 || h < 1 || node === 0) return;

  const index = node - 1;
  const nodeStart = file.start[index] || 0;
  const nodeEnd = file.end[index] || 0;
  const inScan = scanPos >= nodeStart && scanPos < nodeEnd;
  const rgb = colorFor(effect, file.kind[index] || 0, depth, time, inScan);

  fillRect(write, maxWidth, maxHeight, x, y, w, h, rgb.r, rgb.g, rgb.b, 255);

  if (w >= 3 && h >= 3) {
    const outline = inScan ? 240 : 18;
    strokeRect(write, maxWidth, maxHeight, x, y, w, h, outline, outline, outline, 255);
  }

  const firstChild = file.firstChild[index] || 0;
  if (firstChild === 0) return;

  let total = 0;
  let child = firstChild;
  while (child !== 0) {
    const childIndex = child - 1;
    const span = Math.max(1, (file.end[childIndex] || 0) - (file.start[childIndex] || 0));
    total += span;
    child = file.nextSibling[childIndex] || 0;
  }
  if (total === 0) return;

  const horizontal = depth % 2 === 0;
  const pad = w > 24 && h > 24 ? 1 : 0;
  const innerX = x + pad;
  const innerY = y + pad;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  if (horizontal) {
    let cursorX = innerX;
    child = firstChild;
    while (child !== 0) {
      const childIndex = child - 1;
      const span = Math.max(1, (file.end[childIndex] || 0) - (file.start[childIndex] || 0));
      const childWidth = innerW * (span / total);
      drawFingerprintNode(
        effect,
        write,
        file,
        child,
        cursorX,
        innerY,
        childWidth,
        innerH,
        depth + 1,
        time,
        scanPos,
        maxWidth,
        maxHeight,
      );
      cursorX += childWidth;
      child = file.nextSibling[childIndex] || 0;
    }
    return;
  }

  let cursorY = innerY;
  child = firstChild;
  while (child !== 0) {
    const childIndex = child - 1;
    const span = Math.max(1, (file.end[childIndex] || 0) - (file.start[childIndex] || 0));
    const childHeight = innerH * (span / total);
    drawFingerprintNode(
      effect,
      write,
      file,
      child,
      innerX,
      cursorY,
      innerW,
      childHeight,
      depth + 1,
      time,
      scanPos,
      maxWidth,
      maxHeight,
    );
    cursorY += childHeight;
    child = file.nextSibling[childIndex] || 0;
  }
}

function drawTileDecoration(
  write: PixelWriter,
  maxWidth: number,
  maxHeight: number,
  tileX: number,
  tileY: number,
  tileSize: number,
  file: AstFingerprintFile,
) {
  const accent = parseHexColor(file.tagColor);
  if (accent) {
    strokeRect(write, maxWidth, maxHeight, tileX, tileY, tileSize, tileSize, accent.r, accent.g, accent.b, 255);
    fillRect(write, maxWidth, maxHeight, tileX + 3, tileY + 3, 7, 7, accent.r, accent.g, accent.b, 255);
  }
  if (file.selected) {
    strokeRect(write, maxWidth, maxHeight, tileX + 1, tileY + 1, tileSize - 2, tileSize - 2, 245, 250, 255, 255);
  }
}

function drawFingerprintTile(
  effect: any,
  write: PixelWriter,
  maxWidth: number,
  maxHeight: number,
  file: AstFingerprintFile,
  tileIndex: number,
  tileX: number,
  tileY: number,
  tileSize: number,
  now: number,
) {
  const time = now + tileIndex * 0.31;
  const triangle = Math.abs(((time * 0.35) % 2 + 2) % 2 - 1);
  const scanPos = (1 - triangle) * file.maxEnd;

  fillRect(write, maxWidth, maxHeight, tileX, tileY, tileSize, tileSize, 5, 10, 16, 255);
  strokeRect(write, maxWidth, maxHeight, tileX, tileY, tileSize, tileSize, 16, 28, 40, 255);
  drawFingerprintNode(effect, write, file, file.root, tileX, tileY, tileSize, tileSize, 0, time, scanPos, maxWidth, maxHeight);
  drawTileDecoration(write, maxWidth, maxHeight, tileX, tileY, tileSize, file);
}

function drawAstQuilt(effect: any, files: readonly AstFingerprintFile[], gridSide: number) {
  effect.clearColor(2 / 255, 5 / 255, 10 / 255, 1);
  if (files.length === 0) return;

  const write: PixelWriter = effect.setPixelRaw;
  const width = effect.width | 0;
  const height = effect.height | 0;
  const tileSize = Math.floor((Math.min(width, height) - TILE_GAP * (gridSide - 1)) / gridSide);
  const totalGrid = tileSize * gridSide + TILE_GAP * (gridSide - 1);
  const offsetX = Math.floor((width - totalGrid) * 0.5);
  const offsetY = Math.floor((height - totalGrid) * 0.5);

  for (let index = 0; index < gridSide * gridSide; index++) {
    const col = index % gridSide;
    const row = (index / gridSide) | 0;
    const tileX = offsetX + col * (tileSize + TILE_GAP);
    const tileY = offsetY + row * (tileSize + TILE_GAP);
    const file = files[index % files.length];
    drawFingerprintTile(effect, write, width, height, file, index, tileX, tileY, tileSize, effect.time);
  }
}

function drawAstTile(effect: any, file: AstFingerprintFile, tileIndex: number) {
  effect.clearColor(2 / 255, 5 / 255, 10 / 255, 1);

  const write: PixelWriter = effect.setPixelRaw;
  const width = effect.width | 0;
  const height = effect.height | 0;
  const size = Math.min(width, height);
  const tileX = Math.floor((width - size) * 0.5);
  const tileY = Math.floor((height - size) * 0.5);
  drawFingerprintTile(effect, write, width, height, file, tileIndex, tileX, tileY, size, effect.time);
}

function AstFrame({
  frameSize,
  effectSize,
  children,
}: {
  frameSize: number;
  effectSize: number;
  children?: any;
}) {
  return (
    <Box
      style={{
        width: frameSize,
        height: frameSize,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box style={{ width: effectSize, height: effectSize }}>{children}</Box>
    </Box>
  );
}

export function AstQuilt({ files, gridSide = DEFAULT_GRID_SIDE }: AstQuiltProps) {
  const prepared = usePreparedFiles(files);
  return (
    <AstFrame frameSize={FRAME_SIZE} effectSize={EFFECT_SIZE}>
      {prepared.length > 0 ? (
        <Effect onRender={(effect: any) => drawAstQuilt(effect, prepared, gridSide)} style={{ width: EFFECT_SIZE, height: EFFECT_SIZE }} />
      ) : null}
    </AstFrame>
  );
}

export function AstTile({ file, files, tileIndex = DEFAULT_TILE_INDEX }: AstTileProps) {
  const preparedFiles = usePreparedFiles(files);
  const safeIndex = preparedFiles.length > 0 ? ((tileIndex % preparedFiles.length) + preparedFiles.length) % preparedFiles.length : 0;
  const preparedSingle = usePreparedFile(file);
  const preparedFile = preparedSingle || preparedFiles[safeIndex] || null;

  return (
    <AstFrame frameSize={TILE_FRAME_SIZE} effectSize={TILE_EFFECT_SIZE}>
      {preparedFile ? (
        <Effect
          onRender={(effect: any) => drawAstTile(effect, preparedFile, tileIndex)}
          style={{ width: TILE_EFFECT_SIZE, height: TILE_EFFECT_SIZE }}
        />
      ) : null}
    </AstFrame>
  );
}

export const prepareFingerprintFile = prepareAstFingerprintFile;
export const prepareFingerprintFiles = prepareAstFingerprintFiles;
export const FingerprintQuilt = AstQuilt;
export const FingerprintTile = AstTile;
