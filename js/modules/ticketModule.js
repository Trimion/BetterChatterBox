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

// Модуль для работы с тикетами
const TicketModule = {
  // Базовая ссылка для supchat
  supchatBaseUrl: 'https://supchat.taxi.yandex-team.ru/chat/',
  
  // Функция для валидации ID тикета
  validateTicketId: function(ticketId) {
    if (!ticketId || typeof ticketId !== 'string') {
      return false;
    }
    
    // Проверяем, что ID тикета соответствует формату (24 символа, hex)
    const ticketIdPattern = /^[0-9a-fA-F]{24}$/;
    return ticketIdPattern.test(ticketId.trim());
  },
  
  // Функция для открытия тикета в supchat
  openTicketInSupchat: function(ticketId) {
    if (!this.validateTicketId(ticketId)) {
      Utils.warn('Неверный формат ID тикета:', ticketId);
      return false;
    }
    
    const cleanTicketId = ticketId.trim();
    const fullUrl = this.supchatBaseUrl + cleanTicketId;
    
    // Открываем новую вкладку с ссылкой на тикет
    chrome.tabs.create({ url: fullUrl }, (tab) => {
      if (chrome.runtime.lastError) {
        Utils.error('Ошибка при открытии вкладки:', chrome.runtime.lastError);
        return false;
      }
      
      Utils.log('Открыт тикет в supchat:', fullUrl);
      return true;
    });
    
    return true;
  },
  
  // Функция для логирования действий
  logAction: function(message, data = null) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'addActionLog',
          message: message,
          data: data,
          url: 'ticketModule',
          source: 'ticketModule'
        }).catch(() => {
          // Игнорируем ошибки отправки сообщений
        });
      }
    } catch (error) {
      // Игнорируем ошибки Chrome API
    }
  }
};

// Экспортируем модуль
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TicketModule;
} else if (typeof window !== 'undefined') {
  window.TicketModule = TicketModule;
}
