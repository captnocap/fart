/**
 * eval-component.ts — Safe eval wrapper for user JSX code.
 *
 * Injects the full iLoveReact component library into scope so playground
 * users can prototype with any framework primitive.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  // Primitives
  Box, Text, Image, Pressable, ScrollView, TextInput,
  // Form controls
  Slider, Switch, Checkbox, Radio, RadioGroup, Select,
  // Layout helpers
  Card, Badge, Divider, FlexRow, FlexColumn, Spacer,
  // Data visualization
  Table, BarChart, ProgressBar, Sparkline,
  // Navigation
  NavPanel, Tabs, Breadcrumbs, Toolbar,
  // Animation
  AnimatedValue, useAnimation, useSpring,
} from '../../../../packages/shared/src';

export interface EvalResult { component: React.ComponentType | null; error: string | null; }

/** Names injected into the eval scope, in order matching the Function params */
const SCOPE_NAMES = [
  'React', 'useState', 'useEffect', 'useCallback', 'useRef', 'useMemo',
  // Primitives
  'Box', 'Text', 'Image', 'Pressable', 'ScrollView', 'TextInput',
  // Form controls
  'Slider', 'Switch', 'Checkbox', 'Radio', 'RadioGroup', 'Select',
  // Layout helpers
  'Card', 'Badge', 'Divider', 'FlexRow', 'FlexColumn', 'Spacer',
  // Data visualization
  'Table', 'BarChart', 'ProgressBar', 'Sparkline',
  // Navigation
  'NavPanel', 'Tabs', 'Breadcrumbs', 'Toolbar',
  // Animation
  'AnimatedValue', 'useAnimation', 'useSpring',
] as const;

const SCOPE_VALUES = [
  React, useState, useEffect, useCallback, useRef, useMemo,
  Box, Text, Image, Pressable, ScrollView, TextInput,
  Slider, Switch, Checkbox, Radio, RadioGroup, Select,
  Card, Badge, Divider, FlexRow, FlexColumn, Spacer,
  Table, BarChart, ProgressBar, Sparkline,
  NavPanel, Tabs, Breadcrumbs, Toolbar,
  AnimatedValue, useAnimation, useSpring,
];

export function evalComponent(transformedCode: string): EvalResult {
  try {
    const funcMatch = transformedCode.match(/function\s+([A-Z][a-zA-Z0-9]*)\s*\(/);
    const constMatch = transformedCode.match(/(?:const|let|var)\s+([A-Z][a-zA-Z0-9]*)\s*=/);
    const name = funcMatch?.[1] || constMatch?.[1];

    const wrapped = name
      ? `${transformedCode}\nreturn ${name};`
      : `return function __UserComponent__() { return ${transformedCode.trim().replace(/;$/, '')}; };`;

    const fn = new Function(...SCOPE_NAMES, wrapped);
    const result = fn(...SCOPE_VALUES);

    if (typeof result === 'function') return { component: result, error: null };
    if (result && typeof result === 'object' && result.$$typeof) return { component: () => result, error: null };
    return { component: null, error: 'Code did not produce a component. Define a function that returns JSX.' };
  } catch (e: any) {
    return { component: null, error: e?.message || String(e) };
  }
}
