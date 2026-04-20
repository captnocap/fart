const React: any = require('react');

import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../runtime/primitives';
import { COLORS } from '../theme';
import { Glyph, Pill } from './shared';

export function SettingsRow(props: any) {
  const active = props.active === 1;
  return (
    <Pressable
      onPress={() => props.onSelect(props.section.id)}
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active ? props.section.tone : COLORS.border,
        backgroundColor: active ? COLORS.panelHover : COLORS.panelRaised,
        gap: 4,
      }}
    >
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Glyph icon={props.section.icon === 'globe' ? 'globe' : props.section.icon === 'folder' ? 'folder' : props.section.icon === 'bot' ? 'bot' : props.section.icon === 'sparkles' ? 'sparkles' : props.section.icon === 'braces' ? 'braces' : 'palette'} tone={props.section.tone} backgroundColor="transparent" tiny={true} />
        <Text fontSize={12} color={active ? COLORS.textBright : COLORS.text} style={{ fontWeight: 'bold' }}>{props.section.label}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text fontSize={10} color={props.section.tone}>{props.section.count}</Text>
      </Row>
      <Text fontSize={10} color={COLORS.textDim}>{props.section.meta}</Text>
    </Pressable>
  );
}

export function InfoCard(props: any) {
  const item = props.item;
  return (
    <Box style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 6 }}>
      <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{item.name}</Text>
        <Pill label={item.owner || item.backend || item.runtime || item.status} color={item.tone} tiny={true} />
        {item.scope ? <Pill label={item.scope} color={COLORS.blue} tiny={true} /> : null}
        {item.retention ? <Pill label={item.retention} color={COLORS.purple} tiny={true} /> : null}
      </Row>
      {item.source ? <Text fontSize={10} color={COLORS.textDim}>{item.source}</Text> : null}
      {item.summary ? <Text fontSize={11} color={COLORS.text}>{item.summary}</Text> : null}
      {item.stress ? <Text fontSize={10} color={COLORS.orange}>stress: {item.stress}</Text> : null}
      {item.output ? <Text fontSize={10} color={COLORS.blue}>output: {item.output}</Text> : null}
      {item.risk ? <Text fontSize={10} color={COLORS.red}>risk: {item.risk}</Text> : null}
    </Box>
  );
}

export function ProviderCard(props: any) {
  const provider = props.provider;
  const active = props.active === 1;
  return (
    <Pressable
      onPress={() => props.onSelect(provider.id)}
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active ? provider.tone : COLORS.border,
        backgroundColor: active ? COLORS.panelHover : COLORS.panelRaised,
        gap: 8,
      }}
    >
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Pill label={provider.short} color={provider.tone} borderColor={provider.tone} backgroundColor={COLORS.panelBg} tiny={true} />
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{provider.name}</Text>
          <Text fontSize={10} color={COLORS.textDim}>{provider.driver}</Text>
        </Col>
        <Pill label={provider.status} color={provider.tone} borderColor={provider.tone} backgroundColor={COLORS.panelBg} tiny={true} />
      </Row>
      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        <Pill label={provider.route} tiny={true} />
        <Pill label={provider.defaultModel} color={COLORS.blue} tiny={true} />
        <Pill label={provider.env} color={COLORS.green} tiny={true} />
      </Row>
      <Text fontSize={11} color={COLORS.text}>{provider.summary}</Text>
    </Pressable>
  );
}

export function CapabilityCard(props: any) {
  const item = props.item;
  return (
    <Box style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 8 }}>
      <Row style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{item.name}</Text>
        <Pill label={item.status} color={item.tone} borderColor={item.tone} backgroundColor={COLORS.panelBg} tiny={true} />
        <Pill label={item.surface} tiny={true} />
      </Row>
      <Text fontSize={11} color={COLORS.text}>{item.summary}</Text>
      <Text fontSize={10} color={COLORS.blue}>reference: {item.reference}</Text>
      <Text fontSize={10} color={COLORS.orange}>pressure: {item.pressure}</Text>
    </Box>
  );
}

export function SettingsSurface(props: any) {
  const stacked = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const selectedProvider = props.providers.find((provider: any) => provider.id === props.selectedProviderId) || props.providers[0];
  return (
    <ScrollView style={{ flexGrow: 1, height: '100%', backgroundColor: COLORS.panelBg }}>
      <Col style={{ padding: stacked ? 12 : 18, gap: 16 }}>
        <Box style={{ padding: stacked ? 14 : 18, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
          <Text fontSize={10} color={COLORS.blue} style={{ letterSpacing: 0.8, fontWeight: 'bold' }}>SETTINGS SURFACE</Text>
          <Text fontSize={stacked ? 20 : 24} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
            Provider routing, context layers, memory, and plugin runtimes
          </Text>
          <Text fontSize={11} color={COLORS.text}>
            This page is deliberately product-dense. It pulls runtime pressure into one surface instead of scattering it across toy carts.
          </Text>
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <Pill label="model" color={COLORS.red} borderColor="#5a1f24" backgroundColor="#181015" />
            <Pill label={props.selectedModelName} color={COLORS.red} borderColor="#5a1f24" backgroundColor="#181015" />
            <Pill label={props.workspaceName} color={COLORS.blue} />
            <Pill label={props.gitBranch} color={COLORS.green} />
            <Pill label={props.agentStatusText} color={COLORS.purple} />
            <Pill label={props.workDir} color={COLORS.textMuted} />
          </Row>
        </Box>

        <Box style={{ flexDirection: stacked ? 'column' : 'row', gap: 14, alignItems: 'flex-start' }}>
          <Col style={{ width: stacked ? '100%' : 240, gap: 10 }}>
            {props.sections.map((section: any) => (
              <SettingsRow key={section.id} section={section} active={section.id === props.activeSection ? 1 : 0} onSelect={props.onSelectSection} />
            ))}
            <Box style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 6 }}>
              <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Compiler Goals</Text>
              <Text fontSize={10} color={COLORS.textDim}>Each area is intended to either compile as a real product slice or fail loudly enough to reduce into conformance work.</Text>
              <Pill label="vertical slice first" color={COLORS.blue} tiny={true} />
              <Pill label="runtime harness before workarounds" color={COLORS.green} tiny={true} />
              <Pill label="compiler break is success" color={COLORS.orange} tiny={true} />
            </Box>
          </Col>

          <Col style={{ flexGrow: 1, flexBasis: 0, gap: 14 }}>
            {props.activeSection === 'providers' ? (
              <Col style={{ gap: 14 }}>
                <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12 }}>
                  <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Model Providers</Text>
                  <Text fontSize={10} color={COLORS.textDim}>Real routing, auth, and policy surfaces instead of one hard-coded picker.</Text>
                  <Col style={{ gap: 10 }}>
                    {props.providers.map((provider: any) => (
                      <ProviderCard key={provider.id} provider={provider} active={provider.id === props.selectedProviderId ? 1 : 0} onSelect={props.onSelectProvider} />
                    ))}
                  </Col>
                </Box>
                <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: selectedProvider.tone, backgroundColor: COLORS.panelRaised, gap: 12 }}>
                  <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{selectedProvider.name + ' Routing'}</Text>
                  <Text fontSize={10} color={COLORS.text}>{selectedProvider.summary}</Text>
                  <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                    {selectedProvider.capabilities.map((capability: string) => (
                      <Pill key={capability} label={capability} color={selectedProvider.tone} borderColor={selectedProvider.tone} backgroundColor={COLORS.panelBg} tiny={true} />
                    ))}
                  </Row>
                  <Box style={{ flexDirection: stacked ? 'column' : 'row', gap: 10 }}>
                    <Col style={{ gap: 6, flexGrow: 1, flexBasis: 0, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
                      <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Default route</Text>
                      <Text fontSize={10} color={COLORS.blue}>{selectedProvider.route}</Text>
                      <Text fontSize={10} color={COLORS.textDim}>{selectedProvider.env}</Text>
                    </Col>
                    <Col style={{ gap: 6, flexGrow: 1, flexBasis: 0, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
                      <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Compiler pressure</Text>
                      <Text fontSize={10} color={COLORS.orange}>{selectedProvider.pressure}</Text>
                      <Text fontSize={10} color={COLORS.textDim}>{selectedProvider.detail}</Text>
                    </Col>
                  </Box>
                </Box>
              </Col>
            ) : null}

            {props.activeSection === 'context' ? <Col style={{ gap: 10 }}>{props.contextRows.map((item: any) => <InfoCard key={item.name} item={item} />)}</Col> : null}
            {props.activeSection === 'memory' ? <Col style={{ gap: 10 }}>{props.memoryRows.map((item: any) => <InfoCard key={item.name} item={item} />)}</Col> : null}
            {props.activeSection === 'plugins' ? <Col style={{ gap: 10 }}>{props.pluginRows.map((item: any) => <InfoCard key={item.name} item={item} />)}</Col> : null}
            {props.activeSection === 'automations' ? <Col style={{ gap: 10 }}>{props.automationRows.map((item: any) => <InfoCard key={item.name} item={item} />)}</Col> : null}
            {props.activeSection === 'capabilities' ? <Col style={{ gap: 10 }}>{props.capabilityRows.map((item: any) => <CapabilityCard key={item.name} item={item} />)}</Col> : null}
          </Col>
        </Box>
      </Col>
    </ScrollView>
  );
}
