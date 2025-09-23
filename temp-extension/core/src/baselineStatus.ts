import { features as wfFeatures } from "web-features";
import { FEATURE_DATA } from "./featureData.js";

const BASELINE_CACHE = new Map<string, boolean | undefined>();

export function isBaselineFeature(featureId: string): boolean | undefined {
  if (BASELINE_CACHE.has(featureId)) return BASELINE_CACHE.get(featureId);
  const meta = FEATURE_DATA[featureId];
  const slug = meta?.caniuseSlug;
  if (!slug) {
    BASELINE_CACHE.set(featureId, undefined);
    return undefined;
  }
  for (const key of Object.keys(wfFeatures)) {
    const f: any = (wfFeatures as any)[key];
    const ci = f?.caniuse;
    if (!ci) continue;
    const matches = Array.isArray(ci) ? ci.includes(slug) : ci === slug;
    if (!matches) continue;
    const b = f?.status?.baseline;
    const val = b === "low" || b === "high" ? true : false;
    BASELINE_CACHE.set(featureId, val);
    return val;
  }
  BASELINE_CACHE.set(featureId, undefined);
  return undefined;
}
