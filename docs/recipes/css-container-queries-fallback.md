# CSS Container Queries fallback

Use media queries as a baseline and progressively enhance with container queries.

```css
/* Baseline layout with media queries */
.card {
  display: grid;
  grid-template-columns: 1fr;
}
@media (min-width: 800px) {
  .card {
    grid-template-columns: 1fr 1fr;
  }
}

/* Progressive enhancement with container queries */
@container (min-width: 500px) {
  .card {
    grid-template-columns: 2fr 1fr;
  }
}
```
