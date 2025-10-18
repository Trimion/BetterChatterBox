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

// Utils уже доступен через глобальный объект window.Utils

Utils.log('SMS Button script загружен');

// Глобальные флаги для отслеживания состояния
let newMailingButtonClicked = false;
let originSelectorClicked = false;
let russiaOptionSelected = false; // Новый флаг для отслеживания выбора России
let deliOptionSelected = false; // Новый флаг для отслеживания выбора Deli
let ticketInputFilled = false; // Новый флаг для отслеживания заполнения поля с ID тикета
let messageTextFilled = false; // Новый флаг для отслеживания заполнения текстового поля сообщения

// Функция для включения отладочного режима
function enableDebugMode() {
  Utils.log('Включение отладочного режима...');
  
  // Перехватываем XHR запросы для эмуляции успешных ответов
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    this._url = url;
    
    // Вызываем оригинальный метод open
    return originalXHROpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function(data) {
    const xhr = this;
    
    // Проверяем URL запроса
    if (xhr._url && (
      xhr._url.includes('/api/admin/feeds-admin/v1/ucommunications/self_list') ||
      xhr._url.includes('/api/admin/feeds-admin/v1/ucommunications/list')
    )) {
      Utils.log('Перехвачен запрос к API:', xhr._url);
      
      // Имитируем успешный ответ
      setTimeout(() => {
        Object.defineProperty(xhr, 'readyState', { value: 4, writable: false });
        Object.defineProperty(xhr, 'status', { value: 200, writable: false });
        Object.defineProperty(xhr, 'responseText', { 
          value: JSON.stringify({
            success: true,
            feeds: []
          }), 
          writable: false 
        });
        
        // Вызываем обработчики события
        xhr.onreadystatechange && xhr.onreadystatechange();
        xhr.onload && xhr.onload();
      }, 50);
      
      return;
    }
    
    // Выполняем оригинальный метод send для других запросов
    return originalXHRSend.call(this, data);
  };
  
  Utils.log('Отладочный режим включен');
}

// Функция для ожидания загрузки iframe
const waitForIframe = (timeout = 5000) => {
  return new Promise((resolve, reject) => {
    // Проверяем наличие iframe каждые 100 мс
    const checkForIframe = () => {
      const iframes = document.querySelectorAll('iframe');
      if (iframes.length > 0) {
        Utils.log(`Найдено ${iframes.length} iframe на странице`);
        resolve(Array.from(iframes));
        return true;
      }
      return false;
    };
    
    // Проверяем сразу
    if (checkForIframe()) {
      return;
    }
    
    // Настраиваем MutationObserver для отслеживания изменений DOM
    const observer = new MutationObserver(() => {
      if (checkForIframe()) {
        observer.disconnect();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Устанавливаем таймаут
    setTimeout(() => {
      observer.disconnect();
      
      // Если iframe еще не найден, проверяем еще раз перед отклонением
      if (!checkForIframe()) {
        reject(new Error(`Не удалось найти iframe за ${timeout}мс`));
      }
    }, timeout);
  });
}

// Функция для поиска и нажатия на кнопку "Новая рассылка"
function clickNewMailingButton() {
  // Если кнопка уже была нажата, не выполняем функцию
  if (newMailingButtonClicked) {
    logMessage('ИНФО', 'Кнопка "Новая рассылка" уже была нажата, пропускаем поиск');
    return;
  }
  
  logMessage('ИНФО', 'Ищем кнопку "Новая рассылка"...');
  
  try {
    // Проверяем наличие iframe на странице перед поиском кнопки
    reloadIframes()
      .then(iframes => {
        logMessage('УСПЕХ', `Поиск iframe на странице: Найдено ${iframes.length} iframe`);
        
        // Проверяем каждый iframe на наличие кнопки
        let buttonFound = false;
        
        for (let i = 0; i < iframes.length; i++) {
          try {
            const iframe = iframes[i];
            
            // Проверяем доступность contentDocument
            if (iframe.contentDocument) {
              // Ищем все кнопки в iframe
              const buttons = iframe.contentDocument.querySelectorAll('button');
              logMessage('ИНФО', `Анализируем ${buttons.length} кнопок в iframe[${i}]`);
              
              // Ищем кнопку с текстом "Новая рассылка"
              for (const button of buttons) {
                if (newMailingButtonClicked) {
                  buttonFound = true;
                  break;
                }
                
                if (button.innerText && button.innerText.includes('Новая рассылка')) {
                  logMessage('УСПЕХ', 'Найдена кнопка "Новая рассылка"');
                  logMessage('УСПЕХ', 'Нажимаем на кнопку "Новая рассылка"');
                  newMailingButtonClicked = true;
                  button.click();
                  buttonFound = true;
                  
                  // Запускаем поиск селектора Origin через 1 секунду
                  setTimeout(() => {
                    if (!originSelectorClicked) {
                      logMessage('ИНФО', 'Запускаем поиск селектора Origin');
                      findAndClickOriginSelector();
                    }
                  }, 500);
                  
                  break;
                }
                
                // Проверяем вложенные элементы
                const spans = button.querySelectorAll('span');
                for (const span of spans) {
                  if (newMailingButtonClicked) {
                    buttonFound = true;
                    break;
                  }
                  
                  if (span.innerText && span.innerText.includes('Новая рассылка')) {
                    logMessage('УСПЕХ', 'Найдена кнопка с вложенным текстом "Новая рассылка"');
                    logMessage('УСПЕХ', 'Нажимаем на кнопку "Новая рассылка"');
                    newMailingButtonClicked = true;
                    button.click();
                    buttonFound = true;
                    
                    // Запускаем поиск селектора Origin через 1 секунду
                    setTimeout(() => {
                      if (!originSelectorClicked) {
                        logMessage('ИНФО', 'Запускаем поиск селектора Origin');
                        findAndClickOriginSelector();
                      }
                    }, 500);
                    
                    break;
                  }
                }
                
                if (buttonFound) break;
              }
              
              if (buttonFound) break;
            }
          } catch (error) {
            logMessage('ОШИБКА', `Ошибка при доступе к iframe[${i}]: ${error.message}`);
          }
        }
        
        // Если кнопка не найдена ни в одном iframe, ищем в основном документе
        if (!buttonFound && !newMailingButtonClicked) {
          logMessage('ОШИБКА', 'Кнопка "Новая рассылка" не найдена в iframe: Пробуем искать в основном документе');
          searchInMainDocument();
        }
      })
      .catch(error => {
        logMessage('ОШИБКА', `Ошибка при поиске iframe: ${error.message}`);
        logMessage('ИНФО', 'Ищем в основном документе');
        searchInMainDocument();
      });
  } catch (error) {
    logMessage('ОШИБКА', `Ошибка при поиске кнопки "Новая рассылка": ${error.message}`);
    // Пробуем искать в основном документе как запасной вариант
    searchInMainDocument();
  }
}

// Функция для поиска кнопки в основном документе
function searchInMainDocument() {
  // Если кнопка уже была найдена и нажата, выходим
  if (newMailingButtonClicked) return;
  
  logMessage('ИНФО', 'Ищем кнопку в основном документе');
  
  // Ищем все кнопки в документе
  const buttons = document.querySelectorAll('button');
  logMessage('ИНФО', `Анализируем ${buttons.length} кнопок в основном документе`);
  
  // Ищем кнопку с текстом "Новая рассылка"
  let found = false;
  
  for (const button of buttons) {
    if (newMailingButtonClicked) return; // Проверяем флаг перед каждой кнопкой
    
    if (button.innerText && button.innerText.includes('Новая рассылка')) {
      logMessage('УСПЕХ', 'Найдена кнопка "Новая рассылка" в основном документе');
      logMessage('УСПЕХ', 'Нажимаем на кнопку "Новая рассылка"');
      newMailingButtonClicked = true; // Устанавливаем флаг перед нажатием
      button.click();
      found = true;
      
      // Запускаем поиск селектора Origin через 1 секунду
      setTimeout(() => {
        if (!originSelectorClicked) {
          logMessage('ИНФО', 'Запускаем поиск селектора Origin');
          findAndClickOriginSelector();
        }
      }, 500);
      
      break;
    }
    
    // Проверяем вложенные элементы
    const spans = button.querySelectorAll('span');
    let hasText = false;
    
    for (const span of spans) {
      if (span.innerText && span.innerText.includes('Новая рассылка')) {
        hasText = true;
        break;
      }
    }
    
    if (hasText) {
      logMessage('УСПЕХ', 'Найдена кнопка с вложенным текстом "Новая рассылка" в основном документе');
      logMessage('УСПЕХ', 'Нажимаем на кнопку "Новая рассылка"');
      newMailingButtonClicked = true; // Устанавливаем флаг перед нажатием
      button.click();
      found = true;
      
      // Запускаем поиск селектора Origin через 1 секунду
      setTimeout(() => {
        if (!originSelectorClicked) {
          logMessage('ИНФО', 'Запускаем поиск селектора Origin');
          findAndClickOriginSelector();
        }
      }, 500);
      
      break;
    }
  }
  
  if (!found && !newMailingButtonClicked) {
    logMessage('ОШИБКА', 'Кнопка "Новая рассылка" не найдена на странице');
    
    // Активируем восстановление процесса через 2 секунды, если кнопка не была найдена
    setTimeout(() => {
      if (!newMailingButtonClicked) {
        logMessage('ИНФО', 'Повторная попытка восстановления процесса после неудачного поиска кнопки');
        recoveryProcess();
      }
    }, 2000);
  }
}

// Функция для выбора России в выпадающем меню
function selectRussiaOption() {
  // Если Russia уже выбрана, не выполняем функцию
  if (russiaOptionSelected) {
    Utils.log('Опция Russia уже была выбрана, пропускаем поиск');
    return;
  }
  
  Utils.log('Ищем поле ввода и опцию Russia в выпадающем меню...');
  
  // Создаем MutationObserver для наблюдения за изменениями DOM
  const observer = new MutationObserver((mutations) => {
    if (russiaOptionSelected) {
      observer.disconnect();
      return;
    }
    
    // Ищем поле ввода в iframe
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        if (russiaOptionSelected) {
          observer.disconnect();
          return;
        }
        
        if (iframe.contentDocument) {
          // Ищем поле ввода для фильтра
          const filterInput = iframe.contentDocument.querySelector('.g-text-input__control.g-text-input__control_type_input.g-select-filter__input');
          if (filterInput) {
            Utils.log('Найдено поле ввода для фильтра:', filterInput);
            
            // Вводим "Russia" в поле фильтра
            filterInput.value = 'Russia';
            
            // Вызываем событие ввода для активации фильтрации
            const inputEvent = new Event('input', { bubbles: true });
            filterInput.dispatchEvent(inputEvent);
            
            Utils.log('Введено значение "Russia" в поле фильтра');
            
            // Даем немного времени для обработки ввода и появления отфильтрованных результатов
            setTimeout(() => {
              // Ищем опцию Russia в выпадающем меню
              const russiaOption = iframe.contentDocument.querySelector('span.g-select-list__option-default-label');
              if (russiaOption && russiaOption.textContent === 'Russia') {
                Utils.log('Найдена опция Russia:', russiaOption);
                Utils.log('Выбираем опцию Russia');
                russiaOptionSelected = true;
                russiaOption.click();
                observer.disconnect();
                
                // Запускаем выбор Deli после выбора Russia
                setTimeout(() => {
                  selectDeliOption();
                }, 250);
                
                return;
              }
              
              // Если не найдена точная опция, попробуем найти все опции и выбрать подходящую
              const allOptions = iframe.contentDocument.querySelectorAll('span.g-select-list__option-default-label');
              Utils.log(`Найдено ${allOptions.length} опций в списке`);
              
              for (const option of allOptions) {
                if (option.textContent === 'Russia') {
                  Utils.log('Найдена опция Russia среди всех опций:', option);
                  Utils.log('Выбираем опцию Russia');
                  russiaOptionSelected = true;
                  option.click();
                  observer.disconnect();
                  
                  // Запускаем выбор Deli после выбора Russia
                  setTimeout(() => {
                    selectDeliOption();
                  }, 250);
                  
                  return;
                }
              }
            }, 300);
          }
        }
      } catch (error) {
        Utils.error('Ошибка при поиске поля ввода в iframe:', error);
      }
    }
  });
  
  // Запускаем наблюдение за изменениями DOM
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Функция прямого поиска поля ввода и опции Russia
  function directSearchForRussiaOption() {
    const iframes = document.querySelectorAll('iframe');
    
    for (const iframe of iframes) {
      try {
        if (russiaOptionSelected) return true;
        
        if (iframe.contentDocument) {
          // Ищем поле ввода для фильтра
          const filterInput = iframe.contentDocument.querySelector('.g-text-input__control.g-text-input__control_type_input.g-select-filter__input');
          if (filterInput) {
            Utils.log('Найдено поле ввода для фильтра напрямую:', filterInput);
            
            // Вводим "Russia" в поле фильтра
            filterInput.value = 'Russia';
            
            // Вызываем событие ввода для активации фильтрации
            const inputEvent = new Event('input', { bubbles: true });
            filterInput.dispatchEvent(inputEvent);
            
            Utils.log('Введено значение "Russia" в поле фильтра');
            
            // Даем немного времени для обработки ввода и появления отфильтрованных результатов
            setTimeout(() => {
              // Ищем опцию Russia в выпадающем меню
              const russiaOption = iframe.contentDocument.querySelector('span.g-select-list__option-default-label');
              if (russiaOption && russiaOption.textContent === 'Russia') {
                Utils.log('Найдена опция Russia напрямую:', russiaOption);
                Utils.log('Выбираем опцию Russia');
                russiaOptionSelected = true;
                russiaOption.click();
                observer.disconnect();
                
                // Запускаем выбор Deli после выбора Russia
                setTimeout(() => {
                  selectDeliOption();
                }, 250);
                
                return true;
              }
              
              // Если не найдена точная опция, попробуем найти все опции и выбрать подходящую
              const allOptions = iframe.contentDocument.querySelectorAll('span.g-select-list__option-default-label');
              Utils.log(`Найдено ${allOptions.length} опций в списке напрямую`);
              
              for (const option of allOptions) {
                if (option.textContent === 'Russia') {
                  Utils.log('Найдена опция Russia среди всех опций напрямую:', option);
                  Utils.log('Выбираем опцию Russia');
                  russiaOptionSelected = true;
                  option.click();
                  observer.disconnect();
                  
                  // Запускаем выбор Deli после выбора Russia
                  setTimeout(() => {
                    selectDeliOption();
                  }, 250);
                  
                  return true;
                }
              }
            }, 300);
            
            return true;
          }
        }
              } catch (error) {
          Utils.error('Ошибка при прямом поиске поля ввода в iframe:', error);
        }
    }
    
    return false;
  }
  
  // Сразу пытаемся найти поле ввода и опцию Russia
  directSearchForRussiaOption();
  
  // Периодически повторяем поиск
  const searchInterval = setInterval(() => {
    if (directSearchForRussiaOption() || russiaOptionSelected) {
      clearInterval(searchInterval);
    }
  }, 250);
  
  // Останавливаем поиск через 10 секунд, если опция не найдена
  setTimeout(() => {
    if (!russiaOptionSelected) {
      Utils.error('Опция Russia не найдена после 10 секунд поиска');
    }
    clearInterval(searchInterval);
    observer.disconnect();
  }, 10000);
}

// Функция для выбора Deli в выпадающем меню
function selectDeliOption() {
  // Если Deli уже выбрана, не выполняем функцию
  if (deliOptionSelected) {
    Utils.log('Опция Deli уже была выбрана, пропускаем поиск');
    return;
  }
  
  Utils.log('Ищем селектор Intent и опцию Deli в выпадающем меню...');
  
  // Создаем MutationObserver для наблюдения за изменениями DOM
  const observer = new MutationObserver((mutations) => {
    if (deliOptionSelected) {
      observer.disconnect();
      return;
    }
    
    // Ищем селектор Intent в iframe
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        if (deliOptionSelected) {
          observer.disconnect();
          return;
        }
        
        if (iframe.contentDocument) {
          // Проверяем, открыто ли выпадающее меню Intent
          const intentInput = iframe.contentDocument.querySelector('.g-text-input__control.g-text-input__control_type_input.g-select-filter__input[aria-controls="select-popup-intent"]');
          
          // Если поле ввода уже открыто, вводим "Deli"
          if (intentInput) {
            Utils.log('Найдено поле ввода для Intent:', intentInput);
            
            // Вводим "Deli" в поле фильтра
            intentInput.value = 'Deli';
            
            // Вызываем событие ввода для активации фильтрации
            const inputEvent = new Event('input', { bubbles: true });
            intentInput.dispatchEvent(inputEvent);
            
            Utils.log('Введено значение "Deli" в поле фильтра Intent');
            
            // Даем немного времени для обработки ввода и появления отфильтрованных результатов
            setTimeout(() => {
              // Ищем все опции в выпадающем меню
              const allOptions = iframe.contentDocument.querySelectorAll('span.g-select-list__option-default-label');
              Utils.log(`Найдено ${allOptions.length} опций в списке Intent`);
              
              // Ищем точное совпадение "Deli"
              for (const option of allOptions) {
                if (option.textContent === 'Deli') {
                  Utils.log('Найдена точная опция Deli:', option);
                  Utils.log('Выбираем опцию Deli');
                  deliOptionSelected = true;
                  option.click();
                  observer.disconnect();
                  
                  // Запускаем заполнение поля тикета после выбора Deli
                  setTimeout(() => {
                    fillTicketField();
                  }, 250);
                  
                  return;
                }
              }
            }, 300);
          } else {
            // Если поле ввода не открыто, ищем ПУСТУЮ кнопку Intent и нажимаем на нее
            // Используем селектор :empty для поиска пустой кнопки или :not(:has(*)) как альтернативу
            const intentButton = iframe.contentDocument.querySelector('button#intent[role="combobox"]:empty, button#intent[role="combobox"]:not(:has(*))');
            if (intentButton) {
              Utils.log('Найдена ПУСТАЯ кнопка Intent:', intentButton);
              Utils.log('Нажимаем на ПУСТУЮ кнопку Intent');
              intentButton.click();
            }
          }
        }
              } catch (error) {
          Utils.error('Ошибка при поиске селектора Intent в iframe:', error);
        }
    }
  });
  
  // Запускаем наблюдение за изменениями DOM
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Функция прямого поиска селектора Intent и опции Deli
  function directSearchForDeliOption() {
    const iframes = document.querySelectorAll('iframe');
    
    for (const iframe of iframes) {
      try {
        if (deliOptionSelected) return true;
        
        if (iframe.contentDocument) {
          // Проверяем, открыто ли выпадающее меню Intent
          const intentInput = iframe.contentDocument.querySelector('.g-text-input__control.g-text-input__control_type_input.g-select-filter__input[aria-controls="select-popup-intent"]');
          
          // Если поле ввода уже открыто, вводим "Deli"
          if (intentInput) {
            Utils.log('Найдено поле ввода для Intent напрямую:', intentInput);
            
            // Вводим "Deli" в поле фильтра
            intentInput.value = 'Deli';
            
            // Вызываем событие ввода для активации фильтрации
            const inputEvent = new Event('input', { bubbles: true });
            intentInput.dispatchEvent(inputEvent);
            
            Utils.log('Введено значение "Deli" в поле фильтра Intent напрямую');
            
            // Даем немного времени для обработки ввода и появления отфильтрованных результатов
            setTimeout(() => {
              // Ищем все опции в выпадающем меню
              const allOptions = iframe.contentDocument.querySelectorAll('span.g-select-list__option-default-label');
              Utils.log(`Найдено ${allOptions.length} опций в списке Intent напрямую`);
              
              // Ищем точное совпадение "Deli"
              for (const option of allOptions) {
                if (option.textContent === 'Deli') {
                  Utils.log('Найдена точная опция Deli напрямую:', option);
                  Utils.log('Выбираем опцию Deli');
                  deliOptionSelected = true;
                  option.click();
                  observer.disconnect();
                  
                  // Запускаем заполнение поля тикета после выбора Deli
                  setTimeout(() => {
                    fillTicketField();
                  }, 250);
                  
                  return true;
                }
              }
            }, 300);
            
            return true;
          } else {
            // Если поле ввода не открыто, ищем ПУСТУЮ кнопку Intent и нажимаем на нее
            // Используем селектор :empty для поиска пустой кнопки или :not(:has(*)) как альтернативу
            const intentButton = iframe.contentDocument.querySelector('button#intent[role="combobox"]:empty, button#intent[role="combobox"]:not(:has(*))');
            if (intentButton) {
              Utils.log('Найдена ПУСТАЯ кнопка Intent напрямую:', intentButton);
              Utils.log('Нажимаем на ПУСТУЮ кнопку Intent');
              intentButton.click();
              return false; // Возвращаем false, чтобы продолжить поиск в следующей итерации
            }
          }
        }
              } catch (error) {
          Utils.error('Ошибка при прямом поиске селектора Intent в iframe:', error);
        }
    }
    
    return false;
  }
  
  // Сразу пытаемся найти селектор Intent и опцию Deli
  directSearchForDeliOption();
  
  // Периодически повторяем поиск
  const searchInterval = setInterval(() => {
    if (directSearchForDeliOption() || deliOptionSelected) {
      clearInterval(searchInterval);
    }
  }, 250);
  
  // Останавливаем поиск через 10 секунд, если опция не найдена
  setTimeout(() => {
    if (!deliOptionSelected) {
      Utils.error('Опция Deli не найдена после 10 секунд поиска');
    }
    clearInterval(searchInterval);
    observer.disconnect();
  }, 10000);
}

// Модифицируем функцию findAndClickOriginSelector для запуска выбора Russia после нажатия на селектор
function findAndClickOriginSelector() {
  // Если селектор Origin уже был нажат, не выполняем функцию
  if (originSelectorClicked) {
    Utils.log('Селектор Origin уже был нажат, пропускаем поиск');
    return;
  }
  
  Utils.log('Ищем селектор Origin...');
  
  // Создаем переменные для хранения таймеров и observer
  let searchInterval = null;
  let timeoutId = null;
  const observer = new MutationObserver((mutations) => {
    // Если селектор уже был нажат, останавливаем observer
    if (originSelectorClicked) {
      observer.disconnect();
      return;
    }
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Ищем селектор в iframe
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
          try {
            if (originSelectorClicked) {
              observer.disconnect();
              return;
            }
            
            if (iframe.contentDocument) {
              const originButton = iframe.contentDocument.querySelector('button#origin:not(:has(*))');
              if (originButton) {
                Utils.log('MutationObserver: Найден пустой селектор Origin:', originButton);
                Utils.log('Нажимаем на селектор Origin');
                originSelectorClicked = true;
                originButton.click();
                
                // Очищаем все таймеры и останавливаем observer
                observer.disconnect();
                if (searchInterval) clearInterval(searchInterval);
                if (timeoutId) clearTimeout(timeoutId);
                
                // Запускаем выбор Russia после короткой задержки
                setTimeout(() => {
                  selectRussiaOption();
                }, 250);
                
                return;
              }
            }
          } catch (error) {
            // Игнорируем ошибки доступа к iframe
          }
        }
        
        // Ищем в основном документе
        if (!originSelectorClicked) {
          const originButton = document.querySelector('button#origin:not(:has(*))');
          if (originButton) {
            Utils.log('MutationObserver: Найден пустой селектор Origin в основном документе:', originButton);
            Utils.log('Нажимаем на селектор Origin');
            originSelectorClicked = true;
            originButton.click();
            
            // Очищаем все таймеры и останавливаем observer
            observer.disconnect();
            if (searchInterval) clearInterval(searchInterval);
            if (timeoutId) clearTimeout(timeoutId);
            
            // Запускаем выбор Russia после короткой задержки
            setTimeout(() => {
              selectRussiaOption();
            }, 250);
            
            return;
          }
        }
      }
    }
  });
  
  // Запускаем наблюдение за изменениями DOM
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Функция для прямого поиска селектора Origin с минимальными задержками
  function directSearchForOrigin() {
    // Если селектор уже был нажат, отменяем операцию
    if (originSelectorClicked) {
      return true;
    }
    
    // Проверяем наличие iframe
    const iframes = document.querySelectorAll('iframe');
    
    // Проверяем каждый iframe
    for (const iframe of iframes) {
      try {
        if (originSelectorClicked) return true;
        
        if (iframe.contentDocument) {
          // Используем самый точный селектор для пустой кнопки
          const originButton = iframe.contentDocument.querySelector('button#origin:not(:has(*))');
          
          if (originButton) {
            Utils.log('Найден пустой селектор Origin напрямую:', originButton);
            Utils.log('Нажимаем на селектор Origin');
            originSelectorClicked = true;
            originButton.click();
            
            // Очищаем все таймеры и останавливаем observer
            observer.disconnect();
            if (searchInterval) clearInterval(searchInterval);
            if (timeoutId) clearTimeout(timeoutId);
            
            // Запускаем выбор Russia после короткой задержки
            setTimeout(() => {
              selectRussiaOption();
            }, 250);
            
            return true;
          }
          
          if (originSelectorClicked) return true;
          
          // Альтернативный метод поиска
          const originControls = iframe.contentDocument.querySelectorAll('.g-select-control');
          for (const control of originControls) {
            if (originSelectorClicked) return true;
            
            const button = control.querySelector('button#origin');
            if (button && button.children.length === 0) {
              Utils.log('Найден селектор Origin через родительский контейнер напрямую:', button);
              Utils.log('Нажимаем на селектор Origin');
              originSelectorClicked = true;
              button.click();
              
              // Очищаем все таймеры и останавливаем observer
              observer.disconnect();
              if (searchInterval) clearInterval(searchInterval);
              if (timeoutId) clearTimeout(timeoutId);
              
              // Запускаем выбор Russia после короткой задержки
              setTimeout(() => {
                selectRussiaOption();
              }, 250);
              
              return true;
            }
          }
        }
      } catch (error) {
        // Игнорируем ошибки доступа к iframe
      }
    }
    
    // Ищем в основном документе
    if (!originSelectorClicked) {
      const originButton = document.querySelector('button#origin:not(:has(*))');
      if (originButton) {
        Utils.log('Найден пустой селектор Origin в основном документе напрямую:', originButton);
        Utils.log('Нажимаем на селектор Origin');
        originSelectorClicked = true;
        originButton.click();
        
        // Очищаем все таймеры и останавливаем observer
        observer.disconnect();
        if (searchInterval) clearInterval(searchInterval);
        if (timeoutId) clearTimeout(timeoutId);
        
        // Запускаем выбор Russia после короткой задержки
        setTimeout(() => {
          selectRussiaOption();
        }, 250);
        
        return true;
      }
    }
    
    // Альтернативный метод поиска в основном документе
    if (!originSelectorClicked) {
      const originControls = document.querySelectorAll('.g-select-control');
      for (const control of originControls) {
        if (originSelectorClicked) return true;
        
        const button = control.querySelector('button#origin');
        if (button && button.children.length === 0) {
          Utils.log('Найден селектор Origin через родительский контейнер в основном документе напрямую:', button);
          Utils.log('Нажимаем на селектор Origin');
          originSelectorClicked = true;
          button.click();
          
          // Очищаем все таймеры и останавливаем observer
          observer.disconnect();
          if (searchInterval) clearInterval(searchInterval);
          if (timeoutId) clearTimeout(timeoutId);
          
          // Запускаем выбор Russia после короткой задержки
          setTimeout(() => {
            selectRussiaOption();
          }, 250);
          
          return true;
        }
      }
    }
    
    return originSelectorClicked;
  }
  
  // Сразу пытаемся найти кнопку
  if (directSearchForOrigin()) {
    return;
  }
  
  // Повторяем поиск с короткими интервалами
  searchInterval = setInterval(() => {
    if (directSearchForOrigin() || originSelectorClicked) {
      clearInterval(searchInterval);
    }
  }, 250);
  
  // Останавливаем поиск через 10 секунд, если кнопка не найдена
  timeoutId = setTimeout(() => {
    clearInterval(searchInterval);
    observer.disconnect();
    if (!originSelectorClicked) {
      Utils.error('Селектор Origin не найден после 10 секунд поиска');
    }
  }, 10000);
}

// Функция для вставки ID тикета в поле ticket
function fillTicketField() {
  // Если поле тикета уже заполнено, не выполняем функцию
  if (ticketInputFilled) {
    Utils.log('Поле с ID тикета уже заполнено, пропускаем поиск');
    return;
  }
  
  Utils.log('Ищем поле ввода для ID тикета...');
  
  // Создаем MutationObserver для наблюдения за изменениями DOM
  const observer = new MutationObserver((mutations) => {
    if (ticketInputFilled) {
      observer.disconnect();
      return;
    }
    
    // Ищем поле ввода в iframe
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        if (ticketInputFilled) {
          observer.disconnect();
          return;
        }
        
        if (iframe.contentDocument) {
          // Ищем поле ввода для ID тикета по атрибутам name="ticket" или по классу и атрибуту name
          const ticketInput = iframe.contentDocument.querySelector('input[name="ticket"], input.g-text-input__control[name="ticket"]');
          if (ticketInput) {
            Utils.log('Найдено поле ввода для ID тикета:', ticketInput);
            
            // Получаем сохраненный ID тикета из локального хранилища
            chrome.storage.local.get(['smsTicketId'], (result) => {
              const ticketId = result.smsTicketId || 'ID_ТИКЕТА';
              Utils.log('Получен ID тикета из хранилища:', ticketId);
              
              // Формируем ссылку на тикет
              const ticketLink = `https://supchat.taxi.yandex-team.ru/chat/${ticketId}`;
              
              // Вставляем ссылку в поле ввода
              ticketInput.value = ticketLink;
              
              // Вызываем событие ввода для активации обработчиков формы
              const inputEvent = new Event('input', { bubbles: true });
              ticketInput.dispatchEvent(inputEvent);
              
              Utils.log('Ссылка на тикет вставлена в поле:', ticketLink);
              
              // Устанавливаем флаг, что поле заполнено
              ticketInputFilled = true;
              observer.disconnect();
              
              // Запускаем заполнение текстового поля сообщения после заполнения поля тикета
              setTimeout(() => {
                fillMessageText();
              }, 250);
            });
          }
        }
              } catch (error) {
          Utils.error('Ошибка при поиске поля ввода для ID тикета в iframe:', error);
        }
    }
  });
  
  // Запускаем наблюдение за изменениями DOM
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Функция прямого поиска поля ввода для ID тикета
  function directSearchForTicketInput() {
    const iframes = document.querySelectorAll('iframe');
    
    for (const iframe of iframes) {
      try {
        if (ticketInputFilled) return true;
        
        if (iframe.contentDocument) {
          // Ищем поле ввода для ID тикета по атрибутам name="ticket" или по классу и атрибуту name
          const ticketInput = iframe.contentDocument.querySelector('input[name="ticket"], input.g-text-input__control[name="ticket"]');
          if (ticketInput) {
            Utils.log('Найдено поле ввода для ID тикета напрямую:', ticketInput);
            
            // Получаем сохраненный ID тикета из локального хранилища
            chrome.storage.local.get(['smsTicketId'], (result) => {
              const ticketId = result.smsTicketId || 'ID_ТИКЕТА';
              Utils.log('Получен ID тикета из хранилища:', ticketId);
              
              // Формируем ссылку на тикет
              const ticketLink = `https://supchat.taxi.yandex-team.ru/chat/${ticketId}`;
              
              // Вставляем ссылку в поле ввода
              ticketInput.value = ticketLink;
              
              // Вызываем событие ввода для активации обработчиков формы
              const inputEvent = new Event('input', { bubbles: true });
              ticketInput.dispatchEvent(inputEvent);
              
              Utils.log('Ссылка на тикет вставлена в поле:', ticketLink);
              
              // Устанавливаем флаг, что поле заполнено
              ticketInputFilled = true;
              observer.disconnect();
              
              // Запускаем заполнение текстового поля сообщения после заполнения поля тикета
              setTimeout(() => {
                fillMessageText();
              }, 250);
            });
            
            return true;
          }
        }
              } catch (error) {
          Utils.error('Ошибка при прямом поиске поля ввода для ID тикета в iframe:', error);
        }
    }
    
    return false;
  }
  
  // Сразу пытаемся найти поле ввода для ID тикета
  directSearchForTicketInput();
  
  // Периодически повторяем поиск
  const searchInterval = setInterval(() => {
    if (directSearchForTicketInput() || ticketInputFilled) {
      clearInterval(searchInterval);
    }
  }, 250);
  
  // Останавливаем поиск через 10 секунд, если поле не найдено
  setTimeout(() => {
    if (!ticketInputFilled) {
      Utils.error('Поле ввода для ID тикета не найдено после 10 секунд поиска');
    }
    clearInterval(searchInterval);
    observer.disconnect();
  }, 10000);
}

// Функция для заполнения текстового поля сообщения
function fillMessageText() {
  // Если текстовое поле уже заполнено, не выполняем функцию
  if (messageTextFilled) {
    Utils.log('Текстовое поле сообщения уже заполнено, пропускаем поиск');
    return;
  }
  
  Utils.log('Ищем текстовое поле для сообщения...');
  
  // Создаем MutationObserver для наблюдения за изменениями DOM
  const observer = new MutationObserver((mutations) => {
    if (messageTextFilled) {
      observer.disconnect();
      return;
    }
    
    // Ищем текстовое поле в iframe
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        if (messageTextFilled) {
          observer.disconnect();
          return;
        }
        
        if (iframe.contentDocument) {
          // Ищем текстовое поле для сообщения по атрибутам class и name
          const messageTextarea = iframe.contentDocument.querySelector('textarea.g-text-area__control[name="payload.text"]');
          if (messageTextarea) {
            Utils.log('Найдено текстовое поле для сообщения:', messageTextarea);
            
            // Получаем сохраненный тип SMS и пользовательские тексты из локального хранилища
            chrome.storage.local.get(['smsType', 'smsTexts'], (result) => {
              const smsType = result.smsType || 'part_delivery'; // По умолчанию "Часть посылки"
              Utils.log('Получен тип SMS из хранилища:', smsType);
              
              // Значения текстов СМС по умолчанию
              const defaultSmsTexts = {
                part_delivery: 'Курьер сообщил, что он доставил вам посылку не в полном объёме. Пожалуйста, свяжитесь с ним по номеру: НОМЕР_КУРЬЕРА',
                personal_item: 'Курьер сообщил, что у него остались ваши личные вещи после заказа. Пожалуйста, свяжитесь с ним по номеру: НОМЕР_КУРЬЕРА',
                ask_to_close: 'Курьер сообщил, что передал вам посылку, поэтому заказ будет закрыт. Пожалуйста, свяжитесь с отправителем, если это не так.',
                damaged_item: 'Сожалею, но курьер повредил ваш заказ. Пожалуйста, напишите в службу поддержки по вопросу компенсации.',
                accident: 'К вам направляется новый курьер: НОМЕР_АВТОМОБИЛЯ, МАРКА_АВТОМОБИЛЯ, ЦВЕТ_АВТОМОБИЛЯ.'
              };
              
              // Используем пользовательские тексты, если они есть, или значения по умолчанию
              const smsTexts = result.smsTexts || defaultSmsTexts;
              const messageText = smsTexts[smsType] || defaultSmsTexts[smsType];
              
              // Вставляем текст в текстовое поле
              messageTextarea.value = messageText;
              
              // Вызываем событие ввода для активации обработчиков формы
              const inputEvent = new Event('input', { bubbles: true });
              messageTextarea.dispatchEvent(inputEvent);
              
              Utils.log('Текст сообщения вставлен в поле:', messageText);
              
              // Устанавливаем флаг, что поле заполнено
              messageTextFilled = true;
              observer.disconnect();
              
              // Удаляем smsType из localStorage, чтобы предотвратить 
              // автоматическое заполнение при следующем открытии страницы
              chrome.storage.local.remove('smsType', () => {
                Utils.log('Тип SMS удален из хранилища для предотвращения автоматического заполнения в будущем');
              });
            });
          }
        }
              } catch (error) {
          Utils.error('Ошибка при поиске текстового поля для сообщения в iframe:', error);
        }
    }
  });
  
  // Запускаем наблюдение за изменениями DOM
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Функция прямого поиска текстового поля для сообщения
  function directSearchForMessageTextarea() {
    const iframes = document.querySelectorAll('iframe');
    
    for (const iframe of iframes) {
      try {
        if (messageTextFilled) return true;
        
        if (iframe.contentDocument) {
          // Ищем текстовое поле для сообщения по атрибутам class и name
          const messageTextarea = iframe.contentDocument.querySelector('textarea.g-text-area__control[name="payload.text"]');
          if (messageTextarea) {
            Utils.log('Найдено текстовое поле для сообщения напрямую:', messageTextarea);
            
            // Получаем сохраненный тип SMS и пользовательские тексты из локального хранилища
            chrome.storage.local.get(['smsType', 'smsTexts'], (result) => {
              const smsType = result.smsType || 'part_delivery'; // По умолчанию "Часть посылки"
              Utils.log('Получен тип SMS из хранилища:', smsType);
              
              // Значения текстов СМС по умолчанию
              const defaultSmsTexts = {
                part_delivery: 'Курьер сообщил, что он доставил вам посылку не в полном объёме. Пожалуйста, свяжитесь с ним по номеру: НОМЕР_КУРЬЕРА',
                personal_item: 'Курьер сообщил, что у него остались ваши личные вещи после заказа. Пожалуйста, свяжитесь с ним по номеру: НОМЕР_КУРЬЕРА',
                ask_to_close: 'Курьер сообщил, что передал вам посылку, поэтому заказ будет закрыт. Пожалуйста, свяжитесь с отправителем, если это не так.',
                damaged_item: 'Сожалею, но курьер повредил ваш заказ. Пожалуйста, напишите в службу поддержки по вопросу компенсации.',
                accident: 'К вам направляется новый курьер: НОМЕР_АВТОМОБИЛЯ, МАРКА_АВТОМОБИЛЯ, ЦВЕТ_АВТОМОБИЛЯ.'
              };
              
              // Используем пользовательские тексты, если они есть, или значения по умолчанию
              const smsTexts = result.smsTexts || defaultSmsTexts;
              const messageText = smsTexts[smsType] || defaultSmsTexts[smsType];
              
              // Вставляем текст в текстовое поле
              messageTextarea.value = messageText;
              
              // Вызываем событие ввода для активации обработчиков формы
              const inputEvent = new Event('input', { bubbles: true });
              messageTextarea.dispatchEvent(inputEvent);
              
              Utils.log('Текст сообщения вставлен в поле:', messageText);
              
              // Устанавливаем флаг, что поле заполнено
              messageTextFilled = true;
              
              // Удаляем smsType из localStorage, чтобы предотвратить 
              // автоматическое заполнение при следующем открытии страницы
              chrome.storage.local.remove('smsType', () => {
                Utils.log('Тип SMS удален из хранилища для предотвращения автоматического заполнения в будущем');
              });
            });
            
            return true;
          }
        }
              } catch (error) {
          Utils.error('Ошибка при прямом поиске текстового поля для сообщения в iframe:', error);
        }
    }
    
    return false;
  }
  
  // Сразу пытаемся найти текстовое поле для сообщения
  directSearchForMessageTextarea();
  
  // Периодически повторяем поиск
  const searchInterval = setInterval(() => {
    if (directSearchForMessageTextarea() || messageTextFilled) {
      clearInterval(searchInterval);
    }
  }, 250);
  
  // Останавливаем поиск через 10 секунд, если поле не найдено
  setTimeout(() => {
    if (!messageTextFilled) {
      Utils.error('Текстовое поле для сообщения не найдено после 10 секунд поиска');
    }
    clearInterval(searchInterval);
    observer.disconnect();
  }, 10000);
}

// Функция для одновременного поиска нескольких элементов для оптимизации процесса
function findMultipleElements() {
  Utils.log('Запускаем ускоренный поиск всех элементов формы...');
  
  // Ищем все iframe на странице
  const iframes = document.querySelectorAll('iframe');
  
  for (const iframe of iframes) {
    try {
      if (iframe.contentDocument) {
        // Поиск кнопки "Новая рассылка"
        if (!newMailingButtonClicked) {
          const buttons = iframe.contentDocument.querySelectorAll('button');
          for (const button of buttons) {
            if (button.innerText && button.innerText.includes('Новая рассылка')) {
              Utils.log('Ускоренный поиск: Найдена кнопка "Новая рассылка"');
              newMailingButtonClicked = true;
              button.click();
              break;
            }
            
            const spans = button.querySelectorAll('span');
            for (const span of spans) {
              if (span.innerText && span.innerText.includes('Новая рассылка')) {
                Utils.log('Ускоренный поиск: Найдена кнопка с вложенным текстом "Новая рассылка"');
                newMailingButtonClicked = true;
                button.click();
                break;
              }
            }
          }
        }
        
        // Поиск селектора Origin
        if (newMailingButtonClicked && !originSelectorClicked) {
          const labels = iframe.contentDocument.querySelectorAll('label');
          for (const label of labels) {
            if (label.innerText && label.innerText.includes('Origin')) {
              Utils.log('Ускоренный поиск: Найден селектор Origin');
              const parentElement = label.closest('.g-select');
              if (parentElement) {
                const selectButton = parentElement.querySelector('.g-select__button');
                if (selectButton) {
                  originSelectorClicked = true;
                  selectButton.click();
                  break;
                }
              }
            }
          }
        }
        
        // Поиск и выбор опции Russia, если Origin селектор уже выбран
        if (originSelectorClicked && !russiaOptionSelected) {
          const options = iframe.contentDocument.querySelectorAll('span.g-select-list__option-default-label');
          for (const option of options) {
                          if (option.textContent === 'Russia') {
                Utils.log('Ускоренный поиск: Найдена опция Russia');
              russiaOptionSelected = true;
              option.click();
              break;
            }
          }
        }
        
        // Поиск и выбор опции Deli, если Russia уже выбрана
        if (russiaOptionSelected && !deliOptionSelected) {
          const options = iframe.contentDocument.querySelectorAll('span.g-select-list__option-default-label');
          for (const option of options) {
            if (option.textContent === 'Deli') {
              Utils.log('Ускоренный поиск: Найдена опция Deli');
              deliOptionSelected = true;
              option.click();
              break;
            }
          }
        }
        
        // Поиск поля ввода для ID тикета
        if (deliOptionSelected && !ticketInputFilled) {
          const inputs = iframe.contentDocument.querySelectorAll('input[name="ticket"]');
          if (inputs.length > 0) {
            Utils.log('Ускоренный поиск: Найдено поле ввода для ID тикета');
            // Получаем ID тикета из хранилища
            chrome.storage.local.get(['smsTicketId'], (result) => {
              const ticketId = result.smsTicketId || 'ID_ТИКЕТА';
              inputs[0].value = ticketId;
              ticketInputFilled = true;
              
              // Вызываем событие ввода и изменения для активации проверки формы
              inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
              inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
              
              Utils.log('Заполнено поле ID тикета:', ticketId);
            });
          }
        }
        
        // Поиск текстового поля для сообщения
        if (ticketInputFilled && !messageTextFilled) {
          const textareas = iframe.contentDocument.querySelectorAll('textarea[name="payload.text"]');
          if (textareas.length > 0) {
            Utils.log('Ускоренный поиск: Найдено текстовое поле для сообщения');
            
            // Получаем тип SMS из хранилища
            chrome.storage.local.get(['smsType', 'smsTexts'], (result) => {
              let messageText = '';
              const smsType = result.smsType || 'default';
              
              // Выбираем текст в зависимости от типа SMS
              switch(smsType) {
                case 'part_delivery':
                  messageText = 'Здравствуйте! Мы получили обращение, что сегодня вам передали не все товары из заказа. Пожалуйста, подскажите, каких товаров не хватает, и мы обязательно разберёмся в ситуации. С уважением, команда Яндекс Доставки';
                  break;
                case 'personal_item':
                  messageText = 'Здравствуйте! Мы получили обращение, что вместе с заказом вам по ошибке передали личную вещь курьера. Пожалуйста, подскажите, как мы можем забрать эту вещь? С уважением, команда Яндекс Доставки';
                  break;
                case 'ask_to_close':
                  messageText = 'Здравствуйте! Нам поступила информация, что вы просите водителя закрыть заказ. К сожалению, водитель не может сделать это без передачи товара. Если у вас есть какие-то вопросы по заказу, мы готовы помочь. С уважением, команда Яндекс Доставки';
                  break;
                case 'damaged_item':
                  messageText = 'Здравствуйте! Нам очень жаль, что товар доставлен с повреждениями. Пожалуйста, сфотографируйте упаковку и повреждения товара, чтобы мы могли компенсировать вам ущерб. С уважением, команда Яндекс Доставки';
                  break;
                case 'accident':
                  messageText = 'Здравствуйте! К сожалению, автомобиль нашего водителя попал в ДТП, и доставка вашего заказа откладывается. Приносим извинения за неудобства. Мы свяжемся с вами, как только появится возможность доставить заказ. С уважением, команда Яндекс Доставки';
                  break;
                default:
                  messageText = 'Здравствуйте! Спасибо за обращение в службу поддержки Яндекс Доставки. Мы готовы помочь вам с решением вопроса. С уважением, команда Яндекс Доставки';
              }
              
              textareas[0].value = messageText;
              messageTextFilled = true;
              
              // Вызываем событие ввода и изменения для активации проверки формы
              textareas[0].dispatchEvent(new Event('input', { bubbles: true }));
              textareas[0].dispatchEvent(new Event('change', { bubbles: true }));
              
              Utils.log('Заполнено текстовое поле сообщения для типа:', smsType);
              
              // Удаляем smsType из localStorage, чтобы предотвратить 
              // автоматическое заполнение при следующем открытии страницы
              chrome.storage.local.remove('smsType', () => {
                Utils.log('Тип SMS удален из хранилища для предотвращения автоматического заполнения в будущем');
              });
            });
          }
        }
      }
    } catch (error) {
      Utils.error('Ошибка при одновременном поиске элементов в iframe:', error);
    }
  }
}

// Функция для форматированного вывода логов
function logMessage(type, message) {
  chrome.storage.local.get(['loggingEnabled'], (result) => {
    if (result.loggingEnabled) {
      const timestamp = new Date().toISOString();
      const typeText = type.toUpperCase();
      Utils.log(`[${timestamp}] [SMS-ОТПРАВКА] [${typeText}] ${message}`);
    }
  });
}

// Функция для добавления форматированных логов в начале каждого этапа процесса
function logStateChange(functionName, description) {
  logMessage('ИНФО', `Запуск функции ${functionName}: ${description}`);
}

// Модифицируем функцию для повторного поиска iframe
function reloadIframes() {
  logMessage('ИНФО', 'Повторный поиск iframe на странице');
  
  return new Promise((resolve, reject) => {
    try {
      const iframes = document.querySelectorAll('iframe');
      if (iframes.length > 0) {
        logMessage('УСПЕХ', `Поиск iframe на странице: Найдено ${iframes.length} iframe`);
        resolve(Array.from(iframes));
      } else {
        logMessage('ИНФО', 'iframe не найдены, настраиваем наблюдатель');
        
        const observer = new MutationObserver((mutations) => {
          const newIframes = document.querySelectorAll('iframe');
          if (newIframes.length > 0) {
            logMessage('УСПЕХ', `Обнаружены новые iframe: ${newIframes.length}`);
            observer.disconnect();
            resolve(Array.from(newIframes));
          }
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        
        // Таймаут на 2 секунды
        setTimeout(() => {
          observer.disconnect();
          const finalIframes = document.querySelectorAll('iframe');
          if (finalIframes.length > 0) {
            logMessage('УСПЕХ', `Найдены iframe после ожидания: ${finalIframes.length}`);
            resolve(Array.from(finalIframes));
          } else {
            logMessage('ОШИБКА', 'iframe не найдены после ожидания');
            reject(new Error('iframe не найдены после ожидания'));
          }
        }, 2000);
      }
    } catch (error) {
      logMessage('ОШИБКА', `Ошибка при повторном поиске iframe: ${error.message}`);
      reject(error);
    }
  });
}

// Улучшенная функция восстановления процесса отправки SMS
function recoveryProcess() {
  logMessage('ИНФО', 'Запуск процесса восстановления');
  
  // Проверяем доступность iframe
  reloadIframes()
    .then(iframes => {
      logMessage('ИНФО', `Проверка iframe перед восстановлением: найдено ${iframes.length}`);
      
      // Проверяем на каком этапе произошла остановка
      if (!newMailingButtonClicked) {
        logMessage('ИНФО', 'Процесс остановлен до нажатия кнопки "Новая рассылка"');
        clickNewMailingButton();
        return;
      }
      
      if (!originSelectorClicked) {
        logMessage('ИНФО', 'Процесс остановлен после нажатия кнопки "Новая рассылка", но до выбора Origin');
        findAndClickOriginSelector();
        return;
      }
      
      if (!russiaOptionSelected) {
        logMessage('ИНФО', 'Процесс остановлен после выбора Origin, но до выбора Russia');
        selectRussiaOption();
        return;
      }
      
      if (!deliOptionSelected) {
        logMessage('ИНФО', 'Процесс остановлен после выбора Russia, но до выбора Deli');
        selectDeliOption();
        return;
      }
      
      if (!ticketInputFilled) {
        logMessage('ИНФО', 'Процесс остановлен после выбора Deli, но до заполнения поля тикета');
        fillTicketField();
        return;
      }
      
      if (!messageTextFilled) {
        logMessage('ИНФО', 'Процесс остановлен после заполнения поля тикета, но до заполнения текста сообщения');
        fillMessageText();
        return;
      }
      
      logMessage('УСПЕХ', 'Все этапы процесса уже выполнены');
    })
    .catch(error => {
      logMessage('ОШИБКА', `Ошибка при восстановлении процесса: ${error.message}`);
      
      // Пробуем перезапустить процесс полностью, если возникла критическая ошибка
      if (!messageTextFilled) {
        logMessage('ИНФО', 'Пробуем перезапустить процесс полностью');
        
        // Перезапускаем с самого начала
        if (newMailingButtonClicked) {
          logMessage('ИНФО', 'Сбрасываем флаг нажатия кнопки "Новая рассылка" и пробуем снова');
          // Сбрасываем флаги и начинаем сначала
          newMailingButtonClicked = false;
          originSelectorClicked = false;
          russiaOptionSelected = false;
          deliOptionSelected = false;
          ticketInputFilled = false;
          messageTextFilled = false;
          
          // Повторно запускаем процесс с начала
          setTimeout(() => {
            clickNewMailingButton();
          }, 500);
        } else {
          // Просто пытаемся нажать кнопку "Новая рассылка"
          clickNewMailingButton();
        }
      }
    });
}

// Улучшенная функция мониторинга процесса отправки SMS
function setupRecoveryMonitoring() {
  logMessage('ИНФО', 'Запуск мониторинга процесса');
  
  // Сохраняем текущее состояние процесса
  let lastState = {
    newMailingButtonClicked: newMailingButtonClicked,
    originSelectorClicked: originSelectorClicked,
    russiaOptionSelected: russiaOptionSelected,
    deliOptionSelected: deliOptionSelected,
    ticketInputFilled: ticketInputFilled,
    messageTextFilled: messageTextFilled
  };
  
  // Счетчик последовательных остановок
  let stuckCounter = 0;
  
  // Функция проверки прогресса
  function checkProgress() {
    const currentState = {
      newMailingButtonClicked: newMailingButtonClicked,
      originSelectorClicked: originSelectorClicked,
      russiaOptionSelected: russiaOptionSelected,
      deliOptionSelected: deliOptionSelected,
      ticketInputFilled: ticketInputFilled,
      messageTextFilled: messageTextFilled
    };
    
    // Делаем лог текущего состояния процесса
    logMessage('ИНФО', `Текущее состояние процесса: ${JSON.stringify(currentState)}`);
    
    // Проверяем, изменилось ли состояние процесса
    const stateChanged = Object.keys(currentState).some(key => 
      currentState[key] !== lastState[key]
    );
    
    if (!stateChanged) {
      stuckCounter++;
      logMessage('ИНФО', `Обнаружена остановка процесса (${stuckCounter}/3)`);
      
      // Если процесс застрял 3 раза подряд, делаем более радикальное восстановление
      if (stuckCounter >= 3) {
        logMessage('ОШИБКА', 'Обнаружено критическое зависание (3 раза подряд), выполняем полный сброс');
        
        // Сбрасываем флаги и счетчик
        stuckCounter = 0;
        
        // Принудительный перезапуск с начала, только если мы застряли на одном из промежуточных этапов
        if (newMailingButtonClicked && !messageTextFilled) {
          logMessage('ИНФО', 'Процесс застрял на промежуточном этапе, выполняем сброс флагов');
          // Сбрасываем все флаги
          newMailingButtonClicked = false;
          originSelectorClicked = false;
          russiaOptionSelected = false;
          deliOptionSelected = false;
          ticketInputFilled = false;
          messageTextFilled = false;
          
          // Обновляем lastState
          lastState = {
            newMailingButtonClicked: false,
            originSelectorClicked: false,
            russiaOptionSelected: false,
            deliOptionSelected: false,
            ticketInputFilled: false,
            messageTextFilled: false
          };
          
          // Запускаем процесс заново
          setTimeout(() => {
            clickNewMailingButton();
          }, 500);
          
          // Продолжаем мониторинг
          setTimeout(checkProgress, 2000);
          return;
        }
      }
      
      // Запускаем процесс восстановления
      recoveryProcess();
    } else {
      logMessage('УСПЕХ', 'Процесс продолжается нормально');
      // Сбрасываем счетчик остановок
      stuckCounter = 0;
      // Обновляем сохраненное состояние
      lastState = { ...currentState };
    }
    
    // Продолжаем мониторинг, если процесс не завершен
    if (!messageTextFilled) {
      setTimeout(checkProgress, 2000);
    } else {
      logMessage('УСПЕХ', 'Процесс завершен успешно, мониторинг остановлен');
    }
  }
  
  // Запускаем первую проверку через 2 секунды после старта процесса
  setTimeout(checkProgress, 2000);
}

// Включаем отладочный режим
enableDebugMode();

// Проверяем, был ли установлен тип SMS в localStorage
chrome.storage.local.get(['smsType'], (result) => {
  if (result.smsType) {
    // Запускаем поиск и нажатие кнопки только если пользователь нажал на кнопку в меню СМС
    logMessage('ИНФО', 'Обнаружен тип SMS в хранилище: ' + result.smsType + '. Начинаем автозаполнение формы.');
    
    // Запускаем поиск и нажатие кнопки при загрузке страницы
    // Сокращаем задержку до 1 секунды для более быстрого старта
    setTimeout(() => {
      logMessage('ИНФО', 'Начинаем поиск кнопки "Новая рассылка"');
      clickNewMailingButton();
      
      // Запускаем мониторинг восстановления процесса
      setupRecoveryMonitoring();
      
      // Сокращаем время повторной попытки до 1.5 секунд
      setTimeout(() => {
        if (!newMailingButtonClicked) {
          logMessage('ИНФО', 'Повторная попытка поиска кнопки "Новая рассылка"');
          clickNewMailingButton();
        } else if (!originSelectorClicked) {
          // Если кнопка "Новая рассылка" уже нажата, но селектор Origin ещё нет
          logMessage('ИНФО', 'Запускаем поиск селектора Origin');
          findAndClickOriginSelector();
        } else if (!russiaOptionSelected) {
          // Если селектор Origin уже нажат, но Russia еще не выбрана
          logMessage('ИНФО', 'Запускаем выбор опции Russia');
          selectRussiaOption();
        } else if (!deliOptionSelected) {
          // Если Russia уже выбрана, но Deli еще не выбрана
          Utils.log('Запускаем выбор опции Deli');
          selectDeliOption();
        } else if (!ticketInputFilled) {
          // Если Deli уже выбрана, но поле тикета еще не заполнено
          Utils.log('Запускаем заполнение поля с ID тикета');
          fillTicketField();
        } else if (!messageTextFilled) {
          // Если поле тикета уже заполнено, но текстовое поле сообщения еще не заполнено
          Utils.log('Запускаем заполнение текстового поля сообщения');
          fillMessageText();
        }
      }, 1000); // Дополнительно уменьшено с 1500 до 1000
    }, 500); // Уменьшено с 1000 до 500
    
    // Обновляем обработчик события загрузки документа
    document.addEventListener('DOMContentLoaded', () => {
      logMessage('ИНФО', 'DOM полностью загружен и проанализирован');
      
      // Запускаем поиск кнопки "Новая рассылка" с меньшей задержкой
      setTimeout(() => {
        // Сначала пробуем ускоренный поиск всех элементов
        findMultipleElements();
        
        // Если ускоренный поиск не сработал полностью, запускаем последовательный поиск
        setTimeout(() => {
          if (!newMailingButtonClicked) {
            logMessage('ИНФО', 'Запускаем последовательный поиск: кнопка "Новая рассылка"');
            clickNewMailingButton();
          } else if (!originSelectorClicked) {
            logMessage('ИНФО', 'Запускаем последовательный поиск: селектор Origin');
            findAndClickOriginSelector();
          } else if (!russiaOptionSelected) {
            logMessage('ИНФО', 'Запускаем последовательный поиск: опция Russia');
            selectRussiaOption();
          } else if (!deliOptionSelected) {
            logMessage('ИНФО', 'Запускаем последовательный поиск: опция Deli');
            selectDeliOption();
          } else if (!ticketInputFilled) {
            logMessage('ИНФО', 'Запускаем последовательный поиск: поле ID тикета');
            fillTicketField();
          } else if (!messageTextFilled) {
            logMessage('ИНФО', 'Запускаем последовательный поиск: текстовое поле сообщения');
            fillMessageText();
          }
        }, 1000);
      }, 300); // Ещё больше уменьшаем начальную задержку
    });
  } else {
    // Если тип СМС не установлен, это значит, что пользователь открыл страницу напрямую без нажатия кнопки в расширении
    logMessage('ИНФО', 'Тип SMS не установлен в хранилище. Автозаполнение формы отключено.');
    Utils.log('Страница была открыта напрямую без нажатия кнопки расширения. Автозаполнение отключено.');
  }
}); 
