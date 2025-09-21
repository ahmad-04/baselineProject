# HTML Popover fallback

Use `<dialog>` or a lightweight custom popover when the Popover API is unavailable.

```html
<button popover id="menu">Menu</button>
```

```js
function openMenuFallback() {
  // Fallback: a positioned element toggled via JS/CSS
}
```
