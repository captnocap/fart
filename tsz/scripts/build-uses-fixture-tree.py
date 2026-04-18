#!/usr/bin/env python3
"""
build-uses-fixture-tree.py — build a nested namespace object from the
minimal `<uses>` conformance fixtures and resolve the references they
contain.

This is intentionally small and boring. It exists to prove the address
model on a handful of dummy files before anyone tries to solve the full
compiler namespace in one move.

Default fixture root:
  tsz/tests/conformance/uses_addressing

Usage:
  tsz/scripts/build-uses-fixture-tree.py
  tsz/scripts/build-uses-fixture-tree.py tsz/tests/conformance/uses_addressing
  tsz/scripts/build-uses-fixture-tree.py --json-only
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

DOC_OPEN_PREFIX = "<~!"
DOC_OPEN_RE = re.compile(r"<~![^>]*>")
DOC_CLOSE = "<!~>"
DOC_CLOSE_LEN = len(DOC_CLOSE)
ROOT_IDENT = r"[a-z_][A-Za-z0-9_]*"
LEAF_IDENT = r"[A-Za-z_][A-Za-z0-9_]*"

TOP_TAG_BODY_RE = re.compile(r"<([^<>/][^<>]*?)>")
FILE_KIND_WORDS = frozenset(
    {
        "app",
        "widget",
        "page",
        "component",
        "module",
        "lib",
        "cli",
        "doc",
        "effect",
        "effects",
        "glyph",
        "glyphs",
        "fixture",
        "test",
        "tokens",
        "colors",
    }
)
VAR_DECL_RE = re.compile(rf"^\s*({ROOT_IDENT})\s+(is|exact)\s+(.+?)\s*$")
BARE_VAR_RE = re.compile(rf"^\s*({ROOT_IDENT})\s*$")
FUNCTION_HEADER_RE = re.compile(
    rf"^(\s*)({ROOT_IDENT}(?:\.{LEAF_IDENT})*)"
    r"(?:\(([^)]*)\))?\s*:\s*$"
)
REF_RE = re.compile(rf"(?<![\w.])({ROOT_IDENT})\.({LEAF_IDENT})\b")
USES_OPEN_RE = re.compile(rf"^\s*<({ROOT_IDENT})\s+has>\s*$")
USES_CLOSE_RE = re.compile(rf"^\s*</({ROOT_IDENT})>\s*$")
DOTTED_BIND_RE = re.compile(rf"^({ROOT_IDENT})\.({LEAF_IDENT})$")
FOR_BIND_RE = re.compile(
    rf"<for\s+[^<>]*?\s+as\s+({ROOT_IDENT})"
    rf"(?:\s*,\s*({ROOT_IDENT}))?"
    rf"(?:\s+({ROOT_IDENT}))?"
    rf"(?:\s+at\s+({ROOT_IDENT}))?"
    r"\s*>"
)
IF_AS_RE = re.compile(rf"<if\s+[^<>]*\s+as\s+({ROOT_IDENT})\s*>")
LOCAL_FIELD_WRITE_RE = re.compile(rf"^\s*({ROOT_IDENT})\.{LEAF_IDENT}(?:\.{LEAF_IDENT})*\s+(is|exact)\b")

SCALAR_TYPE_NAMES = frozenset(
    {
        "string",
        "number",
        "bool",
        "boolean",
        "true",
        "false",
        "null",
        "any",
    }
)
ARRAY_BUILDER_METHODS = frozenset({"push", "join", "concat"})
AMBIENT_ROOTS = frozenset(
    {
        "api",
        "array",
        "agent_spawner",
        "bit",
        "cli_runtime",
        "cli",
        "command_executor",
        "crypto",
        "ctx",
        "ctx_e",
        "db",
        "device",
        "dispatch",
        "eprint",
        "fs",
        "globalThis",
        "git",
        "forge",
        "heartbeat",
        "host",
        "input",
        "json",
        "lifecycle",
        "llama_exports",
        "locale",
        "lua",
        "luajit_runtime",
        "manager",
        "math",
        "object",
        "privacy",
        "print",
        "props",
        "qjs",
        "qjs_runtime",
        "recorder",
        "shell",
        "std",
        "string",
        "supervisor_db",
        "sys",
        "time",
        "date",
        "zig",
        "zip",
    }
)
IMPLICIT_SCOPE_ROOTS = frozenset({"item", "other", "self", "event", "entry", "e"})


def blank_docs(lines: list[str]) -> list[str]:
    """Blank <~!...<!~> spans while preserving line/column shape."""
    out_lines: list[str] = []
    in_doc = False

    for raw in lines:
        i = 0
        n = len(raw)
        in_single = False
        in_double = False
        out: list[str] = []

        while i < n:
            if in_doc:
                close_at = raw.find(DOC_CLOSE, i)
                if close_at == -1:
                    out.append(" " * (n - i))
                    i = n
                    break
                out.append(" " * (close_at - i + DOC_CLOSE_LEN))
                i = close_at + DOC_CLOSE_LEN
                in_doc = False
                continue

            ch = raw[i]
            if in_single:
                out.append(ch)
                if ch == "\\" and i + 1 < n:
                    out.append(raw[i + 1])
                    i += 2
                    continue
                if ch == "'":
                    in_single = False
                i += 1
                continue

            if in_double:
                out.append(ch)
                if ch == "\\" and i + 1 < n:
                    out.append(raw[i + 1])
                    i += 2
                    continue
                if ch == '"':
                    in_double = False
                i += 1
                continue

            if ch == "'":
                in_single = True
                out.append(ch)
                i += 1
                continue

            if ch == '"':
                in_double = True
                out.append(ch)
                i += 1
                continue

            if raw.startswith(DOC_OPEN_PREFIX, i):
                open_match = DOC_OPEN_RE.match(raw, i)
                if open_match:
                    open_len = open_match.end() - i
                    close_at = raw.find(DOC_CLOSE, i + open_len)
                    if close_at == -1:
                        out.append(" " * (n - i))
                        i = n
                        in_doc = True
                        break
                    out.append(" " * (close_at - i + DOC_CLOSE_LEN))
                    i = close_at + DOC_CLOSE_LEN
                    continue

            out.append(ch)
            i += 1

        out_lines.append("".join(out))

    return out_lines


def strip_comments(line: str) -> str:
    """Remove // comments while respecting quoted strings."""
    i = 0
    in_single = False
    in_double = False

    while i < len(line) - 1:
        ch = line[i]
        if ch == "\\":
            i += 2
            continue
        if ch == "'" and not in_double:
            in_single = not in_single
        elif ch == '"' and not in_single:
            in_double = not in_double
        elif not in_single and not in_double and ch == "/" and line[i + 1] == "/":
            return line[:i]
        i += 1

    return line


def sanitize_lines(content: str) -> list[str]:
    raw_lines = content.splitlines()
    return [strip_comments(line) for line in blank_docs(raw_lines)]


def blank_strings(line: str) -> str:
    """Blank quoted string contents so dotted refs inside literals do not scan."""
    i = 0
    n = len(line)
    out: list[str] = []
    in_single = False
    in_double = False

    while i < n:
        ch = line[i]
        if in_single:
            out.append(" " if ch != "'" else ch)
            if ch == "\\" and i + 1 < n:
                out.append(" ")
                i += 2
                continue
            if ch == "'":
                in_single = False
            i += 1
            continue

        if in_double:
            out.append(" " if ch != '"' else ch)
            if ch == "\\" and i + 1 < n:
                out.append(" ")
                i += 2
                continue
            if ch == '"':
                in_double = False
            i += 1
            continue

        if ch == "'":
            in_single = True
            out.append(ch)
            i += 1
            continue

        if ch == '"':
            in_double = True
            out.append(ch)
            i += 1
            continue

        out.append(ch)
        i += 1

    return "".join(out)


def parse_outer_tag_from_raw(content: str) -> tuple[str | None, str | None]:
    for raw in content.splitlines():
        for match in TOP_TAG_BODY_RE.finditer(raw):
            words = match.group(1).strip().split()
            if len(words) >= 2 and words[-1] in FILE_KIND_WORDS:
                top_kind = words[-1]
                top_name = "_".join(words[:-1])
                if top_name:
                    return top_name, top_kind
    return None, None


def derive_name_kind_from_path(path: Path) -> tuple[str, str]:
    parts = path.name.split(".")
    if len(parts) >= 3 and parts[-1] == "fart":
        name_parts = parts[:-2]
        kind = parts[-2]
    else:
        name_parts = [path.stem]
        kind = "synthetic"

    name = "_".join(part.replace("-", "_") for part in name_parts if part)
    if not name:
        name = path.stem.replace("-", "_")
    return name, kind


def parse_var_decl(line: str) -> dict[str, str] | None:
    match = VAR_DECL_RE.match(line)
    if match:
        name, binding, value = match.groups()
        source_root = ""
        source_leaf = ""
        dotted_bind = DOTTED_BIND_RE.match(value)
        if dotted_bind:
            source_root, source_leaf = dotted_bind.groups()
        if binding == "is" and value == "array":
            kind = "array"
            contract = "bare"
        elif binding == "is" and value == "object":
            kind = "object"
            contract = "bare"
        elif binding == "is" and value == "objects":
            kind = "objects"
            contract = "bare"
        elif binding == "is" and value.endswith(" array"):
            kind = "array"
            contract = value
        elif binding == "is" and value and value[:1].isupper():
            kind = "typed-record"
            contract = value
        elif binding == "is" and value in SCALAR_TYPE_NAMES:
            kind = "scalar"
            contract = value
        else:
            kind = "value"
            contract = value
        return {
            "name": name,
            "binding": binding,
            "value": value,
            "kind": kind,
            "contract": contract,
            "source_root": source_root,
            "source_leaf": source_leaf,
        }

    match = BARE_VAR_RE.match(line)
    if match:
        name = match.group(1)
        return {
            "name": name,
            "binding": "bare",
            "value": "",
            "kind": "bare",
            "contract": "bare",
            "source_root": "",
            "source_leaf": "",
        }

    return None


def split_params(raw_params: str | None) -> list[str]:
    if not raw_params:
        return []
    return [part for part in re.split(r"[\s,]+", raw_params.strip()) if part]


def singularize(name: str) -> str:
    if name.endswith("ies") and len(name) > 3:
        return name[:-3] + "y"
    if name.endswith("ses") and len(name) > 3:
        return name[:-2]
    if name.endswith("s") and len(name) > 1:
        return name[:-1]
    return name


def add_state_aliases(scope_map: dict[str, dict], address_prefix: str) -> dict[str, dict]:
    expanded = dict(scope_map)
    for name, decl in list(scope_map.items()):
        if not name.startswith("set_") or len(name) <= 4:
            continue
        read_name = name[4:]
        if read_name in expanded:
            continue
        expanded[read_name] = {
            "name": read_name,
            "binding": "state-read",
            "value": decl.get("value", ""),
            "kind": decl.get("kind", "value"),
            "contract": decl.get("contract", ""),
            "address": f"{address_prefix}.state.{read_name}",
        }
    return expanded


def parse_for_bindings(line: str) -> tuple[str | None, str | None]:
    match = FOR_BIND_RE.search(line)
    if not match:
        return None, None

    first_name, comma_name, space_name, at_name = match.groups()
    if comma_name:
        return first_name, at_name or comma_name
    if at_name:
        return first_name, at_name
    if space_name:
        return space_name, first_name
    return first_name, None


def collect_function_locals(
    body_entries: list[dict],
    fn_params: list[str],
    fn_address: str,
    fn_name: str,
) -> dict[str, dict]:
    locals_map: dict[str, dict] = {
        param: {
            "name": param,
            "binding": "param",
            "value": "",
            "kind": "param",
            "contract": "param",
            "address": f"{fn_address}.locals.{param}",
        }
        for param in fn_params
    }

    if "." in fn_name:
        owner_root = fn_name.split(".", 1)[0]
        locals_map[owner_root] = {
            "name": owner_root,
            "binding": "method-root",
            "value": "",
            "kind": "binding",
            "contract": "method-root",
            "address": f"{fn_address}.locals.{owner_root}",
        }

    def add_local(name: str, binding: str, value: str, kind: str, contract: str) -> None:
        if not name or name in locals_map:
            return
        locals_map[name] = {
            "name": name,
            "binding": binding,
            "value": value,
            "kind": kind,
            "contract": contract,
            "address": f"{fn_address}.locals.{name}",
        }

    for entry in body_entries:
        line = entry["text"]

        for implicit in IMPLICIT_SCOPE_ROOTS:
            if re.search(rf"(?<![\w.]){re.escape(implicit)}\.", line):
                add_local(implicit, "implicit", "implicit-scope", "binding", "implicit-scope")

        if_match = IF_AS_RE.search(line)
        if if_match:
            name = if_match.group(1)
            add_local(name, "binding", "if-as", "binding", "if-as")

        item_name, index_name = parse_for_bindings(line)
        if item_name or index_name:
            if item_name:
                add_local(item_name, "binding", "for-as", "binding", "for-as")
            else:
                implicit = re.search(r"<for\s+([a-z_][a-z0-9_]*)\b", line)
                if implicit:
                    add_local(
                        singularize(implicit.group(1)),
                        "binding",
                        "for-implicit",
                        "binding",
                        "for-implicit",
                    )
            if index_name:
                add_local(index_name, "binding", "for-at", "binding", "for-at")

        decl = parse_var_decl(line)
        if decl:
            add_local(
                decl["name"],
                decl["binding"],
                decl["value"],
                decl["kind"],
                decl["contract"],
            )
            continue

        field_write = LOCAL_FIELD_WRITE_RE.match(line)
        if field_write:
            name = field_write.group(1)
            add_local(name, "field-root", "", "object-root", "field-root")

    return add_state_aliases(locals_map, fn_address)


def parse_fixture_file(path: Path, root_name: str) -> dict:
    content = path.read_text(encoding="utf-8")
    lines = sanitize_lines(content)

    top_name, top_kind = parse_outer_tag_from_raw(content)
    uses: list[str] = []
    use_contracts: dict[str, dict] = {}
    vars_map: dict[str, dict] = {}
    functions: dict[str, dict] = {}

    in_uses = False
    current_use: str | None = None
    in_var = False
    in_functions = False
    current_function: dict | None = None
    current_function_indent = 0

    for raw in lines:
        stripped = raw.strip()
        if not stripped:
            continue

        if top_name is None:
            top_match = TOP_TAG_BODY_RE.match(stripped)
            if top_match:
                words = top_match.group(1).strip().split()
                if len(words) >= 2 and words[-1] in FILE_KIND_WORDS:
                    top_kind = words[-1]
                    top_name = "_".join(words[:-1])
                    if not top_name:
                        top_kind = None
                        top_name = None
                        continue
                continue

        if stripped == "<uses>":
            in_uses = True
            current_use = None
            continue
        if stripped == "</uses>":
            in_uses = False
            current_use = None
            continue
        if stripped == "<var>":
            in_var = True
            continue
        if stripped == "</var>":
            in_var = False
            continue
        if stripped == "<functions>":
            in_functions = True
            continue
        if stripped == "</functions>":
            in_functions = False
            current_function = None
            continue

        if in_uses:
            open_use = USES_OPEN_RE.match(stripped)
            if open_use:
                current_use = open_use.group(1)
                if current_use not in use_contracts:
                    use_contracts[current_use] = {"members": [], "legacy": False}
                if current_use not in uses:
                    uses.append(current_use)
                continue
            close_use = USES_CLOSE_RE.match(stripped)
            if close_use:
                current_use = None
                continue
            if stripped.startswith("<") and stripped.endswith(">"):
                continue
            if current_use is not None:
                use_contracts[current_use]["members"].append(stripped)
                continue
            if stripped not in uses:
                uses.append(stripped)
            if stripped not in use_contracts:
                use_contracts[stripped] = {"members": [], "legacy": True}
            continue

        if in_var:
            if stripped.startswith("<") and stripped.endswith(">"):
                continue
            decl = parse_var_decl(stripped)
            if decl:
                decl["address"] = f"{root_name}.{top_name}.var.{decl['name']}"
                vars_map[decl["name"]] = decl
            continue

        if in_functions:
            header_match = FUNCTION_HEADER_RE.match(raw)
            if header_match:
                indent, fn_name, raw_params = header_match.groups()
                current_function_indent = len(indent)
                current_function = {
                    "name": fn_name,
                    "params": split_params(raw_params),
                    "body": [],
                    "address": f"{root_name}.{top_name}.functions.{fn_name}",
                }
                functions[fn_name] = current_function
                continue

            if current_function is not None:
                this_indent = len(raw) - len(raw.lstrip(" "))
                if this_indent > current_function_indent:
                    current_function["body"].append(
                        {
                            "text": stripped,
                            "indent": this_indent,
                        }
                    )
                    continue

                current_function = None
                header_match = FUNCTION_HEADER_RE.match(raw)
                if header_match:
                    indent, fn_name, raw_params = header_match.groups()
                    current_function_indent = len(indent)
                    current_function = {
                        "name": fn_name,
                        "params": split_params(raw_params),
                        "body": [],
                        "address": f"{root_name}.{top_name}.functions.{fn_name}",
                    }
                    functions[fn_name] = current_function

    synthetic = False
    if top_name is None or top_kind is None:
        top_name, top_kind = derive_name_kind_from_path(path)
        synthetic = True

    vars_map = add_state_aliases(vars_map, f"{root_name}.{top_name}")

    for fn in functions.values():
        fn["locals"] = collect_function_locals(
            fn["body"],
            fn["params"],
            fn["address"],
            fn["name"],
        )

    function_exports = {}
    for fn_name, fn in functions.items():
        export_name = fn_name.split(".")[-1]
        if export_name not in function_exports:
            function_exports[export_name] = fn

    return {
        "name": top_name,
        "kind": top_kind,
        "synthetic": synthetic,
        "path": str(path),
        "address": f"{root_name}.{top_name}",
        "uses": uses,
        "use_contracts": use_contracts,
        "var": vars_map,
        "functions": functions,
        "function_exports": function_exports,
    }


def build_tree(modules: list[dict], root_name: str) -> dict:
    root = {
        "_kind": "root",
        "_address": root_name,
        "_ambients": {
            name: {
                "_kind": "ambient",
                "_address": f"{root_name}._ambient.{name}",
            }
            for name in sorted(AMBIENT_ROOTS)
        },
        "_children": {},
    }

    for mod in modules:
        function_exports = {}
        for fn_name, fn in mod["functions"].items():
            export_name = fn_name.split(".")[-1]
            if export_name not in function_exports:
                function_exports[export_name] = fn
        root["_children"][mod["name"]] = {
            "_kind": mod["kind"],
            "_address": mod["address"],
            "_path": mod["path"],
            "_synthetic": mod.get("synthetic", False),
            "_uses": {
                name: {
                    "address": f"{root_name}.{name}",
                    "members": list(mod.get("use_contracts", {}).get(name, {}).get("members", [])),
                    "legacy": bool(mod.get("use_contracts", {}).get(name, {}).get("legacy", False)),
                }
                for name in mod["uses"]
            },
            "var": {
                name: {
                    "address": decl["address"],
                    "binding": decl["binding"],
                    "kind": decl["kind"],
                    "contract": decl["contract"],
                    "value": decl["value"],
                    "source_root": decl.get("source_root", ""),
                    "source_leaf": decl.get("source_leaf", ""),
                }
                for name, decl in mod["var"].items()
            },
            "functions": {
                name: {
                    "address": fn["address"],
                    "params": fn["params"],
                    "locals": {
                        local_name: {
                            "address": decl["address"],
                            "kind": decl["kind"],
                            "contract": decl["contract"],
                            "binding": decl["binding"],
                            "source_root": decl.get("source_root", ""),
                            "source_leaf": decl.get("source_leaf", ""),
                        }
                        for local_name, decl in fn.get("locals", {}).items()
                    },
                }
                for name, fn in mod["functions"].items()
            },
            "function_exports": function_exports,
        }

    return {root_name: root}


def extract_references(module: dict) -> list[dict]:
    refs: list[dict] = []
    seen: set[tuple[str, str]] = set()

    for decl_name, decl in module["var"].items():
        if not decl.get("source_root") or not decl.get("source_leaf"):
            continue
        key = ("var", f"{decl_name}={decl['source_root']}.{decl['source_leaf']}")
        if key in seen:
            continue
        seen.add(key)
        refs.append(
            {
                "function": "var",
                "from": decl["address"],
                "reference": f"{decl_name} = {decl['source_root']}.{decl['source_leaf']}",
                "root": decl_name,
                "leaf": "",
                "line": f"{decl_name} is {decl['source_root']}.{decl['source_leaf']}",
                "mode": "var-alias",
                "source_root": decl["source_root"],
                "source_leaf": decl["source_leaf"],
            }
        )

    for fn_name, fn in module["functions"].items():
        alias_vars = {
            name: decl
            for name, decl in fn.get("locals", {}).items()
            if decl.get("source_root") and decl.get("source_leaf")
        }
        alias_vars.update(
            {
                name: decl
                for name, decl in module["var"].items()
                if decl.get("source_root") and decl.get("source_leaf")
            }
        )
        for entry in fn["body"]:
            line = entry["text"]
            masked_line = blank_strings(line)
            for match in REF_RE.finditer(masked_line):
                root, leaf = match.groups()
                key = (fn_name, f"{root}.{leaf}")
                if key in seen:
                    continue
                seen.add(key)
                refs.append(
                    {
                        "function": fn_name,
                        "from": fn["address"],
                        "reference": f"{root}.{leaf}",
                        "root": root,
                        "leaf": leaf,
                        "line": line,
                        "mode": "dotted",
                    }
                )
            for alias_name, alias_decl in alias_vars.items():
                if not re.search(rf"(?<![\w.]){re.escape(alias_name)}\s*\(", masked_line):
                    continue
                key = (fn_name, f"{alias_name}()")
                if key in seen:
                    continue
                seen.add(key)
                refs.append(
                    {
                        "function": fn_name,
                        "from": fn["address"],
                        "reference": f"{alias_name}()",
                        "root": alias_name,
                        "leaf": "",
                        "line": line,
                        "mode": "alias-call",
                        "source_root": alias_decl["source_root"],
                        "source_leaf": alias_decl["source_leaf"],
                    }
                )

    return refs


def resolve_use_member(
    module: dict,
    target_root: str,
    target_leaf: str,
    global_modules: dict[str, dict],
    root_name: str,
    trace: list[str],
    detail_prefix: str = "",
) -> dict:
    trace.extend([f"uses[{target_root}]", root_name, target_root])
    target = global_modules.get(target_root)
    if target is None:
        return {
            "status": "fail",
            "error": "missing-used-module",
            "trace": trace,
            "detail": f"`{target_root}` is listed in `<uses>` but no such module exists",
        }

    use_contract = module.get("use_contracts", {}).get(target_root, {})
    if use_contract.get("legacy"):
        return {
            "status": "fail",
            "error": "legacy-uses-entry",
            "trace": trace,
            "detail": f"`{target_root}` is listed in `<uses>` without a `<{target_root} has>` member contract",
        }

    allowed_members = set(use_contract.get("members", []))
    if target_leaf not in allowed_members:
        trace.append(target_leaf)
        return {
            "status": "fail",
            "error": "undeclared-used-member",
            "trace": trace,
            "detail": f"`{target_leaf}` is not declared under `<{target_root} has>`",
        }

    exported = target.get("function_exports", {}).get(target_leaf)
    if exported is not None:
        trace.extend(["functions", exported["address"].split(".")[-1]])
        prefix = detail_prefix.strip()
        if prefix:
            detail = f"{prefix} resolved through `<uses>` into `{target_root}.{target_leaf}`"
        else:
            detail = f"resolved through `<uses>` into `{target_root}.{target_leaf}`"
        return {
            "status": "ok",
            "trace": trace,
            "to": exported["address"],
            "detail": detail,
        }

    if target_leaf in target["var"]:
        trace.extend(["var", target_leaf])
        return {
            "status": "fail",
            "error": "file-private",
            "trace": trace,
            "detail": f"`{target_leaf}` lives in `{target_root}`'s private `<var>` scope",
        }

    trace.append(target_leaf)
    return {
        "status": "fail",
        "error": "unresolved-segment",
        "trace": trace,
        "detail": f"`{target_root}` is reachable, but `{target_leaf}` is not exposed there",
    }


def resolve_reference(module: dict, reference: dict, global_modules: dict[str, dict], root_name: str) -> dict:
    root = reference["root"]
    leaf = reference["leaf"]
    trace = [root_name, module["name"]]
    function_meta = module["functions"].get(reference["function"], {})
    local_scope = function_meta.get("locals", {})
    mode = reference.get("mode", "dotted")

    if root in module["var"]:
        trace.extend(["var", root])
        decl = module["var"][root]
        if mode in {"alias-call", "var-alias"} and decl.get("source_root") and decl.get("source_leaf"):
            trace.append("alias")
            return resolve_use_member(
                module,
                decl["source_root"],
                decl["source_leaf"],
                global_modules,
                root_name,
                trace,
                detail_prefix=f"local alias `{root}`",
            )
        if decl["kind"] == "array" and decl["contract"] == "bare" and leaf in ARRAY_BUILDER_METHODS:
            return {
                "status": "fail",
                "error": "bare-array-contract",
                "trace": trace,
                "detail": f"`{root} is array` has no stable element contract",
            }
        return {
            "status": "local",
            "trace": trace,
            "detail": f"local var `{root}` is not part of cross-file `<uses>` resolution",
        }

    if root in module["functions"]:
        trace.extend(["functions", root])
        return {
            "status": "local",
            "trace": trace,
            "detail": f"local function `{root}` resolves inside the file namespace",
        }

    if root in local_scope:
        trace.extend(["functions", reference["function"], "locals", root])
        decl = local_scope[root]
        if mode == "alias-call" and decl.get("source_root") and decl.get("source_leaf"):
            trace.append("alias")
            return resolve_use_member(
                module,
                decl["source_root"],
                decl["source_leaf"],
                global_modules,
                root_name,
                trace,
                detail_prefix=f"local alias `{root}`",
            )
        if decl["kind"] == "array" and decl["contract"] == "bare" and leaf in ARRAY_BUILDER_METHODS:
            return {
                "status": "fail",
                "error": "bare-array-contract",
                "trace": trace,
                "detail": f"`{root} is array` has no stable element contract",
            }
        return {
            "status": "local",
            "trace": trace,
            "detail": f"local `{root}` resolves inside `{reference['function']}`",
        }

    if root in module["uses"]:
        return resolve_use_member(module, root, leaf, global_modules, root_name, trace)

    if root in AMBIENT_ROOTS:
        trace.extend(["_ambient", root, leaf])
        return {
            "status": "ok",
            "trace": trace,
            "to": f"{root_name}._ambient.{root}.{leaf}",
            "detail": f"`{root}` resolves as an ambient namespace root",
        }

    if root in global_modules:
        trace.append(root)
        return {
            "status": "fail",
            "error": "missing-uses-edge",
            "trace": trace,
            "detail": f"`{root}` exists globally, but `{module['name']}` has no `<uses>` edge to it",
        }

    trace.append(root)
    return {
        "status": "fail",
        "error": "unknown-root",
        "trace": trace,
        "detail": f"`{root}` does not exist in the fixture namespace",
    }


def summarize(modules: list[dict], root_name: str) -> dict:
    global_modules = {module["name"]: module for module in modules}
    tree = build_tree(modules, root_name)
    references = []
    counts = {"ok": 0, "fail": 0, "local": 0}
    error_counts: Counter[str] = Counter()
    unknown_root_counts: Counter[str] = Counter()

    for module in modules:
        for reference in extract_references(module):
            resolution = resolve_reference(module, reference, global_modules, root_name)
            counts[resolution["status"]] = counts.get(resolution["status"], 0) + 1
            if resolution["status"] == "fail":
                error = resolution.get("error", "unknown")
                error_counts[error] += 1
                if error == "unknown-root":
                    unknown_root_counts[reference["root"]] += 1
            references.append(
                {
                    "module": module["name"],
                    "function": reference["function"],
                    "from": reference["from"],
                    "reference": reference["reference"],
                    "line": reference["line"],
                    "resolution": resolution,
                }
            )

    return {
        "root": root_name,
        "tree": tree,
        "module_count": len(modules),
        "synthetic_module_count": sum(1 for module in modules if module.get("synthetic")),
        "summary": counts,
        "error_counts": dict(sorted(error_counts.items())),
        "unknown_root_counts": dict(sorted(unknown_root_counts.items())),
        "top_unknown_roots": [
            {"root": root, "count": count}
            for root, count in unknown_root_counts.most_common(20)
        ],
        "references": references,
    }


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "fixture_dir",
        nargs="?",
        default="tsz/tests/conformance/uses_addressing",
        help="directory of minimal `<uses>` fixtures",
    )
    parser.add_argument(
        "--root",
        default="compiler",
        help="root namespace name to use for the generated tree",
    )
    parser.add_argument(
        "--json-only",
        action="store_true",
        help="print JSON only",
    )
    parser.add_argument(
        "--summary-only",
        action="store_true",
        help="print only module/error summaries",
    )
    args = parser.parse_args(argv[1:])

    fixture_dir = Path(args.fixture_dir)
    if not fixture_dir.is_dir():
        sys.stderr.write(f"missing fixture dir: {fixture_dir}\n")
        return 2

    modules = [
        parse_fixture_file(path, args.root)
        for path in sorted(fixture_dir.rglob("*.fart"))
    ]
    report = summarize(modules, args.root)

    if args.json_only:
        print(json.dumps(report, indent=2, sort_keys=False))
        return 0

    if args.summary_only:
        print(f"fixture root: {fixture_dir}")
        print(f"namespace root: {args.root}")
        print(f"modules: {report['module_count']}")
        print("summary:")
        print(json.dumps(report["summary"], indent=2, sort_keys=True))
        print("error_counts:")
        print(json.dumps(report["error_counts"], indent=2, sort_keys=True))
        print("top_unknown_roots:")
        print(json.dumps(report["top_unknown_roots"], indent=2, sort_keys=False))
        return 0

    print(f"fixture root: {fixture_dir}")
    print(f"namespace root: {args.root}")
    print()
    print("modules:")
    for module in modules:
        print(f"  - {module['name']} ({module['kind']})")
        if module["uses"]:
            print(f"    uses: {', '.join(module['uses'])}")
        if module["var"]:
            vars_line = ", ".join(
                f"{name}:{decl['kind']}"
                for name, decl in sorted(module["var"].items())
            )
            print(f"    var: {vars_line}")
        if module["functions"]:
            fn_line = ", ".join(sorted(module["functions"]))
            print(f"    functions: {fn_line}")

    print()
    print("resolution report:")
    for item in report["references"]:
        resolution = item["resolution"]
        label = resolution["status"].upper()
        print(f"  - {item['module']}.{item['function']} -> {item['reference']} [{label}]")
        print(f"    trace: {' -> '.join(resolution['trace'])}")
        print(f"    detail: {resolution['detail']}")
        if "to" in resolution:
            print(f"    target: {resolution['to']}")

    print()
    print(json.dumps(report, indent=2, sort_keys=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
