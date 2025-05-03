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

// Перехватываем нативные методы консоли
(function() {
  // Сохраняем оригинальные методы
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  
  // Заменяем методы на наши с проверкой настройки логирования
  console.log = function(...args) {
    chrome.storage.local.get(['loggingEnabled'], (result) => {
      if (result.loggingEnabled) {
        originalConsoleLog.apply(console, args);
      }
    });
  };
  
  console.warn = function(...args) {
    chrome.storage.local.get(['loggingEnabled'], (result) => {
      if (result.loggingEnabled) {
        originalConsoleWarn.apply(console, args);
      }
    });
  };
  
  console.error = function(...args) {
    chrome.storage.local.get(['loggingEnabled'], (result) => {
      if (result.loggingEnabled) {
        originalConsoleError.apply(console, args);
      }
    });
  };
})();

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
        chrome.storage.local.get(['loggingEnabled'], (logResult) => {
          if (logResult.loggingEnabled) {
            console.log('Уведомления отключены в настройках. Уведомление не будет создано.');
          }
        });
        resolve(null);
        return;
      }
      
      // Далее оригинальная логика создания уведомления
      if (!data) {
        chrome.storage.local.get(['loggingEnabled'], (result) => {
          if (result.loggingEnabled) {
            console.log('Данные уведомления не переданы');
          }
        });
        resolve(null);
        return;
      }
      
      if (isNotificationBlocked) {
        chrome.storage.local.get(['loggingEnabled'], (result) => {
          if (result.loggingEnabled) {
            console.log('Создание уведомлений временно заблокировано');
          }
        });
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
            chrome.storage.local.get(['loggingEnabled'], (result) => {
              if (result.loggingEnabled) {
                console.error('Ошибка при создании уведомления:', chrome.runtime.lastError);
              }
            });
            resolve(null);
            return;
          }
          
          chrome.storage.local.get(['loggingEnabled'], (result) => {
            if (result.loggingEnabled) {
              console.log(`Уведомление создано с ID: ${createdId}`);
            }
            currentNotificationId = createdId;
            
            setupNotification(createdId, data, notificationTimeout);
            resolve(createdId);
          });
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
            chrome.storage.local.get(['loggingEnabled'], (result) => {
              if (result.loggingEnabled) {
                console.error('Ошибка при создании уведомления:', chrome.runtime.lastError);
              }
            });
            resolve(null);
            return;
          }
          
          chrome.storage.local.get(['loggingEnabled'], (result) => {
            if (result.loggingEnabled) {
              console.log(`Уведомление создано с ID: ${createdId}`);
            }
            currentNotificationId = createdId;
            
            setupNotification(createdId, data, notificationTimeout);
            resolve(createdId);
          });
        });
      } else {
        let existingNotificationId = null;
        Object.keys(notificationsData).forEach((id) => {
          if (notificationsData[id]?.data?.ticketId === data.ticketId) {
            existingNotificationId = id;
          }
        });
        
        if (existingNotificationId) {
          console.log(`Найдено существующее уведомление для тикета #${data.ticketId}, обновляем его`);
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
        
        notificationsData[notificationId] = {
          data: data,
          timestamp: Date.now(),
          timeout: notificationTimeout
        };
        
        chrome.notifications.create(notificationId, notificationData, (createdId) => {
          if (chrome.runtime.lastError) {
            chrome.storage.local.get(['loggingEnabled'], (result) => {
              if (result.loggingEnabled) {
                console.error('Ошибка при создании уведомления:', chrome.runtime.lastError);
              }
            });
            resolve(null);
            return;
          }
          
          chrome.storage.local.get(['loggingEnabled'], (result) => {
            if (result.loggingEnabled) {
              console.log(`Уведомление создано с ID: ${createdId}`);
            }
            currentNotificationId = createdId;
            
            setupNotification(createdId, data, notificationTimeout);
            resolve(createdId);
          });
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
    chrome.storage.local.get(['loggingEnabled'], (result) => {
      if (result.loggingEnabled) {
        console.error('Ошибка при получении иконки уведомления:', error);
      }
    });
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
        chrome.storage.local.get(['loggingEnabled'], (logResult) => {
          if (logResult.loggingEnabled) {
            console.log('Уведомления отключены в настройках. Уведомление не будет обновлено.');
          }
        });
        resolve(false);
        return;
      }
      
      // Далее оригинальная логика обновления уведомления
      if (!notificationId || !newData) {
        resolve(false);
        return;
      }
      
      if (!notificationsData[notificationId]) {
        console.log(`Уведомление с ID ${notificationId} не найдено в хранилище для обновления`);
        resolve(false);
        return;
      }
      
      // Получаем существующие данные и объединяем их с новыми
      const existingData = notificationsData[notificationId].data;
      const mergedData = { ...existingData, ...newData };
      
      chrome.storage.local.get(['loggingEnabled'], (result) => {
        if (result.loggingEnabled) {
          console.log('Обновление уведомления. Существующие данные:', existingData);
          console.log('Новые данные:', newData);
          console.log('Объединенные данные:', mergedData);
        }
      });
      
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
            console.log(`Создано новое уведомление с ID ${newId} для обновления старого ${notificationId}`);
            resolve(true);
          } else {
            console.log(`Не удалось создать новое уведомление для обновления ${notificationId}`);
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
            console.error('Ошибка при обновлении уведомления:', chrome.runtime.lastError);
            resolve(false);
            return;
          }
          
          if (updated) {
            console.log(`Уведомление с ID ${notificationId} успешно обновлено`);
            resolve(true);
          } else {
            console.log(`Уведомление с ID ${notificationId} не найдено для обновления`);
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
        chrome.storage.local.get(['loggingEnabled'], (result) => {
          if (result.loggingEnabled) {
            console.log(`Пропускаем очистку уведомления ${id} типа testing`);
          }
        });
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
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length > 0) {
            // Пытаемся найти поле для ввода внутреннего комментария и записать в него текст уведомления
            writeNotificationToComment(tabs[0].id, data);
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
        chrome.storage.local.get(['loggingEnabled'], (result) => {
            if (result.loggingEnabled) {
                console.log('Ошибка при генерации кнопок уведомления:', error);
            }
        });
        return [];
    }
}

function handleButtonClicked(notificationId, buttonIndex) {
    chrome.storage.local.get(['loggingEnabled'], (result) => {
        if (result.loggingEnabled) {
            console.log(`Нажата кнопка ${buttonIndex} в уведомлении ${notificationId}`);
        }
        
        const notificationData = notificationsData[notificationId];
        if (!notificationData) {
            if (result.loggingEnabled) {
                console.log(`Уведомление с ID ${notificationId} не найдено или данные пусты`);
            }
            return;
        }
        
        const buttons = getNotificationButtons(notificationData);
        if (buttonIndex >= 0 && buttonIndex < buttons.length) {
            const button = buttons[buttonIndex];
            let dataToCopy = null;
            
            if (button.title === 'Номер ВУ') {
                dataToCopy = notificationData.driverLicense;
                chrome.storage.local.get(['loggingEnabled'], (result) => {
                    if (result.loggingEnabled) {
                        console.log(`Копирование номера ВУ: ${dataToCopy}`);
                    }
                });
            } else if (button.title === 'Страна') {
                dataToCopy = notificationData.country;
                chrome.storage.local.get(['loggingEnabled'], (result) => {
                    if (result.loggingEnabled) {
                        console.log(`Копирование страны: ${dataToCopy}`);
                    }
                });
            }
            
            if (dataToCopy) {
                executeScript(null, dataToCopy, () => {
                    chrome.storage.local.get(['loggingEnabled'], (result) => {
                        if (result.loggingEnabled) {
                            console.log(`Данные "${dataToCopy}" успешно скопированы`);
                        }
                        
                        // Обновляем контекст уведомления
                        updateNotificationContext(notificationId, notificationData);
                    });
                });
            } else {
                chrome.storage.local.get(['loggingEnabled'], (result) => {
                    if (result.loggingEnabled) {
                        console.log('Данные для копирования не найдены');
                    }
                });
            }
        }
    });
}

function copyToClipboard(text) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            chrome.storage.local.get(['loggingEnabled'], (result) => {
                if (result.loggingEnabled) {
                    console.log('Нет активной вкладки');
                }
            });
            return;
        }
        
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (text) => {
                return new Promise((resolve) => {
                    navigator.clipboard.writeText(text)
                        .then(() => {
                            chrome.storage.local.get(['loggingEnabled'], (result) => {
                                if (result.loggingEnabled) {
                                    console.log('Текст скопирован в буфер обмена:', text);
                                }
                                resolve(true);
                            });
                        })
                        .catch((error) => {
                            chrome.storage.local.get(['loggingEnabled'], (result) => {
                                if (result.loggingEnabled) {
                                    console.error('Ошибка при копировании текста:', error);
                                }
                                resolve(false);
                            });
                        });
                });
            },
            args: [text]
        });
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
                        chrome.storage.local.get(['loggingEnabled'], (result) => {
                            if (result.loggingEnabled) {
                                console.log(`Ошибка обновления уведомления ${notificationId}`);
                            }
                        });
                    } else {
                        chrome.storage.local.get(['loggingEnabled'], (result) => {
                            if (result.loggingEnabled) {
                                console.log(`Уведомление ${notificationId} обновлено`);
                            }
                            notificationsData[notificationId].timeoutId = setTimeout(() => {
                                clearNotification();
                            }, timeout);
                        });
                    }
                });
            } else {
                chrome.storage.local.get(['loggingEnabled'], (result) => {
                    if (result.loggingEnabled) {
                        console.log(`Timeout для уведомления ${notificationId} не установлен`);
                    }
                });
            }
        } else {
            chrome.storage.local.get(['loggingEnabled'], (result) => {
                if (result.loggingEnabled) {
                    console.log(`Уведомление с ID ${notificationId} не найдено`);
                }
            });
        }
    });
}

function executeScript(tabId, data, callback) {
    chrome.storage.local.get(['loggingEnabled'], (result) => {
        if (result.loggingEnabled) {
            console.log(`Попытка копирования данных: "${data}"`);
        }
        
        chrome.windows.getLastFocused((window) => {
            chrome.tabs.query({ active: true, windowId: window.id }, (tabs) => {
                if (tabs.length === 0) {
                    if (result.loggingEnabled) {
                        console.log('Нет активных вкладок');
                    }
                    return;
                }
                const activeTab = tabs[0];
                
                chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    func: (textToCopy) => {
                        return new Promise((resolve) => {
                            navigator.clipboard.writeText(textToCopy)
                                .then(() => {
                                    chrome.storage.local.get(['loggingEnabled'], (result) => {
                                        if (result.loggingEnabled) {
                                            console.log(`Данные "${textToCopy}" скопированы в буфер обмена через API`);
                                        }
                                        resolve(true);
                                    });
                                })
                                .catch(err => {
                                    chrome.storage.local.get(['loggingEnabled'], (result) => {
                                        if (result.loggingEnabled) {
                                            console.error('Ошибка при копировании через API:', err);
                                        }
                                        
                                        // Альтернативный метод копирования
                                        const textarea = document.createElement('textarea');
                                        textarea.value = textToCopy;
                                        textarea.style.position = 'fixed';
                                        textarea.style.opacity = '0';
                                        document.body.appendChild(textarea);
                                        textarea.focus();
                                        textarea.select();
                                        const successful = document.execCommand('copy');
                                        document.body.removeChild(textarea);
                                        
                                        if (successful) {
                                            if (result.loggingEnabled) {
                                                console.log(`Данные "${textToCopy}" скопированы альтернативным методом`);
                                            }
                                            resolve(true);
                                        } else {
                                            if (result.loggingEnabled) {
                                                console.error('Альтернативный метод копирования не сработал');
                                            }
                                            resolve(false);
                                        }
                                    });
                                });
                        });
                    },
                    args: [data]
                }, (results) => {
                    chrome.storage.local.get(['loggingEnabled'], (result) => {
                        if (chrome.runtime.lastError) {
                            if (result.loggingEnabled) {
                                console.error('Ошибка при выполнении скрипта:', chrome.runtime.lastError);
                            }
                        } else if (results && results[0]) {
                            if (result.loggingEnabled) {
                                console.log('Скрипт выполнен успешно, результат:', results[0].result);
                            }
                        } else {
                            if (result.loggingEnabled) {
                                console.log('Скрипт выполнен, но результат неизвестен');
                            }
                        }
                        
                        if (typeof callback === 'function') {
                            callback();
                        }
                    });
                });
            });
        });
    });
}

function clearNotification() {
    try {
        chrome.storage.local.get(['loggingEnabled'], (result) => {
            if (result.loggingEnabled) {
                console.log('Очищаем все уведомления');
            }
            
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.notifications.getAll((allNotifications) => {
                    Object.keys(allNotifications).forEach((notificationId) => {
                        const notificationData = notificationsData[notificationId];
                        if (notificationData && notificationData.data && notificationData.data.type === 'testing') {
                            if (result.loggingEnabled) {
                                console.log(`Пропускаем уведомление ${notificationId} типа testing`);
                            }
                            return;
                        }
                        
                        chrome.notifications.clear(notificationId, (wasCleared) => {
                            if (!wasCleared) {
                                if (result.loggingEnabled) {
                                    console.log(`Ошибка при удалении уведомления ${notificationId}`);
                                }
                            } else {
                                if (result.loggingEnabled) {
                                    console.log(`Уведомление ${notificationId} удалено`);
                                }
                                if (tabs.length > 0) {
                                    chrome.tabs.sendMessage(tabs[0].id, {
                                        action: 'notificationClosed',
                                        notificationId: notificationId
                                    }).catch(error => {
                                        if (result.loggingEnabled) {
                                            console.log('Ошибка при отправке сообщения в content.js:', error);
                                        }
                                    });
                                }
                            }
                        });
                    });
                    
                    Object.keys(notificationsData).forEach((notificationId) => {
                        if (notificationsData[notificationId] !== undefined && notificationsData[notificationId] !== null) {
                            if (notificationsData[notificationId].data && notificationsData[notificationId].data.type === 'testing') {
                                if (result.loggingEnabled) {
                                    console.log(`Пропускаем уведомление ${notificationId} типа testing`);
                                }
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
                    
                    if (result.loggingEnabled) {
                        console.log('Все уведомления очищены');
                    }
                });
            });
        });
    } catch (error) {
        chrome.storage.local.get(['loggingEnabled'], (result) => {
            if (result.loggingEnabled) {
                console.error('Ошибка при очистке уведомлений:', error);
            }
        });
    }
}

function queueNotification(notificationData) {
  notificationQueue.push({
    data: notificationData,
    timestamp: Date.now(),
    timeout: NotificationTimeout
  });
  console.log(`Уведомление добавлено в очередь. Текущий размер очереди: ${notificationQueue.length}`);
}

function showQueuedNotifications() {
  // Проверяем состояние настройки уведомлений
  chrome.storage.local.get(['notifications'], (result) => {
    // Если уведомления отключены, очищаем очередь и выходим
    if (result.notifications === false) {
      chrome.storage.local.get(['loggingEnabled'], (logResult) => {
        if (logResult.loggingEnabled) {
          console.log('Уведомления отключены в настройках. Очередь уведомлений очищена.');
        }
      });
      notificationQueue = [];
      return;
    }
    
    // Если очередь пуста или загрузка ещё не завершена, выходим
    if (notificationQueue.length === 0 || !isLoadingComplete) {
      return;
    }

    // Получаем и удаляем первое уведомление из очереди
    const nextNotification = notificationQueue.shift();
    console.log(`Показываем отложенное уведомление из очереди. Осталось: ${notificationQueue.length}`);

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
 */
function writeNotificationToComment(tabId, data) {
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
    
    // Если комментарий пуст, прекращаем выполнение
    if (!comment) return;
  
    chrome.scripting.executeScript({
      target: { tabId },
      function: (comment) => {
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
            // Если текстовая область найдена, добавляем текст уведомления в конец с новой строки
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
            // Если текстовая область не найдена, показываем уведомление об ошибке
            chrome.runtime.sendMessage({
              action: 'createNotification',
              data: {
                type: 'basic',
                title: 'Ошибка',
                message: 'Поле для ввода не найдено!',
                iconUrl: chrome.runtime.getURL('img/128.png')
              }
            });
            
            return { success: false, message: 'Не удалось найти поле для ввода комментария' };
          }
        } catch (error) {
          console.error('Ошибка при записи в комментарий:', error);
          return { success: false, message: `Ошибка: ${error.message}` };
        }
      },
      args: [comment]
    }, (results) => {
      // Обрабатываем результаты выполнения скрипта
      if (chrome.runtime.lastError) {
        console.error('Ошибка при выполнении скрипта:', chrome.runtime.lastError);
      } else if (results && results[0] && results[0].result) {
        console.log('Результат записи в комментарий:', results[0].result);
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