# View Transitions guard

Check for `document.startViewTransition`.

```ts
import { hasViewTransitions } from "@baseline-tools/helpers";

function navigateWithTransition(cb: () => void) {
  if (hasViewTransitions()) {
    // @ts-ignore
    document.startViewTransition(cb);
  } else {
    cb();
  }
}
```
