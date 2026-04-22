const React: any = require('react');
const { useMemo, useState } = React;

import { Box, Col, Image, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { MediaImportDialog } from '../media-import/MediaImportDialog';
import { MediaLibrary } from '../media/MediaLibrary';
import { MaskLayer } from './MaskLayer';
import { MASKS, createMaskStackItem, getMaskDef, type MaskStackItem } from './maskCatalog';
import { useMaskPreview } from './useMaskPreview';
import type { MediaItem } from '../media/useMediaStore';

const Video: any = (props: any) => React.createElement('Video', props, props.children);

function SourceFrame(props: { item: MediaItem; style?: any }) {
  const item = props.item;
  if (item.kind === 'video') {
    return <Video source={item.source} video_src={item.source} paused={!item.video.playing} loop={item.video.loop} volume={item.video.volume} rate={item.video.rate} time={item.video.time} style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg, ...(props.style || {}) }} />;
  }
  return <Image source={item.source} style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg, objectFit: 'cover', ...(props.style || {}) }} />;
}

function Chip(props: { label: string; active?: boolean; muted?: boolean; onPress?: () => void; disabled?: boolean }) {
  const active = !!props.active;
  const muted = !!props.muted;
  const tone = active ? COLORS.blue : muted ? COLORS.textDim : COLORS.text;
  return (
    <Pressable onPress={props.onPress} disabled={props.disabled} style={{ opacity: props.disabled ? 0.55 : 1 }}>
      <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: active ? COLORS.blue : COLORS.border, backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt }}>
        <Text fontSize={10} color={tone}>{props.label}</Text>
      </Box>
    </Pressable>
  );
}

function ParamControl(props: { name: string; value: any; def: any; onChange: (next: any) => void }) {
  if (props.def.kind === 'bool') {
    return <Chip label={props.name + ': ' + (props.value ? 'on' : 'off')} active={!!props.value} onPress={() => props.onChange(!props.value)} />;
  }
  if (props.def.kind === 'enum') {
    const opts = props.def.options || [];
    const idx = Math.max(0, opts.indexOf(props.value));
    const next = opts[(idx + 1) % Math.max(1, opts.length)];
    return <Chip label={props.name + ': ' + String(props.value)} active={true} onPress={() => props.onChange(next)} />;
  }
  const step = props.def.step || 1;
  const min = props.def.min ?? -Infinity;
  const max = props.def.max ?? Infinity;
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <Row style={{ alignItems: 'center', gap: 4 }}>
      <Chip label={props.name} active={true} />
      <Pressable onPress={() => props.onChange(clamp(Number(props.value) - step))}>
        <Box style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
          <Text fontSize={10} color={COLORS.textDim}>−</Text>
        </Box>
      </Pressable>
      <Box style={{ paddingLeft: 7, paddingRight: 7, paddingTop: 4, paddingBottom: 4, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
        <Text fontSize={10} color={COLORS.textBright}>{String(props.value)}</Text>
      </Box>
      <Pressable onPress={() => props.onChange(clamp(Number(props.value) + step))}>
        <Box style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
          <Text fontSize={10} color={COLORS.textDim}>+</Text>
        </Box>
      </Pressable>
    </Row>
  );
}

function SourceAvailabilityBanner(props: { sources: ReturnType<typeof useMaskPreview>['liveSources'] }) {
  return (
    <Box style={{ gap: 8, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Live source picker</Text>
          <Text fontSize={10} color={COLORS.textDim}>The panel uses the selected media-library item as the live source today.</Text>
        </Col>
        <Chip label="media library" active={true} />
      </Row>
      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        {props.sources.map((source) => (
          <Chip key={source.id} label={source.label} active={source.active} muted={!source.available} disabled={!source.available} />
        ))}
      </Row>
      <Box style={{ padding: 10, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, gap: 4 }}>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Unwired live sources</Text>
        {props.sources.filter((source) => !source.available).map((source) => (
          <Text key={source.id} fontSize={10} color={COLORS.textDim}>{source.label + ': ' + source.detail}</Text>
        ))}
      </Box>
    </Box>
  );
}

function StackRow(props: {
  item: MaskStackItem;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const def = getMaskDef(props.item.maskId);
  return (
    <Pressable onPress={props.onSelect} style={{ padding: 10, gap: 8, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: props.selected ? COLORS.blue : COLORS.border, backgroundColor: props.selected ? COLORS.blueDeep : COLORS.panelBg }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0, minWidth: 0 }}>
          <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{def.label}</Text>
          <Text fontSize={9} color={COLORS.textDim} numberOfLines={1}>{def.desc}</Text>
        </Col>
        <Chip label={props.item.enabled ? 'on' : 'off'} active={props.item.enabled} onPress={props.onToggle} />
      </Row>
      <Row style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip label="up" onPress={props.onMoveUp} />
        <Chip label="down" onPress={props.onMoveDown} />
        <Chip label="remove" muted={true} onPress={props.onRemove} />
      </Row>
    </Pressable>
  );
}

function MaskCatalogCard(props: { maskId: MaskStackItem['maskId']; selected: boolean; onAdd: () => void }) {
  const def = getMaskDef(props.maskId);
  return (
    <Pressable onPress={props.onAdd}>
      <Box style={{ gap: 6, padding: 10, minHeight: 92, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: props.selected ? COLORS.blue : COLORS.borderSoft, backgroundColor: props.selected ? COLORS.blueDeep : COLORS.panelRaised }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{def.label}</Text>
          <Chip label="+" active={true} />
        </Row>
        <Text fontSize={9} color={COLORS.textDim}>{def.desc}</Text>
      </Box>
    </Pressable>
  );
}

function buildStackPreview(item: MediaItem | null, width: number, height: number, time: number, stack: MaskStackItem[]) {
  if (!item) return null;
  let content: any = (
    <Box style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <SourceFrame item={item} />
    </Box>
  );
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const entry = stack[i];
    if (!entry.enabled) continue;
    content = (
      <MaskLayer key={entry.id} mask={entry.maskId} width={width} height={height} time={time} {...entry.params}>
        {content}
      </MaskLayer>
    );
  }
  return content;
}

function stageSize(item: MediaItem | null): { width: number; height: number } {
  const w = 760;
  if (!item) return { width: w, height: 420 };
  const ratio = item.width > 0 ? item.height / item.width : 0.66;
  const h = Math.round(w * ratio);
  return {
    width: w,
    height: Math.max(280, Math.min(460, h)),
  };
}

export function MasksPanel() {
  const store = useMaskPreview();
  const [showImport, setShowImport] = useState(false);
  const [stack, setStack] = useState<MaskStackItem[]>([]);
  const [selectedStackId, setSelectedStackId] = useState<string>('');

  const selected = store.active;
  const hasMedia = !!selected;
  const size = stageSize(selected);

  const selectedStackItem = useMemo(() => stack.find((item) => item.id === selectedStackId) || stack[0] || null, [stack, selectedStackId]);

  const addMask = (maskId: MaskStackItem['maskId']) => {
    const next = createMaskStackItem(maskId);
    setStack((prev) => [...prev, next]);
    setSelectedStackId(next.id);
  };

  const updateMaskParams = (itemId: string, propName: string, nextValue: any) => {
    setStack((prev) => prev.map((item) => item.id === itemId ? { ...item, params: { ...item.params, [propName]: nextValue } } : item));
  };

  const moveMask = (itemId: string, delta: number) => {
    setStack((prev) => {
      const idx = prev.findIndex((item) => item.id === itemId);
      if (idx < 0) return prev;
      const nextIdx = Math.max(0, Math.min(prev.length - 1, idx + delta));
      if (nextIdx === idx) return prev;
      const next = prev.slice();
      const [picked] = next.splice(idx, 1);
      next.splice(nextIdx, 0, picked);
      return next;
    });
  };

  const toggleMask = (itemId: string) => {
    setStack((prev) => prev.map((item) => item.id === itemId ? { ...item, enabled: !item.enabled } : item));
  };

  const removeMask = (itemId: string) => {
    setStack((prev) => prev.filter((item) => item.id !== itemId));
    setSelectedStackId((current) => current === itemId ? '' : current);
  };

  const selectedDef = selectedStackItem ? getMaskDef(selectedStackItem.maskId) : null;
  const activeStack = useMemo(() => stack.filter((item) => item.enabled), [stack]);
  const preview = buildStackPreview(selected, size.width, size.height, store.time, stack);

  return (
    <Col style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, backgroundColor: COLORS.panelBg }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0, minWidth: 0 }}>
          <Text fontSize={14} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Masks</Text>
          <Text fontSize={10} color={COLORS.textDim}>Stack post-processing masks on the selected live media source.</Text>
        </Col>
        <Row style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Chip label={hasMedia ? 'source: ' + selected!.kind : 'source: none'} active={hasMedia} />
          <Chip label={String(activeStack.length) + ' active'} active={activeStack.length > 0} />
          <Pressable onPress={() => setShowImport(true)}>
            <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.blue, backgroundColor: COLORS.blueDeep }}>
              <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>import media</Text>
            </Box>
          </Pressable>
        </Row>
      </Row>

      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <Box style={{ width: 320, minWidth: 300, borderRightWidth: 1, borderRightColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg }}>
          <MediaLibrary
            items={store.items}
            selectedId={store.selectedId}
            onSelect={store.setSelectedId}
            onRemove={store.removeMedia}
            onAdd={store.addMedia}
          />
        </Box>

        <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 0, padding: 12 }}>
          <Col style={{ gap: 12, minHeight: 0 }}>
            <SourceAvailabilityBanner sources={store.liveSources} />

            {!hasMedia ? (
              <Box style={{ padding: 14, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised, gap: 6 }}>
                <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Select or import a live source</Text>
                <Text fontSize={10} color={COLORS.textDim}>Masks apply to the selected media-library item. Other live capture surfaces are not wired yet, and the banner above says so explicitly.</Text>
              </Box>
            ) : null}

            <Box style={{ gap: 10, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
                  <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{selected ? selected.title : 'No live source selected'}</Text>
                  <Text fontSize={10} color={COLORS.textDim}>{selected ? selected.source : 'Pick an item from the media library to feed the mask stack.'}</Text>
                </Col>
                {selected ? <Chip label={selected.kind} active={true} /> : null}
              </Row>
              {selected ? (
                <Box style={{ width: size.width, height: size.height, alignSelf: 'center', borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, overflow: 'hidden', boxShadow: TOKENS.shadow3 }}>
                  {preview}
                </Box>
              ) : (
                <Box style={{ padding: 16, minHeight: 220, alignItems: 'center', justifyContent: 'center', borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
                  <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>No live preview</Text>
                </Box>
              )}
            </Box>

            <Box style={{ gap: 8, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
                  <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Stack editor</Text>
                  <Text fontSize={10} color={COLORS.textDim}>Masks are applied in order from top to bottom, then previewed live against the selected source.</Text>
                </Col>
                {selectedStackItem ? <Chip label={selectedDef ? selectedDef.label : selectedStackItem.maskId} active={true} /> : null}
              </Row>

              {selectedStackItem && selectedDef ? (
                <Col style={{ gap: 8 }}>
                  <Text fontSize={10} color={COLORS.textDim}>{selectedDef.desc}</Text>
                  <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                    {selectedDef.props.map((prop) => (
                      <ParamControl
                        key={prop.name}
                        name={prop.name}
                        value={selectedStackItem.params[prop.name] ?? prop.defaultVal}
                        def={prop}
                        onChange={(next) => updateMaskParams(selectedStackItem.id, prop.name, next)}
                      />
                    ))}
                  </Row>
                </Col>
              ) : (
                <Box style={{ padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
                  <Text fontSize={10} color={COLORS.textDim}>Add a mask from the catalog on the right, then select it here to tune parameters.</Text>
                </Box>
              )}
            </Box>
          </Col>
        </ScrollView>

        <Box style={{ width: 360, minWidth: 340, borderLeftWidth: 1, borderLeftColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg }}>
          <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, padding: 12 }}>
            <Col style={{ gap: 12 }}>
              <Box style={{ gap: 8, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
                    <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Mask catalog</Text>
                    <Text fontSize={10} color={COLORS.textDim}>Tap any effect to append it to the live stack.</Text>
                  </Col>
                  <Chip label={String(MASKS.length)} active={true} />
                </Row>
                <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                  {MASKS.map((mask) => (
                    <Box key={mask.id} style={{ flexBasis: 148, flexGrow: 1, minWidth: 148 }}>
                      <MaskCatalogCard maskId={mask.id} selected={stack.some((item) => item.maskId === mask.id)} onAdd={() => addMask(mask.id)} />
                    </Box>
                  ))}
                </Row>
              </Box>

              <Box style={{ gap: 8, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
                    <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Active stack</Text>
                    <Text fontSize={10} color={COLORS.textDim}>{stack.length === 0 ? 'No masks yet.' : 'Reorder, disable, or remove masks from the live stack.'}</Text>
                  </Col>
                  <Chip label={String(stack.length)} active={stack.length > 0} />
                </Row>
                <Col style={{ gap: 8 }}>
                  {stack.length === 0 ? (
                    <Box style={{ padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
                      <Text fontSize={10} color={COLORS.textDim}>Pick one of the masks above to start building a stack.</Text>
                    </Box>
                  ) : stack.map((item, index) => (
                    <StackRow
                      key={item.id}
                      item={item}
                      selected={item.id === selectedStackItem?.id}
                      onSelect={() => setSelectedStackId(item.id)}
                      onToggle={() => toggleMask(item.id)}
                      onMoveUp={() => moveMask(item.id, -1)}
                      onMoveDown={() => moveMask(item.id, 1)}
                      onRemove={() => removeMask(item.id)}
                    />
                  ))}
                </Col>
              </Box>
            </Col>
          </ScrollView>
        </Box>
      </Row>

      <MediaImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onConfirm={(items) => items.forEach((item) => store.addMedia(item.kind === 'video' ? 'video' : 'image', item.path, item.name))}
      />
    </Col>
  );
}

export default MasksPanel;
