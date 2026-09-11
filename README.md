# workspace frontend

Monorepo frontend scaffold for:

- `Next.js` app in `apps/web`
- `React Native` mobile app placeholder in `apps/mobile`
- shared packages in `packages/*`

## Design system

The web design system is expected to be initialized and maintained only through the `shadcn` CLI using preset `beqC8BzE`.

## Next steps

1. Install dependencies with `pnpm install`.
2. Run `pnpm dlx shadcn@latest init -t next --monorepo --preset beqC8BzE` from `frontend`.
3. Add or refresh components from `apps/web` with `pnpm dlx shadcn@latest add <component>`.
