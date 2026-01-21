# frontend

This project was bootstrapped manually to mirror the default Vite + React template.

## Available Scripts

### `npm run dev`
Runs the app in development mode.

### `npm run build`
Builds the app for production.

### `npm run preview`
Preview the production build locally.

### `npm run lint`
Runs ESLint across the project.
### `npm run check:bundle`
(Phase 7.32) Validates production bundle sizes against performance budgets.

Run after building to ensure bundles meet size requirements:
```bash
npm run build
npm run check:bundle
```

Performance budgets:
- Main chunk: 750 KB (gzipped)
- Vendor chunk: 300 KB (gzipped)
- Any chunk: 500 KB (gzipped)

The script will fail CI if any bundle exceeds its budget.

## Bundle Optimization (Phase 7.32)

The build uses manual chunk splitting to optimize bundle sizes:

- **vendor-react**: React core libraries (react, react-dom, react-router-dom)
- **vendor-state**: State management (zustand)
- **intelligence**: AI/ML features (confidence panels, recompute, exports)
- **console**: Dashboard and case management
- **api**: API layer (workflow, submissions, evidence, attachments)

This ensures faster initial page loads and better caching.