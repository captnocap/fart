import { classifiers as S } from '@reactjit/core';
import { TooltipDataRow } from '../tooltip-data-row/TooltipDataRow';
import { TooltipFrame } from '../tooltip-frame/TooltipFrame';
import { TooltipHeader } from '../tooltip-header/TooltipHeader';

export type RichTooltipRow = {
  label: string;
  value: string;
  color?: string;
};

export type RichTooltipProps = {
  title?: string;
  detail?: string;
  rows?: RichTooltipRow[];
};

const DEFAULT_ROWS: RichTooltipRow[] = [
  { label: 'P50', value: '42 ms', color: 'theme:ok' },
  { label: 'P95', value: '118 ms', color: 'theme:warn' },
  { label: 'Errors', value: '0.4%', color: 'theme:flag' },
];

export function RichTooltip({
  title = 'Render pipeline',
  detail = 'Frame budget snapshot',
  rows = DEFAULT_ROWS,
}: RichTooltipProps) {
  return (
    <TooltipFrame width={248} emphasis="accent">
      <TooltipHeader title={title} detail={detail} />
      <S.Divider />
      <S.StackX3>
        {rows.map((row) => (
          <TooltipDataRow key={row.label} label={row.label} value={row.value} color={row.color} />
        ))}
      </S.StackX3>
    </TooltipFrame>
  );
}
