const React: any = require('react');

import { Box, Row, Text } from '../../../runtime/primitives';
import { COLORS } from '../theme';

export function StatusBar(props: any) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const mediumBand = props.widthBand === 'medium';
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'center', paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, backgroundColor: COLORS.panelAlt, borderTopWidth: 1, borderColor: COLORS.border }}>
      <Row style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Row style={{ gap: 6, alignItems: 'center' }}>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.green }} />
          <Text fontSize={10} color={COLORS.textBright}>{props.gitBranch}</Text>
          {!compactBand ? <Text fontSize={10} color={COLORS.textDim}>{props.gitRemote}</Text> : null}
        </Row>
        <Text fontSize={10} color={COLORS.textDim}>{'dirty ' + props.changedCount}</Text>
        {!mediumBand ? <Text fontSize={10} color={COLORS.textDim}>{'staged ' + props.stagedCount}</Text> : null}
        {!compactBand ? <Text fontSize={10} color={COLORS.textDim}>{'+' + props.branchAhead + ' / -' + props.branchBehind}</Text> : null}
        <Text fontSize={10} color={COLORS.textDim}>{'Ln ' + props.cursorLine}</Text>
        <Text fontSize={10} color={COLORS.textDim}>{'Col ' + props.cursorColumn}</Text>
      </Row>
      <Row style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {!mediumBand ? <Text fontSize={10} color={COLORS.textDim}>{props.fileName === '__landing__' ? props.workDir : props.fileName === '__settings__' ? 'Settings' : props.fileName}</Text> : null}
        <Text fontSize={10} color={COLORS.textDim}>{props.languageMode}</Text>
        <Text fontSize={10} color={COLORS.textDim}>{props.selectedModel}</Text>
        <Text fontSize={10} color={COLORS.textDim}>{props.agentStatusText}</Text>
      </Row>
    </Row>
  );
}
