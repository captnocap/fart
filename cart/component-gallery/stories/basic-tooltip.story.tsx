import { defineGallerySection, defineGalleryStory } from '../types';
import { BasicTooltip } from '../components/basic-tooltip/BasicTooltip';

export const basicTooltipSection = defineGallerySection({
  id: "basic-tooltip",
  title: "Basic Tooltip",
  group: {
    id: "compositions",
    title: "Compositions",
  },
  kind: "top-level",
  composedOf: [
    "cart/component-gallery/components/tooltip-frame/TooltipFrame.tsx",
    "cart/component-gallery/components/tooltip-header/TooltipHeader.tsx",
  ],
  stories: [
    defineGalleryStory({
      id: "basic-tooltip/default",
      title: "Basic Tooltip",
      source: "cart/component-gallery/components/basic-tooltip/BasicTooltip.tsx",
      status: 'ready',
      summary: 'Minimal tooltip composed from the shared tooltip frame and header atoms.',
      tags: ["panel"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <BasicTooltip />,
        },
      ],
    }),
  ],
});
