const React: any = require('react');

import { MaskLayer } from './MaskLayer';

export function DuotoneMap(props: any) {
  const { children, ...rest } = props;
  return <MaskLayer mask="duotone-map" {...rest}>{children}</MaskLayer>;
}

export default DuotoneMap;

