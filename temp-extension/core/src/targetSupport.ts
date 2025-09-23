import browserslist from "browserslist";
// Use the unpacker to access features map
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { features, feature } from "caniuse-lite/dist/unpacker/index.js";
import { FEATURE_DATA } from "./featureData.js";
import { features as wfFeatures } from "web-features";

// Minimal mapping from our featureIds to caniuse slugs
function getCaniuseSlug(featureId: string): string | undefined {
  return FEATURE_DATA[featureId]?.caniuseSlug;
}

const SUPPORT_CACHE = new Map<string, number | undefined>();

function agentsFromTargets(targets: string[]) {
  const list = browserslist(targets);
  return list.map((e) => {
    const [name, version] = e.split(" ");
    return { name, version } as const;
  });
}

function normalizeVersion(v: string): number | undefined {
  // browserslist version can be like "15.5", "15.5-15.6", "TP"
  const m = v.match(/\d+(?:\.\d+)?/);
  if (!m) return undefined;
  return parseFloat(m[0]);
}

function resolveStat(agentStats: Record<string, any>, version: string) {
  // Try direct match first
  if (agentStats[version]) return agentStats[version];
  const vNum = normalizeVersion(version);
  if (vNum === undefined) return undefined;
  let candidate: { key: string; val: any; keyNum: number } | undefined;
  for (const key of Object.keys(agentStats)) {
    const val = agentStats[key];
    // Range like "15.5-15.6"
    const range = key.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    if (range) {
      const lo = parseFloat(range[1]);
      const hi = parseFloat(range[2]);
      if (vNum >= lo && vNum <= hi) return val;
      continue;
    }
    // Less-than-or-equal like "≤37"
    const le = key.match(/^≤\s*(\d+(?:\.\d+)?)/);
    if (le) {
      const hi = parseFloat(le[1]);
      if (vNum <= hi) return val;
      continue;
    }
    const kNum = normalizeVersion(key);
    if (typeof kNum === "number") {
      // Track greatest version <= target as fallback
      if (kNum <= vNum && (!candidate || kNum > candidate.keyNum)) {
        candidate = { key, val, keyNum: kNum };
      }
    }
  }
  return candidate?.val;
}

export function getSupport(
  featureId: string,
  targets: string[]
): number | undefined {
  const key = `${featureId}::${targets.join("|")}`;
  if (SUPPORT_CACHE.has(key)) return SUPPORT_CACHE.get(key);
  // Try MDN/web-features first: map feature to caniuse slug and locate matching entry
  const slug = getCaniuseSlug(featureId);
  let mdnSupport: Record<string, string> | undefined;
  if (slug) {
    for (const k of Object.keys(wfFeatures)) {
      const f: any = (wfFeatures as any)[k];
      const ci = f?.caniuse;
      const matches = Array.isArray(ci) ? ci.includes(slug) : ci === slug;
      if (matches && f?.status?.support) {
        mdnSupport = f.status.support as Record<string, string>;
        break;
      }
    }
  }
  if (mdnSupport) {
    const agents = agentsFromTargets(targets);
    let supported = 0;
    let total = 0;
    for (const a of agents) {
      const key =
        a.name === "chrome_android"
          ? "chrome_android"
          : a.name === "firefox_android"
            ? "firefox_android"
            : a.name;
      const minVer = mdnSupport[key];
      if (!minVer) continue;
      const vNum = normalizeVersion(a.version);
      const minNum = normalizeVersion(minVer);
      if (vNum === undefined || minNum === undefined) continue;
      total++;
      if (vNum >= minNum) supported++;
    }
    if (total > 0) {
      const pct = (supported / total) * 100;
      SUPPORT_CACHE.set(key, pct);
      return pct;
    }
  }
  // Fallback to caniuse-lite
  if (!slug) return undefined;
  const data: any = (features as any)?.[slug]
    ? feature((features as any)[slug])
    : undefined;
  if (!data) return undefined;
  const stats = data.stats;
  const agents = agentsFromTargets(targets);
  let supported = 0;
  let total = 0;
  for (const a of agents) {
    const agentStats = stats[a.name as keyof typeof stats];
    if (!agentStats) continue;
    const ver = resolveStat(agentStats as any, a.version);
    if (!ver) continue;
    total++;
    if (typeof ver === "string" && (ver.includes("y") || ver.includes("a")))
      supported++;
  }
  if (total === 0) {
    SUPPORT_CACHE.set(key, undefined);
    return undefined;
  }
  const pct = (supported / total) * 100;
  SUPPORT_CACHE.set(key, pct);
  return pct;
}
