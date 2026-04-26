import { defineGallerySection, defineGalleryStory } from '../types';
import { RichTooltip } from '../components/rich-tooltip/RichTooltip';

export const richTooltipSection = defineGallerySection({
  id: "rich-tooltip",
  title: "Rich Tooltip",
  group: {
    id: "compositions",
    title: "Compositions",
  },
  kind: "top-level",
  composedOf: [
    "cart/component-gallery/components/tooltip-frame/TooltipFrame.tsx",
    "cart/component-gallery/components/tooltip-header/TooltipHeader.tsx",
    "cart/component-gallery/components/tooltip-data-row/TooltipDataRow.tsx",
  ],
  stories: [
    defineGalleryStory({
      id: "rich-tooltip/default",
      title: "Rich Tooltip",
      source: "cart/component-gallery/components/rich-tooltip/RichTooltip.tsx",
      status: 'ready',
      summary: 'Metric tooltip composition built from frame, header, and data-row atoms.',
      tags: ["panel", "data"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <RichTooltip />,
        },
      ],
    }),
  ],
});
