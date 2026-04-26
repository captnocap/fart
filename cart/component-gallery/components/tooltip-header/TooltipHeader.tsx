import { classifiers as S } from '@reactjit/core';

export type TooltipHeaderProps = {
  title?: string;
  detail?: string;
  shortcut?: string;
};

export function TooltipHeader({
  title = 'Tooltip header',
  detail = 'Contextual helper text',
  shortcut,
}: TooltipHeaderProps) {
  return (
    <S.InlineX5Between>
      <S.StackX1 style={{ flexShrink: 1 }}>
        <S.TypeBodyBold>{title}</S.TypeBodyBold>
        {detail ? <S.TypeCaption style={{ color: 'theme:inkDim' }}>{detail}</S.TypeCaption> : null}
      </S.StackX1>
      {shortcut ? (
        <S.ChipRound style={{ borderColor: 'theme:ruleBright', backgroundColor: 'theme:bg1' }}>
          <S.TypeTinyBold style={{ color: 'theme:accent' }}>{shortcut}</S.TypeTinyBold>
        </S.ChipRound>
      ) : null}
    </S.InlineX5Between>
  );
}
