# Trefix backend

NestJS 11, PostgreSQL (Sequelize), Redis. Правила разработки — `documents/backend-development-guidelines.md`.

## Запуск

```bash
npm install
npm run db:migrate
npm run db:seed
npm run start:dev
```

Конфигурация — переменные окружения, проверяются при старте (`src/config/validation.schema.ts`).

## Проверки

| Команда | Что делает |
|---|---|
| `npm run lint` | ESLint с автофиксом |
| `npm test` | Unit-тесты |
| `npm run test:e2e` | E2E-тесты (`test/`) |
| `npm run build` | Сборка в `dist/` |

## API и контракт с фронтендом

Swagger UI поднимается вместе с приложением: `http://localhost:<PORT>/docs`. Документ OpenAPI собирается из DTO (`@ApiProperty`) в `src/openapi/swagger-document.ts`, и по нему фронтенд генерирует свой контракт.

После изменения любого DTO, ответа или эндпоинта:

```bash
npm run openapi:export ../frontend/packages/api-client/openapi/openapi.json
npx jest --config test/jest-e2e.json test/openapi.e2e-spec.ts   # guard-тесты спеки
```

затем `pnpm generate` во `frontend/packages/api-client`. Подробности и правила — в `frontend/packages/api-client/README.md`.

Требования к DTO ответов:
- у каждого свойства конкретный тип: для `T | null` — `type` и `nullable: true`, для объектов — DTO-класс, а не `Object`;
- поле, которое приходит всегда (пусть и `null`), — `@ApiProperty`, а не `@ApiPropertyOptional`;
- DTO по возможности `implements` view-интерфейс сервиса, чтобы `tsc` ловил расхождения.
