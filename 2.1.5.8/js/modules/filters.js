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

// Модуль с функциями фильтрации
(function(window) {
  "use strict";
  
  // Объект для экспорта функций
  const Filters = {};
  
  // Контрольные bool значения для функций фильтрации
  let filterTicketEnabled = true; // Функция filterTicket для фильтрации тикетов
  let getTicketLinkEnabled = true; // Функция getTicketLink для получения ссылки на тикет
  let filterCountryEnabled = true; // Функция filterCountry для фильтрации страны
  let filterDriver_LicenseEnabled = true; // Функция filterDriver_License для фильтрации driver_license
  
  /**
   * Получение всех ссылок на странице
   * @returns {HTMLAnchorElement[]} - Массив ссылок
   */
  Filters.getLinks = function() {
    try {
      // Получаем все ссылки на странице с помощью querySelectorAll
      let links = Array.from(document.querySelectorAll('a'));
      return links;
    } catch (error) {
      console.error('Ошибка при получении ссылок:', error);
      return [];
    }
  };
  
  /**
   * Извлекает значение ticket_id из ссылки.
   * @param {HTMLAnchorElement} link - Ссылка.
   * @param {Object} context - Контекст для хранения найденных значений.
   * @returns {string|null} - Значение ticket_id или null, если не найдено.
   */
  Filters.filterTicket = function(link, context = {}) {
    if (!filterTicketEnabled) return null;
    
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
          
          return {
            type: 'ticket',
            id: ticketId,
            link: Filters.getTicketLink(ticketId),
            context: context
          };
        }
      }
      
      // Также проверяем паттерны для Startrek
      const startrekPattern = /(?:ticket|st)\/([A-Z]+-\d+)/i;
      const startrekMatch = url.href.match(startrekPattern);
      
      if (startrekMatch && startrekMatch[1]) {
        const ticketId = startrekMatch[1].toUpperCase();
        
        // Проверяем, найдено ли значение ранее
        if (context[ticketId]) {
          return null;
        }
        context[ticketId] = true;
        
        return {
          type: 'ticket',
          id: ticketId,
          link: Filters.getTicketLink(ticketId),
          context: context
        };
      }
      
      return null;
    } catch (error) {
      // Если ошибка, возвращаем null
      if (error instanceof TypeError && error.message.includes('Invalid URL')) {
        return null;
      }
      console.warn(`Ошибка при обработке ссылки: ${link.href}`, error);
      return null;
    }
  };
  
  /**
   * Получение ссылки на тикет
   * @param {string} ticketId - ID тикета
   * @returns {string} - Ссылка на тикет
   */
  Filters.getTicketLink = function(ticketId) {
    if (!getTicketLinkEnabled || !ticketId) return '';
    
    try {
      // Определяем тип тикета по формату
      if (/^[0-9a-fA-F]{24}$/.test(ticketId)) {
        // Это ID тикета Chatterbox
        return `https://chatterbox.taxi.yandex.ru/tickets/${ticketId}`;
      } else if (/^[A-Z]+-\d+$/.test(ticketId)) {
        // Это ID тикета Startrek
        if (ticketId.startsWith('TAXIRATE')) {
          return `https://st.yandex-team.ru/TAXIRATE/${ticketId}`;
        } else {
          return `https://st.yandex-team.ru/${ticketId}`;
        }
      }
      
      return '';
    } catch (error) {
      console.error('Ошибка при получении ссылки на тикет:', error);
      return '';
    }
  };
  
  /**
   * Фильтрация по стране
   * @param {HTMLAnchorElement} link - Ссылка для фильтрации
   * @returns {Object|null} - Результат фильтрации или null
   */
  Filters.filterCountry = function(link) {
    if (!filterCountryEnabled) return null; // если фильтрация страны отключена, выходим из функции
    if (!link || !link.href) return null; // если ссылка не существует или не имеет href, возвращаем null
    
    try {
      const url = new URL(link.href.replace(/\/$/, '')); // создаем объект URL из ссылки
      if (url.pathname.includes("sms") || url.pathname.includes("iframe") || url.pathname.includes("tariff")) {
        return null; // игнорируем URLs с "sms", "iframe", или "tariff" в пути
      }
      if (url.href.startsWith('https://forms.yandex-team.ru/surveys/')) {
        const surveyId = url.href.match(/surveys\/(\d+)/)[1];
        if (surveyId !== '147630' && Filters.getLinks().some((l) => l.href.includes('forms.yandex-team.ru/surveys/147630/'))) {
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
          /\/([a-zA-Z]{2,3})\/(?!tariff)/, // поиск в пути URL, но не в tariff
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
        country = Filters.iso3166Alpha2ToAlpha3(country); // преобразуем код страны из 2 букв в 3 буквы
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
        'mol': 'Молдавия',
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
      let countryName;
      if (country.toLowerCase() in countryCodes) {
        countryName = countryCodes[country.toLowerCase()]; // заменяем код страны на полное название
      } else {
        countryName = 'skull'; // если значение не найдено в countryCodes, присваиваем 'skull'
      }
      
      return {
        type: 'country',
        code: country.toUpperCase(),
        name: countryName
      };
    } catch (error) {
      // игнорируем ошибку и возвращаем null
      return null;
    }
  };
  
  /**
   * Преобразование ISO 3166-1 alpha-2 в alpha-3
   * @param {string} alpha2 - Двухбуквенный код страны
   * @returns {string|null} - Трехбуквенный код страны или null
   */
  Filters.iso3166Alpha2ToAlpha3 = function(alpha2) {
    if (!alpha2 || alpha2.length !== 2) return null;
    
    const conversionMap = {
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
    };
    
    return conversionMap[alpha2.toLowerCase()] || alpha2.toLowerCase();
  };
  
  /**
   * Фильтрация водительских прав
   * @param {HTMLAnchorElement|string} link - Ссылка или текст для фильтрации
   * @returns {Object|null} - Результат фильтрации или null
   */
  Filters.filterDriver_License = function(link) {
    if (!filterDriver_LicenseEnabled) return null;
    
    try {
      // Если link - это строка, ищем в ней
      if (typeof link === 'string') {
        // Регулярное выражение для поиска водительских прав в тексте
        const licenseRegex = /\b(\d{2}\s*[А-Я]{2}\s*\d{6})\b/i;
        const match = link.match(licenseRegex);
        
        if (match && match[1]) {
          // Нормализуем формат водительских прав (удаляем пробелы)
          const licenseNumber = match[1].replace(/\s+/g, '');
          
          // Проверяем формат: 2 цифры, 2 буквы, 6 цифр
          const formatRegex = /^(\d{2})([А-Я]{2})(\d{6})$/i;
          const formatMatch = licenseNumber.match(formatRegex);
          
          if (formatMatch) {
            const [, series1, series2, number] = formatMatch;
            
            // Проверяем, найдено ли значение ранее
            const context = Filters.filterDriver_License.context || (Filters.filterDriver_License.context = {});
            if (context[licenseNumber]) {
              return null;
            }
            context[licenseNumber] = true;
            
            return {
              type: 'driver_license',
              original: match[1],
              normalized: licenseNumber,
              series: `${series1}${series2}`,
              number: number
            };
          }
        }
        
        return null;
      }
      
      // Если link - это ссылка, обрабатываем её
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
      const context = Filters.filterDriver_License.context || (Filters.filterDriver_License.context = {});
      if (context[driverLicense]) {
        return null;
      }
      context[driverLicense] = true;
      
      return {
        type: 'driver_license',
        original: driverLicense,
        normalized: driverLicense,
        series: driverLicense.substring(0, 4),
        number: driverLicense.substring(4)
      };
    } catch (error) {
      return null; // если не найдено, возвращаем null
    }
  };
  
  /**
   * Собирает отфильтрованные значения из ссылок
   * @returns {Object} - Объект с отфильтрованными значениями
   */
  Filters.collectFilteredValues = function() {
    try {
      // Проверяем, что контекст расширения валиден
      if (!chrome.runtime || !chrome.runtime.id) {
        console.log('Контекст расширения недоступен, пропускаем сбор данных');
        return {
          tickets: [],
          countries: [],
          driver_licenses: []
        };
      }
      
      // Получаем все ссылки на странице
      const links = Filters.getLinks();
      console.log('Найдено ссылок:', links.length);
      
      // Создаем контекст для хранения найденных значений
      const context = {};
      
      // Создаем объект для хранения результатов
      const result = {
        tickets: [],
        countries: [],
        driver_licenses: []
      };
      
      // Обрабатываем каждую ссылку
      links.forEach((link) => {
        try {
          // Ищем тикеты
          const ticketResult = Filters.filterTicket(link, context);
          if (ticketResult) {
            result.tickets.push(ticketResult);
          }
          
          // Ищем страны
          const countryResult = Filters.filterCountry(link);
          if (countryResult) {
            result.countries.push(countryResult);
          }
          
          // Ищем водительские права
          const licenseResult = Filters.filterDriver_License(link);
          if (licenseResult) {
            result.driver_licenses.push(licenseResult);
          }
        } catch (error) {
          console.error('Ошибка при обработке ссылки:', error);
        }
      });
      
      // Также ищем водительские права в тексте страницы
      try {
        const pageText = document.body.innerText;
        const licenseResult = Filters.filterDriver_License(pageText);
        if (licenseResult) {
          result.driver_licenses.push(licenseResult);
        }
      } catch (error) {
        console.error('Ошибка при поиске водительских прав в тексте страницы:', error);
      }
      
      // Выводим результаты в консоль
      if (result.tickets.length > 0 || result.countries.length > 0 || result.driver_licenses.length > 0) {
        console.log('Найдены данные:', result);
      } else {
        console.log('Данные не найдены');
      }
      
      return result;
    } catch (error) {
      console.error('Ошибка при сборе отфильтрованных значений:', error);
      return {
        tickets: [],
        countries: [],
        driver_licenses: []
      };
    }
  };
  
  // Экспортируем модуль в глобальную область видимости
  window.Filters = Filters;
})(window); 