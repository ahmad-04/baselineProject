#!/usr/bin/env node
import pc from "picocolors";
import { readPackageUp } from "read-pkg-up";
import { analyze, type FileRef } from "@whoisahmad/baseline-tools-core";
import { globby } from "globby";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFile as _execFile } from "node:child_process";
import { promisify } from "node:util";
const execFile = promisify(_execFile);

async function loadTargets(cwd: string): Promise<string[] | undefined> {
  const pkg = await readPackageUp({ cwd });
  const browserslist = (pkg?.packageJson as any)?.browserslist;
  if (!browserslist) return undefined;
  if (Array.isArray(browserslist)) return browserslist as string[];
  if (typeof browserslist === "string") return [browserslist as string];
  if (typeof browserslist === "object" && browserslist.production)
    return browserslist.production as string[];
  return undefined;
}

type BaselineConfig = {
  targets?: string[] | string;
  unsupportedThreshold?: number;
  ignore?: string[];
  features?: Record<string, boolean>;
};

async function loadConfig(
  startDir: string,
  explicitPath?: string
): Promise<{ path?: string; config?: BaselineConfig }> {
  try {
    if (explicitPath) {
      const p = path.resolve(explicitPath);
      const txt = await fs.readFile(p, "utf8");
      return { path: p, config: JSON.parse(txt) as BaselineConfig };
    }
    let dir = path.resolve(startDir);
    const root = path.parse(dir).root;
    while (true) {
      const p = path.join(dir, "baseline.config.json");
      try {
        const txt = await fs.readFile(p, "utf8");
        return { path: p, config: JSON.parse(txt) as BaselineConfig };
      } catch {
        // keep walking up
      }
      if (dir === root) break;
      const next = path.dirname(dir);
      if (next === dir) break;
      dir = next;
    }
  } catch {
    // ignore
  }
  return {};
}

function hashConfig(obj: any): string | undefined {
  try {
    const json = JSON.stringify(obj ?? null);
    return crypto.createHash("sha1").update(json).digest("hex");
  } catch {
    return undefined;
  }
}

function formatFindings(
  findings: ReturnType<typeof analyze>,
  targets?: string[] | undefined
) {
  if (findings.length === 0) {
    console.log(pc.green("No issues found."));
    return 0;
  }
  const nonBaseline = findings.filter((f: any) => f.baseline !== "yes");
  const header = targets?.length
    ? `Baseline scan summary (targets: ${targets.join(", ")})`
    : "Baseline scan summary";
  console.log(pc.bold(header));
  for (const f of findings) {
    const adv = (f as any).advice as string | undefined;
    const status =
      adv === "safe"
        ? pc.green("Safe to adopt")
        : adv === "guarded"
          ? pc.yellow("Guarded")
          : f.baseline === "yes"
            ? pc.green("Baseline ✓")
            : pc.red("Needs guard");
    console.log(`- ${f.title} — ${status}`);
    console.log(`  • File: ${f.file}:${f.line}`);
    if (f.suggestion) console.log(`  • Suggest: ${f.suggestion}`);
    console.log(`  • Docs: ${f.docsUrl}`);
  }
  const guardedCount = (findings as any[]).filter(
    (f) => f.advice === "guarded"
  ).length;
  const nonBaselineCount = nonBaseline.length - guardedCount;
  const safeCount = findings.length - nonBaseline.length + guardedCount;
  console.log(
    pc.bold(`\nTotals:`),
    `${nonBaselineCount} non-Baseline, ${safeCount} safe`
  );
  return nonBaseline.length > 0 ? 1 : 0;
}

function parseArgs(argv: string[]) {
  const args = {
    path: ".",
    json: false,
    report: undefined as string | undefined,
    exitZero: false,
    files: undefined as string[] | undefined,
    unsupportedThreshold: undefined as number | undefined,
    configPath: undefined as string | undefined,
    cache: false as boolean,
    cacheFile: ".baseline-scan-cache.json" as string,
    changed: false as boolean,
    since: undefined as string | undefined,
  };
  const rest: string[] = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else if (a === "--json") args.json = true;
    else if (a === "--exit-zero") args.exitZero = true;
    else if (a === "--report") {
      args.report = argv[++i];
    } else if (a === "--files") {
      const v = argv[++i];
      if (v)
        args.files = v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
    } else if (a === "--unsupported-threshold") {
      const v = argv[++i];
      const n = v ? Number(v) : NaN;
      if (!Number.isNaN(n)) args.unsupportedThreshold = n;
    } else if (a === "--config") {
      args.configPath = argv[++i];
    } else if (a === "--cache") {
      args.cache = true;
    } else if (a === "--cache-file") {
      args.cacheFile = argv[++i] || args.cacheFile;
    } else if (a === "--changed") {
      args.changed = true;
    } else if (a === "--since") {
      args.since = argv[++i];
    } else if (!a.startsWith("-")) {
      rest.push(a);
    }
  }
  if (rest[0]) args.path = rest[0];
  return args;
}

function printHelp() {
  const usage = `\nUsage: baseline-scan <path> [options]\n\nOptions:\n  --json                       Output JSON to stdout\n  --report <file>              Write report (.json, .html, .sarif)\n  --exit-zero                  Exit with code 0 regardless of findings\n  --files <csv>                Comma-separated file globs to scan\n  --unsupported-threshold <n>  Reclassify \'needs-guard\' to \'safe\' when unsupported% <= n\n  --config <path>              Path to baseline.config.json\n  --changed                    Scan only files changed vs HEAD (includes untracked)\n  --since <ref>                Base ref for --changed (e.g., origin/main)\n  --cache                      Enable content-hash cache (v3)\n  --cache-file <path>          Path to cache file (default .baseline-scan-cache.json)\n  -h, --help                   Show this help\n`;
  console.log(usage);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtmlReport(report: any): string {
  const targets = report?.meta?.targets as string[] | null;
  const findings = (report?.findings as any[]) ?? [];
  const rows = findings
    .map((f) => {
      const advice = (
        f.advice === "guarded"
          ? "Guarded"
          : f.advice === "safe"
            ? "Safe to adopt"
            : "Needs guard"
      ) as string;
      return `<tr data-advice="${escapeHtml(f.advice || "")}" data-unsupported="${
        typeof f.unsupportedPercent === "number"
          ? String(f.unsupportedPercent)
          : ""
      }" data-feature="${escapeHtml(f.title)}" data-file="${escapeHtml(f.file)}">
  <td>${escapeHtml(f.title)}</td>
  <td><code>${escapeHtml(f.file)}:${f.line}</code></td>
  <td>${escapeHtml(advice)}</td>
    <td>${
      typeof f.unsupportedPercent === "number"
        ? escapeHtml(String(f.unsupportedPercent)) + "%"
        : ""
    }</td>
  <td>${escapeHtml(f.suggestion || "")}</td>
  <td><a href="${escapeHtml(f.docsUrl)}" target="_blank" rel="noreferrer noopener">Docs</a></td>
</tr>`;
    })
    .join("\n");
  const totals = report?.totals ?? {};
  const generatedAt = report?.meta?.generatedAt;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Baseline Adoption Report</title>
  <style>
    :root { --fg:#0b0d12; --muted:#5a6372; --ok:#0a7f3f; --warn:#b88300; --err:#b11; --bg:#fff; --line:#e8ecf2; }
    body { font-family: ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji; margin: 24px; color: var(--fg); background: var(--bg); }
    header { margin-bottom: 16px; }
    h1 { font-size: 20px; margin: 0 0 6px; }
    .meta { color: var(--muted); font-size: 12px; }
    .totals { margin: 12px 0 20px; font-weight: 600; }
    .toolbar { display:flex; gap:12px; align-items:center; flex-wrap: wrap; margin: 8px 0 16px; padding: 8px; border:1px solid var(--line); border-radius: 8px; }
    .toolbar .group { display:flex; gap:8px; align-items:center; }
    .toolbar label { font-size: 12px; color: var(--muted); }
    .toolbar input[type="search"], .toolbar select { padding:6px 8px; border:1px solid var(--line); border-radius:6px; font-size:12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px 8px; vertical-align: top; }
    thead th { border-bottom: 2px solid var(--line); font-size: 12px; color: var(--muted); }
    tbody tr { border-bottom: 1px solid var(--line); }
    code { background: #f6f8fa; border: 1px solid #eaeef2; padding: 1px 4px; border-radius: 3px; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .badge.safe { background: #e8f7ee; color: var(--ok); border: 1px solid #c7ecd6; }
    .badge.needs { background: #fff7e5; color: var(--warn); border: 1px solid #ffe7a6; }
    .badge.guarded { background: #eef4ff; color: #2b5fd9; border: 1px solid #d8e3ff; }
  </style>
  </head>
<body>
  <header>
    <h1>Baseline Adoption Report</h1>
    <div class="meta">
      ${targets && targets.length ? `Targets: ${targets.map(escapeHtml).join(", ")}` : "Targets: (none)"}
      ${generatedAt ? ` • Generated: ${escapeHtml(generatedAt)}` : ""}
    </div>
    <div class="totals">
      Total findings: ${Number(totals.total) ?? 0} • Non-Baseline: ${Number(totals.nonBaseline) ?? 0} • Safe: ${Number(totals.safe) ?? 0}
    </div>
    <div class="toolbar">
      <div class="group" id="advice-filters">
        <label>Advice:</label>
        <label><input type="checkbox" value="safe" checked> Safe</label>
        <label><input type="checkbox" value="guarded" checked> Guarded</label>
        <label><input type="checkbox" value="needs-guard" checked> Needs guard</label>
      </div>
      <div class="group">
        <label for="search">Search:</label>
        <input id="search" type="search" placeholder="feature, file…" />
      </div>
      <div class="group">
        <label for="sort">Sort:</label>
        <select id="sort">
          <option value="feature">Feature</option>
          <option value="file">Location</option>
          <option value="advice">Advice</option>
          <option value="unsupported">~Unsupported</option>
        </select>
      </div>
    </div>
  </header>
  <main>
    <table>
      <thead>
        <tr>
          <th>Feature</th>
          <th>Location</th>
          <th>Advice</th>
            <th>~Unsupported</th>
          <th>Suggestion</th>
          <th>Docs</th>
        </tr>
      </thead>
      <tbody id="rows">
        ${rows}
      </tbody>
    </table>
  </main>
  <script>
    (function() {
  const tbody = document.getElementById('rows');
      const filters = Array.from(document.querySelectorAll('#advice-filters input[type="checkbox"]'));
      const search = document.getElementById('search');
      const sortSel = document.getElementById('sort');

      function normalize(s) { return (s||'').toLowerCase(); }

      function apply() {
        const allowed = new Set(filters.filter(f => f.checked).map(f => f.value));
        const q = normalize(search.value);
        const rows = Array.from(tbody.querySelectorAll('tr'));
        for (const r of rows) {
          const advice = r.getAttribute('data-advice') || '';
          const feat = normalize(r.getAttribute('data-feature'));
          const file = normalize(r.getAttribute('data-file'));
          const okAdvice = allowed.has(advice);
          const okQuery = !q || feat.includes(q) || file.includes(q);
          r.style.display = (okAdvice && okQuery) ? '' : 'none';
        }
        sortRows(rows);
      }

      function sortRows(rows) {
        const key = sortSel.value;
        const cmp = {
          feature: (a,b) => (a.getAttribute('data-feature')||'').localeCompare(b.getAttribute('data-feature')||''),
          file: (a,b) => (a.getAttribute('data-file')||'').localeCompare(b.getAttribute('data-file')||''),
          advice: (a,b) => order(a.getAttribute('data-advice')) - order(b.getAttribute('data-advice')),
          unsupported: (a,b) => (parseFloat(a.getAttribute('data-unsupported')||'-1')||-1) - (parseFloat(b.getAttribute('data-unsupported')||'-1')||-1)
        }[key] || (()=>0);
        rows.sort(cmp).forEach(r => tbody.appendChild(r));
      }

      function order(a) { return a === 'needs-guard' ? 2 : a === 'guarded' ? 1 : 0; }

      filters.forEach(cb => cb.addEventListener('change', apply));
      search.addEventListener('input', apply);
      sortSel.addEventListener('change', apply);
      apply();
    })();
  </script>
</body>
</html>`;
}

function toSarif(report: any) {
  const findings = (report?.findings as any[]) ?? [];
  const rulesMap = new Map<string, any>();
  const results: any[] = [];
  for (const f of findings) {
    const ruleId = f.featureId || f.title;
    if (!rulesMap.has(ruleId)) {
      rulesMap.set(ruleId, {
        id: ruleId,
        name: f.title,
        helpUri: f.docsUrl,
        shortDescription: { text: f.title },
        fullDescription: { text: f.suggestion || f.title },
        properties: { baseline: f.baseline },
      });
    }
    const level =
      f.advice === "safe"
        ? "note"
        : f.advice === "guarded"
          ? "warning"
          : "warning";
    results.push({
      ruleId,
      level,
      message: { text: `${f.title} — ${f.advice ?? f.baseline}` },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: f.file.replace(/\\/g, "/") },
            region: { startLine: f.line, startColumn: f.column },
          },
        },
      ],
    });
  }
  const rules = Array.from(rulesMap.values());
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "baseline-scan",
            rules,
          },
        },
        results,
      },
    ],
  };
}

async function main() {
  const argv = parseArgs(process.argv);
  const targetPath = argv.path ?? ".";
  const norm = targetPath.replace(/\\/g, "/");
  const { config: cfg, path: cfgPath } = await loadConfig(
    targetPath,
    argv.configPath
  );
  let files: string[];
  if (argv.files && argv.files.length > 0) {
    files = await globby(argv.files, {
      gitignore: true,
      dot: false,
      expandDirectories: false,
      absolute: true,
    });
  } else {
    const patterns = [`**/*.{js,jsx,ts,tsx,css,scss,html}`];
    const ignore = (cfg?.ignore || []).map((p) => p.replace(/\\/g, "/"));
    files = await globby(patterns, {
      cwd: path.resolve(targetPath),
      gitignore: true,
      dot: false,
      ignore,
      absolute: true,
    });
  }
  if (argv.changed) {
    const changed = await getChangedFiles(path.resolve(targetPath), argv.since);
    if (changed && changed.length) {
      const changedSet = new Set(changed.map((p) => p.replace(/\\/g, "/")));
      files = files.filter((p) => changedSet.has(p.replace(/\\/g, "/")));
    } else if (Array.isArray(changed) && changed.length === 0) {
      const emptyReport = {
        meta: {
          targets: null,
          filesScanned: 0,
          generatedAt: new Date().toISOString(),
          configPath: cfgPath ?? null,
          unsupportedThreshold: null,
        },
        totals: { total: 0, nonBaseline: 0, safe: 0 },
        findings: [],
      };
      if (argv.report) {
        const ext = path.extname(argv.report || "").toLowerCase();
        if (ext === ".html" || ext === ".htm") {
          const html = renderHtmlReport(emptyReport);
          await fs.writeFile(argv.report, html, "utf8");
        } else if (ext === ".sarif") {
          const sarif = toSarif(emptyReport);
          await fs.writeFile(
            argv.report,
            JSON.stringify(sarif, null, 2),
            "utf8"
          );
        } else {
          await fs.writeFile(
            argv.report,
            JSON.stringify(emptyReport, null, 2),
            "utf8"
          );
        }
      }
      if (!argv.json)
        console.log(pc.dim("No changed files detected. Skipping scan."));
      process.exitCode = 0;
      return;
    }
  }
  // Simple file mtime-based cache
  type CacheEntry = { mtimeMs: number; contentHash?: string; result: any[] };
  type CacheShape = {
    version: 3;
    targets: string[] | undefined;
    configHash?: string | undefined;
    byFile: Record<string, CacheEntry>;
  };
  let cache: CacheShape | undefined;
  const cachePath = path.resolve(targetPath, argv.cacheFile);
  if (argv.cache) {
    try {
      const raw = await fs.readFile(cachePath, "utf8");
      cache = JSON.parse(raw) as CacheShape;
    } catch {
      cache = {
        version: 3,
        targets: undefined,
        configHash: undefined,
        byFile: {},
      } as CacheShape;
    }
  }

  const perFileFindings: any[] = [];
  const contentHashByPath = new Map<string, string>();
  // Read files in small batches to reduce peak memory
  const BATCH_SIZE = 200;
  const fileRefsBatches: FileRef[][] = [];
  {
    let cur: FileRef[] = [];
    for (const p of files) {
      const content = await fs.readFile(p, "utf8");
      const h = crypto.createHash("sha1").update(content).digest("hex");
      contentHashByPath.set(p.replace(/\\/g, "/"), h);
      cur.push({ path: p, content });
      if (cur.length >= BATCH_SIZE) {
        fileRefsBatches.push(cur);
        cur = [];
      }
    }
    if (cur.length) fileRefsBatches.push(cur);
  }
  const cfgTargets = Array.isArray(cfg?.targets)
    ? (cfg?.targets as string[])
    : typeof cfg?.targets === "string"
      ? [cfg?.targets as string]
      : undefined;
  const targets = cfgTargets ?? (await loadTargets(path.resolve(targetPath)));
  const configHash = hashConfig(cfg);
  let findings: any[] = [];
  if (argv.cache && cache) {
    // Invalidate cache wholesale if version or configHash mismatch
    const usable = cache.version === 3 && cache.configHash === configHash;
    const updatedCache: CacheShape = {
      version: 3,
      targets,
      configHash,
      byFile: {},
    } as CacheShape;
    for (const batch of fileRefsBatches) {
      for (const ref of batch) {
        try {
          const stat = await (await import("node:fs/promises")).stat(ref.path);
          const mtimeMs = stat.mtimeMs;
          const key = ref.path.replace(/\\/g, "/");
          const prev = cache.byFile?.[key];
          const currHash = contentHashByPath.get(key);
          if (
            usable &&
            prev &&
            prev.contentHash &&
            currHash &&
            prev.contentHash === currHash &&
            JSON.stringify(cache.targets) === JSON.stringify(targets)
          ) {
            const reused = prev.result.map((f: any) => ({
              ...f,
              file: ref.path,
            }));
            findings.push(...reused);
            updatedCache.byFile[key] = prev;
            continue;
          }
          const res = analyze([{ path: ref.path, content: ref.content }], {
            targets,
          });
          findings.push(...res);
          updatedCache.byFile[key] = {
            mtimeMs,
            contentHash: currHash,
            result: res,
          };
        } catch {
          const res = analyze([{ path: ref.path, content: ref.content }], {
            targets,
          });
          findings.push(...res);
        }
      }
    }
    cache = updatedCache;
  } else {
    // Analyze in batches to bound memory
    for (const batch of fileRefsBatches) {
      const res = analyze(batch, { targets }) as any[];
      findings.push(...res);
    }
  }
  // Apply unsupported threshold: reclassify needs-guard -> safe if <= threshold
  const threshold =
    argv.unsupportedThreshold != null
      ? argv.unsupportedThreshold
      : cfg?.unsupportedThreshold;
  const adjusted =
    threshold == null
      ? findings
      : findings.map((f: any) => {
          if (
            typeof f.unsupportedPercent === "number" &&
            f.advice === "needs-guard" &&
            f.unsupportedPercent <= threshold
          ) {
            return { ...f, advice: "safe", severity: "info" };
          }
          return f;
        });
  // Apply feature toggles
  const filtered = adjusted.filter((f: any) => {
    if (!cfg?.features) return true;
    const v = cfg.features[f.featureId];
    return v !== false;
  });
  const nonBaseline = findings.filter((f: any) => f.baseline !== "yes");
  const guardedCount = (findings as any[]).filter(
    (f) => (f as any).advice === "guarded"
  ).length;
  const report = {
    meta: {
      targets: targets ?? null,
      filesScanned: files.length,
      generatedAt: new Date().toISOString(),
      configPath: cfgPath ?? null,
      unsupportedThreshold: threshold ?? null,
    },
    totals: {
      total: filtered.length,
      nonBaseline: filtered.filter(
        (f: any) =>
          f.baseline !== "yes" && f.advice !== "guarded" && f.advice !== "safe"
      ).length,
      safe: filtered.filter(
        (f: any) => f.advice === "safe" || f.advice === "guarded"
      ).length,
    },
    findings: filtered,
  };
  if (argv.cache && cache) {
    try {
      await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), "utf8");
    } catch {}
  }
  if (argv.report) {
    const ext = path.extname(argv.report || "").toLowerCase();
    if (ext === ".html" || ext === ".htm") {
      const html = renderHtmlReport(report);
      await fs.writeFile(argv.report, html, "utf8");
    } else if (ext === ".sarif") {
      const sarif = toSarif(report);
      await fs.writeFile(argv.report, JSON.stringify(sarif, null, 2), "utf8");
    } else {
      await fs.writeFile(argv.report, JSON.stringify(report, null, 2), "utf8");
    }
  }
  if (argv.json) {
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = argv.exitZero ? 0 : nonBaseline.length > 0 ? 1 : 0;
    return;
  }
  const code = formatFindings(adjusted as any, targets);
  process.exitCode = argv.exitZero ? 0 : code;
}

main().catch((err) => {
  console.error(pc.red(String(err?.stack || err)));
  process.exitCode = 1;
});

async function getChangedFiles(
  cwd: string,
  since?: string
): Promise<string[] | undefined> {
  try {
    const { stdout: inside } = await execFile(
      "git",
      ["rev-parse", "--is-inside-work-tree"],
      { cwd }
    );
    if (!/^true/.test(String(inside).trim())) return undefined;
    const diffArgs = [
      "--no-optional-locks",
      "diff",
      "--name-only",
      "--diff-filter=ACMRTUXB",
      since || "HEAD",
    ];
    const lsArgs = ["ls-files", "--others", "--exclude-standard"];
    const [diff, untracked] = await Promise.all([
      execFile("git", diffArgs, { cwd })
        .then((r) => r.stdout)
        .catch(() => ""),
      execFile("git", lsArgs, { cwd })
        .then((r) => r.stdout)
        .catch(() => ""),
    ]);
    const lines = `${diff}\n${untracked}`
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const abs = Array.from(new Set(lines)).map((p) => path.resolve(cwd, p));
    return abs;
  } catch {
    return undefined;
  }
}
