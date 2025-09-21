# Web Share guard

Use the helpers package to guard `navigator.share`.

```ts
import { canShare } from "@baseline-tools/helpers";

async function share(data: { title?: string; text?: string; url?: string }) {
  if (canShare()) {
    await navigator.share(data);
  } else {
    // Fallback: show copy-to-clipboard or share sheet UI
  }
}
```
