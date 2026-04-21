//! Minimal EQJS transpiler prototype.
//!
//! This is not a full JavaScript compiler. It is a deliberately narrow,
//! fast-path transpiler for a constrained JS-like subset used by experiments.
//! The intent is to show a Luajit-friendly AOT pipeline:
//!  - parse JS syntax in Zig
//!  - emit Lua source that LuaJIT traces directly
//!  - lower typed arrays to FFI constructors
//!
//! Supported syntax:
//!   - export/normal function declarations
//!   - let/const/var (mapped to local)
//!   - return / if / while
//!   - assignment + basic expression precedence
//!   - numeric/string literals, null/true/false
//!   - calls, indexing, member access
//!   - `new Float64Array(...)`, `new Int32Array(...)`, etc.
//!     -> `eqjs:typed_array("<ctype>", ...)`

const std = @import("std");

const Allocator = std.mem.Allocator;

const ParseError = error{
    InvalidInput,
    UnexpectedToken,
    OutOfMemory,
};

const TokenTag = enum { eof, identifier, number, string, punct, keyword };

const Token = struct {
    tag: TokenTag,
    text: []const u8,
    line: usize,
    col: usize,
};

const Lexer = struct {
    src: []const u8,
    i: usize = 0,
    line: usize = 1,
    col: usize = 1,
    token: Token = .{ .tag = .eof, .text = "", .line = 1, .col = 1 },

    fn isWhitespace(c: u8) bool {
        return c == ' ' or c == '\t' or c == '\r' or c == '\n' or c == '\x0b' or c == '\x0c';
    }

    fn isIdentStart(c: u8) bool {
        return (c >= 'a' and c <= 'z') or
            (c >= 'A' and c <= 'Z') or
            c == '_' or c == '$';
    }

    fn isIdentPart(c: u8) bool {
        return isIdentStart(c) or (c >= '0' and c <= '9');
    }

    fn isKeyword(word: []const u8) bool {
        const keywords = [_][]const u8{
            "export",       "function", "let", "const", "var",
            "return",       "if",      "else",  "while", "new",
            "true",         "false",   "null",  "undefined", "this",
        };
        for (keywords) |k| {
            if (std.mem.eql(u8, k, word)) return true;
        }
        return false;
    }

    fn cur(self: *const Lexer) ?u8 {
        if (self.i >= self.src.len) return null;
        return self.src[self.i];
    }

    fn cur2(self: *const Lexer) ?u8 {
        if (self.i + 1 >= self.src.len) return null;
        return self.src[self.i + 1];
    }

    fn advance(self: *Lexer) void {
        if (self.i >= self.src.len) return;
        if (self.src[self.i] == '\n') {
            self.line += 1;
            self.col = 1;
        } else {
            self.col += 1;
        }
        self.i += 1;
    }

    fn matches(self: *const Lexer, start: usize, literal: []const u8) bool {
        if (start + literal.len > self.src.len) return false;
        return std.mem.eql(u8, self.src[start .. start + literal.len], literal);
    }

    fn skipSpaceAndComments(self: *Lexer) void {
        while (self.cur()) |c| {
            if (isWhitespace(c)) {
                self.advance();
                continue;
            }
            if (c == '/') {
                if (self.cur2()) |c2| {
                    if (c2 == '/') {
                        self.advance();
                        self.advance();
                        while (self.cur()) |cc| {
                            if (cc == '\n') break;
                            self.advance();
                        }
                        continue;
                    }
                    if (c2 == '*') {
                        self.advance();
                        self.advance();
                        while (self.cur()) |cc| {
                            if (cc == '*') {
                                if (self.cur2()) |next_ch| {
                                    if (next_ch == '/') {
                                        self.advance();
                                        self.advance();
                                        break;
                                    }
                                }
                            }
                            self.advance();
                        }
                        continue;
                    }
                }
            }
            return;
        }
    }

    fn next(self: *Lexer) void {
        self.skipSpaceAndComments();
        if (self.i >= self.src.len) {
            self.token = .{ .tag = .eof, .text = "", .line = self.line, .col = self.col };
            return;
        }

        const start = self.i;
        const start_col = self.col;
        const c = self.cur().?;

        if (isIdentStart(c)) {
            self.advance();
            while (self.cur()) |cc| {
                if (!isIdentPart(cc)) break;
                self.advance();
            }
            const word = self.src[start..self.i];
            var tag = TokenTag.identifier;
            if (isKeyword(word)) tag = .keyword;
            self.token = .{ .tag = tag, .text = word, .line = self.line, .col = start_col };
            return;
        }

        if ((c >= '0' and c <= '9') or (c == '.' and self.cur2() != null and (self.cur2().? >= '0' and self.cur2().? <= '9'))) {
            self.advance();
            while (self.cur()) |cc| {
                if ((cc >= '0' and cc <= '9') or cc == '.') {
                    self.advance();
                } else {
                    break;
                }
            }
            self.token = .{ .tag = .number, .text = self.src[start..self.i], .line = self.line, .col = start_col };
            return;
        }

        if (c == '\'' or c == '"') {
            const quote = c;
            self.advance();
            while (self.cur()) |cc| {
                if (cc == '\\') {
                    self.advance();
                    if (self.cur()) |_| self.advance();
                    continue;
                }
                if (cc == quote) {
                    self.advance();
                    break;
                }
                self.advance();
            }
            self.token = .{ .tag = .string, .text = self.src[start..self.i], .line = self.line, .col = start_col };
            return;
        }

        const multi = [_][]const u8{ "===", "!==", "==", "!=", "<=", ">=", "&&", "||", "++", "--" };
        for (multi) |m| {
            if (self.matches(start, m)) {
                self.i += m.len;
                self.col += m.len;
                self.token = .{ .tag = .punct, .text = m, .line = self.line, .col = start_col };
                return;
            }
        }

        self.advance();
        self.token = .{ .tag = .punct, .text = self.src[start..self.i], .line = self.line, .col = start_col };
    }
};

const Parser = struct {
    alloc: Allocator,
    src: []const u8,
    lexer: Lexer,
    out: *std.array_list.Managed(u8),
    indent: usize,

    fn init(alloc: Allocator, src: []const u8, out: *std.array_list.Managed(u8)) Parser {
        var l = Lexer{ .src = src };
        l.next();
        return .{
            .alloc = alloc,
            .src = src,
            .lexer = l,
            .out = out,
            .indent = 0,
        };
    }

    fn write(self: *Parser, bytes: []const u8) ParseError!void {
        try self.out.appendSlice(bytes);
    }

    fn writeIndent(self: *Parser) !void {
        var n: usize = 0;
        while (n < self.indent) : (n += 1) {
            try self.out.appendSlice("  ");
        }
    }

    fn writeLine(self: *Parser, bytes: []const u8) !void {
        try self.writeIndent();
        try self.write(bytes);
        try self.write("\n");
    }

    fn expectPunct(self: *Parser, p: []const u8) ParseError!void {
        if (self.lexer.token.tag != .punct or !std.mem.eql(u8, self.lexer.token.text, p)) return ParseError.UnexpectedToken;
        self.lexer.next();
    }

    fn expectIdentifier(self: *Parser) ParseError![]const u8 {
        if (self.lexer.token.tag != .identifier and (self.lexer.token.tag != .keyword and !std.mem.eql(u8, self.lexer.token.text, "this"))) {
            return ParseError.UnexpectedToken;
        }
        const name = self.lexer.token.text;
        self.lexer.next();
        return name;
    }

    fn parseProgram(self: *Parser) ParseError!void {
        try self.write("-- generated by eqjs_transpiler\n");
        try self.write("local exports = {}\n\n");

        while (self.lexer.token.tag != .eof) {
            try self.parseStatement();
        }

        try self.write("\nreturn { exports = exports }\n");
    }

    fn parseStatement(self: *Parser) ParseError!void {
        const tok = self.lexer.token;

        if (tok.tag == .keyword and std.mem.eql(u8, tok.text, "export")) {
            self.lexer.next();
            if (self.lexer.token.tag == .keyword and std.mem.eql(u8, self.lexer.token.text, "function")) {
                try self.parseFunction(true);
            } else if (self.lexer.token.tag == .keyword and (std.mem.eql(u8, self.lexer.token.text, "let") or std.mem.eql(u8, self.lexer.token.text, "const") or std.mem.eql(u8, self.lexer.token.text, "var"))) {
                try self.parseVarDeclaration(true);
            } else {
                return ParseError.UnexpectedToken;
            }
            return;
        }

        if (tok.tag == .keyword and std.mem.eql(u8, tok.text, "function")) {
            try self.parseFunction(false);
            return;
        }

        if (tok.tag == .keyword and (std.mem.eql(u8, tok.text, "let") or std.mem.eql(u8, tok.text, "const") or std.mem.eql(u8, tok.text, "var"))) {
            try self.parseVarDeclaration(false);
            return;
        }

        if (tok.tag == .keyword and std.mem.eql(u8, tok.text, "return")) {
            try self.parseReturn();
            return;
        }

        if (tok.tag == .keyword and std.mem.eql(u8, tok.text, "if")) {
            try self.parseIf();
            return;
        }

        if (tok.tag == .keyword and std.mem.eql(u8, tok.text, "while")) {
            try self.parseWhile();
            return;
        }

        if (tok.tag == .punct and std.mem.eql(u8, tok.text, "{")) {
            try self.parseTopLevelBlock();
            return;
        }

        try self.parseExpressionStatement();
    }

    fn parseFunction(self: *Parser, export_fn: bool) ParseError!void {
        try self.expectKeyword("function");
        const name = try self.expectIdentifier();

        try self.writeIndent();
        try self.write("local function ");
        try self.write(name);
        try self.write("(");

        self.expectPunct("(") catch return ParseError.UnexpectedToken;
        var first_param = true;
        while (self.lexer.token.tag != .punct or !std.mem.eql(u8, self.lexer.token.text, ")")) {
            if (!first_param) {
                try self.write(", ");
            }
            first_param = false;
            const p = try self.expectIdentifier();
            try self.write(p);
            if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, ",")) {
                self.lexer.next();
            } else if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, ")")) {
                break;
            } else {
                return ParseError.UnexpectedToken;
            }
        }
        try self.write(")");
        try self.expectPunct(")");

        try self.write("\n");
        self.indent += 1;
        self.expectPunct("{") catch return ParseError.UnexpectedToken;
        while (self.lexer.token.tag != .punct or !std.mem.eql(u8, self.lexer.token.text, "}")) {
            if (self.lexer.token.tag == .eof) return ParseError.UnexpectedToken;
            try self.parseStatement();
        }
        self.lexer.next();
        self.indent -= 1;
        try self.writeIndent();
        try self.write("end\n");

        if (export_fn) {
            try self.write("exports.");
            try self.write(name);
            try self.write(" = ");
            try self.write(name);
            try self.write("\n");
        }
    }

    fn parseVarDeclaration(self: *Parser, _export: bool) ParseError!void {
        _ = _export;
        self.lexer.next();
        try self.writeIndent();
        while (true) {
            const name = try self.expectIdentifier();
            try self.write("local ");
            try self.write(name);
            if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, "=")) {
                self.lexer.next();
                try self.write(" = ");
                try self.parseExpression(self.out);
            }
            try self.write("\n");
            if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, ",")) {
                self.lexer.next();
                continue;
            }
            break;
        }
        self.eatSemicolon();
    }

    fn parseReturn(self: *Parser) ParseError!void {
        try self.expectKeyword("return");
        try self.writeIndent();
        try self.write("return ");
        if (self.lexer.token.tag != .punct or !std.mem.eql(u8, self.lexer.token.text, ";")) {
            try self.parseExpression(self.out);
        }
        try self.write("\n");
        self.eatSemicolon();
    }

    fn parseIf(self: *Parser) ParseError!void {
        try self.expectKeyword("if");
        try self.writeIndent();
        try self.write("if ");
        self.expectPunct("(") catch return ParseError.UnexpectedToken;
        try self.parseExpression(self.out);
        try self.expectPunct(")");
        try self.write(" then\n");
        self.indent += 1;
        if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, "{")) {
            self.lexer.next();
            while (self.lexer.token.tag != .punct or !std.mem.eql(u8, self.lexer.token.text, "}")) {
                try self.parseStatement();
            }
            self.lexer.next();
        } else {
            try self.parseStatement();
        }
        self.indent -= 1;
        try self.writeIndent();
        if (self.lexer.token.tag == .keyword and std.mem.eql(u8, self.lexer.token.text, "else")) {
            self.lexer.next();
            try self.write("else\n");
            self.indent += 1;
            if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, "{")) {
                self.lexer.next();
                while (self.lexer.token.tag != .punct or !std.mem.eql(u8, self.lexer.token.text, "}")) {
                    try self.parseStatement();
                }
                self.lexer.next();
            } else {
                try self.parseStatement();
            }
            self.indent -= 1;
            try self.writeIndent();
        }
        try self.write("end\n");
    }

    fn parseWhile(self: *Parser) ParseError!void {
        try self.expectKeyword("while");
        try self.writeIndent();
        try self.write("while ");
        self.expectPunct("(") catch return ParseError.UnexpectedToken;
        try self.parseExpression(self.out);
        try self.expectPunct(")");
        try self.write(" do\n");
        self.indent += 1;
        if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, "{")) {
            self.lexer.next();
            while (self.lexer.token.tag != .punct or !std.mem.eql(u8, self.lexer.token.text, "}")) {
                try self.parseStatement();
            }
            self.lexer.next();
        } else {
            try self.parseStatement();
        }
        self.indent -= 1;
        try self.writeIndent();
        try self.write("end\n");
    }

    fn parseTopLevelBlock(self: *Parser) ParseError!void {
        try self.writeIndent();
        try self.write("do\n");
        self.indent += 1;
        self.lexer.next();
        while (self.lexer.token.tag != .punct or !std.mem.eql(u8, self.lexer.token.text, "}")) {
            if (self.lexer.token.tag == .eof) return ParseError.UnexpectedToken;
            try self.parseStatement();
        }
        self.lexer.next();
        self.indent -= 1;
        try self.writeIndent();
        try self.write("end\n");
    }

    fn parseExpressionStatement(self: *Parser) ParseError!void {
        try self.writeIndent();
        try self.parseExpression(self.out);
        try self.write("\n");
        self.eatSemicolon();
    }

    fn parseExpression(self: *Parser, out: *std.array_list.Managed(u8)) ParseError!void {
        try self.parseAssignment(out);
    }

    fn parseAssignment(self: *Parser, out: *std.array_list.Managed(u8)) ParseError!void {
        var lhs = std.array_list.Managed(u8).init(self.alloc);
        defer lhs.deinit();
        try self.parseLogicalOr(&lhs);

        if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, "=")) {
            self.lexer.next();
            try out.appendSlice(lhs.items);
            try out.appendSlice(" = ");
            try self.parseAssignment(out);
        } else {
            try out.appendSlice(lhs.items);
        }
    }

    fn parseLogicalOr(self: *Parser, out: *std.array_list.Managed(u8)) ParseError!void {
        try self.parseLogicalAnd(out);
        while (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, "||")) {
            try out.appendSlice(" or ");
            self.lexer.next();
            try self.parseLogicalAnd(out);
        }
    }

    fn parseLogicalAnd(self: *Parser, out: *std.array_list.Managed(u8)) ParseError!void {
        try self.parseEquality(out);
        while (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, "&&")) {
            try out.appendSlice(" and ");
            self.lexer.next();
            try self.parseEquality(out);
        }
    }

    fn parseEquality(self: *Parser, out: *std.array_list.Managed(u8)) ParseError!void {
        try self.parseRelational(out);
        while (self.lexer.token.tag == .punct and
            (std.mem.eql(u8, self.lexer.token.text, "==") or
            std.mem.eql(u8, self.lexer.token.text, "===") or
            std.mem.eql(u8, self.lexer.token.text, "!=") or
            std.mem.eql(u8, self.lexer.token.text, "!==")))
        {
            const op = self.lexer.token.text;
            self.lexer.next();
            const luop = if (std.mem.eql(u8, op, "!=") or std.mem.eql(u8, op, "!==")) " ~=" else " ==";
            try out.appendSlice(luop);
            try out.appendSlice(" ");
            try self.parseRelational(out);
        }
    }

    fn parseRelational(self: *Parser, out: *std.array_list.Managed(u8)) ParseError!void {
        try self.parseAdditive(out);
        while (self.lexer.token.tag == .punct and
            (std.mem.eql(u8, self.lexer.token.text, "<") or
            std.mem.eql(u8, self.lexer.token.text, ">") or
            std.mem.eql(u8, self.lexer.token.text, "<=") or
            std.mem.eql(u8, self.lexer.token.text, ">=")))
        {
            const op = self.lexer.token.text;
            self.lexer.next();
            try out.appendSlice(" ");
            try out.appendSlice(op);
            try out.appendSlice(" ");
            try self.parseAdditive(out);
        }
    }

    fn parseAdditive(self: *Parser, out: *std.array_list.Managed(u8)) ParseError!void {
        try self.parseMultiplicative(out);
        while (self.lexer.token.tag == .punct and
            (std.mem.eql(u8, self.lexer.token.text, "+") or std.mem.eql(u8, self.lexer.token.text, "-")))
        {
            const op = self.lexer.token.text;
            self.lexer.next();
            try out.appendSlice(" ");
            try out.appendSlice(op);
            try out.appendSlice(" ");
            try self.parseMultiplicative(out);
        }
    }

    fn parseMultiplicative(self: *Parser, out: *std.array_list.Managed(u8)) ParseError!void {
        try self.parseUnary(out);
        while (self.lexer.token.tag == .punct and
            (std.mem.eql(u8, self.lexer.token.text, "*") or
            std.mem.eql(u8, self.lexer.token.text, "/") or
            std.mem.eql(u8, self.lexer.token.text, "%")))
        {
            const op = self.lexer.token.text;
            self.lexer.next();
            try out.appendSlice(" ");
            try out.appendSlice(op);
            try out.appendSlice(" ");
            try self.parseUnary(out);
        }
    }

    fn parseUnary(self: *Parser, out: *std.array_list.Managed(u8)) ParseError!void {
        if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, "!")) {
            self.lexer.next();
            try out.appendSlice("not ");
            try self.parseUnary(out);
            return;
        }
        if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, "-")) {
            self.lexer.next();
            try out.appendSlice("-");
            try self.parseUnary(out);
            return;
        }
        if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, "+")) {
            self.lexer.next();
            try out.appendSlice("+");
            try self.parseUnary(out);
            return;
        }
        try self.parseCallPostfix(out);
    }

    fn parseCallPostfix(self: *Parser, out: *std.array_list.Managed(u8)) ParseError!void {
        try self.parsePrimary(out);
        while (true) {
            if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, ".")) {
                self.lexer.next();
                const field = try self.expectIdentifier();
                if (std.mem.endsWith(u8, out.items, "eqjs") and isEqjsMethod(field)) {
                    try out.appendSlice(":");
                } else {
                    try out.appendSlice(".");
                }
                try out.appendSlice(field);
            } else if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, "[")) {
                try out.appendSlice("[");
                self.lexer.next();
                try self.parseExpression(out);
                try self.expectPunct("]");
                try out.appendSlice("]");
            } else if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, "(")) {
                try out.appendSlice("(");
                self.lexer.next();
                var first = true;
                while (self.lexer.token.tag != .punct or !std.mem.eql(u8, self.lexer.token.text, ")")) {
                    if (!first) try out.appendSlice(", ");
                    first = false;
                    try self.parseExpression(out);
                    if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, ",")) {
                        self.lexer.next();
                    } else if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, ")")) {
                        break;
                    } else {
                        return ParseError.UnexpectedToken;
                    }
                }
                try self.expectPunct(")");
                try out.appendSlice(")");
            } else {
                break;
            }
        }
    }

    fn parsePrimary(self: *Parser, out: *std.array_list.Managed(u8)) ParseError!void {
        const tok = self.lexer.token;
        switch (tok.tag) {
            .number, .string => {
                try out.appendSlice(tok.text);
                self.lexer.next();
            },
            .identifier => {
                if (std.mem.eql(u8, tok.text, "true") or std.mem.eql(u8, tok.text, "false")) {
                    try out.appendSlice(tok.text);
                } else {
                    try out.appendSlice(tok.text);
                }
                self.lexer.next();
            },
            .keyword => {
                if (std.mem.eql(u8, tok.text, "null") or std.mem.eql(u8, tok.text, "undefined")) {
                    try out.appendSlice("nil");
                    self.lexer.next();
                } else if (std.mem.eql(u8, tok.text, "this")) {
                    try out.appendSlice("...");
                    self.lexer.next();
                } else if (std.mem.eql(u8, tok.text, "new")) {
                    try self.parseNewExpression(out);
                } else {
                    return ParseError.UnexpectedToken;
                }
            },
            .punct => {
                if (std.mem.eql(u8, tok.text, "(")) {
                    self.lexer.next();
                    try self.parseExpression(out);
                    try self.expectPunct(")");
                } else if (std.mem.eql(u8, tok.text, "[")) {
                    try self.parseArrayLiteral(out);
                } else if (std.mem.eql(u8, tok.text, "{")) {
                    try self.parseObjectLiteral(out);
                } else {
                    return ParseError.UnexpectedToken;
                }
            },
            .eof => return ParseError.UnexpectedToken,
        }
    }

    fn parseArrayLiteral(self: *Parser, out: *std.array_list.Managed(u8)) ParseError!void {
        try out.appendSlice("{");
        self.lexer.next();
        var first = true;
        while (self.lexer.token.tag != .punct or !std.mem.eql(u8, self.lexer.token.text, "]")) {
            if (!first) try out.appendSlice(", ");
            first = false;
            try self.parseExpression(out);
            if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, ",")) {
                self.lexer.next();
            } else if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, "]")) {
                break;
            } else {
                return ParseError.UnexpectedToken;
            }
        }
        try self.expectPunct("]");
        try out.appendSlice("}");
    }

    fn parseObjectLiteral(self: *Parser, out: *std.array_list.Managed(u8)) ParseError!void {
        try out.appendSlice("eqjs:shape_object({");
        self.lexer.next();
        var first = true;
        while (self.lexer.token.tag != .punct or !std.mem.eql(u8, self.lexer.token.text, "}")) {
            if (!first) try out.appendSlice(", ");
            first = false;
            const key_tok = self.lexer.token;
            const key = key_tok.text;
            if (key_tok.tag != .identifier and key_tok.tag != .string and key_tok.tag != .number and key_tok.tag != .keyword) {
                return ParseError.UnexpectedToken;
            }
            self.lexer.next();
            if (self.lexer.token.tag != .punct or !std.mem.eql(u8, self.lexer.token.text, ":")) {
                return ParseError.UnexpectedToken;
            }
            self.lexer.next();
            switch (key_tok.tag) {
                .number => {
                    try out.appendSlice("[");
                    try out.appendSlice(key);
                    try out.appendSlice("] = ");
                },
                .string => {
                    try out.appendSlice("[");
                    try out.appendSlice(key);
                    try out.appendSlice("] = ");
                },
                .identifier, .keyword => {
                    try out.appendSlice("[\"");
                    try out.appendSlice(key);
                    try out.appendSlice("\"] = ");
                },
                else => return ParseError.UnexpectedToken,
            }
            try self.parseExpression(out);
            if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, ",")) {
                self.lexer.next();
            } else if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, "}")) {
                break;
            } else {
                return ParseError.UnexpectedToken;
            }
        }
        try self.expectPunct("}");
        try out.appendSlice("})");
    }

    fn parseNewExpression(self: *Parser, out: *std.array_list.Managed(u8)) ParseError!void {
        try self.expectKeyword("new");
        const ctor = try self.expectIdentifier();
        self.expectPunct("(") catch return ParseError.UnexpectedToken;
        const typed = mapTypedArrayName(ctor);
        if (typed) |ctype| {
            try out.appendSlice("eqjs:typed_array(\"");
            try out.appendSlice(ctype);
            try out.appendSlice("\", ");
            if (self.lexer.token.tag != .punct or !std.mem.eql(u8, self.lexer.token.text, ")")) {
                try self.parseExpression(out);
            } else {
                try out.appendSlice("0");
            }
            try self.expectPunct(")");
            try out.appendSlice(")");
        } else {
            try out.appendSlice("eqjs:new_object(\"");
            try out.appendSlice(ctor);
            try out.appendSlice("\", ");
            if (self.lexer.token.tag != .punct or !std.mem.eql(u8, self.lexer.token.text, ")")) {
                var first = true;
                while (self.lexer.token.tag != .punct or !std.mem.eql(u8, self.lexer.token.text, ")")) {
                    if (!first) try out.appendSlice(", ");
                    first = false;
                    try self.parseExpression(out);
                    if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, ",")) {
                        self.lexer.next();
                    } else if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, ")")) {
                        break;
                    } else {
                        return ParseError.UnexpectedToken;
                    }
                }
            }
            try self.expectPunct(")");
            try out.appendSlice(")");
        }
    }

    fn expectKeyword(self: *Parser, word: []const u8) ParseError!void {
        if (self.lexer.token.tag != .keyword or !std.mem.eql(u8, self.lexer.token.text, word)) {
            return ParseError.UnexpectedToken;
        }
        self.lexer.next();
    }

    fn eatSemicolon(self: *Parser) void {
        if (self.lexer.token.tag == .punct and std.mem.eql(u8, self.lexer.token.text, ";")) {
            self.lexer.next();
        }
    }

    fn reportError(self: *Parser, input_path: []const u8, err: anyerror) void {
        const tok = self.lexer.token;
        const start_col = tok.col;
        const end_col = if (tok.text.len == 0) tok.col else tok.col + tok.text.len - 1;
        var line_start: usize = 0;
        var line_end: usize = self.src.len;
        var current_line: usize = 1;
        var i: usize = 0;
        while (i < self.src.len) : (i += 1) {
            if (current_line == tok.line) {
                line_start = i;
                while (i < self.src.len and self.src[i] != '\n') : (i += 1) {}
                line_end = i;
                break;
            }
            if (self.src[i] == '\n') {
                current_line += 1;
            }
        }

        const line_text = self.src[line_start..line_end];
        std.debug.print(
            "EQJS parse error in {s}:{d}:{d}-{d}: {s}\n",
            .{ input_path, tok.line, start_col, end_col, @errorName(err) },
        );
        std.debug.print("  {s}\n", .{line_text});
        var caret: usize = 1;
        while (caret < start_col) : (caret += 1) {
            std.debug.print(" ", .{});
        }
        var span: usize = if (tok.text.len == 0) 1 else tok.text.len;
        while (span > 0) : (span -= 1) {
            std.debug.print("^", .{});
        }
        std.debug.print("\n", .{});
    }
};

fn mapTypedArrayName(name: []const u8) ?[]const u8 {
    const table = std.StaticStringMap([]const u8).initComptime(.{
        .{ "Float64Array", "double" },
        .{ "Float32Array", "float" },
        .{ "Int32Array", "int32_t" },
        .{ "Uint32Array", "uint32_t" },
        .{ "Int16Array", "int16_t" },
        .{ "Uint16Array", "uint16_t" },
        .{ "Int8Array", "int8_t" },
        .{ "Uint8Array", "uint8_t" },
        .{ "Uint8ClampedArray", "uint8_t" },
    });
    return table.get(name);
}

fn isEqjsMethod(name: []const u8) bool {
    return std.mem.eql(u8, name, "spawn_child") or
        std.mem.eql(u8, name, "typed_array") or
        std.mem.eql(u8, name, "new_object") or
        std.mem.eql(u8, name, "shape_object") or
        std.mem.eql(u8, name, "dict_object") or
        std.mem.eql(u8, name, "shape_hint") or
        std.mem.eql(u8, name, "shape_kind") or
        std.mem.eql(u8, name, "concat") or
        std.mem.eql(u8, name, "promote_shape") or
        std.mem.eql(u8, name, "object");
}

fn usage() void {
    std.debug.print("Usage:\n", .{});
    std.debug.print("  eqjs_transpiler <input.js> [output.lua]\n", .{});
    std.debug.print("  If output is omitted, transpiled Lua prints to stdout.\n", .{});
}

pub fn main() !void {
    const allocator = std.heap.page_allocator;
    const args = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, args);

    if (args.len < 2 or args.len > 3) {
        usage();
        return;
    }

    const fs = std.fs.cwd();
    const input_path = args[1];
    const src = try fs.readFileAlloc(allocator, input_path, std.math.maxInt(usize));
    defer allocator.free(src);

    var out = try std.array_list.Managed(u8).initCapacity(allocator, 4096);
    defer out.deinit();

    var parser = Parser.init(allocator, src, &out);
    parser.parseProgram() catch |err| {
        parser.reportError(input_path, err);
        std.process.exit(1);
    };

    if (args.len == 3) {
        try fs.writeFile(.{
            .sub_path = args[2],
            .data = out.items,
        });
    } else {
        std.debug.print("{s}", .{out.items});
    }
}
