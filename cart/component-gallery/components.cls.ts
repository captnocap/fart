/**
 * Component-gallery classifier sheet.
 *
 * Single-primitive classifiers bound to cockpit theme tokens. Components
 * consume `<S.Foo>`; raw `<Box style={...}>` is forbidden in this cart
 * (gate enforces).
 *
 * Token namespace (set by cart/component-gallery/gallery-theme.ts → runtime):
 *
 *   Colors (strings):
 *     bg / bg1 / bg2                  surfaces
 *     paper / paperAlt / paperInk
 *     paperInkDim / paperRule
 *     paperRuleBright                 paper content tier
 *     ink / inkDim / inkDimmer        text
 *     inkGhost
 *     rule / ruleBright               borders
 *     accent / accentHot              accent
 *     ok / warn / flag                state signals
 *     lilac / blue                    auxiliary
 *     sys / ctx / usr / ast / atch    data channels
 *     tool / wnd / pin
 *     gridDot / gridDotStrong         decorative
 *     fontMono / fontSans             font families (string)
 *
 *   Numbers (style palette):
 *     typeMicro(7) typeTiny(8) typeCaption(9) typeBody(10)
 *     typeBase(11) typeMeta(12) typeStrong(14) typeHeading(18)
 *     radiusSm(4) radiusMd(6) radiusLg(8) radiusXl(10) radiusPill(99) radiusRound(999)
 *     spaceX0(1) spaceX1(2) spaceX2(4) spaceX3(6) spaceX4(8) spaceX5(10)
 *     spaceX6(12) spaceX7(16) spaceX8(18)
 *     chromeTopbar(28) chromeStatusbar(22) chromeTileHead(20) chromeStrip(28)
 *     lineHeight(1.35)
 *
 * Authoring rules (load-bearing):
 *   • One classifier = one primitive. No children logic, no slots.
 *   • Compose by stacking <S.Foo><S.Bar/></S.Foo> in JSX.
 *   • All colors via 'theme:NAME'. No hex literals here.
 *   • Numeric style values via 'theme:NAME' where the token exists.
 *   • Existing structural names (TypeMicro, InlineX*, StackX*, BareGraph,
 *     Spacer, HalfPress, DotSm, DotMd, RoundPill, ChipRound) are preserved
 *     by name — many components already consume them. Their values were
 *     token-ified in place.
 */

import { classifier } from '@reactjit/core';

classifier({

  // ══════════════════════════════════════════════════════════════
  //   Page shell + chrome
  // ══════════════════════════════════════════════════════════════

  // Full-viewport container.
  Page: { type: 'Box', style: {
    width: '100%', height: '100%',
    backgroundColor: 'theme:bg',
  }},

  // Pinned top: icon + title + badge + spacer + subtitle.
  StoryHeader: { type: 'Box', style: { flexDirection: 'row',
    flexShrink: 0,
    backgroundColor: 'theme:bg1',
    borderBottomWidth: 1,
    borderColor: 'theme:rule',
    paddingLeft: 'theme:spaceX8', paddingRight: 'theme:spaceX8',
    paddingTop: 'theme:spaceX6', paddingBottom: 'theme:spaceX6',
    gap: 'theme:spaceX7',
  }},

  // Pinned bottom: breadcrumb path.
  StoryFooter: { type: 'Box', style: { flexDirection: 'row',
    flexShrink: 0,
    backgroundColor: 'theme:bg1',
    borderTopWidth: 1,
    borderColor: 'theme:rule',
    paddingLeft: 'theme:spaceX8', paddingRight: 'theme:spaceX8',
    paddingTop: 'theme:spaceX3', paddingBottom: 'theme:spaceX3',
    gap: 'theme:spaceX6',
  }},

  // ══════════════════════════════════════════════════════════════
  //   Bands (story content rows)
  // ══════════════════════════════════════════════════════════════

  // Accent left-border, full-width hero intro.
  Hero: { type: 'Box', style: {
    borderLeftWidth: 3,
    borderColor: 'theme:accent',
    paddingLeft: 'theme:spaceX8', paddingRight: 'theme:spaceX8',
    paddingTop: 'theme:spaceX7', paddingBottom: 'theme:spaceX7',
    gap: 'theme:spaceX4',
  }},

  // Two-column band (zigzag layout row).
  Band: { type: 'Box', style: { flexDirection: 'row',
    paddingLeft: 'theme:spaceX8', paddingRight: 'theme:spaceX8',
    paddingTop: 'theme:spaceX7', paddingBottom: 'theme:spaceX7',
    gap: 'theme:spaceX7',
  }},

  // One side of a Band (50/50 split).
  Half: { type: 'Box', style: {
    flexGrow: 1, flexBasis: 0,
    gap: 'theme:spaceX4',
  }},

  HalfCenter: { type: 'Box', style: {
    flexGrow: 1, flexBasis: 0,
    gap: 'theme:spaceX4',
    alignItems: 'center', justifyContent: 'center',
  }},

  // Full-width band (no split).
  FullBand: { type: 'Box', style: {
    paddingLeft: 'theme:spaceX8', paddingRight: 'theme:spaceX8',
    paddingTop: 'theme:spaceX7', paddingBottom: 'theme:spaceX7',
    gap: 'theme:spaceX4',
  }},

  // Highlighted insight strip.
  Callout: { type: 'Box', style: { flexDirection: 'row',
    backgroundColor: 'theme:bg1',
    borderLeftWidth: 3,
    borderColor: 'theme:blue',
    paddingLeft: 'theme:spaceX8', paddingRight: 'theme:spaceX8',
    paddingTop: 'theme:spaceX6', paddingBottom: 'theme:spaceX6',
    gap: 'theme:spaceX4',
    alignItems: 'center',
  }},

  // Warning band.
  Warn: { type: 'Box', style: { flexDirection: 'row',
    backgroundColor: 'theme:bg1',
    borderLeftWidth: 3,
    borderColor: 'theme:warn',
    paddingLeft: 'theme:spaceX8', paddingRight: 'theme:spaceX8',
    paddingTop: 'theme:spaceX6', paddingBottom: 'theme:spaceX6',
    gap: 'theme:spaceX4',
    alignItems: 'center',
  }},

  // Horizontal divider.
  Divider: { type: 'Box', style: {
    height: 1, flexShrink: 0,
    backgroundColor: 'theme:rule',
  }},

  // Vertical divider.
  VertDivider: { type: 'Box', style: {
    width: 1, flexShrink: 0,
    backgroundColor: 'theme:rule',
  }},

  // ══════════════════════════════════════════════════════════════
  //   Surfaces (cards, wells, etc.)
  // ══════════════════════════════════════════════════════════════

  // Padded card surface w/ radius+gap. Compose with CardHeader/CardBody.
  Card: { type: 'Box', style: {
    flexDirection: 'column',
    padding: 'theme:spaceX7',
    backgroundColor: 'theme:bg1',
    borderRadius: 'theme:radiusLg',
    gap: 'theme:spaceX4',
  }},

  // Card header row: title + spacer + badge.
  CardHeader: { type: 'Box', style: { flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    gap: 'theme:spaceX4',
  }},

  // Card body column.
  CardBody: { type: 'Box', style: {
    gap: 'theme:spaceX3',
  }},

  // Recessed surface (paper-style).
  Surface: { type: 'Box', style: {
    padding: 'theme:spaceX6',
    backgroundColor: 'theme:bg2',
    borderRadius: 'theme:radiusMd',
  }},

  // Alternate-tier surface (paperAlt-style).
  SurfaceAlt: { type: 'Box', style: {
    padding: 'theme:spaceX6',
    backgroundColor: 'theme:bg1',
    borderRadius: 'theme:radiusMd',
  }},

  // Elevated demo well — for interactive previews.
  Well: { type: 'Box', style: {
    padding: 'theme:spaceX7',
    backgroundColor: 'theme:bg1',
    borderRadius: 'theme:radiusLg',
    gap: 'theme:spaceX5',
  }},

  // Recessed input area for displaying values.
  InputWell: { type: 'Box', style: {
    backgroundColor: 'theme:bg2',
    borderRadius: 'theme:radiusSm',
    padding: 'theme:spaceX3',
  }},

  // ══════════════════════════════════════════════════════════════
  //   Sections + section labels
  // ══════════════════════════════════════════════════════════════

  Section: { type: 'Box', style: {
    gap: 'theme:spaceX6',
  }},

  SectionBody: { type: 'Box', style: {
    gap: 'theme:spaceX4',
  }},

  SectionLabel: { type: 'Box', style: { flexDirection: 'row',
    alignItems: 'center',
    gap: 'theme:spaceX3',
  }},

  KV: { type: 'Box', style: { flexDirection: 'row',
    gap: 'theme:spaceX3',
    alignItems: 'flex-start',
  }},

  // ══════════════════════════════════════════════════════════════
  //   Buttons (Pressable)
  // ══════════════════════════════════════════════════════════════

  Button: { type: 'Pressable', style: {
    paddingLeft: 'theme:spaceX7', paddingRight: 'theme:spaceX7',
    paddingTop: 'theme:spaceX4', paddingBottom: 'theme:spaceX4',
    borderRadius: 'theme:radiusMd',
    backgroundColor: 'theme:accent',
  }},

  ButtonOutline: { type: 'Pressable', style: {
    paddingLeft: 'theme:spaceX7', paddingRight: 'theme:spaceX7',
    paddingTop: 'theme:spaceX4', paddingBottom: 'theme:spaceX4',
    borderRadius: 'theme:radiusMd',
    borderWidth: 1, borderColor: 'theme:rule',
  }},

  // ══════════════════════════════════════════════════════════════
  //   Badges
  // ══════════════════════════════════════════════════════════════

  BadgeNeutral: { type: 'Box', style: {
    paddingLeft: 'theme:spaceX3', paddingRight: 'theme:spaceX3',
    paddingTop: 'theme:spaceX1', paddingBottom: 'theme:spaceX1',
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:bg2',
  }},

  BadgeAccent: { type: 'Box', style: {
    paddingLeft: 'theme:spaceX3', paddingRight: 'theme:spaceX3',
    paddingTop: 'theme:spaceX1', paddingBottom: 'theme:spaceX1',
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:accent',
  }},

  BadgeSuccess: { type: 'Box', style: {
    paddingLeft: 'theme:spaceX3', paddingRight: 'theme:spaceX3',
    paddingTop: 'theme:spaceX1', paddingBottom: 'theme:spaceX1',
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:ok',
  }},

  BadgeError: { type: 'Box', style: {
    paddingLeft: 'theme:spaceX3', paddingRight: 'theme:spaceX3',
    paddingTop: 'theme:spaceX1', paddingBottom: 'theme:spaceX1',
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:flag',
  }},

  BadgeWarning: { type: 'Box', style: {
    paddingLeft: 'theme:spaceX3', paddingRight: 'theme:spaceX3',
    paddingTop: 'theme:spaceX1', paddingBottom: 'theme:spaceX1',
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:warn',
  }},

  BadgeInfo: { type: 'Box', style: {
    paddingLeft: 'theme:spaceX3', paddingRight: 'theme:spaceX3',
    paddingTop: 'theme:spaceX1', paddingBottom: 'theme:spaceX1',
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:blue',
  }},

  // ══════════════════════════════════════════════════════════════
  //   Pills + chips + dots
  // ══════════════════════════════════════════════════════════════

  Chip: { type: 'Box', style: {
    backgroundColor: 'theme:bg2',
    borderRadius: 'theme:radiusSm',
    paddingLeft: 'theme:spaceX3', paddingRight: 'theme:spaceX3',
    paddingTop: 'theme:spaceX1', paddingBottom: 'theme:spaceX1',
  }},

  NavPill: { type: 'Pressable', style: {
    paddingLeft: 'theme:spaceX4', paddingRight: 'theme:spaceX4',
    paddingTop: 'theme:spaceX2', paddingBottom: 'theme:spaceX2',
    borderRadius: 'theme:radiusSm',
  }},

  NavPillActive: { type: 'Pressable', style: {
    paddingLeft: 'theme:spaceX4', paddingRight: 'theme:spaceX4',
    paddingTop: 'theme:spaceX2', paddingBottom: 'theme:spaceX2',
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:bg2',
  }},

  Dot: { type: 'Box', style: {
    width: 'theme:spaceX3', height: 'theme:spaceX3',
    borderRadius: 'theme:radiusSm',
    flexShrink: 0,
  }},

  // Progress track.
  Track: { type: 'Box', style: {
    width: '100%', height: 'theme:spaceX2',
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:bg2',
  }},

  // Progress fill.
  Fill: { type: 'Box', style: {
    height: 'theme:spaceX2',
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:accent',
  }},

  // ══════════════════════════════════════════════════════════════
  //   Typography roles
  // ══════════════════════════════════════════════════════════════

  Title:        { type: 'Text', size: 'theme:typeHeading', bold: true, color: 'theme:ink' },
  Headline:     { type: 'Text', size: 'theme:typeStrong',  bold: true, color: 'theme:ink' },
  Heading:      { type: 'Text', size: 'theme:typeStrong',  bold: true, color: 'theme:ink' },
  Subheading:   { type: 'Text', size: 'theme:typeBase',    bold: true, color: 'theme:ink' },
  Body:         { type: 'Text', size: 'theme:typeBody',    color: 'theme:ink' },
  BodyDim:      { type: 'Text', size: 'theme:typeBody',    color: 'theme:inkDim' },
  Muted:        { type: 'Text', size: 'theme:typeBody',    color: 'theme:inkDim' },
  Caption:      { type: 'Text', size: 'theme:typeCaption', color: 'theme:inkDim' },
  TinyDim:      { type: 'Text', size: 'theme:typeTiny',    color: 'theme:inkDim' },
  MicroDim:     { type: 'Text', size: 'theme:typeMicro',   color: 'theme:inkDim' },
  Label:        { type: 'Text', size: 'theme:typeTiny',    bold: true, color: 'theme:inkDim',
                  style: { letterSpacing: 'theme:lsWide' } },
  Code:         { type: 'Text', size: 'theme:typeCaption', color: 'theme:accent',
                  style: { fontFamily: 'theme:fontMono' } },
  Error:        { type: 'Text', size: 'theme:typeBody',    color: 'theme:flag' },

  // Button-shaped texts.
  ButtonLabel:        { type: 'Text', size: 'theme:typeBody', bold: true, color: 'theme:bg' },
  ButtonOutlineLabel: { type: 'Text', size: 'theme:typeBody', color: 'theme:ink' },

  // Badge texts.
  BadgeNeutralText: { type: 'Text', size: 'theme:typeCaption', color: 'theme:inkDim' },
  BadgeAccentText:  { type: 'Text', size: 'theme:typeCaption', color: 'theme:bg' },
  BadgeSuccessText: { type: 'Text', size: 'theme:typeCaption', color: 'theme:bg' },
  BadgeErrorText:   { type: 'Text', size: 'theme:typeCaption', color: 'theme:bg' },
  BadgeWarningText: { type: 'Text', size: 'theme:typeCaption', color: 'theme:bg' },
  BadgeInfoText:    { type: 'Text', size: 'theme:typeCaption', color: 'theme:bg' },

  // Footer breadcrumb.
  Breadcrumb:       { type: 'Text', size: 'theme:typeCaption', color: 'theme:inkDim' },
  BreadcrumbActive: { type: 'Text', size: 'theme:typeCaption', color: 'theme:ink' },

  // ══════════════════════════════════════════════════════════════
  //   Icons (Image roles)
  // ══════════════════════════════════════════════════════════════

  HeaderIcon:    { type: 'Image', style: { width: 18, height: 18 } },
  SectionIcon:   { type: 'Image', style: { width: 'theme:spaceX5', height: 'theme:spaceX5' } },
  InfoIcon:      { type: 'Image', style: { width: 'theme:spaceX6', height: 'theme:spaceX6' } },
  FooterIcon:    { type: 'Image', style: { width: 'theme:spaceX6', height: 'theme:spaceX6' },
                   tintColor: 'theme:inkDim' },
  Icon8:         { type: 'Image', style: { width: 'theme:spaceX4', height: 'theme:spaceX4' } },
  Icon10:        { type: 'Image', style: { width: 'theme:spaceX5', height: 'theme:spaceX5' } },
  Icon12:        { type: 'Image', style: { width: 'theme:spaceX6', height: 'theme:spaceX6' } },
  Icon20:        { type: 'Image', style: { width: 20, height: 20 } },
  DimIcon8:      { type: 'Image', style: { width: 'theme:spaceX4', height: 'theme:spaceX4' },
                   tintColor: 'theme:inkDim' },
  DimIcon12:     { type: 'Image', style: { width: 'theme:spaceX6', height: 'theme:spaceX6' },
                   tintColor: 'theme:inkDim' },
  TextIcon12:    { type: 'Image', style: { width: 'theme:spaceX6', height: 'theme:spaceX6' },
                   tintColor: 'theme:ink' },
  AccentIcon20:  { type: 'Image', style: { width: 20, height: 20 },
                   tintColor: 'theme:accent' },

  // ══════════════════════════════════════════════════════════════
  //   Existing entries — token-ified, names preserved.
  //   These are consumed by ~50 component files already; renaming
  //   would break them. Values now resolve from cockpit theme.
  // ══════════════════════════════════════════════════════════════

  // ── Type ladder (matches theme.type.*) ─────────────────────
  TypeMicro:     { type: 'Text', size: 'theme:typeMicro',   style: { fontFamily: 'theme:fontMono' } },
  TypeMicroBold: { type: 'Text', size: 'theme:typeMicro',   bold: true, style: { fontFamily: 'theme:fontMono' } },
  TypeTiny:      { type: 'Text', size: 'theme:typeTiny',    style: { fontFamily: 'theme:fontMono' } },
  TypeTinyBold:  { type: 'Text', size: 'theme:typeTiny',    bold: true, style: { fontFamily: 'theme:fontMono' } },
  TypeCaption:   { type: 'Text', size: 'theme:typeCaption', style: { fontFamily: 'theme:fontMono' } },
  TypeBody:      { type: 'Text', size: 'theme:typeBody',    style: { fontFamily: 'theme:fontMono' } },
  TypeBodyBold:  { type: 'Text', size: 'theme:typeBody',    bold: true, style: { fontFamily: 'theme:fontMono' } },
  TypeBase:      { type: 'Text', size: 'theme:typeBase',    style: { fontFamily: 'theme:fontMono' } },

  // ── Inline (Row) rhythm (matches theme.spacing x*) ─────────
  InlineX2:           { type: 'Box', style: { flexDirection: 'row', alignItems: 'center', gap: 'theme:spaceX2' } },
  InlineX3:           { type: 'Box', style: { flexDirection: 'row', alignItems: 'center', gap: 'theme:spaceX3' } },
  InlineX4:           { type: 'Box', style: { flexDirection: 'row', gap: 'theme:spaceX4', alignItems: 'stretch' } },
  InlineX4Center:     { type: 'Box', style: { flexDirection: 'row', alignItems: 'center', gap: 'theme:spaceX4' } },
  InlineX5:           { type: 'Box', style: { flexDirection: 'row', gap: 'theme:spaceX5', alignItems: 'center' } },
  InlineX5Between:    { type: 'Box', style: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 'theme:spaceX5' } },
  InlineX4BetweenFull:{ type: 'Box', style: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', gap: 'theme:spaceX4' } },

  // ── Stack (Col) rhythm (matches theme.spacing x*) ──────────
  StackX1:        { type: 'Box', style: { gap: 'theme:spaceX1' } },
  StackX1Center:  { type: 'Box', style: { alignItems: 'center', gap: 'theme:spaceX1' } },
  StackX2:        { type: 'Box', style: { gap: 'theme:spaceX2' } },
  StackX3:        { type: 'Box', style: { gap: 'theme:spaceX3' } },
  StackX4:        { type: 'Box', style: { gap: 'theme:spaceX4' } },
  StackX4Center:  { type: 'Box', style: { alignItems: 'center', gap: 'theme:spaceX4' } },
  StackX5:        { type: 'Box', style: { gap: 'theme:spaceX5' } },
  StackX5Center:  { type: 'Box', style: { gap: 'theme:spaceX5', alignItems: 'center' } },
  StackX6:        { type: 'Box', style: { gap: 'theme:spaceX6' } },

  // ── Radius primitives (matches theme.radius.*) ─────────────
  DotSm:     { type: 'Box', style: { width: 'theme:spaceX4', height: 'theme:spaceX4', borderRadius: 'theme:radiusSm' } },
  DotMd:     { type: 'Box', style: { width: 'theme:spaceX6', height: 'theme:spaceX6', borderRadius: 'theme:radiusMd', borderWidth: 1 } },
  RoundPill: { type: 'Box', style: { borderRadius: 'theme:radiusLg' } },
  ChipRound: { type: 'Box', style: { paddingLeft: 'theme:spaceX4', paddingRight: 'theme:spaceX4', paddingTop: 'theme:spaceX2', paddingBottom: 'theme:spaceX2', borderRadius: 'theme:radiusMd', borderWidth: 1 } },

  // ── Layout utilities ──────────────────────────────────────
  // Graph with top-left origin, fills parent.
  BareGraph: { type: 'Graph', originTopLeft: true, style: { width: '100%', height: '100%' } },

  Spacer:    { type: 'Box', style: { flexGrow: 1 } },
  HalfPress: { type: 'Pressable', style: { flexGrow: 1, flexBasis: 0 } },
});
