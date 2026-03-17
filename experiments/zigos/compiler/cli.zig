//! ZigOS compiler — tsz build <file.tsz>
//! Compiles .tsz to generated_app.zig, then builds the binary.

const std = @import("std");
const codegen = @import("codegen.zig");
const lexer_mod = @import("lexer.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const alloc = gpa.allocator();

    const args = try std.process.argsAlloc(alloc);
    defer std.process.argsFree(alloc, args);

    if (args.len < 3) {
        std.debug.print("Usage: zigos-compiler build <file.tsz>\n", .{});
        return;
    }

    const input_path = args[2];

    const source = std.fs.cwd().readFileAlloc(alloc, input_path, 4 * 1024 * 1024) catch |err| {
        std.debug.print("Error reading {s}: {any}\n", .{ input_path, err });
        return;
    };
    defer alloc.free(source);

    // Extract .script.tsz imports as JS logic (before merging)
    const script_js = loadScriptImports(alloc, input_path, source);

    // Resolve imports (inlines .cls.tsz classifiers, .c.tsz components)
    const final_source = buildMergedSource(alloc, input_path, source);

    // Compile .tsz → Zig
    var lex = lexer_mod.Lexer.init(final_source);
    lex.tokenize();
    var gen = codegen.Generator.init(alloc, &lex, final_source, input_path);

    // If we found .script.tsz imports, set compute_js so codegen emits JS_LOGIC
    if (script_js) |js| {
        gen.compute_js = js;
    }
    const zig_source = gen.generate() catch |err| {
        std.debug.print("[tsz] Compile error: {}\n", .{err});
        return;
    };
    defer alloc.free(zig_source);

    // Write generated_app.zig
    const out_path = "generated_app.zig";
    {
        const f = std.fs.cwd().createFile(out_path, .{}) catch |err| {
            std.debug.print("Error creating {s}: {any}\n", .{ out_path, err });
            return;
        };
        defer f.close();
        f.writeAll(zig_source) catch return;
    }
    std.debug.print("[tsz] Compiled {s} -> {s}\n", .{ std.fs.path.basename(input_path), out_path });

    // Build binary
    std.debug.print("[tsz] Building...\n", .{});
    var child = std.process.Child.init(
        &.{ "zig", "build", "--build-file", "build.zig", "--prefix", "zig-out", "app" },
        alloc,
    );
    child.stderr_behavior = .Inherit;
    child.stdout_behavior = .Inherit;
    const term = child.spawnAndWait() catch |err| {
        std.debug.print("[tsz] Build failed to spawn: {}\n", .{err});
        return;
    };
    if (term.Exited != 0) {
        std.debug.print("[tsz] Build failed (exit {d})\n", .{term.Exited});
        return;
    }
    std.debug.print("[tsz] Built -> zig-out/bin/zigos-app\n", .{});
}

// ── Import resolution (from main.zig) ───────────────────────────

const MAX_IMPORTS = 32;

fn buildMergedSource(alloc: std.mem.Allocator, input_file: []const u8, source: []const u8) []const u8 {
    var paths: [MAX_IMPORTS][]const u8 = undefined;
    const path_count = findImportPaths(source, &paths);
    if (path_count == 0) return source;
    var visited: [MAX_IMPORTS][]const u8 = undefined;
    var visited_count: u32 = 0;
    var merged: std.ArrayListUnmanaged(u8) = .{};
    mergeImports(alloc, input_file, source, &visited, &visited_count, &merged);
    if (merged.items.len == 0) return source;
    return merged.items;
}

fn findImportPaths(source: []const u8, paths_out: *[MAX_IMPORTS][]const u8) u32 {
    var count: u32 = 0;
    var i: usize = 0;
    while (i < source.len and count < MAX_IMPORTS) {
        if (i + 6 < source.len and source[i] == 'f' and source[i + 1] == 'r' and source[i + 2] == 'o' and source[i + 3] == 'm' and source[i + 4] == ' ') {
            var j = i + 5;
            while (j < source.len and (source[j] == ' ' or source[j] == '\t')) j += 1;
            if (j < source.len and (source[j] == '\'' or source[j] == '"')) {
                const quote = source[j];
                j += 1;
                const path_start = j;
                while (j < source.len and source[j] != quote and source[j] != '\n') j += 1;
                if (j < source.len and source[j] == quote) {
                    paths_out[count] = source[path_start..j];
                    count += 1;
                }
                i = j + 1;
                continue;
            }
        }
        i += 1;
    }
    return count;
}

fn resolveImportPath(alloc: std.mem.Allocator, importer: []const u8, import_path: []const u8) ?[]const u8 {
    const dir = std.fs.path.dirname(importer) orelse ".";

    // Known suffix mappings: .cls → .cls.tsz, .c → .c.tsz, .script → .script.tsz
    const suffix_map = [_]struct { suffix: []const u8, ext: []const u8 }{
        .{ .suffix = ".cls", .ext = ".cls.tsz" },
        .{ .suffix = ".c", .ext = ".c.tsz" },
        .{ .suffix = ".script", .ext = ".script.tsz" },
    };
    for (suffix_map) |m| {
        if (std.mem.endsWith(u8, import_path, m.suffix)) {
            const base = import_path[0 .. import_path.len - m.suffix.len];
            const candidate = std.fmt.allocPrint(alloc, "{s}/{s}{s}", .{ dir, base, m.ext }) catch continue;
            if (std.fs.cwd().access(candidate, .{})) |_| return candidate else |_| {}
        }
    }

    // Try extensions in priority order
    const extensions = [_][]const u8{ ".tsz", ".c.tsz", ".app.tsz", ".mod.tsz", ".cls.tsz", ".script.tsz" };
    for (extensions) |ext| {
        const candidate = std.fmt.allocPrint(alloc, "{s}/{s}{s}", .{ dir, import_path, ext }) catch continue;
        if (std.fs.cwd().access(candidate, .{})) |_| return candidate else |_| {}
    }
    return std.fmt.allocPrint(alloc, "{s}/{s}.tsz", .{ dir, import_path }) catch null;
}

fn mergeImports(alloc: std.mem.Allocator, input_file: []const u8, source: []const u8, visited: *[MAX_IMPORTS][]const u8, visited_count: *u32, merged: *std.ArrayListUnmanaged(u8)) void {
    for (visited.*[0..visited_count.*]) |v| {
        if (std.mem.eql(u8, v, input_file)) return;
    }
    if (visited_count.* >= MAX_IMPORTS) return;
    visited.*[visited_count.*] = input_file;
    visited_count.* += 1;
    var paths: [MAX_IMPORTS][]const u8 = undefined;
    const path_count = findImportPaths(source, &paths);
    for (paths[0..path_count]) |raw_path| {
        const resolved = resolveImportPath(alloc, input_file, raw_path) orelse continue;
        // Skip .script.tsz — they're JS, handled separately via loadScriptImports
        if (std.mem.endsWith(u8, resolved, ".script.tsz")) continue;
        const imp_source = std.fs.cwd().readFileAlloc(alloc, resolved, 1024 * 1024) catch continue;
        mergeImports(alloc, resolved, imp_source, visited, visited_count, merged);
    }
    merged.appendSlice(alloc, source) catch {};
    merged.append(alloc, '\n') catch {};
}

/// Load all .script.tsz imports and concatenate their contents as JS_LOGIC.
fn loadScriptImports(alloc: std.mem.Allocator, input_file: []const u8, source: []const u8) ?[]const u8 {
    var paths: [MAX_IMPORTS][]const u8 = undefined;
    const path_count = findImportPaths(source, &paths);
    var js: std.ArrayListUnmanaged(u8) = .{};

    for (paths[0..path_count]) |raw_path| {
        const resolved = resolveImportPath(alloc, input_file, raw_path) orelse continue;
        if (!std.mem.endsWith(u8, resolved, ".script.tsz")) continue;
        const content = std.fs.cwd().readFileAlloc(alloc, resolved, 1024 * 1024) catch continue;
        js.appendSlice(alloc, content) catch continue;
        js.append(alloc, '\n') catch {};
    }

    if (js.items.len == 0) return null;
    return js.items;
}
