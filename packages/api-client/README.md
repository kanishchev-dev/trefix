# @workspace/api-client

Общий клиент API для `apps/web` и `apps/mobile`: zod-схемы, типы, константы и `createApiClient`.

## Контракт API

**Контракт** — это машиночитаемое описание того, что принимает и отдаёт бэкенд: эндпоинты, тела запросов, форматы ответов. Источник истины — DTO бэкенда, по ним NestJS строит документ OpenAPI. Из документа генерируются zod-схемы и TS-типы, которыми фронтенд валидирует ответы.

Цепочка:

```
backend DTO (@ApiProperty)  →  openapi/openapi.json  →  src/generated/*  →  src/index.ts  →  web / mobile
        npm run openapi:export           pnpm generate         алиасы и нормализация
```

| Файл / папка | Что это | Править руками? |
|---|---|---|
| `openapi/openapi.json` | Документ OpenAPI, экспортированный из бэкенда | Нет — только экспортом |
| `src/generated/` | Сгенерированные zod-схемы (`zod.gen.ts`) и типы (`types.gen.ts`) | Нет — только `pnpm generate` |
| `src/index.ts` | Публичный API пакета. Схемы ответов — алиасы сгенерированных (`contract.zXxxDto`); там, где нужна клиентская нормализация (`.default`, `.transform`), схема своя | Да |
| `src/contract-compat.ts` | Проверки типов: ручные схемы запросов совместимы с DTO бэкенда, ручные схемы ответов принимают всё, что может прислать бэкенд. Ничего не выполняет — падает `tsc` | Да, при добавлении схем |
| `contract/check.ts` | Живая проверка: сценарий против запущенного бэкенда, каждый ответ прогоняется через сгенерированную схему | Да, при новых эндпоинтах |
| `openapi-ts.config.ts` | Настройки генератора `@hey-api/openapi-ts` | Редко |

## Когда и как обновлять

Любое изменение DTO, ответа или эндпоинта на бэкенде:

1. **Экспорт спеки** (из `backend`, БД и Redis не нужны):
   ```bash
   npm run openapi:export ../frontend/packages/api-client/openapi/openapi.json
   ```
2. **Генерация** (из `frontend/packages/api-client`):
   ```bash
   pnpm generate
   ```
3. **Проверка типов во всём монорепо** (из `frontend`): `pnpm typecheck`. Ошибки показывают, где фронтенд расходится с новым контрактом.
4. **Живая проверка** (бэкенд запущен, аккаунт с правами админа, лучше dev-БД — сценарий создаёт и удаляет свои данные, стартует и отменяет план):
   ```bash
   CONTRACT_API_URL=http://localhost:3000 CONTRACT_EMAIL=... CONTRACT_PASSWORD=... pnpm contract:check
   ```
   `CONTRACT_VERBOSE=1` дополнительно выводит поля, которые в контракте optional, но приходят всегда — кандидаты сделать обязательными на бэкенде.
5. Закоммитить `openapi/openapi.json` и `src/generated/` вместе с изменениями бэкенда.

Тест `test/generated.test.ts` падает, если `src/generated/` не совпадает с `openapi/openapi.json` (забыли `pnpm generate`).

## Правила

- **Ответы**: по умолчанию алиас сгенерированной схемы — `export const fooSchema = contract.zFooResponseDto;`. Своя схема — только ради нормализации на клиенте; тогда добавьте её в `ResponseChecks` в `contract-compat.ts`.
- **Запросы**: схемы форм и тел пишутся руками (валидация UI, сообщения), но их тип обязан быть совместим с DTO — добавьте строку в `RequestChecks`. Сгенерированные схемы запросов с `.default()` для отправки не использовать: дефолты допишут поля, которые пользователь не трогал.
- **Енумы** берутся из контракта (`WORKOUT_TYPES`, `workoutStatusSchema`, `metricsSourceSchema` …), а не дублируются строками.
- **Если контракт врёт** (схема не принимает реальный ответ или срезает поля) — чинить DTO на бэкенде, а не ослаблять схему на фронте.

## На бэкенде

- `src/openapi/swagger-document.ts` — сборка документа и нормализация (nullable enum, без дефолтов в PATCH-телах).
- `test/openapi.e2e-spec.ts` — guard-тесты спеки: у каждого поля конкретный тип, нет пустых объектов, у каждого эндпоинта, который читают приложения, описан JSON-ответ, нет дефолтов в PATCH. Запуск: `npx jest --config test/jest-e2e.json test/openapi.e2e-spec.ts`.
- DTO ответа по возможности `implements` соответствующий view-интерфейс сервиса, чтобы `tsc` ловил расхождения формы.

## Команды

| Команда | Что делает |
|---|---|
| `pnpm generate` | Перегенерировать `src/generated/` из `openapi/openapi.json` |
| `pnpm contract:check` | Живая проверка против бэкенда |
| `pnpm test` | Тесты пакета (клиент, схемы, свежесть генерации) |
| `pnpm typecheck` | `tsc`, включая `contract-compat.ts` |
