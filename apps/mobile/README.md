# mobile

Expo-based React Native app for the `workspace` monorepo.

## Start

1. Make sure Node is available through `nvm`.
2. From `frontend`, run `pnpm install` if dependencies are missing.
3. Start the app with `pnpm --dir apps/mobile dev`.
4. Use the Expo launcher to open Android, iOS or web.

## Scripts

- `pnpm --dir apps/mobile dev`
- `pnpm --dir apps/mobile android`
- `pnpm --dir apps/mobile ios`
- `pnpm --dir apps/mobile web`
- `pnpm --dir apps/mobile typecheck`

## Rules

- Theme preferences use `AsyncStorage`.
- Secrets and tokens use `SecureStore`.
- Navigation is handled with `React Navigation`.
- Shared tokens come from `@workspace/tokens`.
- Platform-agnostic code stays in `packages/*`.
