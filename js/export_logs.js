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

// Локальный объект Utils для export_logs script
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
          url: 'export_logs',
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

document.addEventListener('DOMContentLoaded', () => {
  // Добавляем кнопки импорта и экспорта в интерфейс
  const settingsContainer = document.querySelector('.settings-section');
  if (settingsContainer) {
    const exportImportContainer = document.createElement('div');
    exportImportContainer.className = 'search-settings-category';
    exportImportContainer.innerHTML = `
      <h4>Управление логами</h4>
      <div style="display: flex; gap: 10px; margin-top: 15px;">
        <button id="exportLogsSettings" class="buttonsave" style="flex: 1;">Экспорт логов</button>
        <button id="clearLogsSettings" class="buttonsave" style="flex: 1;">Очистить логи</button>
      </div>
    `;
    
    // Вставляем контейнер перед кнопкой "Применить"
    const applyButton = document.getElementById('applySettings');
    if (applyButton) {
      settingsContainer.insertBefore(exportImportContainer, applyButton);
    } else {
      settingsContainer.appendChild(exportImportContainer);
    }
    
    // Добавляем обработчики событий для кнопок
    document.getElementById('exportLogsSettings').addEventListener('click', exportActionLogsToFile);
    document.getElementById('clearLogsSettings').addEventListener('click', clearActionLogs);
  }
  
  // Функция для экспорта логов действий в файл
  async function exportActionLogsToFile() {
    try {
      // Получаем логи действий из хранилища
      const result = await chrome.storage.local.get(['actionLogs', 'actionLoggingState']);
      const actionLogs = result.actionLogs || [];
      
      if (actionLogs.length === 0) {
        showNotification('Нет логов для экспорта', 'error');
        return;
      }
      
      // Формируем содержимое файла
      let logContent = '=== ЛОГИ ДЕЙСТВИЙ РАСШИРЕНИЯ ЭКС ===\n';
      logContent += `Экспорт создан: ${new Date().toLocaleString()}\n`;
      logContent += `Количество записей: ${actionLogs.length}\n`;
      logContent += '==========================================\n\n';
      
      // Добавляем каждый лог
      actionLogs.forEach((log, index) => {
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
      await chrome.storage.local.set({
        actionLogs: [],
        actionLoggingState: 'disabled',
        actionLoggingEnabled: false
      });
      
      showNotification('Логи успешно экспортированы!', 'success');
    } catch (error) {
      Utils.error('Ошибка при экспорте логов:', error);
      showNotification('Ошибка при экспорте логов: ' + error.message, 'error');
    }
  }
  
  // Функция для очистки логов действий
  async function clearActionLogs() {
    try {
      await chrome.storage.local.set({
        actionLogs: [],
        actionLoggingState: 'disabled',
        actionLoggingEnabled: false
      });
      
      showNotification('Логи успешно очищены!', 'success');
    } catch (error) {
      Utils.error('Ошибка при очистке логов:', error);
      showNotification('Ошибка при очистке логов: ' + error.message, 'error');
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
