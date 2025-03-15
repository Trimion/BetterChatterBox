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

document.addEventListener('DOMContentLoaded', () => {
  const openOptionsButton = document.getElementById('openOptions');
  const searchButton = document.getElementById('searchButton');
  const clearNotificationsButton = document.getElementById('clearNotifications');
  const scanButton = document.getElementById('scanButton');
  
  // Элементы меню сканирования
  const mainMenu = document.getElementById('mainMenu');
  const scanMenu = document.getElementById('scanMenu');
  const backButton = document.querySelector('.back-button');
  const testingButton = document.getElementById('testingButton');
  const photoControlButton = document.getElementById('photoControlButton');
  const tariffsBlocksButton = document.getElementById('tariffsBlocksButton');

  // Открываем страницу настроек при клике на кнопку
  openOptionsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Обработчик для кнопки сброса уведомлений
  clearNotificationsButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'clearNotification' });
  });

  // Обработчик для кнопки сканирования - открываем меню сканирования
  scanButton.addEventListener('click', () => {
    mainMenu.style.display = 'none';
    scanMenu.style.display = 'block';
  });
  
  // Возврат в главное меню при клике на кнопку назад
  backButton.addEventListener('click', () => {
    scanMenu.style.display = 'none';
    mainMenu.style.display = 'block';
  });
  
  // Обработчики для кнопок внутри меню сканирования
  testingButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'startTesting' });
    scanMenu.style.display = 'none';
    mainMenu.style.display = 'block';
  });
  
  photoControlButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'startPhotoControl' });
    scanMenu.style.display = 'none';
    mainMenu.style.display = 'block';
  });
  
  tariffsBlocksButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'startTariffsBlocks' });
    scanMenu.style.display = 'none';
    mainMenu.style.display = 'block';
  });

  // Обработчик для кнопки поиска
  searchButton.addEventListener('click', () => {
    // Получаем активную вкладку
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        // Сначала находим и кликаем на ссылку "Водитель"
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
            
            // Открываем вкладку в фоне и отправляем сообщение в background script
            chrome.runtime.sendMessage({
              action: 'startSearch',
              url: driverUrl
            });
          }
        });
      }
    });
  });
});

// Добавляем обработчик горячих клавиш (Alt+Shift+X)
document.addEventListener('keydown', (event) => {
  if (event.altKey && event.shiftKey && event.code === 'KeyX') {
    chrome.runtime.sendMessage({ action: 'clearNotification' });
  }
});