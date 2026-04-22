const React: any = require('react');

import { MaskLayer } from './MaskLayer';

export function ChromaticAberration(props: any) {
  const { children, ...rest } = props;
  return <MaskLayer mask="chromatic-aberration" {...rest}>{children}</MaskLayer>;
}

export default ChromaticAberration;

