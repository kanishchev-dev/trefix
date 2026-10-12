# Trefix frontend

Монорепо на pnpm + Turborepo.

| Путь | Что это |
|---|---|
| `apps/web` | Админка на Next.js (порт 3001) |
| `apps/mobile` | Мобильное приложение на Expo / React Native |
| `packages/api-client` | Контракт API и клиент — см. [packages/api-client/README.md](packages/api-client/README.md) |
| `packages/tokens` | Дизайн-токены (общие для web и mobile) |
| `packages/ui`, `packages/ui-native` | UI-компоненты web (shadcn) и mobile |
| `packages/utils` | Общие утилиты |
| `packages/config`, `packages/eslint-config` | Общие настройки TS и ESLint |

## Команды (из корня `frontend`)

| Команда | Что делает |
|---|---|
| `pnpm install` | Установить зависимости |
| `pnpm dev:web` / `pnpm dev:mobile` | Запустить web / mobile |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Проверки по всему монорепо через Turborepo |
| `pnpm build` | Сборка |

Сборка web: `NODE_ENV` в окружении шелла не должен быть выставлен в `development`, иначе `next build` падает.

## API

Типы и схемы ответов бэкенда генерируются из OpenAPI. После любых изменений API на бэкенде обновите контракт по инструкции в [packages/api-client/README.md](packages/api-client/README.md).

## Design system (web)

Компоненты web добавляются только через shadcn CLI (пресет `beqC8BzE`), из `apps/web`: `pnpm dlx shadcn@latest add <component>`.

## E2E

Не настроены. Для mobile нужен симулятор (Detox или Maestro), для web — Playwright против запущенного бэкенда.
