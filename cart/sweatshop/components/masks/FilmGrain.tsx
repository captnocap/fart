const React: any = require('react');

import { MaskLayer } from './MaskLayer';

export function FilmGrain(props: any) {
  const { children, ...rest } = props;
  return <MaskLayer mask="film-grain" {...rest}>{children}</MaskLayer>;
}

export default FilmGrain;

