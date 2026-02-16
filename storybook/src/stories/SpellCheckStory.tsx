import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, Pressable, TextInput, useBridge } from '../../../packages/shared/src';

function SpellCheckDemo() {
  const bridge = useBridge();
  const [input, setInput] = useState('I hav a speling eror in this sentance');
  const [errors, setErrors] = useState<Array<{ word: string; start: number; stop: number }>>([]);
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);
  const checkTimer = useRef<any>(null);

  // Check text for spelling errors (debounced)
  const checkText = useCallback(async (text: string) => {
    try {
      const result = await bridge.rpc('spell:checkText', { text });
      setErrors(result || []);

      // Fetch suggestions for each misspelled word
      const sugs: Record<string, string[]> = {};
      for (const err of (result || [])) {
        const s = await bridge.rpc('spell:suggest', { word: err.word, limit: 4 });
        sugs[err.word] = s || [];
      }
      setSuggestions(sugs);
    } catch {
      setAvailable(false);
    }
  }, [bridge]);

  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(() => checkText(input), 300);
    return () => { if (checkTimer.current) clearTimeout(checkTimer.current); };
  }, [input, checkText]);

  // Apply a suggestion — replace word in text
  const applySuggestion = useCallback((misspelled: string, replacement: string) => {
    const regex = new RegExp(`\\b${misspelled}\\b`, 'i');
    setInput(prev => prev.replace(regex, replacement));
    setSelectedWord(null);
  }, []);

  if (!available) {
    return (
      <Box style={{ padding: 20 }}>
        <Text style={{ fontSize: 14, color: '#94a3b8' }}>
          {`Spell check not available — dictionary.db not found`}
        </Text>
      </Box>
    );
  }

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0f172a', padding: 20, gap: 16 }}>
      <Text style={{ fontSize: 18, color: '#f8fafc', fontWeight: 'bold' }}>Spell Check</Text>
      <Text style={{ fontSize: 12, color: '#64748b' }}>
        {`50,000 word English dictionary over SQLite. Edit the text below — misspelled words are flagged in real-time.`}
      </Text>

      {/* Input area */}
      <Box style={{ backgroundColor: '#1e293b', borderRadius: 8, padding: 12 }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          multiline
          style={{
            fontSize: 15,
            color: '#e2e8f0',
            minHeight: 60,
          }}
        />
      </Box>

      {/* Error summary */}
      <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {errors.length === 0 ? (
          <Box style={{ backgroundColor: '#065f4620', borderRadius: 6, paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10 }}>
            <Text style={{ fontSize: 12, color: '#34d399' }}>No spelling errors</Text>
          </Box>
        ) : (
          <Box style={{ backgroundColor: '#7f1d1d20', borderRadius: 6, paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10 }}>
            <Text style={{ fontSize: 12, color: '#f87171' }}>
              {`${errors.length} misspelled word${errors.length > 1 ? 's' : ''}`}
            </Text>
          </Box>
        )}
      </Box>

      {/* Misspelled words with suggestions */}
      {errors.length > 0 && (
        <Box style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, color: '#94a3b8', fontWeight: 'bold' }}>Corrections</Text>
          {errors.map((err, i) => (
            <Box
              key={`${err.word}-${i}`}
              style={{
                backgroundColor: '#1e293b',
                borderRadius: 6,
                padding: 10,
                gap: 6,
              }}
            >
              <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Box style={{
                  backgroundColor: '#dc262620',
                  borderRadius: 4,
                  paddingTop: 2, paddingBottom: 2,
                  paddingLeft: 8, paddingRight: 8,
                }}>
                  <Text style={{ fontSize: 14, color: '#f87171' }}>{err.word}</Text>
                </Box>
                {suggestions[err.word] && suggestions[err.word].length > 0 && (
                  <Text style={{ fontSize: 11, color: '#475569' }}>Did you mean:</Text>
                )}
              </Box>

              {/* Suggestion chips */}
              {suggestions[err.word] && (
                <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {suggestions[err.word].map((sug) => (
                    <Pressable
                      key={sug}
                      onPress={() => applySuggestion(err.word, sug)}
                      style={{
                        backgroundColor: '#334155',
                        borderRadius: 4,
                        paddingTop: 3, paddingBottom: 3,
                        paddingLeft: 10, paddingRight: 10,
                      }}
                      hoverStyle={{ backgroundColor: '#475569' }}
                      activeStyle={{ backgroundColor: '#3b82f6' }}
                    >
                      <Text style={{ fontSize: 13, color: '#e2e8f0' }}>{sug}</Text>
                    </Pressable>
                  ))}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Single word check */}
      <Box style={{ marginTop: 8, gap: 8 }}>
        <Text style={{ fontSize: 13, color: '#94a3b8', fontWeight: 'bold' }}>Quick Check</Text>
        <QuickCheck bridge={bridge} />
      </Box>
    </Box>
  );
}

function QuickCheck({ bridge }: { bridge: any }) {
  const [word, setWord] = useState('');
  const [result, setResult] = useState<{ valid: boolean; suggestions: string[] } | null>(null);

  const check = useCallback(async () => {
    if (!word.trim()) return;
    const valid = await bridge.rpc('spell:check', { word: word.trim() });
    let sugs: string[] = [];
    if (!valid) {
      sugs = await bridge.rpc('spell:suggest', { word: word.trim(), limit: 5 });
    }
    setResult({ valid, suggestions: sugs || [] });
  }, [bridge, word]);

  useEffect(() => {
    if (word.trim().length > 1) {
      const t = setTimeout(check, 200);
      return () => clearTimeout(t);
    } else {
      setResult(null);
    }
  }, [word, check]);

  return (
    <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
      <Box style={{ backgroundColor: '#1e293b', borderRadius: 6, padding: 8, width: 200 }}>
        <TextInput
          value={word}
          onChangeText={setWord}
          placeholder="Type a word..."
          style={{ fontSize: 14, color: '#e2e8f0' }}
        />
      </Box>
      {result && (
        <Box style={{ gap: 4, paddingTop: 4 }}>
          {result.valid ? (
            <Text style={{ fontSize: 13, color: '#34d399' }}>Valid</Text>
          ) : (
            <Box style={{ gap: 2 }}>
              <Text style={{ fontSize: 13, color: '#f87171' }}>Not in dictionary</Text>
              {result.suggestions.length > 0 && (
                <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                  {`Suggestions: ${result.suggestions.join(', ')}`}
                </Text>
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export const SpellCheckStory = SpellCheckDemo;
