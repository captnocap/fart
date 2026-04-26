import { classifiers as S } from '@reactjit/core';

export type TooltipFrameProps = {
  children?: any;
  width?: number;
  emphasis?: 'neutral' | 'accent';
};

export function TooltipFrame({ children, width = 220, emphasis = 'neutral' }: TooltipFrameProps) {
  return (
    <S.Surface
      style={{
        width,
        gap: 'theme:spaceX4',
        borderWidth: 1,
        borderColor: emphasis === 'accent' ? 'theme:accent' : 'theme:ruleBright',
        shadowColor: 'theme:bg',
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      {children || (
        <S.StackX2>
          <S.TypeBodyBold>Tooltip frame</S.TypeBodyBold>
          <S.TypeCaption style={{ color: 'theme:inkDim' }}>Reusable surface atom</S.TypeCaption>
        </S.StackX2>
      )}
    </S.Surface>
  );
}
