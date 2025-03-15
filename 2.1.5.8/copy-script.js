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

// Функция для копирования текста в буфер обмена
function copyToClipboard(text) {
  // Убеждаемся, что копируется только ссылка
  const textToCopy = text.trim();
  
  // Используем современный API для копирования
  navigator.clipboard.writeText(textToCopy)
    .then(function() {
      chrome.storage.local.get(['loggingEnabled'], (result) => {
        if (result.loggingEnabled) {
          console.log('Скопирован текст: ' + textToCopy);
        }
      });
    })
    .catch(function(err) {
      chrome.storage.local.get(['loggingEnabled'], (result) => {
        if (result.loggingEnabled) {
          console.error('Не удалось скопировать текст: ', err);
        }
      });
    });
}

// Функция для обработки нажатия на кнопку копирования
function handleCopyButtonClick(event) {
  const button = event.currentTarget;
  const textToCopy = button.getAttribute('data-copy-text');
  
  if (textToCopy) {
    copyToClipboard(textToCopy);
    
    // Визуальная обратная связь
    const originalText = button.textContent;
    button.textContent = "✓ Скопировано!";
    button.classList.add("copy-success");
    
    setTimeout(function() {
      button.textContent = originalText;
      button.classList.remove("copy-success");
    }, 3000);
  }
}

// Функция для переключения вкладок
function openTab(tabName) {
  var i, tabcontent, tablinks;
  
  tabcontent = document.getElementsByClassName("tab-content");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  
  tablinks = document.getElementsByClassName("tab");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }
  
  document.getElementById(tabName).style.display = "block";
}

// Функция для обработки клика по вкладке
function handleTabClick(event) {
  const tab = event.currentTarget;
  const tabName = tab.getAttribute('data-tab');
  openTab(tabName);
  tab.className += " active";
}

// Функция для анимации появления элементов при скролле
function initScrollAnimations() {
  const sections = document.querySelectorAll('.section');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  });

  sections.forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = 'all 0.5s ease';
    observer.observe(section);
  });
}

// Инициализация всех функций при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  // Инициализация кнопок копирования
  const copyButtons = document.querySelectorAll('.copy-link');
  copyButtons.forEach(function(button) {
    button.addEventListener('click', handleCopyButtonClick);
  });

  // Инициализация вкладок
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', handleTabClick);
  });

  // Инициализация анимаций при скролле
  initScrollAnimations();
}); 