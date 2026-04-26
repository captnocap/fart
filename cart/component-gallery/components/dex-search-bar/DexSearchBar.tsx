import { Row, Text, TextInput } from '../../../../runtime/primitives';
import { DEX_COLORS } from '../dex-frame/DexFrame';

export type DexSearchBarProps = {
  value?: string;
  placeholder?: string;
  count?: string;
  onChange?: (value: string) => void;
};

export function DexSearchBar({
  value = '',
  placeholder = 'filter keys / values',
  count = '',
  onChange,
}: DexSearchBarProps) {
  return (
    <Row
      style={{
        height: 30,
        alignItems: 'center',
        gap: 8,
        paddingLeft: 8,
        paddingRight: 8,
        borderBottomWidth: 1,
        borderColor: DEX_COLORS.rule,
        backgroundColor: DEX_COLORS.bg,
      }}
    >
      <Text style={{ color: DEX_COLORS.accent, fontSize: 12 }}>⌕</Text>
      <TextInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          flex: 1,
          height: 22,
          backgroundColor: DEX_COLORS.bg1,
          borderWidth: 1,
          borderColor: DEX_COLORS.rule,
          color: DEX_COLORS.ink,
          fontSize: 11,
          paddingLeft: 8,
          paddingRight: 8,
        }}
      />
      <Text style={{ minWidth: 54, textAlign: 'right', color: DEX_COLORS.inkDimmer, fontSize: 10 }}>{count}</Text>
      <Text style={{ color: DEX_COLORS.inkDimmer, fontSize: 10 }}>/</Text>
    </Row>
  );
}
