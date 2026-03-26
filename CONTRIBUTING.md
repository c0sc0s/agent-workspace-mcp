# Contributing

## Development

```bash
npm install
npm run build
npm test
```

Run the smoke script against the included fixture workspace:

```bash
npm run smoke -- "./fixtures/monorepo" "./fixtures/monorepo/packages/app/src/index.ts" 1 10
```

## Pull Requests

- Keep changes focused and small.
- Add or update tests for behavior changes.
- Update `README.md` when the public surface changes.
- Prefer refactors before feature additions when the current structure is awkward.

## Release Expectations

- `npm test` must pass before publishing.
- The published package is built from `dist/` only. Do not rely on unpublished source files at runtime.
