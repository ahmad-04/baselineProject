import browserslist from "browserslist";
// Use the unpacker to access features map
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { features, feature } from "caniuse-lite/dist/unpacker/index.js";

// Minimal mapping from our featureIds to caniuse slugs
const MAP: Record<string, string> = {
  "navigator-share": "web-share",
  // Approximate: URL.canParse doesn’t have a direct caniuse slug; use URL API coverage proxy
  "url-canparse": "url",
  "html-popover": "popover",
  "css-has": "css-has",
  "css-container-queries": "css-container-queries",
  "css-color-oklch": "css-oklab",
};

function agentsFromTargets(targets: string[]) {
  const list = browserslist(targets);
  return list.map((e) => {
    const [name, version] = e.split(" ");
    return { name, version } as const;
  });
}

export function getSupport(
  featureId: string,
  targets: string[]
): number | undefined {
  const slug = MAP[featureId];
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
    const ver = agentStats[a.version as keyof typeof agentStats];
    if (!ver) continue;
    total++;
    if (typeof ver === "string" && (ver.includes("y") || ver.includes("a")))
      supported++;
  }
  if (total === 0) return undefined;
  return (supported / total) * 100;
}
