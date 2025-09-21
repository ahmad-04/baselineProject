# File Picker guard

Use the picker when available; fallback to `<input type="file">`.

```ts
import { canShowOpenFilePicker } from "@baseline-tools/helpers";

async function pickFile() {
  if (canShowOpenFilePicker()) {
    // @ts-ignore
    const [handle] = await showOpenFilePicker();
    return await (await handle.getFile()).text();
  } else {
    // Fallback: create an <input type="file"> and read file
  }
}
```
