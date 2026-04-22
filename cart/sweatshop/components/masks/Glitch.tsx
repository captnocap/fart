const React: any = require('react');

import { MaskLayer } from './MaskLayer';

export function Glitch(props: any) {
  const { children, ...rest } = props;
  return <MaskLayer mask="glitch" {...rest}>{children}</MaskLayer>;
}

export default Glitch;

