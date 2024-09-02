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