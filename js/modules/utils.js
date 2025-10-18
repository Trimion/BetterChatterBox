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

// Модуль с общими утилитами
(function(window) {
  "use strict";
  
  // Объект для экспорта функций
  const Utils = {};
  
  /**
   * Проверяет, является ли контекст расширения валидным
   * @returns {boolean} - true если контекст валиден
   */
  Utils.isExtensionContextValid = function() {
    try {
      return chrome.runtime && chrome.runtime.id;
    } catch (e) {
      return false;
    }
  };
  
  /**
   * Безопасное логирование с учетом настроек
   * @param {...*} args - Аргументы для console.log
   */
  Utils.log = function(...args) {
    if (!Utils.isExtensionContextValid()) {
      return;
    }
    
    chrome.storage.local.get(['loggingEnabled'], (result) => {
      if (result.loggingEnabled) {
        console.log(...args);
      }
    });
    
    // Дублирование в файл логирования (если включено второе логирование)
    Utils.logToFile(...args);
  };
  
  /**
   * Безопасное логирование предупреждений с учетом настроек
   * @param {...*} args - Аргументы для console.warn
   */
  Utils.warn = function(...args) {
    if (!Utils.isExtensionContextValid()) {
      return;
    }
    
    chrome.storage.local.get(['loggingEnabled'], (result) => {
      if (result.loggingEnabled) {
        console.warn(...args);
      }
    });
    
    // Дублирование в файл логирования (если включено второе логирование)
    Utils.logToFile(...args);
  };
  
  /**
   * Безопасное логирование ошибок с учетом настроек
   * @param {...*} args - Аргументы для console.error
   */
  Utils.error = function(...args) {
    if (!Utils.isExtensionContextValid()) {
      return;
    }
    
    chrome.storage.local.get(['loggingEnabled'], (result) => {
      if (result.loggingEnabled) {
        console.error(...args);
      }
    });
    
    // Дублирование в файл логирования (если включено второе логирование)
    Utils.logToFile(...args);
  };
  
  /**
   * Дублирование логов в файл логирования
   * @param {...*} args - Аргументы для логирования
   */
  Utils.logToFile = function(...args) {
    if (!Utils.isExtensionContextValid()) {
      return;
    }
    
    chrome.storage.local.get(['actionLoggingEnabled', 'actionLogs'], (result) => {
      if (result.actionLoggingEnabled) {
        const actionLogs = result.actionLogs || [];
        const timestamp = new Date().toISOString();
        const logEntry = {
          timestamp: timestamp,
          message: args.join(' '),
          data: args.length > 1 ? args.slice(1) : null,
          url: window.location.href || 'background',
          source: 'Utils.log_duplicate'
        };
        
        actionLogs.push(logEntry);
        
        if (actionLogs.length > 10000) {
          actionLogs.splice(0, actionLogs.length - 10000);
        }
        
        chrome.storage.local.set({ actionLogs: actionLogs });
      }
    });
  };
  
  /**
   * Безопасная отправка сообщения с повторными попытками
   * @param {Object} message - Сообщение для отправки
   * @param {number} maxAttempts - Максимальное количество попыток
   * @param {number} delay - Задержка между попытками в мс
   * @param {Function} callback - Функция обратного вызова
   * @returns {Promise} - Промис с результатом отправки
   */
  Utils.safeSendMessage = function(message, maxAttempts = 3, delay = 1000, callback = null) {
    if (!Utils.isExtensionContextValid()) {
      Utils.error('Контекст расширения недействителен');
      if (callback) callback(null);
      return Promise.reject(new Error('Extension context invalidated'));
    }
    
    let attempts = 0;
    
    return new Promise((resolve, reject) => {
      const trySendMessage = () => {
        attempts++;
        try {
          chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
              Utils.warn(`Ошибка отправки сообщения (попытка ${attempts}/${maxAttempts}):`, chrome.runtime.lastError);
              
              if (attempts < maxAttempts) {
                setTimeout(trySendMessage, delay);
              } else {
                Utils.error('Превышено максимальное количество попыток отправки сообщения:', message);
                reject(chrome.runtime.lastError);
                if (callback) callback(null);
              }
            } else {
              Utils.log('Сообщение успешно отправлено:', message);
              resolve(response);
              if (callback) callback(response);
            }
          });
        } catch (error) {
          Utils.error('Исключение при отправке сообщения:', error);
          
          if (attempts < maxAttempts) {
            setTimeout(trySendMessage, delay);
          } else {
            Utils.error('Превышено максимальное количество попыток отправки сообщения:', message);
            reject(error);
            if (callback) callback(null);
          }
        }
      };
      
      trySendMessage();
    });
  };
  
  /**
   * Получение значения из локального хранилища
   * @param {string} key - Ключ для получения
   * @param {*} defaultValue - Значение по умолчанию
   * @returns {Promise} - Промис с результатом
   */
  Utils.getStorageValue = function(key, defaultValue = null) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] !== undefined ? result[key] : defaultValue);
      });
    });
  };
  
  /**
   * Сохранение значения в локальное хранилище
   * @param {string} key - Ключ для сохранения
   * @param {*} value - Значение для сохранения
   * @returns {Promise} - Промис с результатом
   */
  Utils.setStorageValue = function(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
  };
  
  /**
   * Проверяет, является ли компонент подкомпонентом известного контейнера
   * @param {Element} component - Элемент компонента для проверки
   * @param {Element} componentsContainer - Контейнер всех компонентов
   * @returns {boolean} - true если компонент является подкомпонентом известного контейнера
   */
  Utils.isComponentSubComponent = function(component, componentsContainer) {
    try {
      // Получаем все известные контейнеры из маппинга
      const knownContainers = ['Требования', 'Заказ', 'Ожидание'];
      
      // Проверяем, находится ли текущий компонент внутри известного контейнера
      for (const containerName of knownContainers) {
        // Ищем родительский контейнер с известным названием
        let parentContainer = component.parentElement;
        while (parentContainer && parentContainer !== componentsContainer) {
          const headerElement = parentContainer.querySelector('.panel__header-content');
          if (headerElement) {
            const parentName = headerElement.textContent.trim().replace(/\d+\s*₽.*$/, '').trim();
            if (parentName === containerName) {
              Utils.log('Utils: Компонент является подкомпонентом известного контейнера:', containerName);
              return true;
            }
          }
          parentContainer = parentContainer.parentElement;
        }
      }
      
      return false;
    } catch (error) {
      Utils.error('Ошибка при проверке подкомпонента:', error);
      return false;
    }
  };
  
  /**
   * Получает структуру компонента для отладки
   * @param {Element} component - Элемент компонента
   * @returns {Object} - Объект с информацией о структуре компонента
   */
  Utils.getComponentStructure = function(component) {
    try {
      const structure = {
        hasHeader: false,
        hasBody: false,
        subComponents: 0,
        parentContainers: []
      };
      
      // Проверяем наличие заголовка
      const headerElement = component.querySelector('.panel__header-content');
      if (headerElement) {
        structure.hasHeader = true;
        structure.headerText = headerElement.textContent.trim();
      }
      
      // Проверяем наличие содержимого
      const bodyElement = component.querySelector('.panel__body');
      if (bodyElement) {
        structure.hasBody = true;
        
        // Подсчитываем подкомпоненты
        const keyValueElements = bodyElement.querySelectorAll('.KeyValue');
        structure.subComponents = keyValueElements.length;
        
        // Получаем названия подкомпонентов
        structure.subComponentNames = [];
        keyValueElements.forEach(keyValue => {
          const labelElement = keyValue.querySelector('div:first-child');
          if (labelElement) {
            structure.subComponentNames.push(labelElement.textContent.trim());
          }
        });
      }
      
      // Получаем информацию о родительских контейнерах
      let parentContainer = component.parentElement;
      let level = 0;
      while (parentContainer && level < 5) { // Ограничиваем глубину поиска
        const parentHeader = parentContainer.querySelector('.panel__header-content');
        if (parentHeader) {
          const parentName = parentHeader.textContent.trim().replace(/\d+\s*₽.*$/, '').trim();
          structure.parentContainers.push({
            level: level,
            name: parentName
          });
        }
        parentContainer = parentContainer.parentElement;
        level++;
      }
      
      return structure;
    } catch (error) {
      Utils.error('Ошибка при получении структуры компонента:', error);
      return { error: error.message };
    }
  };
  
  /**
   * Форматирует единицы измерения согласно правилам
   * @param {string} value - Значение для форматирования
   * @returns {string} - Отформатированное значение
   */
  Utils.formatUnits = function(value) {
    try {
      if (!value || typeof value !== 'string') {
        return value;
      }
      
      // Единицы измерения БЕЗ точки на конце
      const unitsWithoutDot = ['кг', 'м', 'км', 'млн', 'млрд', 'трлн', 'мин', 'ч'];
      
      // Единицы измерения С точкой на конце
      const unitsWithDot = ['тыс', 'шт', 'кв. м', 'куб. м', 'сек'];
      
      let formattedValue = value;
      
      // Обрабатываем единицы измерения без точки
      unitsWithoutDot.forEach(unit => {
        const regex = new RegExp(`\\b${unit}\\.\\b`, 'g');
        formattedValue = formattedValue.replace(regex, unit);
      });
      
      // Обрабатываем единицы измерения с точкой
      unitsWithDot.forEach(unit => {
        const regex = new RegExp(`\\b${unit.replace('.', '\\.')}\\b`, 'g');
        if (!formattedValue.includes(unit)) {
          // Если единица есть, но без точки, добавляем точку
          const withoutDot = unit.replace('.', '');
          const regexWithoutDot = new RegExp(`\\b${withoutDot}\\b`, 'g');
          formattedValue = formattedValue.replace(regexWithoutDot, unit);
        }
      });
      
      return formattedValue;
    } catch (error) {
      Utils.error('Ошибка при форматировании единиц измерения:', error);
      return value;
    }
  };
  
  /**
   * Финальное форматирование всего текста - убирает точки у единиц измерения
   * @param {string} text - Весь текст для финального форматирования
   * @returns {string} - Отформатированный текст
   */
  Utils.formatFinalText = function(text) {
    try {
      if (!text || typeof text !== 'string') {
        return text;
      }
      
      let formattedText = text;
      
                    // Единицы измерения БЕЗ точки на конце - убираем точки
       const unitsWithoutDot = ['кг', 'м', 'км', 'млн', 'млрд', 'трлн', 'мин', 'ч'];
       
       unitsWithoutDot.forEach(unit => {
         // Ищем "мин.", "км." и т.д. и заменяем на "мин", "км"
         const regex = new RegExp(`${unit}\\.`, 'g');
         formattedText = formattedText.replace(regex, unit);
       });
       
       // Единицы измерения С точкой на конце - добавляем точки если их нет
       const unitsWithDot = ['тыс', 'шт', 'кв. м', 'куб. м', 'сек'];
       
       unitsWithDot.forEach(unit => {
         const unitWithDot = unit.includes('.') ? unit : unit + '.';
         const unitWithoutDot = unit.replace('.', '');
         
         // Если единица есть без точки, добавляем точку
         const regex = new RegExp(`\\b${unitWithoutDot}\\b`, 'g');
         if (formattedText.includes(unitWithoutDot) && !formattedText.includes(unitWithDot)) {
           formattedText = formattedText.replace(regex, unitWithDot);
         }
       });
      
      Utils.log('Utils: Финальное форматирование применено к тексту');
      return formattedText;
    } catch (error) {
      Utils.error('Ошибка при финальном форматировании текста:', error);
      return text;
    }
  };
  
  // Экспортируем модуль в глобальную область видимости
  window.Utils = Utils;
})(window); 