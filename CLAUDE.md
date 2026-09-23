# sPark Mobile — Claude Code governance

Expo + expo-router, React Native. Ships through EAS, not through CI.

This repo is **self-contained**: its own lockfile, `node_modules`, pinned
`packageManager` and tooling. Cloning it alone is enough to install, lint, typecheck, test
and build. Nothing resolves upward into the `spark-parking` umbrella repo, and unlike the
api and web repos there are **no vendored `@spark/*` packages** — this app carries its own
types and UI.

## Layout

```
app/             — expo-router routes ((tabs), facility, onboarding, _layout)
src/auth/        — session handling
src/components/  — shared components
src/i18n/        — LanguageProvider and catalogues
src/lib/         — API client, payments, constants, secure storage
src/navigation/  — navigation helpers
src/screens/     — screen implementations
src/theme/       — tokens and ThemeProvider
src/types/       — this app's own type definitions
assets/          — app icons and brand marks
```

`src/types` is this app's own copy. It is **not** shared with the api or web repos, which
have their own `vendor/types`. If a contract changes on the server (auth roles, booking or
payment status values, the password policy), update `src/types` here to match — nothing
enforces it for you.

## Tooling notes

`pnpm-workspace.yaml` declares `packages: []` on purpose. It anchors this directory as its
own pnpm root so an ancestor workspace can never absorb it.

`.npmrc` sets `node-linker=hoisted`, which Metro needs — it does not handle pnpm's
symlinked `node_modules` layout well. Do not remove it.

ESLint config lives in **`.eslintrc.cjs`** only. There was previously also an
`.eslintrc.js`; ESLint resolves `.js` first, so it silently shadowed the real config and
linting ran with almost no rules. Do not reintroduce a second eslintrc file.

`no-unused-vars` sets `ignoreRestSiblings` so `const { secret, ...rest } = obj` can drop a
field on purpose — the tests use that to build invalid payloads.

## Coding standards

- TypeScript strict mode everywhere. No `any` without explicit justification.
- No comments unless the WHY is non-obvious.
- Zod for anything crossing a trust boundary (API responses, deep-link params).
- No `console.log` in production paths.
- `type-imports` enforced: `import type { Foo }` for type-only imports.

## Security rules

- Session and tokens go in `expo-secure-store`, never `AsyncStorage`.
- Never log raw tokens or PII.
- No secrets in source. `EXPO_PUBLIC_*` values are **shipped inside the app binary** and
  are readable by anyone who downloads it — treat them as public.
- `release-key.jks` and any `*.keystore` are gitignored and must never be committed.
  Losing that keystore means you can no longer ship updates to existing installs, so keep
  a backup somewhere outside this repo.

## Env var conventions

| Prefix         | Visibility                              |
| -------------- | --------------------------------------- |
| (none)         | Build-time only, not bundled            |
| `EXPO_PUBLIC_` | **Bundled into the app — fully public** |

## Local setup

```bash
pnpm install
cp .env.example .env
pnpm run dev            # expo start
pnpm run android        # or: pnpm run ios
```

The API must be reachable from the device or emulator — a `localhost` API URL will not
resolve from a physical device; use the host machine's LAN address.

## Commands

| Command                 | Does                                              |
| ----------------------- | ------------------------------------------------- |
| `pnpm run dev`          | `expo start`                                      |
| `pnpm run prebuild`     | `expo prebuild --clean` — regenerates android/ios |
| `pnpm run lint`         | ESLint over `src/` and `app/`                     |
| `pnpm run typecheck`    | `tsc --noEmit`                                    |
| `pnpm run test`         | Jest                                              |
| `pnpm run format:check` | Prettier check                                    |
| `pnpm run eas-build`    | EAS development build, Android                    |

## Definition of done

- [ ] Feature acceptance criteria implemented
- [ ] Tests added
- [ ] `pnpm run lint && pnpm run typecheck && pnpm run test` all pass
- [ ] No secrets introduced, nothing sensitive placed in an `EXPO_PUBLIC_` var
- [ ] `src/types` updated if a server contract changed
- [ ] `.env.example` updated if new env vars added

## Branch and commit discipline

- Feature branches off `main`.
- Commits: `type(scope): message` — e.g. `feat(booking): add QR ticket screen`.
- No direct pushes to `main`.
