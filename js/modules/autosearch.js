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

// Модуль автопоиска
// Содержит три функции автопоиска: пресетов, тестирования и последних заказов

// Функция для логирования действий (если не определена в глобальной области)
if (typeof logAction === 'undefined') {
  function logAction(message, data = null, source = 'autosearch') {
    // Используем Utils для логирования
    Utils.log(`[${source}] ${message}`, data || '');
  }
}

// Объект для хранения состояния автопоиска
const autosearchState = {
  // Переменные для автопоиска пресетов
  autosearchInProgress: false,
  lastAutosearchUrl: null,
  autosearchCooldown: null,
  autosearchCompleted: false, // Флаг завершения автопоиска для текущего тикета
  lastProcessedTicketId: null, // ID последнего обработанного тикета
  autosearchPresetsDisabled: false, // Флаг отключения автопоиска пресетов в настройках
  autosearchPresetsLaunched: false, // Флаг однократного запуска автопоиска пресетов
  autosearchPresetsAttempts: 0, // Количество попыток запуска автопоиска пресетов

  // Переменные для автопоиска тестирования
  autosearchTestingInProgress: false,
  lastAutosearchTestingUrl: null,
  autosearchTestingCooldown: null,
  autosearchTestingCompleted: false, // Флаг завершения автопоиска тестирования для текущего тикета
  lastProcessedTestingTicketId: null, // ID последнего обработанного тикета для тестирования
  autosearchTestingDisabled: false, // Флаг отключения автопоиска тестирования в настройках
  autosearchTestingLaunched: false, // Флаг однократного запуска автопоиска тестирования
  autosearchTestingAttempts: 0, // Количество попыток запуска автопоиска тестирования

  // Переменные для автопоиска последних заказов
  autosearchLastOrdersInProgress: false,
  lastAutosearchLastOrdersUrl: null,
  autosearchLastOrdersCooldown: null,
  autosearchLastOrdersCompleted: false, // Флаг завершения автопоиска последних заказов для текущего тикета
  lastProcessedLastOrdersTicketId: null, // ID последнего обработанного тикета для последних заказов
  autosearchLastOrdersDisabled: false, // Флаг отключения автопоиска последних заказов в настройках
  autosearchLastOrdersLaunched: false, // Флаг однократного запуска автопоиска последних заказов
  autosearchLastOrdersAttempts: 0, // Количество попыток запуска автопоиска последних заказов

  // Флаг однократного запуска всех автопоисков (сбрасывается только при обновлении страницы или новом тикете)
  autosearchesLaunched: false
};

// Функция для сброса состояния автопоиска
function resetAutosearchState() {
  const wasInProgress = autosearchState.autosearchInProgress;
  const hadLastUrl = autosearchState.lastAutosearchUrl !== null;
  const wasCompleted = autosearchState.autosearchCompleted;
  const hadLastTicketId = autosearchState.lastProcessedTicketId !== null;
  
  // Сбрасываем состояние автопоиска пресетов
  autosearchState.autosearchInProgress = false;
  autosearchState.lastAutosearchUrl = null;
  autosearchState.autosearchCooldown = null;
  autosearchState.autosearchCompleted = false; // Сбрасываем флаг завершения
  autosearchState.lastProcessedTicketId = null; // Сбрасываем ID последнего тикета
  autosearchState.autosearchPresetsDisabled = false; // Сбрасываем флаг отключения
  autosearchState.autosearchPresetsLaunched = false; // Сбрасываем флаг запуска
  autosearchState.autosearchPresetsAttempts = 0; // Сбрасываем счетчик попыток
  
  // Сбрасываем состояние автопоиска тестирования
  autosearchState.autosearchTestingInProgress = false;
  autosearchState.lastAutosearchTestingUrl = null;
  autosearchState.autosearchTestingCooldown = null;
  autosearchState.autosearchTestingCompleted = false; // Сбрасываем флаг завершения тестирования
  autosearchState.lastProcessedTestingTicketId = null; // Сбрасываем ID последнего тикета для тестирования
  autosearchState.autosearchTestingDisabled = false; // Сбрасываем флаг отключения
  autosearchState.autosearchTestingLaunched = false; // Сбрасываем флаг запуска
  autosearchState.autosearchTestingAttempts = 0; // Сбрасываем счетчик попыток
  
  // Сбрасываем состояние автопоиска последних заказов
  autosearchState.autosearchLastOrdersInProgress = false;
  autosearchState.lastAutosearchLastOrdersUrl = null;
  autosearchState.autosearchLastOrdersCooldown = null;
  autosearchState.autosearchLastOrdersCompleted = false; // Сбрасываем флаг завершения последних заказов
  autosearchState.lastProcessedLastOrdersTicketId = null; // Сбрасываем ID последнего тикета для последних заказов
  autosearchState.autosearchLastOrdersDisabled = false; // Сбрасываем флаг отключения
  autosearchState.autosearchLastOrdersLaunched = false; // Сбрасываем флаг запуска
  autosearchState.autosearchLastOrdersAttempts = 0; // Сбрасываем счетчик попыток

  // Сбрасываем флаг однократного запуска
  autosearchState.autosearchesLaunched = false;
  
  if (wasInProgress || hadLastUrl || wasCompleted || hadLastTicketId) {
    Utils.log('Состояние автопоиска сброшено', {
      wasInProgress: wasInProgress,
      hadLastUrl: hadLastUrl,
      wasCompleted: wasCompleted,
      hadLastTicketId: hadLastTicketId,
      trigger: 'resetAutosearchState'
    });
  }
}

// Функция для проверки нового тикета и сброса флага завершения
function checkNewTicketAndReset(ticketId) {
  // Флаг для отслеживания, нужно ли запускать автопоиски
  let shouldRestartAutosearches = false;
  
  // Проверяем новый тикет для автопоиска пресетов
  if (ticketId && ticketId !== autosearchState.lastProcessedTicketId) {
    if (autosearchState.lastProcessedTicketId !== null) {
      Utils.log('Обнаружен новый тикет, сбрасываем флаг завершения автопоиска пресетов', {
        oldTicketId: autosearchState.lastProcessedTicketId,
        newTicketId: ticketId
      });
      shouldRestartAutosearches = true;
    }
    
    autosearchState.lastProcessedTicketId = ticketId;
    autosearchState.autosearchCompleted = false; // Сбрасываем флаг завершения для нового тикета
    autosearchState.lastAutosearchUrl = null; // Сбрасываем последний URL для нового тикета
    autosearchState.autosearchPresetsLaunched = false; // Сбрасываем флаг запуска для нового тикета
    autosearchState.autosearchPresetsAttempts = 0; // Сбрасываем счетчик попыток для нового тикета
  }
  
  // Проверяем новый тикет для автопоиска тестирования
  if (ticketId && ticketId !== autosearchState.lastProcessedTestingTicketId) {
    if (autosearchState.lastProcessedTestingTicketId !== null) {
      Utils.log('Обнаружен новый тикет, сбрасываем флаг завершения автопоиска тестирования', {
        oldTicketId: autosearchState.lastProcessedTestingTicketId,
        newTicketId: ticketId
      });
      shouldRestartAutosearches = true;
    }
    
    autosearchState.lastProcessedTestingTicketId = ticketId;
    autosearchState.autosearchTestingCompleted = false; // Сбрасываем флаг завершения для нового тикета
    autosearchState.lastAutosearchTestingUrl = null; // Сбрасываем последний URL для нового тикета
    autosearchState.autosearchTestingLaunched = false; // Сбрасываем флаг запуска для нового тикета
    autosearchState.autosearchTestingAttempts = 0; // Сбрасываем счетчик попыток для нового тикета
  }
  
  // Проверяем новый тикет для автопоиска последних заказов
  if (ticketId && ticketId !== autosearchState.lastProcessedLastOrdersTicketId) {
    if (autosearchState.lastProcessedLastOrdersTicketId !== null) {
      Utils.log('Обнаружен новый тикет, сбрасываем флаг завершения автопоиска последних заказов', {
        oldTicketId: autosearchState.lastProcessedLastOrdersTicketId,
        newTicketId: ticketId
      });
      shouldRestartAutosearches = true;
    }
    
    autosearchState.lastProcessedLastOrdersTicketId = ticketId;
    autosearchState.autosearchLastOrdersCompleted = false; // Сбрасываем флаг завершения для нового тикета
    autosearchState.lastAutosearchLastOrdersUrl = null; // Сбрасываем последний URL для нового тикета
    autosearchState.autosearchLastOrdersLaunched = false; // Сбрасываем флаг запуска для нового тикета
    autosearchState.autosearchLastOrdersAttempts = 0; // Сбрасываем счетчик попыток для нового тикета
  }
  
  // Если обнаружен новый тикет, запускаем автопоиски заново
  if (shouldRestartAutosearches) {
    Utils.log('🔄 AUTOSEARCH: Обнаружен новый тикет, запускаем автопоиски заново');
    
    // Проверяем URL - не запускаем автопоиск на страницах карточек водителей
    const currentUrl = window.location.href;
    if (currentUrl.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
      Utils.log('🔄 AUTOSEARCH: Страница карточки водителя - автопоиски отключены');
      return;
    }
    
    // Сбрасываем глобальный флаг запуска автопоисков
    autosearchState.autosearchesLaunched = false;
    
    // Запускаем автопоиски с небольшой задержкой для стабилизации данных
    setTimeout(() => {
      if (!autosearchState.autosearchesLaunched) {
        Utils.log('🔄 AUTOSEARCH: Запускаем автопоиски для нового тикета');
        // Устанавливаем флаг запуска
        autosearchState.autosearchesLaunched = true;
        
        // Запускаем автопоиск пресетов
        performAutosearchPresets();
        
        // Запускаем автопоиск тестирования с задержкой
        setTimeout(() => {
          performAutosearchTesting();
        }, 200);
        
        // Запускаем автопоиск последних заказов с задержкой
        setTimeout(() => {
          performAutosearchLastOrders();
        }, 400);
      } else {
        Utils.log('🔄 AUTOSEARCH: Автопоиски уже запущены для нового тикета');
      }
    }, 100); // Задержка для стабилизации данных нового тикета
  }
}

// Функция для выполнения автопоиска пресетов с системой попыток
function performAutosearchPresets() {
  Utils.log('AUTOSEARCH PRESETS: Функция вызвана');
  
  // Проверяем URL - не запускаем автопоиск на страницах карточек водителей
  const currentUrl = window.location.href;
  Utils.log('AUTOSEARCH PRESETS: Текущий URL:', currentUrl);
  
  if (currentUrl.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
    Utils.log('AUTOSEARCH PRESETS: Страница карточки водителя - автопоиск отключен');
    Utils.log('Автопоиск пресетов: страница карточки водителя - автопоиск отключен для этого типа страниц.');
    return;
  }

  // Проверяем, не был ли уже запущен автопоиск пресетов
  Utils.log('AUTOSEARCH PRESETS: Проверяем флаг запуска:', autosearchState.autosearchPresetsLaunched);
  if (autosearchState.autosearchPresetsLaunched) {
    Utils.log('AUTOSEARCH PRESETS: Уже запускался, пропускаем');
    Utils.log('Автопоиск пресетов: уже запускался, пропускаем повторный запуск');
    return;
  }

  // Проверяем, не выполняется ли уже автопоиск
  Utils.log('AUTOSEARCH PRESETS: Проверяем autosearchInProgress:', autosearchState.autosearchInProgress);
  if (autosearchState.autosearchInProgress) {
    Utils.log('AUTOSEARCH PRESETS: Автопоиск уже выполняется, выходим');
    return;
  }

  // Автопоиск пресетов завершается без установки флага

  // Проверяем флаг отключения автопоиска пресетов
  Utils.log('AUTOSEARCH PRESETS: Проверяем autosearchPresetsDisabled:', autosearchState.autosearchPresetsDisabled);
  if (autosearchState.autosearchPresetsDisabled) {
    Utils.log('AUTOSEARCH PRESETS: Автопоиск отключен, выходим');
    return;
  }

  // Проверяем кулдаун (защита от спама)
  const currentTime = Date.now();
  Utils.log('AUTOSEARCH PRESETS: Проверяем кулдаун. Текущее время:', currentTime, 'Кулдаун до:', autosearchState.autosearchCooldown);
  if (autosearchState.autosearchCooldown && currentTime < autosearchState.autosearchCooldown) {
    Utils.log('AUTOSEARCH PRESETS: Кулдаун активен, выходим');
    return;
  }

  // Устанавливаем флаг запуска
  Utils.log('AUTOSEARCH PRESETS: Устанавливаем флаги запуска');
  autosearchState.autosearchPresetsLaunched = true;
  autosearchState.autosearchPresetsAttempts++;
  Utils.log('AUTOSEARCH PRESETS: Попытка номер:', autosearchState.autosearchPresetsAttempts);

  // Получаем настройки автопоиска
  Utils.log('AUTOSEARCH PRESETS: Запрашиваем настройки автопоиска...');
  chrome.storage.local.get(['autosearchPresets'], (result) => {
    Utils.log('AUTOSEARCH PRESETS: Получены настройки:', result);
    
    if (!result.autosearchPresets) {
      Utils.log('AUTOSEARCH PRESETS: Автопоиск отключен в настройках');
      Utils.log('Автопоиск пресетов отключен в настройках');
      autosearchState.autosearchPresetsDisabled = true; // Устанавливаем флаг отключения
      return;
    }

    Utils.log('AUTOSEARCH PRESETS: Автопоиск включен в настройках');
    Utils.log(`Автопоиск пресетов включен - запускаем поиск... (попытка ${autosearchState.autosearchPresetsAttempts}/10)`);
    
    // Логируем действие автопоиска
    logAction('Автопоиск пресетов: запуск автоматического поиска', {
      url: window.location.href,
      trigger: 'page_load',
      attempt: autosearchState.autosearchPresetsAttempts
    });

    // Ищем ссылку на водителя на текущей странице
    Utils.log('AUTOSEARCH PRESETS: Ищем ссылку на водителя...');
    const buttons = document.querySelectorAll('a');
    Utils.log('AUTOSEARCH PRESETS: Найдено ссылок на странице:', buttons.length);
    Utils.log('🔧 URL обновлен для всех функций автопоиска: pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/');
    
    let driverLink = null;
    
    buttons.forEach((button, index) => {
      if (button && button.textContent && button.href) {
        if (button.textContent.includes('Водитель')) {
          Utils.log(`AUTOSEARCH PRESETS: Ссылка ${index} содержит "Водитель":`, button.href, 'Текст:', button.textContent);
          if (button.href.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
            driverLink = button.href;
            Utils.log('AUTOSEARCH PRESETS: Найдена подходящая ссылка на водителя:', driverLink);
            Utils.log('AUTOSEARCH PRESETS: URL обновлен для поиска кнопки "Водитель"');
          }
        }
      }
    });
    
    Utils.log('AUTOSEARCH PRESETS: Итоговая ссылка на водителя:', driverLink);
    
    if (driverLink) {
      Utils.log('AUTOSEARCH PRESETS: Запускаем поиск пресетов...');
      Utils.log('Автопоиск пресетов: найдена ссылка на водителя, запускаем поиск пресетов');
      
      // Устанавливаем флаг выполнения и сохраняем URL
      autosearchState.autosearchInProgress = true;
      autosearchState.lastAutosearchUrl = driverLink;
      
      // Устанавливаем кулдаун на 5 секунд
      autosearchState.autosearchCooldown = Date.now() + 5000;
      
      // Логируем найденную ссылку
      logAction('Автопоиск пресетов: найдена ссылка на водителя', {
        driverLink: driverLink
      });
      
      // Запускаем поиск пресетов через background.js (как кнопка ПОИСК)
      Utils.log('AUTOSEARCH PRESETS: Отправляем сообщение в background.js...');
      chrome.runtime.sendMessage({
        action: 'startSearch',
        url: driverLink,
        trigger: 'autosearch_presets'
      }, (response) => {
        Utils.log('AUTOSEARCH PRESETS: Получен ответ от background.js:', response);
        // Проверяем ошибки chrome.runtime
        if (chrome.runtime.lastError) {
          Utils.log('Автопоиск пресетов: ошибка chrome.runtime:', chrome.runtime.lastError);
          logAction('Автопоиск пресетов: ошибка chrome.runtime', {
            error: chrome.runtime.lastError.message
          });
          
          // Сбрасываем состояние немедленно при ошибке
          autosearchState.autosearchInProgress = false;
          autosearchState.lastAutosearchUrl = null;
          
          // Если это не последняя попытка, пробуем еще раз через 150мс
          if (autosearchState.autosearchPresetsAttempts < 10) {
            autosearchState.autosearchPresetsLaunched = false; // Сбрасываем флаг для повторной попытки
            setTimeout(() => {
              performAutosearchPresets();
            }, 100);
          }
          return;
        }
        
        if (response && response.success) {
          Utils.log('Автопоиск пресетов: поиск успешно запущен');
          logAction('Автопоиск пресетов: поиск успешно запущен');
        } else {
          Utils.log('Автопоиск пресетов: ошибка при запуске поиска');
          logAction('Автопоиск пресетов: ошибка при запуске поиска', {
            error: response ? response.error : 'Нет ответа от background.js'
          });
          
          // Если произошла ошибка, сбрасываем состояние немедленно
          if (response && response.error) {
            Utils.log('Автопоиск пресетов: сбрасываем состояние из-за ошибки:', response.error);
            autosearchState.autosearchInProgress = false;
            autosearchState.lastAutosearchUrl = null;
            
            // Если это не последняя попытка, пробуем еще раз через 150мс
            if (autosearchState.autosearchPresetsAttempts < 10) {
              autosearchState.autosearchPresetsLaunched = false; // Сбрасываем флаг для повторной попытки
              setTimeout(() => {
                performAutosearchPresets();
              }, 100);
            }
            return;
          }
        }
        
        // Сбрасываем флаг выполнения через 1 секунду
        setTimeout(() => {
          autosearchState.autosearchInProgress = false;
        }, 1000);
      });
    } else {
      Utils.log('AUTOSEARCH PRESETS: Ссылка на водителя НЕ найдена на текущей странице');
      Utils.log('Автопоиск пресетов: ссылка на водителя не найдена на текущей странице');
      logAction('Автопоиск пресетов: ссылка на водителя не найдена');
      
      // Если ссылка не найдена и это не последняя попытка, пробуем еще раз через 150мс
      if (autosearchState.autosearchPresetsAttempts < 10) {
        autosearchState.autosearchPresetsLaunched = false; // Сбрасываем флаг для повторной попытки
        setTimeout(() => {
          performAutosearchPresets();
        }, 100);
      }
    }
  });
}

// Функция для выполнения автопоиска тестирования с системой попыток
function performAutosearchTesting() {
  // Проверяем URL - не запускаем автопоиск на страницах карточек водителей
  const currentUrl = window.location.href;
  if (currentUrl.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
    Utils.log('Автопоиск тестирования: страница карточки водителя - автопоиск отключен для этого типа страниц.');
    return;
  }

  // Проверяем, не был ли уже запущен автопоиск тестирования
  if (autosearchState.autosearchTestingLaunched) {
    Utils.log('Автопоиск тестирования: уже запускался, пропускаем повторный запуск');
    return;
  }

  // Проверяем, не выполняется ли уже автопоиск тестирования
  if (autosearchState.autosearchTestingInProgress) {
    return;
  }

  // Автопоиск тестирования завершается без установки флага (как автопоиск пресетов)

  // Проверяем флаг отключения автопоиска тестирования
  if (autosearchState.autosearchTestingDisabled) {
    return;
  }

  // Проверяем кулдаун (защита от спама)
  if (autosearchState.autosearchTestingCooldown && Date.now() < autosearchState.autosearchTestingCooldown) {
    return;
  }

  // Устанавливаем флаг запуска
  autosearchState.autosearchTestingLaunched = true;
  autosearchState.autosearchTestingAttempts++;

  // Получаем настройки автопоиска тестирования
  chrome.storage.local.get(['autosearchTesting'], (result) => {
    if (!result.autosearchTesting) {
      Utils.log('Автопоиск тестирования отключен в настройках');
      autosearchState.autosearchTestingDisabled = true; // Устанавливаем флаг отключения
      return;
    }

    Utils.log(`Автопоиск тестирования включен - запускаем тестирование... (попытка ${autosearchState.autosearchTestingAttempts}/10)`);
    
    // Логируем действие автопоиска тестирования
    logAction('Автопоиск тестирования: запуск автоматического тестирования', {
      url: window.location.href,
      trigger: 'page_load',
      attempt: autosearchState.autosearchTestingAttempts
    });

    // Ищем ссылку на водителя на текущей странице
    const buttons = document.querySelectorAll('a');
    let driverLink = null;
    
    buttons.forEach(button => {
      if (button && 
          button.textContent.includes('Водитель') &&
          button.href.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
        driverLink = button.href;
        Utils.log('AUTOSEARCH TESTING: Найдена ссылка на водителя с обновленным URL:', driverLink);
      }
    });
    
    if (driverLink) {
      Utils.log('Автопоиск тестирования: найдена ссылка на водителя, запускаем тестирование');
      
      // Устанавливаем флаг выполнения и сохраняем URL
      autosearchState.autosearchTestingInProgress = true;
      autosearchState.lastAutosearchTestingUrl = driverLink;
      
      // Устанавливаем кулдаун на 5 секунд
      autosearchState.autosearchTestingCooldown = Date.now() + 5000;
      
      // Логируем найденную ссылку
      logAction('Автопоиск тестирования: найдена ссылка на водителя', {
        driverLink: driverLink
      });
      
      // Запускаем тестирование через background.js (как кнопка Тестирование)
      chrome.runtime.sendMessage({
        action: 'startTesting',
        trigger: 'autosearch_testing'
      }, (response) => {
        // Проверяем ошибки chrome.runtime
        if (chrome.runtime.lastError) {
          Utils.log('Автопоиск тестирования: ошибка chrome.runtime:', chrome.runtime.lastError);
          logAction('Автопоиск тестирования: ошибка chrome.runtime', {
            error: chrome.runtime.lastError.message
          });
          
          // Сбрасываем состояние немедленно при ошибке
          autosearchState.autosearchTestingInProgress = false;
          autosearchState.lastAutosearchTestingUrl = null;
          
          // Если это не последняя попытка, пробуем еще раз через 150мс
          if (autosearchState.autosearchTestingAttempts < 10) {
            autosearchState.autosearchTestingLaunched = false; // Сбрасываем флаг для повторной попытки
            setTimeout(() => {
              performAutosearchTesting();
            }, 100);
          }
          return;
        }
        
        if (response && response.success) {
          Utils.log('Автопоиск тестирования: тестирование успешно запущено');
          logAction('Автопоиск тестирования: тестирование успешно запущено');
        } else {
          Utils.log('Автопоиск тестирования: ошибка при запуске тестирования');
          logAction('Автопоиск тестирования: ошибка при запуске тестирования', {
            error: response ? response.error : 'Нет ответа от background.js'
          });
          
          // Если произошла ошибка, сбрасываем состояние немедленно
          if (response && response.error) {
            Utils.log('Автопоиск тестирования: сбрасываем состояние из-за ошибки:', response.error);
            autosearchState.autosearchTestingInProgress = false;
            autosearchState.lastAutosearchTestingUrl = null;
            
            // Если это не последняя попытка, пробуем еще раз через 150мс
            if (autosearchState.autosearchTestingAttempts < 10) {
              autosearchState.autosearchTestingLaunched = false; // Сбрасываем флаг для повторной попытки
              setTimeout(() => {
                performAutosearchTesting();
              }, 100);
            }
            return;
          }
        }
        
        // Сбрасываем флаг выполнения через 1 секунду
        setTimeout(() => {
          autosearchState.autosearchTestingInProgress = false;
        }, 1000);
      });
    } else {
      Utils.log('Автопоиск тестирования: ссылка на водителя не найдена на текущей странице');
      logAction('Автопоиск тестирования: ссылка на водителя не найдена');
      
      // Если ссылка не найдена и это не последняя попытка, пробуем еще раз через 150мс
      if (autosearchState.autosearchTestingAttempts < 10) {
        autosearchState.autosearchTestingLaunched = false; // Сбрасываем флаг для повторной попытки
        setTimeout(() => {
          performAutosearchTesting();
        }, 100);
      }
    }
  });
}

// Функция для выполнения автопоиска последних заказов с системой попыток
function performAutosearchLastOrders() {
  // Проверяем URL - не запускаем автопоиск на страницах карточек водителей
  const currentUrl = window.location.href;
  if (currentUrl.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
    Utils.log('Автопоиск последних заказов: страница карточки водителя - автопоиск отключен для этого типа страниц.');
    return;
  }

  // Проверяем, не был ли уже запущен автопоиск последних заказов
  if (autosearchState.autosearchLastOrdersLaunched) {
    Utils.log('Автопоиск последних заказов: уже запускался, пропускаем повторный запуск');
    return;
  }

  // Проверяем, не выполняется ли уже автопоиск последних заказов
  if (autosearchState.autosearchLastOrdersInProgress) {
    return;
  }

  // Автопоиск последних заказов завершается без установки флага (как автопоиск пресетов)

  // Проверяем флаг отключения автопоиска последних заказов
  if (autosearchState.autosearchLastOrdersDisabled) {
    return;
  }

  // Проверяем кулдаун (защита от спама)
  if (autosearchState.autosearchLastOrdersCooldown && Date.now() < autosearchState.autosearchLastOrdersCooldown) {
    return;
  }

  // Устанавливаем флаг запуска
  autosearchState.autosearchLastOrdersLaunched = true;
  autosearchState.autosearchLastOrdersAttempts++;

  // Получаем настройки автопоиска последних заказов
  chrome.storage.local.get(['autosearchLastOrders'], (result) => {
    if (!result.autosearchLastOrders) {
      Utils.log('Автопоиск последних заказов отключен в настройках');
      autosearchState.autosearchLastOrdersDisabled = true; // Устанавливаем флаг отключения
      return;
    }

    Utils.log(`Автопоиск последних заказов включен - запускаем поиск последних заказов... (попытка ${autosearchState.autosearchLastOrdersAttempts}/10)`);
    
    // Логируем действие автопоиска последних заказов
    logAction('Автопоиск последних заказов: запуск автоматического поиска последних заказов', {
      url: window.location.href,
      trigger: 'page_load',
      attempt: autosearchState.autosearchLastOrdersAttempts
    });

    // Ищем ссылку на водителя на текущей странице
    const buttons = document.querySelectorAll('a');
    let driverLink = null;
    
    buttons.forEach(button => {
      if (button && 
          button.textContent.includes('Водитель') &&
          button.href.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
        driverLink = button.href;
        Utils.log('AUTOSEARCH LAST ORDERS: Найдена ссылка на водителя с обновленным URL:', driverLink);
      }
    });
    
    if (driverLink) {
      Utils.log('Автопоиск последних заказов: найдена ссылка на водителя, запускаем поиск последних заказов');
      
      // Устанавливаем флаг выполнения и сохраняем URL
      autosearchState.autosearchLastOrdersInProgress = true;
      autosearchState.lastAutosearchLastOrdersUrl = driverLink;
      
      // Устанавливаем кулдаун на 5 секунд
      autosearchState.autosearchLastOrdersCooldown = Date.now() + 5000;
      
      // Логируем найденную ссылку
      logAction('Автопоиск последних заказов: найдена ссылка на водителя', {
        driverLink: driverLink
      });
      
      // Запускаем поиск последних заказов через background.js (как кнопка Последние заказы)
      chrome.runtime.sendMessage({
        action: 'startLastOrders',
        trigger: 'autosearch_last_orders'
      }, (response) => {
        // Проверяем ошибки chrome.runtime
        if (chrome.runtime.lastError) {
          Utils.log('Автопоиск последних заказов: ошибка chrome.runtime:', chrome.runtime.lastError);
          logAction('Автопоиск последних заказов: ошибка chrome.runtime', {
            error: chrome.runtime.lastError.message
          });
          
          // Сбрасываем состояние немедленно при ошибке
          autosearchState.autosearchLastOrdersInProgress = false;
          autosearchState.lastAutosearchLastOrdersUrl = null;
          
          // Если это не последняя попытка, пробуем еще раз через 150мс
          if (autosearchState.autosearchLastOrdersAttempts < 10) {
            autosearchState.autosearchLastOrdersLaunched = false; // Сбрасываем флаг для повторной попытки
            setTimeout(() => {
              performAutosearchLastOrders();
            }, 100);
          }
          return;
        }
        
        if (response && response.success) {
          Utils.log('Автопоиск последних заказов: поиск последних заказов успешно запущен');
          logAction('Автопоиск последних заказов: поиск последних заказов успешно запущен');
        } else {
          Utils.log('Автопоиск последних заказов: ошибка при запуске поиска последних заказов');
          logAction('Автопоиск последних заказов: ошибка при запуске поиска последних заказов', {
            error: response ? response.error : 'Нет ответа от background.js'
          });
          
          // Если произошла ошибка, сбрасываем состояние немедленно
          if (response && response.error) {
            Utils.log('Автопоиск последних заказов: сбрасываем состояние из-за ошибки:', response.error);
            autosearchState.autosearchLastOrdersInProgress = false;
            autosearchState.lastAutosearchLastOrdersUrl = null;
            
            // Если это не последняя попытка, пробуем еще раз через 150мс
            if (autosearchState.autosearchLastOrdersAttempts < 10) {
              autosearchState.autosearchLastOrdersLaunched = false; // Сбрасываем флаг для повторной попытки
              setTimeout(() => {
                performAutosearchLastOrders();
              }, 100);
            }
            return;
          }
        }
        
        // Сбрасываем флаг выполнения через 1 секунду
        setTimeout(() => {
          autosearchState.autosearchLastOrdersInProgress = false;
        }, 1000);
      });
    } else {
      Utils.log('Автопоиск последних заказов: ссылка на водителя не найдена на текущей странице');
      logAction('Автопоиск последних заказов: ссылка на водителя не найдена');
      
      // Если ссылка не найдена и это не последняя попытка, пробуем еще раз через 150мс
      if (autosearchState.autosearchLastOrdersAttempts < 10) {
        autosearchState.autosearchLastOrdersLaunched = false; // Сбрасываем флаг для повторной попытки
        setTimeout(() => {
          performAutosearchLastOrders();
        }, 100);
      }
    }
  });
}

// Вспомогательные функции для перезапуска автопоисков

/**
 * Перезапускает автопоиск пресетов для нового тикета
 */
function restartAutosearchPresets() {
  Utils.log('🔄 RESTART: Перезапуск автопоиска пресетов');
  
  // Проверяем URL - не запускаем автопоиск на страницах карточек водителей
  const currentUrl = window.location.href;
  if (currentUrl.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
    Utils.log('🔄 RESTART: Страница карточки водителя - автопоиск пресетов отключен');
    return;
  }
  
  // Сбрасываем флаги для повторного запуска
  autosearchState.autosearchPresetsLaunched = false;
  autosearchState.autosearchPresetsAttempts = 0;
  
  // Запускаем автопоиск пресетов
  setTimeout(() => {
    performAutosearchPresets();
  }, 30);
}

/**
 * Перезапускает автопоиск тестирования для нового тикета
 */
function restartAutosearchTesting() {
  Utils.log('🔄 RESTART: Перезапуск автопоиска тестирования');
  
  // Проверяем URL - не запускаем автопоиск на страницах карточек водителей
  const currentUrl = window.location.href;
  if (currentUrl.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
    Utils.log('🔄 RESTART: Страница карточки водителя - автопоиск тестирования отключен');
    return;
  }
  
  // Сбрасываем флаги для повторного запуска
  autosearchState.autosearchTestingLaunched = false;
  autosearchState.autosearchTestingAttempts = 0;
  
  // Запускаем автопоиск тестирования с задержкой
  setTimeout(() => {
    performAutosearchTesting();
  }, 200);
}

/**
 * Перезапускает автопоиск последних заказов для нового тикета
 */
function restartAutosearchLastOrders() {
  Utils.log('🔄 RESTART: Перезапуск автопоиска последних заказов');
  
  // Проверяем URL - не запускаем автопоиск на страницах карточек водителей
  const currentUrl = window.location.href;
  if (currentUrl.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
    Utils.log('🔄 RESTART: Страница карточки водителя - автопоиск последних заказов отключен');
    return;
  }
  
  // Сбрасываем флаги для повторного запуска
  autosearchState.autosearchLastOrdersLaunched = false;
  autosearchState.autosearchLastOrdersAttempts = 0;
  
  // Запускаем автопоиск последних заказов с задержкой
  setTimeout(() => {
    performAutosearchLastOrders();
  }, 400);
}

/**
 * Перезапускает все автопоиски для нового тикета
 */
function restartAllAutosearches() {
  Utils.log('🔄 RESTART: Перезапуск всех автопоисков');
  
  // Проверяем URL - не запускаем автопоиск на страницах карточек водителей
  const currentUrl = window.location.href;
  if (currentUrl.includes('pro-admin-external.taxi.yandex-team.ru/show-driver/iframe/')) {
    Utils.log('🔄 RESTART: Страница карточки водителя - все автопоиски отключены');
    return;
  }
  
  // Сбрасываем глобальный флаг запуска автопоисков
  autosearchState.autosearchesLaunched = false;
  
  // Запускаем все автопоиски
  setTimeout(() => {
    if (!autosearchState.autosearchesLaunched) {
      Utils.log('🔄 RESTART: Запускаем все автопоиски');
      autosearchState.autosearchesLaunched = true;
      
      // Запускаем автопоиски с задержками
      restartAutosearchPresets();
      restartAutosearchTesting();
      restartAutosearchLastOrders();
    }
  }, 200);
}

// Функция для сброса флагов отключения (вызывается при изменении настроек)
function resetDisabledFlags() {
  autosearchState.autosearchPresetsDisabled = false;
  autosearchState.autosearchTestingDisabled = false;
  autosearchState.autosearchLastOrdersDisabled = false;
  autosearchState.autosearchesLaunched = false; // Сбрасываем флаг однократного запуска
  Utils.log('Флаги отключения автопоиска сброшены');
}

// Автозапуск автопоиска при загрузке модуля
(function initAutosearch() {
  // Проверяем URL - не запускаем автопоиск на страницах карточек водителей
  const currentUrl = window.location.href;
  if (currentUrl.includes('pro-admin-frontend-external.taxi.yandex-team.ru/show-driver/iframe/')) {
    Utils.log('AUTOSEARCH: Страница карточки водителя - автопоиски отключены');
    return;
  }

  // Запускаем автопоиски с небольшой задержкой для полной загрузки DOM
  setTimeout(() => {
    Utils.log('🚀 AUTOSEARCH: Инициализация автопоисков...');
    
    if (!autosearchState.autosearchesLaunched) {
      Utils.log('AUTOSEARCH: Запускаем автопоиски при загрузке модуля');
      // Устанавливаем флаг однократного запуска
      autosearchState.autosearchesLaunched = true;
      
      // Запускаем автопоиск пресетов
      performAutosearchPresets();
      
      // Запускаем автопоиск тестирования с задержкой
      setTimeout(() => {
        performAutosearchTesting();
      }, 300);
      
      // Запускаем автопоиск последних заказов с задержкой
      setTimeout(() => {
        performAutosearchLastOrders();
      }, 600);
    } else {
      Utils.log('AUTOSEARCH: Автопоиски уже запущены');
    }
      }, 100); // Небольшая задержка для полной загрузки DOM и других модулей
})();

// Экспортируем функции и переменные для использования в content.js
window.AutosearchModule = {
  // Переменные состояния (ссылки на autosearchState)
  get autosearchInProgress() { return autosearchState.autosearchInProgress; },
  set autosearchInProgress(value) { autosearchState.autosearchInProgress = value; },
  get lastAutosearchUrl() { return autosearchState.lastAutosearchUrl; },
  set lastAutosearchUrl(value) { autosearchState.lastAutosearchUrl = value; },
  get autosearchCooldown() { return autosearchState.autosearchCooldown; },
  set autosearchCooldown(value) { autosearchState.autosearchCooldown = value; },
  get autosearchCompleted() { return autosearchState.autosearchCompleted; },
  set autosearchCompleted(value) { autosearchState.autosearchCompleted = value; },
  get lastProcessedTicketId() { return autosearchState.lastProcessedTicketId; },
  set lastProcessedTicketId(value) { autosearchState.lastProcessedTicketId = value; },
  get autosearchTestingInProgress() { return autosearchState.autosearchTestingInProgress; },
  set autosearchTestingInProgress(value) { autosearchState.autosearchTestingInProgress = value; },
  get lastAutosearchTestingUrl() { return autosearchState.lastAutosearchTestingUrl; },
  set lastAutosearchTestingUrl(value) { autosearchState.lastAutosearchTestingUrl = value; },
  get autosearchTestingCooldown() { return autosearchState.autosearchTestingCooldown; },
  set autosearchTestingCooldown(value) { autosearchState.autosearchTestingCooldown = value; },
  get autosearchTestingCompleted() { return autosearchState.autosearchTestingCompleted; },
  set autosearchTestingCompleted(value) { autosearchState.autosearchTestingCompleted = value; },
  get lastProcessedTestingTicketId() { return autosearchState.lastProcessedTestingTicketId; },
  set lastProcessedTestingTicketId(value) { autosearchState.lastProcessedTestingTicketId = value; },
  get autosearchLastOrdersInProgress() { return autosearchState.autosearchLastOrdersInProgress; },
  set autosearchLastOrdersInProgress(value) { autosearchState.autosearchLastOrdersInProgress = value; },
  get lastAutosearchLastOrdersUrl() { return autosearchState.lastAutosearchLastOrdersUrl; },
  set lastAutosearchLastOrdersUrl(value) { autosearchState.lastAutosearchLastOrdersUrl = value; },
  get autosearchLastOrdersCooldown() { return autosearchState.autosearchLastOrdersCooldown; },
  set autosearchLastOrdersCooldown(value) { autosearchState.autosearchLastOrdersCooldown = value; },
  get autosearchLastOrdersCompleted() { return autosearchState.autosearchLastOrdersCompleted; },
  set autosearchLastOrdersCompleted(value) { autosearchState.autosearchLastOrdersCompleted = value; },
  get lastProcessedLastOrdersTicketId() { return autosearchState.lastProcessedLastOrdersTicketId; },
  set lastProcessedLastOrdersTicketId(value) { autosearchState.lastProcessedLastOrdersTicketId = value; },
  get autosearchPresetsDisabled() { return autosearchState.autosearchPresetsDisabled; },
  set autosearchPresetsDisabled(value) { autosearchState.autosearchPresetsDisabled = value; },
  get autosearchTestingDisabled() { return autosearchState.autosearchTestingDisabled; },
  set autosearchTestingDisabled(value) { autosearchState.autosearchTestingDisabled = value; },
  get autosearchLastOrdersDisabled() { return autosearchState.autosearchLastOrdersDisabled; },
  set autosearchLastOrdersDisabled(value) { autosearchState.autosearchLastOrdersDisabled = value; },
  get autosearchesLaunched() { return autosearchState.autosearchesLaunched; },
  set autosearchesLaunched(value) { autosearchState.autosearchesLaunched = value; },
  
  // Функции
  resetAutosearchState,
  checkNewTicketAndReset,
  performAutosearchPresets,
  performAutosearchTesting,
  performAutosearchLastOrders,
  resetDisabledFlags,
  
  // Новые функции для перезапуска автопоисков
  restartAutosearchPresets,
  restartAutosearchTesting,
  restartAutosearchLastOrders,
  restartAllAutosearches
};
