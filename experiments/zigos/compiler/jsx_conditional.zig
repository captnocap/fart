//! jsx_conditional.zig — Conditional child parsing for JSX elements.
//!
//! Handles {expr && <JSX>} patterns inside JSX children.
//! Two modes:
//!   - Compile-time: if expr is a prop (no state), evaluate truthiness at compile time
//!     and either include or exclude the child entirely.
//!   - Runtime: if expr references state, emit a ConditionalInfo that _updateConditionals()
//!     toggles display:.flex/.none on each state change.

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;
const attrs = @import("attrs.zig");
const jsx = @import("jsx.zig");

const MAX_CONDITIONALS = codegen.MAX_CONDITIONALS;

/// Look ahead from current position to see if there's a && before the next closing brace.
/// Used to distinguish {expr && <JSX>} from {expr} or {children}.
pub fn isLogicalAndAhead(self: *Generator) bool {
    var look = self.pos;
    var brace_depth: u32 = 0;
    while (look < self.lex.count) {
        const kind = self.lex.get(look).kind;
        if (kind == .lbrace) brace_depth += 1;
        if (kind == .rbrace) {
            if (brace_depth == 0) return false;
            brace_depth -= 1;
        }
        if (kind == .amp_amp and brace_depth == 0) return true;
        if (kind == .eof) return false;
        look += 1;
    }
    return false;
}

/// Find the "render gate" && — the last && at brace/paren depth 0 before the
/// closing brace. This is the && that separates the condition from the JSX element.
/// For `{a && b && <Box>}`, returns the position of the second &&.
/// For `{cond && <Box>}`, returns the position of the only &&.
/// Handles compound conditions with &&, ||, and parenthesized subexpressions.
pub fn findRenderGateAmpAmp(self: *Generator) u32 {
    var scan = self.pos;
    var brace_depth: u32 = 0;
    var paren_depth: u32 = 0;
    var last_amp_amp: u32 = self.pos; // fallback
    while (scan < self.lex.count) {
        const kind = self.lex.get(scan).kind;
        if (kind == .lbrace) {
            brace_depth += 1;
        } else if (kind == .rbrace) {
            if (brace_depth == 0) break;
            brace_depth -= 1;
        } else if (kind == .lparen) {
            paren_depth += 1;
        } else if (kind == .rparen) {
            if (paren_depth > 0) paren_depth -= 1;
        } else if (kind == .amp_amp and brace_depth == 0 and paren_depth == 0) {
            last_amp_amp = scan;
        } else if (kind == .eof) {
            break;
        }
        scan += 1;
    }
    return last_amp_amp;
}

/// Try to parse a {expr && <JSX>} conditional child.
/// Returns true if it was a conditional (consumed tokens), false if not (no tokens consumed).
///
/// Compile-time path (props only): evaluates the condition at compile time and either
/// includes or omits the child JSX entirely — zero runtime cost.
///
/// Runtime path (state refs): always includes the child, but records a ConditionalInfo
/// that _updateConditionals() uses to toggle display:.flex/.none on state changes.
///
/// Supports compound conditions: {a && b && <JSX>}, {(a || b) && <JSX>}, {!a && <JSX>}
pub fn tryParseConditionalChild(self: *Generator, child_exprs: *std.ArrayListUnmanaged([]const u8)) anyerror!bool {
    if (!isLogicalAndAhead(self)) return false;

    const saved_pos = self.pos;
    const amp_pos = findRenderGateAmpAmp(self);
    var has_state_ref = false;
    var has_comparison = false;
    var token_count: u32 = 0;

    {
        var scan = self.pos;
        while (scan < amp_pos) {
            const kind = self.lex.get(scan).kind;
            if (kind == .identifier) {
                const txt = self.lex.get(scan).text(self.source);
                if (scan + 2 < self.lex.count and
                    self.lex.get(scan + 1).kind == .dot and
                    self.lex.get(scan + 2).kind == .identifier and
                    self.resolveObjectStateField(txt, self.lex.get(scan + 2).text(self.source)) != null)
                {
                    has_state_ref = true;
                } else if (self.isState(txt) != null) {
                    has_state_ref = true;
                } else if (self.findProp(txt)) |pval| {
                    // Prop whose value depends on state — can't evaluate at compile time
                    if (std.mem.indexOf(u8, pval, "state.") != null) has_state_ref = true;
                }
            }
            if (kind == .eq_eq or kind == .not_eq or kind == .lt or kind == .gt or
                kind == .lt_eq or kind == .gt_eq) has_comparison = true;
            token_count += 1;
            scan += 1;
        }
    }

    // Compile-time conditional: props only (no state)
    if (!has_state_ref) {
        self.pos = saved_pos;

        var lhs: ?i64 = null;
        var rhs: ?i64 = null;
        var cmp_op: enum { none, eq, neq } = .none;

        if (!has_comparison and token_count == 1) {
            const ident = self.curText();
            const prop_val = self.findProp(ident) orelse "";
            const is_truthy = prop_val.len > 0 and
                !std.mem.eql(u8, prop_val, "0") and
                !std.mem.eql(u8, prop_val, "\"\"") and
                !std.mem.eql(u8, prop_val, "''");
            self.pos = amp_pos;
            self.advance_token();
            if (is_truthy) {
                const child_expr = try jsx.parseJSXElement(self);
                try child_exprs.append(self.alloc, child_expr);
            } else {
                _ = try jsx.parseJSXElement(self);
            }
            if (self.curKind() == .rbrace) self.advance_token();
            return true;
        }

        while (self.pos < amp_pos) {
            if (self.curKind() == .identifier) {
                const ident_text = self.curText();
                const val_str = self.findProp(ident_text) orelse blk: {
                    // Unpassed component prop → default to 0 (falsy)
                    if (self.isState(ident_text) == null and self.isLocalVar(ident_text) == null)
                        break :blk "0";
                    break :blk ident_text;
                };
                lhs = std.fmt.parseInt(i64, val_str, 10) catch null;
            } else if (self.curKind() == .number) {
                const n = std.fmt.parseInt(i64, self.curText(), 10) catch null;
                if (lhs != null and cmp_op != .none) rhs = n else lhs = n;
            } else if (self.curKind() == .eq_eq) {
                cmp_op = .eq;
            } else if (self.curKind() == .not_eq) {
                cmp_op = .neq;
            }
            self.advance_token();
        }

        const is_truthy = if (lhs != null and rhs != null and cmp_op != .none)
            (if (cmp_op == .eq) lhs.? == rhs.? else lhs.? != rhs.?)
        else if (lhs != null)
            lhs.? != 0
        else
            false;

        self.advance_token();
        if (is_truthy) {
            const child_expr = try jsx.parseJSXElement(self);
            try child_exprs.append(self.alloc, child_expr);
        } else {
            _ = try jsx.parseJSXElement(self);
        }
        if (self.curKind() == .rbrace) self.advance_token();
        return true;
    }

    // State-based condition: runtime conditional
    if (has_state_ref) {
        self.pos = saved_pos;

        // amp_pos already computed via findRenderGateAmpAmp — handles compound conditions
        var cond_parts: std.ArrayListUnmanaged(u8) = .{};
        try cond_parts.appendSlice(self.alloc, "(");
        while (self.pos < amp_pos) {
            const tok_text = self.curText();
            if (self.curKind() == .identifier) {
                if (self.pos + 2 < amp_pos and
                    self.lex.get(self.pos + 1).kind == .dot and
                    self.lex.get(self.pos + 2).kind == .identifier)
                {
                    const field_name = self.lex.get(self.pos + 2).text(self.source);
                    if (self.resolveObjectStateField(tok_text, field_name)) |field| {
                        const rid = self.regularSlotId(field.slot_id);
                        const accessor = switch (field.state_type) {
                            .string => try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}),
                            .float => try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}),
                            .boolean => try std.fmt.allocPrint(self.alloc, "state.getSlotBool({d})", .{rid}),
                            else => try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}),
                        };
                        try cond_parts.appendSlice(self.alloc, accessor);
                        self.advance_token();
                        self.advance_token();
                        self.advance_token();
                        continue;
                    }
                }
                if (self.isState(tok_text)) |slot_id| {
                    const rid = self.regularSlotId(slot_id);
                    const st = self.stateTypeById(slot_id);
                    const accessor = switch (st) {
                        .string => try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}),
                        .float => try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}),
                        .boolean => try std.fmt.allocPrint(self.alloc, "state.getSlotBool({d})", .{rid}),
                        else => try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}),
                    };
                    try cond_parts.appendSlice(self.alloc, accessor);
                    self.advance_token();
                    continue;
                }
                if (self.findProp(tok_text)) |pval| {
                    if (cond_parts.items.len > 1) try cond_parts.append(self.alloc, ' ');
                    try cond_parts.appendSlice(self.alloc, pval);
                    self.advance_token();
                    continue;
                }
            }
            // Operators — emit Zig equivalents
            if (self.curKind() == .eq_eq) {
                try cond_parts.appendSlice(self.alloc, " == ");
            } else if (self.curKind() == .not_eq) {
                try cond_parts.appendSlice(self.alloc, " != ");
            } else if (self.curKind() == .amp_amp) {
                // Compound && within the condition (not the render gate)
                try cond_parts.appendSlice(self.alloc, " and ");
            } else if (self.curKind() == .pipe_pipe) {
                try cond_parts.appendSlice(self.alloc, " or ");
            } else if (self.curKind() == .bang) {
                try cond_parts.appendSlice(self.alloc, "!");
            } else if (self.curKind() == .lt) {
                try cond_parts.appendSlice(self.alloc, " < ");
            } else if (self.curKind() == .gt) {
                try cond_parts.appendSlice(self.alloc, " > ");
            } else if (self.curKind() == .lt_eq) {
                try cond_parts.appendSlice(self.alloc, " <= ");
            } else if (self.curKind() == .gt_eq) {
                try cond_parts.appendSlice(self.alloc, " >= ");
            } else if (self.curKind() == .lparen) {
                try cond_parts.appendSlice(self.alloc, "(");
            } else if (self.curKind() == .rparen) {
                try cond_parts.appendSlice(self.alloc, ")");
            } else {
                if (cond_parts.items.len > 1) try cond_parts.append(self.alloc, ' ');
                try cond_parts.appendSlice(self.alloc, tok_text);
            }
            self.advance_token();
        }
        try cond_parts.appendSlice(self.alloc, ")");

        self.advance_token(); // skip &&

        const child_expr = try jsx.parseJSXElement(self);
        try child_exprs.append(self.alloc, child_expr);

        if (self.conditional_count < MAX_CONDITIONALS) {
            self.conditionals[self.conditional_count] = .{
                .kind = .show_hide,
                .cond_expr = try self.alloc.dupe(u8, cond_parts.items),
                .arr_name = "",
                .true_idx = @intCast(child_exprs.items.len - 1),
            };
            self.conditional_count += 1;
        }

        if (self.curKind() == .rbrace) self.advance_token();
        return true;
    }

    self.pos = saved_pos;
    return false;
}
