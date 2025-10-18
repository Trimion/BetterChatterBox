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

// Локальный объект Utils для notifications script
const Utils = {
  /**
   * Проверяет, является ли контекст расширения валидным
   * @returns {boolean} - true если контекст валиден
   */
  isExtensionContextValid: function() {
    try {
      return chrome.runtime && chrome.runtime.id;
    } catch (e) {
      return false;
    }
  },

  /**
   * Безопасное логирование с учетом настроек
   * @param {...*} args - Аргументы для console.log
   */
  log: function(...args) {
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
  },

  /**
   * Безопасное логирование предупреждений с учетом настроек
   * @param {...*} args - Аргументы для console.warn
   */
  warn: function(...args) {
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
  },

  /**
   * Безопасное логирование ошибок с учетом настроек
   * @param {...*} args - Аргументы для console.error
   */
  error: function(...args) {
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
  },

  /**
   * Дублирование логов в файл логирования
   * @param {...*} args - Аргументы для логирования
   */
  logToFile: function(...args) {
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
          url: 'notifications',
          source: 'Utils.log_duplicate'
        };
        
        actionLogs.push(logEntry);
        
        if (actionLogs.length > 10000) {
          actionLogs.splice(0, actionLogs.length - 10000);
        }
        
        chrome.storage.local.set({ actionLogs: actionLogs });
      }
    });
  }
};

let notificationsData = {};
let NotificationTimeout = 54000;
let lastNotificationTime = 0;
let currentNotificationId = null;
let isNotificationBlocked = false;

let notificationQueue = [];
let isLoadingComplete = false;

const FlagIconPath = 'img/flags/';
const DefaultIconPath = 'img/128.png';

function createNotification(data, notificationTimeout = NotificationTimeout) {
  // Сначала проверяем настройку отображения уведомлений
  return new Promise((resolve) => {
    chrome.storage.local.get(['notifications'], (result) => {
      // Если уведомления отключены в настройках, просто выходим из функции
      if (result.notifications === false) {
        Utils.log('Уведомления отключены в настройках. Уведомление не будет создано.');
        resolve(null);
        return;
      }
      
      // Далее оригинальная логика создания уведомления
      if (!data) {
        Utils.log('Данные уведомления не переданы');
        resolve(null);
        return;
      }
      
      if (isNotificationBlocked) {
        Utils.log('Создание уведомлений временно заблокировано');
        queueNotification(data);
        resolve(null);
        return;
      }
      
      const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      if (data.type === 'testing') {
        const resultsArray = data.message.split('\n');
        
        const leftColumn = [];
        const rightColumn = [];
        
        for (let i = 0; i < resultsArray.length; i++) {
          const result = resultsArray[i];
          const parts = result.split(' ');
          const score = parts.pop();
          const course = parts.join(' ');
          
          if (i % 2 === 0) {
            leftColumn.push({ course, score });
          } else {
            rightColumn.push({ course, score });
          }
        }
        
        const items = [];
        const maxLength = Math.max(leftColumn.length, rightColumn.length);
        
        for (let i = 0; i < maxLength; i++) {
          const left = leftColumn[i] ? `${leftColumn[i].course}: ${leftColumn[i].score}` : '';
          const right = rightColumn[i] ? `${rightColumn[i].course}: ${rightColumn[i].score}` : '';
          
          if (right) {
            items.push({
              title: `${left}    |    ${right}`,
              message: ''
            });
          } else {
            items.push({
              title: left,
              message: ''
            });
          }
        }
        
        const notificationData = {
          type: 'list',
          iconUrl: chrome.runtime.getURL(DefaultIconPath),
          title: data.title || 'Результаты тестирования',
          message: '',
          items: items,
          priority: 2,
          requireInteraction: notificationTimeout === 0
        };
        
        notificationsData[notificationId] = {
          data: data,
          timestamp: Date.now(),
          timeout: notificationTimeout
        };
        
        chrome.notifications.create(notificationId, notificationData, (createdId) => {
          if (chrome.runtime.lastError) {
            Utils.error('Ошибка при создании уведомления:', chrome.runtime.lastError);
            resolve(null);
            return;
          }
          
          Utils.log(`Уведомление создано с ID: ${createdId}`);
          currentNotificationId = createdId;
          
          setupNotification(createdId, data, notificationTimeout);
          resolve(createdId);
        });
      } else if (data.type === 'profession' || data.type === 'standard_tags' || data.type === 'custom_tags') {
        const notificationData = {
          type: 'basic',
          iconUrl: chrome.runtime.getURL(DefaultIconPath),
          title: data.title || 'Уведомление',
          message: data.message || 'Нет данных',
          priority: 2
        };
        
        notificationsData[notificationId] = {
          data: data,
          timestamp: Date.now(),
          timeout: notificationTimeout
        };
        
        chrome.notifications.create(notificationId, notificationData, (createdId) => {
          if (chrome.runtime.lastError) {
            Utils.error('Ошибка при создании уведомления:', chrome.runtime.lastError);
            resolve(null);
            return;
          }
          
          Utils.log(`Уведомление создано с ID: ${createdId}`);
          currentNotificationId = createdId;
          
          setupNotification(createdId, data, notificationTimeout);
          resolve(createdId);
        });
      } else {
        // ЛОГИРОВАНИЕ: Создание уведомления с данными водителя
        Utils.log('СОЗДАНИЕ УВЕДОМЛЕНИЯ С ДАННЫМИ ВОДИТЕЛЯ');
        Utils.log('Источник данных:', data);
        Utils.log('Stack trace:', new Error().stack);
        Utils.log('URL страницы:', window.location ? window.location.href : 'неизвестно');
        
        // Добавляем в систему логирования действий
        chrome.runtime.sendMessage({
          action: 'addActionLog',
          message: 'СОЗДАНИЕ УВЕДОМЛЕНИЯ С ДАННЫМИ ВОДИТЕЛЯ',
          data: {
            ticketId: data.ticketId,
            country: data.country,
            driverLicense: data.driverLicense,
            url: window.location ? window.location.href : 'неизвестно',
            stack: new Error().stack.split('\n').slice(0, 8).join('\n')
          },
          source: 'notifications.js'
        }).catch(() => {});
        
        let existingNotificationId = null;
        Object.keys(notificationsData).forEach((id) => {
          if (notificationsData[id]?.data?.ticketId === data.ticketId) {
            existingNotificationId = id;
          }
        });
        
        if (existingNotificationId) {
          Utils.log(`Найдено существующее уведомление для тикета #${data.ticketId}, обновляем его`);
          updateNotification(existingNotificationId, { ...data, isUpdate: true }, notificationTimeout);
          resolve(existingNotificationId);
          return;
        }
        
        const iconUrl = getNotificationIcon(data.country);
        
        const notificationData = {
          type: 'list',
          iconUrl,
          title: `Тикет #${data.ticketId || 'Неизвестно'}`,
          message: '',
          items: [
            { title: 'Страна:', message: data.country || 'Данные не найдены!' },
            { title: 'Номер ВУ:', message: data.driverLicense || 'Данные не найдены!' }
          ].map(item => ({ ...item, message: item.message ?? 'Данные не найдены!' })),
          buttons: getNotificationButtons(data),
          priority: 2,
          requireInteraction: notificationTimeout === 0
        };
        
        Utils.log('ДАННЫЕ УВЕДОМЛЕНИЯ:', notificationData);
        
        notificationsData[notificationId] = {
          data: data,
          timestamp: Date.now(),
          timeout: notificationTimeout
        };
        
        chrome.notifications.create(notificationId, notificationData, (createdId) => {
          if (chrome.runtime.lastError) {
            Utils.error('Ошибка при создании уведомления:', chrome.runtime.lastError);
            resolve(null);
            return;
          }
          
          Utils.log(`Уведомление создано с ID: ${createdId}`);
          currentNotificationId = createdId;
          
          setupNotification(createdId, data, notificationTimeout);
          resolve(createdId);
        });
      }
    });
  });
}

function getNotificationIcon(data) {
  try {
    if (!data) {
      return chrome.runtime.getURL(DefaultIconPath);
    }
    
    if (typeof data === 'string') {
      const country = data.toLowerCase();
    
    const countryToFile = {
      'армения': 'Армения.png',
      'азербайджан': 'Азербайджан.png',
      'беларусь': 'Беларусь.png',
      'боливия': 'Боливия.png',
      'кот-д\'ивуар': 'Кот-д\'Ивуар.png',
      'камерун': 'Камерун.png',
      'колумбия': 'Колумбия.png',
      'алжир': 'Алжир.png',
      'финляндия': 'Финляндия.png',
      'грузия': 'Грузия.png',
      'гана': 'Гана.png',
      'индия': 'Индия.png',
      'израиль': 'Израиль.png',
      'казахстан': 'Казахстан.png',
      'кыргызстан': 'Кыргызстан.png',
      'литва': 'Литва.png',
      'молдавия': 'Молдавия.png',
      'мозамбик': 'Мозамбик.png',
      'намибия': 'Намибия.png',
      'норвегия': 'Норвегия.png',
      'пакистан': 'Пакистан.png',
      'россия': 'Россия.png',
      'сенегал': 'Сенегал.png',
      'сербия': 'Сербия.png',
      'таджикистан': 'Таджикистан.png',
      'туркменистан': 'Туркменистан.png',
      'узбекистан': 'Узбекистан.png',
      'замбия': 'Замбия.png',
        'skull': 'skull.png'
      };
      
      if (countryToFile[country]) {
        return chrome.runtime.getURL(`${FlagIconPath}${countryToFile[country]}`);
      }
      
      return chrome.runtime.getURL(DefaultIconPath);
    }
    
    if (typeof data === 'object') {
      if (data.country) {
        return getNotificationIcon(data.country);
      }
      
      if (data.countryCode) {
        const countryCodeToName = {
          'ARM': 'Армения',
          'AZE': 'Азербайджан',
          'BLR': 'Беларусь',
          'BOL': 'Боливия',
          'CIV': 'Кот-д\'Ивуар',
          'CMR': 'Камерун',
          'COL': 'Колумбия',
          'DZA': 'Алжир',
          'FIN': 'Финляндия',
          'GEO': 'Грузия',
          'GHA': 'Гана',
          'IND': 'Индия',
          'ISR': 'Израиль',
          'KAZ': 'Казахстан',
          'KGZ': 'Кыргызстан',
          'LTU': 'Литва',
          'MDA': 'Молдавия',
          'MOL': 'Молдавия',
          'MOZ': 'Мозамбик',
          'NAM': 'Намибия',
          'NOR': 'Норвегия',
          'PAK': 'Пакистан',
          'RUS': 'Россия',
          'SEN': 'Сенегал',
          'SRB': 'Сербия',
          'TJK': 'Таджикистан',
          'TKM': 'Туркменистан',
          'UZB': 'Узбекистан',
          'ZMB': 'Замбия'
        };
        
        if (countryCodeToName[data.countryCode]) {
          return getNotificationIcon(countryCodeToName[data.countryCode]);
        }
      }
    }
    
    return chrome.runtime.getURL(DefaultIconPath);
  } catch (error) {
    Utils.error('Ошибка при получении иконки уведомления:', error);
    return chrome.runtime.getURL(DefaultIconPath);
  }
}

function checkNotificationQueue() {
  const now = Date.now();
  
  notificationQueue = notificationQueue
    .filter(item => item.timestamp > now)
    .sort((a, b) => a.timestamp - b.timestamp);
  
  if (notificationQueue.length > 0) {
    const nextNotification = notificationQueue[0];
    const delay = nextNotification.timestamp - now;
    
    setTimeout(() => {
      createNotification(nextNotification.data, nextNotification.timeout);
      notificationQueue.shift();
    }, delay);
  }
}

function updateNotification(notificationId, newData, notificationTimeout = NotificationTimeout) {
  // Сначала проверяем настройку отображения уведомлений
  return new Promise((resolve) => {
    chrome.storage.local.get(['notifications'], (result) => {
      // Если уведомления отключены в настройках, просто выходим из функции
      if (result.notifications === false) {
        Utils.log('Уведомления отключены в настройках. Уведомление не будет обновлено.');
        resolve(false);
        return;
      }
      
      // Далее оригинальная логика обновления уведомления
      if (!notificationId || !newData) {
        resolve(false);
        return;
      }
      
      if (!notificationsData[notificationId]) {
        Utils.log(`Уведомление с ID ${notificationId} не найдено в хранилище для обновления`);
        resolve(false);
        return;
      }
      
      // Получаем существующие данные и объединяем их с новыми
      const existingData = notificationsData[notificationId].data;
      const mergedData = { ...existingData, ...newData };
      
      Utils.log('Обновление уведомления. Существующие данные:', existingData);
      Utils.log('Новые данные:', newData);
      Utils.log('Объединенные данные:', mergedData);
      
      // Обновляем данные в хранилище
      notificationsData[notificationId] = {
        data: mergedData,
        timestamp: Date.now(),
        timeout: notificationTimeout
      };
      
      const isUpdate = newData.isUpdate === true;
      
      if (isUpdate) {
        // Для обновления данных водителя создаем новое уведомление
        createNotification(mergedData, notificationTimeout).then(newId => {
          // Если было создано новое уведомление, очищаем старое
          if (newId) {
            chrome.notifications.clear(notificationId);
            delete notificationsData[notificationId];
            Utils.log(`Создано новое уведомление с ID ${newId} для обновления старого ${notificationId}`);
            resolve(true);
          } else {
            Utils.log(`Не удалось создать новое уведомление для обновления ${notificationId}`);
            resolve(false);
          }
        });
      } else {
        // Обновляем существующее уведомление
        const iconUrl = getNotificationIcon(mergedData.country);
        
        const notificationData = {
          type: 'list',
          iconUrl,
          title: `Тикет #${mergedData.ticketId || 'Неизвестно'}`,
          message: '',
          items: [
            { title: 'Страна:', message: mergedData.country || 'Данные не найдены!' },
            { title: 'Номер ВУ:', message: mergedData.driverLicense || 'Данные не найдены!' }
          ].map(item => ({ ...item, message: item.message ?? 'Данные не найдены!' })),
          buttons: getNotificationButtons(mergedData),
          priority: 2,
          requireInteraction: notificationTimeout === 0
        };
        
        chrome.notifications.update(notificationId, notificationData, (updated) => {
          if (chrome.runtime.lastError) {
            Utils.error('Ошибка при обновлении уведомления:', chrome.runtime.lastError);
            resolve(false);
            return;
          }
          
          if (updated) {
            Utils.log(`Уведомление с ID ${notificationId} успешно обновлено`);
            resolve(true);
          } else {
            Utils.log(`Уведомление с ID ${notificationId} не найдено для обновления`);
            resolve(false);
          }
        });
      }
    });
  });
}

function setupNotification(id, data, notificationTimeout) {
  if (notificationsData[id] && notificationsData[id].timeoutId) {
    clearTimeout(notificationsData[id].timeoutId);
  }
  
  if (notificationTimeout > 0) {
    const timeoutId = setTimeout(() => {
      if (data.type === 'testing') {
        Utils.log(`Пропускаем очистку уведомления ${id} типа testing`);
        return;
      }
      
      chrome.notifications.clear(id);
      if (notificationsData[id]) {
        delete notificationsData[id];
      }
    }, notificationTimeout);
    
    if (notificationsData[id]) {
      notificationsData[id].timeoutId = timeoutId;
    } else {
      notificationsData[id] = {
        data: data,
        timeoutId: timeoutId,
        timeout: notificationTimeout
      };
    }
  }
  
  lastNotificationTime = Date.now();
  
  // Проверяем настройку записи текста уведомления в комментарий
  chrome.storage.local.get(['notificationToComment'], (result) => {
    if (result.notificationToComment === true) {
      if (data.type === 'profession' || data.type === 'standard_tags' || data.type === 'custom_tags') {
        Utils.log('🌐 GLOBAL: Запись уведомления в комментарий - ищем активную вкладку');
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length > 0) {
            // Пытаемся найти поле для ввода внутреннего комментария и записать в него текст уведомления
            Utils.log(`🌐 GLOBAL: Записываем уведомление в комментарий на вкладке ${tabs[0].id}`);
            writeNotificationToComment(tabs[0].id, data, true); // передаем флаг что функция активна
          } else {
            Utils.log('🌐 GLOBAL: Нет активной вкладки для записи комментария');
          }
        });
      }
    }
  });
}

function getNotificationButtons(data) {
    try {
        const buttons = [];
        if (data.driverLicense !== undefined && data.driverLicense !== null) {
            buttons.push({ title: 'Номер ВУ' });
        }
        if (data.country !== undefined && data.country !== null) {
            buttons.push({ title: 'Страна' });
        }
        return buttons;
    } catch (error) {
        Utils.log('Ошибка при генерации кнопок уведомления:', error);
        return [];
    }
}

function handleButtonClicked(notificationId, buttonIndex) {
    Utils.log(`Нажата кнопка ${buttonIndex} в уведомлении ${notificationId}`);
    
    const notificationData = notificationsData[notificationId];
    if (!notificationData) {
        Utils.log(`Уведомление с ID ${notificationId} не найдено или данные пусты`);
        return;
    }
        
        const buttons = getNotificationButtons(notificationData);
        if (buttonIndex >= 0 && buttonIndex < buttons.length) {
            const button = buttons[buttonIndex];
            let dataToCopy = null;
            
            Utils.log(`🌐 GLOBAL: Обработка нажатия кнопки: ${button.title} (индекс: ${buttonIndex})`);
            
            if (button.title === 'Номер ВУ') {
                dataToCopy = notificationData.driverLicense;
                Utils.log(`🌐 GLOBAL: Копирование номера ВУ: ${dataToCopy}`);
            } else if (button.title === 'Страна') {
                dataToCopy = notificationData.country;
                Utils.log(`🌐 GLOBAL: Копирование страны: ${dataToCopy}`);
            } else {
                Utils.warn(`🌐 GLOBAL: Неизвестная кнопка: ${button.title}`);
            }
            
            if (dataToCopy) {
                Utils.log(`🌐 GLOBAL: Вызываем executeScript для копирования: "${dataToCopy}"`);
                executeScript(null, dataToCopy, () => {
                    Utils.log(`🌐 GLOBAL: Данные "${dataToCopy}" успешно скопированы`);
                    
                    // Обновляем контекст уведомления
                    updateNotificationContext(notificationId, notificationData);
                });
            } else {
                Utils.error('🌐 GLOBAL: Данные для копирования не найдены');
            }
        } else {
            Utils.error(`🌐 GLOBAL: Некорректный индекс кнопки: ${buttonIndex}, доступно кнопок: ${buttons.length}`);
        }
}

function copyToClipboard(text) {
    Utils.log('🌐 GLOBAL: Копирование текста в буфер обмена из глобального уведомления:', text);
    
    // Пытаемся скопировать в активную вкладку, если она доступна
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: (text) => {
                    return new Promise((resolve) => {
                        navigator.clipboard.writeText(text)
                            .then(() => {
                                Utils.log('🌐 GLOBAL: Текст скопирован в буфер обмена из активной вкладки:', text);
                                resolve(true);
                            })
                            .catch((error) => {
                                Utils.error('🌐 GLOBAL: Ошибка при копировании текста:', error);
                                resolve(false);
                            });
                    });
                },
                args: [text]
            });
        } else {
            Utils.log('🌐 GLOBAL: Нет активной вкладки для копирования, используем альтернативный метод');
            // Альтернативный метод - копируем в первую доступную вкладку
            chrome.tabs.query({}, (allTabs) => {
                const validTab = allTabs.find(tab => 
                    tab.url && 
                    !tab.url.startsWith('chrome://') && 
                    !tab.url.startsWith('chrome-extension://')
                );
                
                if (validTab) {
                    chrome.scripting.executeScript({
                        target: { tabId: validTab.id },
                        func: (text) => {
                            return new Promise((resolve) => {
                                navigator.clipboard.writeText(text)
                                    .then(() => {
                                        Utils.log('🌐 GLOBAL: Текст скопирован в буфер обмена из доступной вкладки:', text);
                                        resolve(true);
                                    })
                                    .catch((error) => {
                                        Utils.error('🌐 GLOBAL: Ошибка при копировании текста:', error);
                                        resolve(false);
                                    });
                            });
                        },
                        args: [text]
                    });
                } else {
                    Utils.log('🌐 GLOBAL: Нет доступных вкладок для копирования');
                }
            });
        }
    });
}

function updateNotificationContext(notificationId, data) {
    chrome.notifications.getAll((chromeNotifications) => {
        if (chromeNotifications[notificationId]) {
            const timeout = chromeNotifications[notificationId].timeout;
            if (timeout !== null && timeout !== undefined) {
                const notificationOptions = {
                    buttons: getNotificationButtons(data),
                };
                chrome.notifications.update(notificationId, notificationOptions, (wasUpdated) => {
                    if (!wasUpdated) {
                        Utils.log(`Ошибка обновления уведомления ${notificationId}`);
                    } else {
                        Utils.log(`Уведомление ${notificationId} обновлено`);
                        notificationsData[notificationId].timeoutId = setTimeout(() => {
                            clearNotification();
                        }, timeout);
                    }
                });
            } else {
                Utils.log(`Timeout для уведомления ${notificationId} не установлен`);
            }
        } else {
            Utils.log(`Уведомление с ID ${notificationId} не найдено`);
        }
    });
}

function executeScript(tabId, data, callback) {
    Utils.log(`🌐 GLOBAL: Попытка копирования данных из глобального уведомления: "${data}"`);
    Utils.log(`🌐 GLOBAL: Переданный tabId: ${tabId}`);
    
    chrome.windows.getLastFocused((window) => {
        Utils.log(`🌐 GLOBAL: Получено окно: ${window ? window.id : 'null'}`);
        
        chrome.tabs.query({ active: true, windowId: window.id }, (tabs) => {
            Utils.log(`🌐 GLOBAL: Найдено активных вкладок: ${tabs.length}`);
            
            if (tabs.length === 0) {
                Utils.log('🌐 GLOBAL: Нет активных вкладок, ищем любую доступную вкладку');
                // Ищем любую доступную вкладку
                chrome.tabs.query({}, (allTabs) => {
                    Utils.log(`🌐 GLOBAL: Всего вкладок найдено: ${allTabs.length}`);
                    
                    const validTab = allTabs.find(tab => 
                        tab.url && 
                        !tab.url.startsWith('chrome://') && 
                        !tab.url.startsWith('chrome-extension://')
                    );
                    
                    if (validTab) {
                        Utils.log(`🌐 GLOBAL: Найдена доступная вкладка для копирования: ${validTab.url} (ID: ${validTab.id})`);
                        executeScriptOnTab(validTab.id, data, callback);
                    } else {
                        Utils.log('🌐 GLOBAL: Нет доступных вкладок для копирования');
                        if (callback) callback(false);
                    }
                });
                return;
            }
            
            const activeTab = tabs[0];
            
            if (!activeTab || !activeTab.id) {
                Utils.error('🌐 GLOBAL: Активная вкладка не найдена или не имеет ID');
                if (callback) callback(false);
                return;
            }
            
            Utils.log(`🌐 GLOBAL: Используем активную вкладку: ${activeTab.url} (ID: ${activeTab.id})`);
            executeScriptOnTab(activeTab.id, data, callback);
        });
    });
}

function executeScriptOnTab(tabId, data, callback) {
    Utils.log(`🌐 GLOBAL: Выполняем скрипт копирования на вкладке ${tabId}`);
    Utils.log(`🌐 GLOBAL: Данные для копирования: "${data}"`);
    
    // Проверяем валидность tabId
    if (!tabId || typeof tabId !== 'number') {
        Utils.error(`🌐 GLOBAL: Некорректный tabId: ${tabId}`);
        if (callback) callback(false);
        return;
    }
    
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (textToCopy) => {
            return new Promise((resolve) => {
                Utils.log(`🌐 GLOBAL: Начинаем копирование текста: "${textToCopy}"`);
                
                // Проверяем доступность API буфера обмена
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    Utils.log(`🌐 GLOBAL: Используем современный API буфера обмена`);
                    
                    navigator.clipboard.writeText(textToCopy)
                        .then(() => {
                            Utils.log(`🌐 GLOBAL: Данные "${textToCopy}" скопированы в буфер обмена через API`);
                            resolve(true);
                        })
                        .catch(err => {
                            Utils.error('🌐 GLOBAL: Ошибка при копировании через API:', err);
                            Utils.log(`🌐 GLOBAL: Переходим к альтернативному методу копирования`);
                            
                            // Альтернативный метод копирования
                            try {
                                const textarea = document.createElement('textarea');
                                textarea.value = textToCopy;
                                textarea.style.position = 'fixed';
                                textarea.style.opacity = '0';
                                textarea.style.left = '-9999px';
                                document.body.appendChild(textarea);
                                textarea.focus();
                                textarea.select();
                                const successful = document.execCommand('copy');
                                document.body.removeChild(textarea);
                                
                                if (successful) {
                                    Utils.log(`🌐 GLOBAL: Данные "${textToCopy}" скопированы альтернативным методом`);
                                    resolve(true);
                                } else {
                                    Utils.error('🌐 GLOBAL: Альтернативный метод копирования не сработал');
                                    resolve(false);
                                }
                            } catch (fallbackError) {
                                Utils.error('🌐 GLOBAL: Ошибка в альтернативном методе копирования:', fallbackError);
                                resolve(false);
                            }
                        });
                } else {
                    Utils.log(`🌐 GLOBAL: Современный API буфера обмена недоступен, используем альтернативный метод`);
                    
                    // Альтернативный метод копирования
                    try {
                        const textarea = document.createElement('textarea');
                        textarea.value = textToCopy;
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        textarea.style.left = '-9999px';
                        document.body.appendChild(textarea);
                        textarea.focus();
                        textarea.select();
                        const successful = document.execCommand('copy');
                        document.body.removeChild(textarea);
                        
                        if (successful) {
                            Utils.log(`🌐 GLOBAL: Данные "${textToCopy}" скопированы альтернативным методом`);
                            resolve(true);
                        } else {
                            Utils.error('🌐 GLOBAL: Альтернативный метод копирования не сработал');
                            resolve(false);
                        }
                    } catch (fallbackError) {
                        Utils.error('🌐 GLOBAL: Ошибка в альтернативном методе копирования:', fallbackError);
                        resolve(false);
                    }
                }
            });
        },
        args: [data]
    }, (results) => {
        if (chrome.runtime.lastError) {
            Utils.error('🌐 GLOBAL: Ошибка при выполнении скрипта:', chrome.runtime.lastError);
            if (callback) callback(false);
        } else if (results && results[0]) {
            const result = results[0].result;
            Utils.log('🌐 GLOBAL: Скрипт выполнен успешно, результат:', result);
            
            if (result === true) {
                Utils.log('🌐 GLOBAL: Копирование выполнено успешно');
                if (callback) callback(true);
            } else {
                Utils.error('🌐 GLOBAL: Копирование не удалось');
                if (callback) callback(false);
            }
        } else {
            Utils.error('🌐 GLOBAL: Скрипт выполнен, но результат неизвестен');
            if (callback) callback(false);
        }
    });
}

function clearNotification() {
    Utils.log('🌐 GLOBAL: Очищаем все глобальные уведомления');
    
    try {
        // Очищаем уведомления без привязки к активной вкладке
        chrome.notifications.getAll((allNotifications) => {
            Object.keys(allNotifications).forEach((notificationId) => {
                const notificationData = notificationsData[notificationId];
                if (notificationData && notificationData.data && notificationData.data.type === 'testing') {
                    Utils.log(`🌐 GLOBAL: Пропускаем уведомление ${notificationId} типа testing`);
                    return;
                }
                
                chrome.notifications.clear(notificationId, (wasCleared) => {
                    if (!wasCleared) {
                        Utils.log(`🌐 GLOBAL: Ошибка при удалении уведомления ${notificationId}`);
                    } else {
                        Utils.log(`🌐 GLOBAL: Уведомление ${notificationId} удалено`);
                        
                        // Отправляем сообщение во все вкладки вместо только активной
                        chrome.tabs.query({}, (tabs) => {
                            tabs.forEach(tab => {
                                if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
                                    chrome.tabs.sendMessage(tab.id, {
                                        action: 'notificationClosed',
                                        notificationId: notificationId
                                    }).catch(() => {
                                        // Игнорируем ошибки для вкладок без content script
                                    });
                                }
                            });
                        });
                    }
                });
            });
            
            Object.keys(notificationsData).forEach((notificationId) => {
                if (notificationsData[notificationId] !== undefined && notificationsData[notificationId] !== null) {
                    if (notificationsData[notificationId].data && notificationsData[notificationId].data.type === 'testing') {
                        Utils.log(`🌐 GLOBAL: Пропускаем уведомление ${notificationId} типа testing`);
                        return;
                    }
                    
                    if (notificationsData[notificationId].timeoutId) {
                        clearTimeout(notificationsData[notificationId].timeoutId);
                    }
                    
                    delete notificationsData[notificationId];
                }
            });
            
            notificationQueue = [];
            
            currentNotificationId = null;
            
            Utils.log('🌐 GLOBAL: Все глобальные уведомления очищены');
        });
    } catch (error) {
        Utils.error('🌐 GLOBAL: Ошибка при очистке уведомлений:', error);
    }
}

function queueNotification(notificationData) {
  notificationQueue.push({
    data: notificationData,
    timestamp: Date.now(),
    timeout: NotificationTimeout
  });
  Utils.log(`Уведомление добавлено в очередь. Текущий размер очереди: ${notificationQueue.length}`);
}

function showQueuedNotifications() {
  // Проверяем состояние настройки уведомлений
  chrome.storage.local.get(['notifications'], (result) => {
    // Если уведомления отключены, очищаем очередь и выходим
    if (result.notifications === false) {
      Utils.log('Уведомления отключены в настройках. Очередь уведомлений очищена.');
      notificationQueue = [];
      return;
    }
    
    // Если очередь пуста или загрузка ещё не завершена, выходим
    if (notificationQueue.length === 0 || !isLoadingComplete) {
      return;
    }

    // Получаем и удаляем первое уведомление из очереди
    const nextNotification = notificationQueue.shift();
    Utils.log(`Показываем отложенное уведомление из очереди. Осталось: ${notificationQueue.length}`);

    // Показываем уведомление
    createNotification(nextNotification.data, nextNotification.timeout);

    // Если в очереди есть ещё уведомления, показываем следующее через короткую задержку
    if (notificationQueue.length > 0) {
      setTimeout(showQueuedNotifications, 750);
    }
  });
}

function handleFocusChange() {
    clearNotification();
}

/**
 * Функция для записи текста уведомления в поле внутреннего комментария
 * @param {number} tabId - ID активной вкладки
 * @param {object} data - Данные уведомления
 * @param {boolean} showErrorNotification - Показывать ли уведомление об ошибке если поле не найдено
 */
function writeNotificationToComment(tabId, data, showErrorNotification = false) {
  // Получаем настройки вывода
  chrome.storage.local.get(['outputGreenOnly', 'outputProfession'], (settings) => {
    let comment = '';
    
    // Выбираем, какие данные включать в комментарий в зависимости от настроек
    if (data.type === 'profession') {
      // Включаем профессию только если включен соответствующий переключатель
      if (settings.outputProfession === true) {
        comment = data.message || '';
      }
    } else if (data.type === 'standard_tags' || data.type === 'custom_tags') {
      // Для тегов проверяем настройку зеленых значений
      if (settings.outputGreenOnly === true) {
        // Включаем только строки, содержащие "Есть"
        const lines = (data.message || '').split('\n');
        const greenLines = lines.filter(line => line.includes('Есть'));
        comment = greenLines.join('\n');
      } else {
        // Если настройка "только зеленые" отключена
        comment = data.message || '';
      }
      
      // Если у нас стандартные теги и настройка профессии выключена, 
      // исключаем блок "Профессия" из вывода
      if (data.type === 'standard_tags' && settings.outputProfession === false) {
        const lines = comment.split('\n');
        const filteredLines = lines.filter(line => !line.toLowerCase().includes('профессия'));
        comment = filteredLines.join('\n');
      }
    }
    
    // Если комментарий пуст и функция вывода в комментарий активна, всё равно нужно проверить поле
    // чтобы показать ошибку, если поле не найдено
    if (!comment && !showErrorNotification) return;
  
    chrome.scripting.executeScript({
      target: { tabId },
      function: (comment, showErrorNotification) => {
        try {
          // Набор селекторов для поиска текстовой области внутреннего комментария
          const selectors = [
            'textarea[placeholder="Введите текст внутреннего комментария"]',
            '.g-text-area__control[placeholder="Введите текст внутреннего комментария"]',
            '.autoSizeTextArea-z7z3Yz',
            '.withoutRows-EIzLJv',
            '.g-box.g-flex.aNcfL0DC1j03AdyJkydf textarea',
            '.g-box.g-flex.gravityTextArea-tt9DVg textarea',
            '.g-text-area.g-text-area_view_clear textarea',
            '.g-text-area__content textarea'
          ];
          
          // Пытаемся найти текстовую область по селекторам
          let textarea = null;
          for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              for (const element of elements) {
                if (element.tagName.toLowerCase() === 'textarea' && 
                    element.placeholder && 
                    element.placeholder.includes('комментария')) {
                  textarea = element;
                  break;
                }
              }
              if (textarea) break;
            }
          }
          
          if (textarea) {
            // Если текстовая область найдена и есть комментарий для добавления
            if (comment) {
              const currentText = textarea.value;
              const newText = currentText ? 
                `${currentText}\n${comment}` :
                comment;
              
              // Устанавливаем новый текст
              textarea.value = newText;
              
              // Вызываем события для регистрации изменений в текстовой области
              const event = new Event('input', { bubbles: true });
              textarea.dispatchEvent(event);
              
              return { success: true, message: 'Текст уведомления добавлен во внутренний комментарий' };
            } else {
              // Поле найдено, но комментарий пуст - просто не показываем ошибку
              return { success: true, message: 'Поле найдено, но комментарий пуст' };
            }
          } else {
            // Если текстовая область не найдена, показываем уведомление об ошибке только если это разрешено
            if (showErrorNotification) {
              // Добавляем в систему логирования действий
              chrome.runtime.sendMessage({
                action: 'addActionLog',
                message: 'СОЗДАНИЕ УВЕДОМЛЕНИЯ ОБ ОШИБКЕ ПОЛЯ ВВОДА',
                data: {
                  showErrorNotification: showErrorNotification,
                  url: window.location.href,
                  stack: new Error().stack.split('\n').slice(0, 5).join('\n')
                },
                source: 'writeNotificationToComment'
              }).catch(() => {});
              
              chrome.runtime.sendMessage({
                action: 'createNotification',
                data: {
                  type: 'basic',
                  title: 'Ошибка',
                  message: 'Поле для ввода не найдено!',
                  iconUrl: chrome.runtime.getURL('img/128.png')
                }
              });
            }
            
            return { success: false, message: 'Не удалось найти поле для ввода комментария' };
          }
        } catch (error) {
          return { success: false, message: `Ошибка: ${error.message}` };
        }
      },
      args: [comment, showErrorNotification]
    }, (results) => {
      // Обрабатываем результаты выполнения скрипта
      if (chrome.runtime.lastError) {
        Utils.error('Ошибка при выполнении скрипта:', chrome.runtime.lastError);
      } else if (results && results[0] && results[0].result) {
        Utils.log('Результат записи в комментарий:', results[0].result);
      }
    });
  });
}

export {
    createNotification,
    updateNotification,
    setupNotification,
    getNotificationButtons,
    handleButtonClicked,
    updateNotificationContext,
    executeScript,
    clearNotification,
    queueNotification,
    showQueuedNotifications,
    handleFocusChange,
    getNotificationIcon,
    notificationsData,
    notificationQueue,
    isLoadingComplete,
    isNotificationBlocked
}; 