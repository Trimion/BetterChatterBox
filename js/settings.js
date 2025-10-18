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

// Локальный объект Utils для settings script
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
          url: 'settings',
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

document.addEventListener('DOMContentLoaded', async () => {
  // Временные переменные для хранения настроек до применения
  let tempSettings = {
    notifications: true,
    blockWizard: false,
    notificationInterval: 30,
    customTag1: '',
    customTag2: '',
    customTag3: '',
    customTag4: '',
    // Добавляем пресеты пользовательских тегов
    customTagsPresets: {
      preset1: {
        customTag1: '',
        customTag2: '',
        customTag3: '',
        customTag4: ''
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
    },
    activeCustomTagsPreset: 'preset1',
    // Новые настройки для пресетов поиска
    searchPreset1: 'tags',
    searchPreset2: 'profession',
    searchPreset3: 'customTags1',
    searchDriverInfo: true,
    // Добавляем настройки для переключателей поиска
    searchPreset1Enabled: true,
    searchPreset2Enabled: true,
    searchPreset3Enabled: true,
    // Настройки маркера
    markerEnabled: false,
    markers: [],
    loggingEnabled: false, // По умолчанию логирование отключено
    notificationToComment: false,
    // Новые настройки для вывода текста уведомления
    outputGreenOnly: false,
    outputProfession: false,
    // Настройки для системы логирования всех действий
    actionLoggingEnabled: false, // Логирование всех действий отключено
    actionLoggingState: 'disabled', // disabled, active, ready_export
    actionLogs: [], // Массив для хранения логов
    // Настройки автопоиска
    autosearchPresets: false, // Автопоиск пресетов
    autosearchTesting: false, // Автопоиск тестирования
    autosearchLastOrders: false, // Автопоиск последних заказов
    
    // Настройки Фин. Лайт
    finlightFirstParagraph: false, // Первый абзац
    finlightFirstParagraphText: 'Всё проверила и не обнаружила никаких нарушений при расчёте заказа НОМЕР_ЗАКАЗА. Стоимость заказа рассчитана верно в соответствии с тарифом.', // Текст первого абзаца
    finlightFinalCalculation: false, // Итоговый расчёт
    finlightDetailedPricing: false, // Подробный прайсинг
    finlightBriefPricing: false, // Краткий прайсинг
    finlightCollectPriceComponents: false, // Собирать только компоненты цены
    
    // Настройки SMS (из popup.js)
    smsTexts: {}, // Пользовательские тексты SMS
    smsTicketId: '', // ID тикета для SMS
    smsType: '', // Тип SMS
    openSmsMenu: false // Состояние меню SMS
  };
  
  // Получаем элементы выпадающих списков пресетов поиска
  const searchPreset1Select = document.getElementById('searchPreset1');
  const searchPreset2Select = document.getElementById('searchPreset2');
  const searchPreset3Select = document.getElementById('searchPreset3');
  
  // Загружаем настройки при инициализации
  await loadSettings();
  
  // Принудительно обновляем интерфейс после загрузки настроек
  setTimeout(() => {
    if (searchPreset1Select) searchPreset1Select.value = tempSettings.searchPreset1;
    if (searchPreset2Select) searchPreset2Select.value = tempSettings.searchPreset2;
    if (searchPreset3Select) searchPreset3Select.value = tempSettings.searchPreset3;
    Utils.log('Принудительное обновление интерфейса выполнено');
  }, 100);
  
  // Получаем элементы модального окна маркера
  const modal = document.getElementById('markerSettingsModal');
  const openModalBtn = document.getElementById('openMarkerSettings');
  const closeModalBtn = document.querySelector('.close-modal');
  const saveModalBtn = document.getElementById('saveMarkerSettings');
  const cancelModalBtn = document.getElementById('cancelMarkerSettings');
  const addMarkerBtn = document.getElementById('addMarkerBtn');
  const additionalMarkersContainer = document.getElementById('additionalMarkers');
  
  // Получаем элементы модального окна настроек пользовательских тегов
  const customTagsModal = document.getElementById('customTagsSettingsModal');
  const openCustomTagsModalBtn = document.getElementById('openCustomTagsSettings');
  const closeCustomTagsModalBtn = document.querySelector('.close-custom-tags-modal');
  const saveCustomTagsModalBtn = document.getElementById('saveCustomTagsSettings');
  const cancelCustomTagsModalBtn = document.getElementById('cancelCustomTagsSettings');
  const customTagsPresetSelect = document.getElementById('customTagsPresetSelect');
  const customTagsPresetSelectModal = document.getElementById('customTagsPresetSelectModal');
  
  // Получаем элементы модального окна настроек вывода
  const outputSettingsModal = document.getElementById('outputSettingsModal');
  const openOutputSettingsBtn = document.getElementById('outputSettings');
  const closeOutputSettingsBtn = document.querySelector('.close-output-settings-modal');
  const saveOutputSettingsBtn = document.getElementById('saveOutputSettings');
  const cancelOutputSettingsBtn = document.getElementById('cancelOutputSettings');
  const outputGreenToggle = document.getElementById('outputGreenToggle');
  const outputProfessionToggle = document.getElementById('outputProfessionToggle');
  
  // Максимальное количество дополнительных маркеров
  const MAX_ADDITIONAL_MARKERS = 10; // 5 базовых + 10 дополнительных = 15 всего
  
  // Счетчик текущего количества дополнительных маркеров
  let additionalMarkerCount = 0;
  
  // Временное хранилище для настроек маркера в модальном окне
  let tempMarkers = [];
  
  // Получаем ссылки на элементы UI
  const notificationToggle = document.getElementById('notificationToggle');
  const wizardToggle = document.getElementById('wizardToggle');
  const markerToggle = document.getElementById('markerToggle');
  const notificationIntervalInput = document.getElementById('notificationInterval');
  const searchDriverInfoToggle = document.getElementById('searchDriverInfoToggle');
  const notificationToCommentToggle = document.getElementById('notificationToCommentToggle');
  
  // Получаем ссылки на элементы автопоиска
  const autosearchPresetsToggle = document.getElementById('autosearchPresetsToggle');
  const autosearchTestingToggle = document.getElementById('autosearchTestingToggle');
  const autosearchLastOrdersToggle = document.getElementById('autosearchLastOrdersToggle');
  
  // Функция для открытия модального окна маркера
  function openModal() {
    // Копируем текущие настройки маркеров во временное хранилище
    tempMarkers = JSON.parse(JSON.stringify(tempSettings.markers || []));
    
    // Очищаем контейнер дополнительных маркеров
    additionalMarkersContainer.innerHTML = '';
    additionalMarkerCount = 0;
    
    // Заполняем поля в модальном окне
    for (let i = 1; i <= 5; i++) {
      const marker = tempMarkers[i-1] || { text: '', color: getDefaultColor(i-1), exactMatch: false };
      document.getElementById(`markerText${i}`).value = marker.text || '';
      document.getElementById(`markerColor${i}`).value = marker.color || getDefaultColor(i-1);
      document.getElementById(`markerExact${i}`).checked = marker.exactMatch === true;
    }
    
    // Добавляем дополнительные маркеры, если они есть
    if (tempMarkers.length > 5) {
      for (let i = 5; i < tempMarkers.length; i++) {
        addNewMarkerField(tempMarkers[i]);
      }
    }
    
    // Обновляем видимость кнопки добавления маркера
    updateAddMarkerButtonVisibility();
    
    // Показываем модальное окно
    modal.style.display = 'block';
  }
  
  // Функция для открытия модального окна настроек пользовательских тегов
  function openCustomTagsModal() {
    // Всегда начинаем с первого пресета
    customTagsPresetSelectModal.value = 'preset1';
    
    // Загружаем теги выбранного пресета
    loadCustomTagsPreset('preset1');
    
    // Показываем модальное окно
    customTagsModal.style.display = 'block';
  }
  
  // Функция для закрытия модального окна маркера
  function closeModal() {
    modal.style.display = 'none';
  }
  
  // Функция для закрытия модального окна настроек пользовательских тегов
  function closeCustomTagsModal() {
    customTagsModal.style.display = 'none';
  }
  
  // Функция для сохранения настроек из модального окна маркера
  function saveModalSettings() {
    // Собираем все маркеры из базовых и дополнительных полей
    const markers = [];
    
    // Собираем базовые маркеры (1-5)
    for (let i = 1; i <= 5; i++) {
      const markerTextElement = document.getElementById(`markerText${i}`);
      const markerColorElement = document.getElementById(`markerColor${i}`);
      const markerExactElement = document.getElementById(`markerExact${i}`);
      
      if (markerTextElement && markerColorElement && markerExactElement) {
        const text = markerTextElement.value.trim();
        if (text) {
          markers.push({
            text: text,
            color: markerColorElement.value,
            exactMatch: markerExactElement.checked
          });
        }
      } else {
        Utils.error(`Элементы маркера ${i} не найдены в saveModalSettings`);
      }
    }
    
    // Собираем дополнительные маркеры (6+)
    for (let i = 6; i <= 5 + MAX_ADDITIONAL_MARKERS; i++) {
      const textElement = document.getElementById(`markerText${i}`);
      const colorElement = document.getElementById(`markerColor${i}`);
      const exactElement = document.getElementById(`markerExact${i}`);
      
      if (textElement && colorElement && exactElement) {
        const text = textElement.value.trim();
        if (text) {
          markers.push({
            text: text,
            color: colorElement.value,
            exactMatch: exactElement.checked
          });
        }
      }
    }
    
    // Обновляем временные настройки
    tempSettings.markers = markers;
    Utils.log('Настройки маркера сохранены из модального окна:', markers);
    
    // Закрываем модальное окно
    closeModal();
  }
  
  // Функция для сохранения настроек из модального окна пользовательских тегов
  function saveCustomTagsSettings() {
    const selectedPreset = customTagsPresetSelectModal.value;
    
    // Сохраняем значения пользовательских тегов в выбранный пресет
    tempSettings.customTagsPresets[selectedPreset] = {
      customTag1: document.getElementById('customTag1').value.trim(),
      customTag2: document.getElementById('customTag2').value.trim(),
      customTag3: document.getElementById('customTag3').value.trim(),
      customTag4: document.getElementById('customTag4').value.trim()
    };
    
    // Если выбранный пресет является активным, обновляем основные настройки
    if (selectedPreset === tempSettings.activeCustomTagsPreset) {
      tempSettings.customTag1 = tempSettings.customTagsPresets[selectedPreset].customTag1;
      tempSettings.customTag2 = tempSettings.customTagsPresets[selectedPreset].customTag2;
      tempSettings.customTag3 = tempSettings.customTagsPresets[selectedPreset].customTag3;
      tempSettings.customTag4 = tempSettings.customTagsPresets[selectedPreset].customTag4;
    }
    
    Utils.log('Настройки пользовательских тегов сохранены локально в tempSettings');
    
    // Закрываем модальное окно
    closeCustomTagsModal();
  }
  
  // Функция для загрузки пресета пользовательских тегов
  function loadCustomTagsPreset(presetKey) {
    const preset = tempSettings.customTagsPresets[presetKey] || {
      customTag1: '',
      customTag2: '',
      customTag3: '',
      customTag4: ''
    };
    
    // Заполняем поля в модальном окне значениями из пресета
    document.getElementById('customTag1').value = preset.customTag1 || '';
    document.getElementById('customTag2').value = preset.customTag2 || '';
    document.getElementById('customTag3').value = preset.customTag3 || '';
    document.getElementById('customTag4').value = preset.customTag4 || '';
  }
  
  // Функция для активации выбранного пресета
  function activateCustomTagsPreset(presetKey) {
    Utils.log('Активация пресета:', presetKey);
    tempSettings.activeCustomTagsPreset = presetKey;
    
    // Загружаем значения из выбранного пресета в основные настройки
    const preset = tempSettings.customTagsPresets[presetKey] || {
      customTag1: '',
      customTag2: '',
      customTag3: '',
      customTag4: ''
    };
    
    tempSettings.customTag1 = preset.customTag1;
    tempSettings.customTag2 = preset.customTag2;
    tempSettings.customTag3 = preset.customTag3;
    tempSettings.customTag4 = preset.customTag4;
    
    Utils.log('Обновленные настройки после активации пресета:', tempSettings);
    
    // Сохраняем настройки
    saveSettings();
  }
  
  // Функция для добавления нового поля маркера
  function addNewMarkerField(markerData = null) {
    // Проверяем, не превышено ли максимальное количество маркеров
    if (additionalMarkerCount >= MAX_ADDITIONAL_MARKERS) {
      return;
    }
    
    // Увеличиваем счетчик дополнительных маркеров
    additionalMarkerCount++;
    
    // Вычисляем индекс нового маркера (5 базовых + дополнительные)
    const markerIndex = 5 + additionalMarkerCount;
    
    // Создаем данные маркера, если они не переданы
    if (!markerData) {
      markerData = {
        text: '',
        color: getDefaultColor(markerIndex - 1),
        exactMatch: false
      };
    }
    
    // Создаем новый элемент маркера
    const markerItem = document.createElement('div');
    markerItem.className = 'marker-item';
    markerItem.id = `markerItem${markerIndex}`;
    
    // Создаем HTML для нового поля маркера с кнопкой удаления справа
    markerItem.innerHTML = `
      <input type="text" id="markerText${markerIndex}" class="marker-input" placeholder="Введите текст для выделения">
      <input type="color" id="markerColor${markerIndex}" class="color-picker" value="${markerData.color}">
      <label class="switch-small exact-match-label">
        <input type="checkbox" id="markerExact${markerIndex}" class="exact-match-checkbox">
        <span class="slider-small"></span>
      </label>
      <button class="remove-marker-btn" title="Удалить поле маркера">×</button>
    `;
    
    // Добавляем новый элемент в контейнер
    additionalMarkersContainer.appendChild(markerItem);
    
    // Устанавливаем значения полей
    document.getElementById(`markerText${markerIndex}`).value = markerData.text || '';
    document.getElementById(`markerColor${markerIndex}`).value = markerData.color || getDefaultColor(markerIndex - 1);
    document.getElementById(`markerExact${markerIndex}`).checked = markerData.exactMatch === true;
    
    // Добавляем обработчики событий для нового поля
    document.getElementById(`markerText${markerIndex}`).addEventListener('input', (e) => {
      updateTempMarker(markerIndex, 'text', e.target.value.trim());
    });
    
    document.getElementById(`markerColor${markerIndex}`).addEventListener('input', (e) => {
      updateTempMarker(markerIndex, 'color', e.target.value);
    });
    
    document.getElementById(`markerExact${markerIndex}`).addEventListener('change', (e) => {
      updateTempMarker(markerIndex, 'exactMatch', e.target.checked);
    });
    
    // Добавляем обработчик события для кнопки удаления
    markerItem.querySelector('.remove-marker-btn').addEventListener('click', () => {
      removeMarkerField(markerIndex);
    });
    
    // Обновляем видимость кнопки добавления маркера
    updateAddMarkerButtonVisibility();
  }
  
  // Функция для удаления поля маркера
  function removeMarkerField(index) {
    // Находим элемент маркера
    const markerItem = document.getElementById(`markerItem${index}`);
    if (!markerItem) return;
    
    // Удаляем элемент из DOM
    markerItem.remove();
    
    // Удаляем данные маркера из временного хранилища
    if (Array.isArray(tempMarkers) && tempMarkers.length >= index) {
      // Устанавливаем пустой текст, чтобы маркер был отфильтрован при сохранении
      tempMarkers[index-1].text = '';
    }
    
    // Уменьшаем счетчик дополнительных маркеров
    additionalMarkerCount--;
    
    // Обновляем видимость кнопки добавления маркера
    updateAddMarkerButtonVisibility();
  }
  
  // Функция для обновления временного маркера
  function updateTempMarker(index, property, value) {
    if (!Array.isArray(tempMarkers)) {
      tempMarkers = [];
    }
    
    // Убедимся, что у нас достаточно элементов в массиве
    while (tempMarkers.length < index) {
      tempMarkers.push({
        text: '',
        color: getDefaultColor(tempMarkers.length),
        enabled: true,
        exactMatch: false
      });
    }
    
    tempMarkers[index-1][property] = value;
  }
  
  // Функция для обновления видимости кнопки добавления маркера
  function updateAddMarkerButtonVisibility() {
    // Скрываем кнопку, если достигнуто максимальное количество маркеров
    addMarkerBtn.style.display = additionalMarkerCount >= MAX_ADDITIONAL_MARKERS ? 'none' : 'flex';
  }
  
  // Добавляем обработчик события для кнопки добавления маркера
  addMarkerBtn.addEventListener('click', () => {
    addNewMarkerField();
  });
  
  // Добавляем обработчики событий для полей маркера в модальном окне
  for (let i = 1; i <= 5; i++) {
    // Обработчик изменения текста маркера
    document.getElementById(`markerText${i}`).addEventListener('input', (e) => {
      updateTempMarker(i, 'text', e.target.value.trim());
    });
    
    // Обработчик изменения цвета маркера
    document.getElementById(`markerColor${i}`).addEventListener('input', (e) => {
      updateTempMarker(i, 'color', e.target.value);
    });
    
    // Обработчик изменения чекбокса точного совпадения
    document.getElementById(`markerExact${i}`).addEventListener('change', (e) => {
      updateTempMarker(i, 'exactMatch', e.target.checked);
    });
  }
  
  // Обработчики событий для модального окна маркера
  openModalBtn.addEventListener('click', openModal);
  closeModalBtn.addEventListener('click', closeModal);
  saveModalBtn.addEventListener('click', saveModalSettings);
  cancelModalBtn.addEventListener('click', closeModal);
  
  // Обработчики событий для модального окна настроек пользовательских тегов
  openCustomTagsModalBtn.addEventListener('click', openCustomTagsModal);
  closeCustomTagsModalBtn.addEventListener('click', closeCustomTagsModal);
  saveCustomTagsModalBtn.addEventListener('click', saveCustomTagsSettings);
  cancelCustomTagsModalBtn.addEventListener('click', closeCustomTagsModal);
  
  // Добавляем обработчики событий для выбора пресета пользовательских тегов
  customTagsPresetSelectModal.addEventListener('change', (e) => {
    loadCustomTagsPreset(e.target.value);
  });
  
  // Обработчики событий для выпадающих списков пресетов поиска
  if (searchPreset1Select) {
    searchPreset1Select.addEventListener('change', (e) => {
      tempSettings.searchPreset1 = e.target.value;
      Utils.log('Изменен пресет поиска 1:', tempSettings.searchPreset1);
    });
  }
  
  if (searchPreset2Select) {
    searchPreset2Select.addEventListener('change', (e) => {
      tempSettings.searchPreset2 = e.target.value;
      Utils.log('Изменен пресет поиска 2:', tempSettings.searchPreset2);
    });
  }
  
  if (searchPreset3Select) {
    searchPreset3Select.addEventListener('change', (e) => {
      tempSettings.searchPreset3 = e.target.value;
      Utils.log('Изменен пресет поиска 3:', tempSettings.searchPreset3);
    });
  }
  
  // Добавляем обработчики событий для переключателей поиска
  document.getElementById('searchPreset1Toggle').addEventListener('change', (e) => {
    tempSettings.searchPreset1Enabled = e.target.checked;
    Utils.log('Переключатель поиска 1:', tempSettings.searchPreset1Enabled);
  });
  
  document.getElementById('searchPreset2Toggle').addEventListener('change', (e) => {
    tempSettings.searchPreset2Enabled = e.target.checked;
    Utils.log('Переключатель поиска 2:', tempSettings.searchPreset2Enabled);
  });
  
  document.getElementById('searchPreset3Toggle').addEventListener('change', (e) => {
    tempSettings.searchPreset3Enabled = e.target.checked;
    Utils.log('Переключатель поиска 3:', tempSettings.searchPreset3Enabled);
  });
  
  // Закрытие модального окна маркера при клике вне его содержимого
  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal();
    }
    if (event.target === customTagsModal) {
      closeCustomTagsModal();
    }
    if (event.target === outputSettingsModal) {
      closeOutputSettingsModal();
    }
  });
  
  // Обработчики событий для переключателей
  notificationToggle.addEventListener('change', (e) => {
    tempSettings.notifications = e.target.checked;
  });

  notificationIntervalInput.addEventListener('change', (e) => {
    // Получаем значение из поля ввода
    let interval = parseInt(e.target.value);
    
    // Проверяем, что значение находится в допустимом диапазоне
    if (isNaN(interval) || interval < 1) {
      interval = 1; // Минимальное значение - 1 секунда
      e.target.value = interval;
    } else if (interval > 60) {
      interval = 60; // Максимальное значение - 60 секунд
      e.target.value = interval;
    }
    
    // Сохраняем значение во временных настройках
    tempSettings.notificationInterval = interval;
  });

  // Обработчики изменений для пользовательских тегов
  document.getElementById('customTag1').addEventListener('change', (e) => {
    tempSettings.customTag1 = e.target.value.trim();
  });
  
  document.getElementById('customTag2').addEventListener('change', (e) => {
    tempSettings.customTag2 = e.target.value.trim();
  });
  
  document.getElementById('customTag3').addEventListener('change', (e) => {
    tempSettings.customTag3 = e.target.value.trim();
  });
  
  document.getElementById('customTag4').addEventListener('change', (e) => {
    tempSettings.customTag4 = e.target.value.trim();
  });

  wizardToggle.addEventListener('change', (e) => {
    tempSettings.blockWizard = e.target.checked;
  });
  
  // Обработчики изменений для переключателей поиска
  searchDriverInfoToggle.addEventListener('change', (e) => {
    tempSettings.searchDriverInfo = e.target.checked;
  });
  
  // Обработчик изменения состояния маркера
  markerToggle.addEventListener('change', (e) => {
    tempSettings.markerEnabled = e.target.checked;
  });
  
  // Добавляем обработчик для переключателя логирования
  document.getElementById('loggingToggle').addEventListener('change', (e) => {
    tempSettings.loggingEnabled = e.target.checked;
    Utils.log('Переключатель логирования изменен:', tempSettings.loggingEnabled);
  });
  
  // Обработчик изменения состояния переключателя notificationToCommentToggle
  notificationToCommentToggle.addEventListener('change', (e) => {
    tempSettings.notificationToComment = e.target.checked;
  });
  
  // Обработчики изменений для переключателей автопоиска
  autosearchPresetsToggle.addEventListener('change', (e) => {
    tempSettings.autosearchPresets = e.target.checked;
  });
  
  autosearchTestingToggle.addEventListener('change', (e) => {
    tempSettings.autosearchTesting = e.target.checked;
  });
  
  autosearchLastOrdersToggle.addEventListener('change', (e) => {
    tempSettings.autosearchLastOrders = e.target.checked;
  });
  
  // Обработчики для модуля Фин. Лайт
  const finlightFirstParagraphButton = document.getElementById('finlightFirstParagraphButton');
  const finlightFinalCalculationButton = document.getElementById('finlightFinalCalculationButton');
  
  // Элементы модальных окон Фин. Лайт
  const finlightFirstParagraphModal = document.getElementById('finlightFirstParagraphModal');
  const finlightFinalCalculationModal = document.getElementById('finlightFinalCalculationModal');
  const closeFinlightFirstParagraphModal = document.querySelector('.close-finlight-first-paragraph-modal');
  const closeFinlightFinalCalculationModal = document.querySelector('.close-finlight-final-calculation-modal');
  const saveFinlightFirstParagraph = document.getElementById('saveFinlightFirstParagraph');
  const cancelFinlightFirstParagraph = document.getElementById('cancelFinlightFirstParagraph');
  const saveFinlightFinalCalculation = document.getElementById('saveFinlightFinalCalculation');
  const cancelFinlightFinalCalculation = document.getElementById('cancelFinlightFinalCalculation');
  const finlightFirstParagraphTextModal = document.getElementById('finlightFirstParagraphTextModal');
  const finlightDetailedPricingToggleModal = document.getElementById('finlightDetailedPricingToggleModal');
  const finlightBriefPricingToggleModal = document.getElementById('finlightBriefPricingToggleModal');
  const finlightCollectPriceComponentsToggleModal = document.getElementById('finlightCollectPriceComponentsToggleModal');
  
  if (finlightFirstParagraphButton) {
    finlightFirstParagraphButton.addEventListener('click', () => {
      // Открываем модальное окно вместо изменения состояния
      if (finlightFirstParagraphModal) {
        // Загружаем текущий текст в модальное окно
        if (finlightFirstParagraphTextModal) {
          finlightFirstParagraphTextModal.value = tempSettings.finlightFirstParagraphText || 'Всё проверила и не обнаружила никаких нарушений при расчёте заказа НОМЕР_ЗАКАЗА. Стоимость заказа рассчитана верно в соответствии с тарифом.';
        }
        finlightFirstParagraphModal.style.display = 'block';
      }
    });
  }
  
  if (finlightFinalCalculationButton) {
    finlightFinalCalculationButton.addEventListener('click', () => {
      // Открываем модальное окно вместо изменения состояния
      if (finlightFinalCalculationModal) {
        // Загружаем текущие настройки в модальное окно
        if (finlightDetailedPricingToggleModal) {
          finlightDetailedPricingToggleModal.checked = tempSettings.finlightDetailedPricing || false;
        }
        if (finlightBriefPricingToggleModal) {
          finlightBriefPricingToggleModal.checked = tempSettings.finlightBriefPricing || false;
        }
        if (finlightCollectPriceComponentsToggleModal) {
          finlightCollectPriceComponentsToggleModal.checked = tempSettings.finlightCollectPriceComponents || false;
        }
        finlightFinalCalculationModal.style.display = 'block';
      }
    });
  }
  
  // Обработчики для модального окна первого абзаца
  if (closeFinlightFirstParagraphModal) {
    closeFinlightFirstParagraphModal.addEventListener('click', () => {
      if (finlightFirstParagraphModal) {
        finlightFirstParagraphModal.style.display = 'none';
      }
    });
  }
  
  if (saveFinlightFirstParagraph) {
    saveFinlightFirstParagraph.addEventListener('click', () => {
      if (finlightFirstParagraphTextModal) {
        tempSettings.finlightFirstParagraphText = finlightFirstParagraphTextModal.value;
        tempSettings.finlightFirstParagraph = true;
      }
      if (finlightFirstParagraphModal) {
        finlightFirstParagraphModal.style.display = 'none';
      }
    });
  }
  
  if (cancelFinlightFirstParagraph) {
    cancelFinlightFirstParagraph.addEventListener('click', () => {
      if (finlightFirstParagraphModal) {
        finlightFirstParagraphModal.style.display = 'none';
      }
    });
  }
  
  // Обработчики для модального окна итогового расчёта
  if (closeFinlightFinalCalculationModal) {
    closeFinlightFinalCalculationModal.addEventListener('click', () => {
      if (finlightFinalCalculationModal) {
        finlightFinalCalculationModal.style.display = 'none';
      }
    });
  }
  
  if (saveFinlightFinalCalculation) {
    saveFinlightFinalCalculation.addEventListener('click', () => {
      if (finlightDetailedPricingToggleModal) {
        tempSettings.finlightDetailedPricing = finlightDetailedPricingToggleModal.checked;
      }
      if (finlightBriefPricingToggleModal) {
        tempSettings.finlightBriefPricing = finlightBriefPricingToggleModal.checked;
      }
      if (finlightCollectPriceComponentsToggleModal) {
        tempSettings.finlightCollectPriceComponents = finlightCollectPriceComponentsToggleModal.checked;
      }
      tempSettings.finlightFinalCalculation = true;
      if (finlightFinalCalculationModal) {
        finlightFinalCalculationModal.style.display = 'none';
      }
    });
  }
  
  if (cancelFinlightFinalCalculation) {
    cancelFinlightFinalCalculation.addEventListener('click', () => {
      if (finlightFinalCalculationModal) {
        finlightFinalCalculationModal.style.display = 'none';
      }
    });
  }
  
  // Обработчики для переключателей прайсинга в модальном окне (взаимное исключение)
  if (finlightDetailedPricingToggleModal) {
    finlightDetailedPricingToggleModal.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (finlightBriefPricingToggleModal) {
          finlightBriefPricingToggleModal.checked = false;
        }
      }
    });
  }
  
  if (finlightBriefPricingToggleModal) {
    finlightBriefPricingToggleModal.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (finlightDetailedPricingToggleModal) {
          finlightDetailedPricingToggleModal.checked = false;
        }
      }
    });
  }
  
  // Обработчики для переключателей прайсинга (взаимное исключение) - оставляем для совместимости
  // Убраны обработчики для удаленных элементов из основного меню
  // if (finlightDetailedPricingToggle) {
  //   finlightDetailedPricingToggle.addEventListener('change', (e) => {
  //     if (e.target.checked) {
  //       tempSettings.finlightDetailedPricing = true;
  //       tempSettings.finlightBriefPricing = false;
  //       if (finlightBriefPricingToggle) {
  //         finlightBriefPricingToggle.checked = false;
  //       }
  //       Utils.log('Включен подробный прайсинг');
  //     } else {
  //       tempSettings.finlightDetailedPricing = false;
  //       Utils.log('Отключен подробный прайсинг');
  //     }
  //   });
  // }
  
  // if (finlightBriefPricingToggle) {
  //   finlightBriefPricingToggle.addEventListener('change', (e) => {
  //     if (e.target.checked) {
  //       tempSettings.finlightBriefPricing = true;
  //       tempSettings.finlightDetailedPricing = false;
  //       if (finlightDetailedPricingToggle) {
  //         finlightDetailedPricingToggle.checked = false;
  //       }
  //       Utils.log('Включен краткий прайсинг');
  //     } else {
  //       tempSettings.finlightBriefPricing = false;
  //       Utils.log('Отключен краткий прайсинг');
  //     }
  //   });
  // }
  
  // Обработчик для переключателя "Собирать только компоненты цены" в модальном окне
  if (finlightCollectPriceComponentsToggleModal) {
    finlightCollectPriceComponentsToggleModal.addEventListener('change', (e) => {
      tempSettings.finlightCollectPriceComponents = e.target.checked;
      Utils.log('Переключатель "Собирать только компоненты цены" изменен:', tempSettings.finlightCollectPriceComponents);
    });
  }
  
  // Обработчик для кнопки логирования всех действий
  const actionLoggingButton = document.getElementById('actionLoggingButton');
  if (actionLoggingButton) {
    actionLoggingButton.addEventListener('click', () => {
      handleActionLoggingButtonClick();
    });
  }
  
  // Функция для получения цвета по умолчанию
  function getDefaultColor(index) {
    const colors = [
      '#ffff00', // Желтый
      '#90ee90', // Светло-зеленый
      '#add8e6', // Светло-синий
      '#ffb6c1', // Светло-розовый
      '#ffa500'  // Оранжевый
    ];
    
    return colors[index % colors.length];
  }
  
  // Обработчик нажатия кнопки "Применить"
  document.getElementById('applySettings').addEventListener('click', async () => {
    try {
      // Сохраняем настройки
      saveSettings();
      
      // Обновляем интерфейс, чтобы отразить выбранные пресеты
      if (searchPreset1Select) searchPreset1Select.value = tempSettings.searchPreset1;
      if (searchPreset2Select) searchPreset2Select.value = tempSettings.searchPreset2;
      if (searchPreset3Select) searchPreset3Select.value = tempSettings.searchPreset3;
      
      // Обновляем правила блокировки мастера
      updateBlockingRules(tempSettings.blockWizard);
      
      // Показываем уведомление об успешном сохранении
      showNotification('Настройки успешно применены!', 'success');
      Utils.log('Настройки успешно применены!');
      
      // Закрываем текущую вкладку
      window.close();
    } catch (error) {
      Utils.error('Ошибка при сохранении настроек:', error);
      showNotification('Произошла ошибка при сохранении настроек', 'error');
    }
  });
  
  // Обработчик для кнопки режима разработчика
  const devModeButton = document.getElementById('devModeButton');
  const devModeMenu = document.getElementById('devModeMenu');
  
  if (devModeButton && devModeMenu) {
    // Флаг для отслеживания состояния меню
    let isDevMenuOpen = false;
    
    // Обработчик нажатия на кнопку
    devModeButton.addEventListener('click', () => {
      isDevMenuOpen = !isDevMenuOpen;
      
      // Открываем или закрываем меню
      if (isDevMenuOpen) {
        devModeMenu.style.display = 'block';
        // Добавляем плавное появление
        setTimeout(() => {
          devModeMenu.style.opacity = '1';
        }, 10);
      } else {
        devModeMenu.style.opacity = '0';
        // Ждем окончания анимации перед скрытием
        setTimeout(() => {
          devModeMenu.style.display = 'none';
        }, 300);
      }
    });
    
    // Закрываем меню при клике вне его
    document.addEventListener('click', (event) => {
      if (isDevMenuOpen && 
          !devModeMenu.contains(event.target) && 
          event.target !== devModeButton) {
        isDevMenuOpen = false;
        devModeMenu.style.opacity = '0';
        setTimeout(() => {
          devModeMenu.style.display = 'none';
        }, 300);
      }
    });
  }
  
  // Функция обновления правил блокировки
  function updateBlockingRules(enabled) {
    chrome.runtime.sendMessage({ 
      action: 'updateBlocking', 
      enabled: enabled 
    });
  }

  // Функция для отображения уведомлений
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Добавляем уведомление в DOM
    document.body.appendChild(notification);
    
    // Удаляем уведомление через 3 секунды
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 500);
    }, 3000);
  }

  // Добавляем стили для уведомлений
  const style = document.createElement('style');
  style.textContent = `
    .notification {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 10px 20px;
      border-radius: 5px;
      color: white;
      font-weight: bold;
      z-index: 9999;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      transition: opacity 0.5s;
    }
    
    .notification.info {
      background-color: #2196F3;
    }
    
    .notification.success {
      background-color: #4CAF50;
    }
    
    .notification.error {
      background-color: #F44336;
    }
    
    .notification.fade-out {
      opacity: 0;
    }
  `;
  document.head.appendChild(style);

  // Функция для загрузки настроек
  async function loadSettings() {
    try {
      // Загружаем настройки из локального хранилища
      chrome.storage.local.get([
        'notifications',
        'notificationInterval',
        'wizard',
        'marker',
        'markerEnabled',
        'markers',
        'customTag1',
        'customTag2',
        'customTag3',
        'customTag4',
        'customTagsPresets',
        'activeCustomTagsPreset',
        'searchPreset1',
        'searchPreset2',
        'searchPreset3',
        'searchDriverInfo',
        'searchPreset1Enabled',
        'searchPreset2Enabled',
        'searchPreset3Enabled',
        'loggingEnabled',
        'notificationToComment',
        'outputGreenOnly',
        'outputProfession',
        'actionLoggingEnabled',
        'actionLoggingState',
        'actionLogs',
        'autosearchPresets',
        'autosearchTesting',
        'autosearchLastOrders',
        // Настройки Фин. Лайт
        'finlightFirstParagraph',
        'finlightFirstParagraphText',
        'finlightFinalCalculation',
        'finlightDetailedPricing',
        'finlightBriefPricing',
        'finlightCollectPriceComponents',
        // Настройки SMS (из popup.js)
        'smsTexts',
        'smsTicketId',
        'smsType',
        'openSmsMenu'
      ], (result) => {
        Utils.log('Загруженные настройки:', result);
        
        // Обновляем временные настройки
        if (result.notifications !== undefined) tempSettings.notifications = result.notifications;
        if (result.notificationInterval !== undefined) tempSettings.notificationInterval = result.notificationInterval;
        if (result.wizard !== undefined) tempSettings.blockWizard = result.wizard;
        if (result.markerEnabled !== undefined) {
          tempSettings.markerEnabled = result.markerEnabled;
        } else if (result.marker !== undefined) {
          tempSettings.markerEnabled = result.marker;
        }
        // Дополнительные настройки из других модулей
        if (result.wizard !== undefined) tempSettings.blockWizard = result.wizard; // wizard = blockWizard
        if (result.marker !== undefined) tempSettings.markerEnabled = result.marker; // marker = markerEnabled
        if (result.markers !== undefined) tempSettings.markers = result.markers;
        if (result.customTag1 !== undefined) tempSettings.customTag1 = result.customTag1;
        if (result.customTag2 !== undefined) tempSettings.customTag2 = result.customTag2;
        if (result.customTag3 !== undefined) tempSettings.customTag3 = result.customTag3;
        if (result.customTag4 !== undefined) tempSettings.customTag4 = result.customTag4;
        if (result.customTagsPresets !== undefined) tempSettings.customTagsPresets = result.customTagsPresets;
        if (result.activeCustomTagsPreset !== undefined) tempSettings.activeCustomTagsPreset = result.activeCustomTagsPreset;
        if (result.searchPreset1 !== undefined) tempSettings.searchPreset1 = result.searchPreset1;
        if (result.searchPreset2 !== undefined) tempSettings.searchPreset2 = result.searchPreset2;
        if (result.searchPreset3 !== undefined) tempSettings.searchPreset3 = result.searchPreset3;
        if (result.searchDriverInfo !== undefined) tempSettings.searchDriverInfo = result.searchDriverInfo;
        if (result.searchPreset1Enabled !== undefined) tempSettings.searchPreset1Enabled = result.searchPreset1Enabled;
        if (result.searchPreset2Enabled !== undefined) tempSettings.searchPreset2Enabled = result.searchPreset2Enabled;
        if (result.searchPreset3Enabled !== undefined) tempSettings.searchPreset3Enabled = result.searchPreset3Enabled;
        if (result.loggingEnabled !== undefined) tempSettings.loggingEnabled = result.loggingEnabled;
        if (result.notificationToComment !== undefined) tempSettings.notificationToComment = result.notificationToComment;
        if (result.outputGreenOnly !== undefined) tempSettings.outputGreenOnly = result.outputGreenOnly;
        if (result.outputProfession !== undefined) tempSettings.outputProfession = result.outputProfession;
        if (result.actionLoggingEnabled !== undefined) tempSettings.actionLoggingEnabled = result.actionLoggingEnabled;
        if (result.actionLoggingState !== undefined) tempSettings.actionLoggingState = result.actionLoggingState;
        if (result.actionLogs !== undefined) tempSettings.actionLogs = result.actionLogs;
        if (result.autosearchPresets !== undefined) tempSettings.autosearchPresets = result.autosearchPresets;
        if (result.autosearchTesting !== undefined) tempSettings.autosearchTesting = result.autosearchTesting;
        if (result.autosearchLastOrders !== undefined) tempSettings.autosearchLastOrders = result.autosearchLastOrders;
        
        // Настройки Фин. Лайт
        if (result.finlightFirstParagraph !== undefined) tempSettings.finlightFirstParagraph = result.finlightFirstParagraph;
        if (result.finlightFirstParagraphText !== undefined) tempSettings.finlightFirstParagraphText = result.finlightFirstParagraphText;
        if (result.finlightFinalCalculation !== undefined) tempSettings.finlightFinalCalculation = result.finlightFinalCalculation;
        if (result.finlightDetailedPricing !== undefined) tempSettings.finlightDetailedPricing = result.finlightDetailedPricing;
        if (result.finlightBriefPricing !== undefined) tempSettings.finlightBriefPricing = result.finlightBriefPricing;
        if (result.finlightCollectPriceComponents !== undefined) tempSettings.finlightCollectPriceComponents = result.finlightCollectPriceComponents;
        
        // Настройки SMS (из popup.js)
        if (result.smsTexts !== undefined) tempSettings.smsTexts = result.smsTexts;
        if (result.smsTicketId !== undefined) tempSettings.smsTicketId = result.smsTicketId;
        if (result.smsType !== undefined) tempSettings.smsType = result.smsType;
        if (result.openSmsMenu !== undefined) tempSettings.openSmsMenu = result.openSmsMenu;
        
        Utils.log('Обновленные временные настройки:', tempSettings);
        
        // Обновляем значения в интерфейсе
        notificationToggle.checked = tempSettings.notifications;
        wizardToggle.checked = tempSettings.blockWizard;
        notificationIntervalInput.value = tempSettings.notificationInterval;
        searchDriverInfoToggle.checked = tempSettings.searchDriverInfo;
        markerToggle.checked = tempSettings.markerEnabled;
        document.getElementById('loggingToggle').checked = tempSettings.loggingEnabled;
        notificationToCommentToggle.checked = tempSettings.notificationToComment;
        
        // Обновляем состояние переключателей поиска
        document.getElementById('searchPreset1Toggle').checked = tempSettings.searchPreset1Enabled;
        document.getElementById('searchPreset2Toggle').checked = tempSettings.searchPreset2Enabled;
        document.getElementById('searchPreset3Toggle').checked = tempSettings.searchPreset3Enabled;
        
        // Обновляем выбранные пресеты поиска
        if (searchPreset1Select) {
          searchPreset1Select.value = tempSettings.searchPreset1;
          Utils.log('Установлен searchPreset1Select.value:', searchPreset1Select.value);
        }
        if (searchPreset2Select) {
          searchPreset2Select.value = tempSettings.searchPreset2;
          Utils.log('Установлен searchPreset2Select.value:', searchPreset2Select.value);
        }
        if (searchPreset3Select) {
          searchPreset3Select.value = tempSettings.searchPreset3;
          Utils.log('Установлен searchPreset3Select.value:', searchPreset3Select.value);
        }
        
        // Обновляем состояние переключателей настроек вывода
        if (outputGreenToggle) outputGreenToggle.checked = tempSettings.outputGreenOnly;
        if (outputProfessionToggle) outputProfessionToggle.checked = tempSettings.outputProfession;
        
        // Обновляем состояние переключателей автопоиска
        autosearchPresetsToggle.checked = tempSettings.autosearchPresets;
        autosearchTestingToggle.checked = tempSettings.autosearchTesting;
        autosearchLastOrdersToggle.checked = tempSettings.autosearchLastOrders;
        
        // Обновляем состояние элементов Фин. Лайт
        const finlightFirstParagraphButton = document.getElementById('finlightFirstParagraphButton');
        const finlightFinalCalculationButton = document.getElementById('finlightFinalCalculationButton');
        
        // Убираем зеленое выделение кнопок - они должны быть в общей стилистике
        // if (finlightFirstParagraphButton) {
        //   finlightFirstParagraphButton.style.backgroundImage = tempSettings.finlightFirstParagraph 
        //     ? 'linear-gradient(135deg, #4c4, #3a3)' 
        //     : 'linear-gradient(135deg, #a88368, #8a6c55)';
        // }
        
        // if (finlightFinalCalculationButton) {
        //   finlightFinalCalculationButton.style.backgroundImage = tempSettings.finlightFinalCalculation 
        //     ? 'linear-gradient(135deg, #4c4, #3a3)' 
        //     : 'linear-gradient(135deg, #a88368, #8a6c55)';
        // }
        
        // Обновляем значения в модальных окнах Фин. Лайт
        const finlightFirstParagraphTextModal = document.getElementById('finlightFirstParagraphTextModal');
        const finlightDetailedPricingToggleModal = document.getElementById('finlightDetailedPricingToggleModal');
        const finlightBriefPricingToggleModal = document.getElementById('finlightBriefPricingToggleModal');
        const finlightCollectPriceComponentsToggleModal = document.getElementById('finlightCollectPriceComponentsToggleModal');
        
        if (finlightFirstParagraphTextModal) {
          finlightFirstParagraphTextModal.value = tempSettings.finlightFirstParagraphText || 'Всё проверила и не обнаружила никаких нарушений при расчёте заказа НОМЕР_ЗАКАЗА. Стоимость заказа рассчитана верно в соответствии с тарифом.';
        }
        if (finlightDetailedPricingToggleModal) {
          finlightDetailedPricingToggleModal.checked = tempSettings.finlightDetailedPricing || false;
        }
        if (finlightBriefPricingToggleModal) {
          finlightBriefPricingToggleModal.checked = tempSettings.finlightBriefPricing || false;
        }
        if (finlightCollectPriceComponentsToggleModal) {
          finlightCollectPriceComponentsToggleModal.checked = tempSettings.finlightCollectPriceComponents || false;
        }
        
        // Обновляем кнопку логирования действий
        updateActionLoggingButton();
        
        Utils.log('Настройки успешно загружены');
      });
    } catch (error) {
      Utils.error('Ошибка при загрузке настроек:', error);
    }
  }
  
  // Функция для сохранения настроек
  async function saveSettings() {
    try {
      Utils.log('Сохраняем настройки. Текущие значения пресетов:');
      Utils.log('searchPreset1:', tempSettings.searchPreset1);
      Utils.log('searchPreset2:', tempSettings.searchPreset2);
      Utils.log('searchPreset3:', tempSettings.searchPreset3);
      
      // Проверяем, что значения пресетов соответствуют выбранным в интерфейсе
      if (searchPreset1Select) {
        tempSettings.searchPreset1 = searchPreset1Select.value;
        Utils.log('Обновлен searchPreset1 из интерфейса:', tempSettings.searchPreset1);
      }
      if (searchPreset2Select) {
        tempSettings.searchPreset2 = searchPreset2Select.value;
        Utils.log('Обновлен searchPreset2 из интерфейса:', tempSettings.searchPreset2);
      }
      if (searchPreset3Select) {
        tempSettings.searchPreset3 = searchPreset3Select.value;
        Utils.log('Обновлен searchPreset3 из интерфейса:', tempSettings.searchPreset3);
      }
      
      // Обновляем состояние переключателей поиска из интерфейса с проверкой существования
      const searchPreset1Toggle = document.getElementById('searchPreset1Toggle');
      const searchPreset2Toggle = document.getElementById('searchPreset2Toggle');
      const searchPreset3Toggle = document.getElementById('searchPreset3Toggle');
      
      if (searchPreset1Toggle) {
        tempSettings.searchPreset1Enabled = searchPreset1Toggle.checked;
        Utils.log('Обновлен переключатель searchPreset1Enabled из интерфейса:', tempSettings.searchPreset1Enabled);
      } else {
        Utils.error('Элемент searchPreset1Toggle не найден');
      }
      
      if (searchPreset2Toggle) {
        tempSettings.searchPreset2Enabled = searchPreset2Toggle.checked;
        Utils.log('Обновлен переключатель searchPreset2Enabled из интерфейса:', tempSettings.searchPreset2Enabled);
      } else {
        Utils.error('Элемент searchPreset2Toggle не найден');
      }
      
      if (searchPreset3Toggle) {
        tempSettings.searchPreset3Enabled = searchPreset3Toggle.checked;
        Utils.log('Обновлен переключатель searchPreset3Enabled из интерфейса:', tempSettings.searchPreset3Enabled);
      } else {
        Utils.error('Элемент searchPreset3Toggle не найден');
      }
      
      // Обновляем состояние переключателей автопоиска из интерфейса с проверкой существования
      const autosearchPresetsToggle = document.getElementById('autosearchPresetsToggle');
      const autosearchTestingToggle = document.getElementById('autosearchTestingToggle');
      const autosearchLastOrdersToggle = document.getElementById('autosearchLastOrdersToggle');
      
      if (autosearchPresetsToggle) {
        tempSettings.autosearchPresets = autosearchPresetsToggle.checked;
        Utils.log('Обновлен переключатель autosearchPresets из интерфейса:', tempSettings.autosearchPresets);
      } else {
        Utils.error('Элемент autosearchPresetsToggle не найден');
      }
      
      if (autosearchTestingToggle) {
        tempSettings.autosearchTesting = autosearchTestingToggle.checked;
        Utils.log('Обновлен переключатель autosearchTesting из интерфейса:', tempSettings.autosearchTesting);
      } else {
        Utils.error('Элемент autosearchTestingToggle не найден');
      }
      
      if (autosearchLastOrdersToggle) {
        tempSettings.autosearchLastOrders = autosearchLastOrdersToggle.checked;
        Utils.log('Обновлен переключатель autosearchLastOrders из интерфейса:', tempSettings.autosearchLastOrders);
      } else {
        Utils.error('Элемент autosearchLastOrdersToggle не найден');
      }
      
      // Обновляем состояние переключателя логирования из интерфейса
      const loggingToggle = document.getElementById('loggingToggle');
      if (loggingToggle) {
        tempSettings.loggingEnabled = loggingToggle.checked;
        Utils.log('Обновлен переключатель логирования из интерфейса:', tempSettings.loggingEnabled);
      } else {
        Utils.error('Элемент loggingToggle не найден');
      }
      
      // Обновляем состояние переключателей настроек вывода из интерфейса
      const outputGreenToggle = document.getElementById('outputGreenToggle');
      const outputProfessionToggle = document.getElementById('outputProfessionToggle');
      
      if (outputGreenToggle) {
        tempSettings.outputGreenOnly = outputGreenToggle.checked;
        Utils.log('Обновлен переключатель outputGreenOnly из интерфейса:', tempSettings.outputGreenOnly);
      } else {
        Utils.error('Элемент outputGreenToggle не найден');
      }
      
      if (outputProfessionToggle) {
        tempSettings.outputProfession = outputProfessionToggle.checked;
        Utils.log('Обновлен переключатель outputProfession из интерфейса:', tempSettings.outputProfession);
      } else {
        Utils.error('Элемент outputProfessionToggle не найден');
      }
      
      // Обновляем значения из модальных окон Фин. Лайт
      const finlightFirstParagraphTextModal = document.getElementById('finlightFirstParagraphTextModal');
      const finlightDetailedPricingToggleModal = document.getElementById('finlightDetailedPricingToggleModal');
      const finlightBriefPricingToggleModal = document.getElementById('finlightBriefPricingToggleModal');
      const finlightCollectPriceComponentsToggleModal = document.getElementById('finlightCollectPriceComponentsToggleModal');
      
      if (finlightFirstParagraphTextModal) {
        tempSettings.finlightFirstParagraphText = finlightFirstParagraphTextModal.value;
      }
      if (finlightDetailedPricingToggleModal) {
        tempSettings.finlightDetailedPricing = finlightDetailedPricingToggleModal.checked;
      }
      if (finlightBriefPricingToggleModal) {
        tempSettings.finlightBriefPricing = finlightBriefPricingToggleModal.checked;
      }
      if (finlightCollectPriceComponentsToggleModal) {
        tempSettings.finlightCollectPriceComponents = finlightCollectPriceComponentsToggleModal.checked;
      }
      
      // Обновляем основные переключатели из интерфейса
      if (notificationToggle) {
        tempSettings.notifications = notificationToggle.checked;
        Utils.log('Обновлен переключатель уведомлений из интерфейса:', tempSettings.notifications);
      }
      if (wizardToggle) {
        tempSettings.blockWizard = wizardToggle.checked;
        Utils.log('Обновлен переключатель косметических улучшений из интерфейса:', tempSettings.blockWizard);
      }
      if (notificationIntervalInput) {
        tempSettings.notificationInterval = parseInt(notificationIntervalInput.value);
        Utils.log('Обновлен интервал уведомлений из интерфейса:', tempSettings.notificationInterval);
      }
      if (searchDriverInfoToggle) {
        tempSettings.searchDriverInfo = searchDriverInfoToggle.checked;
        Utils.log('Обновлен переключатель поиска страны из интерфейса:', tempSettings.searchDriverInfo);
      }
      if (markerToggle) {
        tempSettings.markerEnabled = markerToggle.checked;
        Utils.log('Обновлен переключатель маркера из интерфейса:', tempSettings.markerEnabled);
      }
      if (notificationToCommentToggle) {
        tempSettings.notificationToComment = notificationToCommentToggle.checked;
        Utils.log('Обновлен переключатель вывода во внутряк из интерфейса:', tempSettings.notificationToComment);
      }
      
      // Обновляем пользовательские теги из интерфейса
      const customTag1Element = document.getElementById('customTag1');
      const customTag2Element = document.getElementById('customTag2');
      const customTag3Element = document.getElementById('customTag3');
      const customTag4Element = document.getElementById('customTag4');
      
      if (customTag1Element) {
        tempSettings.customTag1 = customTag1Element.value.trim();
        Utils.log('Обновлен пользовательский тег 1 из интерфейса:', tempSettings.customTag1);
      } else {
        Utils.error('Элемент customTag1 не найден');
      }
      
      if (customTag2Element) {
        tempSettings.customTag2 = customTag2Element.value.trim();
        Utils.log('Обновлен пользовательский тег 2 из интерфейса:', tempSettings.customTag2);
      } else {
        Utils.error('Элемент customTag2 не найден');
      }
      
      if (customTag3Element) {
        tempSettings.customTag3 = customTag3Element.value.trim();
        Utils.log('Обновлен пользовательский тег 3 из интерфейса:', tempSettings.customTag3);
      } else {
        Utils.error('Элемент customTag3 не найден');
      }
      
      if (customTag4Element) {
        tempSettings.customTag4 = customTag4Element.value.trim();
        Utils.log('Обновлен пользовательский тег 4 из интерфейса:', tempSettings.customTag4);
      } else {
        Utils.error('Элемент customTag4 не найден');
      }
      
      // Обновляем настройки маркера из модального окна
      // Проверяем, открыто ли модальное окно маркера (элементы существуют в DOM)
      const markerModalElement = document.getElementById('markerModal');
      const isMarkerModalOpen = markerModalElement && markerModalElement.style.display === 'block';
      
      let markers = [];
      
      if (isMarkerModalOpen) {
        // Модальное окно открыто - собираем настройки из интерфейса
        Utils.log('Модальное окно маркера открыто - собираем настройки из интерфейса');
        
        // Обрабатываем базовые маркеры (1-5)
        for (let i = 1; i <= 5; i++) {
          const markerTextElement = document.getElementById(`markerText${i}`);
          const markerColorElement = document.getElementById(`markerColor${i}`);
          const markerExactElement = document.getElementById(`markerExact${i}`);
          
          if (markerTextElement && markerColorElement && markerExactElement) {
            const text = markerTextElement.value.trim();
            if (text) { // Добавляем только маркеры с непустым текстом
              markers.push({
                text: text,
                color: markerColorElement.value,
                exactMatch: markerExactElement.checked
              });
              Utils.log(`Обновлен маркер ${i} из интерфейса:`, { text, color: markerColorElement.value, exactMatch: markerExactElement.checked });
            }
          } else {
            Utils.error(`Элементы маркера ${i} не найдены`);
          }
        }
        
        // Обрабатываем дополнительные маркеры (6+)
        const additionalMarkersContainer = document.getElementById('additionalMarkers');
        if (additionalMarkersContainer) {
          const additionalMarkerItems = additionalMarkersContainer.querySelectorAll('.marker-item');
          additionalMarkerItems.forEach((item, index) => {
            const markerIndex = 6 + index;
            const markerTextElement = item.querySelector('input[type="text"]');
            const markerColorElement = item.querySelector('input[type="color"]');
            const markerExactElement = item.querySelector('input[type="checkbox"]');
            
            if (markerTextElement && markerColorElement && markerExactElement) {
              const text = markerTextElement.value.trim();
              if (text) { // Добавляем только маркеры с непустым текстом
                markers.push({
                  text: text,
                  color: markerColorElement.value,
                  exactMatch: markerExactElement.checked
                });
                Utils.log(`Обновлен дополнительный маркер ${markerIndex} из интерфейса:`, { text, color: markerColorElement.value, exactMatch: markerExactElement.checked });
              }
            } else {
              Utils.error(`Элементы дополнительного маркера ${markerIndex} не найдены`);
            }
          });
        } else {
          Utils.error('Контейнер дополнительных маркеров не найден');
        }
      } else {
        // Модальное окно не открыто - используем существующие настройки
        Utils.log('Модальное окно маркера не открыто - используем существующие настройки');
        markers = tempSettings.markers || [];
        Utils.log('Используем существующие настройки маркера:', markers);
      }
      
      // Обновляем настройки маркеров
      tempSettings.markers = markers;
      Utils.log('Обновлены настройки маркеров из интерфейса, всего маркеров:', markers.length);
      
      // Итоговое логирование всех обновленных настроек
      Utils.log('=== ИТОГОВЫЙ ОТЧЕТ ОБНОВЛЕНИЯ НАСТРОЕК ===');
      Utils.log('Основные настройки:', {
        notifications: tempSettings.notifications,
        blockWizard: tempSettings.blockWizard,
        notificationInterval: tempSettings.notificationInterval,
        searchDriverInfo: tempSettings.searchDriverInfo,
        markerEnabled: tempSettings.markerEnabled,
        loggingEnabled: tempSettings.loggingEnabled,
        notificationToComment: tempSettings.notificationToComment
      });
      Utils.log('Пресеты поиска:', {
        searchPreset1: tempSettings.searchPreset1,
        searchPreset1Enabled: tempSettings.searchPreset1Enabled,
        searchPreset2: tempSettings.searchPreset2,
        searchPreset2Enabled: tempSettings.searchPreset2Enabled,
        searchPreset3: tempSettings.searchPreset3,
        searchPreset3Enabled: tempSettings.searchPreset3Enabled
      });
      Utils.log('Автопоиск:', {
        autosearchPresets: tempSettings.autosearchPresets,
        autosearchTesting: tempSettings.autosearchTesting,
        autosearchLastOrders: tempSettings.autosearchLastOrders
      });
      Utils.log('Пользовательские теги:', {
        customTag1: tempSettings.customTag1,
        customTag2: tempSettings.customTag2,
        customTag3: tempSettings.customTag3,
        customTag4: tempSettings.customTag4
      });
      Utils.log('Настройки вывода:', {
        outputGreenOnly: tempSettings.outputGreenOnly,
        outputProfession: tempSettings.outputProfession
      });
      Utils.log('Настройки маркеров:', {
        markerEnabled: tempSettings.markerEnabled,
        markersCount: tempSettings.markers ? tempSettings.markers.length : 0
      });
      Utils.log('Настройки Фин. Лайт:', {
        finlightFirstParagraph: tempSettings.finlightFirstParagraph,
        finlightFirstParagraphText: tempSettings.finlightFirstParagraphText,
        finlightFinalCalculation: tempSettings.finlightFinalCalculation,
        finlightDetailedPricing: tempSettings.finlightDetailedPricing,
        finlightBriefPricing: tempSettings.finlightBriefPricing,
        finlightCollectPriceComponents: tempSettings.finlightCollectPriceComponents
      });
      Utils.log('=== КОНЕЦ ОТЧЕТА ===');
      
      // Создаем объект с настройками для сохранения
      const settingsToSave = {
        notifications: tempSettings.notifications,
        notificationInterval: tempSettings.notificationInterval,
        wizard: tempSettings.blockWizard,
        marker: tempSettings.markerEnabled,
        markerEnabled: tempSettings.markerEnabled,
        markers: tempSettings.markers,
        customTag1: tempSettings.customTag1,
        customTag2: tempSettings.customTag2,
        customTag3: tempSettings.customTag3,
        customTag4: tempSettings.customTag4,
        customTagsPresets: tempSettings.customTagsPresets,
        activeCustomTagsPreset: tempSettings.activeCustomTagsPreset,
        searchPreset1: tempSettings.searchPreset1,
        searchPreset2: tempSettings.searchPreset2,
        searchPreset3: tempSettings.searchPreset3,
        searchDriverInfo: tempSettings.searchDriverInfo,
        searchPreset1Enabled: tempSettings.searchPreset1Enabled,
        searchPreset2Enabled: tempSettings.searchPreset2Enabled,
        searchPreset3Enabled: tempSettings.searchPreset3Enabled,
        loggingEnabled: tempSettings.loggingEnabled,
        notificationToComment: tempSettings.notificationToComment,
        outputGreenOnly: tempSettings.outputGreenOnly,
        outputProfession: tempSettings.outputProfession,
        actionLoggingEnabled: tempSettings.actionLoggingEnabled,
        actionLoggingState: tempSettings.actionLoggingState,
        actionLogs: tempSettings.actionLogs,
        autosearchPresets: tempSettings.autosearchPresets,
        autosearchTesting: tempSettings.autosearchTesting,
        autosearchLastOrders: tempSettings.autosearchLastOrders,
        // Настройки Фин. Лайт
        finlightFirstParagraph: tempSettings.finlightFirstParagraph,
        finlightFirstParagraphText: tempSettings.finlightFirstParagraphText,
        finlightFinalCalculation: tempSettings.finlightFinalCalculation,
        finlightDetailedPricing: tempSettings.finlightDetailedPricing,
        finlightBriefPricing: tempSettings.finlightBriefPricing,
        finlightCollectPriceComponents: tempSettings.finlightCollectPriceComponents,
        // Настройки SMS (из popup.js)
        smsTexts: tempSettings.smsTexts,
        smsTicketId: tempSettings.smsTicketId,
        smsType: tempSettings.smsType,
        openSmsMenu: tempSettings.openSmsMenu,
        // Дополнительные настройки из других модулей
        wizard: tempSettings.blockWizard, // wizard = blockWizard
        marker: tempSettings.markerEnabled // marker = markerEnabled
      };
      
      // Сохраняем настройки в локальное хранилище
      chrome.storage.local.set(settingsToSave, () => {
        Utils.log('Настройки успешно сохранены через кнопку Применить:', settingsToSave);
        
        // Обновляем правила блокировки
        updateBlockingRules(tempSettings.blockWizard);
      });
      
      return true;
    } catch (error) {
      Utils.error('Ошибка при сохранении настроек:', error);
      return false;
    }
  }

  // Функция для открытия модального окна настроек вывода
  function openOutputSettingsModal() {
    // Заполняем поля в модальном окне текущими значениями
    outputGreenToggle.checked = tempSettings.outputGreenOnly;
    outputProfessionToggle.checked = tempSettings.outputProfession;
    
    // Показываем модальное окно
    outputSettingsModal.style.display = 'block';
  }
  
  // Функция для закрытия модального окна настроек вывода
  function closeOutputSettingsModal() {
    outputSettingsModal.style.display = 'none';
  }
  
  // Функция для сохранения настроек из модального окна настроек вывода
  function saveOutputSettingsModal() {
    // Сохраняем значения переключателей
    tempSettings.outputGreenOnly = outputGreenToggle.checked;
    tempSettings.outputProfession = outputProfessionToggle.checked;
    
    Utils.log('Настройки вывода сохранены локально в tempSettings');
    
    // Закрываем модальное окно
    closeOutputSettingsModal();
  }

  // Обработчики для модального окна настроек вывода
  if (openOutputSettingsBtn) {
    openOutputSettingsBtn.addEventListener('click', openOutputSettingsModal);
  }
  
  if (closeOutputSettingsBtn) {
    closeOutputSettingsBtn.addEventListener('click', closeOutputSettingsModal);
  }
  
  if (saveOutputSettingsBtn) {
    saveOutputSettingsBtn.addEventListener('click', saveOutputSettingsModal);
  }
  
  if (cancelOutputSettingsBtn) {
    cancelOutputSettingsBtn.addEventListener('click', closeOutputSettingsModal);
  }
  
  // Функция для обработки нажатия кнопки логирования действий
  function handleActionLoggingButtonClick() {
    const currentState = tempSettings.actionLoggingState;
    
    switch (currentState) {
      case 'disabled':
        // Включаем логирование
        tempSettings.actionLoggingEnabled = true;
        tempSettings.actionLoggingState = 'active';
        tempSettings.actionLogs = []; // Очищаем старые логи
        addActionLog('Логирование действий включено');
        updateActionLoggingButton();
        saveSettings();
        // Отправляем сообщение для включения логирования во всех вкладках
        chrome.runtime.sendMessage({ 
          action: 'toggleActionLogging', 
          enabled: true 
        });
        break;
        
      case 'active':
        // Выключаем логирование
        tempSettings.actionLoggingEnabled = false;
        tempSettings.actionLoggingState = 'ready_export';
        addActionLog('Логирование действий выключено');
        updateActionLoggingButton();
        saveSettings();
        // Отправляем сообщение для выключения логирования во всех вкладках
        chrome.runtime.sendMessage({ 
          action: 'toggleActionLogging', 
          enabled: false 
        });
        break;
        
      case 'ready_export':
        // Экспортируем логи
        exportActionLogs();
        break;
    }
  }
  
  // Функция для обновления внешнего вида кнопки логирования действий
  function updateActionLoggingButton() {
    const actionLoggingButton = document.getElementById('actionLoggingButton');
    if (!actionLoggingButton) return;
    
    const currentState = tempSettings.actionLoggingState;
    
    // Удаляем все классы состояний
    actionLoggingButton.classList.remove('logging-active', 'export-ready');
    
    switch (currentState) {
      case 'disabled':
        actionLoggingButton.textContent = 'Включить логирование';
        break;
        
      case 'active':
        actionLoggingButton.textContent = 'Выключить логирование';
        actionLoggingButton.classList.add('logging-active');
        break;
        
      case 'ready_export':
        actionLoggingButton.textContent = 'Выгрузить логи';
        actionLoggingButton.classList.add('export-ready');
        break;
    }
  }
  
  // Функция для добавления лога действия
  function addActionLog(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp: timestamp,
      message: message,
      data: data,
      url: window.location.href
    };
    
    tempSettings.actionLogs.push(logEntry);
    
    // Ограничиваем количество логов (последние 10000 записей)
    if (tempSettings.actionLogs.length > 10000) {
      tempSettings.actionLogs = tempSettings.actionLogs.slice(-10000);
    }
    
    Utils.log(`[Логирование действий] ${timestamp}: ${message}`, data);
  }
  
  // Функция для экспорта логов в .txt файл
  function exportActionLogs() {
    if (!tempSettings.actionLogs || tempSettings.actionLogs.length === 0) {
      showNotification('Нет логов для экспорта', 'error');
      Utils.log('Попытка экспорта логов: нет логов для экспорта');
      return;
    }
    
    try {
      // Формируем содержимое файла
      let logContent = '=== ЛОГИ ДЕЙСТВИЙ РАСШИРЕНИЯ ЭКС ===\n';
      logContent += `Экспорт создан: ${new Date().toLocaleString()}\n`;
      logContent += `Количество записей: ${tempSettings.actionLogs.length}\n`;
      logContent += '==========================================\n\n';
      
      // Добавляем каждый лог
      tempSettings.actionLogs.forEach((log, index) => {
        logContent += `[${index + 1}] ${new Date(log.timestamp).toLocaleString()}\n`;
        logContent += `Действие: ${log.message}\n`;
        if (log.url) {
          logContent += `URL: ${log.url}\n`;
        }
        if (log.data) {
          logContent += `Данные: ${JSON.stringify(log.data, null, 2)}\n`;
        }
        logContent += '---\n\n';
      });
      
      // Создаем и скачиваем файл
      const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EKS_action_logs_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Очищаем логи и возвращаем в исходное состояние
      tempSettings.actionLogs = [];
      tempSettings.actionLoggingState = 'disabled';
      updateActionLoggingButton();
      saveSettings();
      
      showNotification('Логи успешно экспортированы!', 'success');
      Utils.log('Логи успешно экспортированы!');
    } catch (error) {
      Utils.error('Ошибка при экспорте логов:', error);
      showNotification('Ошибка при экспорте логов: ' + error.message, 'error');
    }
  }

  // Функция для экспорта настроек
  function exportSettings() {
    try {
      // Сначала получаем ВСЕ настройки из chrome.storage.local
      chrome.storage.local.get(null, (allSettings) => {
        Utils.log('Получены все настройки из хранилища:', allSettings);
        
        Utils.log('Экспорт настроек из tempSettings:', tempSettings);
        
        // Создаем объект с настройками для экспорта
        const settingsToExport = {
          // Основные настройки
          notifications: tempSettings.notifications,
          blockWizard: tempSettings.blockWizard,
          notificationInterval: tempSettings.notificationInterval,
          
          // Пользовательские теги
          customTag1: tempSettings.customTag1,
          customTag2: tempSettings.customTag2,
          customTag3: tempSettings.customTag3,
          customTag4: tempSettings.customTag4,
          customTagsPresets: tempSettings.customTagsPresets,
          activeCustomTagsPreset: tempSettings.activeCustomTagsPreset,
          
          // Настройки поиска
          searchDriverInfo: tempSettings.searchDriverInfo,
          searchPreset1: tempSettings.searchPreset1,
          searchPreset1Enabled: tempSettings.searchPreset1Enabled,
          searchPreset2: tempSettings.searchPreset2,
          searchPreset2Enabled: tempSettings.searchPreset2Enabled,
          searchPreset3: tempSettings.searchPreset3,
          searchPreset3Enabled: tempSettings.searchPreset3Enabled,
          notificationToComment: tempSettings.notificationToComment,
          
          // Настройки вывода
          outputGreenOnly: tempSettings.outputGreenOnly,
          outputProfession: tempSettings.outputProfession,
          
          // Настройки автопоиска
          autosearchPresets: tempSettings.autosearchPresets,
          autosearchTesting: tempSettings.autosearchTesting,
          autosearchLastOrders: tempSettings.autosearchLastOrders,
          
          // Настройки Фин. Лайт
          finlightFirstParagraph: tempSettings.finlightFirstParagraph,
          finlightFirstParagraphText: tempSettings.finlightFirstParagraphText,
          finlightFinalCalculation: tempSettings.finlightFinalCalculation,
          finlightDetailedPricing: tempSettings.finlightDetailedPricing,
          finlightBriefPricing: tempSettings.finlightBriefPricing,
          finlightCollectPriceComponents: tempSettings.finlightCollectPriceComponents,
          
          // Настройки маркера
          markerEnabled: tempSettings.markerEnabled,
          markers: tempSettings.markers,
          
          // Настройки логирования
          loggingEnabled: tempSettings.loggingEnabled,
          actionLoggingEnabled: tempSettings.actionLoggingEnabled,
          actionLoggingState: tempSettings.actionLoggingState,
          // Примечание: actionLogs намеренно исключены из экспорта (содержат персональные данные)
          
          // Настройки SMS (из popup.js)
          smsTexts: tempSettings.smsTexts || allSettings.smsTexts || {},
          smsTicketId: tempSettings.smsTicketId || allSettings.smsTicketId || '',
          smsType: tempSettings.smsType || allSettings.smsType || '',
          openSmsMenu: tempSettings.openSmsMenu || allSettings.openSmsMenu || false,
          
          // Дополнительные настройки из других модулей
          wizard: tempSettings.blockWizard || allSettings.wizard || false, // wizard = blockWizard
          marker: tempSettings.markerEnabled || allSettings.marker || false, // marker = markerEnabled
          
          // Метаданные экспорта
          exportTimestamp: new Date().toISOString(),
          version: '1.0'
        };

        Utils.log('Объект настроек для экспорта создан:', settingsToExport);

        // Создаем JSON строку
        const jsonString = JSON.stringify(settingsToExport, null, 2);
        
        // Создаем blob и скачиваем файл
        const blob = new Blob([jsonString], { type: 'application/json; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `settings_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        a.type = 'application/json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        Utils.log('Настройки успешно экспортированы');
        showNotification('Настройки успешно экспортированы!', 'success');
      });
    } catch (error) {
      Utils.error('Ошибка при экспорте настроек:', error);
      showNotification('Ошибка при экспорте настроек: ' + error.message, 'error');
    }
  }

  // Функция для импорта настроек
  function importSettings(file) {
    return new Promise((resolve, reject) => {
      // Проверяем тип файла
      if (!file.name.toLowerCase().endsWith('.json')) {
        reject('Файл должен иметь расширение .json');
        return;
      }
      
      const reader = new FileReader();
      
      reader.onload = function(e) {
        try {
          const importedSettings = JSON.parse(e.target.result);
          
          // Проверяем версию и структуру файла
          if (!importedSettings.version) {
            throw new Error('Неверный формат файла настроек. Файл должен содержать поле "version"');
          }
          
          Utils.log('Импорт настроек:', importedSettings);
          
          // Применяем импортированные настройки к tempSettings
          // Основные настройки
          if (importedSettings.notifications !== undefined) tempSettings.notifications = importedSettings.notifications;
          if (importedSettings.blockWizard !== undefined) tempSettings.blockWizard = importedSettings.blockWizard;
          if (importedSettings.notificationInterval !== undefined) tempSettings.notificationInterval = importedSettings.notificationInterval;
          
          // Пользовательские теги
          if (importedSettings.customTag1 !== undefined) tempSettings.customTag1 = importedSettings.customTag1;
          if (importedSettings.customTag2 !== undefined) tempSettings.customTag2 = importedSettings.customTag2;
          if (importedSettings.customTag3 !== undefined) tempSettings.customTag3 = importedSettings.customTag3;
          if (importedSettings.customTag4 !== undefined) tempSettings.customTag4 = importedSettings.customTag4;
          if (importedSettings.customTagsPresets !== undefined) tempSettings.customTagsPresets = importedSettings.customTagsPresets;
          if (importedSettings.activeCustomTagsPreset !== undefined) tempSettings.activeCustomTagsPreset = importedSettings.activeCustomTagsPreset;
          
          // Настройки поиска
          if (importedSettings.searchDriverInfo !== undefined) tempSettings.searchDriverInfo = importedSettings.searchDriverInfo;
          if (importedSettings.searchPreset1 !== undefined) tempSettings.searchPreset1 = importedSettings.searchPreset1;
          if (importedSettings.searchPreset1Enabled !== undefined) tempSettings.searchPreset1Enabled = importedSettings.searchPreset1Enabled;
          if (importedSettings.searchPreset2 !== undefined) tempSettings.searchPreset2 = importedSettings.searchPreset2;
          if (importedSettings.searchPreset2Enabled !== undefined) tempSettings.searchPreset2Enabled = importedSettings.searchPreset2Enabled;
          if (importedSettings.searchPreset3 !== undefined) tempSettings.searchPreset3 = importedSettings.searchPreset3;
          if (importedSettings.searchPreset3Enabled !== undefined) tempSettings.searchPreset3Enabled = importedSettings.searchPreset3Enabled;
          if (importedSettings.notificationToComment !== undefined) tempSettings.notificationToComment = importedSettings.notificationToComment;
          
          // Настройки вывода
          if (importedSettings.outputGreenOnly !== undefined) tempSettings.outputGreenOnly = importedSettings.outputGreenOnly;
          if (importedSettings.outputProfession !== undefined) tempSettings.outputProfession = importedSettings.outputProfession;
          
          // Настройки автопоиска
          if (importedSettings.autosearchPresets !== undefined) tempSettings.autosearchPresets = importedSettings.autosearchPresets;
          if (importedSettings.autosearchTesting !== undefined) tempSettings.autosearchTesting = importedSettings.autosearchTesting;
          if (importedSettings.autosearchLastOrders !== undefined) tempSettings.autosearchLastOrders = importedSettings.autosearchLastOrders;
          
          // Настройки Фин. Лайт
          if (importedSettings.finlightFirstParagraph !== undefined) tempSettings.finlightFirstParagraph = importedSettings.finlightFirstParagraph;
          if (importedSettings.finlightFirstParagraphText !== undefined) tempSettings.finlightFirstParagraphText = importedSettings.finlightFirstParagraphText;
          if (importedSettings.finlightFinalCalculation !== undefined) tempSettings.finlightFinalCalculation = importedSettings.finlightFinalCalculation;
          if (importedSettings.finlightDetailedPricing !== undefined) tempSettings.finlightDetailedPricing = importedSettings.finlightDetailedPricing;
          if (importedSettings.finlightBriefPricing !== undefined) tempSettings.finlightBriefPricing = importedSettings.finlightBriefPricing;
          if (importedSettings.finlightCollectPriceComponents !== undefined) tempSettings.finlightCollectPriceComponents = importedSettings.finlightCollectPriceComponents;
          
          // Настройки маркера
          if (importedSettings.markerEnabled !== undefined) tempSettings.markerEnabled = importedSettings.markerEnabled;
          if (importedSettings.markers !== undefined) tempSettings.markers = importedSettings.markers;
          
          // Настройки логирования
          if (importedSettings.loggingEnabled !== undefined) tempSettings.loggingEnabled = importedSettings.loggingEnabled;
          if (importedSettings.actionLoggingEnabled !== undefined) tempSettings.actionLoggingEnabled = importedSettings.actionLoggingEnabled;
          if (importedSettings.actionLoggingState !== undefined) tempSettings.actionLoggingState = importedSettings.actionLoggingState;
          
          // Настройки SMS (из popup.js)
          if (importedSettings.smsTexts !== undefined) {
            tempSettings.smsTexts = importedSettings.smsTexts;
            chrome.storage.local.set({ 'smsTexts': importedSettings.smsTexts });
          }
          if (importedSettings.smsTicketId !== undefined) {
            tempSettings.smsTicketId = importedSettings.smsTicketId;
            chrome.storage.local.set({ 'smsTicketId': importedSettings.smsTicketId });
          }
          if (importedSettings.smsType !== undefined) {
            tempSettings.smsType = importedSettings.smsType;
            chrome.storage.local.set({ 'smsType': importedSettings.smsType });
          }
          if (importedSettings.openSmsMenu !== undefined) {
            tempSettings.openSmsMenu = importedSettings.openSmsMenu;
            chrome.storage.local.set({ 'openSmsMenu': importedSettings.openSmsMenu });
          }
          
          // Дополнительные настройки из других модулей
          if (importedSettings.wizard !== undefined) {
            tempSettings.blockWizard = importedSettings.wizard; // wizard = blockWizard
            chrome.storage.local.set({ 'wizard': importedSettings.wizard });
          }
          if (importedSettings.marker !== undefined) {
            tempSettings.markerEnabled = importedSettings.marker; // marker = markerEnabled
            chrome.storage.local.set({ 'marker': importedSettings.marker });
          }
          
          // Обновляем интерфейс после импорта
          if (notificationToggle) notificationToggle.checked = tempSettings.notifications;
          if (wizardToggle) wizardToggle.checked = tempSettings.blockWizard;
          if (notificationIntervalInput) notificationIntervalInput.value = tempSettings.notificationInterval;
          if (searchDriverInfoToggle) searchDriverInfoToggle.checked = tempSettings.searchDriverInfo;
          if (markerToggle) markerToggle.checked = tempSettings.markerEnabled;
          if (document.getElementById('loggingToggle')) document.getElementById('loggingToggle').checked = tempSettings.loggingEnabled;
          if (notificationToCommentToggle) notificationToCommentToggle.checked = tempSettings.notificationToComment;
          
          // Обновляем состояние переключателей поиска
          if (document.getElementById('searchPreset1Toggle')) document.getElementById('searchPreset1Toggle').checked = tempSettings.searchPreset1Enabled;
          if (document.getElementById('searchPreset2Toggle')) document.getElementById('searchPreset2Toggle').checked = tempSettings.searchPreset2Enabled;
          if (document.getElementById('searchPreset3Toggle')) document.getElementById('searchPreset3Toggle').checked = tempSettings.searchPreset3Enabled;
          
          // Обновляем выбранные пресеты поиска
          if (searchPreset1Select) searchPreset1Select.value = tempSettings.searchPreset1;
          if (searchPreset2Select) searchPreset2Select.value = tempSettings.searchPreset2;
          if (searchPreset3Select) searchPreset3Select.value = tempSettings.searchPreset3;
          
          // Обновляем состояние переключателей настроек вывода
          if (outputGreenToggle) outputGreenToggle.checked = tempSettings.outputGreenOnly;
          if (outputProfessionToggle) outputProfessionToggle.checked = tempSettings.outputProfession;
          
          // Обновляем состояние переключателей автопоиска
          if (autosearchPresetsToggle) autosearchPresetsToggle.checked = tempSettings.autosearchPresets;
          if (autosearchTestingToggle) autosearchTestingToggle.checked = tempSettings.autosearchTesting;
          if (autosearchLastOrdersToggle) autosearchLastOrdersToggle.checked = tempSettings.autosearchLastOrders;
          
          // Обновляем состояние элементов Фин. Лайт
          const finlightFirstParagraphButton = document.getElementById('finlightFirstParagraphButton');
          const finlightFinalCalculationButton = document.getElementById('finlightFinalCalculationButton');
          const finlightCollectPriceComponentsToggle = document.getElementById('finlightCollectPriceComponentsToggle');
          
          // Убираем зеленое выделение кнопок - они больше не должны выделяться
          // if (finlightFirstParagraphButton) {
          //   finlightFirstParagraphButton.style.backgroundImage = tempSettings.finlightFirstParagraph 
          //     ? 'linear-gradient(135deg, #4c4, #3a3)' 
          //     : 'linear-gradient(135deg, #a88368, #8a6c55)';
          // }
          
          // if (finlightFinalCalculationButton) {
          //   finlightFinalCalculationButton.style.backgroundImage = tempSettings.finlightFinalCalculation 
          //     ? 'linear-gradient(135deg, #4c4, #3a3)' 
          //     : 'linear-gradient(135deg, #a88368, #8a6c55)';
          // }
          
          if (finlightCollectPriceComponentsToggle) {
            finlightCollectPriceComponentsToggle.checked = tempSettings.finlightCollectPriceComponents;
          }
          
          // Обновляем значения в модальных окнах Фин. Лайт
          const finlightFirstParagraphTextModal = document.getElementById('finlightFirstParagraphTextModal');
          const finlightDetailedPricingToggleModal = document.getElementById('finlightDetailedPricingToggleModal');
          const finlightBriefPricingToggleModal = document.getElementById('finlightBriefPricingToggleModal');
          const finlightCollectPriceComponentsToggleModal = document.getElementById('finlightCollectPriceComponentsToggleModal');
          
          if (finlightFirstParagraphTextModal) {
            finlightFirstParagraphTextModal.value = tempSettings.finlightFirstParagraphText || 'Всё проверила и не обнаружила никаких нарушений при расчёте заказа НОМЕР_ЗАКАЗА. Стоимость заказа рассчитана верно в соответствии с тарифом.';
          }
          if (finlightDetailedPricingToggleModal) {
            finlightDetailedPricingToggleModal.checked = tempSettings.finlightDetailedPricing || false;
          }
          if (finlightBriefPricingToggleModal) {
            finlightBriefPricingToggleModal.checked = tempSettings.finlightBriefPricing || false;
          }
          if (finlightCollectPriceComponentsToggleModal) {
            finlightCollectPriceComponentsToggleModal.checked = tempSettings.finlightCollectPriceComponents || false;
          }
          
          // Обновляем интерфейс маркеров после импорта
          Utils.log('Обновляем интерфейс маркеров после импорта:', tempSettings.markers);
          
          // Обновляем базовые маркеры (1-5)
          for (let i = 1; i <= 5; i++) {
            const marker = tempSettings.markers[i-1] || { text: '', color: getDefaultColor(i-1), exactMatch: false };
            const markerTextElement = document.getElementById(`markerText${i}`);
            const markerColorElement = document.getElementById(`markerColor${i}`);
            const markerExactElement = document.getElementById(`markerExact${i}`);
            
            if (markerTextElement && markerColorElement && markerExactElement) {
              markerTextElement.value = marker.text || '';
              markerColorElement.value = marker.color || getDefaultColor(i-1);
              markerExactElement.checked = marker.exactMatch === true;
              Utils.log(`Обновлен маркер ${i}:`, marker);
            }
          }
          
          // Обновляем дополнительные маркеры (6+)
          const additionalMarkersContainer = document.getElementById('additionalMarkers');
          if (additionalMarkersContainer && tempSettings.markers.length > 5) {
            // Очищаем контейнер
            additionalMarkersContainer.innerHTML = '';
            additionalMarkerCount = 0;
            
            // Добавляем дополнительные маркеры
            for (let i = 5; i < tempSettings.markers.length; i++) {
              addNewMarkerField(tempSettings.markers[i]);
            }
          }
          
          // Обновляем интерфейс пользовательских тегов после импорта
          Utils.log('Обновляем интерфейс пользовательских тегов после импорта');
          
          // Обновляем поля пользовательских тегов
          const customTag1Element = document.getElementById('customTag1');
          const customTag2Element = document.getElementById('customTag2');
          const customTag3Element = document.getElementById('customTag3');
          const customTag4Element = document.getElementById('customTag4');
          
          if (customTag1Element) customTag1Element.value = tempSettings.customTag1 || '';
          if (customTag2Element) customTag2Element.value = tempSettings.customTag2 || '';
          if (customTag3Element) customTag3Element.value = tempSettings.customTag3 || '';
          if (customTag4Element) customTag4Element.value = tempSettings.customTag4 || '';
          
          // Обновляем выбранный пресет пользовательских тегов
          const customTagsPresetSelect = document.getElementById('customTagsPresetSelect');
          if (customTagsPresetSelect) {
            customTagsPresetSelect.value = tempSettings.activeCustomTagsPreset || 'preset1';
          }
          
          // Обновляем кнопку логирования действий
          if (typeof updateActionLoggingButton === 'function') {
            updateActionLoggingButton();
          }
          
          // Сохраняем все настройки в chrome.storage.local
          saveSettings();
          
          Utils.log('Настройки успешно импортированы');
          resolve('Настройки успешно импортированы!');
        } catch (error) {
          Utils.error('Ошибка при импорте настроек:', error);
          if (error instanceof SyntaxError) {
            reject('Ошибка при импорте настроек: Файл не является валидным JSON');
          } else {
            reject('Ошибка при импорте настроек: ' + error.message);
          }
        }
      };
      
      reader.onerror = function() {
        reject('Ошибка чтения файла. Убедитесь, что файл не поврежден и доступен для чтения');
      };
      
      Utils.log('Начинаем импорт файла:', file.name, 'размер:', file.size, 'байт');
      reader.readAsText(file, 'utf-8');
    });
  }

  // Обработчики событий для кнопок экспорта и импорта
  const exportSettingsBtn = document.getElementById('exportSettings');
  if (exportSettingsBtn) {
    exportSettingsBtn.addEventListener('click', exportSettings);
  }
  
  const importSettingsBtn = document.getElementById('importSettings');
  const importFileInput = document.getElementById('importFileInput');
  
  if (importSettingsBtn && importFileInput) {
    importSettingsBtn.addEventListener('click', () => {
      importFileInput.click();
    });
    
    importFileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        importSettings(file)
          .then(message => {
            showNotification(message, 'success');
            Utils.log('Импорт настроек: ' + message);
            // Очищаем input для возможности повторного выбора того же файла
            importFileInput.value = '';
          })
          .catch(error => {
            showNotification(error, 'error');
            Utils.error('Ошибка импорта настроек: ' + error);
            importFileInput.value = '';
          });
      }
    });
  }
});

// Функция для поиска тегов
const findTags = () => {
    const tagMapping = {
        'auto_courier': 'автокурьер',
        'walking_courier': 'пеший курьер'
    };

    const foundTags = [];
    
    // Функция для поиска тегов в элементах
    const searchTagsInElement = (element) => {
        const text = element.textContent.trim();
        
        // Проверяем ТОЧНОЕ соответствие тега (полное совпадение)
        // Проверяем, что текст точно равен одному из ключей и не содержит дополнительных подчеркиваний
        if (Object.keys(tagMapping).includes(text) && 
            !text.match(/^.*_.*_.*$/) && // Проверка, что в тексте нет более одного подчеркивания
            !text.match(/^_/) && // Проверка, что текст не начинается с подчеркивания
            !text.match(/_$/) && // Проверка, что текст не заканчивается подчеркиванием
            !text.match(/^profession_/) && // Проверка, что текст не начинается с "profession_"
            !text.match(/_delivery_/) // Проверка, что текст не содержит "_delivery_"
        ) {
            foundTags.push(text);
        }
    };
    
    // Ищем первый контейнер с тегами
    const tagsContainer1 = document.querySelector('.DriversShowDriverDiagnosticsTags');
    
    // Ищем второй контейнер с тегами
    const tagsContainer2 = document.querySelector('.DriversShowDriverDiagnosticsTags__content');
    
    // Проверяем наличие хотя бы одного контейнера
    if (!tagsContainer1 && !tagsContainer2) {
        Utils.log('Ни один из контейнеров с тегами не найден');
        return foundTags;
    }
    
    // Поиск в первом контейнере
    if (tagsContainer1) {
        Utils.log('Найден первый контейнер с тегами DriversShowDriverDiagnosticsTags');
        
        // Ищем все элементы с тегами внутри первого контейнера
        const tagElements = tagsContainer1.querySelectorAll('.DiagnosticsTagWithTopics__tagTitleName div, .DiagnosticsTagWithTopics__tagTitle div, .DriversShowDriverDiagnosticsTags__content div');
        
        tagElements.forEach(element => {
            searchTagsInElement(element);
        });
    }
    
    // Поиск во втором контейнере
    if (tagsContainer2) {
        Utils.log('Найден второй контейнер с тегами DriversShowDriverDiagnosticsTags__content');
        
        // Ищем все div элементы внутри второго контейнера
        const divElements = tagsContainer2.querySelectorAll('div');
        
        divElements.forEach(element => {
            searchTagsInElement(element);
        });
        
        // Специальный поиск в элементах DiagnosticsTagWithTopics__tagTitleName и DiagnosticsTagWithTopics__tagTitle
        const tagTitles = tagsContainer2.querySelectorAll('.DiagnosticsTagWithTopics__tagTitleName div, .DiagnosticsTagWithTopics__tagTitle div');
        if (tagTitles.length > 0) {
            Utils.log(`Найдено ${tagTitles.length} тегов в блоке DriversShowDriverDiagnosticsTags__content`);
            tagTitles.forEach(element => {
                searchTagsInElement(element);
            });
        }
        
        // Специальный поиск в элементах DriversDiagnosticLabel__title
        const tagTopics = tagsContainer2.querySelectorAll('.DriversDiagnosticLabel__title');
        if (tagTopics.length > 0) {
            Utils.log(`Найдено ${tagTopics.length} топиков в блоке DriversShowDriverDiagnosticsTags__content`);
            tagTopics.forEach(element => {
                searchTagsInElement(element);
            });
        }
    }

    return foundTags;
};

