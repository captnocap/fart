# TODO: Reorganize Story & Doc Ordering for Natural Flow

## Problem

The storybook sidebar and docs sections are organized by technical category (Primitives, Layout, Components, Visual, CSS Features, etc.) which makes sense as a reference but doesn't flow naturally for someone learning the framework or browsing capabilities. The categories feel like an API index, not a guided tour.

## Current story categories (storybook/src/stories/index.ts)

1. Primitives (Box, Text, Image, Video, File Drop, Font Packs)
2. Layout (Auto-Sizing, Flex Row/Column/Wrap, Padding & Margin)
3. Components (Pressable, Slider, Switch, ScrollView)
4. Visual (Gradients, Shadow, Transforms, Opacity, Z-Index, Border Radius)
5. CSS Features (Flex Shrink, Aspect Ratio, Text Decoration, Per-Side Borders)
6. Input (TextEditor, Spell Check)
7. Forms (Checkbox, Radio, Select)
8. Animation (Spring Width, Spring Position)
9. Navigation (NavPanel, Tabs, Breadcrumbs, Toolbar)
10. Data (Table, Bar Chart, Progress Bar, Sparkline)
11. Demo (Settings, Neofetch, Weather, Data Dashboard, App Shell)
12. Stress Test (Overflow Stress, llms.txt Reader)
13. AI (AI Chat, AI Canvas, MCP Server)
14. Networking (Fetch, WebSocket, REST APIs, RSS, Webhooks)
15. Security (Crypto)
16. Dev Tools (Error Test, Block Test)
17. Addon components (from @ilovereact/components)

## Proposed flow

Reorder so it tells a story — what can I build, how do I build it, what advanced tools exist:

### Stories

1. **Getting Started** — Box, Text, Image (the 3 building blocks)
2. **Layout** — Flex Row, Flex Column, Auto-Sizing, Padding & Margin, Flex Wrap, Flex Shrink
3. **Styling** — Gradients, Shadow, Border Radius, Opacity, Transforms, Z-Index, Text Decoration, Per-Side Borders, Aspect Ratio, Font Packs
4. **Interaction** — Pressable, ScrollView, Slider, Switch, Checkbox, Radio, Select
5. **Text & Input** — Text Truncation, TextEditor, Spell Check
6. **Animation** — Spring Width, Spring Position
7. **Navigation** — NavPanel, Tabs, Breadcrumbs, Toolbar
8. **Data Display** — Table, Bar Chart, Progress Bar, Sparkline
9. **Networking** — Fetch, WebSocket, REST APIs, RSS, Webhooks
10. **AI** — AI Chat, AI Canvas, MCP Server
11. **Security** — Crypto
12. **Media** — Video, File Drop
13. **Showcases** — Settings Demo, Weather, Neofetch, Data Dashboard, App Shell
14. **Stress Tests** — Overflow Stress, llms.txt Reader
15. **Dev Tools** — Error Test, Block Test

### Docs

Same reordering principle — the docs viewer (`storybook/src/docs/`) and generated content (`content/sections/`) should follow the same progression. Lead with "what is this" and "build your first thing", not API reference.

## Notes

- The `stories` array order in `index.ts` directly controls sidebar order
- Categories are just string labels — changing them is a one-line edit per story
- Consider whether some current categories should merge (e.g., "CSS Features" is awkward — those are just styling props, fold into "Styling" or "Layout")
- The addon stories from `@ilovereact/components` appear at the bottom — consider interleaving them into the appropriate categories instead
