const React: any = require('react');

import { MaskLayer } from './MaskLayer';

export function Blur(props: any) {
  const { children, ...rest } = props;
  return <MaskLayer mask="blur" {...rest}>{children}</MaskLayer>;
}

export default Blur;

