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

// Финансовый модуль для работы с расчётами и платежами
(function(window) {
  "use strict";
  
  // Объект для экспорта функций
  const FinancialModule = {};
  
  /**
   * Поиск контейнеров "Расчёт верный" на странице
   * @param {Object} finlightSettings - Настройки Фин. Лайт
   * @returns {Promise} - Промис с результатом поиска
   */
  FinancialModule.searchCalculationContainers = function(finlightSettings = {}) {
    Utils.log('FinancialModule: Запуск поиска контейнеров "Расчёт верный"');
    Utils.log('FinancialModule: Настройки Фин. Лайт:', finlightSettings);
    
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          const url = tabs[0].url;
          
          if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://') || url.startsWith('about:')) {
            Utils.error('FinancialModule: Невозможно выполнить скрипт на системной странице браузера');
            reject(new Error('Невозможно выполнить скрипт на системной странице браузера'));
            return;
          }
          
          // Выполняем поиск контейнеров на активной вкладке
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            function: (finlightSettings) => {
              // Функция расширенного поиска контейнеров
              function searchCalculationContainers() {
                const maxAttempts = 10;
                const interval = 100; // 100ms между попытками = 1 секунда всего
                let attempts = 0;
                
                return new Promise((resolve) => {
                  const searchInterval = setInterval(() => {
                    attempts++;
                    Utils.log(`FinancialModule: Попытка расширенного поиска контейнеров ${attempts}/${maxAttempts}`);
                    
                    let mainContainer = null;
                    let priceContainer = null;
                    let componentsContainer = null;
                    
                    // 1. Ищем основной контейнер "Финальный расчёт"
                    const containers = document.querySelectorAll('div.Box.Box_display_flex.Box_flexDirection_column.Box_width_100');
                    
                    for (const container of containers) {
                      const titleElement = container.querySelector('span.TextLine.TextLine_bold');
                      if (titleElement && titleElement.textContent.includes('Финальный расчёт')) {
                        mainContainer = container;
                        Utils.log('FinancialModule: Основной контейнер "Финальный расчёт" найден!');
                        break;
                      }
                    }
                    
                    if (mainContainer) {
                      // 2. Ищем контейнер с ценой внутри основного контейнера
                      const priceElements = mainContainer.querySelectorAll('div.KeyValue');
                      for (const priceElement of priceElements) {
                        const labelElement = priceElement.querySelector('div');
                        if (labelElement && labelElement.textContent.includes('Цена')) {
                          priceContainer = priceElement;
                          Utils.log('FinancialModule: Контейнер с ценой найден!');
                          break;
                        }
                      }
                      
                      // 3. Ищем контейнер "Компоненты цены" внутри основного контейнера
                      const componentsElements = mainContainer.querySelectorAll('div.Box.Box_display_flex.Box_flexDirection_column.Box_width_100');
                      for (const componentElement of componentsElements) {
                        const titleElement = componentElement.querySelector('span.TextLine.TextLine_bold');
                        if (titleElement && titleElement.textContent.includes('Компоненты цены')) {
                          componentsContainer = componentElement;
                          Utils.log('FinancialModule: Контейнер "Компоненты цены" найден!');
                          
                          // 4. Раскрываем все кнопки в разделе "Компоненты цены" с проверкой состояния
                          Utils.log('FinancialModule: Начинаю раскрытие кнопок в разделе "Компоненты цены"');
                          const expandButtons = componentsContainer.querySelectorAll('.panel__header-tab');
                          Utils.log(`FinancialModule: Найдено кнопок для раскрытия: ${expandButtons.length}`);
                          
                          if (expandButtons.length > 0) {
                            let openedCount = 0;
                            let alreadyOpenedCount = 0;
                            
                                                         expandButtons.forEach((button, index) => {
                               try {
                                 // Проверяем состояние панели перед кликом - несколько способов
                                 const panelElement = button.closest('section.panel');
                                 
                                 // Способ 1: Проверяем наличие класса panel--expanded
                                 const hasExpandedClass = panelElement && panelElement.classList.contains('panel--expanded');
                                 
                                 // Способ 2: Проверяем видимость содержимого панели
                                 const collapseElement = panelElement ? panelElement.querySelector('.panel__collapse') : null;
                                 const isContentVisible = collapseElement && 
                                   (collapseElement.style.display !== 'none' && 
                                    collapseElement.style.visibility !== 'hidden' &&
                                    collapseElement.offsetHeight > 0);
                                 
                                 // Способ 3: Проверяем наличие содержимого в panel__body
                                 const bodyElement = panelElement ? panelElement.querySelector('.panel__body') : null;
                                 const hasContent = bodyElement && bodyElement.children.length > 0;
                                 
                                 // Панель считается развернутой, если есть класс ИЛИ видимое содержимое
                                 const isExpanded = hasExpandedClass || (isContentVisible && hasContent);
                                 
                                 Utils.log(`FinancialModule: Панель ${index + 1} - класс expanded: ${hasExpandedClass}, видимое содержимое: ${isContentVisible}, есть контент: ${hasContent}`);
                                 
                                 if (isExpanded) {
                                   Utils.log(`ℹ️ FinancialModule: Панель ${index + 1} уже развернута, пропускаем`);
                                   alreadyOpenedCount++;
                                 } else {
                                   button.click();
                                   Utils.log(`FinancialModule: Панель ${index + 1} успешно раскрыта`);
                                   openedCount++;
                                 }
                                                                } catch (error) {
                                   Utils.error(`FinancialModule: Ошибка при обработке панели ${index + 1}:`, error);
                                 }
                               });
                               
                               Utils.log(`FinancialModule: Обработка завершена. Открыто новых: ${openedCount}, уже было открыто: ${alreadyOpenedCount}`);
                             } else {
                               Utils.log('FinancialModule: Кнопки для раскрытия не найдены в разделе "Компоненты цены"');
                          }
                          
                          break;
                        }
                      }
                      
                                             // Если нашли основной контейнер, возвращаем результаты
                       clearInterval(searchInterval);
                       resolve({ 
                         found: true, 
                         mainContainer: mainContainer.outerHTML,
                         priceContainer: priceContainer ? priceContainer.outerHTML : null,
                         componentsContainer: componentsContainer ? componentsContainer.outerHTML : null,
                         componentsContainerElement: componentsContainer, // Передаем DOM элемент контейнера
                         hasPrice: !!priceContainer,
                         hasComponents: !!componentsContainer
                       });
                      return;
                    }
                    
                    if (attempts >= maxAttempts) {
                      Utils.log('FinancialModule: Основной контейнер "Финальный расчёт" не найден после всех попыток');
                      clearInterval(searchInterval);
                      resolve({ found: false });
                    }
                  }, interval);
                });
              }
              
                                           // Функция извлечения данных для подробного и краткого прайсинга
              function extractDetailedPricingData(componentsContainer = null, finlightSettings = {}) {
                const isBriefPricing = finlightSettings.briefPricing || false;
                const isDetailedPricing = finlightSettings.detailedPricing || false;
                const isCollectPriceComponentsOnly = finlightSettings.collectPriceComponents || false;
                
                if (isBriefPricing) {
                  Utils.log('💰 FinancialModule: Начинаю извлечение данных для краткого прайсинга (без скобок)');
                  Utils.log('💰 FinancialModule: Настройки краткого прайсинга:', finlightSettings);
                } else if (isDetailedPricing) {
                  Utils.log('💰 FinancialModule: Начинаю извлечение данных для подробного прайсинга в новом формате');
                  Utils.log('💰 FinancialModule: Настройки подробного прайсинга:', finlightSettings);
                } else {
                  Utils.log('💰 FinancialModule: Начинаю извлечение данных для прайсинга (режим не определен)');
                  Utils.log('💰 FinancialModule: Все настройки прайсинга:', finlightSettings);
                }
                
                    Utils.log('FinancialModule: Настройка "Собирать только компоненты цены":', isCollectPriceComponentsOnly);
    
    if (componentsContainer) {
      Utils.log('FinancialModule: Использую переданный контейнер "Компоненты цены"');
    } else {
      Utils.log('FinancialModule: Контейнер "Компоненты цены" не передан, буду искать заново');
                 }
                
                const result = [];
                const totalPrice = { found: false, value: '' };
                
                // Маппинг компонентов согласно реальным названиям на странице
                const componentMapping = {
                  // Контейнеры (требуют специальной обработки)
                  'Заказ': { source: 'container', targetName: 'Заказ', isContainer: true },
                  'Ожидание': { source: 'content', targetName: 'Ожидание', multiComponent: true },
                  
                  // Из заголовков
                  'Возврат': { source: 'header', targetName: 'Возврат' },
                  'Требования': { source: 'header', targetName: 'Дополнительные услуги' },
                  'Повышенный спрос': { source: 'header', targetName: 'Повышающий коэффициент' },
                  'Доплаты': { source: 'header', targetName: 'Бонус за заказ' },
                  
                  // Из содержимого
                  'Клиентские отмены': { source: 'content', targetName: 'Цена отмен клиентами' }
                };

                // Структура известных подкомпонентов для каждого контейнера
                const containerSubComponents = {
                  'Заказ': ['Подача', 'Время в пути', 'Километры в пути']
                };

                /**
                 * Функция форматирования значений в зависимости от типа прайсинга
                 * @param {string} value - Исходное значение
                 * @param {boolean} isBriefPricing - Флаг краткого прайсинга
                 * @returns {string} - Отформатированное значение
                 */
                function formatValueForPricing(value, isBriefPricing) {
                  if (isBriefPricing) {
                    // Для краткого прайсинга убираем скобки
                    const formattedValue = value.replace(/\([^)]*\)/g, '').trim();
                    Utils.log('🔧 FinancialModule: Форматирование для краткого прайсинга:', value, '→', formattedValue);
                    return formattedValue;
                  } else {
                    // Для подробного прайсинга оставляем как есть
                    Utils.log('🔧 FinancialModule: Форматирование для подробного прайсинга (оставляем как есть):', value);
                    return value;
                  }
                }

                /**
                 * Универсальная функция обработки контейнеров с динамическим поиском подкомпонентов
                 * @param {Element} component - Элемент контейнера
                 * @param {string} containerName - Название контейнера
                 * @param {Array} result - Массив для добавления результатов
                 * @param {boolean} isBriefPricing - Флаг краткого прайсинга
                 */
                function processContainerWithDynamicSubComponents(component, containerName, result, isBriefPricing) {
                  Utils.log('🔍 FinancialModule: Обрабатываю контейнер с динамическим поиском:', containerName);
                  
                  const bodyElement = component.querySelector('.panel__body');
                  if (!bodyElement) {
                    Utils.warn('⚠️ FinancialModule: У контейнера', containerName, 'нет содержимого');
                    return;
                  }

                  const keyValueElements = bodyElement.querySelectorAll('.KeyValue');
                  Utils.log(`🔍 FinancialModule: Найдено подкомпонентов в контейнере "${containerName}": ${keyValueElements.length}`);

                  // Получаем известные подкомпоненты для данного контейнера
                  const knownSubComponents = containerSubComponents[containerName] || [];
                  Utils.log('🔍 FinancialModule: Известные подкомпоненты для', containerName, ':', knownSubComponents);

                  // Сначала обрабатываем известные подкомпоненты в заданном порядке
                  const processedComponents = new Set();
                  for (const subComponentName of knownSubComponents) {
                    for (const keyValue of keyValueElements) {
                      const labelElement = keyValue.querySelector('div:first-child');
                      if (labelElement && labelElement.textContent.trim() === subComponentName) {
                        const valueElement = keyValue.querySelector('span.TextLine');
                        if (valueElement) {
                          const rawValue = Utils.formatUnits(valueElement.textContent.trim());
                          const subValue = formatValueForPricing(rawValue, isBriefPricing);
                          const formattedSubLine = `— ${subComponentName}: ${subValue}`;
                          result.push(formattedSubLine);
                          processedComponents.add(subComponentName);
                          Utils.log('✅ FinancialModule: Добавлен известный подкомпонент из', containerName, ':', formattedSubLine);
                          break;
                        }
                      }
                    }
                  }

                  // Затем обрабатываем неизвестные подкомпоненты
                  for (const keyValue of keyValueElements) {
                    const labelElement = keyValue.querySelector('div:first-child');
                    if (labelElement) {
                      const subComponentName = labelElement.textContent.trim();
                      
                      // Пропускаем уже обработанные известные подкомпоненты
                      if (processedComponents.has(subComponentName)) {
                        continue;
                      }

                      const valueElement = keyValue.querySelector('span.TextLine');
                      if (valueElement) {
                        const rawValue = Utils.formatUnits(valueElement.textContent.trim());
                        const subValue = formatValueForPricing(rawValue, isBriefPricing);
                        const formattedSubLine = `— ${subComponentName}: ${subValue}`;
                        result.push(formattedSubLine);
                        Utils.log('✅ FinancialModule: Добавлен неизвестный подкомпонент из', containerName, ':', formattedSubLine);
                      }
                    }
                  }

                  Utils.log('✅ FinancialModule: Обработка контейнера', containerName, 'завершена');
                }
                
                Utils.log('📋 FinancialModule: Обновлен маппинг компонентов с реальными названиями:', componentMapping);
                
                try {
                  // Ищем контейнер "Финальный расчёт" и извлекаем цену только из него
                  Utils.log('🔍 FinancialModule: Ищем контейнер "Финальный расчёт" для извлечения цены');
                  const containers = document.querySelectorAll('div.Box.Box_display_flex.Box_flexDirection_column.Box_width_100');
                  
                  for (const container of containers) {
                    const titleElement = container.querySelector('span.TextLine.TextLine_bold');
                    if (titleElement && titleElement.textContent.includes('Финальный расчёт')) {
                      Utils.log('✅ FinancialModule: Найден контейнер "Финальный расчёт", ищем цену внутри него');
                      
                      // Ищем цену только внутри этого контейнера
                      const priceElements = container.querySelectorAll('div.KeyValue');
                      for (const priceElement of priceElements) {
                        const labelElement = priceElement.querySelector('div');
                        if (labelElement && labelElement.textContent.includes('Цена')) {
                          const valueElement = priceElement.querySelector('span.TextLine.TextLine_bold');
                          if (valueElement) {
                            totalPrice.found = true;
                            totalPrice.value = valueElement.textContent.trim();
                            Utils.log('✅ FinancialModule: Цена найдена в контейнере "Финальный расчёт":', totalPrice.value);
                          }
                          break;
                        }
                      }
                      break; // Выходим из цикла после нахождения нужного контейнера
                    }
                  }
                  
                  if (!totalPrice.found) {
                    Utils.warn('⚠️ FinancialModule: Цена не найдена в контейнере "Финальный расчёт"');
                  }
                  
                                     // Используем переданный контейнер или ищем заново
                   if (!componentsContainer) {
                     Utils.log('🔍 FinancialModule: Ищем конкретный контейнер "Компоненты цены"');
                     const allContainers = document.querySelectorAll('div.Box.Box_display_flex.Box_flexDirection_column.Box_width_100');
                     
                     for (const container of allContainers) {
                       const titleElement = container.querySelector('span.TextLine.TextLine_bold');
                       if (titleElement && titleElement.textContent.includes('Компоненты цены')) {
                         componentsContainer = container;
                         Utils.log('✅ FinancialModule: Найден конкретный контейнер "Компоненты цены"');
                         break;
                       }
                     }
                   }
                   
                   if (!componentsContainer) {
                     Utils.error('❌ FinancialModule: Контейнер "Компоненты цены" не найден');
                     return '';
                   }
                  
                                     // Ищем компоненты цены только внутри найденного контейнера
                   Utils.log('🔍 FinancialModule: Извлекаю компоненты из контейнера:', componentsContainer.querySelector('span.TextLine.TextLine_bold')?.textContent || 'неизвестно');
                   const componentsElements = componentsContainer.querySelectorAll('div.PanelGroup section.panel');
                   Utils.log(`🔍 FinancialModule: Найдено компонентов цены в конкретном контейнере: ${componentsElements.length}`);
                  
                  for (const component of componentsElements) {
                    const headerElement = component.querySelector('.panel__header-content');
                    if (headerElement) {
                      const componentText = headerElement.textContent.trim();
                      Utils.log('🔍 FinancialModule: Обрабатываю компонент из конкретного контейнера:', componentText);
                      
                      // Дополнительная отладочная информация о структуре компонента
                      const componentStructure = Utils.getComponentStructure(component);
                      Utils.log('🔍 FinancialModule: Структура компонента:', componentStructure);
                      
                      // Извлекаем название и цену из заголовка
                      const priceMatch = componentText.match(/(\d+)\s*₽/);
                      const price = priceMatch ? priceMatch[1] : '';
                      
                      // Убираем цену из названия
                      const name = componentText.replace(/\d+\s*₽/, '').trim();
                      
                      if (name && price) {
                        Utils.log('🔍 FinancialModule: Обрабатываю компонент:', name, 'с ценой:', price);
                        
                        // Проверяем, есть ли компонент в нашем маппинге
                        const mapping = componentMapping[name];
                        if (mapping) {
                          Utils.log('✅ FinancialModule: Найден компонент в маппинге:', name, 'источник:', mapping.source);
                          
                          let extractedValue = '';
                          
                          if (mapping.isContainer) {
                            // Обрабатываем контейнер с универсальной функцией
                            Utils.log('🔍 FinancialModule: Обрабатываю контейнер с isContainer=true:', name);
                            processContainerWithDynamicSubComponents(component, name, result, isBriefPricing);
                            // Пропускаем добавление самого контейнера, так как обработали его подкомпоненты
                            continue;
                          } else if (mapping.source === 'content') {
                            // Извлекаем из содержимого (.panel__body)
                            Utils.log('🔍 FinancialModule: Извлекаю содержимое для компонента:', name);
                            const bodyElement = component.querySelector('.panel__body');
                            if (bodyElement) {
                              const keyValueElements = bodyElement.querySelectorAll('.KeyValue');
                              if (keyValueElements.length > 0) {
                                // Ищем нужный KeyValue по названию
                                for (const keyValue of keyValueElements) {
                                  const labelElement = keyValue.querySelector('div:first-child');
                                  if (labelElement && labelElement.textContent.trim() === name) {
                                    const valueElement = keyValue.querySelector('span.TextLine');
                                    if (valueElement) {
                                      extractedValue = Utils.formatUnits(valueElement.textContent.trim());
                                      Utils.log('✅ FinancialModule: Извлечено значение из содержимого:', extractedValue);
                                      break;
                                    }
                                  }
                                }
                              }
                            }
                            
                            if (!extractedValue) {
                              Utils.warn('⚠️ FinancialModule: Не удалось извлечь содержимое для компонента:', name);
                              extractedValue = Utils.formatUnits(price + ' ₽');
                            }
                          } else if (mapping.source === 'header') {
                            // Используем заголовок
                            Utils.log('📋 FinancialModule: Использую заголовок для компонента:', name);
                            extractedValue = Utils.formatUnits(price + ' ₽');
                          }
                          
                          // Обработка мультикомпонентов
                          if (mapping.multiComponent) {
                            // Обрабатываем мультикомпонент "Ожидание"
                            Utils.log('🔍 FinancialModule: Обрабатываю мультикомпонент "Ожидание"');
                            const bodyElement = component.querySelector('.panel__body');
                            if (bodyElement) {
                              const keyValueElements = bodyElement.querySelectorAll('.KeyValue');
                              Utils.log(`🔍 FinancialModule: Найдено элементов в мультикомпоненте "Ожидание": ${keyValueElements.length}`);
                              
                              // Ищем два компонента: "Ожидание у отправителя" и "Ожидание у получателя"
                              const multiComponents = ['Ожидание у отправителя', 'Ожидание у получателя'];
                              for (const multiComponentName of multiComponents) {
                                for (const keyValue of keyValueElements) {
                                  const labelElement = keyValue.querySelector('div:first-child');
                                  if (labelElement && labelElement.textContent.trim() === multiComponentName) {
                                    const valueElement = keyValue.querySelector('span.TextLine');
                                    if (valueElement) {
                                      const rawMultiValue = Utils.formatUnits(valueElement.textContent.trim());
                                      const multiValue = formatValueForPricing(rawMultiValue, isBriefPricing);
                                      const formattedMultiLine = `— ${multiComponentName}: ${multiValue}`;
                                      result.push(formattedMultiLine);
                                      Utils.log('✅ FinancialModule: Добавлен мультикомпонент из "Ожидание":', formattedMultiLine);
                                      break;
                                    }
                                  }
                                }
                              }
                            }
                            // Пропускаем добавление самого мультикомпонента, так как обработали его подкомпоненты
                            continue;
                          }
                          
                          // Специальная обработка для "Доплаты" (ищем "Доплата до ЕКТ")
                          if (name === 'Доплаты') {
                            Utils.log('🔍 FinancialModule: Специальная обработка для "Доплаты" - ищем "Доплата до ЕКТ"');
                            const bodyElement = component.querySelector('.panel__body');
                            if (bodyElement) {
                              const keyValueElements = bodyElement.querySelectorAll('.KeyValue');
                              for (const keyValue of keyValueElements) {
                                const labelElement = keyValue.querySelector('div:first-child');
                                if (labelElement && labelElement.textContent.trim() === 'Доплата до ЕКТ') {
                                  const valueElement = keyValue.querySelector('span.TextLine');
                                  if (valueElement) {
                                    extractedValue = Utils.formatUnits(valueElement.textContent.trim());
                                    Utils.log('✅ FinancialModule: Найдена "Доплата до ЕКТ":', extractedValue);
                                    break;
                                  }
                                }
                              }
                            }
                          }
                          
                          // Форматируем строку в новом формате
                          const formattedExtractedValue = formatValueForPricing(extractedValue, isBriefPricing);
                          const formattedLine = `— ${mapping.targetName}: ${formattedExtractedValue}`;
                          result.push(formattedLine);
                          Utils.log('✅ FinancialModule: Добавлен компонент в новом формате:', formattedLine);
                        } else {
                          // Fallback логика для неучтенных компонентов
                          Utils.warn('⚠️ FinancialModule: Найден неучтенный компонент:', name);
                          
                          // Проверяем, не является ли этот компонент подкомпонентом известного контейнера
                          const isSubComponent = Utils.isComponentSubComponent(component, componentsContainer);
                          if (isSubComponent) {
                            Utils.log('⏭️ FinancialModule: Пропускаю подкомпонент известного контейнера:', name);
                            continue;
                          }
                          
                          // Извлекаем ВСЕ подкомпоненты из содержимого
                          const bodyElement = component.querySelector('.panel__body');
                          if (bodyElement) {
                            const keyValueElements = bodyElement.querySelectorAll('.KeyValue');
                            if (keyValueElements.length > 0) {
                              Utils.log(`🔍 FinancialModule: Найдено подкомпонентов в неучтенном компоненте "${name}": ${keyValueElements.length}`);
                              
                              // Обрабатываем КАЖДЫЙ подкомпонент
                              for (const keyValue of keyValueElements) {
                                const labelElement = keyValue.querySelector('div:first-child');
                                const valueElement = keyValue.querySelector('span.TextLine');
                                if (labelElement && valueElement) {
                                  const subName = labelElement.textContent.trim();
                                  const rawSubValue = Utils.formatUnits(valueElement.textContent.trim());
                                  const subValue = formatValueForPricing(rawSubValue, isBriefPricing);
                                  const fallbackLine = `— ${subName}: ${subValue}`;
                                  result.push(fallbackLine);
                                  Utils.log('✅ FinancialModule: Добавлен подкомпонент из неучтенного:', fallbackLine);
                                }
                              }
                            } else {
                              // Если нет подкомпонентов, используем заголовок
                              Utils.log('⚠️ FinancialModule: В неучтенном компоненте нет подкомпонентов, использую заголовок');
                              const rawFallbackValue = Utils.formatUnits(price + ' ₽');
                              const fallbackValue = formatValueForPricing(rawFallbackValue, isBriefPricing);
                              const fallbackLine = `— ${name}: ${fallbackValue}`;
                              result.push(fallbackLine);
                              Utils.log('✅ FinancialModule: Добавлен неучтенный компонент из заголовка:', fallbackLine);
                            }
                          } else {
                            // Если нет содержимого, используем заголовок
                            Utils.log('⚠️ FinancialModule: У неучтенного компонента нет содержимого, использую заголовок');
                            const rawFallbackValue = Utils.formatUnits(price + ' ₽');
                            const fallbackValue = formatValueForPricing(rawFallbackValue, isBriefPricing);
                            const fallbackLine = `— ${name}: ${fallbackValue}`;
                            result.push(fallbackLine);
                            Utils.log('✅ FinancialModule: Добавлен неучтенный компонент из заголовка:', fallbackLine);
                          }
                        }
                      } else {
                        Utils.warn('⚠️ FinancialModule: Компонент не содержит валидных данных (название или цена):', componentText);
                      }
                    } else {
                      Utils.warn('⚠️ FinancialModule: Компонент не содержит заголовка');
                    }
                  }
                  
                  // Сортируем результат согласно требуемому порядку
                  Utils.log('🔍 FinancialModule: Сортирую результат согласно требуемому порядку');
                  const orderedResult = [];
                  
                  // Добавляем первый абзац, если НЕ включена опция "Собирать только компоненты цены"
                  if (!isCollectPriceComponentsOnly) {
                    const firstParagraphText = finlightSettings.firstParagraphText || 'Всё проверила и не обнаружила никаких нарушений при расчёте заказа НОМЕР_ЗАКАЗА. Стоимость заказа рассчитана верно в соответствии с тарифом.';
                    orderedResult.push(firstParagraphText);
                    orderedResult.push(''); // Пустая строка для разделения
                    Utils.log('✅ FinancialModule: Добавлен первый абзац в начало результата');
                  } else {
                    Utils.log('ℹ️ FinancialModule: Опция "Собирать только компоненты цены" включена, пропускаю первый абзац');
                  }
                  
                  // Определяем порядок компонентов
                  const componentOrder = [
                    'Подача',
                    'Время в пути', 
                    'Километры в пути',
                    'Повышающий коэффициент',
                    'Ожидание у отправителя',
                    'Ожидание у получателя'
                  ];
                  
                  // Сначала добавляем компоненты в нужном порядке
                  for (const orderedComponent of componentOrder) {
                    const foundLine = result.find(line => line.includes(orderedComponent));
                    if (foundLine) {
                      orderedResult.push(foundLine);
                      Utils.log('✅ FinancialModule: Добавлен компонент в порядке:', foundLine);
                    }
                  }
                  
                  // Добавляем неучтенные компоненты между "Ожидание у получателя" и "Бонус за заказ"
                  const unaccountedComponents = result.filter(line => 
                    !componentOrder.some(ordered => line.includes(ordered)) &&
                    !line.includes('Бонус за заказ') &&
                    !line.includes('Дополнительные услуги') &&
                    !line.includes('Итого')
                  );
                  
                  if (unaccountedComponents.length > 0) {
                    Utils.log('🔍 FinancialModule: Добавляю неучтенные компоненты:', unaccountedComponents);
                    orderedResult.push(...unaccountedComponents);
                  }
                  
                  // Добавляем "Бонус за заказ" и "Дополнительные услуги"
                  const bonusLine = result.find(line => line.includes('Бонус за заказ'));
                  if (bonusLine) {
                    orderedResult.push(bonusLine);
                    Utils.log('✅ FinancialModule: Добавлен "Бонус за заказ":', bonusLine);
                  }
                  
                  const servicesLine = result.find(line => line.includes('Дополнительные услуги'));
                  if (servicesLine) {
                    orderedResult.push(servicesLine);
                    Utils.log('✅ FinancialModule: Добавлены "Дополнительные услуги":', servicesLine);
                  }
                  
                  // Добавляем интервал перед итоговой ценой
                  if (totalPrice.found && !result.some(line => line.includes('Итого'))) {
                    orderedResult.push(''); // Пустая строка для интервала
                    orderedResult.push(`Итого: ${Utils.formatUnits(totalPrice.value)}`);
                    Utils.log('✅ FinancialModule: Добавлен интервал и итоговая цена:', totalPrice.value);
                  }
                  
                  Utils.log('✅ FinancialModule: Извлечение данных в новом формате завершено');
                  Utils.log(`✅ FinancialModule: Найдено компонентов в контейнере "Компоненты цены": ${result.length}`);
                  Utils.log('✅ FinancialModule: Общее количество строк в результате:', orderedResult.length);
                  Utils.log('📋 FinancialModule: Финальный результат форматирования:', orderedResult);
                  
                  // Применяем финальное форматирование к готовому тексту
                  const rawText = orderedResult.join('\n');
                  const finalText = Utils.formatFinalText(rawText);
                  Utils.log('🔧 FinancialModule: Применено финальное форматирование единиц измерения');
                  
                  return finalText;
                  
                } catch (error) {
                  Utils.error('❌ FinancialModule: Ошибка при извлечении данных:', error);
                  return '';
                }
              }
              
              // Функция копирования в буфер обмена
              function copyToClipboard(text) {
                Utils.log('📋 FinancialModule: Копирование в буфер обмена:', text);
                
                return new Promise((resolve, reject) => {
                  // Сначала пробуем современный API
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text)
                      .then(() => {
                        Utils.log('✅ FinancialModule: Текст успешно скопирован в буфер обмена (современный API)');
                        resolve(true);
                      })
                      .catch((error) => {
                        Utils.warn('⚠️ FinancialModule: Современный API не сработал, пробуем fallback:', error);
                        // Fallback метод через document.execCommand
                        fallbackCopyToClipboard(text, resolve, reject);
                      });
                  } else {
                    // Fallback для старых браузеров
                    fallbackCopyToClipboard(text, resolve, reject);
                  }
                });
              }
              
              // Fallback метод копирования через document.execCommand
              function fallbackCopyToClipboard(text, resolve, reject) {
                try {
                  // Создаем временный textarea элемент
                  const textArea = document.createElement('textarea');
                  textArea.value = text;
                  textArea.style.position = 'fixed';
                  textArea.style.left = '-999999px';
                  textArea.style.top = '-999999px';
                  document.body.appendChild(textArea);
                  
                  // Фокусируемся на элементе и копируем
                  textArea.focus();
                  textArea.select();
                  
                  const successful = document.execCommand('copy');
                  document.body.removeChild(textArea);
                  
                  if (successful) {
                    Utils.log('✅ FinancialModule: Текст успешно скопирован в буфер обмена (fallback метод)');
                    resolve(true);
                  } else {
                    Utils.error('❌ FinancialModule: Fallback метод копирования не сработал');
                    reject(new Error('Fallback copy failed'));
                  }
                } catch (error) {
                  Utils.error('❌ FinancialModule: Ошибка при fallback копировании:', error);
                  reject(error);
                }
              }
              
              // Проверяем, включен ли какой-либо тип прайсинга
              if (!finlightSettings.detailedPricing && !finlightSettings.briefPricing) {
                Utils.log('⚠️ FinancialModule: Не выбран тип прайсинга, показываю уведомление');
                return Promise.resolve({
                  found: false,
                  hasPrice: false,
                  hasComponents: false,
                  noPricingSelected: true
                });
              }
              
              // Запускаем расширенный поиск
              return searchCalculationContainers().then((searchResult) => {
                // Если включен подробный или краткий прайсинг и найдены контейнеры, извлекаем данные
                if ((finlightSettings.detailedPricing || finlightSettings.briefPricing) && searchResult.found && searchResult.hasComponents) {
                  if (finlightSettings.detailedPricing) {
                    Utils.log('💰 FinancialModule: Включен подробный прайсинг, извлекаю данные');
                  } else if (finlightSettings.briefPricing) {
                    Utils.log('💰 FinancialModule: Включен краткий прайсинг, извлекаю данные');
                  }
                  
                  // Даем время на раскрытие всех панелей
                  return new Promise((resolve) => {
                    setTimeout(() => {
                      // Передаем найденный контейнер в функцию извлечения данных
                      Utils.log('🔗 FinancialModule: Передаю найденный контейнер в функцию извлечения данных');
                      Utils.log('🔗 FinancialModule: Контейнер найден:', !!searchResult.componentsContainerElement);
                      const extractedData = extractDetailedPricingData(searchResult.componentsContainerElement, finlightSettings);
                       if (extractedData) {
                        Utils.log('📋 FinancialModule: Данные успешно извлечены в новом формате, копирую в буфер обмена');
                        Utils.log('📋 FinancialModule: Длина извлеченных данных:', extractedData.length, 'символов');
                        copyToClipboard(extractedData).then(() => {
                          Utils.log('✅ FinancialModule: Данные успешно скопированы в буфер обмена');
                          resolve({
                            ...searchResult,
                            detailedPricingData: extractedData,
                            copiedToClipboard: true
                          });
                        }).catch((error) => {
                          Utils.error('❌ FinancialModule: Ошибка при копировании в буфер обмена:', error);
                          resolve({
                            ...searchResult,
                            detailedPricingData: extractedData,
                            copiedToClipboard: false
                          });
                        });
                      } else {
                        Utils.warn('⚠️ FinancialModule: Не удалось извлечь данные в новом формате');
                        resolve(searchResult);
                      }
                    }, 1000); // Ждем 1 секунду для раскрытия панелей
                  });
                }
                
                return searchResult;
              });
            },
            args: [finlightSettings]
          }, (results) => {
            if (chrome.runtime.lastError) {
              Utils.error('FinancialModule: Ошибка при выполнении скрипта расширенного поиска контейнеров:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
              return;
            }
            
            if (results && results[0] && results[0].result) {
              const searchResult = results[0].result;
              
              // Проверяем, был ли выбран тип прайсинга
              if (searchResult.noPricingSelected) {
                Utils.log('⚠️ FinancialModule: Не выбран тип прайсинга, показываю уведомление');
                FinancialModule.createNotification({
                  type: 'basic',
                  title: 'Выберите тип прайсинга!',
                  message: 'Включите "Подробный прайсинг" или "Краткий прайсинг" в настройках.',
                  iconUrl: chrome.runtime.getURL('img/128.png')
                }, 5000);
                resolve(searchResult);
                return;
              }
              
              if (searchResult.found) {
                Utils.log('✅ FinancialModule: Основной контейнер найден, проверяем дополнительные контейнеры');
                Utils.log(`FinancialModule: Цена найдена: ${searchResult.hasPrice}`);
                Utils.log(`FinancialModule: Компоненты цены найдены: ${searchResult.hasComponents}`);
                
                // Проверяем, был ли включен подробный или краткий прайсинг
                if (searchResult.detailedPricingData) {
                  const pricingType = finlightSettings.briefPricing ? 'краткого' : 'подробного';
                  Utils.log(`💰 FinancialModule: Данные ${pricingType} прайсинга извлечены в новом формате`);
                  Utils.log('💰 FinancialModule: Длина данных:', searchResult.detailedPricingData.length, 'символов');
                  if (searchResult.copiedToClipboard) {
                    Utils.log('✅ FinancialModule: Создаю уведомление об успешном копировании');
                    FinancialModule.createNotification({
                      type: 'basic',
                      title: 'Данные скопированы!',
                      message: `${pricingType.charAt(0).toUpperCase() + pricingType.slice(1)} прайсинг скопирован в буфер обмена.`,
                      iconUrl: chrome.runtime.getURL('img/128.png')
                    }, 5000);
                  } else {
                    Utils.log('⚠️ FinancialModule: Создаю уведомление о проблеме с копированием');
                    FinancialModule.createNotification({
                      type: 'basic',
                      title: 'Данные извлечены!',
                      message: `${pricingType.charAt(0).toUpperCase() + pricingType.slice(1)} прайсинг извлечен, но не скопирован в буфер обмена.`,
                      iconUrl: chrome.runtime.getURL('img/128.png')
                    }, 5000);
                  }
                } else if (searchResult.hasPrice && searchResult.hasComponents) {
                  Utils.log('✅ FinancialModule: Все контейнеры найдены, создаем уведомление об успехе');
                  FinancialModule.createNotification({
                    type: 'basic',
                    title: 'Все контейнеры найдены!',
                    message: 'Найдены цена и компоненты цены.',
                    iconUrl: chrome.runtime.getURL('img/128.png')
                  }, 5000);
                } else {
                  Utils.log('⚠️ FinancialModule: Один из контейнеров не найден, создаем уведомление об ошибке');
                  FinancialModule.createNotification({
                    type: 'basic',
                    title: 'Один контейнер не обнаружен!',
                    message: 'Не все необходимые контейнеры найдены на странице.',
                    iconUrl: chrome.runtime.getURL('img/128.png')
                  }, 5000);
                }
              } else {
                Utils.log('❌ FinancialModule: Основной контейнер не найден, создаем уведомление об ошибке');
                FinancialModule.createNotification({
                  type: 'basic',
                  title: 'Контейнер не найден!',
                  message: 'Пожалуйста, попробуй на другой странице!',
                  iconUrl: chrome.runtime.getURL('img/128.png')
                }, 5000);
              }
              
              resolve(searchResult);
            } else {
              Utils.error('FinancialModule: Не удалось получить результаты расширенного поиска контейнеров');
              reject(new Error('Не удалось получить результаты поиска'));
            }
          });
        } else {
          Utils.error('FinancialModule: Не найдена активная вкладка');
          reject(new Error('Не найдена активная вкладка'));
        }
      });
    });
  };
  
  /**
   * Обработка функции "Плата за подачу"
   * @param {Object} finlightSettings - Настройки Фин. Лайт
   * @returns {Promise} - Промис с результатом обработки
   */
  FinancialModule.handleDeliveryFee = function(finlightSettings = {}) {
    Utils.log('💰 FinancialModule: Запуск обработки "Плата за подачу"');
    Utils.log('💰 FinancialModule: Настройки Фин. Лайт:', finlightSettings);
    
    return new Promise((resolve) => {
      Utils.log('💰 FinancialModule: Начинаю поиск кнопки "Данные прайсинга"');
      
      // Запускаем поиск кнопки "Данные прайсинга"
      FinancialModule.searchPricingDataButton()
        .then((result) => {
          if (result.found) {
            Utils.log('✅ FinancialModule: Кнопка "Данные прайсинга" найдена, открываю в новом окне');
            FinancialModule.openPricingDataInNewWindow(result.url);
            resolve({ success: true, message: 'Кнопка найдена и открыта в новом окне' });
          } else {
            Utils.log('❌ FinancialModule: Кнопка "Данные прайсинга" не найдена');
            FinancialModule.createNotification({
              type: 'basic',
              title: 'Кнопка не найдена',
              message: 'Кнопка "Данные прайсинга" не найдена на странице.',
              iconUrl: chrome.runtime.getURL('img/128.png')
            }, 5000);
            resolve({ success: false, message: 'Кнопка не найдена' });
          }
        })
        .catch((error) => {
          Utils.error('❌ FinancialModule: Ошибка при поиске кнопки "Данные прайсинга":', error);
          FinancialModule.createNotification({
            type: 'basic',
            title: 'Ошибка поиска',
            message: 'Произошла ошибка при поиске кнопки "Данные прайсинга".',
            iconUrl: chrome.runtime.getURL('img/128.png')
          }, 5000);
          resolve({ success: false, message: 'Ошибка поиска', error: error.message });
        });
    });
  };
  
  /**
   * Поиск кнопки "Данные прайсинга" на странице
   * @returns {Promise} - Промис с результатом поиска
   */
  FinancialModule.searchPricingDataButton = function() {
    Utils.log('🔍 FinancialModule: Начинаю поиск кнопки "Данные прайсинга"');
    
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) {
          Utils.error('FinancialModule: Не найдена активная вкладка');
          reject(new Error('Не найдена активная вкладка'));
          return;
        }
        
        const tabId = tabs[0].id;
        let attempts = 0;
        const maxAttempts = 10;
        const searchInterval = 100; // 100мс между попытками
        
        const performSearch = () => {
          attempts++;
          Utils.log(`🔍 FinancialModule: Попытка поиска #${attempts} из ${maxAttempts}`);
          
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            function: () => {
              // Ищем кнопку "Данные прайсинга" по нескольким критериям
              const selectors = [
                'a.amber-link[href*="/pricing"]',
                'a[href*="/pricing"]',
                '.order-information-item a[href*="/pricing"]'
              ];
              
              for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                  // Проверяем, что это именно кнопка "Данные прайсинга"
                  if (element.textContent && element.textContent.trim() === 'Данные прайсинга') {
                    return {
                      found: true,
                      url: element.href,
                      text: element.textContent.trim()
                    };
                  }
                }
              }
              
              return { found: false };
            }
          }, (results) => {
            if (chrome.runtime.lastError) {
              Utils.error('FinancialModule: Ошибка при выполнении скрипта поиска:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
              return;
            }
            
            if (results && results[0] && results[0].result) {
              const result = results[0].result;
              
              if (result.found) {
                Utils.log('✅ FinancialModule: Кнопка "Данные прайсинга" найдена:', result);
                resolve(result);
                return;
              }
            }
            
            // Если кнопка не найдена и есть еще попытки
            if (attempts < maxAttempts) {
              setTimeout(performSearch, searchInterval);
            } else {
              Utils.log('❌ FinancialModule: Кнопка "Данные прайсинга" не найдена после всех попыток');
              resolve({ found: false });
            }
          });
        };
        
        // Запускаем первую попытку поиска
        performSearch();
      });
    });
  };
  
  /**
   * Открытие ссылки "Данные прайсинга" в новом окне
   * @param {string} url - URL для открытия
   */
  FinancialModule.openPricingDataInNewWindow = function(url) {
    Utils.log('🌐 FinancialModule: Открываю ссылку в новом окне:', url);
    
    chrome.tabs.create({ 
      url: url,
      active: true
    }, (newTab) => {
      if (chrome.runtime.lastError) {
        Utils.error('FinancialModule: Ошибка при открытии новой вкладки:', chrome.runtime.lastError);
      } else {
        Utils.log('✅ FinancialModule: Новая вкладка успешно открыта с ID:', newTab.id);
      }
    });
  };
  
  /**
   * Создание уведомления через систему notifications.js
   * @param {Object} notificationData - Данные уведомления
   * @param {number} timeout - Таймаут уведомления в мс
   * @returns {Promise} - Промис с ID уведомления
   */
  FinancialModule.createNotification = function(notificationData, timeout = 5000) {
    Utils.log('🔔 FinancialModule: Создание уведомления:', notificationData);
    
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'createNotification',
        data: notificationData,
        timeout: timeout
      }, (response) => {
        if (chrome.runtime.lastError) {
          Utils.error('FinancialModule: Ошибка при создании уведомления:', chrome.runtime.lastError);
          resolve(null);
        } else {
          Utils.log('FinancialModule: Уведомление создано успешно');
          resolve(response);
        }
      });
    });
  };
  
  // Экспортируем модуль в глобальную область видимости
  window.FinancialModule = FinancialModule;
})(window);
