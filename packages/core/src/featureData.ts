export interface FeatureMeta {
  id: string;
  title: string;
  mdnCompatSlug?: string; // MDN BCD slug (to be filled in Phase 1)
  caniuseSlug?: string; // legacy mapping
  baseline?: "yes" | "no" | "partially";
}

// Temporary: source-of-truth mapping location. We'll enrich from MDN BCD.
export const FEATURE_DATA: Record<string, FeatureMeta> = {
  "navigator-share": {
    id: "navigator-share",
    title: "Web Share API",
    caniuseSlug: "web-share",
  },
  "url-canparse": {
    id: "url-canparse",
    title: "URL.canParse()",
    caniuseSlug: "url",
  },
  "async-clipboard": {
    id: "async-clipboard",
    title: "Async Clipboard API",
    caniuseSlug: "async-clipboard",
  },
  "import-maps": {
    id: "import-maps",
    title: "Import Maps",
    caniuseSlug: "import-maps",
  },
  "html-popover": {
    id: "html-popover",
    title: "Popover attribute",
    caniuseSlug: "popover",
  },
  "css-color-mix": {
    id: "css-color-mix",
    title: "CSS color-mix()",
    caniuseSlug: "css-color-function",
  },
  "css-modal-pseudo": {
    id: "css-modal-pseudo",
    title: ":modal pseudo-class",
    caniuseSlug: "dialog",
  },
  "css-has": { id: "css-has", title: "CSS :has()", caniuseSlug: "css-has" },
  "css-container-queries": {
    id: "css-container-queries",
    title: "CSS Container Queries",
    caniuseSlug: "css-container-queries",
  },
  "css-color-oklch": {
    id: "css-color-oklch",
    title: "CSS oklch()/oklab()",
    caniuseSlug: "css-oklab",
  },
  "css-nesting": {
    id: "css-nesting",
    title: "CSS Nesting",
    caniuseSlug: "css-nesting",
  },
  "view-transitions": {
    id: "view-transitions",
    title: "View Transitions API",
    caniuseSlug: "view-transitions",
  },
  urlpattern: {
    id: "urlpattern",
    title: "URLPattern",
    caniuseSlug: "urlpattern",
  },
  "loading-lazy-attr": {
    id: "loading-lazy-attr",
    title: "loading=lazy",
    caniuseSlug: "loading-lazy-attr",
  },
  "css-text-wrap-balance": {
    id: "css-text-wrap-balance",
    title: "text-wrap: balance",
    caniuseSlug: "css-text-wrap-balance",
  },
  "html-dialog": {
    id: "html-dialog",
    title: "<dialog>",
    caniuseSlug: "dialog",
  },
};
