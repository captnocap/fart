import { TooltipFrame } from '../tooltip-frame/TooltipFrame';
import { TooltipHeader } from '../tooltip-header/TooltipHeader';

export type BasicTooltipProps = {
  title?: string;
  detail?: string;
  shortcut?: string;
};

export function BasicTooltip({
  title = 'Open command palette',
  detail = 'Quick access to actions and files.',
  shortcut = 'Cmd K',
}: BasicTooltipProps) {
  return (
    <TooltipFrame width={236}>
      <TooltipHeader title={title} detail={detail} shortcut={shortcut} />
    </TooltipFrame>
  );
}
