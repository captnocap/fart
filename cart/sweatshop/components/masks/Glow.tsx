const React: any = require('react');

import { MaskLayer } from './MaskLayer';

export function Glow(props: any) {
  const { children, ...rest } = props;
  return <MaskLayer mask="glow" {...rest}>{children}</MaskLayer>;
}

export default Glow;

