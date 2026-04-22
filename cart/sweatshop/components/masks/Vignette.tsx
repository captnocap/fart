const React: any = require('react');

import { MaskLayer } from './MaskLayer';

export function Vignette(props: any) {
  const { children, ...rest } = props;
  return <MaskLayer mask="vignette" {...rest}>{children}</MaskLayer>;
}

export default Vignette;

