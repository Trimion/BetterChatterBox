/**
 * This file is part of the project covered by the LICENSE file in the root directory.
 * Copyright (C) 2023-2024. All rights reserved.
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// Utils уже доступен через глобальный объект window.Utils

// Выполнение автоматического поиска страны/ВУ при загрузке скрипта
// НЕ запускаем автоматический поиск на страницах карточек водителей
const currentUrl = window.location.href;
if (!currentUrl.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
  // Проверяем настройку поиска страны перед автоматическим запуском
  chrome.storage.local.get(['searchDriverInfo'], (result) => {
    if (result.searchDriverInfo !== false) {
      Utils.log('Поиск страны включен в настройках, запускаем автоматический поиск...');
      performSearchAndNotify();
    } else {
      Utils.log('Поиск страны отключен в настройках. Автоматический поиск не запускается.');
    }
  });
}

// Глобальная переменная для хранения настроек
if (typeof settings === 'undefined') {
  var settings = {};
}

// Глобальная переменная для отслеживания состояния логирования действий
let actionLoggingEnabled = false;

// Функция для логирования действий
function logAction(message, data = null, source = 'content') {
    if (actionLoggingEnabled) {
        chrome.runtime.sendMessage({
            action: 'addActionLog',
            message: message,
            data: data,
            url: window.location.href,
            source: source
        }).catch(() => {
            // Игнорируем ошибки отправки сообщений
        });
    }
}

// Запрос настроек у background.js при загрузке
chrome.runtime.sendMessage({ action: "getSettings" }, (response) => {
  if (response) {
    settings = response;
    Utils.log('Получены настройки:', settings);
    // Проверяем состояние логирования действий
    actionLoggingEnabled = response.actionLoggingEnabled || false;
    if (actionLoggingEnabled) {
      logAction('Content script загружен на странице', { url: window.location.href });
      Utils.log('Content script загружен на странице', { url: window.location.href });
      // Включаем отслеживание действий пользователя, если логирование активно
      attachUserActionListeners();
    }
    applySettings();
  }
});

// Функция применения настроек
function applySettings() {
  Utils.log('Применение настроек...');
  
  // Применяем настройки маркера
  if (typeof MarkerModule !== 'undefined') {
    if (typeof MarkerModule.toggleEnabled === 'function' && 
        typeof MarkerModule.updateMarkers === 'function') {
      
      MarkerModule.toggleEnabled(settings.markerEnabled);
      if (Array.isArray(settings.markers) && settings.markers.length > 0) {
        MarkerModule.updateMarkers(settings.markers);
      }
    }
  }
  
  // Другие настройки можно применять здесь
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
  // Сбрасываем состояние автопоиска при загрузке новой страницы
  if (window.AutosearchModule) {
    window.AutosearchModule.resetAutosearchState();
  }
  initialize();
});

// Сброс состояния при обновлении страницы
window.addEventListener('beforeunload', () => {
  if (window.AutosearchModule) {
    window.AutosearchModule.resetAutosearchState();
  }
});

// Сброс состояния при загрузке страницы (включая обновление)
window.addEventListener('load', () => {
  if (window.AutosearchModule) {
    window.AutosearchModule.resetAutosearchState();
  }
});

// Функция инициализации
function initialize() {
  Utils.log('Инициализация content.js...');
  
  // Выполняем автоматический поиск страны/ВУ при инициализации страницы (загрузке тикетов)
  // НЕ запускаем автоматический поиск на страницах карточек водителей
  const currentUrl = window.location.href;
  if (!currentUrl.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
    // Проверяем настройку поиска страны перед автоматическим запуском
    chrome.storage.local.get(['searchDriverInfo'], (result) => {
      if (result.searchDriverInfo !== false) {
        Utils.log('Поиск страны включен в настройках, запускаем автоматический поиск при инициализации...');
        performSearchAndNotify();
      } else {
        Utils.log('Поиск страны отключен в настройках. Автоматический поиск при инициализации не запускается.');
      }
    });
  }
  
  // Добавляем обработчик горячих клавиш с использованием window
  window.addEventListener('keydown', handleHotkey, true);
  
  // Добавляем пассивные слушатели для событий прокрутки
  window.addEventListener('wheel', () => {}, { passive: true });
  window.addEventListener('touchmove', () => {}, { passive: true });
  
  // Обработчик кнопки ПОИСК удален - он обрабатывается в popup.js
  
  // Инициализируем модуль маркера, если он доступен
  if (typeof MarkerModule !== 'undefined' && typeof MarkerModule.init === 'function') {
    MarkerModule.init().then(() => {
      Utils.log('Модуль маркера инициализирован');
      // Применяем настройки после инициализации
      applySettings();
    }).catch(error => {
      Utils.log('Ошибка при инициализации модуля маркера:', error);
    });
  }
  
  // Добавляем слушатель изменений настроек для сброса флагов отключения автопоиска
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      // Проверяем изменения настроек автопоиска
      const autosearchSettings = ['autosearchPresets', 'autosearchTesting', 'autosearchLastOrders'];
      const hasAutosearchChanges = autosearchSettings.some(setting => changes[setting]);
      
      if (hasAutosearchChanges && window.AutosearchModule) {
        Utils.log('Обнаружены изменения настроек автопоиска, сбрасываем флаги отключения');
        window.AutosearchModule.resetDisabledFlags();
      }
    }
  });
}

// Обработчик горячих клавиш
function handleHotkey(event) {
  // Alt + A (учитываем разные раскладки и регистры)
  if (event.altKey && (event.key.toLowerCase() === 'a' || event.keyCode === 65)) {
    Utils.log('Горячая клавиша Alt+A нажата, проверяем настройки...');
    event.preventDefault(); // Предотвращаем стандартное поведение
    
    // Проверяем URL - если это карточка водителя, не выполняем поиск страны/ВУ
    const currentUrl = window.location.href;
    if (currentUrl.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
      Utils.log('Alt+A на странице карточки водителя - поиск страны/ВУ отключен для этого типа страниц.');
    } else {
      // Проверяем настройку поиска страны перед выполнением поиска
      chrome.storage.local.get(['searchDriverInfo'], (result) => {
        if (result.searchDriverInfo !== false) {
          Utils.log('Поиск страны включен в настройках, запускаем поиск...');
          performSearchAndNotify();
        } else {
          Utils.log('Поиск страны отключен в настройках. Alt+A не выполняет поиск.');
        }
      });
    }
  }
}

// Слушатель сообщений от background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'settingsChanged') {
    Utils.log('Получено уведомление об изменении настроек:', request.settings);
    settings = request.settings;
    // Применяем новые настройки
    applySettings();
    sendResponse({ success: true });
  }
  
  // Обработка команды на выполнение поиска (автоматический поиск страны/ВУ через Alt+A)
  else if (request.action === 'runSearch') {
    Utils.log('Получена команда на выполнение автоматического поиска страны/ВУ от background.js (Alt+A)');
    // Проверяем URL - если это карточка водителя, не выполняем поиск страны/ВУ
    const currentUrl = window.location.href;
    if (currentUrl.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
      Utils.log('Alt+A на странице карточки водителя - поиск страны/ВУ отключен для этого типа страниц.');
      sendResponse({ success: true });
    } else {
      // Проверяем настройку поиска страны перед выполнением поиска
      chrome.storage.local.get(['searchDriverInfo'], (result) => {
        if (result.searchDriverInfo !== false) {
          Utils.log('Поиск страны включен в настройках, запускаем поиск...');
          performSearchAndNotify();
          sendResponse({ success: true });
        } else {
          Utils.log('Поиск страны отключен в настройках. Команда runSearch не выполняет поиск.');
          sendResponse({ success: true });
        }
      });
      return true; // Указываем, что будем отвечать асинхронно
    }
  }
  
  // ===== УНИФИЦИРОВАННЫЕ ОБРАБОТЧИКИ МОДУЛЕЙ =====
  // Все модули теперь используют единый механизм: content.js -> background.js
  
  // Обработка команды от кнопки ПОИСК - запускаем поиск тегов/профессии
  else if (request.action === 'startSearch') {
    Utils.log('Получена команда startSearch - запускаем поиск тегов/профессии');
    
    // Проверяем URL - не запускаем поиск на страницах карточек водителей
    const currentUrl = window.location.href;
    if (currentUrl.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
      Utils.log('startSearch на странице карточки водителя - поиск отключен');
      sendResponse({ success: false, error: 'Поиск отключен на страницах карточек водителей' });
      return true;
    }
    
    // Ищем ссылку на водителя
    const buttons = document.querySelectorAll('a');
    let driverLink = null;
    
    buttons.forEach(button => {
      if (button && 
          button.textContent.includes('Водитель') &&
          button.href.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
        driverLink = button.href;
      }
    });
    
    if (driverLink) {
      Utils.log('Найдена ссылка на водителя, запускаем поиск:', driverLink);
      
      // Отправляем сообщение в background.js для выполнения поиска
      chrome.runtime.sendMessage({
        action: 'startSearch',
        url: driverLink,
        trigger: 'manual_search'
      }, (response) => {
        if (chrome.runtime.lastError) {
          Utils.log('Ошибка при отправке сообщения startSearch в background.js:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          Utils.log('Поиск успешно запущен через background.js');
          sendResponse({ success: true });
        }
      });
    } else {
      Utils.log('Ссылка на водителя не найдена на текущей странице');
      sendResponse({ success: false, error: 'Ссылка на водителя не найдена' });
    }
    
    return true; // Указываем, что будем отвечать асинхронно
  }
  
  // Обработка команды на выполнение тестирования
  else if (request.action === 'startTesting') {
    Utils.log('Получена команда startTesting - запускаем тестирование');
    
    // Проверяем URL - не запускаем тестирование на страницах карточек водителей
    const currentUrl = window.location.href;
    if (currentUrl.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
      Utils.log('startTesting на странице карточки водителя - тестирование отключено');
      sendResponse({ success: false, error: 'Тестирование отключено на страницах карточек водителей' });
      return true;
    }
    
    // Отправляем сообщение в background.js для выполнения тестирования
    chrome.runtime.sendMessage({
      action: 'startTesting',
      trigger: 'manual_testing'
    }, (response) => {
      if (chrome.runtime.lastError) {
        Utils.log('Ошибка при отправке сообщения startTesting в background.js:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        Utils.log('Тестирование успешно запущено через background.js');
        sendResponse({ success: true });
      }
    });
    
    return true; // Указываем, что будем отвечать асинхронно
  }
  
  // Обработка команды на выполнение поиска последних заказов
  else if (request.action === 'startLastOrders') {
    Utils.log('Получена команда startLastOrders - запускаем поиск последних заказов');
    
    // Проверяем URL - не запускаем поиск на страницах карточек водителей
    const currentUrl = window.location.href;
    if (currentUrl.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
      Utils.log('startLastOrders на странице карточки водителя - поиск отключен');
      sendResponse({ success: false, error: 'Поиск отключен на страницах карточек водителей' });
      return true;
    }
    
    // Отправляем сообщение в background.js для выполнения поиска последних заказов
    chrome.runtime.sendMessage({
      action: 'startLastOrders',
      trigger: 'manual_last_orders'
    }, (response) => {
      if (chrome.runtime.lastError) {
        Utils.log('Ошибка при отправке сообщения startLastOrders в background.js:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        Utils.log('Поиск последних заказов успешно запущен через background.js');
        sendResponse({ success: true });
      }
    });
    
    return true; // Указываем, что будем отвечать асинхронно
  }
  
  // ===== КОНЕЦ УНИФИЦИРОВАННЫХ ОБРАБОТЧИКОВ МОДУЛЕЙ =====
  
  // Обработка команды на выполнение тестирования (поиск только номера ВУ) - устаревший обработчик
  else if (request.action === 'runTestingSearch') {
    Utils.log('Функция тестирования временно недоступна');
    sendResponse({ success: false, error: 'Функция тестирования временно недоступна' });
  }
  
  // Обработка команды на включение/выключение маркера
  else if (request.action === 'toggleMarker') {
    Utils.log(`Получена команда на ${request.enabled ? 'включение' : 'выключение'} маркера`);
    if (typeof MarkerModule !== 'undefined' && typeof MarkerModule.toggleEnabled === 'function') {
      MarkerModule.toggleEnabled(request.enabled);
      sendResponse({ success: true });
    } else {
      Utils.log('Модуль маркера не найден или не имеет функции toggleEnabled');
      sendResponse({ success: false, error: 'Модуль маркера не найден' });
    }
  }
  
  // Обработка сообщений для модуля маркера
  else if (request.action === 'updateMarkers' && typeof MarkerModule !== 'undefined') {
    Utils.log('Получена команда на обновление маркеров:', request.markers);
    if (Array.isArray(request.markers)) {
      MarkerModule.updateMarkers(request.markers);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Маркеры должны быть массивом' });
    }
  }
  else if (request.action === 'highlightAll' && typeof MarkerModule !== 'undefined') {
    Utils.log('Получена команда на выделение всех маркеров');
    MarkerModule.highlightAll();
    sendResponse({ success: true });
  }
  // Обработка команды на включение/выключение логирования действий
  else if (request.action === 'toggleActionLogging') {
    actionLoggingEnabled = request.enabled;
    if (actionLoggingEnabled) {
      logAction('Логирование действий включено на странице', { url: window.location.href });
      Utils.log('Логирование действий включено на странице', { url: window.location.href });
      // Начинаем отслеживать действия пользователя
      attachUserActionListeners();
    } else {
      logAction('Логирование действий выключено на странице', { url: window.location.href });
      Utils.log('Логирование действий выключено на странице', { url: window.location.href });
      // Отключаем отслеживание действий пользователя
      detachUserActionListeners();
    }
    sendResponse({ success: true });
  }
  
  return true; // Указываем, что будем отвечать асинхронно
});

// Добавляем глобальные переменные для отслеживания стабильности данных
let dataStabilityTimer = null;
let dataLastChangedTimestamp = 0;
const DATA_STABILITY_TIMEOUT = 500; // 0,5 секунд ожидания стабильности данных
const NOTIFICATION_DELAY = 100; // Задержка перед отправкой уведомления после стабилизации данных

// Основная функция поиска и уведомления
function performSearchAndNotify() {
  // Проверяем URL страницы - поиск страны/ВУ НЕ должен работать на страницах карточек водителей
  const currentUrl = window.location.href;
  if (currentUrl.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
    Utils.log('Страница карточки водителя обнаружена. Автоматический поиск страны/ВУ отключен для этого типа страниц.');
    return;
  }
  
  // Получаем настройки из хранилища
  chrome.storage.local.get([
    'blockWizard', 
    'searchDriverInfo', 
    'searchPreset1', 
    'searchPreset2', 
    'searchPreset3',
    // Добавляем настройки переключателей поиска
    'searchPreset1Enabled',
    'searchPreset2Enabled',
    'searchPreset3Enabled'
  ], (searchSettings) => {
    // Применяем блокировку ВИЗАРД, если она включена
    if (searchSettings.blockWizard) {
      chrome.runtime.sendMessage({ 
        action: 'updateBlocking', 
        enabled: true 
      });
    }
    
    // Если поиск страны отключен, выходим из функции
    if (searchSettings.searchDriverInfo === false) {
      Utils.log('Поиск страны отключен в настройках. Поиск не будет выполнен.');
      return;
    }
    
    // Получаем значения пресетов поиска
    const preset1 = searchSettings.searchPreset1 || 'tags';
    const preset2 = searchSettings.searchPreset2 || 'profession';
    const preset3 = searchSettings.searchPreset3 || 'customTags';
    
    // Получаем состояние переключателей поиска
    const preset1Enabled = searchSettings.searchPreset1Enabled !== false; // По умолчанию включено
    const preset2Enabled = searchSettings.searchPreset2Enabled !== false; // По умолчанию включено
    const preset3Enabled = searchSettings.searchPreset3Enabled !== false; // По умолчанию включено
    
    Utils.log('Состояние переключателей поиска:');
    Utils.log('Поиск 1 включен:', preset1Enabled);
    Utils.log('Поиск 2 включен:', preset2Enabled);
    Utils.log('Поиск 3 включен:', preset3Enabled);
    
    // Создаем массив активных пресетов
    const activePresets = [];
    if (preset1Enabled) activePresets.push(preset1);
    if (preset2Enabled) activePresets.push(preset2);
    if (preset3Enabled) activePresets.push(preset3);
    
    // Проверяем состояние пресетов поиска (только для логирования)
    if (activePresets.length === 0) {
      Utils.log('Все пресеты поиска отключены. Поиск страны и номера ВУ будет выполнен независимо от пресетов.');
    }
    
    // Определяем, какие типы поиска нужно выполнить
    const shouldSearchTags = activePresets.includes('tags');
    const shouldSearchProfession = activePresets.includes('profession');
    const shouldSearchCustomTags = activePresets.some(preset => preset.startsWith('customTags'));
    
    Utils.log('Настройки поиска:');
    Utils.log('Активные пресеты:', activePresets);
    Utils.log('Искать теги:', shouldSearchTags);
    Utils.log('Искать профессию:', shouldSearchProfession);
    Utils.log('Искать пользовательские теги:', shouldSearchCustomTags);
    
    // Продолжаем выполнение поиска страны и номера ВУ независимо от состояния пресетов
    Utils.log('Начинаем поиск информации о водителе...');
    
    // Контрольные bool значения для функций вывода в консоль
    let printLinksEnabled = false; // Вывод найденных ссылок - должно быть отключено в релизе
    let printFilteredValuesEnabled = true; // Вывод найденных значений 

    // Контрольные bool значения для функций фильтрации
    let getTicketLinkEnabled = true; // Функция getTicketLink для получения ссылки на тикет
    let filterCountryEnabled = true; // Функция filterCountry для фильтрации страны
    let filterDriver_LicenseEnabled = true; // Функция filterDriver_License для фильтрации driver_license

    // Последний обработанный ID тикета
    let lastTicketId = null; // Инициализируется как null, пока не будет найден первый тикет
    
    // Объект для накопления данных и таймер для отложенного уведомления
    let collectedData = {};
    let notificationTimer = null;
    
    // Хранение ID текущего уведомления для обновления
    let currentNotificationId = null;

    // Слушатель сообщений от background.js
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'notificationClosed') {
        // Если уведомление с текущим ID было закрыто, сбрасываем ID
        if (request.notificationId === currentNotificationId) {
          Utils.log(`Уведомление ${currentNotificationId} было закрыто, сбрасываем ID`);
          currentNotificationId = null;
        }
      }
      return true;
    });
    
    // Функция для сбора данных с отложенным уведомлением
    function collectData(newData) {
      try {
        // Проверяем, что контекст расширения валиден
        if (!chrome.runtime || !chrome.runtime.id) {
          Utils.log('Контекст расширения недоступен, пропускаем сбор данных');
          return;
        }
        
        // Проверяем новый тикет и сбрасываем флаг завершения автопоиска при необходимости
        if (newData.ticketId && window.AutosearchModule) {
          window.AutosearchModule.checkNewTicketAndReset(newData.ticketId);
        }
        
        Utils.log('Собираем данные:', newData);
        
        // Обновляем время последнего изменения данных
        dataLastChangedTimestamp = Date.now();
        
        // Были ли добавлены новые данные
        let hasNewData = false;
        
        // Объединяем новые данные с уже собранными
        Object.keys(newData).forEach(key => {
          if (newData[key]) {
            // Проверяем, изменились ли данные
            if (collectedData[key] !== newData[key]) {
              hasNewData = true;
              collectedData[key] = newData[key];
            }
          }
        });
        
        // Если добавлены новые данные, сбрасываем таймер стабильности
        if (hasNewData) {
          Utils.log('Добавлены новые данные, сбрасываем таймер стабильности');
          
          // Если таймер уведомления уже установлен, сбрасываем его
          if (notificationTimer) {
            clearTimeout(notificationTimer);
            notificationTimer = null;
          }
          
          // Если таймер стабильности уже установлен, сбрасываем его
          if (dataStabilityTimer) {
            clearTimeout(dataStabilityTimer);
          }
          
          // Устанавливаем новый таймер стабильности
          dataStabilityTimer = setTimeout(() => {
            Utils.log('Данные стабильны в течение необходимого времени, проверяем полноту данных');
            
            // Проверяем, что у нас есть достаточно данных для отправки уведомления
            const isDataComplete = collectedData.ticketId && 
                                  (collectedData.country || collectedData.driverLicense);
            
            if (isDataComplete) {
              Utils.log('Данные полны и стабильны, устанавливаем таймер уведомления');
              
              // Устанавливаем новый таймер уведомления
              notificationTimer = setTimeout(() => {
                try {
                  // Проверяем, что контекст расширения все еще валиден
                  if (!chrome.runtime || !chrome.runtime.id) {
                    Utils.log('Контекст расширения недоступен, пропускаем отправку уведомления');
                    return;
                  }
                  
                  // Проверяем, есть ли данные для отправки
                  if (Object.keys(collectedData).length > 0) {
                    // Проверяем наличие обязательных полей
                    if (!collectedData.ticketId) {
                      Utils.log('Отсутствует ID тикета, не отправляем уведомление');
                      collectedData = {}; // Очищаем данные
                      return;
                    }
                    
                    // Выводим собранные данные в консоль, если включен вывод
                    if (printFilteredValuesEnabled) {
                      Utils.log('Найденные данные (отложенное уведомление):');
                      if (collectedData.ticketId) Utils.log(`ID тикета: %c${collectedData.ticketId}`, 'font-weight: bold');
                      if (collectedData.ticketLink) Utils.log(`Ссылка на тикет: %c${collectedData.ticketLink}`, 'font-weight: bold');
                      if (collectedData.country) Utils.log(`Страна: %c${collectedData.country}`, 'font-weight: bold');
                      if (collectedData.driverLicense) Utils.log(`Номер ВУ: %c${collectedData.driverLicense}`, 'font-weight: bold');
                    }
                    
                    // Создаем копию данных для отправки
                    const dataToSend = {...collectedData};
                    
                    Utils.log('Отправляем данные для уведомления:', dataToSend);
                    
                    // Отправляем сообщение в background.js для создания уведомления
                    try {
                      // ЛОГИРОВАНИЕ: Отправка данных для создания уведомления
                      chrome.runtime.sendMessage({
                        action: 'addActionLog',
                        message: 'CONTENT.JS: ОТПРАВКА ДАННЫХ ДЛЯ УВЕДОМЛЕНИЯ',
                        data: {
                          dataToSend: dataToSend,
                          url: window.location.href,
                          stack: new Error().stack.split('\n').slice(0, 5).join('\n')
                        },
                        source: 'content.js'
                      }).catch(() => {});
                      
                      Utils.log('Пытаемся отправить сообщение в background.js...');
                      chrome.runtime.sendMessage({ 
                        action: 'createNotification', 
                        data: dataToSend,
                        timeout: 54000 // Устанавливаем таймаут в 54 секунды (уменьшено на 10%)
                      }, (response) => {
                        if (chrome.runtime.lastError) {
                          Utils.log('Ошибка при отправке сообщения:', chrome.runtime.lastError);
                        } else if (response && response.notificationId) {
                          Utils.log('Уведомление создано с ID:', response.notificationId);
                        }
                        
                        // Очищаем собранные данные после отправки уведомления
                        collectedData = {};
                      });
                    } catch (error) {
                      Utils.error('Ошибка при отправке сообщения:', error);
                    }
                  }
                } catch (error) {
                  Utils.error('Ошибка при отправке уведомления:', error);
                }
              }, NOTIFICATION_DELAY);
            }
          }, DATA_STABILITY_TIMEOUT);
        }
      } catch (error) {
        Utils.error('Ошибка при сборе данных:', error);
      }
    }
    
    // Функция для получения всех ссылок на странице
    function getLinks() {
      try {
        // Получаем все ссылки на странице с помощью querySelectorAll
        let links = Array.from(document.querySelectorAll('a'));
        return links;
      } catch (error) {
        Utils.log('Ошибка при получении ссылок:', error);
        return [];
      }
    }
    
    /**
     * Извлекает значение ticket_id из ссылки.
     * @param {HTMLAnchorElement} link - Ссылка.
     * @param {Object} context - Контекст для хранения найденных значений.
     * @returns {string|null} - Значение ticket_id или null, если не найдено.
     */
    function filterTicket(link, context = {}) {
      // Если ссылка не существует или не имеет href, возвращаем null
      if (!link || !link.href) return null;
      try {
        // Создаем объект URL из ссылки
        const url = new URL(link.href.replace(/\/$/, ''));
        // Получаем параметры URL
        const params = url.searchParams;
        // Определяем паттерны для поиска ticket_id в URL
        const ticketIdPatterns = [
          /ticket_id=([0-9a-fA-F]{24})/,
          /chatterbox_ticket_id=([0-9a-fA-F]{24})/,
          /zendesk_ticket=([0-9a-fA-F]{24})/,
        ];
        // Ищем соответствие паттерна в URL
        for (const pattern of ticketIdPatterns) {
          const match = url.href.match(pattern);
          if (match) {
            // Если найдено, извлекаем значение ticket_id
            const ticketId = match[1];
            // Проверяем, является ли ticket_id корректным (24 символа)
            if (!ticketId || !/^[0-9a-fA-F]{24}$/.test(ticketId)) {
              return null; // ID тикета должен состоять из 24 цифр
            }
            // Проверяем, найдено ли значение ранее
            if (context[ticketId]) {
              return null; // Проверяем, найдено ли значение ранее
            }
            context[ticketId] = true;
            return ticketId;
          }
        }
        return null;
      } catch (error) {
        // Если ошибка, возвращаем null
        if (error instanceof TypeError && error.message.includes('Invalid URL')) {
          return null;
        }
        Utils.warn(`Ошибка при обработке ссылки: ${link.href}`, error);
        return null;
      }
    }
    
    // Функция для получения ссылки на тикет
    function getTicketLink(ticketId) {
      if (!getTicketLinkEnabled || !ticketId) return null;
      try {
        return `https://chatterbox.taxi.yandex.ru/tickets/${ticketId}`;
      } catch (error) {
        Utils.log('Ошибка при получении ссылки на тикет:', error);
        return null;
      }
    }
    
    /**
     * Извлекает значение country из ссылки.
     * @param {HTMLAnchorElement} link - Ссылка.
     * @returns {string|null} - Значение country или null, если не найдено.
     */
    function filterCountry(link) {
      if (!filterCountryEnabled) return null; // если фильтрация страны отключена, выходим из функции
      if (!link || !link.href) return null; // если ссылка не существует или не имеет href, возвращаем null
      try {
        const url = new URL(link.href.replace(/\/$/, '')); // создаем объект URL из ссылки
        if (url.pathname.includes("sms") || url.pathname.includes("iframe") || url.pathname.includes("tariff")) {
          return null; // игнорируем URLs с "sms", "iframe", или "tariff" в пути
        }
        if (url.href.startsWith('https://forms.yandex-team.ru/surveys/')) {
          const surveyId = url.href.match(/surveys\/(\d+)/)[1];
          if (surveyId !== '147630' && getLinks().some((l) => l.href.includes('forms.yandex-team.ru/surveys/147630/'))) {
            return null; // игнорируем ссылки с другими survey ID, если есть ссылка с survey ID 147630 - фикс для редких случаев со странами
          }
        }
        const params = url.searchParams; // получаем параметры URL
        let country = params.get('country');
        if (!country) {
          // Определение паттернов для поиска страны в URL
          const patterns = [
            /.*intl_([a-zA-Z]{2,3}).*$/,
            /.*csi_([a-zA-Z]{2,3}).*$/,
            /country=([a-zA-Z]{2,3})/, // поиск в параметрах URL
            /\/([a-zA-Z]{2,3})$/, // поиск в конце пути URL
          ];
          for (const pattern of patterns) {
            const match = url.href.match(pattern);
            if (match) {
              country = match[1];
              break;
            }
          }
        }
        if (!country) return null; // если значение country не найдено, возвращаем null
        // Если код страны из 2 букв, преобразуем его в трёхбуквенный
        if (country.length === 2) {
          country = iso3166Alpha2ToAlpha3(country); // преобразуем код страны из 2 букв в 3 буквы
        }
        // Массив расшифрованных обозначений стран
        const countryCodes = {
          'arm': 'Армения',
          'aze': 'Азербайджан',
          'blr': 'Беларусь',
          'bol': 'Боливия',
          'civ': 'Кот-д\'Ивуар',
          'cmr': 'Камерун',
          'col': 'Колумбия',
          'dza': 'Алжир',
          'fin': 'Финляндия',
          'geo': 'Грузия',
          'gha': 'Гана',
          'ind': 'Индия',
          'isr': 'Израиль',
          'kaz': 'Казахстан',
          'kgz': 'Кыргызстан',
          'ltu': 'Литва',
          'mda': 'Молдавия',
          'mol': 'Молдавия', // Дурка ебать
          'moz': 'Мозамбик',
          'nam': 'Намибия',
          'nor': 'Норвегия',
          'pak': 'Пакистан',
          'rus': 'Россия',
          'sen': 'Сенегал',
          'srb': 'Сербия',
          'tjk': 'Таджикистан',
          'tkm': 'Туркменистан',
          'uzb': 'Узбекистан',
          'zmb': 'Замбия',
        };
        // Если значение country совпадает со значением в массиве, то присваиваем country значение из массива
        if (country.toLowerCase() in countryCodes) {
          country = countryCodes[country.toLowerCase()]; // заменяем код страны на полное название
        } else {
          country = 'skull'; // если значение не найдено в countryCodes, присваиваем 'skull'
        }
        return country; // возвращаем значение country
      } catch (error) {
        // игнорируем ошибку и возвращаем null
        return null;
      }
    }
    
    // функция iso3166Alpha2ToAlpha3
    function iso3166Alpha2ToAlpha3(alpha2) {
      const iso3166Alpha2ToAlpha3Map = {
        'am': 'arm',
        'az': 'aze',
        'bo': 'bol',
        'by': 'blr',
        'ci': 'civ',
        'cm': 'cmr',
        'co': 'col',
        'dz': 'dza',
        'fi': 'fin',
        'ge': 'geo',
        'gh': 'gha',
        'il': 'isr',
        'in': 'ind',
        'kg': 'kgz',
        'kz': 'kaz',
        'lt': 'ltu',
        'md': 'mda',
        'mz': 'moz',
        'na': 'nam',
        'no': 'nor',
        'pk': 'pak',
        'rs': 'srb',
        'ru': 'rus',
        'sn': 'sen',
        'tj': 'tjk',
        'tm': 'tkm',
        'uz': 'uzb',
        'zm': 'zmb',
        // добавить другие страны
      };
      return iso3166Alpha2ToAlpha3Map[alpha2.toLowerCase()] || alpha2.toLowerCase();
    }
    
    /**
     * Извлекает значение driver_license из ссылки.
     * @param {HTMLAnchorElement} link - Ссылка.
     * @returns {string|null} - Значение driver_license или null, если не найдено.
     */
    function filterDriver_License(link) {
      if (!filterDriver_LicenseEnabled) return null;
      try {
        const url = new URL(link.href.replace(/\/$/, ''));
        const params = url.searchParams;
        let driverLicense = params.get('driver_license');
        if (!driverLicense) {
          const patterns = [
            /driver_license=([A-Z0-9]+)/,
            /\/driver_license\/([A-Z0-9]+)/,
          ];
          for (const pattern of patterns) {
            const match = url.href.match(pattern);
            if (match) {
              driverLicense = match[1];
              break;
            }
          }
        }
        if (!driverLicense) {
          // Пытаемся извлечь ВУ из ссылок
          const linkText = link.textContent;
          const match = linkText.match(/driver_license: ([A-Z0-9]+)/);
          if (match) {
            driverLicense = match[1];
          }
        }
        if (!driverLicense) return null; // если не найдено, возвращаем null
        // Проверяем, найдено ли значение ранее
        const context = filterDriver_License.context || (filterDriver_License.context = {});
        if (context[driverLicense]) {
          return null;
        }
        context[driverLicense] = true;
        return driverLicense;
      } catch (error) {
        return null; // если не найдено, возвращаем null
      }
    }
    
    /**
     * Собирает отфильтрованные значения из ссылок.
     * @returns {Object[]} - Массив объектов с отфильтрованными значениями.
     */
    function collectFilteredValues() {
      try {
        // Проверяем, что контекст расширения валиден
        if (!chrome.runtime || !chrome.runtime.id) {
          Utils.log('Контекст расширения недоступен, пропускаем сбор данных');
          return [];
        }
        
        // Получаем все ссылки на странице
        const links = getLinks();
        
        // Ограничиваем количество обрабатываемых ссылок для повышения производительности
        // Обычно важные ссылки находятся в начале DOM
        const maxLinks = 100; // Максимальное количество ссылок для обработки
        const linksToProcess = links.length > maxLinks ? links.slice(0, maxLinks) : links;
        
        // Создаем контекст для хранения найденных значений
        const context = {};
        
        // Создаем массив для хранения отфильтрованных значений
        const filteredValues = linksToProcess.map((link, index) => {
          // Создаем объект для хранения отфильтрованных значений для каждой ссылки
          const values = {};
          try {
            // Извлекаем значение ticketId из ссылки
            values.ticketId = filterTicket(link, context);
          } catch (error) {
            Utils.error(`Ошибка фильтрации ticketId: ${error}`);
          }
          try {
            // Извлекаем значение country из ссылки
            values.country = filterCountry(link);
          } catch (error) {
            Utils.error(`Ошибка фильтрации страны: ${error}`);
          }
          try {
            // Извлекаем значение driverLicense из ссылки
            values.driverLicense = filterDriver_License(link);
          } catch (error) {
            Utils.error(`Ошибка фильтрации driverLicense: ${error}`);
          }
          // Если значение ticketId найдено, создаем ссылку на тикет
          if (values.ticketId) {
            values.ticketLink = getTicketLink(values.ticketId);
          }
          // Возвращаем объект values, даже если некоторые свойства не были заполнены
          return values;
        }).filter((values) => Object.keys(values).some((key) => values[key] !== undefined));
        
        return filteredValues;
      } catch (error) {
        Utils.error('Ошибка при сборе отфильтрованных значений:', error);
        return [];
      }
    }
    
    /**
     * Выводит в консоль ссылки на странице.
     */
    function printLinks() {
      if (!printLinksEnabled) return;
      
      try {
        // Проверяем, что контекст расширения валиден
        if (!chrome.runtime || !chrome.runtime.id) {
          Utils.log('Контекст расширения недоступен, пропускаем обработку');
          return;
        }
        
        // Получаем все ссылки на странице
        const links = getLinks();
        Utils.log('Найдено ссылок:', links.length);
      } catch (error) {
        Utils.error('Ошибка при выводе ссылок:', error);
      }
    }
    
    /**
     * Выводит в консоль отфильтрованные значения из ссылок.
     */
    function printFilteredValues() {
      // Если вывод отфильтрованных значений отключен, выходим из функции
      if (!printFilteredValuesEnabled) return;
      
      try {
        // Проверяем, что контекст расширения валиден
        if (!chrome.runtime || !chrome.runtime.id) {
          Utils.log('Контекст расширения недоступен, пропускаем обработку');
          return;
        }
        
        // Собираем отфильтрованные значения из ссылок
        const filteredValues = collectFilteredValues();
        
        // Используем статическую переменную для хранения предыдущих значений
        if (!printFilteredValues.lastValues) {
          printFilteredValues.lastValues = [];
        }
        
        // Проверяем, изменились ли значения
        let valuesChanged = false;
        
        // Если количество элементов изменилось, значит значения изменились
        if (printFilteredValues.lastValues.length !== filteredValues.length) {
          valuesChanged = true;
        } else if (filteredValues.length > 0) {
          // Оптимизированная проверка: проверяем только первый элемент на наличие изменений
          // Это ускорит проверку, но все равно позволит обнаружить большинство изменений
          const newValue = filteredValues[0];
          const oldValue = printFilteredValues.lastValues[0];
          
          // Проверяем, изменились ли ключевые свойства
          if (!oldValue || 
              newValue.ticketId !== oldValue.ticketId || 
              newValue.country !== oldValue.country || 
              newValue.driverLicense !== oldValue.driverLicense) {
            valuesChanged = true;
          }
        }
        
        // Выводим в консоль только если значения изменились
        if (valuesChanged) {
          Utils.log('Отфильтрованные значения:', filteredValues);
          
          // Сохраняем текущие значения для следующего сравнения
          printFilteredValues.lastValues = JSON.parse(JSON.stringify(filteredValues));
          
          // Ищем значение ticketId в отфильтрованных значениях
          const ticketId = filteredValues.find((values) => values.ticketId);
          // Если значение ticketId найдено и оно не равно последнему обработанному ID тикета, выводим значения в консоль
          if (ticketId && ticketId.ticketId !== lastTicketId) {
            // Обновляем последний обработанный ID тикета
            lastTicketId = ticketId.ticketId;
            // Создаем объект для хранения найденных значений
            const values = {};
            // Объединяем значения из всех отфильтрованных значений
            filteredValues.forEach((value) => {
              Object.keys(value).forEach((key) => {
                if (value[key]) values[key] = value[key];
              });
            });
            
            // Выводим значения в консоль в заданном порядке
            Utils.log('Найденные данные:');
            if (values.ticketId) Utils.log(`ID тикета: %c${values.ticketId}`, 'font-weight: bold');
            if (values.ticketLink) Utils.log(`Ссылка на тикет: %c${values.ticketLink}`, 'font-weight: bold');
            if (values.country) Utils.log(`Страна: %c${values.country}`, 'font-weight: bold');
            if (values.driverLicense) Utils.log(`Номер ВУ: %c${values.driverLicense}`, 'font-weight: bold');
            
            Utils.log('Найдены данные для отправки:', values);
            
            // Отправляем данные для сбора (но не отправки уведомления)
            if (values.ticketId) {
              collectData(values);
            }
          }
        }
      } catch (error) {
        Utils.error('Ошибка при обработке отфильтрованных значений:', error);
      }
    }
    
    // Выводим ссылки и отфильтрованные значения в консоль
    // Проверяем URL ещё раз для надёжности
    const currentUrl = window.location.href;
    if (!currentUrl.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
      printLinks();
      printFilteredValues();
    }
    
    // Повторяем функции после каждого изменения страницы
    /**
     * Наблюдатель за изменениями страницы.
     * Он будет вызывать функции printLinks и printFilteredValues после каждого изменения страницы.
     */
    // Инициализируем переменную для хранения идентификатора таймаута
    let timeoutId = null;
    
    // Создаем новый MutationObserver для отслеживания изменений на странице
    const observer = new MutationObserver((mutations) => {
      try {
        // Проверяем, что контекст расширения валиден
        if (!chrome.runtime || !chrome.runtime.id) {
          Utils.log('Контекст расширения недоступен, отключаем наблюдатель');
          observer.disconnect(); // Отключаем наблюдатель, если контекст расширения недействителен
          return;
        }
        
        // Игнорируем события клавиатуры
        if (document.activeElement instanceof HTMLInputElement) return;
        
        // Проверяем, есть ли релевантные изменения
        let hasRelevantChanges = false;
        
        for (const mutation of mutations) {
          // Игнорируем изменения, вызванные маркером
          if (mutation.target && mutation.target.classList && 
              mutation.target.classList.contains('marker-highlight')) {
            continue;
          }
          
          // Проверяем, не вызвано ли изменение добавлением выделений маркера
          let isMarkerHighlight = false;
          if (mutation.addedNodes.length > 0) {
            for (let i = 0; i < mutation.addedNodes.length; i++) {
              const node = mutation.addedNodes[i];
              if (node.nodeType === Node.ELEMENT_NODE && 
                  node.classList && 
                  node.classList.contains('marker-highlight')) {
                isMarkerHighlight = true;
                break;
              }
            }
          }
          
          // Если это выделение маркера, пропускаем
          if (isMarkerHighlight) {
            continue;
          }
          
          // Если есть добавленные узлы, которые не являются выделениями маркера
          if (mutation.addedNodes.length > 0) {
            hasRelevantChanges = true;
            break;
          }
          
          // Если изменились атрибуты, которые могут содержать ссылки
          if (mutation.type === 'attributes' && 
              (mutation.attributeName === 'href' || mutation.attributeName === 'src')) {
            hasRelevantChanges = true;
            break;
          }
        }
        
        // Если нет релевантных изменений, выходим
        if (!hasRelevantChanges) {
          return;
        }
        
        // Очищаем предыдущий таймаут
        clearTimeout(timeoutId);
        
        // Обновляем таймер обнаружения изменений
        // Устанавливаем новый таймаут на 200 миллисекунд
        timeoutId = setTimeout(() => {
          try {
            // Проверяем, что контекст расширения валиден
            if (!chrome.runtime || !chrome.runtime.id) {
              Utils.log('Контекст расширения недоступен, пропускаем обработку');
              return;
            }
            
            // Проверяем URL - не запускаем поиск данных на страницах карточек водителей
            const currentUrl = window.location.href;
            if (currentUrl.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
              Utils.log('MutationObserver: страница карточки водителя - пропускаем поиск данных');
              return;
            }
            
            // Отметка о том, что произошло обновление данных на странице
            dataLastChangedTimestamp = Date.now();
            
            // Выводим ссылки на странице
            printLinks();
            // Выводим отфильтрованные значения из ссылок (отправка в collectData произойдет внутри)
            printFilteredValues();
          } catch (error) {
            Utils.error('Ошибка при обработке изменений страницы:', error);
          }
        }, 200); // Уменьшаем задержку до 200 миллисекунд
      } catch (error) {
        Utils.error('Ошибка в наблюдателе за изменениями страницы:', error);
      }
    });
    
    // Настраиваем и запускаем observer
    observer.observe(document, {
      childList: true,
      subtree: true
    });
  });
}

// Функция для выполнения тестирования (поиск только номера ВУ)
function performTestingSearch() {
  Utils.log('Функция тестирования временно недоступна');
}

// Функции для отслеживания действий пользователя
let userActionListeners = [];

function attachUserActionListeners() {
  // Отслеживаем клики
  const clickListener = (event) => {
    if (event.target) {
      const tagName = event.target.tagName;
      const className = event.target.className;
      const id = event.target.id;
      const text = event.target.textContent ? event.target.textContent.slice(0, 100) : '';
      
      logAction('Клик по элементу', {
        tagName: tagName,
        className: className,
        id: id,
        text: text,
        x: event.clientX,
        y: event.clientY
      });
      Utils.log('Клик по элементу', {
        tagName: tagName,
        className: className,
        id: id,
        text: text,
        x: event.clientX,
        y: event.clientY
      });
    }
  };
  
  // Отслеживаем ввод в поля
  const inputListener = (event) => {
    if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA')) {
      const id = event.target.id;
      const name = event.target.name;
      const type = event.target.type;
      const value = type === 'password' ? '[пароль скрыт]' : event.target.value.slice(0, 50);
      
      logAction('Ввод в поле', {
        id: id,
        name: name,
        type: type,
        value: value
      });
      Utils.log('Ввод в поле', {
        id: id,
        name: name,
        type: type,
        value: value
      });
    }
  };
  
  // Отслеживаем нажатие клавиш
  const keydownListener = (event) => {
    const key = event.key;
    const code = event.code;
    const ctrlKey = event.ctrlKey;
    const altKey = event.altKey;
    const shiftKey = event.shiftKey;
    
    // Логируем только специальные клавиши и комбинации
    if (ctrlKey || altKey || key === 'Enter' || key === 'Escape' || key.startsWith('F')) {
      logAction('Нажатие клавиши', {
        key: key,
        code: code,
        ctrlKey: ctrlKey,
        altKey: altKey,
        shiftKey: shiftKey
      });
      Utils.log('Нажатие клавиши', {
        key: key,
        code: code,
        ctrlKey: ctrlKey,
        altKey: altKey,
        shiftKey: shiftKey
      });
    }
  };
  
  // Отслеживаем изменения URL
  const urlChangeListener = () => {
    logAction('Изменение URL страницы', {
      newUrl: window.location.href,
      title: document.title
    });
    Utils.log('Изменение URL страницы', {
      newUrl: window.location.href,
      title: document.title
    });
    
    // Сбрасываем состояние автопоиска при изменении URL
    if (window.AutosearchModule) {
      window.AutosearchModule.resetAutosearchState();
    }
  };
  
  // Добавляем слушатели
  document.addEventListener('click', clickListener, true);
  document.addEventListener('input', inputListener, true);
  document.addEventListener('keydown', keydownListener, true);
  
  // Отслеживаем изменения истории
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    urlChangeListener();
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    urlChangeListener();
  };
  
  window.addEventListener('popstate', urlChangeListener);
  
  // Сохраняем ссылки на слушатели для последующего удаления
  userActionListeners = [
    { element: document, event: 'click', listener: clickListener, capture: true },
    { element: document, event: 'input', listener: inputListener, capture: true },
    { element: document, event: 'keydown', listener: keydownListener, capture: true },
    { element: window, event: 'popstate', listener: urlChangeListener, capture: false },
    { type: 'history', originalPushState: originalPushState, originalReplaceState: originalReplaceState }
  ];
  
  logAction('Прикреплены слушатели действий пользователя');
  Utils.log('Прикреплены слушатели действий пользователя');
}

function detachUserActionListeners() {
  // Удаляем все слушатели
  userActionListeners.forEach(listenerInfo => {
    if (listenerInfo.type === 'history') {
      // Восстанавливаем оригинальные методы истории
      history.pushState = listenerInfo.originalPushState;
      history.replaceState = listenerInfo.originalReplaceState;
    } else {
      listenerInfo.element.removeEventListener(listenerInfo.event, listenerInfo.listener, listenerInfo.capture);
    }
  });
  
  userActionListeners = [];
  logAction('Отключены слушатели действий пользователя');
  Utils.log('Отключены слушатели действий пользователя');
}

// Модуль автопоиска вынесен в отдельный файл js/modules/autosearch.js