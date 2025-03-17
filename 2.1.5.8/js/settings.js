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

document.addEventListener('DOMContentLoaded', async () => {
  // Временные переменные для хранения настроек до применения
  let tempSettings = {
    showNotifications: true,
    blockWizard: true,
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
    loggingEnabled: false // По умолчанию логирование отключено
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
    console.log('Принудительное обновление интерфейса выполнено');
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
  
  // Максимальное количество дополнительных маркеров
  const MAX_ADDITIONAL_MARKERS = 10; // 5 базовых + 10 дополнительных = 15 всего
  
  // Счетчик текущего количества дополнительных маркеров
  let additionalMarkerCount = 0;
  
  // Временное хранилище для настроек маркера в модальном окне
  let tempMarkers = [];
  
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
      const text = document.getElementById(`markerText${i}`).value.trim();
      const color = document.getElementById(`markerColor${i}`).value;
      const exactMatch = document.getElementById(`markerExact${i}`).checked;
      
      if (text) {
        markers.push({
          text: text,
          color: color,
          exactMatch: exactMatch
        });
      }
    }
    
    // Собираем дополнительные маркеры (6+)
    for (let i = 6; i <= 5 + MAX_ADDITIONAL_MARKERS; i++) {
      const textElement = document.getElementById(`markerText${i}`);
      if (textElement) {
        const text = textElement.value.trim();
        const color = document.getElementById(`markerColor${i}`).value;
        const exactMatch = document.getElementById(`markerExact${i}`).checked;
        
        if (text) {
          markers.push({
            text: text,
            color: color,
            exactMatch: exactMatch
          });
        }
      }
    }
    
    // Обновляем временные настройки
    tempSettings.markers = markers;
    
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
    
    // Сохраняем настройки
    saveSettings();
    
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
    console.log('Активация пресета:', presetKey);
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
    
    console.log('Обновленные настройки после активации пресета:', tempSettings);
    
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
      console.log('Изменен пресет поиска 1:', tempSettings.searchPreset1);
    });
  }
  
  if (searchPreset2Select) {
    searchPreset2Select.addEventListener('change', (e) => {
      tempSettings.searchPreset2 = e.target.value;
      console.log('Изменен пресет поиска 2:', tempSettings.searchPreset2);
    });
  }
  
  if (searchPreset3Select) {
    searchPreset3Select.addEventListener('change', (e) => {
      tempSettings.searchPreset3 = e.target.value;
      console.log('Изменен пресет поиска 3:', tempSettings.searchPreset3);
    });
  }
  
  // Добавляем обработчики событий для переключателей поиска
  document.getElementById('searchPreset1Toggle').addEventListener('change', (e) => {
    tempSettings.searchPreset1Enabled = e.target.checked;
    console.log('Переключатель поиска 1:', tempSettings.searchPreset1Enabled);
  });
  
  document.getElementById('searchPreset2Toggle').addEventListener('change', (e) => {
    tempSettings.searchPreset2Enabled = e.target.checked;
    console.log('Переключатель поиска 2:', tempSettings.searchPreset2Enabled);
  });
  
  document.getElementById('searchPreset3Toggle').addEventListener('change', (e) => {
    tempSettings.searchPreset3Enabled = e.target.checked;
    console.log('Переключатель поиска 3:', tempSettings.searchPreset3Enabled);
  });
  
  // Закрытие модального окна маркера при клике вне его содержимого
  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal();
    }
    if (event.target === customTagsModal) {
      closeCustomTagsModal();
    }
  });
  
  // Обработчики событий для переключателей
  document.getElementById('notificationToggle').addEventListener('change', (e) => {
    tempSettings.showNotifications = e.target.checked;
  });

  document.getElementById('notificationInterval').addEventListener('change', (e) => {
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

  document.getElementById('wizardToggle').addEventListener('change', (e) => {
    tempSettings.blockWizard = e.target.checked;
  });
  
  // Обработчики изменений для переключателей поиска
  document.getElementById('searchDriverInfoToggle').addEventListener('change', (e) => {
    tempSettings.searchDriverInfo = e.target.checked;
  });
  
  // Обработчик изменения состояния маркера
  document.getElementById('markerToggle').addEventListener('change', (e) => {
    tempSettings.markerEnabled = e.target.checked;
  });
  
  // Добавляем обработчик для переключателя логирования
  document.getElementById('loggingToggle').addEventListener('change', (e) => {
    tempSettings.loggingEnabled = e.target.checked;
    // Сохраняем настройки сразу при изменении
    saveSettings();
  });
  
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
      alert('Настройки успешно применены!');
      
      // Закрываем текущую вкладку
      window.close();
    } catch (error) {
      console.error('Ошибка при сохранении настроек:', error);
      alert('Произошла ошибка при сохранении настроек');
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

  // Функция для загрузки настроек
  async function loadSettings() {
    try {
      // Загружаем настройки из chrome.storage.local вместо chrome.storage.sync
      const settings = await chrome.storage.local.get([
        'showNotifications',
        'blockWizard',
        'notificationInterval',
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
        'markerEnabled',
        'markers',
        // Добавляем настройки переключателей поиска
        'searchPreset1Enabled',
        'searchPreset2Enabled',
        'searchPreset3Enabled',
        'loggingEnabled'
      ]);
      
      console.log('Загруженные настройки:', settings);
      
      // Обновляем временные настройки
      if (settings.showNotifications !== undefined) tempSettings.showNotifications = settings.showNotifications;
      if (settings.blockWizard !== undefined) tempSettings.blockWizard = settings.blockWizard;
      if (settings.notificationInterval !== undefined) tempSettings.notificationInterval = settings.notificationInterval;
      if (settings.customTag1 !== undefined) tempSettings.customTag1 = settings.customTag1;
      if (settings.customTag2 !== undefined) tempSettings.customTag2 = settings.customTag2;
      if (settings.customTag3 !== undefined) tempSettings.customTag3 = settings.customTag3;
      if (settings.customTag4 !== undefined) tempSettings.customTag4 = settings.customTag4;
      if (settings.customTagsPresets !== undefined) tempSettings.customTagsPresets = settings.customTagsPresets;
      if (settings.activeCustomTagsPreset !== undefined) tempSettings.activeCustomTagsPreset = settings.activeCustomTagsPreset;
      
      // Обновляем настройки пресетов поиска, преобразуя старые значения в новые
      if (settings.searchPreset1 !== undefined) {
        // Если старое значение было 'customTags', меняем на 'customTags1'
        if (settings.searchPreset1 === 'customTags') {
          tempSettings.searchPreset1 = 'customTags1';
        } else {
          tempSettings.searchPreset1 = settings.searchPreset1;
        }
        console.log('Загружен searchPreset1:', tempSettings.searchPreset1);
      }
      
      if (settings.searchPreset2 !== undefined) {
        // Если старое значение было 'customTags', меняем на 'customTags1'
        if (settings.searchPreset2 === 'customTags') {
          tempSettings.searchPreset2 = 'customTags1';
        } else {
          tempSettings.searchPreset2 = settings.searchPreset2;
        }
        console.log('Загружен searchPreset2:', tempSettings.searchPreset2);
      }
      
      if (settings.searchPreset3 !== undefined) {
        // Если старое значение было 'customTags', меняем на 'customTags1'
        if (settings.searchPreset3 === 'customTags') {
          tempSettings.searchPreset3 = 'customTags1';
        } else {
          tempSettings.searchPreset3 = settings.searchPreset3;
        }
        console.log('Загружен searchPreset3:', tempSettings.searchPreset3);
      }
      
      if (settings.searchDriverInfo !== undefined) tempSettings.searchDriverInfo = settings.searchDriverInfo;
      if (settings.markerEnabled !== undefined) tempSettings.markerEnabled = settings.markerEnabled;
      if (settings.markers !== undefined) tempSettings.markers = settings.markers;
      
      // Загружаем настройки переключателей поиска
      if (settings.searchPreset1Enabled !== undefined) tempSettings.searchPreset1Enabled = settings.searchPreset1Enabled;
      if (settings.searchPreset2Enabled !== undefined) tempSettings.searchPreset2Enabled = settings.searchPreset2Enabled;
      if (settings.searchPreset3Enabled !== undefined) tempSettings.searchPreset3Enabled = settings.searchPreset3Enabled;
      
      if (settings.loggingEnabled !== undefined) tempSettings.loggingEnabled = settings.loggingEnabled;
      
      console.log('Обновленные временные настройки:', tempSettings);
      
      // Обновляем значения в интерфейсе
      document.getElementById('notificationToggle').checked = tempSettings.showNotifications;
      document.getElementById('wizardToggle').checked = tempSettings.blockWizard;
      document.getElementById('notificationInterval').value = tempSettings.notificationInterval;
      document.getElementById('searchDriverInfoToggle').checked = tempSettings.searchDriverInfo;
      document.getElementById('markerToggle').checked = tempSettings.markerEnabled;
      document.getElementById('loggingToggle').checked = tempSettings.loggingEnabled;
      
      // Обновляем состояние переключателей поиска
      document.getElementById('searchPreset1Toggle').checked = tempSettings.searchPreset1Enabled;
      document.getElementById('searchPreset2Toggle').checked = tempSettings.searchPreset2Enabled;
      document.getElementById('searchPreset3Toggle').checked = tempSettings.searchPreset3Enabled;
      
      // Обновляем выбранные пресеты поиска
      if (searchPreset1Select) {
        searchPreset1Select.value = tempSettings.searchPreset1;
        console.log('Установлен searchPreset1Select.value:', searchPreset1Select.value);
      }
      if (searchPreset2Select) {
        searchPreset2Select.value = tempSettings.searchPreset2;
        console.log('Установлен searchPreset2Select.value:', searchPreset2Select.value);
      }
      if (searchPreset3Select) {
        searchPreset3Select.value = tempSettings.searchPreset3;
        console.log('Установлен searchPreset3Select.value:', searchPreset3Select.value);
      }
      
      console.log('Настройки успешно загружены');
    } catch (error) {
      console.error('Ошибка при загрузке настроек:', error);
    }
  }
  
  // Функция для сохранения настроек
  async function saveSettings() {
    try {
      console.log('Сохраняем настройки. Текущие значения пресетов:');
      console.log('searchPreset1:', tempSettings.searchPreset1);
      console.log('searchPreset2:', tempSettings.searchPreset2);
      console.log('searchPreset3:', tempSettings.searchPreset3);
      
      // Проверяем, что значения пресетов соответствуют выбранным в интерфейсе
      if (searchPreset1Select) {
        tempSettings.searchPreset1 = searchPreset1Select.value;
        console.log('Обновлен searchPreset1 из интерфейса:', tempSettings.searchPreset1);
      }
      if (searchPreset2Select) {
        tempSettings.searchPreset2 = searchPreset2Select.value;
        console.log('Обновлен searchPreset2 из интерфейса:', tempSettings.searchPreset2);
      }
      if (searchPreset3Select) {
        tempSettings.searchPreset3 = searchPreset3Select.value;
        console.log('Обновлен searchPreset3 из интерфейса:', tempSettings.searchPreset3);
      }
      
      // Обновляем состояние переключателей поиска из интерфейса
      tempSettings.searchPreset1Enabled = document.getElementById('searchPreset1Toggle').checked;
      tempSettings.searchPreset2Enabled = document.getElementById('searchPreset2Toggle').checked;
      tempSettings.searchPreset3Enabled = document.getElementById('searchPreset3Toggle').checked;
      
      // Создаем объект с настройками для сохранения
      const settingsToSave = {
        showNotifications: tempSettings.showNotifications,
        blockWizard: tempSettings.blockWizard,
        notificationInterval: tempSettings.notificationInterval,
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
        markerEnabled: tempSettings.markerEnabled,
        markers: tempSettings.markers,
        // Добавляем настройки переключателей поиска
        searchPreset1Enabled: tempSettings.searchPreset1Enabled,
        searchPreset2Enabled: tempSettings.searchPreset2Enabled,
        searchPreset3Enabled: tempSettings.searchPreset3Enabled,
        loggingEnabled: tempSettings.loggingEnabled
      };
      
      // Сохраняем настройки в chrome.storage.local вместо chrome.storage.sync
      await chrome.storage.local.set(settingsToSave);
      
      console.log('Настройки успешно сохранены:', settingsToSave);
      
      // Обновляем правила блокировки
      updateBlockingRules(tempSettings.blockWizard);
      
      return true;
    } catch (error) {
      console.error('Ошибка при сохранении настроек:', error);
      return false;
    }
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
        console.log('Ни один из контейнеров с тегами не найден');
        return foundTags;
    }
    
    // Поиск в первом контейнере
    if (tagsContainer1) {
        console.log('Найден первый контейнер с тегами DriversShowDriverDiagnosticsTags');
        
        // Ищем все элементы с тегами внутри первого контейнера
        const tagElements = tagsContainer1.querySelectorAll('.DiagnosticsTagWithTopics__tagTitle div, .DriversShowDriverDiagnosticsTags__content div');
        
        tagElements.forEach(element => {
            searchTagsInElement(element);
        });
    }
    
    // Поиск во втором контейнере
    if (tagsContainer2) {
        console.log('Найден второй контейнер с тегами DriversShowDriverDiagnosticsTags__content');
        
        // Ищем все div элементы внутри второго контейнера
        const divElements = tagsContainer2.querySelectorAll('div');
        
        divElements.forEach(element => {
            searchTagsInElement(element);
        });
        
        // Специальный поиск в элементах DiagnosticsTagWithTopics__tagTitle
        const tagTitles = tagsContainer2.querySelectorAll('.DiagnosticsTagWithTopics__tagTitle div');
        if (tagTitles.length > 0) {
            console.log(`Найдено ${tagTitles.length} тегов в блоке DriversShowDriverDiagnosticsTags__content`);
            tagTitles.forEach(element => {
                searchTagsInElement(element);
            });
        }
        
        // Специальный поиск в элементах DriversDiagnosticLabel__title
        const tagTopics = tagsContainer2.querySelectorAll('.DriversDiagnosticLabel__title');
        if (tagTopics.length > 0) {
            console.log(`Найдено ${tagTopics.length} топиков в блоке DriversShowDriverDiagnosticsTags__content`);
            tagTopics.forEach(element => {
                searchTagsInElement(element);
            });
        }
    }

    return foundTags;
};