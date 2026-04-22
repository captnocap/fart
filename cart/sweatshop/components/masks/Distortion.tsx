const React: any = require('react');

import { MaskLayer } from './MaskLayer';

export function Distortion(props: any) {
  const { children, ...rest } = props;
  return <MaskLayer mask="distortion" {...rest}>{children}</MaskLayer>;
}

export default Distortion;

