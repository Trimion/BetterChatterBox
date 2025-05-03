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
      console.log(...args);
      return;
    }
    
    chrome.storage.local.get(['loggingEnabled'], (result) => {
      if (result.loggingEnabled) {
        console.log(...args);
      }
    });
  };
  
  /**
   * Безопасное логирование предупреждений с учетом настроек
   * @param {...*} args - Аргументы для console.warn
   */
  Utils.warn = function(...args) {
    if (!Utils.isExtensionContextValid()) {
      console.warn(...args);
      return;
    }
    
    chrome.storage.local.get(['loggingEnabled'], (result) => {
      if (result.loggingEnabled) {
        console.warn(...args);
      }
    });
  };
  
  /**
   * Безопасное логирование ошибок с учетом настроек
   * @param {...*} args - Аргументы для console.error
   */
  Utils.error = function(...args) {
    if (!Utils.isExtensionContextValid()) {
      console.error(...args);
      return;
    }
    
    chrome.storage.local.get(['loggingEnabled'], (result) => {
      if (result.loggingEnabled) {
        console.error(...args);
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
  
  // Экспортируем модуль в глобальную область видимости
  window.Utils = Utils;
})(window); 