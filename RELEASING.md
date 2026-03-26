# Releasing

## Preconditions

- `npm run check` passes locally
- `package.json` and `CHANGELOG.md` are updated for the target version
- the npm package name `agent-workspace-mcp` is available to your account or organization
- the repository has an `NPM_TOKEN` GitHub Actions secret with publish permission

## Dry Run

```bash
npm install
npm run release:dry-run
```

This validates:

- Rslib build output
- unit tests
- fixture smoke validation
- tarball install-and-start verification
- npm pack contents

## Publish Flow

1. Update the version in `package.json`
2. Update `CHANGELOG.md`
3. Commit and push to `main`
4. Create a tag such as `v0.1.1`
5. Publish a GitHub Release for that tag

The release workflow will then run `npm run check` and publish with provenance enabled.

## Notes

- The published package relies on `dist/` and `bin/` only.
- Do not publish if `npm run check` fails, even if `npm pack --dry-run` looks correct.
