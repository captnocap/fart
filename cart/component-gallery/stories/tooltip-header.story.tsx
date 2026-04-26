import { defineGallerySection, defineGalleryStory } from '../types';
import { TooltipHeader } from '../components/tooltip-header/TooltipHeader';

export const tooltipHeaderSection = defineGallerySection({
  id: "tooltip-header",
  title: "Tooltip Header",
  group: {
    id: "controls",
    title: "Controls & Cards",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "tooltip-header/default",
      title: "Tooltip Header",
      source: "cart/component-gallery/components/tooltip-header/TooltipHeader.tsx",
      status: 'ready',
      summary: 'Tooltip header atom for title, supporting detail, and optional shortcut chip.',
      tags: ["header", "badge", "card"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <TooltipHeader shortcut="Cmd K" />,
        },
      ],
    }),
  ],
});
