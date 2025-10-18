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

// Модуль для работы с данными
(function(window) {
  "use strict";
  
  // Объект для экспорта функций
  const Data = {};
  
  // Хранилище для собранных данных
  let collectedData = {
    tickets: [],
    countries: [],
    driver_licenses: []
  };
  
  // Контрольные bool значения для функций вывода в консоль
  let printLinksEnabled = true; // Вывод найденных ссылок
  let printFilteredValuesEnabled = true; // Вывод найденных значений
  
  /**
   * Сбор данных
   * @param {Object} newData - Новые данные для сбора
   */
  Data.collectData = function(newData) {
    if (!newData || typeof newData !== 'object') return;
    
    // Обрабатываем данные в зависимости от типа
    switch (newData.type) {
      case 'ticket':
        // Проверяем, нет ли уже такого тикета
        if (!collectedData.tickets.some(ticket => ticket.id === newData.id)) {
          collectedData.tickets.push(newData);
          Utils.log('Добавлен новый тикет:', newData.id);
        }
        break;
        
      case 'country':
        // Проверяем, нет ли уже такой страны
        if (!collectedData.countries.some(country => country.code === newData.code)) {
          collectedData.countries.push(newData);
          Utils.log('Добавлена новая страна:', newData.name);
        }
        break;
        
      case 'driver_license':
        // Проверяем, нет ли уже таких прав
        if (!collectedData.driver_licenses.some(license => license.normalized === newData.normalized)) {
          collectedData.driver_licenses.push(newData);
          Utils.log('Добавлены новые водительские права:', newData.normalized);
        }
        break;
        
      default:
        Utils.warn('Неизвестный тип данных:', newData.type);
    }
  };
  
  /**
   * Получение ссылок
   * @returns {Array} - Массив ссылок
   */
  Data.getLinks = function() {
    const links = [];
    
    // Добавляем ссылки на тикеты
    collectedData.tickets.forEach(ticket => {
      if (ticket.link) {
        links.push({
          type: 'ticket',
          id: ticket.id,
          url: ticket.link,
          text: `Тикет: ${ticket.id}`
        });
      }
    });
    
    return links;
  };
  
  /**
   * Сбор отфильтрованных значений
   * @returns {Object} - Объект с отфильтрованными значениями
   */
  Data.collectFilteredValues = function() {
    return collectedData;
  };
  
  /**
   * Обновление данных из внешнего источника
   * @param {Object} data - Данные для обновления
   */
  Data.updateData = function(data) {
    if (!data) return;
    
    // Обновляем тикеты
    if (data.tickets && Array.isArray(data.tickets)) {
      data.tickets.forEach(ticket => {
        if (!collectedData.tickets.some(t => t.id === ticket.id)) {
          collectedData.tickets.push(ticket);
        }
      });
    }
    
    // Обновляем страны
    if (data.countries && Array.isArray(data.countries)) {
      data.countries.forEach(country => {
        if (!collectedData.countries.some(c => c.code === country.code)) {
          collectedData.countries.push(country);
        }
      });
    }
    
    // Обновляем водительские права
    if (data.driver_licenses && Array.isArray(data.driver_licenses)) {
      data.driver_licenses.forEach(license => {
        if (!collectedData.driver_licenses.some(l => l.normalized === license.normalized)) {
          collectedData.driver_licenses.push(license);
        }
      });
    }
  };
  
  /**
   * Вывод ссылок в консоль
   */
  Data.printLinks = function() {
    if (!printLinksEnabled) return;
    
    const links = Data.getLinks();
    
    if (links.length === 0) {
      Utils.log('Ссылки не найдены');
      return;
    }
    
    Utils.log('Найденные ссылки:');
    links.forEach((link, index) => {
      Utils.log(`${index + 1}. ${link.text}: ${link.url}`);
    });
  };
  
  /**
   * Вывод отфильтрованных значений в консоль
   */
  Data.printFilteredValues = function() {
    if (!printFilteredValuesEnabled) return;
    
    const values = Data.collectFilteredValues();
    
    Utils.log('Отфильтрованные значения:');
    
    // Выводим тикеты
    if (values.tickets.length > 0) {
      Utils.log('Тикеты:');
      values.tickets.forEach((ticket, index) => {
        Utils.log(`${index + 1}. ${ticket.id}: ${ticket.link}`);
      });
    } else {
      Utils.log('Тикеты не найдены');
    }
    
    // Выводим страны
    if (values.countries.length > 0) {
      Utils.log('Страны:');
      values.countries.forEach((country, index) => {
        Utils.log(`${index + 1}. ${country.name} (${country.code})`);
      });
    } else {
      Utils.log('Страны не найдены');
    }
    
    // Выводим водительские права
    if (values.driver_licenses.length > 0) {
      Utils.log('Водительские права:');
      values.driver_licenses.forEach((license, index) => {
        Utils.log(`${index + 1}. ${license.original} (${license.series} ${license.number})`);
      });
    } else {
      Utils.log('Водительские права не найдены');
    }
  };
  
  /**
   * Очистка собранных данных
   */
  Data.clearData = function() {
    collectedData = {
      tickets: [],
      countries: [],
      driver_licenses: []
    };
    Utils.log('Данные очищены');
  };
  
  // Экспортируем модуль в глобальную область видимости
  window.Data = Data;
})(window); 
