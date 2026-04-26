import { classifiers as S } from '@reactjit/core';

export type TooltipDataRowProps = {
  label?: string;
  value?: string;
  color?: string;
};

export function TooltipDataRow({
  label = 'Latency',
  value = '42 ms',
  color = 'theme:accent',
}: TooltipDataRowProps) {
  return (
    <S.InlineX5Between>
      <S.InlineX3>
        <S.Dot style={{ backgroundColor: color }} />
        <S.TypeCaption style={{ color: 'theme:inkDim' }}>{label}</S.TypeCaption>
      </S.InlineX3>
      <S.TypeCaption style={{ color: 'theme:ink' }}>{value}</S.TypeCaption>
    </S.InlineX5Between>
  );
}
