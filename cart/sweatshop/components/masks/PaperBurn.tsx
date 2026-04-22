const React: any = require('react');

import { MaskLayer } from './MaskLayer';

export function PaperBurn(props: any) {
  const { children, ...rest } = props;
  return <MaskLayer mask="paper-burn" {...rest}>{children}</MaskLayer>;
}

export default PaperBurn;

