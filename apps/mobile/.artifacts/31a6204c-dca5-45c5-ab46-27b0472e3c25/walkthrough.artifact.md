# Рефакторинг экрана AuthScreen

Структура экрана приведена в соответствие с архитектурными гайдлайнами проекта. Проведена декомпозиция компонентов и вынос управления макетом на уровень экрана.

## Что было сделано

1.  **Созданы новые UI-компоненты**:
    *   [AuthDivider.tsx](file:///Users/kanishchev/Projects/trefix/frontend/apps/mobile/src/features/auth/components/AuthDivider.tsx) — компонент для разделителя «или».
    *   [AuthLegalAgreement.tsx](file:///Users/kanishchev/Projects/trefix/frontend/apps/mobile/src/features/auth/components/AuthLegalAgreement.tsx) — компонент для юридического соглашения.
2.  **Оптимизирован AuthSocialButtons**:
    *   [AuthSocialButtons.tsx](file:///Users/kanishchev/Projects/trefix/frontend/apps/mobile/src/features/auth/components/AuthSocialButtons.tsx) теперь отвечает только за кнопки социальных сетей.
    *   Из компонента удалено абсолютное позиционирование, что делает его более универсальным.
3.  **Обновлен AuthScreen**:
    *   [AuthScreen.tsx](file:///Users/kanishchev/Projects/trefix/frontend/apps/mobile/src/features/auth/AuthScreen.tsx) теперь является оркестратором.
    *   Все компоненты (`AuthSocialButtons`, `AuthDivider`, `AuthEmailField`, `AuthLegalAgreement`) собраны в `actionsContainer` с использованием `gap` для управления отступами.
    *   Используется `useSafeAreaInsets` для корректного отображения на устройствах с "челками" и без них.

## Преимущества новой структуры

*   **Flat Structure**: Плоская структура в `AuthScreen` облегчает понимание иерархии UI.
*   **Reusability**: Компоненты стали более независимыми и их легче использовать на других экранах, если возникнет такая необходимость.
*   **Maintainability**: Логика разделена, изменения в одном компоненте не затрагивают другие.

> [!NOTE]
> Ссылки на условия и политику по-прежнему берутся из `.env` файла, созданного на предыдущем этапе.
