const React: any = require('react');

import { MaskLayer } from './MaskLayer';

export function Halftone(props: any) {
  const { children, ...rest } = props;
  return <MaskLayer mask="halftone" {...rest}>{children}</MaskLayer>;
}

export default Halftone;
