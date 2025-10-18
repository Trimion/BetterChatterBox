# Технические спецификации BetterChatterBox (BCB)

## Версия: 2.1.6.36

## Обзор системы

BetterChatterBox - это расширение для браузера Chrome, построенное на архитектуре Manifest V3. Система использует модульный подход с четким разделением ответственности между компонентами.

## Архитектурные принципы

### 1. Модульность
- Каждый модуль отвечает за конкретную функциональность
- Модули независимы друг от друга
- Используется паттерн IIFE (Immediately Invoked Function Expression)
- Экспорт через глобальный объект `window`

### 2. Безопасность
- Проверка контекста расширения перед выполнением операций
- Валидация всех входных данных
- Безопасное логирование с настройками
- Обработка ошибок с graceful degradation

### 3. Производительность
- Ленивая загрузка модулей
- Кэширование результатов операций
- Оптимизация DOM-операций
- Минимизация сетевых запросов

### 4. Расширяемость
- Плагинная архитектура
- Настраиваемые параметры
- Система событий
- API для интеграции

## API документация

### 1. Система сообщений

#### Отправка сообщений
```javascript
// Отправка сообщения в background script
chrome.runtime.sendMessage({
  action: "actionName",
  data: {...},
  source: "moduleName"
}, (response) => {
  // Обработка ответа
  if (chrome.runtime.lastError) {
    console.error('Ошибка отправки сообщения:', chrome.runtime.lastError);
    return;
  }
  // Обработка успешного ответа
});
```

#### Получение сообщений
```javascript
// В background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "getSettings":
      handleGetSettings(sendResponse);
      return true; // Асинхронный ответ
    case "showNotification":
      handleShowNotification(message.data);
      sendResponse({success: true});
      break;
    default:
      sendResponse({error: "Unknown action"});
  }
});
```

### 2. Хранилище настроек

#### Сохранение настроек
```javascript
// Сохранение одиночной настройки
chrome.storage.local.set({key: value}, () => {
  if (chrome.runtime.lastError) {
    console.error('Ошибка сохранения:', chrome.runtime.lastError);
  }
});

// Сохранение объекта настроек
chrome.storage.local.set({
  searchEnabled: true,
  markerEnabled: false,
  notificationsEnabled: true
}, () => {
  console.log('Настройки сохранены');
});
```

#### Загрузка настроек
```javascript
// Загрузка конкретных настроек
chrome.storage.local.get(['searchEnabled', 'markerEnabled'], (result) => {
  const searchEnabled = result.searchEnabled;
  const markerEnabled = result.markerEnabled;
});

// Загрузка всех настроек
chrome.storage.local.get(null, (result) => {
  // result содержит все сохраненные настройки
});
```

### 3. Система уведомлений

#### Создание уведомления
```javascript
// Простое уведомление
chrome.notifications.create({
  type: 'basic',
  iconUrl: 'img/48.png',
  title: 'Заголовок уведомления',
  message: 'Текст уведомления'
});

// Уведомление с кнопками
chrome.notifications.create({
  type: 'basic',
  iconUrl: 'img/48.png',
  title: 'Заголовок',
  message: 'Сообщение',
  buttons: [
    {title: 'Кнопка 1'},
    {title: 'Кнопка 2'}
  ]
});
```

#### Обработка событий уведомлений
```javascript
// Клик по уведомлению
chrome.notifications.onClicked.addListener((notificationId) => {
  console.log('Клик по уведомлению:', notificationId);
});

// Клик по кнопке уведомления
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  console.log('Клик по кнопке:', buttonIndex);
});
```

### 4. Content Scripts API

#### Внедрение в страницу
```javascript
// В manifest.json
"content_scripts": [
  {
    "matches": ["*://*.yandex-team.ru/*"],
    "js": ["js/modules/utils.js", "js/content.js"],
    "run_at": "document_end"
  }
]
```

#### Взаимодействие с DOM
```javascript
// Поиск элементов
const element = document.querySelector(selector);
const elements = document.querySelectorAll(selector);

// Ожидание появления элемента
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error('Element not found'));
    }, timeout);
  });
}
```

### 5. Utils API

#### Логирование
```javascript
// Базовое логирование
Utils.log('Информационное сообщение');
Utils.warn('Предупреждение');
Utils.error('Ошибка');

// Логирование с данными
Utils.log('Данные водителя:', driverData);
Utils.error('Ошибка валидации:', error);
```

#### Работа с DOM
```javascript
// Поиск элемента
const element = Utils.findElement('.driver-card');

// Ожидание элемента
Utils.waitForElement('.driver-info', 3000).then(element => {
  // Элемент найден
}).catch(error => {
  // Элемент не найден
});

// Проверка видимости
const isVisible = Utils.isElementVisible(element);
```

#### Валидация данных
```javascript
// Валидация ID тикета
const isValid = Utils.validateTicketId('ESA-1234');

// Валидация данных водителя
const isValidDriver = Utils.validateDriverData(driverData);

// Валидация URL
const isValidUrl = Utils.isValidUrl(url);
```

### 6. Модули API

#### DataModule
```javascript
// Парсинг информации о стране
const countryInfo = DataModule.parseCountryInfo(text);

// Парсинг водительских прав
const licenseInfo = DataModule.parseDriverLicense(text);

// Обработка тегов
const processedTags = DataModule.parseTags(tags);

// Валидация данных тикета
const isValidTicket = DataModule.validateTicketId(id);
```

#### FiltersModule
```javascript
// Поиск элементов по тексту
const elements = FiltersModule.findElementsByText('Водитель');

// Поиск кнопок
const buttons = FiltersModule.findButtonsByText('Поиск');

// Фильтрация данных
const filteredData = FiltersModule.filterByTags(data, ['auto_courier']);

// Обработка результатов поиска
const processedResults = FiltersModule.processSearchResults(results);
```

#### MarkerModule
```javascript
// Добавление маркера
MarkerModule.addMarker('Актив Отмены', '#ff0000');

// Удаление маркера
MarkerModule.removeMarker('Актив Отмены');

// Обновление всех маркеров
MarkerModule.updateMarkers([
  {text: 'Маркер 1', color: '#ff0000'},
  {text: 'Маркер 2', color: '#00ff00'}
]);

// Включение/выключение модуля
MarkerModule.toggleEnabled(true);
```

#### AutosearchModule
```javascript
// Поиск страны и ВУ
AutosearchModule.searchCountryAndLicense();

// Поиск тестирования
AutosearchModule.searchTesting();

// Поиск последних заказов
AutosearchModule.searchLastOrders();

// Сброс состояния
AutosearchModule.resetAutosearchState();
```

## Структуры данных

### 1. Настройки расширения
```javascript
const defaultSettings = {
  // Поиск
  searchEnabled: true,
  searchDriverInfo: true,
  searchTesting: true,
  searchLastOrders: true,
  searchPresets: true,
  
  // Маркеры
  markerEnabled: false,
  markers: [],
  
  // Уведомления
  notificationsEnabled: true,
  notificationSound: true,
  notificationDuration: 5000,
  
  // SMS
  smsEnabled: true,
  smsTemplate: '',
  
  // Логирование
  loggingEnabled: false,
  actionLoggingEnabled: false,
  
  // Горячие клавиши
  hotkeys: {
    runExtension: 'Alt+A',
    clickDriver: 'Alt+Z',
    clearNotifications: 'Alt+Shift+X',
    searchButton: 'Alt+Shift+S'
  }
};
```

### 2. Данные водителя
```javascript
const driverData = {
  id: 'driver_id',
  name: 'Имя Фамилия',
  country: 'Россия',
  license: '1234567890',
  profession: 'Водитель',
  tags: ['auto_courier', 'verified'],
  testing: {
    passed: true,
    score: 85,
    date: '2024-01-15'
  },
  lastOrders: [
    {
      id: 'order_1',
      date: '2024-01-15',
      status: 'completed'
    }
  ]
};
```

### 3. Данные тикета
```javascript
const ticketData = {
  id: 'ESA-1234',
  status: 'open',
  priority: 'high',
  driver: driverData,
  tags: ['urgent', 'payment_issue'],
  comments: [
    {
      author: 'support_agent',
      text: 'Комментарий',
      date: '2024-01-15T10:30:00Z'
    }
  ]
};
```

## Обработка ошибок

### 1. Типы ошибок
```javascript
// Ошибки валидации
class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

// Ошибки сети
class NetworkError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'NetworkError';
    this.status = status;
  }
}

// Ошибки расширения
class ExtensionError extends Error {
  constructor(message, module) {
    super(message);
    this.name = 'ExtensionError';
    this.module = module;
  }
}
```

### 2. Обработка ошибок
```javascript
// В модулях
try {
  const result = someOperation();
  return result;
} catch (error) {
  Utils.error('Ошибка в модуле:', error);
  
  if (error instanceof ValidationError) {
    // Обработка ошибки валидации
    return null;
  }
  
  if (error instanceof NetworkError) {
    // Обработка сетевой ошибки
    return null;
  }
  
  // Переброс неизвестной ошибки
  throw error;
}
```

### 3. Логирование ошибок
```javascript
// Централизованное логирование
function logError(error, context = {}) {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    context: context,
    timestamp: new Date().toISOString(),
    url: window.location.href
  };
  
  Utils.error('Ошибка:', errorInfo);
  
  // Отправка в background для сохранения
  chrome.runtime.sendMessage({
    action: 'logError',
    data: errorInfo
  }).catch(() => {
    // Игнорируем ошибки отправки
  });
}
```

## Производительность

### 1. Оптимизация DOM-операций
```javascript
// Использование DocumentFragment
function createMultipleElements(elements) {
  const fragment = document.createDocumentFragment();
  
  elements.forEach(elementData => {
    const element = document.createElement('div');
    element.textContent = elementData.text;
    fragment.appendChild(element);
  });
  
  document.body.appendChild(fragment);
}

// Использование requestAnimationFrame
function smoothUpdate() {
  requestAnimationFrame(() => {
    // Обновление DOM
    updateUI();
  });
}
```

### 2. Кэширование
```javascript
// Кэш для результатов поиска
const searchCache = new Map();

function cachedSearch(query) {
  if (searchCache.has(query)) {
    return searchCache.get(query);
  }
  
  const result = performSearch(query);
  searchCache.set(query, result);
  
  // Очистка кэша через 5 минут
  setTimeout(() => {
    searchCache.delete(query);
  }, 5 * 60 * 1000);
  
  return result;
}
```

### 3. Ленивая загрузка
```javascript
// Ленивая загрузка модулей
function loadModule(moduleName) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `js/modules/${moduleName}.js`;
    script.onload = () => resolve(window[moduleName]);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Использование
loadModule('financialModule').then(module => {
  module.analyzeFinalCalculation();
});
```

## Безопасность

### 1. Валидация входных данных
```javascript
// Валидация ID тикета
function validateTicketId(id) {
  if (typeof id !== 'string') {
    throw new ValidationError('ID тикета должен быть строкой', 'ticketId');
  }
  
  if (!/^[A-Z]{3}-\d{4}$/.test(id)) {
    throw new ValidationError('Неверный формат ID тикета', 'ticketId');
  }
  
  return true;
}

// Санитизация HTML
function sanitizeHtml(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}
```

### 2. Проверка контекста
```javascript
// Проверка контекста расширения
function isExtensionContext() {
  try {
    return chrome.runtime && chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

// Безопасное выполнение
function safeExecute(fn) {
  if (!isExtensionContext()) {
    Utils.warn('Выполнение вне контекста расширения');
    return null;
  }
  
  try {
    return fn();
  } catch (error) {
    Utils.error('Ошибка выполнения:', error);
    return null;
  }
}
```

## Тестирование

### 1. Unit тесты
```javascript
// Пример теста для Utils
describe('Utils', () => {
  test('validateTicketId should validate correct format', () => {
    expect(Utils.validateTicketId('ESA-1234')).toBe(true);
    expect(Utils.validateTicketId('INVALID')).toBe(false);
  });
  
  test('parseCountryInfo should extract country data', () => {
    const result = Utils.parseCountryInfo('Страна: Россия');
    expect(result.country).toBe('Россия');
  });
});
```

### 2. Integration тесты
```javascript
// Тест интеграции модулей
describe('Module Integration', () => {
  test('DataModule and FiltersModule should work together', () => {
    const driverData = DataModule.processDriverData(rawData);
    const filteredData = FiltersModule.filterByTags(driverData, ['auto_courier']);
    expect(filteredData).toBeDefined();
  });
});
```

### 3. E2E тесты
```javascript
// Тест полного сценария
describe('End-to-End', () => {
  test('Complete driver search flow', async () => {
    // Загрузка страницы
    await page.goto('https://yandex-team.ru/driver-page');
    
    // Выполнение поиска
    await page.click('#search-button');
    
    // Проверка результатов
    const results = await page.waitForSelector('.search-results');
    expect(results).toBeDefined();
  });
});
```

## Развертывание

### 1. Сборка
```bash
# Создание пакета для разработки
zip -r bcb-dev.zip . -x "*.git*" "node_modules/*" "*.DS_Store"

# Создание пакета для продакшена
zip -r bcb-prod.zip . -x "*.git*" "node_modules/*" "*.DS_Store" "*.md" "DEVELOPER_DOCUMENTATION.md"
```

### 2. Валидация
```bash
# Проверка манифеста
chrome-extension-validator manifest.json

# Проверка безопасности
npm audit

# Проверка линтером
eslint js/**/*.js
```

---

*Технические спецификации обновлены для версии 2.1.6.36*
