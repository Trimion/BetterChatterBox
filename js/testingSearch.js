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

// Используем строгий режим
"use strict";

/**
 * Функция для запуска поиска номера ВУ на текущей странице
 * Использует тот же механизм поиска, что и Alt+A, но без уведомлений
 */
export function performTestingSearch() {
    // Получаем активную вкладку
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            // Проверяем, можно ли выполнить скрипт на текущей странице
            const url = tabs[0].url;
            if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://') || url.startsWith('about:')) {
                console.error('Невозможно выполнить скрипт на системной странице браузера');
                return;
            }
            
            // Отправляем сообщение в content скрипт
            chrome.tabs.sendMessage(tabs[0].id, { action: 'runTestingSearch' }, (response) => {
                if (chrome.runtime.lastError) {
                    // Если content скрипт не загружен, загружаем его
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        files: ['js/content.js']
                    }, (results) => {
                        if (chrome.runtime.lastError) {
                            console.error('Ошибка при загрузке content скрипта:', chrome.runtime.lastError.message);
                            return;
                        }
                        
                        // После загрузки content скрипта отправляем сообщение снова
                        setTimeout(() => {
                            chrome.tabs.sendMessage(tabs[0].id, { action: 'runTestingSearch' }, (response) => {
                                if (chrome.runtime.lastError) {
                                    console.error('Ошибка при отправке сообщения в content скрипт:', chrome.runtime.lastError.message);
                                }
                            });
                        }, 500);
                    });
                }
            });
        }
    });
} 