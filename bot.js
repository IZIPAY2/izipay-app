const TelegramBot = require('node-telegram-bot-api');
const http = require('http');

// 1. Мини-сервер для Render (чтобы статус был Live и бот не отключался)
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('IZIPAY Bot is running\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

// 2. Настройка бота
const token = '8383398356:AAEgAuC_P3yuKy8ohR3up93E19MPaV_lzFU';
const bot = new TelegramBot(token, {polling: true});
const webAppUrl = 'https://izipay2.github.io/izipay-app/';

// !!! ВАЖНО: Замени 'ТВОЙ_ID' на свой числовой ID из Telegram !!!
// Его можно узнать у бота @userinfobot
const adminId = '7897252945'; 

// Ответ на команду /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Добро пожаловать в IZIPAY! Нажмите кнопку ниже, чтобы открыть кошелек.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Открыть кошелек', web_app: { url: webAppUrl } }]
      ]
    }
  });
});

// 3. Слушаем данные от Mini App (когда юзер жмет "New Card")
bot.on('web_app_data', (msg) => {
  try {
    const data = JSON.parse(msg.web_app_data.data);
    
    if (data.action === "new_card_request") {
      // Это сообщение придет ТЕБЕ в личку от бота
      const text = `🔔 **НОВАЯ ЗАЯВКА НА КАРТУ**\n\n` +
                   `👤 Имя: ${data.name}\n` +
                   `🆔 ID: ${data.id}\n` +
                   `📍 Проверь Firebase для одобрения!`;
      
      bot.sendMessage(adminId, text, { parse_mode: 'Markdown' });
    }
  } catch (e) {
    console.error('Ошибка обработки данных WebApp:', e);
  }
});

// Обработка ошибок, чтобы бот не падал
bot.on('polling_error', (error) => {
  if (error.code !== 'ETELEGRAM' || !error.message.includes('409 Conflict')) {
    console.error('Ошибка логов:', error.message);
  }
});

console.log('Бот успешно запущен и готов к работе!');
