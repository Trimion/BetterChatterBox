// Выполнение функции напрямую при загрузке скрипта
performSearchAndNotify();

function performSearchAndNotify() {
  // Контрольные bool значения для функций вывода в консоль
  let printLinksEnabled = false; // Вывод найденных ссылок - должно быть отключено в релизе
  let printFilteredValuesEnabled = true; // Вывод найденных значений 

  // Контрольные bool значения для функций фильтрации
  let getTicketLinkEnabled = true; // Функция getTicketLink для получения ссылки на тикет
  let filterCountryEnabled = true; // Функция filterCountry для фильтрации страны
  let filterUuidEnabled = true; // Функция filterClid_Uuid для фильтрации clid_uuid
  let filterDb_idEnabled = true; // Функция filterDb_id для фильтрации db_id
  let filterDriver_LicenseEnabled = true; // Функция filterDriver_License для фильтрации driver_license

  // Последний обработанный ID тикета
  let lastTicketId = null; // Инициализируется как null, пока не будет найден первый тикет

  /**
   * Возвращает массив всех ссылок на странице.
   * @returns {HTMLAnchorElement[]} - Массив ссылок.
   */
  function getLinks() {
    // Получаем все ссылки на странице с помощью querySelectorAll
    let links = Array.from(document.querySelectorAll('a'));
    return links;
  }

  /**
   * Извлекает значение ticket_id из ссылки.
   * @param {HTMLAnchorElement} link - Ссылка.
   * @param {Object} context - Контекст для хранения найденных значений.
   * @returns {string|null} - Значение ticket_id или null, если не найдено.
   */
  function filterTicket(link, context = {}) {
    // Если ссылка не существует или не имеет href, возвращаем null
    if (!link || !link.href) return null;
    try {
      // Создаем объект URL из ссылки
      const url = new URL(link.href.replace(/\/$/, ''));
      // Получаем параметры URL
      const params = url.searchParams;
      // Определяем паттерны для поиска ticket_id в URL
      const ticketIdPatterns = [
        /ticket_id=([0-9a-fA-F]{24})/,
        /chatterbox_ticket_id=([0-9a-fA-F]{24})/,
        /zendesk_ticket=([0-9a-fA-F]{24})/,
      ];
      // Ищем соответствие паттерна в URL
      for (const pattern of ticketIdPatterns) {
        const match = url.href.match(pattern);
        if (match) {
          // Если найдено, извлекаем значение ticket_id
          const ticketId = match[1];
          // Проверяем, является ли ticket_id корректным (24 символа)
          if (!ticketId || !/^[0-9a-fA-F]{24}$/.test(ticketId)) {
            return null; // ID тикета должен состоять из 24 цифр
          }
          // Проверяем, найдено ли значение ранее
          if (context[ticketId]) {
            return null; // Проверяем, найдено ли значение ранее
          }
          context[ticketId] = true;
          return ticketId;
        }
      }
      return null;
    } catch (error) {
      // Если ошибка, возвращаем null
      if (error instanceof TypeError && error.message.includes('Invalid URL')) {
        return null;
      }
      console.warn(`Ошибка при обработке ссылки: ${link.href}`, error);
      return null;
    }
  }

  /**
   * Возвращает ссылку на тикет по ID тикета.
   * @param {string} ticketId - ID тикета.
   * @returns {string|null} - Ссылка на тикет или null, если не найдено.
   */
  function getTicketLink(ticketId) {
    if (!getTicketLinkEnabled) return null; // выходим из функции если getTicketLinkEnabled = false
    if (!ticketId) return null; // выходим из функции если ticketId не найден
    const ticketLink = `https://supchat.taxi.yandex-team.ru/chat/${encodeURIComponent(ticketId)}`;
    return ticketLink;
  }

  /**
   * Извлекает значение country из ссылки.
   * @param {HTMLAnchorElement} link - Ссылка.
   * @returns {string|null} - Значение country или null, если не найдено.
   */
  function filterCountry(link) {
    if (!filterCountryEnabled) return null; // если фильтрация страны отключена, выходим из функции
    if (!link || !link.href) return null; // если ссылка не существует или не имеет href, возвращаем null
    try {
      const url = new URL(link.href.replace(/\/$/, '')); // создаем объект URL из ссылки
      if (url.pathname.includes("sms") || url.pathname.includes("iframe") || url.pathname.includes("tariff")) {
        return null; // игнорируем URLs с "sms", "iframe", или "tariff" в пути
      }
      if (url.href.startsWith('https://forms.yandex-team.ru/surveys/')) {
        const surveyId = url.href.match(/surveys\/(\d+)/)[1];
        if (surveyId !== '147630' && getLinks().some((l) => l.href.includes('forms.yandex-team.ru/surveys/147630/'))) {
          return null; // игнорируем ссылки с другими survey ID, если есть ссылка с survey ID 147630 - фикс для редких случаев со странами
        }
      }
      const params = url.searchParams; // получаем параметры URL
      let country = params.get('country');
      if (!country) {
        // Определение паттернов для поиска страны в URL
        const patterns = [
          /.*intl_([a-zA-Z]{2,3}).*$/,
          /.*csi_([a-zA-Z]{2,3}).*$/,
          /country=([a-zA-Z]{2,3})/, // поиск в параметрах URL
          /\/([a-zA-Z]{2,3})\/(?!tariff)/, // поиск в пути URL, но не в tariff
          /\/([a-zA-Z]{2,3})$/, // поиск в конце пути URL
        ];
        for (const pattern of patterns) {
          const match = url.href.match(pattern);
          if (match) {
            country = match[1];
            break;
          }
        }
      }
      if (!country) return null; // если значение country не найдено, возвращаем null
      // Если код страны из 2 букв, преобразуем его в трёхбуквенный
      if (country.length === 2) {
        country = iso3166Alpha2ToAlpha3(country); // преобразуем код страны из 2 букв в 3 буквы
      }
      // Массив расшифрованных обозначений стран
      const countryCodes = {
        'arm': 'Армения',
        'aze': 'Азербайджан',
        'blr': 'Беларусь',
        'bol': 'Боливия',
        'civ': 'Кот-д’Ивуар',
        'cmr': 'Камерун',
        'col': 'Колумбия',
        'dza': 'Алжир',
        'fin': 'Финляндия',
        'geo': 'Грузия',
        'gha': 'Гана',
        'ind': 'Индия',
        'isr': 'Израиль',
        'kaz': 'Казахстан',
        'kgz': 'Кыргызстан',
        'ltu': 'Литва',
        'mda': 'Молдавия',
        'mol': 'Молдавия', // Дурка ебать
        'moz': 'Мозамбик',
        'nam': 'Намибия',
        'nor': 'Норвегия',
        'pak': 'Пакистан',
        'rus': 'Россия',
        'sen': 'Сенегал',
        'srb': 'Сербия',
        'tjk': 'Таджикистан',
        'tkm': 'Туркменистан',
        'uzb': 'Узбекистан',
        'zmb': 'Замбия',
      };
      // Если значение country совпадает со значением в массиве, то присваиваем country значение из массива
      if (country.toLowerCase() in countryCodes) {
        country = countryCodes[country.toLowerCase()]; // заменяем код страны на полное название
      } else {
        country = 'skull'; // если значение не найдено в countryCodes, присваиваем 'skull'
      }
      return country; // возвращаем значение country
    } catch (error) {
      // игнорируем ошибку и возвращаем null
      return null;
    }
  }

  // функция iso3166Alpha2ToAlpha3
  function iso3166Alpha2ToAlpha3(alpha2) {
    const iso3166Alpha2ToAlpha3Map = {
      'am': 'arm',
      'az': 'aze',
      'bo': 'bol',
      'by': 'blr',
      'ci': 'civ',
      'cm': 'cmr',
      'co': 'col',
      'dz': 'dza',
      'fi': 'fin',
      'ge': 'geo',
      'gh': 'gha',
      'il': 'isr',
      'in': 'ind',
      'kg': 'kgz',
      'kz': 'kaz',
      'lt': 'ltu',
      'md': 'mda',
      'mz': 'moz',
      'na': 'nam',
      'no': 'nor',
      'pk': 'pak',
      'rs': 'srb',
      'ru': 'rus',
      'sn': 'sen',
      'tj': 'tjk',
      'tm': 'tkm',
      'uz': 'uzb',
      'zm': 'zmb',
      // добавить другие страны
    };
    return iso3166Alpha2ToAlpha3Map[alpha2.toLocaleLowerCase()];
  }

  /**
   * Извлекает значение clid_uuid из ссылки и вырезает оттуда uuid.
   * @param {HTMLAnchorElement} link - Ссылка.
   * @returns {string|null} - Значение clid_uuid или null, если не найдено.
   */
  function filterClid_Uuid(link) {
    // Если фильтрация uuid отключена, выходим из функции
    if (!filterUuidEnabled) return null;

    try {
      // Создаем объект URL из ссылки
      const url = new URL(link.href.replace(/\/$/, ''));

      // Получаем параметры URL
      const params = url.searchParams;

      // Инициализируем переменную для хранения значения clid_uuid
      let Uuid = params.get('clid_uuid');

      // Если значение clid_uuid не найдено, ищем его в пути URL
      if (!Uuid) {
        // Определяем паттерны для поиска clid_uuid в URL
        const patterns = [
          /clid_uuid=([0-9]+)_(.*)/,
          /\/iframe\/([0-9]+)_(.*)$/,
          /\/show-driver\/iframe\/([0-9]+)_(.*)$/,
        ];

        // Ищем соответствие паттерна в URL
        for (const pattern of patterns) {
          const match = url.href.match(pattern);
          if (match) {
            // Если найдено, извлекаем значение clid_uuid
            Uuid = match[1] + '_' + match[2].split('?')[0]; // извлекаем всю строку clid_uuid
            break;
          }
        }
      }

      // Если значение clid_uuid не найдено, возвращаем null
      if (!Uuid) return null;

      // Извлекаем часть uuid из значения clid_uuid
      const uuidPart = Uuid.split('_')[1];

      // Если часть uuid не найдена, возвращаем null
      if (!uuidPart) return null;

      // Возвращаем часть uuid
      return uuidPart;
    } catch (error) {
      // Если ошибка, возвращаем null
      return null;
    }
  }

  /**
   * Извлекает значение db_id из ссылки.
   * @param {HTMLAnchorElement} link - Ссылка.
   * @returns {string|null} - Значение db_id или null, если не найдено.
   */
  function filterDb_id(link) {
    // Если фильтрация db_id отключена, выходим из функции
    if (!filterDb_idEnabled) return null;

    // Если ссылка не существует или не имеет href, возвращаем null
    if (!link || !link.href) return null;

    // Создаем объект URL из ссылки
    const url = new URL(link.href);

    // Получаем параметры URL
    const params = url.searchParams;

    // Инициализируем переменную для хранения значения db_id
    let dbId = params.get('db');

    // Определяем паттерны для поиска db_id в URL
    const patterns = [
      /db=([0-9a-f]{32})/, // поиск в параметрах URL
      /\/db\/([0-9a-f]{32})/, // поиск в пути URL
      /\/([0-9a-f]{32})\/db/, // поиск в пути URL
      /redirect\/to\/order\?db=([0-9a-f]{32})/, // поиск в параметрах URL
      /entity_id=([0-9a-f]{32})_[0-9a-f]{32}/, // поиск в параметрах URL
      /park_id=([0-9a-f]{32})&lang=[a-z]{2}/, // поиск в параметрах URL
    ];

    // Ищем соответствие паттерна в URL
    for (const pattern of patterns) {
      const match = url.href.match(pattern);
      if (match) {
        // Если найдено, извлекаем значение db_id
        dbId = match[1];
        break;
      }
    }

    // Если значение db_id не найдено или не соответствует формату (32 цифры), возвращаем null
    if (!dbId || !/^[0-9a-f]{32}$/.test(dbId)) {
      return null;
    }

    // Создаем контекст для хранения найденных значений
    const context = filterDb_id.context || (filterDb_id.context = {});

    // Если значение db_id уже найдено, возвращаем null
    if (context[dbId]) {
      return null;
    }

    // Помечаем значение db_id как найденное
    context[dbId] = true;

    // Возвращаем значение db_id
    return dbId;
  }

  /**
   * Извлекает значение driver_license из ссылки.
   * @param {HTMLAnchorElement} link - Ссылка.
   * @returns {string|null} - Значение driver_license или null, если не найдено.
   */
  function filterDriver_License(link) {
    if (!filterDriver_LicenseEnabled) return null;
    try {
      const url = new URL(link.href.replace(/\/$/, ''));
      const params = url.searchParams;
      let driverLicense = params.get('driver_license');
      if (!driverLicense) {
        const patterns = [
          /driver_license=([A-Z0-9]+)/,
          /\/driver_license\/([A-Z0-9]+)/,
        ];
        for (const pattern of patterns) {
          const match = url.href.match(pattern);
          if (match) {
            driverLicense = match[1];
            break;
          }
        }
      }
      if (!driverLicense) {
        // Пытаемся извлечь ВУ из ссылок
        const linkText = link.textContent;
        const match = linkText.match(/driver_license: ([A-Z0-9]+)/);
        if (match) {
          driverLicense = match[1];
        }
      }
      if (!driverLicense) return null; // если не найдено, возвращаем null
      // Проверяем, найдено ли значение ранее
      const context = filterDriver_License.context || (filterDriver_License.context = {});
      if (context[driverLicense]) {
        return null;
      }
      context[driverLicense] = true;
      return driverLicense;
    } catch (error) {
      return null; // если не найдено, возвращаем null
    }
  }

  /**
   * Собирает отфильтрованные значения из ссылок.
   * @returns {Object[]} - Массив объектов с отфильтрованными значениями.
   */
  function collectFilteredValues() {
    // Получаем все ссылки на странице
    const links = getLinks();
    // Создаем контекст для хранения найденных значений
    const context = {};
    // Создаем массив для хранения отфильтрованных значений
    const filteredValues = links.map((link, index) => {
      // Создаем объект для хранения отфильтрованных значений для каждой ссылки
      const values = {};
      try {
        // Извлекаем значение ticketId из ссылки
        values.ticketId = filterTicket(link, context);
      } catch (error) {
        console.error(`Ошибка фильтрации ticketId: ${error}`);
      }
      try {
        // Извлекаем значение country из ссылки
        values.country = filterCountry(link);
      } catch (error) {
        console.error(`Ошибка фильтрации страны: ${error}`);
      }
      try {
        // Извлекаем значение Uuid из ссылки
        values.clidUuid = filterClid_Uuid(link);
      } catch (error) {
        console.error(`Ошибка фильтрации Uuid: ${error}`);
      }
      try {
        // Извлекаем значение dbId из ссылки
        values.dbId = filterDb_id(link);
      } catch (error) {
        console.error(`Ошибка фильтрации dbId: ${error}`);
      }
      try {
        // Извлекаем значение driverLicense из ссылки
        values.driverLicense = filterDriver_License(link);
      } catch (error) {
        console.error(`Ошибка фильтрации driverLicense: ${error}`);
      }
      // Если значение ticketId найдено, создаем ссылку на тикет
      if (values.ticketId) {
        values.ticketLink = getTicketLink(values.ticketId);
      }
      // Возвращаем объект values, даже если некоторые свойства не были заполнены
      return values;
    }).filter((values) => Object.keys(values).some((key) => values[key] !== undefined));
    return filteredValues;
  }

  /**
   * Выводит в консоль все ссылки на странице.
   * Функция выводит в консоль все найденные ссылки на странице.
   */
  function printLinks() {
    // Если вывод ссылок отключён, выходим из функции
    if (!printLinksEnabled) return;
    const links = getLinks();
    links.forEach((link) => {
      // Выводим в консоль каждый найденный URL
      if (link && link.href) {
        console.log(link.href);
      }
    });
  }

  /**
   * Выводит в консоль отфильтрованные значения из ссылок.
   */
  function printFilteredValues() {
    // Если вывод отфильтрованных значений отключен, выходим из функции
    if (!printFilteredValuesEnabled) return;
    // Собираем отфильтрованные значения из ссылок
    const filteredValues = collectFilteredValues();
    // Ищем значение ticketId в отфильтрованных значениях
    const ticketId = filteredValues.find((values) => values.ticketId);
    // Если значение ticketId найдено и оно не равно последнему обработанному ID тикета, выводим значения в консоль
    if (ticketId && ticketId.ticketId !== lastTicketId) {
      // Обновляем последний обработанный ID тикета
      lastTicketId = ticketId.ticketId;
      // Создаем объект для хранения найденных значений
      const values = {};
      // Объединяем значения из всех отфильтрованных значений
      filteredValues.forEach((value) => {
        Object.keys(value).forEach((key) => {
          if (value[key]) values[key] = value[key];
        });
      });
      // Выводим значения в консоль в заданном порядке
      console.group('Найденные данные:');
      if (values.ticketId) console.log(`ID тикета: %c${values.ticketId}`, 'font-weight: bold');
      if (values.ticketLink) console.log(`Ссылка на тикет: %c${values.ticketLink}`, 'font-weight: bold');
      if (values.country) console.log(`Страна: %c${values.country}`, 'font-weight: bold');
      if (values.driverLicense) console.log(`Номер ВУ: %c${values.driverLicense}`, 'font-weight: bold');
      if (values.clidUuid) console.log(`UUID: %c${values.clidUuid}`, 'font-weight: bold');
      if (values.dbId) console.log(`DB_ID: %c${values.dbId}`, 'font-weight: bold');
      console.groupEnd();
      // Create a notification
      chrome.runtime.sendMessage({ action: 'createNotification', data: values });
    }
  }

  // Выводим ссылки и отфильтрованные значения в консоль
  printLinks();
  printFilteredValues();

  // Повторяем функции после каждого изменения страницы
  /**
   * Наблюдатель за изменениями страницы.
   * Он будет вызывать функции printLinks и printFilteredValues после каждого изменения страницы.
   */
  // Инициализируем переменную для хранения идентификатора таймаута
  let timeoutId = null;

  // Создаем новый MutationObserver для отслеживания изменений на странице
  const observer = new MutationObserver(() => {
    // Игнорируем события клавиатуры
    if (document.activeElement instanceof HTMLInputElement) return;

    // Очищаем предыдущий таймаут
    clearTimeout(timeoutId);
    // Устанавливаем новый таймаут на 0,05 секунд
    timeoutId = setTimeout(() => {
      // Выводим ссылки на странице
      printLinks();
      // Выводим отфильтрованные значения из ссылок
      printFilteredValues();
    }, 50);
  });

  // Определяем параметры наблюдения
  observer.observe(document, {
    // Наблюдаем за добавлением или удалением дочерних элементов
    childList: true,
    // Наблюдаем за всей структурой элементов
    subtree: true,
  });
}