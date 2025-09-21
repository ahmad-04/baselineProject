# CSS :has() progressive enhancement

Avoid critical reliance on `:has()`; prefer it for enhancements.

```css
/* Baseline */
.form-label {
  font-weight: 600;
}

/* Enhance when supported */
/* Targets supporting :has() will apply these styles */
:has(> input:focus) .form-label {
  color: rebeccapurple;
}
```
