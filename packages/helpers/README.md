# @baseline-tools/helpers

Tiny capability checks to help adopt modern web features safely.

- `canShare()` — `navigator.share`
- `canParseUrl(url)` — uses `URL.canParse` if available, otherwise `new URL()`
- `hasViewTransitions()` — `document.startViewTransition`
- `canShowOpenFilePicker()` — `window.showOpenFilePicker`

Install:

```bash
npm i @baseline-tools/helpers
```

Use:

```ts
import { canShare } from "@baseline-tools/helpers";

if (canShare()) {
  await navigator.share({ title: document.title, url: location.href });
} else {
  // fallback UI
}
```
