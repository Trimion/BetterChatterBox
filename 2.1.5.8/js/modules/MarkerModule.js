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

/**
 * MarkerModule.js
 * Модуль для поиска и выделения указанных пользователем значений на странице
 */

const MarkerModule = {
  enabled: false,
  markers: [],
  highlightTag: "SPAN",
  highlightClassName: "marker-highlight",
  skipTags: new RegExp("^(?:SCRIPT|STYLE|TEXTAREA|SELECT|BUTTON|INPUT|NOSCRIPT|HEAD|META|TITLE)$"),
  highlightedElements: [],
  initialized: false,
  isHighlighting: false,

  /**
   * Инициализация модуля
   */
  async init() {
    if (this.initialized) return;
    
    try {
      const settings = await this.getSettings();
      this.enabled = settings.markerEnabled || false;
      this.markers = settings.markers || [];
      
      this.addStyles();
      
      this.setupMutationObserver();
      
      this.initialized = true;
      
      if (this.enabled && Array.isArray(this.markers) && this.markers.length > 0) {
        setTimeout(() => {
          this.highlightAll();
        }, 100);
      }
      
      return true;
    } catch (error) {
      console.error('Ошибка при инициализации модуля маркера:', error);
      return false;
    }
  },

  /**
   * Получение настроек из хранилища
   */
  async getSettings() {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(['markerEnabled', 'markers'], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          
          const markers = Array.isArray(result.markers) ? result.markers : [];
          
          resolve({
            markerEnabled: result.markerEnabled === true,
            markers: markers
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Сохранение настроек в хранилище
   */
  async saveSettings(settings) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(settings, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Добавление стилей для выделения
   */
  addStyles() {
    if (!document.head) {
      const checkHead = setInterval(() => {
        if (document.head) {
          clearInterval(checkHead);
          this.addStyles();
        }
      }, 100);
      
      return;
    }
    
    if (document.getElementById('marker-module-styles')) {
      return;
    }
    
    const style = document.createElement('style');
    style.id = 'marker-module-styles';
    style.textContent = `
      .marker-highlight {
        padding: 1px;
        border-radius: 3px;
        box-shadow: 1px 1px #e5e5e5;
        font-style: inherit;
        display: inline;
        user-select: text;
        -webkit-user-select: text;
        -moz-user-select: text;
        -ms-user-select: text;
      }
    `;
    document.head.appendChild(style);
  },

  /**
   * Включение/выключение модуля
   */
  async toggleEnabled(enabled) {
    this.enabled = enabled === true;
    
    try {
      await this.saveSettings({ markerEnabled: this.enabled });
      
      if (this.enabled) {
        this.highlightAll();
      } else {
        this.removeAllHighlights();
      }
    } catch (error) {
      console.error('Ошибка при сохранении состояния маркера:', error);
    }
  },

  /**
   * Обновление маркеров
   */
  async updateMarkers(markers) {
    if (!Array.isArray(markers)) {
      return;
    }
    
    const filteredMarkers = markers.filter(marker => 
      marker && marker.text && marker.text.trim() !== '' && marker.color
    );
    
    this.markers = filteredMarkers;
    
    try {
      await this.saveSettings({ markers: filteredMarkers });
      
      if (this.enabled) {
        this.removeAllHighlights();
        this.highlightAll();
      }
    } catch (error) {
      console.error('Ошибка при сохранении маркеров:', error);
    }
  },

  /**
   * Выделение всех совпадений на странице
   */
  highlightAll() {
    if (!this.enabled || !this.markers || this.markers.length === 0) {
      return;
    }
    
    if (!document.body) {
      const checkBody = setInterval(() => {
        if (document.body) {
          clearInterval(checkBody);
          this.highlightAll();
        }
      }, 100);
      
      return;
    }
    
    if (this.isHighlighting) {
      return;
    }
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      return;
    }
    
    this.isHighlighting = true;
    
    try {
      this.removeAllHighlights();
      
      this.markers.forEach(marker => {
        if (marker && marker.text && marker.text.trim() !== '' && marker.color) {
          const exactMatch = marker.exactMatch === true;
          this.highlightText(marker.text, marker.color, exactMatch);
        }
      });
    } catch (error) {
      console.error('Ошибка при выделении текста:', error);
    } finally {
      this.isHighlighting = false;
    }
  },

  /**
   * Выделение текста на странице
   * @param {string} text - Текст для поиска
   * @param {string} color - Цвет выделения
   * @param {boolean} exactMatch - Флаг точного совпадения (если true, ищет только полные слова)
   */
  highlightText(text, color, exactMatch = false) {
    if (!text || text.trim() === '') return;
    
    if (!document.body) {
      return;
    }
    
    try {
      let textRegex;
      
      if (exactMatch) {
        textRegex = new RegExp(`\\b${this.escapeRegExp(text)}\\b`, 'gi');
      } else {
        textRegex = new RegExp(this.escapeRegExp(text), 'gi');
      }
      
      this.highlightTextInNode(document.body, textRegex, color);
    } catch (error) {
      console.error(`Ошибка при выделении текста "${text}":`, error);
    }
  },

  /**
   * Выделение текста в узле DOM и его дочерних элементах
   * Использует подход из Highlight-This для сохранения возможности копирования
   */
  highlightTextInNode(node, regex, color) {
    if (!node) return;
    
    if (node.nodeType === Node.ELEMENT_NODE && 
        (this.skipTags.test(node.nodeName) || 
         node.classList.contains(this.highlightClassName))) {
      return;
    }
    
    if (node.hasChildNodes()) {
      const childNodes = Array.from(node.childNodes);
      for (let i = 0; i < childNodes.length; i++) {
        this.highlightTextInNode(childNodes[i], regex, color);
      }
    }
    
    if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== '') {
      const nodeValue = node.nodeValue;
      regex.lastIndex = 0;
      
      if (regex.test(nodeValue)) {
        regex.lastIndex = 0;
        
        const matches = [];
        let match;
        while ((match = regex.exec(nodeValue)) !== null) {
          matches.push({
            index: match.index,
            text: match[0],
            length: match[0].length
          });
        }
        
        if (matches.length > 0) {
          const fragment = document.createDocumentFragment();
          let lastIndex = 0;
          
          for (const match of matches) {
            if (match.index > lastIndex) {
              fragment.appendChild(document.createTextNode(nodeValue.substring(lastIndex, match.index)));
            }
            
            const highlightNode = this.createHighlightNode(match.text, color);
            fragment.appendChild(highlightNode);
            this.highlightedElements.push(highlightNode);
            
            lastIndex = match.index + match.length;
          }
          
          if (lastIndex < nodeValue.length) {
            fragment.appendChild(document.createTextNode(nodeValue.substring(lastIndex)));
          }
          
          node.parentNode.replaceChild(fragment, node);
        }
      }
    }
  },

  /**
   * Создание узла выделения
   */
  createHighlightNode(text, color) {
    const highlightNode = document.createElement(this.highlightTag);
    highlightNode.className = this.highlightClassName;
    highlightNode.textContent = text;
    highlightNode.style.backgroundColor = color;
    
    const textColor = this.getContrastColor(color);
    highlightNode.style.color = textColor;
    
    return highlightNode;
  },

  /**
   * Удаление всех выделений
   */
  removeAllHighlights() {
    this.highlightedElements.forEach(element => {
      try {
        if (element.parentNode) {
          const textNode = document.createTextNode(element.textContent);
          element.parentNode.replaceChild(textNode, element);
        }
      } catch (error) {
        console.error('Ошибка при удалении выделения:', error);
      }
    });
    
    this.highlightedElements = [];
  },

  /**
   * Экранирование специальных символов для регулярного выражения
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  /**
   * Определение контрастного цвета текста в зависимости от цвета фона
   */
  getContrastColor(hexColor) {
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    return brightness > 128 ? '#000000' : '#FFFFFF';
  },

  /**
   * Настройка наблюдателя за изменениями DOM
   */
  setupMutationObserver() {
    if (!document.body) {
      const checkBody = setInterval(() => {
        if (document.body) {
          clearInterval(checkBody);
          this.setupMutationObserver();
        }
      }, 100);
      
      return;
    }
    
    this.observer = new MutationObserver((mutations) => {
      if (!this.enabled || this.markers.length === 0) return;
      
      let hasAddedNodes = false;
      let hasRelevantChanges = false;
      
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        return;
      }
      
      for (const mutation of mutations) {
        if (mutation.target && mutation.target.classList && 
            mutation.target.classList.contains(this.highlightClassName)) {
          continue;
        }
        
        let isOurHighlight = false;
        if (mutation.addedNodes.length > 0) {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i];
            if (node.nodeType === Node.ELEMENT_NODE && 
                node.classList && 
                node.classList.contains(this.highlightClassName)) {
              isOurHighlight = true;
              break;
            }
          }
        }
        
        if (isOurHighlight) {
          continue;
        }
        
        if (mutation.addedNodes.length > 0) {
          hasAddedNodes = true;
          hasRelevantChanges = true;
          break;
        }
        
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'value' || mutation.attributeName === 'textContent')) {
          hasRelevantChanges = true;
          break;
        }
      }
      
      if (hasRelevantChanges) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          if (this.enabled && this.markers.length > 0) {
            this.highlightAll();
          }
        }, 500);
      }
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: false,
      attributes: false
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (typeof MarkerModule !== 'undefined' && typeof MarkerModule.init === 'function') {
    MarkerModule.init().catch(error => {
      console.error('Ошибка при инициализации модуля маркера:', error);
    });
  }
});

if (document.readyState === 'interactive' || document.readyState === 'complete') {
  if (typeof MarkerModule !== 'undefined' && typeof MarkerModule.init === 'function' && !MarkerModule.initialized) {
    MarkerModule.init().catch(error => {
      console.error('Ошибка при инициализации модуля маркера:', error);
    });
  }
} 