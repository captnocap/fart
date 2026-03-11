/**
 * Gallery — Component showcase with live thumbnail tab bar.
 *
 * Structure:
 *   Header row 1 — Gallery title + badge
 *   Header row 2 — Component name + package badge + counter
 *   Info row     — description | code example | props/callbacks
 *   Preview      — LIVE DEMO of active component (flexGrow: 1)
 *   Divider bar  — drag handle + search input (expandable)
 *   Tab grid     — thumbnail previews (fills remaining space)
 *
 * All thumbnails and previews live in GalleryComponents.tsx.
 */

import React, { useState, useMemo } from 'react';
import { Box, Text, Image, Pressable, ScrollView, CodeBlock, Input, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { getAll, PKG_COLORS } from './galleryRegistry';
import './GalleryComponents'; // side-effect: registers all components

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  selected: 'rgba(139, 92, 246, 0.2)',
};

// TABS is now driven by the registry — components self-register in GalleryComponents.tsx

// ── Helpers ──────────────────────────────────────────────

function HorizontalDivider() {
  const c = useThemeColors();
  return <S.StoryDivider />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <S.VertDivider style={{ flexShrink: 0, alignSelf: 'stretch' }} />;
}

// ── GalleryStory ─────────────────────────────────────────

export function GalleryStory() {
  const c = useThemeColors();
  const TABS = getAll();
  const [activeId, setActiveId] = useState(TABS[0]?.id ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [tabsExpanded, setTabsExpanded] = useState(false);
  const tab = TABS.find(it => it.id === activeId) || TABS[0];
  const pkgColor = PKG_COLORS[tab?.pkg];

  const filteredTabs = useMemo(() => {
    if (!searchQuery) return TABS;
    const q = searchQuery.toLowerCase();
    return TABS.filter(t =>
      t.label.toLowerCase().includes(q) ||
      t.pkg.toLowerCase().includes(q) ||
      t.desc.toLowerCase().includes(q)
    );
  }, [searchQuery, TABS]);

  const tabGridHeight = tabsExpanded ? 380 : 232;

  return (
    <S.StoryRoot testId="gallery-root">

      {/* ── Content area: everything above footer, clipped to fit ── */}
      <Box testId="gallery-content" style={{ flexGrow: 1, overflow: 'hidden' }}>

      {/* ── Header row 1: Gallery title ── */}
      <S.RowCenterBorder testId="gallery-header1" style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 10, paddingBottom: 10, gap: 14 }}>
        <S.StoryHeaderIcon src="layout-grid" tintColor={C.accent} />
        <S.StoryTitle>{'Components'}</S.StoryTitle>
        <Box style={{ backgroundColor: C.accentDim, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'Gallery'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>{'Composed components, live and interactive'}</S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Header row 2: Component name + package badge ── */}
      <S.RowCenterBorder testId="gallery-header2" style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 8, paddingBottom: 8, gap: 10 }}>
        <S.BoldText style={{ fontSize: 16 }}>{tab.label}</S.BoldText>
        {pkgColor ? (
          <Box style={{ backgroundColor: `${pkgColor}22`, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
            <Text style={{ color: pkgColor, fontSize: 10 }}>{`@reactjit/${tab.pkg}`}</Text>
          </Box>
        ) : (
          <Box style={{ backgroundColor: C.accentDim, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
            <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/core'}</Text>
          </Box>
        )}
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{`${TABS.indexOf(tab) + 1} of ${TABS.length} components`}</S.StoryCap>
      </S.RowCenterBorder>

      {/* ── Info row: description | usage | props ── */}
      <S.BorderBottom testId="gallery-info-row" style={{ height: 120, flexShrink: 0, flexDirection: 'row', backgroundColor: c.bgElevated, overflow: 'hidden' }}>
        <S.Half style={{ padding: 12, gap: 6 }}>
          <S.StoryLabelText>{'DESCRIPTION'}</S.StoryLabelText>
          <S.StoryMuted>{tab.desc}</S.StoryMuted>
        </S.Half>

        <VerticalDivider />

        <S.Half style={{ padding: 12, gap: 6 }}>
          <S.StoryLabelText>{'USAGE'}</S.StoryLabelText>
          <CodeBlock language="tsx" fontSize={9} code={tab.usage} />
        </S.Half>

        <VerticalDivider />

        <S.Half style={{ padding: 12, gap: 6 }}>
          <S.StoryLabelText>{'PROPS'}</S.StoryLabelText>
          <Box style={{ gap: 3 }}>
            {tab.props.map(([name, type]) => (
              <S.RowCenterG5 key={name}>
                <S.StoryBreadcrumbActive>{name}</S.StoryBreadcrumbActive>
                <S.StoryCap>{type}</S.StoryCap>
              </S.RowCenterG5>
            ))}
          </Box>
          {tab.callbacks.length > 0 && (
            <>
              <HorizontalDivider />
              <S.StoryLabelText>{'CALLBACKS'}</S.StoryLabelText>
              <Box style={{ gap: 3 }}>
                {tab.callbacks.map(([name, sig]) => (
                  <S.RowCenterG5 key={name}>
                    <S.StoryBreadcrumbActive>{name}</S.StoryBreadcrumbActive>
                    <S.StoryCap>{sig}</S.StoryCap>
                  </S.RowCenterG5>
                ))}
              </Box>
            </>
          )}
        </S.Half>
      </S.BorderBottom>

      {/* ── Preview area ── */}
      <S.BorderBottom testId="gallery-preview" style={{ flexGrow: 1 }}>
        {tab?.preview(c)}
      </S.BorderBottom>

      {/* ── Divider bar: expand toggle + search ── */}
      <Pressable onPress={() => setTabsExpanded(!tabsExpanded)}>
        <S.RowCenterBorder testId="gallery-divider-bar" style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, borderBottomWidth: 1, paddingLeft: 16, paddingRight: 16, paddingTop: 6, paddingBottom: 6, gap: 10 }}>
          {/* Drag/expand handle */}
          <Box style={{ gap: 2 }}>
            <Box style={{ width: 16, height: 2, backgroundColor: c.muted, borderRadius: 1, opacity: 0.5 }} />
            <Box style={{ width: 16, height: 2, backgroundColor: c.muted, borderRadius: 1, opacity: 0.5 }} />
          </Box>
          <S.DimIcon12 src={tabsExpanded ? 'chevron-down' : 'chevron-up'} />
          <S.StoryCap>
            {`${filteredTabs.length} component${filteredTabs.length !== 1 ? 's' : ''}`}
          </S.StoryCap>

          <Box style={{ flexGrow: 1 }} />

          {/* Search input */}
          <Pressable onPress={(e: any) => { if (e && e.stopPropagation) e.stopPropagation(); }}>
            <S.RowCenterG6 style={{ backgroundColor: c.surface, borderRadius: 4, borderWidth: 1, borderColor: c.border, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, width: 180 }}>
              <S.StorySectionIcon src="search" tintColor={c.muted} />
              <Input
                placeholder="Filter components..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={{
                  flexGrow: 1, color: c.text, fontSize: 9,
                  backgroundColor: 'transparent', padding: 0,
                }}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <S.DimIcon8 src="x" />
                </Pressable>
              )}
            </S.RowCenterG6>
          </Pressable>
        </S.RowCenterBorder>
      </Pressable>

      {/* ── Tab grid — thumbnail previews ── */}
      <ScrollView testId="gallery-tab-grid" style={{
        height: tabGridHeight, flexShrink: 0,
        backgroundColor: c.bgElevated,
      }}>
        <S.RowG6 style={{ flexWrap: 'wrap', justifyContent: 'center', paddingLeft: 8, paddingRight: 8, paddingTop: 8, paddingBottom: 8 }}>
          {filteredTabs.map(comp => {
            const active = comp.id === activeId;
            const compPkgColor = PKG_COLORS[comp.pkg];
            return (
              <Pressable key={comp.id} onPress={() => setActiveId(comp.id)}>
                <Box style={{
                  width: 68, height: 68,
                  backgroundColor: active ? C.selected : c.surface,
                  borderRadius: 6,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? C.accent : c.border,
                  overflow: 'hidden',
                }}>
                  <Box style={{ flexGrow: 1, overflow: 'hidden' }}>
                    {comp.thumb(c)}
                  </Box>
                  <Box style={{
                    flexShrink: 0, height: 14,
                    backgroundColor: active ? C.accentDim : 'rgba(0,0,0,0.3)',
                    justifyContent: 'center', alignItems: 'center',
                    flexDirection: 'row', gap: 3,
                  }}>
                    {compPkgColor && <Box style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: compPkgColor }} />}
                    <Text style={{ color: active ? c.text : c.muted, fontSize: 6 }}>{comp.label}</Text>
                  </Box>
                </Box>
              </Pressable>
            );
          })}
          {filteredTabs.length === 0 && (
            <Box style={{ padding: 20, alignItems: 'center' }}>
              <S.DimBody11>{`No components match "${searchQuery}"`}</S.DimBody11>
            </Box>
          )}
        </S.RowG6>
      </ScrollView>

      </Box>{/* end gallery-content */}

      {/* ── Footer — breadcrumbs + counter ── */}
      <S.RowCenterBorder testId="gallery-footer-toolbar" style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Components'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.DimIcon12 src="layout-grid" />
        <S.StoryCap>{tab.pkg}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.StoryBreadcrumbActive>{tab.label}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{`${TABS.indexOf(tab) + 1} of ${TABS.length} components`}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
