#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"
repo="${2:-/home/siah/creative/reactjit}"
fresh_cutoff="$(date +%s)"
fresh_cutoff="$((fresh_cutoff - 7 * 24 * 60 * 60))"

emit_commits() {
  git -C "$repo" log --date=short --format='%cs' 2>/dev/null \
    | sort \
    | uniq -c \
    | awk '
        {
          day = $2;
          count = $1 + 0;
          print "DAY\t" day "\t" count;
          total += count;
          if (first == "" || day < first) first = day;
          if (last == "" || day > last) last = day;
        }
        END {
          if (first != "") print "FIRST\t" first;
          if (last != "") print "LAST\t" last;
          print "TOTAL\t" total;
        }
      '

  git -C "$repo" log -n 18 --date=short --format='%h%x09%cs%x09%an%x09%s' 2>/dev/null \
    | awk -F '\t' '
        NF >= 4 {
          print "RECENT\t" $1 "\t" $2 "\t" $3 "\t" $4;
        }
      '
}

emit_adds() {
  git -C "$repo" log --diff-filter=A --date=short --format='DATE %cs' --name-only -- tsz 2>/dev/null \
    | awk '
        function ends_with(str, suffix) {
          return length(str) >= length(suffix) && substr(str, length(str) - length(suffix) + 1) == suffix;
        }
        function is_ignored(p) {
          return p == "" ||
            p ~ /^tsz\/carts\/conformance\/\.verified\// ||
            p ~ /\/\.verified\// ||
            p ~ /\/\.zig-cache\// ||
            p ~ /\/\.zig-global-cache\// ||
            p ~ /\/\.tsz-preflight\// ||
            p ~ /\/zig-cache\// ||
            p ~ /\/zig-out\// ||
            p ~ /^tsz\/screenshots\// ||
            p ~ /^tsz\/tests\/screenshots\// ||
            p ~ /^tsz\/\.claude\// ||
            ends_with(p, ".gen.zig");
        }
        function area_of(p) {
          if (p ~ /^tsz\/compiler\//) return "compiler";
          if (p ~ /^tsz\/framework\//) return "framework";
          if (p ~ /^tsz\/carts\/conformance\//) return "conformance";
          if (p ~ /^tsz\/carts\/tools\//) return "tools";
          if (p ~ /^tsz\/carts\//) return "carts";
          if (p ~ /^tsz\/scripts\//) return "scripts";
          if (p ~ /^tsz\/docs\//) return "docs";
          if (p ~ /^tsz\/tests\//) return "tests";
          if (p ~ /^tsz\/experiments\//) return "experiments";
          if (p ~ /^tsz\/(plans|research|stb|tsz|web|wgpu_web|witnesses|screenshots)\//) return "support";
          if (p ~ /^tsz\/[^\/]+$/) return "root";
          return "other";
        }
        function is_buildable_conformance(p) {
          if (p !~ /^tsz\/carts\/conformance\//) return 0;
          if (is_ignored(p)) return 0;
          if (!ends_with(p, ".tsz")) return 0;
          if (ends_with(p, ".script.tsz")) return 0;
          if (ends_with(p, ".cls.tsz")) return 0;
          if (ends_with(p, ".mod.tsz")) return 0;
          if (ends_with(p, ".c.tsz")) return 0;
          if (ends_with(p, ".effects.tsz")) return 0;
          if (ends_with(p, ".glyphs.tsz")) return 0;
          if (ends_with(p, ".tcls.tsz")) return 0;
          if (ends_with(p, ".vcls.tsz")) return 0;
          if (ends_with(p, ".cmod.tsz")) return 0;
          if (ends_with(p, ".lscript.tsz")) return 0;
          return 1;
        }
        function lane_of(p, rel, slash) {
          rel = p;
          sub(/^tsz\/carts\/conformance\//, "", rel);
          slash = index(rel, "/");
          if (slash < 1) return "root";
          return substr(rel, 1, slash - 1);
        }
        index($0, "DATE ") == 1 {
          day = substr($0, 6);
          next;
        }
        NF > 0 {
          path = $0;
          gsub(/\r/, "", path);
          if (substr(path, 1, 4) != "tsz/") next;
          if (is_ignored(path)) next;

          file_day[day] += 1;
          total += 1;

          area = area_of(path);
          area_add[area] += 1;
          if (area_first[area] == "" || day < area_first[area]) area_first[area] = day;
          if (area_last[area] == "" || day > area_last[area]) area_last[area] = day;

          if (is_buildable_conformance(path)) {
            conf_day[day] += 1;
            lane = lane_of(path);
            lane_add[lane] += 1;
            if (lane_first[lane] == "" || day < lane_first[lane]) lane_first[lane] = day;
            if (lane_last[lane] == "" || day > lane_last[lane]) lane_last[lane] = day;
          }
        }
        END {
          for (d in file_day) print "DAY\t" d "\t" file_day[d] "\t" (conf_day[d] + 0);
          print "TOTAL\t" total;
          for (a in area_add) print "AREA\t" a "\t" area_add[a] "\t" area_first[a] "\t" area_last[a];
          for (l in lane_add) print "LANE\t" l "\t" lane_add[l] "\t" lane_first[l] "\t" lane_last[l];
        }
      '
}

emit_disk() {
  find "$repo/tsz" -type f -exec stat -c '%W|%Y|%n' {} + 2>/dev/null \
    | awk -F '|' -v repo="$repo" -v cutoff="$fresh_cutoff" '
        function ends_with(str, suffix) {
          return length(str) >= length(suffix) && substr(str, length(str) - length(suffix) + 1) == suffix;
        }
        function normalize(path) {
          if (index(path, repo "/") == 1) return substr(path, length(repo) + 2);
          return path;
        }
        function is_ignored(p) {
          return p == "" ||
            p ~ /^tsz\/carts\/conformance\/\.verified\// ||
            p ~ /\/\.verified\// ||
            p ~ /\/\.zig-cache\// ||
            p ~ /\/\.zig-global-cache\// ||
            p ~ /\/\.tsz-preflight\// ||
            p ~ /\/zig-cache\// ||
            p ~ /\/zig-out\// ||
            p ~ /^tsz\/screenshots\// ||
            p ~ /^tsz\/tests\/screenshots\// ||
            p ~ /^tsz\/\.claude\// ||
            ends_with(p, ".gen.zig");
        }
        function area_of(p) {
          if (p ~ /^tsz\/compiler\//) return "compiler";
          if (p ~ /^tsz\/framework\//) return "framework";
          if (p ~ /^tsz\/carts\/conformance\//) return "conformance";
          if (p ~ /^tsz\/carts\/tools\//) return "tools";
          if (p ~ /^tsz\/carts\//) return "carts";
          if (p ~ /^tsz\/scripts\//) return "scripts";
          if (p ~ /^tsz\/docs\//) return "docs";
          if (p ~ /^tsz\/tests\//) return "tests";
          if (p ~ /^tsz\/experiments\//) return "experiments";
          if (p ~ /^tsz\/(plans|research|stb|tsz|web|wgpu_web|witnesses|screenshots)\//) return "support";
          if (p ~ /^tsz\/[^\/]+$/) return "root";
          return "other";
        }
        function push_top(ts, day, area, path, i, j) {
          for (i = 1; i <= 14; i++) {
            if (ts > top_ts[i]) {
              for (j = 14; j > i; j--) {
                top_ts[j] = top_ts[j - 1];
                top_day[j] = top_day[j - 1];
                top_area[j] = top_area[j - 1];
                top_path[j] = top_path[j - 1];
              }
              top_ts[i] = ts;
              top_day[i] = day;
              top_area[i] = area;
              top_path[i] = path;
              if (top_n < 14) top_n++;
              return;
            }
          }
        }
        NF >= 3 {
          birth = $1 + 0;
          mtime = $2 + 0;
          path = $3;
          p = normalize(path);
          if (substr(p, 1, 4) != "tsz/") next;
          if (is_ignored(p)) next;

          when = birth > 0 ? birth : mtime;
          day = strftime("%Y-%m-%d", when);
          area = area_of(p);

          total += 1;
          area_disk[area] += 1;
          if (area_last[area] == "" || day > area_last[area]) area_last[area] = day;

          if (when >= cutoff) {
            fresh += 1;
            area_fresh[area] += 1;
            push_top(when, day, area, p);
          }
        }
        END {
          print "TOTAL\t" total;
          print "FRESH\t" fresh;
          for (a in area_disk) print "AREA\t" a "\t" area_disk[a] "\t" (area_fresh[a] + 0) "\t" area_last[a];
          for (i = 1; i <= top_n; i++) print "FILE\t" top_area[i] "\t" top_day[i] "\t" top_ts[i] "\t" top_path[i];
        }
      '
}

case "$mode" in
  commits)
    emit_commits
    ;;
  adds)
    emit_adds
    ;;
  disk)
    emit_disk
    ;;
  *)
    exit 1
    ;;
esac
