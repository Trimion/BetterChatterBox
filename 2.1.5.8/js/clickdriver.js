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

(() => {
  // Получаем все кнопки на странице
  const buttons = document.querySelectorAll('a');

  // Проходим по каждой кнопке
  buttons.forEach(button => {
    // Проверяем, является ли кнопка null или undefined
    if (!button) return;

    // Проверяем, содержит ли текст кнопки слово "Водитель"
    // и ссылается ли она на страницу с iframe
    if (
      button.textContent.includes('Водитель') &&
      button.href.includes('pro-admin-frontend-external.taxi.yandex-team.ru/show-driver/iframe/')
    ) {
      try {
        // Если условия выполнены, симулируем клик по кнопке
        button.click();
      } catch (error) {
        console.error('Ошибка при клике на кнопку:', error);
      }
    }
  });
})();