# URL.canParse guard

Validate URLs robustly across browsers.

```ts
import { canParseUrl } from "@baseline-tools/helpers";

function isValidUrl(u: string) {
  return canParseUrl(u);
}
```
