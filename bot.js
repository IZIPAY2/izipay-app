const TelegramBot = require('node-telegram-bot-api');

// Токен от @BotFather
const token = '8383398356:AAEgAuC_P3yuKy8ohR3up93E19MPaV_lzFU; 
const bot = new TelegramBot(token, {polling: true});

// Ссылка на твой Mini App
const webAppUrl = 'https://izipay2.github.io/izipay-app/';

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Добро пожаловать в IZIPAY! Нажмите кнопку ниже, чтобы открыть кошелек.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Открыть кошелек', web_app: { url: webAppUrl } }]
      ]
    }
  });
});

console.log('Бот запущен...');
