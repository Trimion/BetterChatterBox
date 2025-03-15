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
  // Добавляем кнопки импорта и экспорта в интерфейс
  const settingsContainer = document.querySelector('.settings-section');
  if (settingsContainer) {
    const exportImportContainer = document.createElement('div');
    exportImportContainer.className = 'search-settings-category';
    exportImportContainer.innerHTML = `
      <h4>Импорт/Экспорт настроек</h4>
      <div style="display: flex; gap: 10px; margin-top: 15px;">
        <button id="exportSettings" class="buttonsave" style="flex: 1;">Экспортировать настройки</button>
        <button id="importSettings" class="buttonsave" style="flex: 1;">Импортировать настройки</button>
      </div>
      <input type="file" id="importFile" accept=".json" style="display: none;">
    `;
    
    // Вставляем контейнер перед кнопкой "Применить"
    const applyButton = document.getElementById('applySettings');
    if (applyButton) {
      settingsContainer.insertBefore(exportImportContainer, applyButton);
    } else {
      settingsContainer.appendChild(exportImportContainer);
    }
    
    // Добавляем обработчики событий для кнопок
    document.getElementById('exportSettings').addEventListener('click', exportSettingsToFile);
    document.getElementById('importSettings').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });
    document.getElementById('importFile').addEventListener('change', importSettingsFromFile);
  }
  
  // Функция для экспорта настроек в файл
  async function exportSettingsToFile() {
    try {
      // Получаем все настройки из хранилища
      const settings = await chrome.storage.local.get(null);
      
      // Создаем объект с датой экспорта для проверки при импорте
      const exportData = {
        exportDate: new Date().toISOString(),
        settings: settings
      };
      
      // Преобразуем объект в JSON строку
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // Создаем Blob из JSON строки
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Создаем URL для Blob
      const url = URL.createObjectURL(blob);
      
      // Создаем временную ссылку для скачивания
      const a = document.createElement('a');
      a.href = url;
      a.download = `ЭКС_настройки_${new Date().toISOString().slice(0, 10)}.json`;
      
      // Добавляем ссылку в DOM, кликаем по ней и удаляем
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Освобождаем URL
      URL.revokeObjectURL(url);
      
      // Показываем уведомление об успешном экспорте
      showNotification('Настройки успешно экспортированы', 'success');
    } catch (error) {
      console.error('Ошибка при экспорте настроек:', error);
      showNotification('Ошибка при экспорте настроек', 'error');
    }
  }
  
  // Функция для импорта настроек из файла
  async function importSettingsFromFile(event) {
    try {
      const file = event.target.files[0];
      if (!file) return;
      
      // Читаем содержимое файла
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          // Парсим JSON из файла
          const importData = JSON.parse(e.target.result);
          
          // Проверяем, что файл содержит корректные данные
          if (!importData.settings) {
            throw new Error('Некорректный формат файла настроек');
          }
          
          // Сохраняем импортированные настройки
          await chrome.storage.local.set(importData.settings);
          
          // Перезагружаем страницу для применения новых настроек
          showNotification('Настройки успешно импортированы. Страница будет перезагружена.', 'success');
          setTimeout(() => {
            location.reload();
          }, 2000);
        } catch (error) {
          console.error('Ошибка при обработке файла настроек:', error);
          showNotification('Ошибка при импорте настроек: некорректный формат файла', 'error');
        }
      };
      reader.readAsText(file);
      
      // Сбрасываем значение input, чтобы можно было повторно выбрать тот же файл
      event.target.value = '';
    } catch (error) {
      console.error('Ошибка при импорте настроек:', error);
      showNotification('Ошибка при импорте настроек', 'error');
    }
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
});

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