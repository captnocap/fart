import { Box, Text } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

/**
 * Auto-Sizing Basic Test
 *
 * Tests that containers auto-size to fit their content without explicit dimensions.
 * This was the original problem: without explicit width/height, text would overlap at (0,0).
 */
export function AutoSizeBasic() {
  const c = useThemeColors();
  return (
    <Box
      width="100%"
      height="100%"
      backgroundColor={c.bg}
      padding={20}
    >
      <Text style={{ fontSize: 24, color: c.text, marginBottom: 10 }}>
        Auto-Sizing Test
      </Text>

      {/* Test 1: Basic auto-sized column (no width/height specified) */}
      <Box backgroundColor={c.bgElevated} padding={10} style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 16, color: '#00ff00' }}>
          Test 1: Auto-sized column container
        </Text>
        <Text style={{ fontSize: 14, color: c.textSecondary }}>
          This Box has no explicit width or height.
        </Text>
        <Text style={{ fontSize: 14, color: c.textSecondary }}>
          It should auto-size to fit these three text lines.
        </Text>
      </Box>

      {/* Test 2: Auto-sized row */}
      <Box
        flexDirection="row"
        backgroundColor={c.bgElevated}
        padding={10}
        gap={10}
        style={{ marginBottom: 20 }}
      >
        <Text style={{ fontSize: 14, color: '#ff00ff' }}>
          Left
        </Text>
        <Text style={{ fontSize: 14, color: '#00ffff' }}>
          Center
        </Text>
        <Text style={{ fontSize: 14, color: '#ffff00' }}>
          Right
        </Text>
      </Box>

      {/* Test 3: Nested auto-sizing */}
      <Box backgroundColor={c.bgElevated} padding={10} style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 16, color: c.text, marginBottom: 5 }}>
          Test 3: Nested containers
        </Text>
        <Box backgroundColor={c.surface} padding={8}>
          <Text style={{ fontSize: 14, color: c.textSecondary }}>
            Inner Box also auto-sizes
          </Text>
          <Text style={{ fontSize: 12, color: c.textDim }}>
            No dimensions needed anywhere
          </Text>
        </Box>
      </Box>

      {/* Test 4: Mixed explicit and auto-sizing */}
      <Box backgroundColor={c.bgElevated} padding={10}>
        <Text style={{ fontSize: 16, color: c.text, marginBottom: 5 }}>
          Test 4: Mixed sizing
        </Text>
        <Box width={200} backgroundColor={c.surface} padding={8} style={{ marginBottom: 5 }}>
          <Text style={{ fontSize: 14, color: c.textSecondary }}>
            This Box has explicit width (200px)
          </Text>
        </Box>
        <Box backgroundColor={c.surface} padding={8}>
          <Text style={{ fontSize: 14, color: c.textSecondary }}>
            This Box has no explicit size
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
