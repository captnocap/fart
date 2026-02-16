/**
 * PlaygroundPanel — Template picker + live code editor + preview.
 *
 * Opens with a template picker grid. Pick a template to load its code into
 * the editor. Modify freely, see live preview on the right. Click "Templates"
 * to go back to the picker.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, TextEditor, Pressable } from '../../../packages/shared/src';
import { Preview } from './Preview';
import { StatusBar } from './StatusBar';
import { TemplatePicker } from './TemplatePicker';
import { lint } from './lib/linter';
import { transformJSX } from './lib/jsx-transform';
import { evalComponent } from './lib/eval-component';
import type { LintMessage } from './lib/linter';
import type { Template } from './templates';

export function PlaygroundPanel() {
  // If HMR has playground code, go straight to editor; otherwise show picker
  const hasHMRCode = !!(globalThis as any).__devState?.playgroundCode;
  const [showPicker, setShowPicker] = useState(!hasHMRCode);
  const [code, setCode] = useState((globalThis as any).__devState?.playgroundCode ?? '');
  const [editorKey, setEditorKey] = useState(0); // force remount TextEditor on template change
  const [UserComponent, setUserComponent] = useState<React.ComponentType | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [lintMessages, setLintMessages] = useState<LintMessage[]>([]);
  const [jumpToLine, setJumpToLine] = useState<number | undefined>(undefined);
  const debounceRef = useRef<any>(null);

  // Expose for HMR state sync
  (globalThis as any).__currentPlaygroundCode = code;

  const processCode = useCallback((src: string) => {
    const msgs = lint(src);
    setLintMessages(msgs);
    const errs = msgs.filter(m => m.severity === 'error');
    if (errs.length > 0) { setErrors(errs.map(e => `Line ${e.line}: ${e.message}`)); return; }
    const result = transformJSX(src);
    if (result.errors.length > 0) { setErrors(result.errors.map(e => `Line ${e.line}:${e.col}: ${e.message}`)); return; }
    const evalResult = evalComponent(result.code);
    if (evalResult.error) { setErrors([evalResult.error]); return; }
    setErrors([]);
    setUserComponent(() => evalResult.component);
  }, []);

  // Process code on mount if we have HMR code
  useEffect(() => { if (code) processCode(code); }, []);

  const handleCodeChange = useCallback((src: string) => {
    setCode(src);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => processCode(src), 300);
  }, [processCode]);

  const handleJumpToLine = useCallback((line: number) => {
    setJumpToLine(line);
    setTimeout(() => setJumpToLine(undefined), 50);
  }, []);

  const handleTemplateSelect = useCallback((template: Template) => {
    setCode(template.code);
    setEditorKey(k => k + 1); // remount TextEditor with new initialValue
    setShowPicker(false);
    // Process immediately
    setTimeout(() => processCode(template.code), 0);
  }, [processCode]);

  // ── Template picker mode ────────────────────────────────

  if (showPicker) {
    return <TemplatePicker onSelect={handleTemplateSelect} />;
  }

  // ── Editor + Preview mode ───────────────────────────────

  return (
    <Box style={{ flexDirection: 'row', width: '100%', height: '100%' }}>
      <Box style={{ flexGrow: 1, flexBasis: 0, height: '100%', borderRightWidth: 1, borderColor: '#1e293b' }}>
        <Box style={{ height: 32, paddingLeft: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#181825', borderBottomWidth: 1, borderColor: '#1e293b' }}>
          <Pressable
            onPress={() => setShowPicker(true)}
            style={(state) => ({
              backgroundColor: state.hovered ? '#334155' : '#1e293b',
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 2,
              paddingBottom: 2,
              borderRadius: 4,
            })}
          >
            <Text style={{ color: '#94a3b8', fontSize: 10 }}>Templates</Text>
          </Pressable>
          <Text style={{ color: '#cdd6f4', fontSize: 12, fontWeight: 'bold' }}>Editor</Text>
        </Box>
        <TextEditor
          key={editorKey}
          initialValue={code}
          onBlur={handleCodeChange}
          onSubmit={handleCodeChange}
          placeholder="Write JSX here..."
          style={{ flexGrow: 1, width: '100%' }}
          textStyle={{ fontSize: 13, fontFamily: 'monospace' }}
        />
        <StatusBar messages={lintMessages} onJumpToLine={handleJumpToLine} />
      </Box>
      <Preview UserComponent={UserComponent} errors={errors} />
    </Box>
  );
}
