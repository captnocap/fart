const React: any = require('react');

import { MaskLayer } from './MaskLayer';

export function Kaleidoscope(props: any) {
  const { children, ...rest } = props;
  return <MaskLayer mask="kaleidoscope" {...rest}>{children}</MaskLayer>;
}

export default Kaleidoscope;

