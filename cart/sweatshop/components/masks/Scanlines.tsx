const React: any = require('react');

import { MaskLayer } from './MaskLayer';

export function Scanlines(props: any) {
  const { children, ...rest } = props;
  return <MaskLayer mask="scanlines" {...rest}>{children}</MaskLayer>;
}

export default Scanlines;

