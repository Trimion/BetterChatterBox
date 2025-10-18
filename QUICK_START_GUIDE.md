# Руководство по быстрому старту для разработчиков

## BetterChatterBox (BCB) - Версия 2.1.6.36

Это руководство поможет новым разработчикам быстро понять архитектуру проекта и начать работу с кодом.

## 🚀 Быстрый старт

### 1. Подготовка окружения

#### Требования
- Chrome браузер версии 118+
- Текстовый редактор (VS Code, Sublime Text, etc.)
- Базовые знания JavaScript и Chrome Extensions API

#### Установка проекта
1. Склонируйте или скачайте исходный код
2. Откройте папку проекта в текстовом редакторе
3. Убедитесь, что все файлы на месте

### 2. Первая установка расширения

#### Для разработки
1. Откройте Chrome и перейдите на `chrome://extensions/`
2. Включите "Режим разработчика" (Developer mode)
3. Нажмите "Загрузить распакованное расширение" (Load unpacked)
4. Выберите папку с проектом
5. Расширение должно появиться в списке

#### Проверка установки
1. Откройте любую страницу на `*.yandex-team.ru`
2. Нажмите на иконку расширения в панели инструментов
3. Должно открыться всплывающее окно

## 📁 Структура проекта (кратко)

```
BCB/
├── manifest.json              # Конфигурация расширения
├── js/
│   ├── background.js          # Основная логика (Service Worker)
│   ├── content.js             # Скрипт для веб-страниц
│   ├── popup.js               # Логика всплывающего окна
│   ├── settings.js            # Управление настройками
│   └── modules/               # Модульная архитектура
│       ├── utils.js           # Общие утилиты
│       ├── data.js            # Обработка данных
│       ├── filters.js         # Фильтрация
│       ├── MarkerModule.js    # Визуализация
│       ├── autosearch.js      # Автопоиск
│       ├── financialModule.js # Финансы
│       └── ticketModule.js    # Тикеты
├── popup.html                 # Всплывающее окно
├── options.html               # Страница настроек
└── css/                       # Стили
```

## 🔧 Основные концепции

### 1. Архитектура Manifest V3
- **Service Worker** (`background.js`) - фоновые процессы
- **Content Scripts** (`content.js`) - внедрение в веб-страницы
- **Popup** (`popup.html/js`) - пользовательский интерфейс

### 2. Модульная система
- Каждый модуль в `js/modules/` отвечает за конкретную функцию
- Модули независимы друг от друга
- Используется паттерн IIFE для изоляции

### 3. Система сообщений
- Компоненты общаются через `chrome.runtime.sendMessage`
- Background script выступает как центральный хаб

## 🛠 Первые шаги в разработке

### 1. Включение логирования

Для отладки включите логирование:
1. Откройте страницу настроек расширения
2. Найдите раздел "Логирование"
3. Включите "Включить логирование"
4. Откройте DevTools (F12) для просмотра логов

### 2. Добавление простой функции

#### Пример: Добавление новой кнопки в popup

1. **Отредактируйте `popup.html`:**
```html
<!-- Добавьте кнопку -->
<button id="newFeatureBtn">Новая функция</button>
```

2. **Отредактируйте `popup.js`:**
```javascript
// Добавьте обработчик
document.getElementById('newFeatureBtn').addEventListener('click', () => {
  // Ваша логика
  console.log('Новая функция активирована!');
});
```

3. **Перезагрузите расширение:**
   - Перейдите на `chrome://extensions/`
   - Нажмите кнопку обновления на карточке расширения

### 3. Создание нового модуля

#### Пример: Модуль для работы с датами

1. **Создайте файл `js/modules/dateModule.js`:**
```javascript
(function(window) {
  "use strict";
  
  const DateModule = {};
  
  // Форматирование даты
  DateModule.formatDate = function(date) {
    return new Date(date).toLocaleDateString('ru-RU');
  };
  
  // Проверка, является ли дата сегодняшней
  DateModule.isToday = function(date) {
    const today = new Date();
    const checkDate = new Date(date);
    return today.toDateString() === checkDate.toDateString();
  };
  
  // Экспорт модуля
  window.DateModule = DateModule;
})(window);
```

2. **Добавьте модуль в `manifest.json`:**
```json
{
  "content_scripts": [
    {
      "matches": ["*://*.yandex-team.ru/*"],
      "js": [
        "js/modules/utils.js",
        "js/modules/dateModule.js",  // Добавьте эту строку
        "js/content.js"
      ]
    }
  ]
}
```

3. **Используйте модуль в `content.js`:**
```javascript
// Теперь модуль доступен
const formattedDate = DateModule.formatDate(new Date());
Utils.log('Форматированная дата:', formattedDate);
```

## 🔍 Отладка

### 1. Отладка Background Script
1. Перейдите на `chrome://extensions/`
2. Найдите ваше расширение
3. Нажмите "Проверить представления" (Inspect views)
4. Выберите "Service Worker"

### 2. Отладка Content Script
1. Откройте веб-страницу, где работает расширение
2. Откройте DevTools (F12)
3. Перейдите на вкладку "Console"
4. Логи content script будут видны здесь

### 3. Отладка Popup
1. Нажмите на иконку расширения
2. Правой кнопкой мыши по всплывающему окну
3. Выберите "Проверить элемент" (Inspect)

### 4. Полезные команды для отладки

```javascript
// Проверка настроек
chrome.storage.local.get(null, console.log);

// Проверка контекста расширения
console.log('Extension ID:', chrome.runtime.id);

// Отправка тестового сообщения
chrome.runtime.sendMessage({action: 'test'}, console.log);
```

## 📝 Рабочий процесс

### 1. Типичный цикл разработки

1. **Планирование**
   - Определите, какой модуль нужно изменить
   - Планируйте изменения в архитектуре

2. **Разработка**
   - Внесите изменения в код
   - Используйте логирование для отладки

3. **Тестирование**
   - Перезагрузите расширение
   - Протестируйте на реальных страницах
   - Проверьте все связанные функции

4. **Документирование**
   - Обновите комментарии в коде
   - Обновите документацию при необходимости

### 2. Рекомендации по коду

#### Стиль кодирования
```javascript
// ✅ Хорошо
function processDriverData(driverData) {
  if (!driverData) {
    Utils.warn('Данные водителя отсутствуют');
    return null;
  }
  
  try {
    const processedData = DataModule.processDriverData(driverData);
    Utils.log('Данные обработаны:', processedData);
    return processedData;
  } catch (error) {
    Utils.error('Ошибка обработки данных:', error);
    return null;
  }
}

// ❌ Плохо
function processData(data) {
  // Нет проверок, нет логирования, нет обработки ошибок
  return data.process();
}
```

#### Обработка ошибок
```javascript
// Всегда используйте try-catch
try {
  const result = someOperation();
  return result;
} catch (error) {
  Utils.error('Ошибка в операции:', error);
  return null;
}
```

#### Логирование
```javascript
// Используйте разные уровни логирования
Utils.log('Информация:', data);
Utils.warn('Предупреждение:', warning);
Utils.error('Ошибка:', error);
```

## 🎯 Частые задачи

### 1. Добавление новой настройки

1. **Добавьте в `settings.js`:**
```javascript
const defaultSettings = {
  // ... существующие настройки
  newSetting: true  // Добавьте новую настройку
};
```

2. **Добавьте в `options.html`:**
```html
<div class="setting-item">
  <label>
    <input type="checkbox" id="newSetting">
    Новая настройка
  </label>
</div>
```

3. **Добавьте обработку в `settings.js`:**
```javascript
// В функции loadSettings()
document.getElementById('newSetting').checked = settings.newSetting;

// В функции saveSettings()
settings.newSetting = document.getElementById('newSetting').checked;
```

### 2. Добавление горячей клавиши

1. **Добавьте в `manifest.json`:**
```json
{
  "commands": {
    "new_command": {
      "suggested_key": {
        "default": "Alt+N"
      },
      "description": "Новая команда"
    }
  }
}
```

2. **Добавьте обработку в `background.js`:**
```javascript
chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case "new_command":
      handleNewCommand();
      break;
  }
});
```

### 3. Добавление нового типа поиска

1. **Добавьте функцию в `filters.js`:**
```javascript
FiltersModule.findNewElements = function(criteria) {
  // Ваша логика поиска
  const elements = document.querySelectorAll(criteria.selector);
  return Array.from(elements);
};
```

2. **Используйте в `autosearch.js`:**
```javascript
AutosearchModule.searchNewElements = function() {
  const elements = FiltersModule.findNewElements({
    selector: '.new-element'
  });
  
  if (elements.length > 0) {
    Utils.log('Найдены новые элементы:', elements);
    // Обработка результатов
  }
};
```

## 🚨 Решение проблем

### 1. Расширение не загружается
- Проверьте синтаксис в `manifest.json`
- Убедитесь, что все файлы существуют
- Проверьте консоль на ошибки

### 2. Content script не работает
- Проверьте `matches` в `manifest.json`
- Убедитесь, что скрипт загружается в правильном порядке
- Проверьте консоль браузера

### 3. Настройки не сохраняются
- Проверьте права доступа к `storage`
- Убедитесь, что используется `chrome.storage.local`
- Проверьте обработку ошибок

### 4. Уведомления не показываются
- Проверьте права на `notifications`
- Убедитесь, что уведомления не заблокированы браузером
- Проверьте логи на ошибки

## 📚 Полезные ресурсы

### Документация Chrome Extensions
- [Manifest V3 Overview](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Extensions API](https://developer.chrome.com/docs/extensions/reference/)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)

### Инструменты разработки
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [Extension Reloader](https://chrome.google.com/webstore/detail/extensions-reloader/fimgfedafeadlieiabdeeaodndnlbhid)

### Сообщество
- [Chrome Extensions Google Group](https://groups.google.com/forum/#!forum/chrome-extensions)
- [Stack Overflow - Chrome Extensions](https://stackoverflow.com/questions/tagged/google-chrome-extension)

## 🤝 Вклад в проект

### 1. Сообщение об ошибках
При сообщении об ошибке укажите:
- Версию расширения
- Версию Chrome
- Описание проблемы
- Шаги для воспроизведения
- Логи ошибок

### 2. Предложение улучшений
При предложении улучшений опишите:
- Проблему, которую решает улучшение
- Предлагаемое решение
- Примеры использования
- Возможные альтернативы

### 3. Pull Request
При создании PR:
- Опишите изменения
- Убедитесь, что код протестирован
- Обновите документацию при необходимости
- Следуйте стилю кодирования проекта

---

## 📞 Контакты

- **Тимлид:** [@Rusokost](https://t.me/Rusokost)
- **Ведущий разработчик:** [@Rusokost](https://t.me/Rusokost)
- **Участвовавший в разработке:** [@NN_LordArrin](https://t.me/NN_LordArrin)

---

*Руководство обновлено для версии 2.1.6.36*

**Удачи в разработке! 🚀**
