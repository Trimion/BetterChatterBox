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

import { createNotification } from './notifications.js';

function performButtonSearch(url, tabId) {
    chrome.tabs.create({ 
        url: url,
        active: false
    }, (newTab) => {
        const performSearch = async () => {
            chrome.scripting.executeScript({
                target: { tabId: newTab.id },
                function: async () => {
                    const waitForTagsContainer = () => {
                        return new Promise((resolve) => {
                            const checkForContainer = () => {
                                const tagsContainer1 = document.querySelector('.DriversShowDriverDiagnosticsTags');
                                
                                const tagsContainer2 = document.querySelector('.DriversShowDriverDiagnosticsTags__content');
                                
                                let container1HasContent = false;
                                let container2HasContent = false;
                                
                                const tagElements = document.querySelectorAll('.DiagnosticsTagWithTopics__tagTitle, .DriversDiagnosticLabel__title');
                                const hasSpecificTagElements = tagElements.length > 0;
                                
                                const allTagSelectors = [
                                    '.driver-profile__tag',
                                    '.tag',
                                    '.badge',
                                    '.label',
                                    '.Restrictions__available-tariffs-list',
                                    '.Spoiler__content',
                                    '.Restrictions__available-tariffs-text',
                                    '.row__col',
                                    '.DiagnosticsTagWithTopics__tagTitle',
                                    '.DriversDiagnosticLabel__title',
                                    '.DriversShowDriverDiagnosticsTags__headerText',
                                    '.DriversShowDriverDiagnosticsTags .DiagnosticsTagWithTopics__tagTitle div',
                                    '.DriversShowDriverDiagnosticsTags div',
                                    '.DriversShowDriverDiagnosticsTags__content div'
                                ];
                                
                                let totalElements = 0;
                                for (const selector of allTagSelectors) {
                                    const elements = document.querySelectorAll(selector);
                                    totalElements += elements.length;
                                }
                                
                                console.log(`Всего найдено ${totalElements} элементов по всем селекторам`);
                                const hasEnoughElements = totalElements > 10;
                                
                                if (tagsContainer1) {
                                    const elements1 = tagsContainer1.querySelectorAll('.DiagnosticsTagWithTopics__tagTitle, .DriversDiagnosticLabel__title, div');
                                    container1HasContent = elements1.length > 0;
                                    console.log('Блок с тегами DriversShowDriverDiagnosticsTags найден! Содержит элементы:', container1HasContent);
                                }
                                
                                if (tagsContainer2) {
                                    const elements2 = tagsContainer2.querySelectorAll('.DiagnosticsTagWithTopics__tagTitle, .DriversDiagnosticLabel__title, div');
                                    container2HasContent = elements2.length > 0;
                                    console.log('Блок с тегами DriversShowDriverDiagnosticsTags__content найден! Содержит элементы:', container2HasContent);
                                }
                                
                                if (((tagsContainer1 && container1HasContent) || (tagsContainer2 && container2HasContent)) && 
                                    (hasSpecificTagElements || hasEnoughElements)) {
                                    console.log(`Найдены конкретные элементы с тегами: ${tagElements.length} элементов`);
                                    setTimeout(() => {
                                        resolve({
                                            tagsContainer1: tagsContainer1,
                                            tagsContainer2: tagsContainer2
                                        });
                                    }, 450);
                                } else {
                                    if ((tagsContainer1 || tagsContainer2) && !hasSpecificTagElements && !hasEnoughElements) {
                                        console.log('Блоки с тегами найдены, но конкретные элементы с тегами еще не загружены, ожидаем...');
                                    } else if (tagsContainer1 || tagsContainer2) {
                                        console.log('Блоки с тегами найдены, но они еще не содержат элементов, ожидаем...');
                                    } else {
                                        console.log('Ни один из блоков с тегами еще не загружен, ожидаем...');
                                    }
                                    setTimeout(checkForContainer, 90);
                                }
                            };
                            
                            checkForContainer();
                        });
                    };

                    const waitForProfessionContainer = () => {
                        return new Promise((resolve) => {
                            const checkForProfessionContainer = () => {
                                const professionContainer = document.querySelector('.ShowDrivers_DriverProfession__value-text');
                                const professionContainerAlt = document.querySelector('.DriverProfession__value-text');
                                
                                if (professionContainer || professionContainerAlt) {
                                    console.log('Блок с профессией водителя найден!');
                                    resolve(true);
                                } else {
                                    console.log('Блок с профессией водителя еще не загружен, ожидаем...');
                                    setTimeout(checkForProfessionContainer, 90);
                                }
                            };
                            
                            checkForProfessionContainer();
                        });
                    };

                    const waitForDriverInfoContainers = () => {
                        return new Promise((resolve) => {
                            const checkForDriverInfoContainers = () => {
                                let ipContainer = null;
                                let partnershipContainer = null;
                                
                                const rows = document.querySelectorAll('.row.row_theme_amber.row_gap_m.row_gutter_m.row_mode_flex');
                                
                                for (const row of rows) {
                                    const titleCol = row.querySelector('.row__col.row__col_width_x16');
                                    if (titleCol) {
                                        const titleText = titleCol.textContent.trim();
                                        if (titleText === 'Водитель является ИП') {
                                            ipContainer = row;
                                        } else if (titleText === 'Тип партнерства') {
                                            partnershipContainer = row;
                                        }
                                    }
                                }
                                
                                if (ipContainer && partnershipContainer) {
                                    console.log('Блоки с информацией о водителе найдены!');
                                    resolve({
                                        ipContainer,
                                        partnershipContainer
                                    });
                                } else {
                                    console.log('Блоки с информацией о водителе еще не загружены, ожидаем...');
                                    setTimeout(checkForDriverInfoContainers, 90);
                                }
                            };
                            
                            checkForDriverInfoContainers();
                        });
                    };

                    const findDriverInfo = (containers) => {
                        let result = {
                            isIP: null,
                            partnershipType: null
                        };

                        if (containers.ipContainer) {
                            const ipValueElement = containers.ipContainer.querySelector('.row__col:not(.row__col_width_x16)');
                            if (ipValueElement) {
                                result.isIP = ipValueElement.textContent.trim();
                            }
                        }

                        if (containers.partnershipContainer) {
                            const partnershipValueElement = containers.partnershipContainer.querySelector('.row__col:not(.row__col_width_x16)');
                            if (partnershipValueElement) {
                                result.partnershipType = partnershipValueElement.textContent.trim();
                            }
                        }

                        return result;
                    };

                    const findProfession = () => {
                        const professionMapping = {
                            'cargo/courier/on-foot': 'пеший курьер',
                            'cargo/courier/on-motorcycle': 'мотокурьер',
                            'cargo/courier/on-car': 'курьер на машине',
                            'cargo/courier/on-truck': 'Грузовой',
                            'taxi/driver': 'таксист'
                        };

                        let result = {
                            found: false,
                            anyTextFound: false,
                            profession: null,
                            source: null,
                            rawText: null
                        };

                        const selectors = [
                            '.ShowDrivers_DriverProfession__value-text',
                            '.DriverProfession__value-text',
                            '.DriverCardRow__value'
                        ];

                        for (const selector of selectors) {
                            const elements = document.querySelectorAll(selector);
                            for (const element of elements) {
                                const text = element.textContent.trim().toLowerCase();
                                if (text) {
                                    result.anyTextFound = true;
                                    result.rawText = text;
                                    result.source = selector;
                                    
                                    for (const [key, value] of Object.entries(professionMapping)) {
                                        if (text.includes(key) || text.includes(value)) {
                                            result.found = true;
                                            result.profession = key;
                                            return result;
                                        }
                                    }
                                    
                                    return result;
                                }
                            }
                        }

                        const pageText = document.body.textContent.toLowerCase();
                        if (pageText) {
                            result.anyTextFound = true;
                            result.rawText = pageText;
                            result.source = 'page';
                            
                            for (const [key, value] of Object.entries(professionMapping)) {
                                if (pageText.includes(key) || pageText.includes(value)) {
                                    result.found = true;
                                    result.profession = key;
                                    return result;
                                }
                            }
                        }

                        return result;
                    };

                    const findTags = async (customTagsPresets = []) => {
                        console.log('Начинаю поиск тегов...');
                        
                        return new Promise((resolve) => {
                            chrome.storage.local.get([
                                'customTagsPresets'
                            ], (result) => {
                                const standardTags = {
                                    auto_courier: false,
                                    walking_courier: false
                                };
                                
                                console.log('Стандартные теги для поиска: auto_courier, walking_courier');
                                
                                const customTagsResults = {};
                                
                                if (customTagsPresets.length === 0) {
                                    customTagsPresets = ['preset1', 'preset2', 'preset3'];
                                }
                                
                                for (const presetKey of customTagsPresets) {
                                    customTagsResults[presetKey] = {
                                        tags: {
                                            tag1: false,
                                            tag2: false,
                                            tag3: false,
                                            tag4: false
                                        },
                                        tagNames: {
                                            tag1: '',
                                            tag2: '',
                                            tag3: '',
                                            tag4: ''
                                        }
                                    };
                                    
                                    if (result.customTagsPresets && result.customTagsPresets[presetKey]) {
                                        const preset = result.customTagsPresets[presetKey];
                                        customTagsResults[presetKey].tagNames = {
                                            tag1: preset.customTag1 || '',
                                            tag2: preset.customTag2 || '',
                                            tag3: preset.customTag3 || '',
                                            tag4: preset.customTag4 || ''
                                        };
                                    }
                                }
                                
                                const searchTagsInElements = (elements) => {
                                    console.log('Начинаю поиск тегов в элементах. Всего элементов:', elements.length);
                                    
                                    for (const element of elements) {
                                        const text = element.textContent.trim().toLowerCase();
                                        
                                        if (text.includes('auto_courier') || 
                                            text.includes('авто курьер') || 
                                            text.includes('курьер на машине')) {
                                            standardTags.auto_courier = true;
                                            console.log('Найден стандартный тег: auto_courier');
                                        }
                                        
                                        if (text.includes('walking_courier') || 
                                            text.includes('пеший курьер') || 
                                            text.includes('пешком')) {
                                            standardTags.walking_courier = true;
                                            console.log('Найден стандартный тег: walking_courier');
                                        }
                                        
                                        for (const presetKey of customTagsPresets) {
                                            const tagNames = customTagsResults[presetKey].tagNames;
                                            const tags = customTagsResults[presetKey].tags;
                                            
                                            for (let i = 1; i <= 4; i++) {
                                                const tagKey = `tag${i}`;
                                                const tagName = tagNames[tagKey];
                                                
                                                if (tagName && text.includes(tagName.toLowerCase())) {
                                                    tags[tagKey] = true;
                                                    console.log(`Найден пользовательский тег из пресета ${presetKey}: ${tagName} в тексте: "${text}"`);
                                                }
                                            }
                                        }
                                    }
                                };
                                
                                const tagSelectors = [
                                    '.driver-profile__tag',
                                    '.tag',
                                    '.badge',
                                    '.label',
                                    '.Restrictions__available-tariffs-list',
                                    '.Spoiler__content',
                                    '.Restrictions__available-tariffs-text',
                                    '.row__col',
                                    '.DiagnosticsTagWithTopics__tagTitle',
                                    '.DriversDiagnosticLabel__title',
                                    '.DriversShowDriverDiagnosticsTags__headerText',
                                    '.DriversShowDriverDiagnosticsTags .DiagnosticsTagWithTopics__tagTitle div',
                                    '.DriversShowDriverDiagnosticsTags div',
                                    '.DriversShowDriverDiagnosticsTags__content div',
                                    '.DriversShowDriverDiagnosticsTags__content span',
                                    '.DriversShowDriverDiagnosticsTags span',
                                    '.DiagnosticsTagWithTopics',
                                    '.DriversDiagnosticLabel',
                                    '.Restrictions',
                                    '.Restrictions div',
                                    '.Restrictions span'
                                ];
                                
                                for (const selector of tagSelectors) {
                                    const elements = document.querySelectorAll(selector);
                                    if (elements.length > 0) {
                                        console.log(`Найдено ${elements.length} элементов по селектору ${selector}`);
                                        searchTagsInElements(elements);
                                    } else {
                                        console.log(`Не найдено элементов по селектору ${selector}`);
                                    }
                                }
                                
                                const containers = window.foundTagContainers || { tagsContainer1: null, tagsContainer2: null };
                                
                                if (containers.tagsContainer1) {
                                    console.log('Найден блок с тегами DriversShowDriverDiagnosticsTags, выполняю поиск в нем');
                                    const tagTitles = containers.tagsContainer1.querySelectorAll('.DiagnosticsTagWithTopics__tagTitle div');
                                    if (tagTitles.length > 0) {
                                        console.log(`Найдено ${tagTitles.length} тегов в блоке DriversShowDriverDiagnosticsTags`);
                                        searchTagsInElements(tagTitles);
                                    }
                                    
                                    const tagTopics = containers.tagsContainer1.querySelectorAll('.DriversDiagnosticLabel__title');
                                    if (tagTopics.length > 0) {
                                        console.log(`Найдено ${tagTopics.length} топиков в блоке DriversShowDriverDiagnosticsTags`);
                                        searchTagsInElements(tagTopics);
                                    }
                                    
                                    const allDivs = containers.tagsContainer1.querySelectorAll('div');
                                    if (allDivs.length > 0) {
                                        console.log(`Найдено ${allDivs.length} div элементов в блоке DriversShowDriverDiagnosticsTags`);
                                        searchTagsInElements(allDivs);
                                    }
                                }
                                
                                if (containers.tagsContainer2) {
                                    console.log('Найден блок с тегами DriversShowDriverDiagnosticsTags__content, выполняю поиск в нем');
                                    
                                    const allDivs = containers.tagsContainer2.querySelectorAll('div');
                                    if (allDivs.length > 0) {
                                        console.log(`Найдено ${allDivs.length} div элементов в блоке DriversShowDriverDiagnosticsTags__content`);
                                        searchTagsInElements(allDivs);
                                    }
                                    
                                    const tagTitles = containers.tagsContainer2.querySelectorAll('.DiagnosticsTagWithTopics__tagTitle div');
                                    if (tagTitles.length > 0) {
                                        console.log(`Найдено ${tagTitles.length} тегов в блоке DriversShowDriverDiagnosticsTags__content`);
                                        searchTagsInElements(tagTitles);
                                    }
                                    
                                    const tagTopics = containers.tagsContainer2.querySelectorAll('.DriversDiagnosticLabel__title');
                                    if (tagTopics.length > 0) {
                                        console.log(`Найдено ${tagTopics.length} топиков в блоке DriversShowDriverDiagnosticsTags__content`);
                                        searchTagsInElements(tagTopics);
                                    }
                                }
                                
                                resolve({
                                    standardTags: standardTags,
                                    customTagsResults: customTagsResults
                                });
                            });
                        });
                    };

                    return new Promise(async (resolve) => {
                        chrome.storage.local.get([
                            'searchPreset1', 
                            'searchPreset2', 
                            'searchPreset3', 
                            'searchDriverInfo',
                            'customTagsPresets',
                            'searchPreset1Enabled',
                            'searchPreset2Enabled',
                            'searchPreset3Enabled'
                        ], async (searchSettings) => {
                            try {
                                const preset1 = searchSettings.searchPreset1 || 'tags';
                                const preset2 = searchSettings.searchPreset2 || 'profession';
                                const preset3 = searchSettings.searchPreset3 || 'customTags1';
                                const shouldSearchDriverInfo = searchSettings.searchDriverInfo !== false;
                                
                                const preset1Enabled = searchSettings.searchPreset1Enabled !== false;
                                const preset2Enabled = searchSettings.searchPreset2Enabled !== false;
                                const preset3Enabled = searchSettings.searchPreset3Enabled !== false;
                                
                                console.log('Состояние переключателей поиска:');
                                console.log('Поиск 1 включен:', preset1Enabled);
                                console.log('Поиск 2 включен:', preset2Enabled);
                                console.log('Поиск 3 включен:', preset3Enabled);
                                
                                const presets = [];
                                if (preset1Enabled) presets.push(preset1);
                                if (preset2Enabled) presets.push(preset2);
                                if (preset3Enabled) presets.push(preset3);
                                
                                const shouldSearchPartnershipType = presets.includes('profession');
                                
                                const shouldSearchIPStatus = presets.includes('profession');
                                
                                if (presets.length === 0) {
                                    console.log('Все пресеты поиска отключены. Поиск тегов и профессии не будет выполнен, но поиск информации о водителе будет выполнен, если он включен.');
                                    
                                    if (shouldSearchDriverInfo) {
                                        console.log('Поиск информации о водителе включен, продолжаем поиск...');
                                        
                                        console.log('Ожидаем загрузки блоков с информацией о водителе...');
                                        const driverInfoContainers = await waitForDriverInfoContainers();
                                        console.log('Блоки с информацией о водителе загружены, продолжаем поиск');
                                        const driverInfoResult = findDriverInfo(driverInfoContainers);
                                        
                                        resolve({
                                            profession: null,
                                            driverInfo: driverInfoResult,
                                            tags: null,
                                            presets: {
                                                preset1,
                                                preset2,
                                                preset3
                                            }
                                        });
                                    } else {
                                        resolve({
                                            success: false,
                                            message: 'Все пресеты поиска отключены и поиск информации о водителе отключен'
                                        });
                                    }
                                    return;
                                }
                                
                                const shouldSearchTags = presets.includes('tags');
                                const shouldSearchProfession = presets.includes('profession');
                                
                                const customTagsPresets = [];
                                for (const preset of presets) {
                                    if (preset.startsWith('customTags')) {
                                        const presetKey = preset.replace('customTags', 'preset');
                                        if (!customTagsPresets.includes(presetKey)) {
                                            customTagsPresets.push(presetKey);
                                        }
                                    }
                                }
                                
                                const shouldSearchCustomTags = customTagsPresets.length > 0;
                                
                                console.log('Настройки поиска:');
                                console.log('Пресет 1:', preset1);
                                console.log('Пресет 2:', preset2);
                                console.log('Пресет 3:', preset3);
                                console.log('Искать теги:', shouldSearchTags);
                                console.log('Искать профессию:', shouldSearchProfession);
                                console.log('Искать пользовательские теги:', shouldSearchCustomTags);
                                console.log('Пресеты пользовательских тегов для поиска:', customTagsPresets);
                                console.log('Искать информацию о водителе:', shouldSearchDriverInfo);
                                
                                if (shouldSearchTags || shouldSearchCustomTags) {
                                    console.log('Ожидаем загрузки хотя бы одного из блоков с тегами...');
                                    
                                    let maxAttempts = 27;
                                    let attempts = 0;
                                    let containers = null;
                                    
                                    while (attempts < maxAttempts) {
                                        attempts++;
                                        console.log(`Попытка ${attempts} из ${maxAttempts} найти контейнеры с тегами...`);
                                        
                                        containers = await waitForTagsContainer();
                                        
                                        let hasElements = false;
                                        if (containers.tagsContainer1) {
                                            const elements = containers.tagsContainer1.querySelectorAll('div');
                                            if (elements.length > 5) {
                                                hasElements = true;
                                                console.log(`Контейнер 1 содержит ${elements.length} элементов`);
                                            }
                                        }
                                        
                                        if (containers.tagsContainer2) {
                                            const elements = containers.tagsContainer2.querySelectorAll('div');
                                            if (elements.length > 5) {
                                                hasElements = true;
                                                console.log(`Контейнер 2 содержит ${elements.length} элементов`);
                                            }
                                        }
                                        
                                        if (hasElements) {
                                            console.log('Контейнеры с тегами содержат достаточное количество элементов, продолжаем поиск');
                                            break;
                                        } else {
                                            console.log('Контейнеры с тегами найдены, но они не содержат достаточного количества элементов, ожидаем...');
                                            await new Promise(resolve => setTimeout(resolve, 90));
                                        }
                                    }
                                    
                                    console.log('Хотя бы один из блоков с тегами загружен, продолжаем поиск');
                                    
                                    window.foundTagContainers = containers;
                                    
                                    await new Promise(resolve => setTimeout(resolve, 450));
                                }
                                
                                let professionResult = null;
                                let driverInfoResult = null;
                                if (shouldSearchProfession || shouldSearchDriverInfo || shouldSearchPartnershipType || shouldSearchIPStatus) {
                                    console.log('Ожидаем загрузки блока с профессией водителя...');
                                    await waitForProfessionContainer();
                                    console.log('Блок с профессией водителя загружен, продолжаем поиск');
                                    
                                    if (shouldSearchProfession) {
                                        professionResult = findProfession();
                                    }
                                    
                                    if (shouldSearchDriverInfo || shouldSearchPartnershipType || shouldSearchIPStatus) {
                                        console.log('Ожидаем загрузки блоков с информацией о водителе...');
                                        const driverInfoContainers = await waitForDriverInfoContainers();
                                        console.log('Блоки с информацией о водителе загружены, продолжаем поиск');
                                        driverInfoResult = findDriverInfo(driverInfoContainers);
                                    }
                                }
                                
                                let tags = null;
                                if (shouldSearchTags || shouldSearchCustomTags) {
                                    tags = await findTags(customTagsPresets);
                                    
                                    if (!shouldSearchTags && tags) {
                                        tags.standardTags = {
                                            auto_courier: false,
                                            walking_courier: false
                                        };
                                    }
                                    
                                    if (!shouldSearchCustomTags && tags) {
                                        tags.customTagsResults = {};
                                    }
                                }
                                
                                resolve({
                                    profession: professionResult,
                                    driverInfo: driverInfoResult,
                                    tags,
                                    presets: {
                                        preset1,
                                        preset2,
                                        preset3
                                    }
                                });
                            } catch (error) {
                                console.error('Ошибка при выполнении поиска:', error);
                                resolve({
                                    profession: null,
                                    driverInfo: null,
                                    tags: null,
                                    error: error.message
                                });
                            }
                        });
                    });
                }
            }, async (results) => {
                if (chrome.runtime.lastError) {
                    console.error('Ошибка при выполнении скрипта:', chrome.runtime.lastError);
                    return;
                }

                if (!results || !results[0] || !results[0].result) {
                    console.log('Нет результатов поиска');
                    return;
                }

                const { profession, driverInfo, tags, error } = results[0].result;
                
                if (error) {
                    console.error('Произошла ошибка при поиске:', error);
                    setTimeout(() => {
                        chrome.tabs.remove(newTab.id);
                        console.log('Вкладка поиска закрыта из-за ошибки');
                    }, 450);
                    return;
                }

                chrome.storage.local.get([
                    'searchPreset1', 
                    'searchPreset2', 
                    'searchPreset3', 
                    'searchDriverInfo', 
                    'showNotifications',
                    'searchPreset1Enabled',
                    'searchPreset2Enabled',
                    'searchPreset3Enabled'
                ], (settings) => {
                    if (settings.showNotifications === false) {
                        console.log('Уведомления отключены в настройках. Результаты поиска не будут показаны.');
                        setTimeout(() => {
                            chrome.tabs.remove(newTab.id);
                            console.log('Вкладка поиска закрыта, так как уведомления отключены');
                        }, 450);
                        return;
                    }
                    
                    const preset1 = settings.searchPreset1 || 'tags';
                    const preset2 = settings.searchPreset2 || 'profession';
                    const preset3 = settings.searchPreset3 || 'customTags1';
                    const shouldSearchDriverInfo = settings.searchDriverInfo !== false;
                    
                    const preset1Enabled = settings.searchPreset1Enabled !== false;
                    const preset2Enabled = settings.searchPreset2Enabled !== false;
                    const preset3Enabled = settings.searchPreset3Enabled !== false;
                    
                    console.log('Состояние переключателей поиска:');
                    console.log('Поиск 1 включен:', preset1Enabled);
                    console.log('Поиск 2 включен:', preset2Enabled);
                    console.log('Поиск 3 включен:', preset3Enabled);
                    
                    const presets = [];
                    if (preset1Enabled) presets.push(preset1);
                    if (preset2Enabled) presets.push(preset2);
                    if (preset3Enabled) presets.push(preset3);
                    
                    const shouldSearchPartnershipType = presets.includes('profession');
                                
                    const shouldSearchIPStatus = presets.includes('profession');
                                
                    if (presets.length === 0) {
                        console.log('Все пресеты поиска отключены. Поиск не будет выполнен.');
                        setTimeout(() => {
                            chrome.tabs.remove(newTab.id);
                            console.log('Вкладка поиска закрыта, так как все пресеты отключены');
                        }, 450);
                        return;
                    }
                    
                    for (let i = 0; i < presets.length; i++) {
                        const preset = presets[i];
                        const presetNumber = i + 1;
                        
                        console.log(`Обработка пресета ${presetNumber}: ${preset}`);
                        
                        if (preset === 'profession' && profession) {
                            let professionMessage = '';
                            
                            if (profession.found) {
                                professionMessage = profession.profession;
                            } else if (profession.anyTextFound) {
                                professionMessage = '[Профессия неизвестна]';
                            } else {
                                professionMessage = '[Поиск не удался]';
                            }
                            
                            let fullMessage = `Профессия: ${professionMessage}`;
                            
                            if (driverInfo && driverInfo.isIP !== null) {
                                fullMessage += `\nВодитель является ИП: ${driverInfo.isIP}`;
                            }
                            
                            if (driverInfo && driverInfo.partnershipType !== null) {
                                fullMessage += `\nТип партнерства: ${driverInfo.partnershipType}`;
                            }
                            
                            createNotification({
                                type: 'profession',
                                title: `Карточка (Пресет ${presetNumber})`,
                                message: fullMessage
                            });
                        }
                        
                        if (preset === 'tags' && tags && tags.standardTags) {
                            let standardTagsMessage = '';
                            standardTagsMessage += `auto_courier: ${tags.standardTags.auto_courier ? '✅ Есть' : '❌ Отсутствует'}\n`;
                            standardTagsMessage += `walking_courier: ${tags.standardTags.walking_courier ? '✅ Есть' : '❌ Отсутствует'}`;
                            
                            createNotification({
                                type: 'standard_tags',
                                title: `Стандартные теги (Пресет ${presetNumber})`,
                                message: standardTagsMessage
                            });
                        }
                        
                        if (preset.startsWith('customTags') && tags && tags.customTagsResults) {
                            const presetKey = preset.replace('customTags', 'preset');
                            const presetResult = tags.customTagsResults[presetKey];
                            
                            if (presetResult) {
                                let customTagsMessage = '';
                                
                                if (presetResult.tagNames.tag1) {
                                    customTagsMessage += `${presetResult.tagNames.tag1}: ${presetResult.tags.tag1 ? '✅ Есть' : '❌ Отсутствует'}\n`;
                                } else {
                                    customTagsMessage += 'Тег 1: [Не указано]\n';
                                }
                                
                                if (presetResult.tagNames.tag2) {
                                    customTagsMessage += `${presetResult.tagNames.tag2}: ${presetResult.tags.tag2 ? '✅ Есть' : '❌ Отсутствует'}\n`;
                                } else {
                                    customTagsMessage += 'Тег 2: [Не указано]\n';
                                }
                                
                                if (presetResult.tagNames.tag3) {
                                    customTagsMessage += `${presetResult.tagNames.tag3}: ${presetResult.tags.tag3 ? '✅ Есть' : '❌ Отсутствует'}\n`;
                                } else {
                                    customTagsMessage += 'Тег 3: [Не указано]\n';
                                }
                                
                                if (presetResult.tagNames.tag4) {
                                    customTagsMessage += `${presetResult.tagNames.tag4}: ${presetResult.tags.tag4 ? '✅ Есть' : '❌ Отсутствует'}`;
                                } else {
                                    customTagsMessage += 'Тег 4: [Не указано]';
                                }
                                
                                createNotification({
                                    type: 'custom_tags',
                                    title: `Пользовательские теги ${preset.replace('customTags', '#')} (Пресет ${presetNumber})`,
                                    message: customTagsMessage
                                });
                            }
                        }
                    }
                    
                    setTimeout(() => {
                        chrome.tabs.remove(newTab.id);
                        console.log('Вкладка поиска закрыта после показа уведомлений');
                    }, 450);
                });
            });
        };
        
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
            if (tabId === newTab.id && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                performSearch();
            }
        });
    });
}

export { performButtonSearch }; 