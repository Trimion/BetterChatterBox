# Карта модулей BetterChatterBox (BCB)

## Обзор архитектуры

```
┌─────────────────────────────────────────────────────────────┐
│                    MANIFEST V3 LAYER                       │
├─────────────────────────────────────────────────────────────┤
│  manifest.json - Конфигурация расширения                   │
│  rules.json - Правила блокировки                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKGROUND LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  background.js (Service Worker)                            │
│  ├── Управление жизненным циклом                           │
│  ├── Обработка сообщений                                   │
│  ├── Управление настройками                                │
│  ├── Система логирования                                   │
│  └── API для других компонентов                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CONTENT LAYER                           │
├─────────────────────────────────────────────────────────────┤
│  content.js (Content Script)                               │
│  ├── Внедрение в веб-страницы                              │
│  ├── Автоматический поиск                                  │
│  ├── Применение настроек                                   │
│  └── Интеграция с модулями                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   MODULE LAYER                             │
├─────────────────────────────────────────────────────────────┤
│  js/modules/                                               │
│  ├── utils.js (Базовые утилиты)                            │
│  ├── data.js (Обработка данных)                            │
│  ├── filters.js (Фильтрация)                               │
│  ├── MarkerModule.js (Визуализация)                        │
│  ├── autosearch.js (Автопоиск)                             │
│  ├── financialModule.js (Финансы)                          │
│  └── ticketModule.js (Тикеты)                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   UI LAYER                                 │
├─────────────────────────────────────────────────────────────┤
│  popup.js + popup.html + popup.css                         │
│  options.html + options.css                                │
│  info.html                                                 │
└─────────────────────────────────────────────────────────────┘
```

## Детальная карта модулей

### 1. КОРЕВЫЕ МОДУЛИ

#### `background.js` (2917 строк)
**Роль:** Service Worker - центральный компонент системы
**Зависимости:** Нет (базовый модуль)
**Зависит от него:** Все остальные модули

**Основные функции:**
- `initializeExtension()` - инициализация расширения
- `handleMessages()` - обработка сообщений между компонентами
- `manageSettings()` - управление настройками
- `handleCommands()` - обработка горячих клавиш
- `loggingSystem()` - система логирования
- `notificationManager()` - управление уведомлениями

**API для других модулей:**
```javascript
// Получение настроек
chrome.runtime.sendMessage({action: "getSettings"}, callback);

// Отправка уведомления
chrome.runtime.sendMessage({action: "showNotification", data: {...}});

// Логирование
chrome.runtime.sendMessage({action: "log", data: {...}});
```

#### `content.js` (1325 строк)
**Роль:** Content Script - внедрение в веб-страницы
**Зависимости:** `background.js`, все модули из `js/modules/`
**Зависит от него:** UI компоненты

**Основные функции:**
- `performSearchAndNotify()` - автоматический поиск
- `applySettings()` - применение настроек к интерфейсу
- `attachUserActionListeners()` - отслеживание действий пользователя
- `integrateWithModules()` - интеграция с модулями

### 2. МОДУЛЬНАЯ АРХИТЕКТУРА

#### `js/modules/utils.js` (397 строк)
**Роль:** Базовые утилиты и хелперы
**Зависимости:** Нет
**Зависит от него:** Все остальные модули

**Ключевые функции:**
```javascript
// Логирование
Utils.log(...args)
Utils.warn(...args)
Utils.error(...args)

// Проверка контекста
Utils.isExtensionContextValid()

// Работа с DOM
Utils.findElement(selector)
Utils.waitForElement(selector, timeout)

// Валидация
Utils.validateTicketId(id)
Utils.validateDriverData(data)

// Форматирование
Utils.formatText(text)
Utils.formatDate(date)
```

#### `js/modules/data.js` (217 строк)
**Роль:** Обработка и валидация данных
**Зависимости:** `utils.js`
**Зависит от него:** `filters.js`, `autosearch.js`

**Ключевые функции:**
```javascript
// Валидация данных
DataModule.validateTicketId(id)
DataModule.validateDriverInfo(driverData)

// Парсинг данных
DataModule.parseCountryInfo(text)
DataModule.parseDriverLicense(text)
DataModule.parseTags(tags)

// Обработка данных
DataModule.processDriverData(rawData)
DataModule.extractTicketInfo(pageContent)
```

#### `js/modules/filters.js` (477 строк)
**Роль:** Система фильтрации и поиска
**Зависимости:** `utils.js`, `data.js`
**Зависит от него:** `autosearch.js`, `MarkerModule.js`

**Ключевые функции:**
```javascript
// Поиск элементов
FiltersModule.findElementsByText(text)
FiltersModule.findElementsBySelector(selector)
FiltersModule.findButtonsByText(text)

// Фильтрация данных
FiltersModule.filterByTags(data, tags)
FiltersModule.filterByCountry(data, country)
FiltersModule.filterByProfession(data, profession)

// Обработка результатов
FiltersModule.processSearchResults(results)
FiltersModule.validateSearchResults(results)
```

#### `js/modules/MarkerModule.js` (478 строк)
**Роль:** Цветовая индикация элементов
**Зависимости:** `utils.js`, `filters.js`
**Зависит от него:** UI компоненты

**Ключевые функции:**
```javascript
// Управление маркерами
MarkerModule.addMarker(text, color)
MarkerModule.removeMarker(text)
MarkerModule.updateMarkers(markers)
MarkerModule.clearAllMarkers()

// Настройки
MarkerModule.toggleEnabled(enabled)
MarkerModule.setMarkerColor(text, color)
MarkerModule.setMarkerConditions(conditions)
```

#### `js/modules/autosearch.js` (910 строк)
**Роль:** Автоматический поиск информации
**Зависимости:** `utils.js`, `data.js`, `filters.js`
**Зависит от него:** `content.js`

**Ключевые функции:**
```javascript
// Автопоиск
AutosearchModule.searchCountryAndLicense()
AutosearchModule.searchTesting()
AutosearchModule.searchLastOrders()
AutosearchModule.searchPresets()

// Управление состоянием
AutosearchModule.resetAutosearchState()
AutosearchModule.isAutosearchEnabled()
AutosearchModule.setAutosearchEnabled(enabled)
```

#### `js/modules/financialModule.js` (1012 строк)
**Роль:** Финансовые расчеты и анализ
**Зависимости:** `utils.js`, `data.js`
**Зависит от него:** `content.js`

**Ключевые функции:**
```javascript
// Анализ финансовых данных
FinancialModule.analyzeFinalCalculation()
FinancialModule.calculateTariffs()
FinancialModule.processFinancialData(data)

// Экспорт данных
FinancialModule.exportFinancialInfo()
FinancialModule.copyToClipboard(data)
```

#### `js/modules/ticketModule.js` (85 строк)
**Роль:** Работа с тикетами
**Зависимости:** `utils.js`, `data.js`
**Зависит от него:** `autosearch.js`

**Ключевые функции:**
```javascript
// Работа с тикетами
TicketModule.validateTicketId(id)
TicketModule.extractTicketInfo()
TicketModule.processTicketData(data)
```

### 3. СПЕЦИАЛИЗИРОВАННЫЕ МОДУЛИ

#### `js/notifications.js` (1153 строки)
**Роль:** Система уведомлений
**Зависимости:** `utils.js`
**Зависит от него:** `background.js`, `content.js`

**Ключевые функции:**
```javascript
// Создание уведомлений
NotificationsModule.createNotification(title, message, options)
NotificationsModule.showDriverInfo(driverData)
NotificationsModule.showSearchResults(results)

// Управление очередью
NotificationsModule.addToQueue(notification)
NotificationsModule.processQueue()
NotificationsModule.clearQueue()

// Экспорт
NotificationsModule.exportNotifications()
NotificationsModule.saveToFile(data)
```

#### `js/buttonSearch.js` (956 строк)
**Роль:** Поиск и обработка кнопок
**Зависимости:** `utils.js`, `filters.js`
**Зависит от него:** `background.js`

**Ключевые функции:**
```javascript
// Поиск кнопок
ButtonSearchModule.findButtonByText(text)
ButtonSearchModule.findDriverButton()
ButtonSearchModule.findSearchButton()

// Обработка кнопок
ButtonSearchModule.clickButton(button)
ButtonSearchModule.handleButtonClick(event)
ButtonSearchModule.autoClickButton(text)
```

#### `js/smsButton.js` (1711 строк)
**Роль:** Автозаполнение SMS форм
**Зависимости:** `utils.js`, `data.js`
**Зависит от него:** `content.js`

**Ключевые функции:**
```javascript
// Заполнение форм
SMSModule.fillSMSForm(template)
SMSModule.autoFillForm()
SMSModule.validateForm(form)

// Шаблоны
SMSModule.loadTemplate(name)
SMSModule.saveTemplate(name, template)
SMSModule.getDefaultTemplate()
```

#### `js/settings.js` (2239 строк)
**Роль:** Управление настройками
**Зависимости:** `utils.js`
**Зависит от него:** Все модули

**Ключевые функции:**
```javascript
// Управление настройками
SettingsModule.saveSettings(settings)
SettingsModule.loadSettings()
SettingsModule.resetSettings()
SettingsModule.validateSettings(settings)

// Экспорт/Импорт
SettingsModule.exportSettings()
SettingsModule.importSettings(data)
SettingsModule.createBackup()
```

### 4. UI КОМПОНЕНТЫ

#### `js/popup.js` (617 строк)
**Роль:** Логика всплывающего окна
**Зависимости:** `utils.js`, `settings.js`
**Зависит от него:** `popup.html`

#### `popup.html` / `popup.css`
**Роль:** Интерфейс всплывающего окна
**Зависимости:** `popup.js`

#### `options.html` / `options.css`
**Роль:** Страница настроек
**Зависимости:** `settings.js`

## Диаграмма зависимостей

```
background.js
    │
    ├── settings.js
    │   └── utils.js
    │
    ├── notifications.js
    │   └── utils.js
    │
    └── buttonSearch.js
        ├── utils.js
        └── filters.js
            ├── utils.js
            └── data.js
                └── utils.js

content.js
    │
    ├── background.js
    │
    ├── utils.js
    │
    ├── data.js
    │   └── utils.js
    │
    ├── filters.js
    │   ├── utils.js
    │   └── data.js
    │
    ├── MarkerModule.js
    │   ├── utils.js
    │   └── filters.js
    │
    ├── autosearch.js
    │   ├── utils.js
    │   ├── data.js
    │   └── filters.js
    │
    ├── financialModule.js
    │   ├── utils.js
    │   └── data.js
    │
    ├── ticketModule.js
    │   ├── utils.js
    │   └── data.js
    │
    └── smsButton.js
        ├── utils.js
        └── data.js

popup.js
    ├── utils.js
    └── settings.js
        └── utils.js
```

## Принципы взаимодействия

### 1. Система сообщений
- Все компоненты общаются через `chrome.runtime.sendMessage`
- Background script выступает как центральный хаб
- Content scripts могут общаться только с background

### 2. Управление состоянием
- Настройки хранятся в `chrome.storage.local`
- Состояние синхронизируется через background script
- Каждый модуль может запрашивать актуальные настройки

### 3. Логирование
- Централизованная система логирования через `Utils`
- Логи могут быть включены/отключены в настройках
- Поддержка экспорта логов в файл

### 4. Обработка ошибок
- Все модули используют try-catch блоки
- Ошибки логируются через `Utils.error()`
- Graceful degradation при сбоях

## Рекомендации по разработке

### 1. Добавление нового модуля
1. Создать файл в `js/modules/`
2. Использовать IIFE паттерн
3. Добавить зависимости в начало файла
4. Экспортировать через `window.ModuleName`
5. Добавить в `manifest.json` если необходимо

### 2. Добавление новой функции
1. Определить подходящий модуль
2. Добавить настройки в `settings.js`
3. Обновить UI в соответствующих HTML файлах
4. Добавить обработку в `background.js`
5. Протестировать интеграцию

### 3. Отладка
1. Включить логирование в настройках
2. Использовать DevTools для background и content scripts
3. Проверить консоль браузера
4. Использовать `Utils.log()` для отладки

---

*Карта модулей обновлена для версии 2.1.6.36*
