# Исправление перекрытия ввода клавиатурой на AuthScreen

Реализация эффекта "sticky" для нижнего блока авторизации, чтобы при открытии клавиатуры поле ввода оставалось видимым и прижималось к верхнему краю клавиатуры.

## User Review Required

> [!IMPORTANT]
> Мы будем использовать `KeyboardAvoidingView`. На разных платформах (iOS/Android) это может вести себя по-разному. Я настрою адаптивное поведение, чтобы на обеих платформах поле ввода "всплывало" вместе с клавиатурой.

## Proposed Changes

### Mobile App - Auth Feature

#### [MODIFY] [AuthScreen.tsx](file:///Users/kanishchev/Projects/trefix/frontend/apps/mobile/src/features/auth/AuthScreen.tsx)
- Добавление `KeyboardAvoidingView` для обертки `actionsContainer`.
- Настройка `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`.
- Убедиться, что `VideoView` и `overlay` остаются на заднем плане и не реагируют на клавиатуру (сохранение полноэкранного фона).

## Verification Plan

### Manual Verification
1. Открыть приложение на симуляторе/устройстве.
2. Нажать на поле ввода электронной почты.
3. Убедиться, что:
    * Клавиатура не перекрывает поле ввода.
    * Весь блок `actionsContainer` плавно поднимается вверх.
    * Текст соглашения остается под полем ввода (над клавиатурой).
    * Видео на фоне не сжимается и остается полноэкранным.
