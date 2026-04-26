import { defineGallerySection, defineGalleryStory } from '../types';
import { TooltipFrame } from '../components/tooltip-frame/TooltipFrame';

export const tooltipFrameSection = defineGallerySection({
  id: "tooltip-frame",
  title: "Tooltip Frame",
  group: {
    id: "controls",
    title: "Controls & Cards",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "tooltip-frame/default",
      title: "Tooltip Frame",
      source: "cart/component-gallery/components/tooltip-frame/TooltipFrame.tsx",
      status: 'ready',
      summary: 'Tooltip surface atom composed with existing surface, stack, and text classifiers.',
      tags: ["card", "panel"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <TooltipFrame />,
        },
        {
          id: 'accent',
          name: 'Accent',
          render: () => <TooltipFrame emphasis="accent" />,
        },
      ],
    }),
  ],
});
