const React: any = require('react');

import { MaskLayer } from './MaskLayer';

export function RGBShift(props: any) {
  const { children, ...rest } = props;
  return <MaskLayer mask="rgb-shift" {...rest}>{children}</MaskLayer>;
}

export default RGBShift;

