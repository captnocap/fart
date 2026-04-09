(function() {
// ── Pattern 095: useReducer dispatch ────────────────────────────
// Index: 95
// Group: hooks
// Status: complete
//
// Soup syntax (copy-paste React):
//   const reducer = (state, action) => {
//     switch (action.type) {
//       case 'increment': return { count: state.count + 1 };
//       case 'decrement': return { count: state.count - 1 };
//       default: return state;
//     }
//   };
//   const [state, dispatch] = useReducer(reducer, { count: 0 });
//
//   function App() {
//     return (
//       <Box>
//         <Text>{state.count}</Text>
//         <Pressable onPress={() => dispatch({type: 'increment'})}>
//           <Text>+</Text>
//         </Pressable>
//       </Box>
//     );
//   }
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // useReducer(reducer, { count: 0 }) → flattened per-field slots,
//   // identical to useState({ count: 0 }).
//   //
//   // State init:
//   //   slots[0] = .{ .tag = .int, .value = .{ .int = 0 } };  // state_count
//   //
//   // {state.count} in JSX → dynamic text:
//   //   _ = std.fmt.bufPrint(&_dyn_buf_0, "{d}", .{state.getSlot(0)}) catch ...;
//   //
//   // dispatch({type: 'increment'}) in handler:
//   //   QuickJS eval runs reducer with current state snapshot,
//   //   result fields written back to individual slots via setSlot.
//
// Notes:
//   useReducer is structurally identical to useState with an object
//   initial value. The only difference is how state transitions work:
//   useState uses direct setters; useReducer uses a dispatch function
//   that runs a reducer to produce the next state.
//
//   Collection pass (collect/state.js):
//     The initial state { count: 0 } is parsed by collectObjectState(),
//     which flattens it to per-field slots: state_count with initial 0.
//     This is the same path useState({ count: 0 }) takes. Smith does
//     not need to distinguish useReducer from useState at collection
//     time — the [state, dispatch] destructuring is recognized the
//     same way as [getter, setter].
//
//   Reading state in JSX:
//     {state.count} resolves through field access on the flattened
//     object. resolve/field_access.js maps state.count → the slot
//     named state_count. This produces state.getSlot(N) in Zig,
//     rendered via bufPrint into a dynamic text buffer. Identical
//     to reading a useState({...}) field.
//
//   Dispatch in event handlers:
//     dispatch({type: 'increment'}) compiles to a QuickJS eval call.
//     The handler system (attrs_handlers.js) captures the dispatch
//     call body. At runtime, QuickJS holds the reducer function and
//     current state mirror. The eval runs the reducer with the action,
//     produces a new state object, and the bridge writes each field
//     back to its Zig slot via setSlot.
//
//     This is the same mechanism used for any handler body that
//     calls functions with state — the handler body is captured as
//     a JS string and eval'd in QuickJS with state bindings.
//
//   Why this is complete:
//     - Initial state: collectObjectState handles { field: val }
//     - State reads: field_access.js resolves state.field → slot
//     - State transitions: handler eval in QuickJS calls reducer
//     - The reducer function itself lives in <script> or is inlined
//       as a const — QuickJS holds it as a JS function

function match(c, ctx) {
  // const [state, dispatch] = useReducer(...) / React.useReducer(...)
  var saved = c.save();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  var kw = c.text();
  if (kw !== 'const' && kw !== 'let') { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.lbracket) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.comma) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.rbracket) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.equals) { c.restore(saved); return false; }
  c.advance();

  var isReducer = false;
  if (c.kind() === TK.identifier && c.text() === 'useReducer') {
    isReducer = true;
  } else if (c.kind() === TK.identifier && c.text() === 'React') {
    c.advance();
    if (c.kind() === TK.dot) c.advance();
    if (c.kind() === TK.identifier && c.text() === 'useReducer') isReducer = true;
  }
  c.restore(saved);
  return isReducer;
}

function compile(c, ctx) {
  var saved = c.save();
  var out = {
    kind: 'hook_use_reducer',
    stateVar: null,
    dispatchVar: null,
    reducerExprRaw: '',
    initialExprRaw: '',
    source: null,
  };

  if (!(c.kind() === TK.identifier && (c.text() === 'const' || c.text() === 'let'))) {
    c.restore(saved);
    return null;
  }
  c.advance();
  if (c.kind() !== TK.lbracket) { c.restore(saved); return null; }
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return null; }
  out.stateVar = c.text();
  c.advance();
  if (c.kind() !== TK.comma) { c.restore(saved); return null; }
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return null; }
  out.dispatchVar = c.text();
  c.advance();
  if (c.kind() !== TK.rbracket) { c.restore(saved); return null; }
  c.advance();
  if (c.kind() !== TK.equals) { c.restore(saved); return null; }
  c.advance();

  if (c.kind() === TK.identifier && c.text() === 'React') {
    out.source = 'React.useReducer';
    c.advance();
    if (c.kind() === TK.dot) c.advance();
  }
  if (!(c.kind() === TK.identifier && c.text() === 'useReducer')) { c.restore(saved); return null; }
  if (!out.source) out.source = 'useReducer';
  c.advance();
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance();

  var reducerParts = [];
  var depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.comma && depth === 1) break;
    if (c.kind() === TK.lparen || c.kind() === TK.lbracket || c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rparen || c.kind() === TK.rbracket || c.kind() === TK.rbrace) depth--;
    reducerParts.push(c.text());
    c.advance();
  }
  out.reducerExprRaw = reducerParts.join(' ').trim();

  if (c.kind() === TK.comma) c.advance();
  var initParts = [];
  depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.lparen || c.kind() === TK.lbracket || c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rparen || c.kind() === TK.rbracket || c.kind() === TK.rbrace) {
      depth--;
      if (depth === 0) break;
    }
    initParts.push(c.text());
    c.advance();
  }
  if (c.kind() === TK.rparen) c.advance();
  out.initialExprRaw = initParts.join(' ').trim();

  return out;
}

_patterns[95] = { id: 95, match: match, compile: compile };

})();
