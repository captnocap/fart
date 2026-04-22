import { Scene3DPlaygroundPanel } from '../components/scene3d/Scene3DPlaygroundPanel';
import { register } from '../panel-registry';

register({
  id: 'scene3d',
  title: '3D',
  defaultSlot: 'center',
  icon: 'palette',
  component: Scene3DPlaygroundPanel,
  userVisible: true,
  defaultOpen: false,
});
