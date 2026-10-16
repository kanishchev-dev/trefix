# mobile

Приложение Trefix на Expo (SDK 57, React Native 0.86, New Architecture, Hermes).

- iOS bundle id и Android package: `Kanishchev.Trefix`.
- Нативные модули (HealthKit, Health Connect, Mapbox, Google/Apple Sign-In, фоновые задачи, геолокация) в Expo Go не работают. Нужна нативная сборка (dev build), см. ниже.
- Папки `ios/` и `android/` генерирует `expo prebuild` из `app.json`. Руками их не правим, все настройки делаем в `app.json` и плагинах. Ручные правки в них потеряются при следующем prebuild.

## Окружение

Переменные лежат в `apps/mobile/.env`, образец — `.env.example`. Туда кладём только публичные значения `EXPO_PUBLIC_*`, они попадают в бандл. После изменения перезапустите Metro с очисткой кэша: `npx expo start -c`.

| Переменная | Назначение |
|---|---|
| `EXPO_PUBLIC_BACKEND_URL` | URL бэкенда. В dev `127.0.0.1` и LAN-адреса автоматически заменяются на хост Metro, поэтому телефон в той же сети достучится до бэкенда на Mac |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Web client ID для Google Sign-In |
| `EXPO_PUBLIC_MAPBOX_TOKEN` | Публичный токен Mapbox (`pk.…`). Если пусто, карты трекера не показываются |
| `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_PRIVACY_URL` | Ссылки на условия и политику |
| `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` | Только Android: секретный токен Mapbox (`sk.…`, scope `DOWNLOADS:READ`), если Gradle получает 401 при загрузке SDK. В бандл не попадает |

## Общая подготовка

```bash
cd frontend
pnpm install          # заодно применяет патчи из frontend/patches (expo-modules-jsi)
```

Нативную сборку обновляйте после любого из изменений:
- `app.json`: плагины, permissions, иконки, splash;
- нативная зависимость: добавили, удалили или обновили;
- `frontend/patches/*`.

Для изменений только в JS/TS пересборка не нужна, хватит перезапуска Metro.

## iOS

Нужно: macOS, Xcode с установленными Command Line Tools, CocoaPods. Для запуска на телефоне — Apple ID в Xcode и подключённый iPhone с включённым Developer Mode. HealthKit и фоновая геолокация полноценно работают только на реальном устройстве.

**Быстро (dev build на подключённом устройстве):**

```bash
cd frontend/apps/mobile
npx expo run:ios --device
```

**Чистая пересборка** — после изменений `app.json`, нативных зависимостей или патчей:

```bash
frontend/apps/mobile/scripts/ios-rebuild.sh
```

Скрипт выполняет:
1. `pnpm install`;
2. `expo prebuild --platform ios`;
3. `pod install`;
4. проверку, что патч `expo-modules-jsi` применён;
5. очистку DerivedData Trefix;
6. `expo run:ios --device`.

Аргументы пробрасываются в `expo run:ios`. При ошибке скрипт выводит уникальные строки `error:` из `.expo/xcodebuild.log`.

**Симулятор:** `npx expo run:ios`, без `--device`.

**Release / TestFlight:**
1. Выполните `npx expo prebuild --platform ios`.
2. Откройте `ios/Trefix.xcworkspace` в Xcode.
3. В Signing & Capabilities выберите команду. Capability HealthKit и Sign in with Apple должны быть включены, их добавляют плагины.
4. Схема Trefix, Product → Archive, затем Distribute App.

Версии задаются в `app.json`: `version`, а для build number — `ios.buildNumber`. После изменения повторите prebuild.

## Android

Нужно: JDK 17, Android SDK (Android Studio), `ANDROID_HOME` в окружении, устройство с включённой отладкой по USB или эмулятор. `minSdkVersion` равен 26. Для Health Connect на устройстве должно быть установлено приложение Health Connect (на Android 14+ оно встроено).

**Быстро (dev build):**

```bash
cd frontend/apps/mobile
npx expo run:android --device
```

**Чистая пересборка:**

```bash
frontend/apps/mobile/scripts/android-rebuild.sh                     # debug
frontend/apps/mobile/scripts/android-rebuild.sh --variant release   # release
```

Скрипт выполняет:
1. `pnpm install`;
2. `expo prebuild --platform android`;
3. удаление `android/app/build`, `.cxx`, `android/build`, `android/.gradle`;
4. `expo run:android --device`.

`gradlew clean` не используется: на New Architecture он падает на CMake/codegen. Лог сборки пишется в `.expo/gradle.log`, при ошибке скрипт выводит выжимку.

**APK / AAB без запуска:**

```bash
cd frontend/apps/mobile/android
./gradlew assembleRelease   # APK: app/build/outputs/apk/release/
./gradlew bundleRelease     # AAB для Google Play: app/build/outputs/bundle/release/
```

⚠️ Сейчас release подписывается **debug-ключом**, так настроил prebuild по умолчанию. Для Google Play нужен свой upload keystore:
- через config-плагин или `android/app/build.gradle` + `gradle.properties` (тогда это нужно повторять после каждого prebuild);
- либо через EAS Build с credentials. `eas.json` в проекте пока нет.

Версии задаются в `app.json`: `version`, а для version code — `android.versionCode`.

## Пуш-уведомления

Пуши идут через Expo Push Service (`expo-notifications`, плагин подключён в `app.json`). Приложение само регистрирует токен (`PUT /v1/notifications/devices`) при старте и при возврате из фона, но только если разрешение уже выдано. Само разрешение запрашивается с экрана «Уведомления» (колокольчик на «Сегодня»).

Чтобы токен выдавался, нужно:
- привязать проект к EAS: `npx eas init` записывает `extra.eas.projectId` в `app.json`;
- загрузить ключи: APNs key для iOS (`eas credentials`) и FCM v1 service account для Android (`google-services.json` + ключ в проекте Expo);
- собрать нативную сборку после добавления плагина. В Expo Go на Android удалённые пуши не работают; входящие в приложении при этом работают.

Без `projectId` или в симуляторе регистрация тихо пропускается, остаются только входящие и realtime-бейдж.

## Без нативной сборки

```bash
pnpm --dir apps/mobile dev     # Metro для уже установленного dev build
pnpm --dir apps/mobile typecheck
pnpm --dir apps/mobile test
pnpm --dir apps/mobile lint
npx expo export --platform ios       # проверка, что JS-бандл собирается (то же для android)
```

## Правила

- Настройки темы хранятся в `AsyncStorage`, секреты и токены — в `SecureStore`.
- Навигация — React Navigation.
- Токены дизайна берутся из `@trefix/tokens`, типы и схемы API — из `@trefix/api-client` (см. его README).
- Платформонезависимый код выносится в `packages/*`.
