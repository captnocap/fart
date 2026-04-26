import { defineGallerySection, defineGalleryStory } from '../types';
import { AstQuilt, AstTile } from '../components/ast-quilt/AstQuilt';
import { FileFingerprintWorkbench } from '../components/ast-quilt/FileFingerprintWorkbench';
import { AST_SAMPLE_FILES } from '../components/ast-quilt/sampleContract';

export const astQuiltSection = defineGallerySection({
  id: 'ast-quilt',
  title: 'AST Quilt',
  stories: [
    defineGalleryStory({
      id: 'ast-quilt/default',
      title: 'AST Quilt',
      source: 'cart/component-gallery/components/ast-quilt/AstQuilt.tsx',
      status: 'ready',
      summary: 'Treemap fingerprint tiles driven by real contract arrays or live file-to-tree adapters.',
      tags: ['effect', 'fingerprint', 'treemap', 'runtime'],
      variants: [
        {
          id: 'default',
          name: 'Quilt',
          render: () => <AstQuilt />,
        },
        {
          id: 'single-tile',
          name: 'Single Tile',
          render: () => <AstTile file={{ ...AST_SAMPLE_FILES[17], selected: true, tagColor: '#6aa390' }} tileIndex={17} />,
        },
        {
          id: 'from-file',
          name: 'From File',
          render: () => <FileFingerprintWorkbench initialPath="cart/component-gallery/components/ast-quilt/AstQuilt.tsx" />,
        },
      ],
    }),
  ],
});
