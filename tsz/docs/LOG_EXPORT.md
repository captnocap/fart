# Log Export — framework/log_export.zig

Reusable framework module for formatting and exporting structured log data. Any .tsz app can use it.

## Formats

| Format | Extension | Use case |
|--------|-----------|----------|
| `json` | `.json` | Machine-readable, API consumption, re-import |
| `md` | `.md` | Human-readable reports, sharing in docs/PRs |
| `txt` | `.txt` | Quick inspection, grep-friendly |
| `csv` | `.csv` | Spreadsheet import, data analysis |

## Zig API

```zig
const log_export = @import("log_export.zig");

// Define entries
const entries = [_]log_export.LogEntry{
    .{
        .timestamp = "2026-03-22T14:32:07Z",
        .level = .err,
        .source = "layout.zig",
        .message = "RSS exceeded 512MB",
        .metadata = "peak_rss=519MB leak_rate=204MB/s",
    },
};

// Write to file
try log_export.exportToFile(&entries, .json, "/tmp/crash.json");

// Write to buffer (for clipboard)
var buf: [65536]u8 = undefined;
const len = try log_export.exportToBuffer(&entries, .txt, &buf);
const text = buf[0..len];

// Write to stdout
try log_export.exportToStdout(&entries, .md);

// Write to any writer (generic)
try log_export.format(&entries, .csv, my_writer);
```

## Types

### `LogEntry`

```zig
pub const LogEntry = struct {
    timestamp: []const u8 = "",   // ISO 8601
    level: Level = .info,
    source: []const u8 = "",      // origin module/file
    message: []const u8 = "",
    metadata: []const u8 = "",    // extra context
};
```

All slices are borrowed. Caller owns the memory.

### `Level`

`debug`, `info`, `warn`, `err`, `fatal`

- `Level.label()` returns uppercase string (`"ERROR"`)
- `Level.fromString("error")` parses from string (case-insensitive first char)

### `Format`

`json`, `md`, `txt`, `csv`

- `Format.fromString("json")` parses (also accepts `"markdown"`, `"text"`)
- `Format.extension()` returns file extension (`.json`, `.md`, etc.)

## QuickJS Bridge

To expose to .tsz apps, register a host function in `qjs_runtime.zig`:

```javascript
// From a .tsz <script> block:
__log_export(entries_json, 'json', '/tmp/output.json');
```

The bridge function should:
1. Receive a JS array of entry objects
2. Extract fields into `LogEntry` structs
3. Call `log_export.exportToFile()` or `log_export.exportToBuffer()`
4. Return the result (bytes written or success status)

## Used by tsz-tools

- **Dashboard** — export build log panel contents
- **BsodViewer** — export crash report details
- **Inspector** — export console output

## Output Examples

### Plain text
```
[ERROR] 2026-03-22T14:32:07Z (layout.zig): RSS exceeded 512MB
  metadata: peak_rss=519MB
```

### JSON
```json
[
  {
    "timestamp": "2026-03-22T14:32:07Z",
    "level": "ERROR",
    "source": "layout.zig",
    "message": "RSS exceeded 512MB",
    "metadata": "peak_rss=519MB"
  }
]
```

### CSV
```csv
timestamp,level,source,message,metadata
2026-03-22T14:32:07Z,ERROR,layout.zig,RSS exceeded 512MB,peak_rss=519MB
```
