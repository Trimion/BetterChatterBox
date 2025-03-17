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

// Выполнение функции напрямую при загрузке скрипта
performSearchAndNotify();

// Глобальная переменная для хранения настроек
if (typeof settings === 'undefined') {
  var settings = {};
}

// Запрос настроек у background.js при загрузке
chrome.runtime.sendMessage({ action: "getSettings" }, (response) => {
  if (response) {
    settings = response;
    Utils.log('Получены настройки:', settings);
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
document.addEventListener('DOMContentLoaded', initialize);

// Функция инициализации
function initialize() {
  Utils.log('Инициализация content.js...');
  
  // Выполняем поиск при инициализации
  performSearchAndNotify();
  
  // Добавляем обработчик горячих клавиш с использованием window
  window.addEventListener('keydown', handleHotkey, true);
  
  // Добавляем пассивные слушатели для событий прокрутки
  window.addEventListener('wheel', () => {}, { passive: true });
  window.addEventListener('touchmove', () => {}, { passive: true });
  
  // Добавляем обработчик для кнопки ПОИСК
  document.getElementById('searchButton')?.addEventListener('click', () => {
    Utils.log('Кнопка ПОИСК нажата, запускаем поиск...');
    chrome.runtime.sendMessage({ action: 'startSearch' });
  });
  
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
}

// Обработчик горячих клавиш
function handleHotkey(event) {
  // Alt + A (учитываем разные раскладки и регистры)
  if (event.altKey && (event.key.toLowerCase() === 'a' || event.keyCode === 65)) {
    Utils.log('Горячая клавиша Alt+A нажата, запускаем поиск...');
    event.preventDefault(); // Предотвращаем стандартное поведение
    performSearchAndNotify();
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
  
  // Обработка команды на выполнение поиска
  else if (request.action === 'runSearch') {
    Utils.log('Получена команда на выполнение поиска от background.js');
    performSearchAndNotify();
    sendResponse({ success: true });
  }
  
  // Обработка команды на выполнение тестирования (поиск только номера ВУ)
  else if (request.action === 'runTestingSearch') {
    Utils.log('Получена команда на выполнение тестирования от background.js');
    performTestingSearch();
    sendResponse({ success: true });
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
  
  return true; // Указываем, что будем отвечать асинхронно
});

// Добавляем глобальные переменные для отслеживания стабильности данных
let dataStabilityTimer = null;
let dataLastChangedTimestamp = 0;
const DATA_STABILITY_TIMEOUT = 500; // 0,5 секунд ожидания стабильности данных
const NOTIFICATION_DELAY = 100; // Задержка перед отправкой уведомления после стабилизации данных

// Основная функция поиска и уведомления
function performSearchAndNotify() {
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
    printLinks();
    printFilteredValues();
    
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
  Utils.log('Начинаем поиск номера ВУ для тестирования...');
  
  try {
    // Контрольные bool значения для функций фильтрации
    let filterDriver_LicenseEnabled = true; // Функция filterDriver_License для фильтрации driver_license
    
    // Функция для фильтрации номера ВУ
    function filterDriver_License(link) {
      if (!filterDriver_LicenseEnabled) return null;
      try {
        if (!link || !link.href) return null;
        
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
        Utils.error('Ошибка при фильтрации номера ВУ:', error);
        return null; // если не найдено, возвращаем null
      }
    }
    
    // Получаем все ссылки на странице
    const links = document.querySelectorAll('a');
    let foundDriverLicense = null;
    
    // Проходим по всем ссылкам и ищем номер ВУ
    for (const link of links) {
      const driverLicense = filterDriver_License(link);
      if (driverLicense) {
        foundDriverLicense = driverLicense;
        break;
      }
    }
    
    if (foundDriverLicense) {
      Utils.log('Найден номер ВУ:', foundDriverLicense);
      
      try {
        // Копируем номер ВУ в буфер обмена
        const textarea = document.createElement('textarea');
        textarea.value = foundDriverLicense;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        Utils.log('Номер ВУ скопирован в буфер обмена:', foundDriverLicense);
      } catch (copyError) {
        Utils.error('Ошибка при копировании номера ВУ в буфер обмена:', copyError);
      }
      
      // Открываем страницу с результатами
      chrome.runtime.sendMessage({ 
        action: 'openResultsPage', 
        driverLicense: foundDriverLicense 
      }, (response) => {
        if (chrome.runtime.lastError) {
          Utils.error('Ошибка при отправке сообщения в background.js:', chrome.runtime.lastError.message);
        }
      });
    } else {
      Utils.log('Номер ВУ не найден');
      
      // Отправляем сообщение об отсутствии номера ВУ
      chrome.runtime.sendMessage({ 
        action: 'showTestingResults', 
        results: ['Номер ВУ не найден на текущей странице'] 
      }, (response) => {
        if (chrome.runtime.lastError) {
          Utils.error('Ошибка при отправке сообщения в background.js:', chrome.runtime.lastError.message);
        }
      });
    }
  } catch (error) {
    Utils.error('Ошибка при выполнении поиска номера ВУ:', error);
    
    // Отправляем сообщение об ошибке
    chrome.runtime.sendMessage({ 
      action: 'showTestingResults', 
      results: ['Ошибка при выполнении поиска номера ВУ: ' + error.message] 
    }, (response) => {
      if (chrome.runtime.lastError) {
        Utils.error('Ошибка при отправке сообщения в background.js:', chrome.runtime.lastError.message);
      }
    });
  }
} 