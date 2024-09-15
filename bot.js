require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { Client } = require('@notionhq/client');
const moment = require('moment');

// Инициализация клиентов для Notion и Telegram
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const databaseId = process.env.NOTION_DATABASE_ID;

// Функция для получения данных о лекарствах из Notion

async function getMedicinesFromNotion() {
    const response = await notion.databases.query({
      database_id: databaseId
    });
  
    return response.results.map(page => {
      // Проверяем наличие свойства 'Время следующего напоминания'
      const dateProperty = page.properties['Время следующего напоминания'];
      let nextReminderTime = null;
  
      if (dateProperty && dateProperty.date && dateProperty.date.start) {
        console.log('Date from Notion:', dateProperty.date.start);
        const parsedDate = moment(dateProperty.date.start);
        if (parsedDate.isValid()) {
          nextReminderTime = parsedDate.toDate();
        } else {
          console.log(`Некорректный формат даты для страницы с ID: ${page.id}`);
        }
      } else {
        console.log(`Свойство даты отсутствует или некорректно для страницы с ID: ${page.id}`);
        console.log(`Свойства страницы с ID ${page.id}:`, page.properties);
      }
  
      return {
        id: page.id,
        medicineName: page.properties['Название лекарства'].title[0]?.text.content || "Не указано",
        dosage: page.properties['Дозировка'].rich_text[0]?.text.content || "Дозировка не указана",
        timesPerDay: page.properties['Количество приемов в день'].number || "Количество не указано",
        nextReminderTime: nextReminderTime
      };
    });
  }

// Обработка команды /start
bot.start(async (ctx) => {
  const medicines = await getMedicinesFromNotion();
  console.log("Medicines from Notion:", medicines); // Логирование для отладки

  if (medicines.length > 0) {
    medicines.forEach(medicine => {
      if (medicine.nextReminderTime) {
        ctx.reply(
          `Напоминание: Пора принять ${medicine.medicineName} (${medicine.dosage}), ${medicine.timesPerDay} раз(а) в день в ${medicine.nextReminderTime.toLocaleTimeString()}.`,
          Markup.inlineKeyboard([
            Markup.button.callback('Принял', `accept_medicine_${medicine.id}`)
          ])
        );
      } else {
        ctx.reply(`Для лекарства ${medicine.medicineName} время следующего приёма не установлено или некорректно.`);
      }
    });
  } else {
    ctx.reply('На данный момент лекарства не найдены.');
  }
});

// Обработка нажатия кнопки "Принял"
bot.action(/accept_medicine_(.*)/, (ctx) => {
  const medicineId = ctx.match[1];
  ctx.reply('Спасибо! Ваш приём лекарства зарегистрирован.');

  // Здесь можно добавить логику для обновления записи в Notion
});

// Запуск бота
bot.launch();

// Обработка graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));