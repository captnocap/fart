const React: any = require('react');

import { MaskLayer } from './MaskLayer';

export function Pixelate(props: any) {
  const { children, ...rest } = props;
  return <MaskLayer mask="pixelate" {...rest}>{children}</MaskLayer>;
}

export default Pixelate;

