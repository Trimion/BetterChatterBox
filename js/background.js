// Используем строгий режим
"use strict";

let notifications = {}; // Массив для хранения идентификаторов уведомлений и соответствующих им данных
let NotificationTimeout = 60000; // Таймаут по умолчанию (60 секунд)
let lastNotificationTime = 0; // Временная метка последнего уведомления
let currentNotificationId = null; // ID текущего уведомления
let previousTabUrl = ''; // Переменная для хранения URL предыдущей активной вкладки

// Константа для пути к иконкам флагов
const FlagIconPath = 'img/flags/';

// Создание уведомления
function createNotification(data, notificationTimeout = NotificationTimeout) {
    // Проверяем, был ли отправлен предыдущий запрос уведомления менее 5 секунд назад
    if (Date.now() - lastNotificationTime < 300) {
        console.log('Пропуск дублирующего уведомления');
        return;
    }
    lastNotificationTime = Date.now();
    NotificationTimeout = 60000; // Сброс к дефолтному значению
    try {
        // Проверяем, является ли data null или undefined
        if (!data) {
            throw new Error('Данные уведомления не переданы');
        }
        // Удаляем все существующие уведомления
        clearNotification();
        // Получаем код страны из данных и преобразуем его в нижний регистр, если он не передан, то используем 'unknown'
        const countryCode = (data.country || 'unknown').toLowerCase();
        // Получаем URL иконки флага страны, используя код страны и путь к иконкам флагов
        let iconUrl = chrome.runtime.getURL(`${FlagIconPath}${countryCode}.png`);
        // Опции для создания уведомления
        const notificationOptions = {
            type: 'list', // Тип уведомления - список
            iconUrl: iconUrl, // URL иконки флага страны
            title: `Тикет #${data.ticketId}`, // Заголовок уведомления - номер тикета
            message: '', // Сообщение уведомления - пустое
            items: [
                { title: 'Страна:', message: data.country || 'Данные не найдены!' }, // Страна
                { title: 'Номер ВУ:', message: data.driverLicense || 'Данные не найдены!' }, // Номер ВУ
                { title: 'UUID:', message: data.clidUuid || 'Данные не найдены!' }, // UUID
                { title: 'DB_ID:', message: data.dbId || 'Данные не найдены!' }, // DB_ID
            ].map(item => ({ ...item, message: item.message === null || item.message === undefined ? 'Данные не найдены!' : item.message })), // Обработка пустых значений
            buttons: getNotificationButtons(data), // Кнопки уведомления, генерируются функцией getNotificationButtons
            priority: 2, // Приоритет уведомления
            requireInteraction: notificationTimeout === 0, // Требуется ли взаимодействие с уведомлением
        };
        // Создаем новое уведомление
        chrome.notifications.create(notificationOptions, (id) => {
            if (chrome.runtime.lastError) {
                console.log('Ошибка при создании уведомления:', chrome.runtime.lastError);
                return;
            }
            const newNotificationId = id;
            notifications[newNotificationId] = {
                data: data, // Данные уведомления
                timeoutId: setTimeout(() => {
                    clearNotification(); // Очистка уведомления по таймауту
                }, notificationTimeout),
                timeout: notificationTimeout, // Храним таймаут этого уведомления
            };
            // Обновляем объект notifications с новым ID уведомления
            notifications[newNotificationId].id = newNotificationId;
            // Очищаем старый таймаут если есть
            if (notifications[newNotificationId].timeoutId) {
                clearTimeout(notifications[newNotificationId].timeoutId);
            }
        });
    } catch (error) {
        console.log('Ошибка при создании уведомления:', error);
    }
}

// Функция для генерации кнопок уведомления
function getNotificationButtons(data) {
    try {
        const buttons = [];
        // Добавляем кнопку для номера ВУ, если он доступен
        if (data.driverLicense !== undefined && data.driverLicense !== null) {
            buttons.push({ title: 'Номер ВУ' });
        }
        // Добавляем кнопку для страны, если она доступна
        if (data.country !== undefined && data.country !== null) {
            buttons.push({ title: 'Страна' });
        }
        // Возвращаем массив кнопок
        return buttons;
    } catch (error) {
        // Выводим ошибку в консоль, если произошла ошибка при генерации кнопок
        console.log('Ошибка при генерации кнопок уведомления:', error);
        // Возвращаем пустой массив, если произошла ошибка
        return [];
    }
}

// Функция для обработки нажатия кнопки уведомления
function handleButtonClicked(notificationId, buttonIndex) {
    try {
        // Проверяем, существует ли уведомление с данным идентификатором
        if (notifications[notificationId] === undefined || notifications[notificationId] === null || notifications[notificationId].data === undefined || notifications[notificationId].data === null) {
            console.log(`Уведомление с ID ${notificationId} не найдено или данные пусты`);
            return;
        }
        // Получаем последнее сфокусированное окно
        chrome.windows.getLastFocused((window) => {
            // Получаем активную вкладку в последнем сфокусированном окне
            chrome.tabs.query({ active: true, windowId: window.id }, (tabs) => {
                if (tabs.length === 0) {
                    return;
                }
                const activeTab = tabs[0]
                // Получаем кнопки уведомления
                const buttons = getNotificationButtons(notifications[notificationId].data); // Используем функцию для генерации кнопок
                // Проверяем, какая кнопка была нажата
                if (buttonIndex >= 0 && buttonIndex < buttons.length) {
                    const button = buttons[buttonIndex]
                    // Данные для копирования
                    if (notifications[notificationId] !== undefined && notifications[notificationId] !== null) {
                        const data = button.title === 'Номер ВУ' ? notifications[notificationId].data.driverLicense : notifications[notificationId].data.country;
                        // Выполняем скрипт на активной вкладке
                        executeScript(activeTab.id, data, () => {
                            // Обновляем данные уведомления и кнопок
                            if (notifications[notificationId] !== undefined && notifications[notificationId] !== null) {
                                updateNotificationContext(notificationId, notifications[notificationId].data);
                                // Обновляем таймаут уведомления
                                const timeout = notifications[notificationId].timeout;
                                if (timeout !== null && timeout !== undefined) {
                                    clearTimeout(notifications[notificationId].timeoutId);
                                    notifications[notificationId].timeoutId = setTimeout(() => {
                                        clearNotification(); // Очистка уведомления по таймауту
                                    }, timeout);
                                }
                            } else {
                                console.log(`Уведомление с ID ${notificationId} не найдено`);
                            }
                        });
                    } else {
                        console.log(`Уведомление с ID ${notificationId} не найдено`);
                    }
                }
            });
        });
    } catch (error) {
        console.log('Ошибка при обработке нажатия кнопки уведомления:', error);
    }
}

// Функция для обновления контекста уведомления
function updateNotificationContext(notificationId, data) {
    // Получаем все уведомления
    chrome.notifications.getAll((notifications) => {
        // Проверяем, существует ли уведомление с данным идентификатором
        if (notifications[notificationId]) {
            const timeout = notifications[notificationId].timeout;
            if (timeout !== null && timeout !== undefined) {
                // Создаем новые опции для уведомления
                const notificationOptions = {
                    // Обновляем кнопки уведомления
                    buttons: getNotificationButtons(data),
                };
                // Обновляем уведомление
                chrome.notifications.update(notificationId, notificationOptions, (wasUpdated) => {
                    // Если обновление не удалось, выводим ошибку
                    if (!wasUpdated) {
                        console.log(`Ошибка обновления уведомления ${notificationId}`);
                    } else {
                        console.log(`Уведомление ${notificationId} обновлено`);
                        // Обновляем timeout для уведомления
                        notifications[notificationId].timeoutId = setTimeout(() => {
                            clearNotification(); // Очистка уведомления по таймауту
                        }, timeout);
                    }
                });
            } else {
                console.log(`Timeout для уведомления ${notificationId} не установлен`);
            }
        } else {
            // Если уведомление не найдено, выводим ошибку
            console.log(`Уведомление с ID ${notificationId} не найдено`);
        }
    });
}

// Функция для выполнения скрипта на активной вкладке
function executeScript(tabId, data) {
    // Получаем последнее сфокусированное окно
    chrome.windows.getLastFocused((window) => {
        // Получаем активную вкладку в последнем сфокусированном окне
        chrome.tabs.query({ active: true, windowId: window.id }, (tabs) => {
            if (tabs.length === 0) {
                return;
            }
            const activeTab = tabs[0];
            // Выполняем скрипт на активной вкладке
            chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                function: (data) => {
                    // Копируем страну или номер ВУ в буфер обмена
                    navigator.clipboard.writeText(data).then(() => {
                        console.log(`Данные "${data}" скопированы в буфер обмена`);
                    });
                },
                args: [data],
            }, (result) => {
                if (chrome.runtime.lastError) {
                    console.log('Ошибка при выполнении скрипта:', chrome.runtime.lastError);
                } else {
                    console.log('Скрипт выполнен успешно');
                }
            });
        });
    });
}

// Функция для удаления уведомлений
function clearNotification() {
    try {
        // Очищаем все уведомления из объекта notifications
        Object.keys(notifications).forEach((notificationId) => {
            if (notifications[notificationId] !== undefined && notifications[notificationId] !== null) {
                // Удаляем уведомление из объекта notifications
                delete notifications[notificationId];
                // Очищаем уведомление из Chrome notifications API
                chrome.notifications.clear(notificationId, (wasCleared) => {
                    if (!wasCleared) {
                        console.log(`Ошибка при удалении уведомления ${notificationId}`);
                    }
                });
            }
        });
        // Очищаем все ожидаемые уведомления
        chrome.notifications.getAll((notifications) => {
            Object.keys(notifications).forEach((notificationId) => {
                chrome.notifications.clear(notificationId, (wasCleared) => {
                    if (!wasCleared) {
                        console.log(`Ошибка при удалении уведомления ${notificationId}`);
                    }
                });
            });
        });
    } catch (error) {
        console.log('Ошибка при удалении уведомления:', error);
    }
}

// Функция для очистки уведомлений при изменении фокуса или сворачивании браузера
function handleFocusChange() {
    try {
        // Получаем последнее сфокусированное окно
        chrome.windows.getLastFocused((window) => {
            if (window) {
                // Получаем активную вкладку в последнем сфокусированном окне
                chrome.tabs.query({ active: true, windowId: window.id }, (tabs) => {
                    if (tabs.length === 0) {
                        clearNotification();
                    }
                    const activeTab = tabs[0];
                    const tabId = activeTab.id;
                    if (!tabId) {
                        console.log('Нет идентификатора вкладки');
                        return;
                    }
                    // Очищаем уведомления, когда фокус изменяется
                    clearNotification();
                    if (tabs.length > 0) {
                        // Выполняем скрипт на активной вкладке, когда фокус изменяется
                        chrome.scripting.executeScript({
                            target: { tabId: tabs[0].id },
                            files: ['js/content.js']
                        });
                    }
                });
            } else {
            }
        });
    } catch (error) {
        console.log('Ошибка при очистке уведомлений:', error);
    }
}

// Слушатель сообщений от других частей расширения
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        if (request.action === 'createNotification') {
            // Получаем последнее сфокусированное окно
            chrome.windows.getLastFocused((window) => {
                if (window) {
                    // Получаем активную вкладку в последнем сфокусированном окне
                    chrome.tabs.query({ active: true, windowId: window.id }, (tabs) => {
                        if (tabs.length > 0) {
                            // Создаем уведомление с данными из запроса и таймаутом из запроса
                            createNotification(request.data, request.timeout);
                        }
                    });
                }
            });
        } else if (request.action === 'clearNotification') {
            clearNotification();
        }
    } catch (error) {
        console.log('Ошибка при обработке сообщения:', error);
    }
});

// Слушатель нажатия кнопки уведомления
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    console.log('Кнопка нажата:', notificationId, buttonIndex);
    try {
        // Обработка нажатия кнопки уведомления
        handleButtonClicked(notificationId, buttonIndex);
        currentNotificationId = notificationId; // ID уведомления
    } catch (error) {
        console.log('Ошибка при нажатии кнопки уведомления:', error);
    }
});

// Слушатель команд от пользователя
chrome.commands.onCommand.addListener((command) => {
    if (!command) {
        console.log('Нет команды');
        return;
    }
    // Выполняем команду в зависимости от полученного идентификатора
    if (command === "run_extension") {
        // Получаем последнее сфокусированное окно
        chrome.windows.getLastFocused((window) => {
            if (window.type === "normal") {
                // Получаем активную вкладку в последнем сфокусированном окне
                chrome.tabs.query({ active: true, windowId: window.id }, (tabs) => {
                    if (tabs.length > 0) {
                        // Выполняем скрипт на активной вкладке
                        chrome.scripting.executeScript({
                            target: { tabId: tabs[0].id },
                            files: ['js/content.js']
                        });
                    } else {
                        console.log("Нет активной вкладки");
                    }
                });
            } else {
                console.log("Нет окна в фокусе");
            }
        });
    }
    // Запускаем скрипт клика на кнопку драйвера
    else if (command === "click_driver_button") {
        // Получаем последнее сфокусированное окно
        chrome.windows.getLastFocused((window) => {
            if (window.type === "normal") {
                // Получаем активную вкладку в последнем сфокусированном окне
                chrome.tabs.query({ active: true, windowId: window.id }, (tabs) => {
                    if (tabs.length > 0) {
                        // Выполняем скрипт клика на кнопку водителя на активной вкладке
                        chrome.scripting.executeScript({
                            target: { tabId: tabs[0].id },
                            files: ['js/clickdriver.js']
                        });
                    } else {
                        console.log("Нет активной вкладки");
                    }
                });
                if (currentNotificationId && notifications[currentNotificationId]) {
                    updateNotificationContext(currentNotificationId, notifications[currentNotificationId].data);
                } else {
                    console.log(`Уведомление с ID ${currentNotificationId} не найдено или данные пусты`);
                }
            } else {
                if (notifications[notificationId] && notifications[notificationId].data) {
                    // доступ к свойству data
                } else {
                    console.log(`Уведомление с ID ${notificationId} не найдено или данные пусты`);
                }
            }
        });
    }
});

// Слушатель события изменения активной вкладки
chrome.tabs.onActivated.addListener((activeInfo) => {
    // Если нет информации о активной вкладке, выходим
    if (!activeInfo) return console.log('Нет информации о активной вкладке');
    // Получаем информацию о текущей вкладке
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        // Если URL вкладки пустой или начинается с chrome:// или browser://, выходим
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('browser://')) {
            handleFocusChange(); // Вызываем при изменении фокуса
        }
        // Если URL текущей вкладки отличается от предыдущего, обновляем previousTabUrl и очищаем уведомления
        if (tab.url !== previousTabUrl) {
            previousTabUrl = tab.url;
            handleFocusChange(); // Вызываем при изменении фокуса
        }
    });
});