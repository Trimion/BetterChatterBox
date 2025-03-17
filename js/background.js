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
import { performTestingSearch } from './testingSearch.js';

console.log('Инициализация обработчиков уведомлений...');

if (chrome.notifications) {
    console.log('Chrome API для уведомлений доступен');
    
    chrome.notifications.getPermissionLevel((level) => {
        console.log('Уровень разрешений для уведомлений:', level);
        if (level !== 'granted') {
            console.error('Уведомления не разрешены в Chrome. Уровень разрешений:', level);
        }
    });
} else {
    console.error('Chrome API для уведомлений недоступен');
}

chrome.permissions.contains({ permissions: ['notifications'] }, (result) => {
    if (result) {
        console.log('Разрешение на отправку уведомлений получено');
    } else {
        console.error('Разрешение на отправку уведомлений не получено');
    }
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    console.log(`Нажата кнопка ${buttonIndex} в уведомлении ${notificationId}`);
    
    if (notificationsMap[notificationId] && notificationsMap[notificationId].data) {
        const notificationData = notificationsMap[notificationId].data;
        const buttons = getNotificationButtons(notificationData);
        
        if (buttonIndex >= 0 && buttonIndex < buttons.length) {
            const button = buttons[buttonIndex];
            let dataToCopy = null;
            
            if (button.title === 'Номер ВУ') {
                dataToCopy = notificationData.driverLicense;
                console.log(`Копирование номера ВУ из background.js: ${dataToCopy}`);
            } else if (button.title === 'Страна') {
                dataToCopy = notificationData.country;
                console.log(`Копирование страны из background.js: ${dataToCopy}`);
            }
            
            if (dataToCopy) {
                executeScript(null, dataToCopy, () => {
                    console.log(`Данные "${dataToCopy}" скопированы из background.js`);
                });
            }
        }
    }
    
    handleButtonClicked(notificationId, buttonIndex);
});

chrome.notifications.onClosed.addListener((notificationId, byUser) => {
    console.log(`Уведомление ${notificationId} закрыто ${byUser ? 'пользователем' : 'системой'}`);
    if (notificationsMap[notificationId]) {
        delete notificationsMap[notificationId];
    }
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, { 
                action: 'notificationClosed', 
                notificationId: notificationId 
            });
        }
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

let notificationsMap = {};
let NotificationTimeout = 54000;
let lastNotificationTime = 0;
let currentNotificationId = null;
let previousTabUrl = '';
let testingResultsTabId = null;

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
    console.log('Получено сообщение в background.js:', request);
    try {
        if (request.action === 'createNotification') {
            console.log('Получен запрос на создание уведомления:', request.data);
            
            const notificationId = createSimpleNotification(request.data, request.timeout);
            console.log('Создано уведомление с ID:', notificationId);
            sendResponse({ notificationId: notificationId });
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
            performButtonSearch(request.url);
            sendResponse({ success: true });
        } else if (request.action === 'startTesting') {
            try {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs.length > 0) {
                        const url = tabs[0].url;
                        if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://') || url.startsWith('about:')) {
                            console.error('Невозможно выполнить скрипт на системной странице браузера');
                            sendResponse({ success: false, error: 'Невозможно выполнить скрипт на системной странице браузера' });
                            return;
                        }
                        
                        performTestingSearch();
                        sendResponse({ success: true });
                    } else {
                        console.error('Нет активной вкладки');
                        sendResponse({ success: false, error: 'Нет активной вкладки' });
                    }
                });
            } catch (error) {
                console.error('Ошибка при выполнении команды startTesting:', error);
                sendResponse({ success: false, error: error.message });
            }
            return true;
        } else if (request.action === 'openResultsPage') {
            chrome.tabs.create({ 
                url: 'https://education.taxi.yandex/export-results',
                active: false
            }, (resultTab) => {
                testingResultsTabId = resultTab.id;
                
                chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                    if (tabId === resultTab.id && changeInfo.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        
                        chrome.scripting.executeScript({
                            target: { tabId: resultTab.id },
                            function: (driverLicense) => {
                                const waitForElement = (selector, timeout = 4500) => {
                                    return new Promise((resolve, reject) => {
                                        const startTime = Date.now();
                                        
                                        const checkElement = () => {
                                            const element = document.querySelector(selector);
                                            if (element) {
                                                resolve(element);
                                            } else if (Date.now() - startTime > timeout) {
                                                reject(new Error(`Элемент ${selector} не найден за ${timeout}мс`));
                                            } else {
                                                setTimeout(checkElement, 90);
                                            }
                                        };
                                        
                                        checkElement();
                                    });
                                };
                                
                                const waitForTable = () => {
                                    return new Promise((resolve, reject) => {
                                        const startTime = Date.now();
                                        const timeout = 9000;
                                        
                                        const checkTable = () => {
                                            try {
                                                const table = document.querySelector('table.list-table');
                                                const rows = table ? table.querySelectorAll('tbody tr.list-table-item') : null;
                                                
                                                if (table && rows && rows.length > 0) {
                                                    console.log('Таблица с результатами найдена!');
                                                    resolve(rows);
                                                } else if (Date.now() - startTime > timeout) {
                                                    reject(new Error(`Таблица не загрузилась за ${timeout}мс`));
                                                } else {
                                                    setTimeout(checkTable, 180);
                                                }
                                            } catch (error) {
                                                console.error('Ошибка при проверке таблицы:', error);
                                                reject(error);
                                            }
                                        };
                                        
                                        checkTable();
                                    });
                                };
                                
                                (async () => {
                                    try {
                                        console.log('Ожидание прогрузки поля поиска...');
                                        const searchInput = await waitForElement('input.form-control');
                                        console.log('Поле поиска найдено');
                                        
                                        const searchButton = await waitForElement('button.btn.btn-default-fr');
                                        console.log('Кнопка "Найти" найдена');
                                        
                                        searchInput.click();
                                        searchInput.value = driverLicense;
                                        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                                        
                                        searchButton.click();
                                        console.log('Кнопка "Найти" нажата');
                                        
                                        console.log('Ожидание загрузки таблицы...');
                                        const rows = await waitForTable();
                                        
                                        const results = [];
                                        const priorityResults = [];
                                        const otherResults = [];
                                        
                                        const priorityValues = ['delivery', 'weight_surcharge', 'delivery_slot', 'cargo', 'cargo_expeditor'];
                                        
                                        rows.forEach(row => {
                                            const columns = row.querySelectorAll('td.list-table-item__col');
                                            if (columns.length >= 2) {
                                                const courseName = columns[0].querySelector('.list-table-item__col-i').textContent.trim();
                                                const score = columns[1].querySelector('.list-table-item__col-i').textContent.trim();
                                                const resultString = `${courseName} ${score}`;
                                                
                                                let isPriority = false;
                                                for (const priorityValue of priorityValues) {
                                                    if (courseName.toLowerCase().includes(priorityValue.toLowerCase())) {
                                                        priorityResults.push(resultString);
                                                        isPriority = true;
                                                        break;
                                                    }
                                                }
                                                
                                                if (!isPriority) {
                                                    otherResults.push(resultString);
                                                }
                                            }
                                        });
                                        
                                        const allResults = [...priorityResults, ...otherResults];
                                        
                                        if (allResults.length > 0) {
                                            console.log('Найдены результаты тестирования:', allResults);
                                            
                                            chrome.runtime.sendMessage({
                                                action: 'showTestingResults',
                                                results: allResults
                                            }, (response) => {
                                                if (chrome.runtime.lastError) {
                                                    console.error('Ошибка при отправке результатов:', chrome.runtime.lastError.message);
                                                } else {
                                                    console.log('Результаты успешно отправлены:', response);
                                                }
                                            });
                                        } else {
                                            console.error('Данные в таблице не найдены');
                                            
                                            chrome.runtime.sendMessage({
                                                action: 'showTestingResults',
                                                results: ['Данные в таблице не найдены']
                                            });
                                        }
                                    } catch (error) {
                                        console.error('Ошибка при выполнении скрипта:', error);
                                        
                                        chrome.runtime.sendMessage({
                                            action: 'showTestingResults',
                                            results: ['Ошибка при получении результатов тестирования: ' + error.message]
                                        });
                                    }
                                })();
                            },
                            args: [request.driverLicense]
                        }, (results) => {
                            if (chrome.runtime.lastError) {
                                console.error('Ошибка при выполнении скрипта:', chrome.runtime.lastError.message);
                                chrome.runtime.sendMessage({
                                    action: 'showTestingResults',
                                    results: ['Ошибка при выполнении скрипта: ' + chrome.runtime.lastError.message]
                                });
                            }
                        });
                    }
                });
            });
            sendResponse({ success: true });
        } else if (request.action === 'showTestingResults') {
            if (!request.results || !Array.isArray(request.results) || request.results.length === 0) {
                console.error('Ошибка: результаты тестирования пустые или некорректные!', request.results);
                closeTestingResultsTab();
                sendResponse({ success: false, error: 'Результаты тестирования пустые или некорректные' });
                return;
            }
            
            console.log('Получены результаты тестирования:', request.results);
            
            const notificationData = {
                type: 'testing',
                title: 'Результаты тестирования',
                message: request.results.join('\n')
            };
            
            chrome.storage.local.get(['showNotifications'], ({ showNotifications }) => {
                if (showNotifications === false) {
                    console.log('Уведомления отключены в настройках');
                    closeTestingResultsTab();
                    return;
                }
                
                try {
                    clearNotification();
                    
                    const resultsArray = notificationData.message.split('\n');
                    
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
                    
                    let notificationHTML = `
                        <div class="notification-container testing-notification">
                            <div class="notification-header">
                                <div class="notification-title">${notificationData.title}</div>
                                <div class="notification-close" id="notification-close">×</div>
                            </div>
                            <div class="notification-content">
                                <div class="notification-results">
                                    <div class="notification-column">
                    `;
                    
                    for (const item of leftColumn) {
                        notificationHTML += `
                            <div class="notification-result-item">
                                <div class="notification-result-course">${item.course}</div>
                                <div class="notification-result-score">${item.score}</div>
                            </div>
                        `;
                    }
                    
                    notificationHTML += `
                                    </div>
                                    <div class="notification-column">
                    `;
                    
                    for (const item of rightColumn) {
                        notificationHTML += `
                            <div class="notification-result-item">
                                <div class="notification-result-course">${item.course}</div>
                                <div class="notification-result-score">${item.score}</div>
                            </div>
                        `;
                    }
                    
                    notificationHTML += `
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    createSimpleNotification(notificationData, 60000);
                    
                    closeTestingResultsTab();
                } catch (error) {
                    console.error('Ошибка при создании уведомления:', error);
                    closeTestingResultsTab();
                }
            });
            
            sendResponse({ success: true });
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
        } else {
            console.warn('Неизвестное действие:', request.action);
            sendResponse({ error: 'Неизвестное действие' });
        }
    } catch (error) {
        console.error('Ошибка при обработке сообщения:', error);
        sendResponse({ error: error.message });
    }
    return true;
});

chrome.commands.onCommand.addListener((command) => {
    console.log('Получена команда:', command);
    
    if (command === 'run_extension') {
        chrome.storage.local.get(['searchDriverInfo', 'searchPreset1', 'searchPreset2', 'searchPreset3', 'searchPreset1Enabled', 'searchPreset2Enabled', 'searchPreset3Enabled'], (settings) => {
            const presets = [];
            if (settings.searchPreset1Enabled !== false) presets.push(settings.searchPreset1 || 'tags');
            if (settings.searchPreset2Enabled !== false) presets.push(settings.searchPreset2 || 'profession');
            if (settings.searchPreset3Enabled !== false) presets.push(settings.searchPreset3 || 'customTags1');
            
            const isProfessionSearchEnabled = presets.includes('profession');
            
            if (settings.searchDriverInfo === false && !isProfessionSearchEnabled) {
                console.log('Поиск страны отключен в настройках и нет поиска профессии. Команда Alt+A не будет выполнена.');
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
                            console.log("Нет активной вкладки");
                        }
                    });
                } else {
                    console.log("Нет окна в фокусе");
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
    } else if (command === 'search_button') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    function: () => {
                        const buttons = document.querySelectorAll('a');
                        let driverLink = null;
                        
                        buttons.forEach(button => {
                            if (button && 
                                button.textContent.includes('Водитель') &&
                                button.href.includes('pro-admin-frontend-external.taxi.yandex-team.ru/show-driver/iframe/')) {
                                driverLink = button.href;
                            }
                        });
                        
                        if (driverLink) {
                            return driverLink;
                        }
                    }
                }, (results) => {
                    if (results && results[0] && results[0].result) {
                        const driverUrl = results[0].result;
                        
                        performButtonSearch(driverUrl);
                    }
                });
            }
        });
    } else if (command === 'run_testing') {
        try {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                    const url = tabs[0].url;
                    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://') || url.startsWith('about:')) {
                        console.error('Невозможно выполнить скрипт на системной странице браузера');
                        return;
                    }
                    
                    performTestingSearch();
                } else {
                    console.error('Нет активной вкладки');
                }
            });
        } catch (error) {
            console.error('Ошибка при выполнении команды run_testing:', error);
        }
    }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
    if (!activeInfo) return console.log('Нет информации о активной вкладке');
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
    clearNotification();
}

function executeAltA() {
    chrome.storage.local.get(['searchDriverInfo', 'searchPreset1', 'searchPreset2', 'searchPreset3', 'searchPreset1Enabled', 'searchPreset2Enabled', 'searchPreset3Enabled'], (settings) => {
        const presets = [];
        if (settings.searchPreset1Enabled !== false) presets.push(settings.searchPreset1 || 'tags');
        if (settings.searchPreset2Enabled !== false) presets.push(settings.searchPreset2 || 'profession');
        if (settings.searchPreset3Enabled !== false) presets.push(settings.searchPreset3 || 'customTags1');
        
        const isProfessionSearchEnabled = presets.includes('profession');
        
        if (settings.searchDriverInfo === false && !isProfessionSearchEnabled) {
            console.log('Поиск страны отключен в настройках и нет поиска профессии. Команда Alt+A не будет выполнена.');
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

function createSimpleNotification(data, notificationTimeout = 54000) {
    console.log('Создаем простое уведомление с данными:', data);
    
    chrome.storage.local.get(['showNotifications'], ({ showNotifications }) => {
        if (showNotifications === false) {
            console.log('Уведомления отключены в настройках');
            return;
        }
        
        try {
            if (!data) {
                throw new Error('Данные уведомления не переданы');
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
            } else {
                const countryCode = (data.country || 'unknown').toLowerCase();
                
                const iconUrl = getNotificationIcon(data.country);
                console.log('Получен URL иконки флага:', iconUrl);
                
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
            }
            
            chrome.notifications.create(notificationOptions, (id) => {
                if (chrome.runtime.lastError) {
                    console.error('Ошибка при создании уведомления:', chrome.runtime.lastError);
                    return null;
                }
                
                console.log(`Уведомление создано с ID: ${id}`);
                currentNotificationId = id;
                
                notificationsMap[id] = {
                    data: data,
                    timeoutId: setTimeout(() => {
                        chrome.notifications.clear(id);
                        if (notificationsMap[id]) {
                            delete notificationsMap[id];
                        }
                    }, notificationTimeout),
                    timeout: notificationTimeout
                };
                
                notificationsMap[id].id = id;
                
                if (notificationsMap[id].timeoutId) {
                    clearTimeout(notificationsMap[id].timeoutId);
                }
                
                return id;
            });
        } catch (error) {
            console.error('Ошибка при создании уведомления:', error);
            return null;
        }
    });
    
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function processSearchResults(data, url, title, sendResponse) {
    console.log('Обработка результатов поиска:', data);
    
    if (!data) {
        console.warn('Нет данных для обработки');
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
        console.log('Расширение установлено, открываю info.html');
    } else if (details.reason === 'update') {
        chrome.tabs.create({
            url: chrome.runtime.getURL('info.html'),
            active: true
        });
        console.log('Расширение обновлено до версии', chrome.runtime.getManifest().version, 'открываю info.html');
    }
});

function closeTestingResultsTab() {
    if (testingResultsTabId) {
        const tabId = parseInt(testingResultsTabId);
        if (isNaN(tabId)) {
            console.warn('Некорректный ID вкладки:', testingResultsTabId);
            testingResultsTabId = null;
            return;
        }

        setTimeout(() => {
            try {
                chrome.tabs.get(tabId, (tab) => {
                    if (chrome.runtime.lastError) {
                        console.warn('Вкладка уже закрыта или не существует:', chrome.runtime.lastError.message);
                        testingResultsTabId = null;
                        return;
                    }

                    chrome.tabs.remove(tabId, () => {
                        if (chrome.runtime.lastError) {
                            console.warn('Ошибка при закрытии вкладки:', chrome.runtime.lastError.message);
                        } else {
                            console.log('Вкладка с результатами тестирования закрыта');
                        }
                        testingResultsTabId = null;
                    });
                });
            } catch (error) {
                console.error('Ошибка при закрытии вкладки:', error);
                testingResultsTabId = null;
            }
        }, 500);
    }
} 