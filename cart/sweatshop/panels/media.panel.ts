const React: any = require('react');

import { Box, Col, Text } from '../../../runtime/primitives';
import { register } from '../panel-registry';

function MediaPanel() {
  return React.createElement(
    Col,
    { style: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1018' } },
    React.createElement(
      Box,
      { style: { padding: 18, borderRadius: 14, borderWidth: 1, borderColor: '#1f2630', backgroundColor: '#111826', gap: 6 } },
      React.createElement(Text, { fontSize: 13, color: '#e6edf3', style: { fontWeight: 'bold' } }, 'Media'),
      React.createElement(Text, { fontSize: 10, color: '#8b98a6' }, 'Preview surface placeholder.'),
    ),
  );
}

register({
  id: 'media',
  title: 'Media',
  defaultSlot: 'right',
  icon: 'panel-bottom',
  component: MediaPanel,
  userVisible: true,
  defaultOpen: false,
});
