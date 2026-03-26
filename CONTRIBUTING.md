# Contributing

## Development

```bash
npm install
npm run check
```

## Pull Requests

- Keep changes focused and small.
- Add or update tests for behavior changes.
- Update `README.md` when the public surface changes.
- Prefer refactors before feature additions when the current structure is awkward.

## Release Expectations

- `npm run check` must pass before publishing.
- The published package is built from `dist/` and `bin/` only. Do not rely on unpublished source files at runtime.
- See [RELEASING.md](./RELEASING.md) for the release workflow and checklist.
