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

"use strict";

// Локальный объект Utils для background script
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
          url: 'background',
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



import {
    createNotification,
    updateNotification,
    setupNotification,
    getNotificationButtons,
    handleButtonClicked,
    updateNotificationContext,
    clearNotification,
    getNotificationIcon,
    queueNotification,
    showQueuedNotifications,
    isNotificationBlocked,
    executeScript
} from './notifications.js';

import { performButtonSearch } from './buttonSearch.js';

Utils.log('Инициализация обработчиков уведомлений...');
Utils.log('Обработчики сообщений startPhotoControl и startTariffsBlocks удалены');

// Глобальные переменные для уведомлений уже объявлены ниже в файле

// Проверяем состояние логирования действий при загрузке
chrome.storage.local.get(['actionLoggingEnabled'], (result) => {
    if (result.actionLoggingEnabled) {
        logAction('Background script инициализирован');
    }
});

// Функция для логирования действий
function logAction(message, data = null, source = 'background') {
    chrome.storage.local.get(['actionLoggingEnabled', 'actionLogs'], (result) => {
        if (result.actionLoggingEnabled) {
            const actionLogs = result.actionLogs || [];
            const timestamp = new Date().toISOString();
            const logEntry = {
                timestamp: timestamp,
                message: message,
                data: data,
                url: 'background',
                source: source
            };
            
            actionLogs.push(logEntry);
            
            // Ограничиваем количество логов (последние 10000 записей)
            if (actionLogs.length > 10000) {
                actionLogs.splice(0, actionLogs.length - 10000);
            }
            
            chrome.storage.local.set({ actionLogs: actionLogs });
            Utils.log(`[Логирование действий] ${timestamp}: ${message}`, data);
        }
    });
}

// Глобальная переменная для отслеживания времени начала тестирования
let testingStartTime = null;

// Глобальная переменная для отслеживания времени начала поиска последних заказов
let lastOrdersStartTime = null;

// Глобальные переменные для уведомлений
let notificationsMap = {};
let currentNotificationId = null;

// Глобальные переменные для защиты от повторного запуска поиска
let searchInProgress = false;
let lastSearchUrl = null;
let searchCooldown = null;

// Функция для сброса состояния поиска
function resetSearchState() {
    searchInProgress = false;
    lastSearchUrl = null;
    searchCooldown = null;
    Utils.log('Background: состояние поиска сброшено');
}

// Функция для логирования тестирования (и в консоль, и в файл)
function logTesting(message, data = null, source = 'testing') {
    // Логируем в консоль (если включено)
    chrome.storage.local.get(['loggingEnabled'], (result) => {
        if (result.loggingEnabled) {
            Utils.log(`[ТЕСТИРОВАНИЕ] ${message}`, data);
        }
    });
    
    // Логируем в файл (если включено) с добавлением времени выполнения
    let logData = data || {};
    if (testingStartTime) {
        const elapsedTime = Date.now() - testingStartTime;
        logData = {
            ...logData,
            elapsedTime: `${elapsedTime}ms`,
            elapsedSeconds: `${(elapsedTime / 1000).toFixed(2)}s`
        };
    }
    
    logAction(`[ТЕСТИРОВАНИЕ] ${message}`, logData, source);
}

// Функция для логирования поиска последних заказов (и в консоль, и в файл)
function logLastOrders(message, data = null, source = 'last_orders') {
    // Логируем в консоль (если включено)
    chrome.storage.local.get(['loggingEnabled'], (result) => {
        if (result.loggingEnabled) {
            Utils.log(`[ПОСЛЕДНИЕ ЗАКАЗЫ] ${message}`, data);
        }
    });
    
    // Логируем в файл (если включено) с добавлением времени выполнения
    let logData = data || {};
    if (lastOrdersStartTime) {
        const elapsedTime = Date.now() - lastOrdersStartTime;
        logData = {
            ...logData,
            elapsedTime: `${elapsedTime}ms`,
            elapsedSeconds: `${(elapsedTime / 1000).toFixed(2)}s`
        };
    }
    
    logAction(`[ПОСЛЕДНИЕ ЗАКАЗЫ] ${message}`, logData, source);
}

// Функция для обработки результатов экзаменов
function handleShowExamResults(results) {
    Utils.log('NOTIFICATION: Получен запрос на показ результатов экзаменов');
    Utils.log('NOTIFICATION: Данные запроса:', results);
    Utils.log('NOTIFICATION: Тип данных:', typeof results, 'isArray:', Array.isArray(results));
    logTesting('Получен запрос на показ результатов экзаменов', results);
    
    if (!results || !Array.isArray(results)) {
        Utils.error('NOTIFICATION: Результаты экзаменов пустые или некорректные!', results);
        logTesting('NOTIFICATION: Результаты экзаменов пустые или некорректные!', results);
        // Показываем уведомление об ошибке вместо возврата
        const errorData = {
            type: 'testing',
            title: 'Ошибка получения данных',
            message: 'Результаты экзаменов пустые или некорректные'
        };
        createSimpleNotification(errorData, 60000);
        return;
    }
    
    if (results.length === 0) {
        Utils.log('NOTIFICATION: Результаты экзаменов пустые');
        logTesting('Результаты экзаменов пустые');
        const emptyData = {
            type: 'testing',
            title: 'Результаты экзаменов',
            message: 'Данные не найдены'
        };
        createSimpleNotification(emptyData, 60000);
        return;
    }
    
    Utils.log('NOTIFICATION: Получены результаты экзаменов, количество:', results.length);
    logTesting('Получены результаты экзаменов', { count: results.length });
    
    // Сортируем результаты согласно новым требованиям
    const tariffsPriorityItems = ['delivery', 'courier', 'cargo', 'cargo_expeditor'];
    const optionsPriorityItems = ['weight_surcharge'];
    
    const tariffsPriorityResults = [];
    const optionsPriorityResults = [];
    const otherTariffsResults = [];
    const otherOptionsResults = [];
    
    results.forEach(result => {
        const nameLower = result.name.toLowerCase();
        const section = result.section || 'Неизвестно';
        
        // Проверяем, является ли это приоритетным тестом из раздела "Тарифы"
        const isTariffsPriority = tariffsPriorityItems.some(priority => 
            nameLower.includes(priority.toLowerCase())
        );
        
        // Проверяем, является ли это приоритетным тестом из раздела "Опции"
        const isOptionsPriority = optionsPriorityItems.some(priority => 
            nameLower.includes(priority.toLowerCase())
        );
        
        if (section === 'Тарифы' && isTariffsPriority) {
            tariffsPriorityResults.push(result);
            Utils.log(`NOTIFICATION: Приоритетный результат из Тарифы - ${result.name}: ${result.score}`);
            logTesting(`Приоритетный результат из Тарифы`, { name: result.name, score: result.score });
        } else if (section === 'Опции' && isOptionsPriority) {
            optionsPriorityResults.push(result);
            Utils.log(`NOTIFICATION: Приоритетный результат из Опции - ${result.name}: ${result.score}`);
            logTesting(`Приоритетный результат из Опции`, { name: result.name, score: result.score });
        } else if (section === 'Тарифы') {
            otherTariffsResults.push(result);
            Utils.log(`NOTIFICATION: Обычный результат из Тарифы - ${result.name}: ${result.score}`);
            logTesting(`Обычный результат из Тарифы`, { name: result.name, score: result.score });
        } else if (section === 'Опции') {
            otherOptionsResults.push(result);
            Utils.log(`NOTIFICATION: Обычный результат из Опции - ${result.name}: ${result.score}`);
            logTesting(`Обычный результат из Опции`, { name: result.name, score: result.score });
        } else {
            // Если раздел не определен, добавляем в общие результаты
            otherTariffsResults.push(result);
            Utils.log(`NOTIFICATION: Результат с неопределенным разделом - ${result.name}: ${result.score}`);
            logTesting(`Результат с неопределенным разделом`, { name: result.name, score: result.score, section });
        }
    });
    
    // Объединяем результаты: сначала приоритетные из Тарифы, затем приоритетные из Опции, затем остальные из Тарифы, затем остальные из Опции
    const sortedResults = [...tariffsPriorityResults, ...optionsPriorityResults, ...otherTariffsResults, ...otherOptionsResults];
    Utils.log('NOTIFICATION: Отсортированные результаты:', sortedResults);
    logTesting('Отсортированные результаты', { 
        total: sortedResults.length, 
        tariffsPriority: tariffsPriorityResults.length,
        optionsPriority: optionsPriorityResults.length,
        otherTariffs: otherTariffsResults.length,
        otherOptions: otherOptionsResults.length
    });
    
    // Формируем строки для уведомления
    const resultStrings = sortedResults.map(result => 
        `${result.name}: ${result.score}`
    );
    
    const notificationData = {
        type: 'testing',
        title: 'Результаты экзаменов',
        message: resultStrings.join('\n')
    };
    
    Utils.log('NOTIFICATION: Данные для уведомления:', notificationData);
    logTesting('Данные для уведомления готовы', { title: notificationData.title, messageLength: notificationData.message.length });
    
    chrome.storage.local.get(['notifications'], ({ notifications }) => {
        if (notifications === false) {
            Utils.error('NOTIFICATION: Уведомления отключены в настройках');
            logTesting('Уведомления отключены в настройках');
            return;
        }
        
        Utils.log('NOTIFICATION: Уведомления включены, создаем уведомление');
        logTesting('Уведомления включены, создаем уведомление');
        
        try {
            // Очищаем только уведомления, которые НЕ являются уведомлениями тестирования
            clearNotificationExceptTesting();
            Utils.log('NOTIFICATION: Предыдущие уведомления (кроме тестирования) очищены');
            logTesting('Предыдущие уведомления (кроме тестирования) очищены');
            
            createSimpleNotification(notificationData, 60000);
            Utils.log('NOTIFICATION: Уведомление создано!');
            logTesting('Уведомление создано!');
            
            // Сбрасываем время начала тестирования
            testingStartTime = null;
        } catch (error) {
            Utils.error('NOTIFICATION: Ошибка при создании уведомления:', error);
            logTesting('Ошибка при создании уведомления', { error: error.message });
            
            // Сбрасываем время начала тестирования
            testingStartTime = null;
        }
    });
}

// Функция для обработки результатов последних заказов
function handleShowLastOrdersResults(results) {
    Utils.log('NOTIFICATION: Получен запрос на показ результатов последних заказов');
    Utils.log('NOTIFICATION: Данные запроса:', results);
    Utils.log('NOTIFICATION: Тип данных:', typeof results, 'isArray:', Array.isArray(results));
    logLastOrders('Получен запрос на показ результатов последних заказов', results);
    
    if (!results || !Array.isArray(results)) {
        Utils.error('NOTIFICATION: Результаты последних заказов пустые или некорректные!', results);
        logLastOrders('NOTIFICATION: Результаты последних заказов пустые или некорректные!', results);
        // Показываем уведомление об ошибке вместо возврата
        const errorData = {
            type: 'last_orders',
            title: 'Ошибка получения данных',
            message: 'Результаты последних заказов пустые или некорректные'
        };
        createSimpleNotification(errorData, 60000);
        return;
    }
    
    if (results.length === 0) {
        Utils.log('NOTIFICATION: Результаты последних заказов пустые');
        logLastOrders('Результаты последних заказов пустые');
        const emptyData = {
            type: 'last_orders',
            title: 'Последние заказы',
            message: 'Данные не найдены'
        };
        createSimpleNotification(emptyData, 60000);
        return;
    }
    
    Utils.log('NOTIFICATION: Получены результаты последних заказов, количество:', results.length);
    logLastOrders('Получены результаты последних заказов', { count: results.length });
    
    // Формируем строки для уведомления
    const resultStrings = results.map(result => {
        let orderInfo = `ID: ${result.orderId}`;
        if (result.tariff) orderInfo += ` | Тариф: ${result.tariff}`;
        if (result.date) orderInfo += ` | Дата: ${result.date}`;
        if (result.time) orderInfo += ` | Время: ${result.time}`;
        if (result.status) orderInfo += ` | Статус: ${result.status}`;
        return orderInfo;
    });
    
    const notificationData = {
        type: 'last_orders',
        title: 'Последние заказы',
        message: resultStrings.join('\n')
    };
    
    Utils.log('NOTIFICATION: Данные для уведомления:', notificationData);
    logLastOrders('Данные для уведомления готовы', { title: notificationData.title, messageLength: notificationData.message.length });
    
    chrome.storage.local.get(['notifications'], ({ notifications }) => {
        if (notifications === false) {
            Utils.error('NOTIFICATION: Уведомления отключены в настройках');
            logLastOrders('Уведомления отключены в настройках');
            return;
        }
        
        Utils.log('NOTIFICATION: Уведомления включены, создаем уведомление');
        logLastOrders('Уведомления включены, создаем уведомление');
        
        try {
            // Очищаем только уведомления, которые НЕ являются уведомлениями последних заказов
            clearNotificationExceptLastOrders();
            Utils.log('NOTIFICATION: Предыдущие уведомления (кроме последних заказов) очищены');
            logLastOrders('Предыдущие уведомления (кроме последних заказов) очищены');
            
            createSimpleNotification(notificationData, 60000);
            Utils.log('NOTIFICATION: Уведомление создано!');
            logLastOrders('Уведомление создано!');
            
            // Сбрасываем время начала поиска последних заказов
            lastOrdersStartTime = null;
            
            // Автопоиск последних заказов завершается без установки флага (как автопоиск пресетов)
        } catch (error) {
            Utils.error('NOTIFICATION: Ошибка при создании уведомления:', error);
            logLastOrders('Ошибка при создании уведомления', { error: error.message });
            
            // Сбрасываем время начала поиска последних заказов
            lastOrdersStartTime = null;
        }
    });
}

// Функция для обработки ошибок последних заказов
function handleShowLastOrdersError(error) {
    Utils.log('NOTIFICATION: Получена ошибка последних заказов:', error);
    logLastOrders('Получена ошибка последних заказов', { error: error });
    
    const errorData = {
        type: 'last_orders',
        title: 'Ошибка поиска последних заказов',
        message: error || 'Неизвестная ошибка'
    };
    
    chrome.storage.local.get(['notifications'], ({ notifications }) => {
        if (notifications === false) {
            Utils.error('NOTIFICATION: Уведомления отключены в настройках');
            logLastOrders('Уведомления отключены в настройках');
            return;
        }
        
        try {
            createSimpleNotification(errorData, 60000);
            Utils.log('NOTIFICATION: Уведомление об ошибке создано!');
            logLastOrders('Уведомление об ошибке создано!');
            
            // Сбрасываем время начала поиска последних заказов
            lastOrdersStartTime = null;
            
            // Автопоиск последних заказов завершается без установки флага (как автопоиск пресетов)
        } catch (error) {
            Utils.error('NOTIFICATION: Ошибка при создании уведомления об ошибке:', error);
            logLastOrders('Ошибка при создании уведомления об ошибке', { error: error.message });
            
            // Сбрасываем время начала поиска последних заказов
            lastOrdersStartTime = null;
        }
    });
}

// Новая функция для очистки уведомлений, кроме уведомлений последних заказов
function clearNotificationExceptLastOrders() {
    try {
        chrome.storage.local.get(['loggingEnabled'], (result) => {
            if (result.loggingEnabled) {
                Utils.log('Очищаем уведомления, кроме последних заказов');
            }
            
            chrome.notifications.getAll((allNotifications) => {
                Object.keys(allNotifications).forEach((notificationId) => {
                    const notificationData = notificationsData[notificationId];
                    if (notificationData && notificationData.data && notificationData.data.type === 'last_orders') {
                        if (result.loggingEnabled) {
                            Utils.log(`Пропускаем уведомление ${notificationId} типа last_orders`);
                        }
                        return;
                    }
                    
                    chrome.notifications.clear(notificationId, (wasCleared) => {
                        if (!wasCleared) {
                            if (result.loggingEnabled) {
                                Utils.log(`Ошибка при удалении уведомления ${notificationId}`);
                            }
                        } else {
                            if (result.loggingEnabled) {
                                Utils.log(`Уведомление ${notificationId} удалено`);
                            }
                        }
                    });
                });
                
                Object.keys(notificationsData).forEach((notificationId) => {
                    if (notificationsData[notificationId] !== undefined && notificationsData[notificationId] !== null) {
                        if (notificationsData[notificationId].data && notificationsData[notificationId].data.type === 'last_orders') {
                            if (result.loggingEnabled) {
                                Utils.log(`Пропускаем уведомление ${notificationId} типа last_orders`);
                            }
                            return;
                        }
                        
                        if (notificationsData[notificationId].timeoutId) {
                            clearTimeout(notificationsData[notificationId].timeoutId);
                        }
                        
                        delete notificationsData[notificationId];
                    }
                });
                
                if (result.loggingEnabled) {
                    Utils.log('Уведомления (кроме последних заказов) очищены');
                }
            });
        });
    } catch (error) {
        Utils.error('Ошибка при очистке уведомлений:', error);
    }
}

// Новая функция для очистки уведомлений, кроме уведомлений тестирования и последних заказов
function clearNotificationExceptTesting() {
    try {
        chrome.storage.local.get(['loggingEnabled'], (result) => {
            if (result.loggingEnabled) {
                Utils.log('Очищаем уведомления, кроме тестирования и последних заказов');
            }
            
            chrome.notifications.getAll((allNotifications) => {
                Object.keys(allNotifications).forEach((notificationId) => {
                    const notificationData = notificationsData[notificationId];
                    if (notificationData && notificationData.data && 
                        (notificationData.data.type === 'testing' || notificationData.data.type === 'last_orders')) {
                        if (result.loggingEnabled) {
                            Utils.log(`Пропускаем уведомление ${notificationId} типа ${notificationData.data.type}`);
                        }
                        return;
                    }
                    
                    chrome.notifications.clear(notificationId, (wasCleared) => {
                        if (!wasCleared) {
                            if (result.loggingEnabled) {
                                Utils.log(`Ошибка при удалении уведомления ${notificationId}`);
                            }
                        } else {
                            if (result.loggingEnabled) {
                                Utils.log(`Уведомление ${notificationId} удалено`);
                            }
                        }
                    });
                });
                
                Object.keys(notificationsData).forEach((notificationId) => {
                    if (notificationsData[notificationId] !== undefined && notificationsData[notificationId] !== null) {
                        if (notificationsData[notificationId].data && 
                            (notificationsData[notificationId].data.type === 'testing' || 
                             notificationsData[notificationId].data.type === 'last_orders')) {
                            if (result.loggingEnabled) {
                                Utils.log(`Пропускаем уведомление ${notificationId} типа ${notificationsData[notificationId].data.type}`);
                            }
                            return;
                        }
                        
                        if (notificationsData[notificationId].timeoutId) {
                            clearTimeout(notificationsData[notificationId].timeoutId);
                        }
                        
                        delete notificationsData[notificationId];
                    }
                });
                
                if (result.loggingEnabled) {
                    Utils.log('Уведомления (кроме тестирования и последних заказов) очищены');
                }
            });
        });
    } catch (error) {
        chrome.storage.local.get(['loggingEnabled'], (result) => {
            if (result.loggingEnabled) {
                Utils.error('Ошибка при очистке уведомлений:', error);
            }
        });
    }
}

if (chrome.notifications) {
    Utils.log('Chrome API для уведомлений доступен');
    
    chrome.notifications.getPermissionLevel((level) => {
        Utils.log('Уровень разрешений для уведомлений:', level);
        if (level !== 'granted') {
            Utils.error('Уведомления не разрешены в Chrome. Уровень разрешений:', level);
        }
    });
} else {
    Utils.error('Chrome API для уведомлений недоступен');
}

chrome.permissions.contains({ permissions: ['notifications'] }, (result) => {
    if (result) {
        Utils.log('Разрешение на отправку уведомлений получено');
    } else {
        Utils.error('Разрешение на отправку уведомлений не получено');
    }
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    Utils.log(`🌐 GLOBAL: Нажата кнопка ${buttonIndex} в глобальном уведомлении ${notificationId}`);
    
    if (notificationsMap[notificationId] && notificationsMap[notificationId].data) {
        const notificationData = notificationsMap[notificationId].data;
        const buttons = getNotificationButtons(notificationData);
        
        if (buttonIndex >= 0 && buttonIndex < buttons.length) {
            const button = buttons[buttonIndex];
            let dataToCopy = null;
            
            Utils.log(`🌐 GLOBAL: Обработка нажатия кнопки в background: ${button.title} (индекс: ${buttonIndex})`);
            
            if (button.title === 'Номер ВУ') {
                dataToCopy = notificationData.driverLicense;
                Utils.log(`🌐 GLOBAL: Копирование номера ВУ из глобального уведомления: ${dataToCopy}`);
            } else if (button.title === 'Страна') {
                dataToCopy = notificationData.country;
                Utils.log(`🌐 GLOBAL: Копирование страны из глобального уведомления: ${dataToCopy}`);
            } else {
                Utils.warn(`🌐 GLOBAL: Неизвестная кнопка в background: ${button.title}`);
            }
            
            if (dataToCopy) {
                Utils.log(`🌐 GLOBAL: Вызываем executeScript из background для копирования: "${dataToCopy}"`);
                executeScript(null, dataToCopy, (success) => {
                    if (success) {
                        Utils.log(`🌐 GLOBAL: Данные "${dataToCopy}" успешно скопированы из глобального уведомления`);
                    } else {
                        Utils.error(`🌐 GLOBAL: Не удалось скопировать данные "${dataToCopy}" из глобального уведомления`);
                    }
                });
            } else {
                Utils.error('🌐 GLOBAL: Данные для копирования не найдены в background');
            }
        } else {
            Utils.error(`🌐 GLOBAL: Некорректный индекс кнопки в background: ${buttonIndex}, доступно кнопок: ${buttons.length}`);
        }
    }
    
    handleButtonClicked(notificationId, buttonIndex);
});

chrome.notifications.onClosed.addListener((notificationId, byUser) => {
    Utils.log(`🌐 GLOBAL: Глобальное уведомление ${notificationId} закрыто ${byUser ? 'пользователем' : 'системой'}`);
    if (notificationsMap[notificationId]) {
        delete notificationsMap[notificationId];
    }
    
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
});

function closeTabWithDelay(delay) {
    setTimeout(() => {
        chrome.tabs.query({ active: false, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.remove(tabs[tabs.length - 1].id);
            }
        });
    }, delay);
}

let NotificationTimeout = 54000;
let lastNotificationTime = 0;
let previousTabUrl = '';


let notificationQueue = [];
let isLoadingComplete = false;

const FlagIconPath = 'img/flags/';
const DefaultIconPath = 'img/128.png';

function setLoadingState(isComplete) {
    isLoadingComplete = isComplete;
    if (isComplete) {
        showQueuedNotifications();
    }
}

function notifySettingsChanged(settings) {
  if (settings.activeCustomTagsPreset && settings.customTagsPresets) {
    const activePreset = settings.customTagsPresets[settings.activeCustomTagsPreset];
    if (activePreset) {
      chrome.storage.local.set({
        customTag1: activePreset.customTag1 || '',
        customTag2: activePreset.customTag2 || '',
        customTag3: activePreset.customTag3 || '',
        customTag4: activePreset.customTag4 || ''
      });
      
      settings.customTag1 = activePreset.customTag1 || '';
      settings.customTag2 = activePreset.customTag2 || '';
      settings.customTag3 = activePreset.customTag3 || '';
      settings.customTag4 = activePreset.customTag4 || '';
    }
  }
  
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'settingsChanged', 
        settings: settings 
      }).catch(error => {
        // Игнорируем ошибки, которые могут возникнуть, если вкладка не может принимать сообщения
      });
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    Utils.log('Получено сообщение в background.js:', request);
    
    // Логируем все действия, кроме самого логирования
    if (request.action !== 'addActionLog') {
        logAction(`Выполнено действие: ${request.action}`, { request: request, sender: sender });
    }
    
    try {
        if (request.action === 'createNotification') {
            // ЛОГИРОВАНИЕ: Получен запрос на создание уведомления
            logAction('BACKGROUND.JS: Получен запрос на создание уведомления', {
                data: request.data,
                sender: sender.url || 'неизвестно',
                stack: new Error().stack.split('\n').slice(0, 5).join('\n')
            });
            
            createSimpleNotification(request.data, request.timeout).then(notificationId => {
                // ЛОГИРОВАНИЕ: Создано уведомление
                logAction('BACKGROUND.JS: Создано уведомление с ID: ' + notificationId);
                sendResponse({ notificationId: notificationId });
            });
            return true;
        } else if (request.action === 'updateNotification') {
            if (request.data && request.notificationId) {
                updateNotification(request.notificationId, request.data, request.timeout);
                sendResponse({ success: true });
            }
            return true;
        } else if (request.action === 'updateBlocking') {
            chrome.declarativeNetRequest.updateEnabledRulesets({
                disableRulesetIds: request.enabled ? [] : ['block_wizard'],
                enableRulesetIds: request.enabled ? ['block_wizard'] : []
            });
            sendResponse({ success: true });
        } else if (request.action === 'startSearch') {
            // Проверяем, не выполняется ли уже поиск
            if (searchInProgress) {
                Utils.log('Background: поиск уже выполняется, пропускаем');
                logAction('Background: поиск уже выполняется, пропускаем', { url: request.url });
                sendResponse({ success: false, error: 'Поиск уже выполняется' });
                return true;
            }

            // Проверяем кулдаун (защита от спама)
            if (searchCooldown && Date.now() < searchCooldown) {
                Utils.log('Background: кулдаун активен, пропускаем');
                logAction('Background: кулдаун активен, пропускаем', { url: request.url });
                sendResponse({ success: false, error: 'Кулдаун активен' });
                return true;
            }

            // Проверяем, не обрабатывали ли мы уже этот URL
            if (lastSearchUrl === request.url) {
                Utils.log('Background: этот URL уже обрабатывался, пропускаем');
                logAction('Background: этот URL уже обрабатывался, пропускаем', { url: request.url });
                sendResponse({ success: false, error: 'URL уже обрабатывался' });
                return true;
            }

            // Логируем запуск поиска
            if (request.trigger === 'autosearch_presets') {
                logAction('Background: запуск автопоиска пресетов', { url: request.url });
            } else {
                logAction('Background: запуск ручного поиска', { url: request.url });
            }
            
            // Устанавливаем флаги защиты
            searchInProgress = true;
            lastSearchUrl = request.url;
            searchCooldown = Date.now() + 3000; // 3 секунды кулдауна
            
            performButtonSearch(request.url);
            
            // Сбрасываем флаг выполнения через 5 секунд
            setTimeout(() => {
                searchInProgress = false;
            }, 5000);
            
            sendResponse({ success: true });

        } else if (request.action === 'startCalculationCorrect') {
            // Функционал перенесен в FinancialModule
            Utils.log('Запрос на startCalculationCorrect перенаправлен в FinancialModule');
            sendResponse({ success: true, message: 'Функционал перенесен в FinancialModule' });
        } else if (request.action === 'startDeliveryFee') {
            // Функционал перенесен в FinancialModule
            Utils.log('Запрос на startDeliveryFee перенаправлен в FinancialModule');
            sendResponse({ success: true });
        } else if (request.action === 'startTesting') {
            // Новый функционал тестирования - открытие страницы exams-results и парсинг
            testingStartTime = Date.now(); // Устанавливаем время начала тестирования
            
            // Логируем запуск тестирования
            if (request.trigger === 'autosearch_testing') {
                Utils.log('TESTING: Получен запрос на запуск автопоиска тестирования');
                logTesting('Получен запрос на запуск автопоиска тестирования');
            } else {
                Utils.log('TESTING: Получен запрос на запуск тестирования');
                logTesting('Получен запрос на запуск тестирования');
            }
            
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                    const url = tabs[0].url;
                    
                    // Логируем действие с правильным URL
                    if (request.trigger === 'autosearch_testing') {
                        logAction('Background: запуск автопоиска тестирования', { url: url });
                    } else {
                        logAction('Background: запуск ручного тестирования', { url: url });
                    }
                    
                    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://') || url.startsWith('about:')) {
                        Utils.error('Невозможно выполнить скрипт на системной странице браузера');
                        logTesting('Невозможно выполнить скрипт на системной странице браузера');
                        
                        // Автопоиск тестирования завершается без установки флага (как автопоиск пресетов)
                        
                        testingStartTime = null; // Сбрасываем время
                        sendResponse({ success: false, error: 'Невозможно выполнить скрипт на системной странице браузера' });
                        return;
                    }
                    
                    // Находим ссылку на водителя
                    Utils.log('TESTING: Ищем ссылку на водителя...');
                    Utils.log('🔧 URL обновлен: pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/');
                    logTesting('Ищем ссылку на водителя...');
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        function: () => {
                            Utils.log('ВОДИТЕЛЬ: Начинаем поиск ссылки на водителя');
                            const buttons = document.querySelectorAll('a');
                            Utils.log(`ВОДИТЕЛЬ: Найдено ссылок: ${buttons.length}`);
                            
                            let driverLink = null;
                            
                            buttons.forEach((button, idx) => {
                                if (button && 
                                    button.textContent.includes('Водитель') &&
                                    button.href.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
                                    driverLink = button.href;
                                    Utils.log(`ВОДИТЕЛЬ: Найдена ссылка на водителя: ${driverLink}`);
                                }
                            });
                            
                            if (!driverLink) {
                                Utils.log('ВОДИТЕЛЬ: Ссылка на водителя не найдена');
                                Utils.log('ВОДИТЕЛЬ: Доступные ссылки с "Водитель":');
                                buttons.forEach((button, idx) => {
                                    if (button.textContent.includes('Водитель')) {
                                        Utils.log(`  ${idx}: ${button.href}`);
                                    }
                                });
                            }
                            
                            return driverLink;
                        }
                    }, (results) => {
                        Utils.log('TESTING: Получены результаты поиска ссылки на водителя:', results);
                        logTesting('Получены результаты поиска ссылки на водителя', results);
                        
                        if (results && results[0] && results[0].result) {
                            const driverUrl = results[0].result;
                            Utils.log('TESTING: Ссылка на водителя найдена:', driverUrl);
                            logTesting('Ссылка на водителя найдена', { driverUrl });
                            
                            // Берем только базовый URL без параметров и добавляем /exams-results
                            const baseUrl = driverUrl.split('?')[0]; // Убираем все параметры
                            const examsUrl = baseUrl + '/exams-results';
                            Utils.log('TESTING: Формируем URL для экзаменов:', examsUrl);
                            logTesting('Формируем URL для экзаменов', { examsUrl });
                            
                            // Открываем страницу с результатами экзаменов
                            Utils.log('TESTING: Открываем вкладку с результатами экзаменов...');
                            logTesting('Открываем вкладку с результатами экзаменов...');
                            chrome.tabs.create({ url: examsUrl, active: false }, (newTab) => {
                                Utils.log('TESTING: Вкладка создана, ID:', newTab.id);
                                logTesting('Вкладка создана', { tabId: newTab.id, url: examsUrl });
                                // Ждем загрузки страницы и выполняем парсинг
                                chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                                    if (tabId === newTab.id && changeInfo.status === 'complete') {
                                        chrome.tabs.onUpdated.removeListener(listener);
                                        
                                        // Выполняем парсинг страницы экзаменов
                                        setTimeout(() => {
                                            chrome.scripting.executeScript({
                                                target: { tabId: newTab.id },
                                                function: () => {
                                                    // Функция парсинга страницы exams-results
                                                    const parseExamResults = () => {
                                                        Utils.log('ПАРСИНГ: Начинаем парсинг страницы exams-results');
                                                        Utils.log('ПАРСИНГ: URL страницы:', window.location.href);
                                                        Utils.log('ПАРСИНГ: Document ready state:', document.readyState);
                                                        
                                                        // Ждем полной загрузки страницы
                                                        const waitForPageLoad = () => {
                                                            return new Promise((resolve) => {
                                                                if (document.readyState === 'complete') {
                                                                    Utils.log('ПАРСИНГ: Страница полностью загружена');
                                                                    resolve();
                                                                } else {
                                                                    Utils.log('ПАРСИНГ: Ждем полной загрузки страницы...');
                                                                    window.addEventListener('load', () => {
                                                                        Utils.log('ПАРСИНГ: Страница загружена через load event');
                                                                        resolve();
                                                                    });
                                                                                                                            // Fallback на случай, если load event не сработает
                                                        setTimeout(resolve, 1000);
                                                                }
                                                            });
                                                        };
                                                        
                                                        // Ждем появления таблицы с детальной отладкой
                                                        const waitForTable = () => {
                                                            return new Promise((resolve, reject) => {
                                                                Utils.log('ПАРСИНГ: Ищем таблицу...');
                                                                const startTime = Date.now();
                                                                const timeout = 5000; // Таймаут 5 секунд
                                                                let attempts = 0;
                                                                const maxAttempts = 15; // 15 попыток
                                                                
                                                                const checkTable = () => {
                                                                    attempts++;
                                                                    
                                                                    // Проверяем iframe
                                                                    const iframes = document.querySelectorAll('iframe');
                                                                    Utils.log(`ПАРСИНГ: Попытка ${attempts}/${maxAttempts}, найдено iframe: ${iframes.length}`);
                                                                    
                                                                    // Проверяем загрузку iframe
                                                                    for (let i = 0; i < iframes.length; i++) {
                                                                        const iframe = iframes[i];
                                                                        Utils.log(`ПАРСИНГ: Iframe ${i}: src=${iframe.src}, readyState=${iframe.contentDocument?.readyState || 'unknown'}`);
                                                                        
                                                                        if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                                                                            // Ищем таблицы в iframe
                                                                            const iframeTables = iframe.contentDocument.querySelectorAll('table');
                                                                            Utils.log(`ПАРСИНГ: В iframe ${i} найдено таблиц: ${iframeTables.length}`);
                                                                        }
                                                                    }
                                                                    
                                                                    // Ищем любые таблицы на странице
                                                                    const tables = document.querySelectorAll('table');
                                                                    const gravityTable = document.querySelector('table.g-table__table');
                                                                    const gravityUITable = document.querySelector('table.GravityUI-Table');
                                                                    
                                                                    Utils.log(`ПАРСИНГ: Найдено таблиц всего: ${tables.length}`);
                                                                    Utils.log('ПАРСИНГ: Gravity table:', gravityTable);
                                                                    Utils.log('ПАРСИНГ: GravityUI table:', gravityUITable);
                                                                    
                                                                    // Проверяем наличие контента
                                                                    const bodyText = document.body.textContent.trim();
                                                                    Utils.log(`ПАРСИНГ: Длина текста body: ${bodyText.length} символов`);
                                                                    
                                                                    // Проверяем captcha
                                                                    const captcha = document.querySelector('title');
                                                                    if (captcha && captcha.textContent.includes('робот')) {
                                                                        Utils.error('ПАРСИНГ: Обнаружена капча!');
                                                                        reject(new Error('Обнаружена капча - требуется ручная проверка'));
                                                                        return;
                                                                    }
                                                                    
                                                                    const table = gravityTable || gravityUITable || tables[0];
                                                                    if (table) {
                                                                        Utils.log('ПАРСИНГ: Таблица найдена!', table);
                                                                        Utils.log('ПАРСИНГ: Содержимое таблицы:', table.innerHTML.substring(0, 200));
                                                                        resolve(table);
                                                                    } else if (Date.now() - startTime > timeout || attempts >= maxAttempts) {
                                                                        Utils.error('ПАРСИНГ: Таблица не найдена за отведенное время');
                                                                        Utils.log('ПАРСИНГ: HTML страницы:', document.documentElement.innerHTML.substring(0, 1000));
                                                                        Utils.log('ПАРСИНГ: Все элементы table:', Array.from(tables).map(t => t.outerHTML.substring(0, 100)));
                                                                        reject(new Error('Таблица не найдена'));
                                                                    } else {
                                                                        setTimeout(checkTable, 30); // Интервал 30мс
                                                                    }
                                                                };
                                                                checkTable();
                                                            });
                                                        };
                                                        
                                                        // Функция для клика на раздел и чтения содержимого
                                                        const clickAndReadSection = async (sectionName) => {
                                                            Utils.log(`ПАРСИНГ: Ищем раздел "${sectionName}"`);
                                                            
                                                            // Ждем немного перед поиском разделов
                                                            await new Promise(resolve => setTimeout(resolve, 100));
                                                            
                                                            // Ищем строки с разделами
                                                            const clickableRows = document.querySelectorAll('tr.GravityUI-TableRow_clickable, tr[class*="clickable"], tr[class*="TableRow"]');
                                                            Utils.log(`🔍 ПАРСИНГ: Найдено кликабельных строк: ${clickableRows.length}`);
                                                            
                                                            // Выводим все найденные разделы для отладки
                                                            Utils.log('🔍 ПАРСИНГ: Все найденные разделы:');
                                                            clickableRows.forEach((row, idx) => {
                                                                const cells = row.querySelectorAll('td');
                                                                const rowText = cells[0] ? cells[0].textContent.trim() : 'пустая ячейка';
                                                                Utils.log(`  ${idx}: "${rowText}"`);
                                                            });
                                                            
                                                            let sectionRow = null;
                                                            
                                                            // Ищем нужный раздел
                                                            for (const row of clickableRows) {
                                                                const cells = row.querySelectorAll('td');
                                                                for (const cell of cells) {
                                                                    const cellText = cell.textContent.trim();
                                                                    Utils.log(`ПАРСИНГ: Проверяем ячейку: "${cellText}"`);
                                                                    if (cellText === sectionName) {
                                                                        sectionRow = row;
                                                                        Utils.log(`ПАРСИНГ: Найден раздел "${sectionName}"!`);
                                                                        break;
                                                                    }
                                                                }
                                                                if (sectionRow) break;
                                                            }
                                                            
                                                            if (!sectionRow) {
                                                                Utils.error(`ПАРСИНГ: Раздел "${sectionName}" не найден`);
                                                                Utils.log('ПАРСИНГ: Доступные разделы:');
                                                                clickableRows.forEach((row, idx) => {
                                                                    Utils.log(`  ${idx}: ${row.textContent.trim()}`);
                                                                });
                                                                return [];
                                                            }
                                                            
                                                            // Кликаем на раздел
                                                            Utils.log(`ПАРСИНГ: Кликаем на раздел "${sectionName}"`);
                                                            sectionRow.click();
                                                            
                                                            // Ждем раскрытия содержимого
                                                            Utils.log(`ПАРСИНГ: Ждем раскрытия содержимого раздела "${sectionName}"...`);
                                                            await new Promise(resolve => setTimeout(resolve, 300)); // Время ожидания
                                                            
                                                            // Читаем содержимое раздела
                                                            Utils.log(`ПАРСИНГ: Читаем содержимое раздела "${sectionName}"`);
                                                            const sectionResults = [];
                                                            
                                                            // Ищем все строки таблицы
                                                            const allRows = document.querySelectorAll('tr');
                                                            Utils.log(`ПАРСИНГ: Всего строк в таблицах: ${allRows.length}`);
                                                            
                                                            // Выводим первые несколько строк для отладки
                                                            Utils.log('ПАРСИНГ: Первые 5 строк таблицы:');
                                                            for (let i = 0; i < Math.min(5, allRows.length); i++) {
                                                                const row = allRows[i];
                                                                const cells = row.querySelectorAll('td');
                                                                const rowText = Array.from(cells).map(cell => cell.textContent.trim()).join(' | ');
                                                                Utils.log(`  ${i}: "${rowText}"`);
                                                            }
                                                            
                                                            let isInSection = false;
                                                            let sectionStarted = false;
                                                            
                                                            for (const row of allRows) {
                                                                const rowText = row.textContent.trim();
                                                                
                                                                // Проверяем, начался ли наш раздел
                                                                if (rowText === sectionName) {
                                                                    isInSection = true;
                                                                    sectionStarted = true;
                                                                    Utils.log(`ПАРСИНГ: Начинаем чтение раздела "${sectionName}"`);
                                                                    continue;
                                                                }
                                                                
                                                                // Проверяем, закончился ли раздел (новый раздел начался)
                                                                if (sectionStarted && isInSection && (rowText === 'Тарифы' || rowText === 'Опции') && rowText !== sectionName) {
                                                                    Utils.log(`ПАРСИНГ: Закончили чтение раздела "${sectionName}", начался "${rowText}"`);
                                                                    break;
                                                                }
                                                                
                                                                // Если мы в нужном разделе и это строка с данными
                                                                if (isInSection && !row.classList.contains('GravityUI-TableRow_clickable') && !row.classList.contains('clickable')) {
                                                                    const cells = row.querySelectorAll('td');
                                                                    Utils.log(`ПАРСИНГ: Проверяем строку в разделе "${sectionName}": ${cells.length} ячеек`);
                                                                    
                                                                    if (cells.length >= 3) {
                                                                        const name = cells[1] ? cells[1].textContent.trim() : '';
                                                                        const score = cells[2] ? cells[2].textContent.trim() : '';
                                                                        
                                                                        Utils.log(`ПАРСИНГ: Ячейки: name="${name}", score="${score}"`);
                                                                        
                                                                        if (name && score && name !== 'Курс' && name !== 'Оценка:' && !name.includes('Статус')) {
                                                                            Utils.log(`ПАРСИНГ: Найден результат - ${name}: ${score} (раздел: ${sectionName})`);
                                                                            sectionResults.push({ name, score, section: sectionName });
                                                                        } else {
                                                                            Utils.log(`ПАРСИНГ: Строка пропущена: name="${name}", score="${score}"`);
                                                                        }
                                                                    } else {
                                                                        Utils.log(`ПАРСИНГ: Строка пропущена (недостаточно ячеек): ${cells.length} ячеек`);
                                                                    }
                                                                }
                                                            }
                                                            
                                                            Utils.log(`ПАРСИНГ: Завершили чтение раздела "${sectionName}", найдено: ${sectionResults.length} результатов`);
                                                            return sectionResults;
                                                        };
                                                        
                                                        return waitForPageLoad().then(() => {
                                                            Utils.log('ПАРСИНГ: Страница загружена, ищем таблицу...');
                                                            return waitForTable();
                                                        }).then(async () => {
                                                            Utils.log('ПАРСИНГ: Таблица найдена, начинаем парсинг разделов...');
                                                            
                                                            // Ищем и кликаем разделы "Тарифы" и "Опции"
                                                            const tariffsResults = await clickAndReadSection('Тарифы');
                                                            const optionsResults = await clickAndReadSection('Опции');
                                                            
                                                            const allResults = [...tariffsResults, ...optionsResults];
                                                            Utils.log('ПАРСИНГ: Завершен! Всего результатов:', allResults.length);
                                                            Utils.log('ПАРСИНГ: Результаты:', allResults);
                                                            
                                                            return allResults;
                                                        }).catch(error => {
                                                            Utils.error('ПАРСИНГ: Ошибка:', error);
                                                            throw error;
                                                        });
                                                    };
                                                    
                                                    return parseExamResults();
                                                }
                                            }, (results) => {
                                                Utils.log('BACKGROUND: Получены результаты скрипта парсинга:', results);
                                                logTesting('Получены результаты скрипта парсинга', results);
                                                
                                                if (chrome.runtime.lastError) {
                                                    Utils.error('BACKGROUND: Ошибка при парсинге:', chrome.runtime.lastError.message);
                                                    logTesting('Ошибка при парсинге', { error: chrome.runtime.lastError.message });
                                                    // Показываем уведомление об ошибке
                                                    handleShowExamResults([{ name: 'Ошибка', score: chrome.runtime.lastError.message }]);
                                                    
                                                    // Автопоиск тестирования завершается без установки флага (как автопоиск пресетов)
                                                    
                                                    // Добавляем задержку перед закрытием вкладки
                                                    setTimeout(() => {
                                                        Utils.log('BACKGROUND: Закрываем вкладку после ошибки парсинга');
                                                        logTesting('Закрываем вкладку после ошибки парсинга');
                                                        chrome.tabs.remove(newTab.id);
                                                    }, 500); // Задержка 0.5 секунд
                                                    return;
                                                }
                                                
                                                if (results && results[0] && results[0].result) {
                                                    Utils.log('BACKGROUND: Результат получен, обрабатываем...');
                                                    logTesting('Результат получен, обрабатываем...');
                                                    
                                                    // Если результат - это Promise
                                                    if (results[0].result && typeof results[0].result.then === 'function') {
                                                        results[0].result.then(examResults => {
                                                            Utils.log('BACKGROUND: Promise resolved, результаты:', examResults);
                                                            logTesting('Promise resolved, результаты', examResults);
                                                            
                                                            if (examResults && examResults.length > 0) {
                                                                // Отправляем результаты для показа уведомления
                                                                logTesting('Отправляем результаты для уведомления', { count: examResults.length });
                                                                handleShowExamResults(examResults);
                                                                
                                                                // Автопоиск тестирования завершается без установки флага (как автопоиск пресетов)
                                                            } else {
                                                                Utils.log('BACKGROUND: Результаты пустые, отправляем сообщение об этом');
                                                                logTesting('Результаты пустые, отправляем сообщение об этом');
                                                                handleShowExamResults([{ name: 'Данные не найдены', score: '' }]);
                                                                
                                                                // Автопоиск тестирования завершается без установки флага (как автопоиск пресетов)
                                                            }
                                                            
                                                            // Добавляем задержку перед закрытием вкладки, чтобы уведомление успело отобразиться
                                                            setTimeout(() => {
                                                                Utils.log('BACKGROUND: Закрываем вкладку с результатами экзаменов');
                                                                logTesting('Закрываем вкладку с результатами экзаменов');
                                                                chrome.tabs.remove(newTab.id);
                                                            }, 1000); // Задержка 1 секунда
                                                        }).catch(error => {
                                                            Utils.error('BACKGROUND: Ошибка при обработке результатов:', error);
                                                            logTesting('Ошибка при обработке результатов', { error: error.message });
                                                            // Показываем уведомление об ошибке
                                                            handleShowExamResults([{ name: 'Ошибка парсинга', score: error.message }]);
                                                            
                                                            // Автопоиск тестирования завершается без установки флага (как автопоиск пресетов)
                                                            
                                                            // Закрываем вкладку мгновенно
                                                            Utils.log('BACKGROUND: Закрываем вкладку после ошибки');
                                                            logTesting('Закрываем вкладку после ошибки');
                                                            chrome.tabs.remove(newTab.id);
                                                        });
                                                    } else {
                                                        // Если результат - обычный объект
                                                        Utils.log('BACKGROUND: Прямой результат:', results[0].result);
                                                        logTesting('Прямой результат', results[0].result);
                                                        
                                                        Utils.log('�� BACKGROUND: Отправляем сообщение showExamResults...');
                                                        logTesting('Отправляем сообщение showExamResults', { resultsCount: results[0].result ? results[0].result.length : 0 });
                                                        
                                                        // Вызываем обработчик напрямую вместо sendMessage (в Service Worker это надежнее)
                                                        handleShowExamResults(results[0].result || []);
                                                        
                                                        // Автопоиск тестирования завершается без установки флага (как автопоиск пресетов)
                                                        
                                                        // Закрываем вкладку мгновенно
                                                        Utils.log('BACKGROUND: Закрываем вкладку после прямого результата');
                                                        logTesting('Закрываем вкладку после прямого результата');
                                                        chrome.tabs.remove(newTab.id);
                                                    }
                                                } else {
                                                    Utils.error('BACKGROUND: Не удалось получить результаты парсинга');
                                                    logTesting('Не удалось получить результаты парсинга');
                                                    // Показываем уведомление об ошибке
                                                    handleShowExamResults([{ name: 'Ошибка получения данных', score: 'Проверьте консоль браузера' }]);
                                                    
                                                    // Автопоиск тестирования завершается без установки флага (как автопоиск пресетов)
                                                    
                                                    // Закрываем вкладку мгновенно
                                                    Utils.log('BACKGROUND: Закрываем вкладку после ошибки получения данных');
                                                    logTesting('Закрываем вкладку после ошибки получения данных');
                                                    chrome.tabs.remove(newTab.id);
                                                }
                                            });
                                        }, 250); // Задержка перед парсингом
                                    }
                                });
                            });
                            
                            sendResponse({ success: true });
                        } else {
                            Utils.error('Ссылка на водителя не найдена');
                            logTesting('Ссылка на водителя не найдена на текущей странице');
                            
                            // Автопоиск тестирования завершается без установки флага (как автопоиск пресетов)
                            
                            testingStartTime = null; // Сбрасываем время
                            sendResponse({ success: false, error: 'Ссылка на водителя не найдена на текущей странице' });
                        }
                    });
                } else {
                    Utils.error('Нет активной вкладки');
                    logTesting('Нет активной вкладки');
                    
                    // Автопоиск тестирования завершается без установки флага (как автопоиск пресетов)
                    
                    testingStartTime = null; // Сбрасываем время
                    sendResponse({ success: false, error: 'Нет активной вкладки' });
                }
            });
            return true;
        } else if (request.action === 'startLastOrders') {
            // Новый функционал поиска последних заказов - открытие страницы activity и парсинг
            lastOrdersStartTime = Date.now(); // Устанавливаем время начала поиска последних заказов
            
            // Логируем запуск поиска последних заказов
            if (request.trigger === 'autosearch_last_orders') {
                Utils.log('LAST ORDERS: Получен запрос на запуск автопоиска последних заказов');
                logLastOrders('Получен запрос на запуск автопоиска последних заказов');
            } else {
                Utils.log('LAST ORDERS: Получен запрос на запуск поиска последних заказов');
                logLastOrders('Получен запрос на запуск поиска последних заказов');
            }
            
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                    const url = tabs[0].url;
                    
                    // Логируем действие с правильным URL
                    if (request.trigger === 'autosearch_last_orders') {
                        logAction('Background: запуск автопоиска последних заказов', { url: url });
                    } else {
                        logAction('Background: запуск ручного поиска последних заказов', { url: url });
                    }
                    
                    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://') || url.startsWith('about:')) {
                        Utils.error('Невозможно выполнить скрипт на системной странице браузера');
                        logLastOrders('Невозможно выполнить скрипт на системной странице браузера');
                        
                        // Автопоиск последних заказов завершается без установки флага (как автопоиск пресетов)
                        
                        lastOrdersStartTime = null; // Сбрасываем время
                        sendResponse({ success: false, error: 'Невозможно выполнить скрипт на системной странице браузера' });
                        return;
                    }
                    
                    // Находим ссылку на водителя
                    Utils.log('LAST ORDERS: Ищем ссылку на водителя...');
                    Utils.log('🔧 URL обновлен: pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/');
                    logLastOrders('Ищем ссылку на водителя...');
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        function: () => {
                            Utils.log('🔍 ВОДИТЕЛЬ: Начинаем поиск ссылки на водителя');
                            const buttons = document.querySelectorAll('a');
                            Utils.log(`🔍 ВОДИТЕЛЬ: Найдено ссылок: ${buttons.length}`);
                            
                            let driverLink = null;
                            
                            buttons.forEach((button, idx) => {
                                if (button && 
                                    button.textContent.includes('Водитель') &&
                                    button.href.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
                                    driverLink = button.href;
                                    Utils.log(`✅ ВОДИТЕЛЬ: Найдена ссылка на водителя: ${driverLink}`);
                                }
                            });
                            
                            if (!driverLink) {
                                Utils.log('❌ ВОДИТЕЛЬ: Ссылка на водителя не найдена');
                                Utils.log('🔍 ВОДИТЕЛЬ: Доступные ссылки с "Водитель":');
                                buttons.forEach((button, idx) => {
                                    if (button.textContent.includes('Водитель')) {
                                        Utils.log(`  ${idx}: ${button.href}`);
                                    }
                                });
                            }
                            
                            return driverLink;
                        }
                    }, (results) => {
                        Utils.log('🔄 LAST ORDERS: Получены результаты поиска ссылки на водителя:', results);
                        logLastOrders('🔄 Получены результаты поиска ссылки на водителя', results);
                        
                        if (results && results[0] && results[0].result) {
                            const driverUrl = results[0].result;
                            Utils.log('✅ LAST ORDERS: Ссылка на водителя найдена:', driverUrl);
                            logLastOrders('✅ Ссылка на водителя найдена', { driverUrl });
                            
                            // Берем только базовый URL без параметров и добавляем /activity
                            const baseUrl = driverUrl.split('?')[0]; // Убираем все параметры
                            const activityUrl = baseUrl + '/activity';
                            Utils.log('🎯 LAST ORDERS: Формируем URL для активности:', activityUrl);
                            logLastOrders('🎯 Формируем URL для активности', { activityUrl });
                            
                            // Открываем страницу с активностью
                            Utils.log('🌐 LAST ORDERS: Открываем вкладку с активностью...');
                            logLastOrders('🌐 Открываем вкладку с активностью...');
                            chrome.tabs.create({ url: activityUrl, active: false }, (newTab) => {
                                Utils.log('📝 LAST ORDERS: Вкладка создана, ID:', newTab.id);
                                logLastOrders('📝 Вкладка создана', { tabId: newTab.id, url: activityUrl });
                                
                                // Ждем загрузки страницы и ищем контейнер с таблицей активности
                                chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
                                    if (tabId === newTab.id && changeInfo.status === 'complete') {
                                        Utils.log('🔄 LAST ORDERS: Страница активности загружена, ищем контейнер...');
                                        logLastOrders('🔄 Страница активности загружена, ищем контейнер...');
                                        
                                        // Удаляем слушатель, чтобы не вызывать его повторно
                                        chrome.tabs.onUpdated.removeListener(listener);
                                        
                                        // Функция для поиска контейнера с повторными попытками
                                        function findActivityContainer(attempt = 1, maxAttempts = 10) {
                                            Utils.log(`🔍 ACTIVITY: Попытка ${attempt}/${maxAttempts} поиска контейнера...`);
                                            Utils.log(`🔍 ACTIVITY: Вызов findActivityContainer с параметрами: attempt=${attempt}, maxAttempts=${maxAttempts}`);
                                            
                                            chrome.scripting.executeScript({
                                                target: { tabId: newTab.id },
                                                function: () => {
                                                    Utils.log('🔍 ACTIVITY: Ищем контейнер с таблицей активности...');
                                                    
                                                    // Ищем контейнер tbody с классом g-table__body
                                                    const activityContainer = document.querySelector('tbody.g-table__body');
                                                    
                                                    if (activityContainer) {
                                                        Utils.log('✅ ACTIVITY: Контейнер с таблицей активности найден!');
                                                        Utils.log('📊 ACTIVITY: Количество строк в таблице:', activityContainer.querySelectorAll('tr').length);
                                                        
                                                        // Извлекаем данные о последних заказах
                                                        const rows = activityContainer.querySelectorAll('tr');
                                                        const orders = [];
                                                        
                                                        // Обрабатываем первые 5 строк (последние заказы)
                                                        for (let i = 0; i < Math.min(5, rows.length); i++) {
                                                            const row = rows[i];
                                                            const cells = row.querySelectorAll('td');
                                                            
                                                            if (cells.length >= 4) {
                                                                // Статус заказа находится в четвертой ячейке (индекс 3)
                                                                const statusCell = cells[3];
                                                                const statusText = statusCell ? statusCell.textContent.trim() : '';
                                                                
                                                                if (statusText) {
                                                                    // Извлекаем статус (первое слово до двоеточия)
                                                                    let status = '';
                                                                    const colonIndex = statusText.indexOf(':');
                                                                    if (colonIndex > 0) {
                                                                        status = statusText.substring(0, colonIndex).trim();
                                                                    } else {
                                                                        status = statusText.trim();
                                                                    }
                                                                    
                                                                    // Извлекаем тариф (после слова "tariff_")
                                                                    let tariff = '';
                                                                    const tariffIndex = statusText.indexOf('tariff_');
                                                                    if (tariffIndex !== -1) {
                                                                        // Находим начало тарифа
                                                                        const tariffStart = tariffIndex + 7; // длина "tariff_"
                                                                        // Ищем конец тарифа (запятая или конец строки)
                                                                        const tariffEnd = statusText.indexOf(',', tariffStart);
                                                                        if (tariffEnd !== -1) {
                                                                            tariff = statusText.substring(tariffStart, tariffEnd).trim();
                                                                        } else {
                                                                            tariff = statusText.substring(tariffStart).trim();
                                                                        }
                                                                    }
                                                                    
                                                                    if (status) {
                                                                        orders.push({
                                                                            status: status,
                                                                            tariff: tariff || 'неизвестен'
                                                                        });
                                                                        Utils.log(`📋 ACTIVITY: Найден заказ - Статус: ${status}, Тариф: ${tariff || 'неизвестен'}`);
                                                                    }
                                                                }
                                                            }
                                                        }
                                                        
                                                        Utils.log('📊 ACTIVITY: Извлечено заказов:', orders.length);
                                                        Utils.log('📋 ACTIVITY: Данные заказов:', orders);
                                                        
                                                        return {
                                                            found: true,
                                                            rowsCount: activityContainer.querySelectorAll('tr').length,
                                                            orders: orders
                                                        };
                                                    } else {
                                                        Utils.error('❌ ACTIVITY: Контейнер с таблицей активности не найден');
                                                        
                                                        // Дополнительная диагностика - что есть на странице
                                                        const allTbody = document.querySelectorAll('tbody');
                                                        Utils.log('🔍 ACTIVITY: Найдено tbody элементов:', allTbody.length);
                                                        
                                                        const allTables = document.querySelectorAll('table');
                                                        Utils.log('🔍 ACTIVITY: Найдено table элементов:', allTables.length);
                                                        
                                                        const gTableBody = document.querySelectorAll('.g-table__body');
                                                        Utils.log('🔍 ACTIVITY: Найдено элементов с классом g-table__body:', gTableBody.length);
                                                        
                                                        // Проверяем, есть ли элементы с классом DriverActivity
                                                        const driverActivityElements = document.querySelectorAll('[class*="DriverActivity"]');
                                                        Utils.log('🔍 ACTIVITY: Найдено элементов с DriverActivity в классе:', driverActivityElements.length);
                                                        
                                                        return { 
                                                            found: false,
                                                            diagnostic: {
                                                                tbodyCount: allTbody.length,
                                                                tableCount: allTables.length,
                                                                gTableBodyCount: gTableBody.length,
                                                                driverActivityCount: driverActivityElements.length
                                                            }
                                                        };
                                                    }
                                                }
                                            }, (results) => {
                                                Utils.log('🔄 LAST ORDERS: Получены результаты поиска контейнера:', results);
                                                
                                                if (results && results[0] && results[0].result && results[0].result.found) {
                                                    Utils.log('✅ LAST ORDERS: Контейнер с таблицей активности найден!');
                                                    Utils.log('📊 LAST ORDERS: Данные результата:', results[0].result);
                                                    logLastOrders('✅ Контейнер с таблицей активности найден!', { rowsCount: results[0].result.rowsCount });
                                                    
                                                    // Проверяем, есть ли данные о заказах
                                                    const orders = results[0].result.orders || [];
                                                    Utils.log('📋 LAST ORDERS: Извлеченные заказы:', orders);
                                                    
                                                    if (orders.length > 0) {
                                                        // Формируем сообщение с последними заказами (без заголовка)
                                                        const orderMessages = orders.map(order => `${order.status} - ${order.tariff}`);
                                                        const message = orderMessages.join('\n');
                                                        
                                                        Utils.log('🔔 LAST ORDERS: Создаем уведомление с данными заказов...');
                                                        logLastOrders('🔔 Создаем уведомление с данными заказов', { ordersCount: orders.length, orders: orders });
                                                        
                                                        // Проверяем настройки уведомлений
                                                        chrome.storage.local.get(['notifications'], (result) => {
                                                            Utils.log('🔔 LAST ORDERS: Настройки уведомлений:', result);
                                                            
                                                            if (result.notifications === false) {
                                                                Utils.log('🔔 LAST ORDERS: Уведомления отключены в настройках');
                                                                return;
                                                            }
                                                            
                                                            try {
                                                                // Создаем уведомление через createSimpleNotification
                                                                const notificationData = {
                                                                    type: 'basic',
                                                                    title: 'Последние заказы',
                                                                    message: message
                                                                };
                                                                
                                                                createSimpleNotification(notificationData, 10000); // Увеличиваем время до 10 секунд
                                                                Utils.log('✅ LAST ORDERS: Уведомление с данными заказов создано!');
                                                                
                                                                // Закрываем вкладку с активностью сразу после показа уведомления
                                                                chrome.tabs.remove(newTab.id, () => {
                                                                    Utils.log('🔒 LAST ORDERS: Вкладка с активностью закрыта');
                                                                    logLastOrders('🔒 Вкладка с активностью закрыта');
                                                                });
                                                            } catch (error) {
                                                                Utils.error('❌ LAST ORDERS: Ошибка при создании уведомления:', error);
                                                            }
                                                        });
                                                    } else {
                                                        Utils.log('⚠️ LAST ORDERS: Данные о заказах не найдены');
                                                        logLastOrders('⚠️ Данные о заказах не найдены');
                                                        
                                                        // Закрываем вкладку с активностью без показа уведомления
                                                        chrome.tabs.remove(newTab.id, () => {
                                                            Utils.log('🔒 LAST ORDERS: Вкладка с активностью закрыта (данные не найдены)');
                                                            logLastOrders('🔒 Вкладка с активностью закрыта (данные не найдены)');
                                                        });
                                                    }
                                                } else if (attempt < maxAttempts) {
                                                    Utils.log(`⏳ LAST ORDERS: Контейнер не найден, повторная попытка через 1 секунду... (${attempt}/${maxAttempts})`);
                                                    
                                                    // Логируем диагностическую информацию, если она есть
                                                    if (results && results[0] && results[0].result && results[0].result.diagnostic) {
                                                        Utils.log('🔍 LAST ORDERS: Диагностическая информация:', results[0].result.diagnostic);
                                                        logLastOrders(`⏳ Контейнер не найден, повторная попытка ${attempt}/${maxAttempts}`, results[0].result.diagnostic);
                                                    } else {
                                                        logLastOrders(`⏳ Контейнер не найден, повторная попытка ${attempt}/${maxAttempts}`);
                                                    }
                                                    
                                                    // Повторная попытка через 0.5 секунды
                                                    setTimeout(() => {
                                                        findActivityContainer(attempt + 1, maxAttempts);
                                                    }, 500);
                                                } else {
                                                    Utils.error('❌ LAST ORDERS: Контейнер с таблицей активности не найден после всех попыток');
                                                    
                                                    // Логируем финальную диагностическую информацию
                                                    if (results && results[0] && results[0].result && results[0].result.diagnostic) {
                                                        Utils.log('🔍 LAST ORDERS: Финальная диагностическая информация:', results[0].result.diagnostic);
                                                        logLastOrders('❌ Контейнер с таблицей активности не найден после всех попыток', results[0].result.diagnostic);
                                                    } else {
                                                        logLastOrders('❌ Контейнер с таблицей активности не найден после всех попыток');
                                                    }
                                                    
                                                    // Показываем уведомление об ошибке
                                                    chrome.storage.local.get(['notifications'], (result) => {
                                                        if (result.notifications === false) {
                                                            Utils.log('🔔 LAST ORDERS: Уведомления отключены в настройках (ошибка)');
                                                            return;
                                                        }
                                                        
                                                        try {
                                                            const errorNotificationData = {
                                                                type: 'basic',
                                                                title: 'Последние заказы',
                                                                message: 'Контейнер с информацией не найден на странице после нескольких попыток.'
                                                            };
                                                            
                                                                                                                            createSimpleNotification(errorNotificationData, 5000);
                                                                Utils.log('✅ LAST ORDERS: Уведомление об ошибке создано!');
                                                                
                                                                // Закрываем вкладку с активностью сразу после показа уведомления об ошибке
                                                                chrome.tabs.remove(newTab.id, () => {
                                                                    Utils.log('🔒 LAST ORDERS: Вкладка с активностью закрыта (ошибка)');
                                                                    logLastOrders('🔒 Вкладка с активностью закрыта (ошибка)');
                                                                });
                                                        } catch (error) {
                                                            Utils.error('❌ LAST ORDERS: Ошибка при создании уведомления об ошибке:', error);
                                                        }
                                        });
                                    }
                                });
                                        }
                                
                                        // Начинаем поиск контейнера с первой попытки
                                setTimeout(() => {
                                            findActivityContainer(1, 10);
                                        }, 1000); // Ждем 1 секунду для полной загрузки
                                    }
                                });
                                
                                // Автопоиск последних заказов завершается без установки флага (как автопоиск пресетов)
                                
                                // Завершаем выполнение
                                lastOrdersStartTime = null; // Сбрасываем время
                                sendResponse({ success: true });
                            });
                        } else {
                            Utils.error('❌ LAST ORDERS: Ссылка на водителя не найдена');
                            logLastOrders('❌ Ссылка на водителя не найдена');
                            
                            // Автопоиск последних заказов завершается без установки флага (как автопоиск пресетов)
                            
                            lastOrdersStartTime = null; // Сбрасываем время
                            sendResponse({ success: false, error: 'Ссылка на водителя не найдена' });
                        }
                    });
                } else {
                    Utils.error('❌ LAST ORDERS: Нет активной вкладки');
                    logLastOrders('❌ Нет активной вкладки');
                    
                    // Автопоиск последних заказов завершается без установки флага (как автопоиск пресетов)
                    
                    lastOrdersStartTime = null; // Сбрасываем время
                    sendResponse({ success: false, error: 'Нет активной вкладки' });
                }
            });
            return true;
        } else if (request.action === 'openResultsPage') {
            // Функционал тестирования временно отключен
            Utils.log('Функция openResultsPage временно недоступна');
            sendResponse({ success: false, error: 'Функция тестирования временно недоступна' });
        } else if (request.action === 'showExamResults') {
            // Новый обработчик для показа результатов экзаменов (теперь вызывает функцию)
            handleShowExamResults(request.results);
            sendResponse({ success: true });
        } else if (request.action === 'showLastOrdersResults') {
            // Обработчик для показа результатов последних заказов
            handleShowLastOrdersResults(request.results);
            sendResponse({ success: true });
        } else if (request.action === 'showLastOrdersError') {
            // Обработчик для показа ошибок последних заказов
            handleShowLastOrdersError(request.error);
            sendResponse({ success: true });
        } else if (request.action === 'showTestingResults') {
            // Функционал тестирования временно отключен
            Utils.log('Функция showTestingResults временно недоступна');
            sendResponse({ success: false, error: 'Функция тестирования временно недоступна' });
        } else if (request.action === 'clearNotification') {
            clearNotification();
            sendResponse({ success: true });
        } else if (request.action === 'executeAltA') {
            executeAltA();
            sendResponse({ success: true });
        } else if (request.type === 'loadingStarted') {
            setLoadingState(false);
            sendResponse({ success: true });
        } else if (request.type === 'loadingComplete') {
            setLoadingState(true);
            sendResponse({ success: true });
        } else if (request.type === 'notification') {
            queueNotification(request.notification);
            sendResponse({ success: true });
        } else if (request.action === 'processSearchResults') {
            processSearchResults(request.data, request.url, request.title, sendResponse);
            return true;
        } else if (request.action === 'getSettings') {
            chrome.storage.local.get(null, (settings) => {
                if (!settings.customTagsPresets) {
                    settings.customTagsPresets = {
                        preset1: {
                            customTag1: settings.customTag1 || '',
                            customTag2: settings.customTag2 || '',
                            customTag3: settings.customTag3 || '',
                            customTag4: settings.customTag4 || ''
                        },
                        preset2: {
                            customTag1: '',
                            customTag2: '',
                            customTag3: '',
                            customTag4: ''
                        },
                        preset3: {
                            customTag1: '',
                            customTag2: '',
                            customTag3: '',
                            customTag4: ''
                        }
                    };
                    settings.activeCustomTagsPreset = 'preset1';
                    
                    chrome.storage.local.set({
                        customTagsPresets: settings.customTagsPresets,
                        activeCustomTagsPreset: settings.activeCustomTagsPreset
                    });
                }
                
                if (!settings.searchPreset1) {
                    settings.searchPreset1 = 'tags';
                    settings.searchPreset2 = 'profession';
                    settings.searchPreset3 = 'customTags';
                    
                    chrome.storage.local.set({
                        searchPreset1: settings.searchPreset1,
                        searchPreset2: settings.searchPreset2,
                        searchPreset3: settings.searchPreset3
                    });
                }
                
                sendResponse(settings);
            });
            return true;
        } else if (request.action === 'saveSettings') {
            chrome.storage.local.set(request.settings, () => {
                notifySettingsChanged(request.settings);
                sendResponse({ success: true });
            });
            return true;
        } else if (request.action === 'updateSetting') {
            chrome.storage.local.get(null, (settings) => {
                settings[request.key] = request.value;
                chrome.storage.local.set({ [request.key]: request.value }, () => {
                    notifySettingsChanged(settings);
                    sendResponse({ success: true });
                });
            });
            return true;
        } else if (request.action === 'toggleMarker') {
            chrome.storage.local.set({ markerEnabled: request.enabled }, () => {
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'toggleMarker',
                            enabled: request.enabled
                        }).catch(() => {
                            // Игнорируем ошибки, которые могут возникнуть, если вкладка не может принимать сообщения
                        });
                    });
                });
                sendResponse({ success: true });
            });
            return true;
        } else if (request.action === 'updateMarkers') {
            chrome.storage.local.set({ markers: request.markers }, () => {
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'updateMarkers',
                            markers: request.markers
                        }).catch(() => {
                            // Игнорируем ошибки, которые могут возникнуть, если вкладка не может принимать сообщения
                        });
                    });
                });
                sendResponse({ success: true });
            });
            return true;
        } else if (request.action === 'toggleActionLogging') {
            // Включаем/выключаем логирование действий во всех вкладках
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'toggleActionLogging',
                        enabled: request.enabled
                    }).catch(() => {
                        // Игнорируем ошибки, которые могут возникнуть, если вкладка не может принимать сообщения
                    });
                });
            });
            sendResponse({ success: true });
            return true;
        } else if (request.action === 'addActionLog') {
            // Добавляем лог действия
            chrome.storage.local.get(['actionLoggingEnabled', 'actionLogs'], (result) => {
                if (result.actionLoggingEnabled) {
                    const actionLogs = result.actionLogs || [];
                    const timestamp = new Date().toISOString();
                    const logEntry = {
                        timestamp: timestamp,
                        message: request.message,
                        data: request.data,
                        url: request.url || 'background',
                        source: request.source || 'unknown'
                    };
                    
                    actionLogs.push(logEntry);
                    
                    // Ограничиваем количество логов (последние 10000 записей)
                    if (actionLogs.length > 10000) {
                        actionLogs.splice(0, actionLogs.length - 10000);
                    }
                    
                    chrome.storage.local.set({ actionLogs: actionLogs });
                    Utils.log(`[Логирование действий] ${timestamp}: ${request.message}`, request.data);
                }
            });
            sendResponse({ success: true });
            return true;
        } else {
            Utils.warn('Неизвестное действие:', request.action);
            sendResponse({ error: 'Неизвестное действие' });
        }
    } catch (error) {
        Utils.error('Ошибка при обработке сообщения:', error);
        sendResponse({ error: error.message });
    }
    return true;
});

chrome.commands.onCommand.addListener((command) => {
    Utils.log('Получена команда:', command);
    logAction(`Выполнена команда: ${command}`);
    
    if (command === 'run_extension') {
        chrome.storage.local.get(['searchDriverInfo'], (settings) => {
            // Проверяем только поиск страны - поиск тегов/профессии обрабатывается отдельно в content.js
            if (settings.searchDriverInfo === false) {
                Utils.log('Поиск страны отключен в настройках. Команда Alt+A не будет выполнена.');
                return;
            }
            
            chrome.windows.getLastFocused((window) => {
                if (window.type === "normal") {
                    chrome.tabs.query({ active: true, windowId: window.id }, (tabs) => {
                        if (tabs.length > 0) {
                            chrome.tabs.sendMessage(tabs[0].id, { action: 'runSearch' }, (response) => {
                                if (chrome.runtime.lastError) {
                                    chrome.scripting.executeScript({
                                        target: { tabId: tabs[0].id },
                                        files: ['js/content.js']
                                    });
                                }
                            });
                        } else {
                            Utils.log("Нет активной вкладки");
                        }
                    });
                } else {
                    Utils.log("Нет окна в фокусе");
                }
            });
        });
    } else if (command === 'click_driver_button') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    files: ['js/clickdriver.js']
                });
            }
        });
    } else if (command === 'clear_notifications') {
        clearNotification();
    // ===== УНИФИЦИРОВАННЫЕ ОБРАБОТЧИКИ КОМАНД =====
    
    } else if (command === 'search_button') {
        logAction('Background: получена команда search_button (Alt+Shift+S)');
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                // Отправляем сообщение в content.js вместо прямого выполнения
                chrome.tabs.sendMessage(tabs[0].id, { action: 'startSearch' }, (response) => {
                    if (chrome.runtime.lastError) {
                        Utils.log('Ошибка при отправке сообщения startSearch:', chrome.runtime.lastError);
                        logAction('Background: ошибка при отправке сообщения startSearch', { error: chrome.runtime.lastError.message });
                    } else {
                        Utils.log('Сообщение startSearch отправлено в content.js');
                        logAction('Background: сообщение startSearch отправлено в content.js');
                    }
                });
            }
        });
    } else if (command === 'run_testing') {
        // Новый функционал тестирования - отправляем сообщение в content.js
        logAction('Background: получена команда run_testing (горячие клавиши)');
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                // Отправляем сообщение в content.js вместо прямого выполнения
                chrome.tabs.sendMessage(tabs[0].id, { action: 'startTesting' }, (response) => {
                    if (chrome.runtime.lastError) {
                        Utils.log('Ошибка при отправке сообщения startTesting:', chrome.runtime.lastError);
                        logAction('Background: ошибка при отправке сообщения startTesting', { error: chrome.runtime.lastError.message });
                    } else {
                        Utils.log('Сообщение startTesting отправлено в content.js');
                        logAction('Background: сообщение startTesting отправлено в content.js');
                    }
                });
            }
        });
    } else if (command === 'run_last_orders') {
        // Новый функционал последних заказов - отправляем сообщение в content.js
        logAction('Background: получена команда run_last_orders (горячие клавиши)');
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                // Отправляем сообщение в content.js вместо прямого выполнения
                chrome.tabs.sendMessage(tabs[0].id, { action: 'startLastOrders' }, (response) => {
                    if (chrome.runtime.lastError) {
                        Utils.log('Ошибка при отправке сообщения startLastOrders:', chrome.runtime.lastError);
                        logAction('Background: ошибка при отправке сообщения startLastOrders', { error: chrome.runtime.lastError.message });
                    } else {
                        Utils.log('Сообщение startLastOrders отправлено в content.js');
                        logAction('Background: сообщение startLastOrders отправлено в content.js');
                    }
                });
            }
        });
    } else if (command === 'open_sms_menu') {
        // Открываем popup с активным меню СМС
        chrome.storage.local.set({ 'openSmsMenu': true }, () => {
            chrome.action.openPopup();
        });
    }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
    if (!activeInfo) return Utils.log('Нет информации о активной вкладке');
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('browser://')) {
            handleFocusChange();
        }
        if (tab.url !== previousTabUrl) {
            previousTabUrl = tab.url;
            handleFocusChange();
        }
    });
});

function handleFocusChange() {
    Utils.log('🌐 GLOBAL: Смена фокуса вкладки - сохраняем глобальные уведомления');
    // Не очищаем уведомления при смене фокуса, чтобы они оставались глобальными
    // clearNotification(); // Закомментировано для сохранения глобальных уведомлений
}

// Функция для обработки команды тестирования через горячие клавиши
function handleTestingCommand() {
    testingStartTime = Date.now();
    Utils.log('🚀 TESTING: Получен запрос на запуск тестирования через горячую клавишу');
    logTesting('🚀 Получен запрос на запуск тестирования через горячую клавишу');
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            const url = tabs[0].url;
            if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://') || url.startsWith('about:')) {
                Utils.error('Невозможно выполнить скрипт на системной странице браузера');
                logTesting('❌ Невозможно выполнить скрипт на системной странице браузера');
                testingStartTime = null;
                return;
            }
            
            // Находим ссылку на водителя
            Utils.log('🔍 TESTING: Ищем ссылку на водителя...');
            logTesting('🔍 Ищем ссылку на водителя...');
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                function: () => {
                    Utils.log('🔍 ВОДИТЕЛЬ: Начинаем поиск ссылки на водителя');
                    const buttons = document.querySelectorAll('a');
                    Utils.log(`🔍 ВОДИТЕЛЬ: Найдено ссылок: ${buttons.length}`);
                    
                    let driverLink = null;
                    
                    buttons.forEach((button, idx) => {
                        if (button && 
                            button.textContent.includes('Водитель') &&
                            button.href.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
                            driverLink = button.href;
                            Utils.log(`✅ ВОДИТЕЛЬ: Найдена ссылка на водителя: ${driverLink}`);
                        }
                    });
                    
                    return driverLink;
                }
            }, (results) => {
                if (results && results[0] && results[0].result) {
                    const driverUrl = results[0].result;
                    const baseUrl = driverUrl.split('?')[0];
                    const examsUrl = baseUrl + '/exams-results';
                    
                    chrome.tabs.create({ url: examsUrl, active: false }, (newTab) => {
                        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                            if (tabId === newTab.id && changeInfo.status === 'complete') {
                                chrome.tabs.onUpdated.removeListener(listener);
                                
                                setTimeout(() => {
                                                                    chrome.scripting.executeScript({
                                    target: { tabId: newTab.id },
                                    function: () => {
                                        // Полная функция парсинга страницы exams-results (такая же как в startTesting)
                                        const parseExamResults = () => {
                                            Utils.log('🔍 ПАРСИНГ: Начинаем парсинг страницы exams-results');
                                            Utils.log('🔍 ПАРСИНГ: URL страницы:', window.location.href);
                                            
                                                                                        Utils.log('🔍 ПАРСИНГ: Document ready state:', document.readyState);
                                            
                                            // Ждем полной загрузки страницы
                                            const waitForPageLoad = () => {
                                                return new Promise((resolve) => {
                                                    if (document.readyState === 'complete') {
                                                        Utils.log('✅ ПАРСИНГ: Страница полностью загружена');
                                                        resolve();
                                                    } else {
                                                        Utils.log('⏳ ПАРСИНГ: Ждем полной загрузки страницы...');
                                                        window.addEventListener('load', () => {
                                                            Utils.log('✅ ПАРСИНГ: Страница загружена через load event');
                                                            resolve();
                                                        });
                                                        // Fallback на случай, если load event не сработает
                                                        setTimeout(resolve, 1000);
                                                    }
                                                });
                                            };
                                            
                                            // Ждем появления таблицы с детальной отладкой
                                            const waitForTable = () => {
                                                return new Promise((resolve, reject) => {
                                                    Utils.log('🔍 ПАРСИНГ: Ищем таблицу...');
                                                    const startTime = Date.now();
                                                                                                                    const timeout = 5000; // Таймаут 5 секунд
                                                    let attempts = 0;
                                                    const maxAttempts = 15; // 15 попыток
                                            
                                            const checkTable = () => {
                                                attempts++;
                                                
                                                // Проверяем iframe
                                                const iframes = document.querySelectorAll('iframe');
                                                Utils.log(`🔍 ПАРСИНГ: Попытка ${attempts}/${maxAttempts}, найдено iframe: ${iframes.length}`);
                                                
                                                // Проверяем загрузку iframe
                                                for (let i = 0; i < iframes.length; i++) {
                                                    const iframe = iframes[i];
                                                    Utils.log(`🔍 ПАРСИНГ: Iframe ${i}: src=${iframe.src}, readyState=${iframe.contentDocument?.readyState || 'unknown'}`);
                                                    
                                                    if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                                                        // Ищем таблицы в iframe
                                                        const iframeTables = iframe.contentDocument.querySelectorAll('table');
                                                        Utils.log(`🔍 ПАРСИНГ: В iframe ${i} найдено таблиц: ${iframeTables.length}`);
                                                    }
                                                }
                                                
                                                // Ищем любые таблицы на странице
                                                const tables = document.querySelectorAll('table');
                                                const gravityTable = document.querySelector('table.g-table__table');
                                                const gravityUITable = document.querySelector('table.GravityUI-Table');
                                                
                                                Utils.log(`🔍 ПАРСИНГ: Найдено таблиц всего: ${tables.length}`);
                                                Utils.log('🔍 ПАРСИНГ: Gravity table:', gravityTable);
                                                Utils.log('🔍 ПАРСИНГ: GravityUI table:', gravityUITable);
                                                
                                                // Проверяем наличие контента
                                                const bodyText = document.body.textContent.trim();
                                                Utils.log(`🔍 ПАРСИНГ: Длина текста body: ${bodyText.length} символов`);
                                                
                                                // Проверяем captcha
                                                const captcha = document.querySelector('title');
                                                if (captcha && captcha.textContent.includes('робот')) {
                                                    Utils.error('❌ ПАРСИНГ: Обнаружена капча!');
                                                    reject(new Error('Обнаружена капча - требуется ручная проверка'));
                                                    return;
                                                }
                                                
                                                const table = gravityTable || gravityUITable || tables[0];
                                                if (table) {
                                                                Utils.log('✅ ПАРСИНГ: Таблица найдена!', table);
                                                                resolve(table);
                                                            } else if (Date.now() - startTime > timeout || attempts >= maxAttempts) {
                                                                Utils.error('❌ ПАРСИНГ: Таблица не найдена за отведенное время');
                                                                Utils.log('🔍 ПАРСИНГ: HTML страницы:', document.documentElement.innerHTML.substring(0, 1000));
                                                                Utils.log('🔍 ПАРСИНГ: Все элементы table:', Array.from(tables).map(t => t.outerHTML.substring(0, 100)));
                                                                reject(new Error('Таблица не найдена'));
                                                            } else {
                                                                setTimeout(checkTable, 30); // Интервал 30мс
                                                            }
                                                        };
                                                        checkTable();
                                                    });
                                                };
                                            
                                            // Функция для клика на раздел и чтения содержимого
                                            const clickAndReadSection = async (sectionName) => {
                                                Utils.log(`🔍 ПАРСИНГ: Ищем раздел "${sectionName}"`);
                                                
                                                // Ждем немного перед поиском разделов
                                                await new Promise(resolve => setTimeout(resolve, 100));
                                                
                                                // Ищем строки с разделами
                                                const clickableRows = document.querySelectorAll('tr.GravityUI-TableRow_clickable, tr[class*="clickable"], tr[class*="TableRow"]');
                                                Utils.log(`🔍 ПАРСИНГ: Найдено кликабельных строк: ${clickableRows.length}`);
                                                
                                                // Выводим все найденные разделы для отладки
                                                Utils.log('🔍 ПАРСИНГ: Все найденные разделы:');
                                                clickableRows.forEach((row, idx) => {
                                                    const cells = row.querySelectorAll('td');
                                                    const rowText = cells[0] ? cells[0].textContent.trim() : 'пустая ячейка';
                                                    Utils.log(`  ${idx}: "${rowText}"`);
                                                });
                                                
                                                let sectionRow = null;
                                                
                                                // Ищем нужный раздел
                                                for (const row of clickableRows) {
                                                    const cells = row.querySelectorAll('td');
                                                    for (const cell of cells) {
                                                        const cellText = cell.textContent.trim();
                                                        Utils.log(`🔍 ПАРСИНГ: Проверяем ячейку: "${cellText}"`);
                                                        if (cellText === sectionName) {
                                                            sectionRow = row;
                                                            Utils.log(`✅ ПАРСИНГ: Найден раздел "${sectionName}"!`);
                                                            break;
                                                        }
                                                    }
                                                    if (sectionRow) break;
                                                }
                                                
                                                if (!sectionRow) {
                                                    Utils.error(`❌ ПАРСИНГ: Раздел "${sectionName}" не найден`);
                                                    Utils.log('🔍 ПАРСИНГ: Доступные разделы:');
                                                    clickableRows.forEach((row, idx) => {
                                                        Utils.log(`  ${idx}: ${row.textContent.trim()}`);
                                                    });
                                                    return [];
                                                }
                                                
                                                // Кликаем на раздел
                                                Utils.log(`🖱️ ПАРСИНГ: Кликаем на раздел "${sectionName}"`);
                                                sectionRow.click();
                                                
                                                // Ждем раскрытия содержимого
                                                Utils.log(`⏳ ПАРСИНГ: Ждем раскрытия содержимого раздела "${sectionName}"...`);
                                                await new Promise(resolve => setTimeout(resolve, 300)); // Время ожидания
                                                
                                                // Читаем содержимое раздела
                                                Utils.log(`📖 ПАРСИНГ: Читаем содержимое раздела "${sectionName}"`);
                                                const sectionResults = [];
                                                
                                                // Ищем все строки таблицы
                                                const allRows = document.querySelectorAll('tr');
                                                Utils.log(`🔍 ПАРСИНГ: Всего строк в таблицах: ${allRows.length}`);
                                                
                                                // Выводим первые несколько строк для отладки
                                                Utils.log('🔍 ПАРСИНГ: Первые 5 строк таблицы:');
                                                for (let i = 0; i < Math.min(5, allRows.length); i++) {
                                                    const row = allRows[i];
                                                    const cells = row.querySelectorAll('td');
                                                    const rowText = Array.from(cells).map(cell => cell.textContent.trim()).join(' | ');
                                                    Utils.log(`  ${i}: "${rowText}"`);
                                                }
                                                Utils.log(`🔍 ПАРСИНГ: Всего строк в таблицах: ${allRows.length}`);
                                                
                                                let isInSection = false;
                                                let sectionStarted = false;
                                                
                                                for (const row of allRows) {
                                                    const rowText = row.textContent.trim();
                                                    
                                                    // Проверяем, начался ли наш раздел
                                                    if (rowText === sectionName) {
                                                        isInSection = true;
                                                        sectionStarted = true;
                                                        Utils.log(`📌 ПАРСИНГ: Начинаем чтение раздела "${sectionName}"`);
                                                        continue;
                                                    }
                                                    
                                                    // Проверяем, закончился ли раздел (новый раздел начался)
                                                    if (sectionStarted && isInSection && (rowText === 'Тарифы' || rowText === 'Опции') && rowText !== sectionName) {
                                                        Utils.log(`📌 ПАРСИНГ: Закончили чтение раздела "${sectionName}", начался "${rowText}"`);
                                                        break;
                                                    }
                                                    
                                                    // Если мы в нужном разделе и это строка с данными
                                                    if (isInSection && !row.classList.contains('GravityUI-TableRow_clickable') && !row.classList.contains('clickable')) {
                                                        const cells = row.querySelectorAll('td');
                                                        Utils.log(`🔍 ПАРСИНГ: Проверяем строку в разделе "${sectionName}": ${cells.length} ячеек`);
                                                        
                                                        if (cells.length >= 3) {
                                                            const name = cells[1] ? cells[1].textContent.trim() : '';
                                                            const score = cells[2] ? cells[2].textContent.trim() : '';
                                                            
                                                            Utils.log(`🔍 ПАРСИНГ: Ячейки: name="${name}", score="${score}"`);
                                                            
                                                            if (name && score && name !== 'Курс' && name !== 'Оценка:' && !name.includes('Статус')) {
                                                                Utils.log(`📊 ПАРСИНГ: Найден результат - ${name}: ${score} (раздел: ${sectionName})`);
                                                                sectionResults.push({ name, score, section: sectionName });
                                                            } else {
                                                                Utils.log(`🔍 ПАРСИНГ: Строка пропущена: name="${name}", score="${score}"`);
                                                            }
                                                        } else {
                                                            Utils.log(`🔍 ПАРСИНГ: Строка пропущена (недостаточно ячеек): ${cells.length} ячеек`);
                                                        }
                                                    }
                                                }
                                                
                                                Utils.log(`✅ ПАРСИНГ: Завершили чтение раздела "${sectionName}", найдено: ${sectionResults.length} результатов`);
                                                return sectionResults;
                                            };
                                            
                                            return waitForPageLoad().then(() => {
                                                Utils.log('🏁 ПАРСИНГ: Страница загружена, ищем таблицу...');
                                                return waitForTable();
                                            }).then(async () => {
                                                Utils.log('🏁 ПАРСИНГ: Таблица найдена, начинаем парсинг разделов...');
                                                
                                                // Ищем и кликаем разделы "Тарифы" и "Опции"
                                                const tariffsResults = await clickAndReadSection('Тарифы');
                                                const optionsResults = await clickAndReadSection('Опции');
                                                
                                                const allResults = [...tariffsResults, ...optionsResults];
                                                Utils.log('🎉 ПАРСИНГ: Завершен! Всего результатов:', allResults.length);
                                                Utils.log('📋 ПАРСИНГ: Результаты:', allResults);
                                                
                                                return allResults;
                                            }).catch(error => {
                                                Utils.error('❌ ПАРСИНГ: Ошибка:', error);
                                                throw error;
                                            });
                                        };
                                        
                                        return parseExamResults();
                                    }
                                    }, (results) => {
                                        if (results && results[0] && results[0].result) {
                                            if (typeof results[0].result.then === 'function') {
                                                results[0].result.then(examResults => {
                                                    handleShowExamResults(examResults);
                                                    chrome.tabs.remove(newTab.id);
                                                });
                                            } else {
                                                handleShowExamResults(results[0].result);
                                                chrome.tabs.remove(newTab.id);
                                            }
                                        } else {
                                            handleShowExamResults([{ name: 'Ошибка', score: 'Не удалось получить результаты' }]);
                                            chrome.tabs.remove(newTab.id);
                                        }
                                    });
                                }, 500);
                            }
                        });
                    });
                } else {
                    Utils.error('Ссылка на водителя не найдена');
                    logTesting('❌ Ссылка на водителя не найдена на текущей странице');
                    testingStartTime = null;
                }
            });
        } else {
            Utils.error('Нет активной вкладки');
            logTesting('❌ Нет активной вкладки');
            testingStartTime = null;
        }
    });
}

// Функция для обработки команды последних заказов через горячие клавиши
function handleLastOrdersCommand() {
    lastOrdersStartTime = Date.now();
    Utils.log('🚀 LAST ORDERS: Получен запрос на запуск поиска последних заказов через горячую клавишу');
    logLastOrders('🚀 Получен запрос на запуск поиска последних заказов через горячую клавишу');
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            const url = tabs[0].url;
            if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://') || url.startsWith('about:')) {
                Utils.error('Невозможно выполнить скрипт на системной странице браузера');
                logLastOrders('❌ Невозможно выполнить скрипт на системной странице браузера');
                lastOrdersStartTime = null;
                return;
            }
            
            // Находим ссылку на водителя
            Utils.log('🔍 LAST ORDERS: Ищем ссылку на водителя...');
            logLastOrders('🔍 Ищем ссылку на водителя...');
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                function: () => {
                    Utils.log('🔍 ВОДИТЕЛЬ: Начинаем поиск ссылки на водителя');
                    const buttons = document.querySelectorAll('a');
                    Utils.log(`🔍 ВОДИТЕЛЬ: Найдено ссылок: ${buttons.length}`);
                    
                    let driverLink = null;
                    
                    buttons.forEach((button, idx) => {
                        if (button && 
                            button.textContent.includes('Водитель') &&
                            button.href.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
                            driverLink = button.href;
                            Utils.log(`✅ ВОДИТЕЛЬ: Найдена ссылка на водителя: ${driverLink}`);
                        }
                    });
                    
                    return driverLink;
                }
            }, (results) => {
                if (results && results[0] && results[0].result) {
                    const driverUrl = results[0].result;
                    const baseUrl = driverUrl.split('?')[0];
                    const activityUrl = baseUrl + '/activity';
                    
                    chrome.tabs.create({ url: activityUrl, active: false }, (newTab) => {
                        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                            if (tabId === newTab.id && changeInfo.status === 'complete') {
                                chrome.tabs.onUpdated.removeListener(listener);
                                
                                setTimeout(() => {
                                    chrome.scripting.executeScript({
                                        target: { tabId: newTab.id },
                                        function: () => {
                                            // Функция для поиска контейнера с повторными попытками
                                            function findActivityContainer(attempt = 1, maxAttempts = 10) {
                                                Utils.log(`🔍 ACTIVITY: Попытка ${attempt}/${maxAttempts} поиска контейнера...`);
                                                
                                                // Ищем контейнер tbody с классом g-table__body
                                                const activityContainer = document.querySelector('tbody.g-table__body');
                                                
                                                if (activityContainer) {
                                                    Utils.log('✅ ACTIVITY: Контейнер с таблицей активности найден!');
                                                    Utils.log('📊 ACTIVITY: Количество строк в таблице:', activityContainer.querySelectorAll('tr').length);
                                                    
                                                    // Извлекаем данные о последних заказах
                                                    const rows = activityContainer.querySelectorAll('tr');
                                                    const orders = [];
                                                    
                                                    // Обрабатываем первые 5 строк (последние заказы)
                                                    for (let i = 0; i < Math.min(5, rows.length); i++) {
                                                        const row = rows[i];
                                                        const cells = row.querySelectorAll('td');
                                                        
                                                        if (cells.length >= 4) {
                                                            // Статус заказа находится в четвертой ячейке (индекс 3)
                                                            const statusCell = cells[3];
                                                            const statusText = statusCell ? statusCell.textContent.trim() : '';
                                                            
                                                            if (statusText) {
                                                                // Извлекаем статус (первое слово до двоеточия)
                                                                let status = '';
                                                                const colonIndex = statusText.indexOf(':');
                                                                if (colonIndex > 0) {
                                                                    status = statusText.substring(0, colonIndex).trim();
                                                                } else {
                                                                    status = statusText.trim();
                                                                }
                                                                
                                                                // Извлекаем тариф (после слова "tariff_")
                                                                let tariff = '';
                                                                const tariffIndex = statusText.indexOf('tariff_');
                                                                if (tariffIndex !== -1) {
                                                                    // Находим начало тарифа
                                                                    const tariffStart = tariffIndex + 7; // длина "tariff_"
                                                                    // Ищем конец тарифа (запятая или конец строки)
                                                                    const tariffEnd = statusText.indexOf(',', tariffStart);
                                                                    if (tariffEnd !== -1) {
                                                                        tariff = statusText.substring(tariffStart, tariffEnd).trim();
                                                                    } else {
                                                                        tariff = statusText.substring(tariffStart).trim();
                                                                    }
                                                                }
                                                                
                                                                if (status) {
                                                                    orders.push({
                                                                        status: status,
                                                                        tariff: tariff || 'неизвестен'
                                                                    });
                                                                    Utils.log(`📋 ACTIVITY: Найден заказ - Статус: ${status}, Тариф: ${tariff || 'неизвестен'}`);
                                                                }
                                                            }
                                                        }
                                                    }
                                                    
                                                    Utils.log('📊 ACTIVITY: Извлечено заказов:', orders.length);
                                                    Utils.log('📋 ACTIVITY: Данные заказов:', orders);
                                                    
                                                    return {
                                                        found: true,
                                                        rowsCount: activityContainer.querySelectorAll('tr').length,
                                                        orders: orders
                                                    };
                                                } else {
                                                    Utils.error('❌ ACTIVITY: Контейнер с таблицей активности не найден');
                                                    
                                                    // Дополнительная диагностика - что есть на странице
                                                    const allTbody = document.querySelectorAll('tbody');
                                                    Utils.log('🔍 ACTIVITY: Найдено tbody элементов:', allTbody.length);
                                                    
                                                    const allTables = document.querySelectorAll('table');
                                                    Utils.log('🔍 ACTIVITY: Найдено table элементов:', allTables.length);
                                                    
                                                    const gTableBody = document.querySelectorAll('.g-table__body');
                                                    Utils.log('🔍 ACTIVITY: Найдено элементов с классом g-table__body:', gTableBody.length);
                                                    
                                                    // Проверяем, есть ли элементы с классом DriverActivity
                                                    const driverActivityElements = document.querySelectorAll('[class*="DriverActivity"]');
                                                    Utils.log('🔍 ACTIVITY: Найдено элементов с DriverActivity в классе:', driverActivityElements.length);
                                                    
                                                    return { 
                                                        found: false,
                                                        diagnostic: {
                                                            tbodyCount: allTbody.length,
                                                            tableCount: allTables.length,
                                                            gTableBodyCount: gTableBody.length,
                                                            driverActivityCount: driverActivityElements.length
                                                        }
                                                    };
                                                }
                                            }
                                            
                                            return findActivityContainer(1, 10);
                                        }
                                    }, (results) => {
                                        Utils.log('🔄 LAST ORDERS: Получены результаты поиска контейнера:', results);
                                        
                                        if (results && results[0] && results[0].result && results[0].result.found) {
                                            Utils.log('✅ LAST ORDERS: Контейнер с таблицей активности найден!');
                                            Utils.log('📊 LAST ORDERS: Данные результата:', results[0].result);
                                            logLastOrders('✅ Контейнер с таблицей активности найден!', { rowsCount: results[0].result.rowsCount });
                                            
                                            // Проверяем, есть ли данные о заказах
                                            const orders = results[0].result.orders || [];
                                            Utils.log('📋 LAST ORDERS: Извлеченные заказы:', orders);
                                            
                                            if (orders.length > 0) {
                                                // Формируем сообщение с последними заказами (без заголовка)
                                                const orderMessages = orders.map(order => `${order.status} - ${order.tariff}`);
                                                const message = orderMessages.join('\n');
                                                
                                                Utils.log('🔔 LAST ORDERS: Создаем уведомление с данными заказов...');
                                                logLastOrders('🔔 Создаем уведомление с данными заказов', { ordersCount: orders.length, orders: orders });
                                                
                                                // Проверяем настройки уведомлений
                                                chrome.storage.local.get(['notifications'], (result) => {
                                                    Utils.log('🔔 LAST ORDERS: Настройки уведомлений:', result);
                                                    
                                                    if (result.notifications === false) {
                                                        Utils.log('🔔 LAST ORDERS: Уведомления отключены в настройках');
                                                        return;
                                                    }
                                                    
                                                    try {
                                                        // Создаем уведомление через createSimpleNotification
                                                        const notificationData = {
                                                            type: 'basic',
                                                            title: 'Последние заказы',
                                                            message: message
                                                        };
                                                        
                                                        createSimpleNotification(notificationData, 10000); // Увеличиваем время до 10 секунд
                                                        Utils.log('✅ LAST ORDERS: Уведомление с данными заказов создано!');
                                                        
                                                        // Закрываем вкладку с активностью сразу после показа уведомления
                                                        chrome.tabs.remove(newTab.id, () => {
                                                            Utils.log('🔒 LAST ORDERS: Вкладка с активностью закрыта');
                                                            logLastOrders('🔒 Вкладка с активностью закрыта');
                                                        });
                                                    } catch (error) {
                                                        Utils.error('❌ LAST ORDERS: Ошибка при создании уведомления:', error);
                                                    }
                                                });
                                            } else {
                                                Utils.log('⚠️ LAST ORDERS: Данные о заказах не найдены');
                                                logLastOrders('⚠️ Данные о заказах не найдены');
                                                
                                                // Закрываем вкладку с активностью без показа уведомления
                                                chrome.tabs.remove(newTab.id, () => {
                                                    Utils.log('🔒 LAST ORDERS: Вкладка с активностью закрыта (данные не найдены)');
                                                    logLastOrders('🔒 Вкладка с активностью закрыта (данные не найдены)');
                                                });
                                            }
                                        } else if (attempt < maxAttempts) {
                                            Utils.log(`⏳ LAST ORDERS: Контейнер не найден, повторная попытка через 1 секунду... (${attempt}/${maxAttempts})`);
                                            
                                            // Логируем диагностическую информацию, если она есть
                                            if (results && results[0] && results[0].result && results[0].result.diagnostic) {
                                                Utils.log('🔍 LAST ORDERS: Диагностическая информация:', results[0].result.diagnostic);
                                                logLastOrders(`⏳ Контейнер не найден, повторная попытка ${attempt}/${maxAttempts}`, results[0].result.diagnostic);
                                            } else {
                                                logLastOrders(`⏳ Контейнер не найден, повторная попытка ${attempt}/${maxAttempts}`);
                                            }
                                            
                                            // Повторная попытка через 1 секунду
                                            setTimeout(() => {
                                                findActivityContainer(attempt + 1, maxAttempts);
                                            }, 1000);
                                        } else {
                                            Utils.error('❌ LAST ORDERS: Контейнер с таблицей активности не найден после всех попыток');
                                            
                                            // Логируем финальную диагностическую информацию
                                            if (results && results[0] && results[0].result && results[0].result.diagnostic) {
                                                Utils.log('🔍 LAST ORDERS: Финальная диагностическая информация:', results[0].result.diagnostic);
                                                logLastOrders('❌ Контейнер с таблицей активности не найден после всех попыток', results[0].result.diagnostic);
                                            } else {
                                                logLastOrders('❌ Контейнер с таблицей активности не найден после всех попыток');
                                            }
                                            
                                            // Показываем уведомление об ошибке
                                            chrome.storage.local.get(['notifications'], (result) => {
                                                if (result.notifications === false) {
                                                    Utils.log('🔔 LAST ORDERS: Уведомления отключены в настройках (ошибка)');
                                                    return;
                                                }
                                                
                                                try {
                                                    const errorNotificationData = {
                                                        type: 'basic',
                                                        title: 'Последние заказы',
                                                        message: 'Контейнер с информацией не найден на странице.'
                                                    };
                                                    
                                                    createSimpleNotification(errorNotificationData, 5000);
                                                    Utils.log('✅ LAST ORDERS: Уведомление об ошибке создано!');
                                                    
                                                    // Закрываем вкладку с активностью сразу после показа уведомления об ошибке
                                                    chrome.tabs.remove(newTab.id, () => {
                                                        Utils.log('🔒 LAST ORDERS: Вкладка с активностью закрыта (ошибка)');
                                                        logLastOrders('🔒 Вкладка с активностью закрыта (ошибка)');
                                                    });
                                                } catch (error) {
                                                    Utils.error('❌ LAST ORDERS: Ошибка при создании уведомления об ошибке:', error);
                                                }
                                            });
                                        }
                                    });
                                }, 2000); // Ждем 2 секунды для полной загрузки
                            }
                        });
                    });
                } else {
                    Utils.error('Ссылка на водителя не найдена');
                    logLastOrders('❌ Ссылка на водителя не найдена на текущей странице');
                    lastOrdersStartTime = null;
                }
            });
        } else {
            Utils.error('Нет активной вкладки');
            logLastOrders('❌ Нет активной вкладки');
            lastOrdersStartTime = null;
        }
    });
}

function executeAltA() {
    chrome.storage.local.get(['searchDriverInfo'], (settings) => {
        // Проверяем только поиск страны - поиск тегов/профессии обрабатывается отдельно в content.js
        if (settings.searchDriverInfo === false) {
            Utils.log('Поиск страны отключен в настройках. Команда Alt+A не будет выполнена.');
            return;
        }
        
        chrome.windows.getLastFocused((window) => {
            if (window.type === "normal") {
                chrome.tabs.query({ active: true, windowId: window.id }, (tabs) => {
                    if (tabs.length > 0) {
                        chrome.tabs.sendMessage(tabs[0].id, { action: 'runSearch' }, (response) => {
                            if (chrome.runtime.lastError) {
                                chrome.scripting.executeScript({
                                    target: { tabId: tabs[0].id },
                                    files: ['js/content.js']
                                });
                            }
                        });
                    }
                });
            }
        });
    });
}

function executeLastOrders() {
    chrome.windows.getLastFocused((window) => {
        if (window.type === "normal") {
            chrome.tabs.query({ active: true, windowId: window.id }, (tabs) => {
                if (tabs.length > 0) {
                    // Запускаем поиск последних заказов
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'startLastOrders' }, (response) => {
                        if (chrome.runtime.lastError) {
                            chrome.scripting.executeScript({
                                target: { tabId: tabs[0].id },
                                files: ['js/content.js']
                            });
                        }
                    });
                }
            });
        }
    });
}

function createSimpleNotification(data, notificationTimeout = 54000) {
    Utils.log('🌐 GLOBAL: Создаем глобальное уведомление с данными:', data);
    
    return new Promise((resolve) => {
        chrome.storage.local.get(['notifications'], ({ notifications }) => {
            if (notifications === false) {
                Utils.log('🌐 GLOBAL: Уведомления отключены в настройках');
                resolve(null);
                return;
            }
            
            try {
                if (!data) {
                    Utils.error('🌐 GLOBAL: Данные уведомления не переданы');
                    resolve(null);
                    return;
                }
                
                let notificationOptions;
                
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
                    
                    notificationOptions = {
                        type: 'list',
                        iconUrl: chrome.runtime.getURL(DefaultIconPath),
                        title: data.title || 'Результаты тестирования',
                        message: '',
                        items: items,
                        priority: 2,
                        requireInteraction: notificationTimeout === 0
                    };
                } else if (data.type === 'last_orders') {
                    // Для уведомлений последних заказов используем список
                    const resultsArray = data.message.split('\n');
                    
                    const items = [];
                    for (let i = 0; i < resultsArray.length; i++) {
                        const result = resultsArray[i];
                        if (result.trim()) {
                            items.push({
                                title: result,
                                message: ''
                            });
                        }
                    }
                    
                    notificationOptions = {
                        type: 'list',
                        iconUrl: chrome.runtime.getURL(DefaultIconPath),
                        title: data.title || 'Последние заказы',
                        message: '',
                        items: items,
                        priority: 2,
                        requireInteraction: notificationTimeout === 0
                    };
                } else if (data.type === 'basic') {
                    // Для простых уведомлений (например, ошибки) используем стандартное создание
                    notificationOptions = {
                        type: data.type || 'basic',
                        iconUrl: data.iconUrl || chrome.runtime.getURL(DefaultIconPath),
                        title: data.title || 'Уведомление',
                        message: data.message || '',
                        priority: 2,
                        requireInteraction: notificationTimeout === 0
                    };
                } else {
                    // ЛОГИРОВАНИЕ: Создание уведомления с данными водителя в background.js
                    Utils.log('🟡 BACKGROUND.JS: СОЗДАНИЕ УВЕДОМЛЕНИЯ С ДАННЫМИ ВОДИТЕЛЯ');
                    Utils.log('🟡 Источник данных:', data);
                    Utils.log('🟡 Stack trace:', new Error().stack);
                    
                    // Добавляем в систему логирования действий
                    logAction('🟡 BACKGROUND.JS: СОЗДАНИЕ УВЕДОМЛЕНИЯ С ДАННЫМИ ВОДИТЕЛЯ', {
                        ticketId: data.ticketId,
                        country: data.country,
                        driverLicense: data.driverLicense,
                        stack: new Error().stack.split('\n').slice(0, 8).join('\n')
                    });
                    
                    const countryCode = (data.country || 'unknown').toLowerCase();
                    
                    const iconUrl = getNotificationIcon(data.country);
                    Utils.log('Получен URL иконки флага:', iconUrl);
                    
                    notificationOptions = {
                        type: 'list',
                        iconUrl: iconUrl,
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
                    
                    Utils.log('🟡 BACKGROUND.JS: ДАННЫЕ УВЕДОМЛЕНИЯ:', notificationOptions);
                }
                
                chrome.notifications.create(notificationOptions, (id) => {
                    if (chrome.runtime.lastError) {
                        Utils.error('🌐 GLOBAL: Ошибка при создании уведомления:', chrome.runtime.lastError);
                        resolve(null);
                        return;
                    }
                    
                    Utils.log(`🌐 GLOBAL: Глобальное уведомление создано с ID: ${id}`);
                    currentNotificationId = id;
                    
                    notificationsMap[id] = {
                        data: data,
                        timeout: notificationTimeout,
                        isGlobal: true // Флаг для обозначения глобального уведомления
                    };
                    
                    notificationsMap[id].id = id;
                    
                    // Для уведомлений тестирования не устанавливаем автоматическое закрытие
                    if (data.type !== 'testing') {
                        notificationsMap[id].timeoutId = setTimeout(() => {
                            Utils.log(`🌐 GLOBAL: Автоматическое закрытие глобального уведомления ${id}`);
                            chrome.notifications.clear(id);
                            if (notificationsMap[id]) {
                                delete notificationsMap[id];
                            }
                        }, notificationTimeout);
                    } else {
                        Utils.log('🌐 GLOBAL: Уведомление тестирования создано без автоматического закрытия');
                        logTesting('🌐 GLOBAL: Уведомление тестирования создано без автоматического закрытия');
                    }
                    
                    resolve(id);
                });
            } catch (error) {
                Utils.error('🌐 GLOBAL: Ошибка при создании уведомления:', error);
                resolve(null);
            }
        });
    });
}

function processSearchResults(data, url, title, sendResponse) {
    Utils.log('Обработка результатов поиска:', data);
    
    if (!data) {
        Utils.warn('Нет данных для обработки');
        sendResponse({ success: false, error: 'Нет данных для обработки' });
        return;
    }
    
    const notificationData = {
        title: title || 'Результаты поиска',
        message: `Найдены результаты поиска для ${url}`,
        ...data
    };
    
    const notificationId = createSimpleNotification(notificationData);
    
    sendResponse({ success: true, notificationId: notificationId });
}

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.tabs.create({
            url: chrome.runtime.getURL('info.html'),
            active: true
        });
        Utils.log('Расширение установлено, открываю info.html');
    } else if (details.reason === 'update') {
        chrome.tabs.create({
            url: chrome.runtime.getURL('info.html'),
            active: true
        });
        Utils.log('Расширение обновлено до версии', chrome.runtime.getManifest().version, 'открываю info.html');
    }
});

// Обработчики для сброса состояния при обновлении вкладок
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Сбрасываем состояние поиска при обновлении вкладки
    if (changeInfo.status === 'loading') {
        resetSearchState();
        Utils.log('Background: вкладка обновляется, состояние поиска сброшено');
        
        // Автопоиски завершаются без установки флагов (как автопоиск пресетов)
    }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    // Сбрасываем состояние поиска при закрытии вкладки
    resetSearchState();
    Utils.log('Background: вкладка закрыта, состояние поиска сброшено');
    
    // Проверяем, есть ли активные уведомления тестирования и последних заказов
    chrome.notifications.getAll((allNotifications) => {
        Object.keys(allNotifications).forEach((notificationId) => {
            const notificationData = notificationsMap[notificationId];
            if (notificationData && notificationData.data && notificationData.data.type === 'testing') {
                Utils.log('�� NOTIFICATION: Обнаружено уведомление тестирования при закрытии вкладки, оставляем его открытым');
                logTesting('🔔 Обнаружено уведомление тестирования при закрытии вкладки, оставляем его открытым');
            } else if (notificationData && notificationData.data && notificationData.data.type === 'last_orders') {
                Utils.log('🔔 NOTIFICATION: Обнаружено уведомление последних заказов при закрытии вкладки, оставляем его открытым');
                logLastOrders('🔔 Обнаружено уведомление последних заказов при закрытии вкладки, оставляем его открытым');
            }
        });
    });
});

// Сброс состояния при перезапуске расширения
chrome.runtime.onStartup.addListener(() => {
    resetSearchState();
    Utils.log('Background: расширение запущено, состояние поиска сброшено');
});

// Обработчик кликов по уведомлениям
chrome.notifications.onClicked.addListener((notificationId) => {
    Utils.log('🌐 GLOBAL: Клик по глобальному уведомлению:', notificationId);
    
    const notificationData = notificationsMap[notificationId];
    if (notificationData && notificationData.data && notificationData.data.type === 'testing') {
        Utils.log('🌐 GLOBAL: Закрываем глобальное уведомление тестирования по клику');
        logTesting('🌐 GLOBAL: Закрываем глобальное уведомление тестирования по клику');
        
        chrome.notifications.clear(notificationId);
        if (notificationsMap[notificationId]) {
            delete notificationsMap[notificationId];
        }
    } else if (notificationData && notificationData.data && notificationData.data.type === 'last_orders') {
        Utils.log('🌐 GLOBAL: Закрываем глобальное уведомление последних заказов по клику');
        logLastOrders('🌐 GLOBAL: Закрываем глобальное уведомление последних заказов по клику');
        
        chrome.notifications.clear(notificationId);
        if (notificationsMap[notificationId]) {
            delete notificationsMap[notificationId];
        }
    }
});

// Обработчик закрытия уведомлений
chrome.notifications.onClosed.addListener((notificationId, byUser) => {
    Utils.log('🌐 GLOBAL: Глобальное уведомление закрыто:', notificationId, 'пользователем:', byUser);
    
    if (notificationsMap[notificationId]) {
        delete notificationsMap[notificationId];
    }
});