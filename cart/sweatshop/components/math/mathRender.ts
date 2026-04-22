import React from 'react';
import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import type { MathNode } from './useLaTeXParse';

export type MathRenderOptions = {
  fontSize: number;
  color: string;
  inline?: boolean;
};

function nodeKey(node: MathNode, index: number): string {
  return `${node.type}-${index}`;
}

function renderText(value: string, options: MathRenderOptions, key: string) {
  return (
    <Text key={key} style={{ color: options.color, fontSize: options.fontSize, lineHeight: options.fontSize * 1.15 }}>
      {value}
    </Text>
  );
}

function renderGroup(nodes: MathNode[], options: MathRenderOptions, keyPrefix: string): React.ReactNode {
  return nodes.map((node, index) => renderNode(node, options, `${keyPrefix}-${nodeKey(node, index)}`));
}

function renderScript(node: Extract<MathNode, { type: 'script' }>, options: MathRenderOptions, key: string) {
  const scriptSize = Math.max(9, Math.round(options.fontSize * 0.68));
  const base = renderNode(node.base, options, `${key}-base`);
  const hasSuper = !!node.superscript?.length;
  const hasSub = !!node.subscript?.length;

  return (
    <Row key={key} style={{ alignItems: 'flex-start' }}>
      {base}
      <Col style={{ alignItems: 'flex-start', gap: 0, marginLeft: 1 }}>
        {hasSuper ? (
          <Box style={{ marginTop: -Math.max(3, options.fontSize * 0.25) }}>
            <Row style={{ alignItems: 'flex-start' }}>
              {renderGroup(node.superscript!, { ...options, fontSize: scriptSize }, `${key}-sup`)}
            </Row>
          </Box>
        ) : (
          <Box style={{ height: options.fontSize * 0.35 }} />
        )}
        {hasSub ? (
          <Box style={{ marginTop: Math.max(1, options.fontSize * 0.02) }}>
            <Row style={{ alignItems: 'flex-start' }}>
              {renderGroup(node.subscript!, { ...options, fontSize: scriptSize }, `${key}-sub`)}
            </Row>
          </Box>
        ) : null}
      </Col>
    </Row>
  );
}

function renderFraction(node: Extract<MathNode, { type: 'fraction' }>, options: MathRenderOptions, key: string) {
  const next = { ...options, fontSize: Math.max(10, Math.round(options.fontSize * 0.82)) };
  return (
    <Col key={key} style={{ alignItems: 'center', justifyContent: 'center', paddingLeft: 2, paddingRight: 2 }}>
      <Row style={{ alignItems: 'center' }}>
        {renderGroup(node.numerator, next, `${key}-num`)}
      </Row>
      <Box style={{ width: '100%', minWidth: 10, borderTopWidth: 1, borderColor: options.color, marginTop: 2, marginBottom: 2 }} />
      <Row style={{ alignItems: 'center' }}>
        {renderGroup(node.denominator, next, `${key}-den`)}
      </Row>
    </Col>
  );
}

function renderSqrt(node: Extract<MathNode, { type: 'sqrt' }>, options: MathRenderOptions, key: string) {
  const next = { ...options, fontSize: Math.max(10, Math.round(options.fontSize * 0.9)) };
  return (
    <Row key={key} style={{ alignItems: 'flex-start' }}>
      <Text style={{ color: options.color, fontSize: options.fontSize, lineHeight: options.fontSize * 1.1 }}>
        √
      </Text>
      <Col style={{ alignItems: 'flex-start', paddingLeft: 3, borderTopWidth: 1, borderColor: options.color, paddingTop: 2 }}>
        {node.index ? (
          <Row style={{ alignItems: 'flex-start', marginBottom: -2 }}>
            {renderGroup(node.index, { ...options, fontSize: Math.max(8, Math.round(options.fontSize * 0.58)) }, `${key}-index`)}
          </Row>
        ) : null}
        <Row style={{ alignItems: 'flex-start' }}>
          {renderGroup(node.radicand, next, `${key}-rad`)}
        </Row>
      </Col>
    </Row>
  );
}

function renderMatrix(node: Extract<MathNode, { type: 'matrix' }>, options: MathRenderOptions, key: string) {
  const delimiters: Record<typeof node.variant, [string, string]> = {
    matrix: ['', ''],
    pmatrix: ['(', ')'],
    bmatrix: ['[', ']'],
    vmatrix: ['|', '|'],
  };
  const [left, right] = delimiters[node.variant];
  return (
    <Row key={key} style={{ alignItems: 'stretch' }}>
      {left ? <Text style={{ color: options.color, fontSize: options.fontSize * 1.2 }}>{left}</Text> : null}
      <Col style={{ alignItems: 'flex-start', paddingLeft: 4, paddingRight: 4, gap: 2 }}>
        {node.rows.map((row, rowIndex) => (
          <Row key={`${key}-row-${rowIndex}`} style={{ alignItems: 'center', gap: 8 }}>
            {row.map((cell, cellIndex) => (
              <Row key={`${key}-cell-${rowIndex}-${cellIndex}`} style={{ alignItems: 'center' }}>
                {renderGroup(cell, { ...options, fontSize: Math.max(10, Math.round(options.fontSize * 0.9)) }, `${key}-r${rowIndex}c${cellIndex}`)}
              </Row>
            ))}
          </Row>
        ))}
      </Col>
      {right ? <Text style={{ color: options.color, fontSize: options.fontSize * 1.2 }}>{right}</Text> : null}
    </Row>
  );
}

export function renderNode(node: MathNode, options: MathRenderOptions, key: string): React.ReactNode {
  if (node.type === 'empty') return null;
  if (node.type === 'text') return renderText(node.value, options, key);
  if (node.type === 'symbol') return renderText(node.value, options, key);
  if (node.type === 'group') {
    return (
      <Row key={key} style={{ alignItems: 'flex-start' }}>
        {renderGroup(node.children, options, key)}
      </Row>
    );
  }
  if (node.type === 'fraction') return renderFraction(node, options, key);
  if (node.type === 'sqrt') return renderSqrt(node, options, key);
  if (node.type === 'script') return renderScript(node, options, key);
  if (node.type === 'matrix') return renderMatrix(node, options, key);
  return null;
}

export function renderMathTree(nodes: MathNode[], options: MathRenderOptions) {
  return (
    <Row style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {nodes.map((node, index) => renderNode(node, options, nodeKey(node, index)))}
    </Row>
  );
}
