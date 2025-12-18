const TelegramBot = require('node-telegram-bot-api');
const http = require('http');

// 1. Мини-сервер для Render, чтобы он не отключал бота
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('IZIPAY Bot is running\n');
});

// Слушаем порт, который дает Render, или 3000 по умолчанию
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

// 2. Настройка самого бота
const token = '8383398356:AAEgAuC_P3yuKy8ohR3up93E19MPaV_lzFU';
const bot = new TelegramBot(token, {polling: true});
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

console.log('Бот успешно запущен и сервер активен!');
