const React: any = require('react');
const { useCallback, useMemo, useState } = React;

import { Box, Col, Pressable, Row, Text } from '../../../runtime/primitives';
import { COLORS } from '../theme';

export type MenuBarAction = {
  kind?: 'item' | 'separator';
  label: string;
  shortcut?: string;
  disabled?: boolean;
  action?: () => void;
};

export type MenuBarSection = {
  label: string;
  items: MenuBarAction[];
};

type MenuBarProps = {
  sections: MenuBarSection[];
};

function menuActionStyle(disabled: boolean) {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: active ? COLORS.blueDeep : 'transparent',
    opacity: disabled ? 0.45 : 1,
  };
}

function menuSeparator() {
  return <Box style={{ height: 1, backgroundColor: COLORS.border, marginLeft: 8, marginRight: 8 }} />;
}

export function MenuBar(props: MenuBarProps) {
  const [openSection, setOpenSection] = useState('');
  const openIndex = useMemo(() => {
    if (!openSection) return -1;
    return props.sections.findIndex((section) => section.label === openSection);
  }, [openSection, props.sections]);

  const closeMenu = useCallback(() => setOpenSection(''), []);

  if (!props.sections || props.sections.length === 0) return null;

  return (
    <Col style={{ position: 'relative', zIndex: 120, overflow: 'visible', backgroundColor: COLORS.panelBg, borderBottomWidth: 1, borderColor: COLORS.border }}>
      <Row style={{ alignItems: 'center', gap: 2, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, minHeight: 28 }}>
        {props.sections.map((section, index) => {
          const open = openSection === section.label;
          return (
            <Pressable
              key={section.label}
              onPress={() => setOpenSection(open ? '' : section.label)}
              style={{
                minWidth: 76,
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 4,
                paddingBottom: 4,
                borderRadius: 8,
                backgroundColor: open ? COLORS.blueDeep : 'transparent',
                borderWidth: 1,
                borderColor: open ? COLORS.blue : 'transparent',
              }}
            >
              <Text fontSize={10} color={open ? COLORS.blue : COLORS.textBright} style={{ fontWeight: 'bold', textAlign: 'center' }}>
                {section.label}
              </Text>
            </Pressable>
          );
        })}
      </Row>

      {openIndex >= 0 ? (
        <Box style={{ position: 'absolute', left: 0, right: 0, top: 28, bottom: 0, zIndex: 999, overflow: 'visible' }}>
          <Pressable onPress={closeMenu} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
          <Col
            style={{
              position: 'absolute',
              left: 8 + openIndex * 82,
              top: 8,
              width: 220,
              paddingTop: 6,
              paddingBottom: 6,
              backgroundColor: COLORS.panelRaised,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 12,
              overflow: 'hidden',
              zIndex: 1000,
            }}
          >
            {props.sections[openIndex].items.map((item, index) => (
              <React.Fragment key={(item.kind || 'item') + ':' + index + ':' + item.label}>
                {item.kind === 'separator' ? (
                  menuSeparator()
                ) : (
                  <Pressable
                    onPress={() => {
                      if (item.disabled) return;
                      if (!item.action) return;
                      closeMenu();
                      item.action();
                    }}
                    style={menuActionStyle(!!item.disabled)}
                  >
                    <Text fontSize={11} color={item.disabled ? COLORS.textDim : COLORS.textBright} style={{ fontWeight: 'bold' }}>
                      {item.label}
                    </Text>
                    {item.shortcut ? <Text fontSize={9} color={COLORS.textDim}>{item.shortcut}</Text> : <Box style={{ width: 1, height: 1 }} />}
                  </Pressable>
                )}
              </React.Fragment>
            ))}
          </Col>
        </Box>
      ) : null}
    </Col>
  );
}
