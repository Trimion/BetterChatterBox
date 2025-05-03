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

document.addEventListener('DOMContentLoaded', () => {
  const openOptionsButton = document.getElementById('openOptions');
  const searchButton = document.getElementById('searchButton');
  const clearNotificationsButton = document.getElementById('clearNotifications');
  const scanButton = document.getElementById('scanButton');
  const smsButton = document.getElementById('smsButton');
  
  // Элементы меню сканирования
  const mainMenu = document.getElementById('mainMenu');
  const scanMenu = document.getElementById('scanMenu');
  const backButton = document.querySelector('.back-button');
  const testingButton = document.getElementById('testingButton');
  const photoControlButton = document.getElementById('photoControlButton');
  const tariffsBlocksButton = document.getElementById('tariffsBlocksButton');
  
  // Элементы меню СМС
  const smsMenu = document.getElementById('smsMenu');
  const backButtonSms = document.querySelector('.back-button-sms');
  const partDeliveryButton = document.getElementById('partDeliveryButton');
  const personalItemButton = document.getElementById('personalItemButton');
  const askToCloseButton = document.getElementById('askToCloseButton');
  const damagedItemButton = document.getElementById('damagedItemButton');
  const accidentButton = document.getElementById('accidentButton');
  
  // Элементы настройки СМС и модального окна
  const smsConfigModal = document.getElementById('smsConfigModal');
  const closeButton = document.querySelector('.close-button');
  const smsConfigTitle = document.getElementById('smsConfigTitle');
  const smsConfigText = document.getElementById('smsConfigText');
  const saveConfigButton = document.getElementById('saveConfigButton');
  
  // Иконки настройки для каждого типа СМС
  const partDeliveryConfig = document.getElementById('partDeliveryConfig');
  const personalItemConfig = document.getElementById('personalItemConfig');
  const askToCloseConfig = document.getElementById('askToCloseConfig');
  const damagedItemConfig = document.getElementById('damagedItemConfig');
  const accidentConfig = document.getElementById('accidentConfig');

  // Проверка флага открытия меню СМС (устанавливается через комбинацию клавиш)
  chrome.storage.local.get(['openSmsMenu'], (result) => {
    if (result.openSmsMenu) {
      // Открываем меню СМС
      mainMenu.style.display = 'none';
      smsMenu.style.display = 'block';
      
      // Сбрасываем флаг
      chrome.storage.local.remove('openSmsMenu');
    }
  });

  // URL для отправки СМС
  const smsUrl = 'https://external-admin-proxy.taxi.yandex-team.ru/uictr/show/tariff-editor_0e053b7a484bbd13293dd0e42c96c8cb/cGFnZXMvc21zLXYy?__uictr=%7B%7D';

  // Значения текстов СМС по умолчанию
  const defaultSmsTexts = {
    part_delivery: 'Курьер сообщил, что он доставил вам посылку не в полном объёме. Пожалуйста, свяжитесь с ним по номеру: НОМЕР_КУРЬЕРА',
    personal_item: 'Курьер сообщил, что у него остались ваши личные вещи после заказа. Пожалуйста, свяжитесь с ним по номеру: НОМЕР_КУРЬЕРА',
    ask_to_close: 'Курьер сообщил, что передал вам посылку, поэтому заказ будет закрыт. Пожалуйста, свяжитесь с отправителем, если это не так.',
    damaged_item: 'Сожалею, но курьер повредил ваш заказ. Пожалуйста, напишите в службу поддержки по вопросу компенсации.',
    accident: 'К вам направляется новый курьер: НОМЕР_АВТОМОБИЛЯ, МАРКА_АВТОМОБИЛЯ, ЦВЕТ_АВТОМОБИЛЯ.'
  };
  
  // Текущий тип СМС, который редактируется
  let currentSmsType = '';
  
  // Функция для извлечения ID тикета из текущей страницы
  const extractTicketId = (callback) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: () => {
            // Функция для получения параметров URL
            const getQueryParams = (url) => {
              const params = {};
              const queryString = url.split('?')[1];
              if (!queryString) return params;
              
              queryString.split('&').forEach(param => {
                const [key, value] = param.split('=');
                params[key] = value;
              });
              return params;
            };
            
            // Паттерны для поиска ID тикета в URL
            const ticketIdPatterns = [
              /ticket_id=([0-9a-fA-F]{24})/,
              /chatterbox_ticket_id=([0-9a-fA-F]{24})/,
              /zendesk_ticket=([0-9a-fA-F]{24})/,
            ];
            
            // Проверка URL на наличие ID тикета
            const url = window.location.href;
            
            // Сначала проверяем параметры URL
            const params = getQueryParams(url);
            if (params.ticket_id && /^[0-9a-fA-F]{24}$/.test(params.ticket_id)) {
              return params.ticket_id;
            }
            if (params.chatterbox_ticket_id && /^[0-9a-fA-F]{24}$/.test(params.chatterbox_ticket_id)) {
              return params.chatterbox_ticket_id;
            }
            
            // Затем проверяем по регулярным выражениям
            for (const pattern of ticketIdPatterns) {
              const match = url.match(pattern);
              if (match) {
                const ticketId = match[1];
                if (ticketId && /^[0-9a-fA-F]{24}$/.test(ticketId)) {
                  return ticketId;
                }
              }
            }
            
            // Проверяем ссылки на странице
            const links = document.querySelectorAll('a');
            for (const link of links) {
              if (!link.href) continue;
              
              for (const pattern of ticketIdPatterns) {
                const match = link.href.match(pattern);
                if (match) {
                  const ticketId = match[1];
                  if (ticketId && /^[0-9a-fA-F]{24}$/.test(ticketId)) {
                    return ticketId;
                  }
                }
              }
            }
            
            return null;
          }
        }, (results) => {
          const ticketId = results && results[0] && results[0].result;
          callback(ticketId);
        });
      } else {
        callback(null);
      }
    });
  };

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
  
  // Обработчик для кнопки СМС - открываем меню СМС
  smsButton.addEventListener('click', () => {
    mainMenu.style.display = 'none';
    smsMenu.style.display = 'block';
  });
  
  // Возврат в главное меню при клике на кнопку назад (меню сканирования)
  backButton.addEventListener('click', () => {
    scanMenu.style.display = 'none';
    mainMenu.style.display = 'block';
  });
  
  // Возврат в главное меню при клике на кнопку назад (меню СМС)
  backButtonSms.addEventListener('click', () => {
    smsMenu.style.display = 'none';
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
  
  // Функция для открытия страницы SMS с сохранением ID тикета и типа SMS
  const openSmsPageWithType = (smsType) => {
    extractTicketId((ticketId) => {
      // Сохраняем ID тикета и тип SMS в локальное хранилище
      chrome.storage.local.set({
        'smsTicketId': ticketId || 'ID_ТИКЕТА',
        'smsType': smsType
      }, () => {
        console.log('ID тикета сохранен:', ticketId || 'ID_ТИКЕТА');
        console.log('Тип SMS сохранен:', smsType);
        // Открываем страницу SMS
        chrome.tabs.create({ url: smsUrl });
        window.close();
      });
    });
  };
  
  // Обработчики для кнопок внутри меню СМС
  partDeliveryButton.addEventListener('click', () => openSmsPageWithType('part_delivery'));
  personalItemButton.addEventListener('click', () => openSmsPageWithType('personal_item'));
  askToCloseButton.addEventListener('click', () => openSmsPageWithType('ask_to_close'));
  damagedItemButton.addEventListener('click', () => openSmsPageWithType('damaged_item'));
  accidentButton.addEventListener('click', () => openSmsPageWithType('accident'));
  
  // Функция для загрузки пользовательских текстов СМС
  const loadSmsTexts = () => {
    chrome.storage.local.get(['smsTexts'], (result) => {
      if (result.smsTexts) {
        console.log('Загружены пользовательские тексты СМС:', result.smsTexts);
      } else {
        // Если пользовательских текстов нет, сохраняем значения по умолчанию
        chrome.storage.local.set({ 'smsTexts': defaultSmsTexts }, () => {
          console.log('Сохранены тексты СМС по умолчанию');
        });
      }
    });
  };
  
  // Загружаем тексты СМС при загрузке страницы
  loadSmsTexts();
  
  // Функция для отображения модального окна с текстом СМС
  const openSmsConfigModal = (smsType, title) => {
    currentSmsType = smsType;
    smsConfigTitle.textContent = `Настройка: ${title}`;
    
    // Загружаем текущий текст СМС из хранилища
    chrome.storage.local.get(['smsTexts'], (result) => {
      const smsTexts = result.smsTexts || defaultSmsTexts;
      smsConfigText.value = smsTexts[smsType];
      smsConfigModal.style.display = 'block';
    });
  };
  
  // Закрываем модальное окно при клике на кнопку закрытия
  closeButton.addEventListener('click', () => {
    smsConfigModal.style.display = 'none';
  });
  
  // Закрываем модальное окно при клике вне его области
  window.addEventListener('click', (event) => {
    if (event.target === smsConfigModal) {
      smsConfigModal.style.display = 'none';
    }
  });
  
  // Сохраняем изменения текста СМС
  saveConfigButton.addEventListener('click', () => {
    const newText = smsConfigText.value.trim();
    
    // Проверяем, что текст не пустой
    if (newText === '') {
      alert('Текст сообщения не может быть пустым');
      return;
    }
    
    // Сохраняем новый текст в хранилище
    chrome.storage.local.get(['smsTexts'], (result) => {
      const smsTexts = result.smsTexts || defaultSmsTexts;
      smsTexts[currentSmsType] = newText;
      
      chrome.storage.local.set({ 'smsTexts': smsTexts }, () => {
        console.log(`Текст для ${currentSmsType} сохранен:`, newText);
        smsConfigModal.style.display = 'none';
      });
    });
  });
  
  // Назначаем обработчики событий для иконок настройки
  partDeliveryConfig.addEventListener('click', () => openSmsConfigModal('part_delivery', 'Часть посылки'));
  personalItemConfig.addEventListener('click', () => openSmsConfigModal('personal_item', 'Личная вещь'));
  askToCloseConfig.addEventListener('click', () => openSmsConfigModal('ask_to_close', 'Просят закрыть [2ндз]'));
  damagedItemConfig.addEventListener('click', () => openSmsConfigModal('damaged_item', 'Повреждёнка'));
  accidentConfig.addEventListener('click', () => openSmsConfigModal('accident', 'ДТП [Новый]'));

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