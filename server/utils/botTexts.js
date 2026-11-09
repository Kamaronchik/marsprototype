// Everything the bot says, in the three languages of the school. {{name}} marks a value filled in later.
const TEXTS = {
  ru: {
    chooseLanguage: 'Выберите язык. Его можно поменять командой /language.',
    welcome: 'Привет, {{name}}! Я помощник Mars Space. Спросите меня о своих занятиях и посещаемости или нажмите кнопку ниже.',
    notLinked: 'Чтобы начать, откройте сайт Mars Space, зайдите в профиль и нажмите «Подключить Telegram».',
    tokenInvalid: 'Ссылка недействительна или устарела. Создайте новую на сайте в профиле.',
    chatTaken: 'Этот Telegram уже подключён к другому аккаунту.',
    linked: 'Готово, аккаунт {{name}} подключён.',
    btnCoins: 'Показать коины',
    btnAttendance: 'Моя посещаемость',
    btnNext: 'Следующий урок',
    coins: 'У вас {{coins}} коинов.',
    attendance: 'Вы были на {{present}} из {{total}} уроков ({{percent}}%).',
    attendanceNone: 'Пока нет отмеченных уроков.',
    next: 'Следующий урок: {{group}}, {{when}}, кабинет {{room}}.',
    nextNone: 'Пока нет запланированных уроков.',
    cameNotice: 'Вас отметили на уроке {{group}} ({{date}}). Спасибо, что пришли!',
    absentQuestion: 'Вас отметили отсутствующим на уроке {{group}} ({{date}}). Почему вас не было? Ответьте одним сообщением.',
    reasonSaved: 'Спасибо, причина передана администратору.',
    aiLimit: 'Лимит вопросов на сегодня исчерпан. Попробуйте завтра.',
    aiFailed: 'Сейчас не получается ответить. Попробуйте чуть позже.',
    unlinked: 'Telegram отключён от вашего аккаунта.',
    textOnly: 'Я понимаю только текстовые сообщения.',
    today: 'сегодня',
    tomorrow: 'завтра',
  },
  uz: {
    chooseLanguage: "Tilni tanlang. Uni /language buyrug'i bilan o'zgartirish mumkin.",
    welcome: "Salom, {{name}}! Men Mars Space yordamchisiman. Darslaringiz va davomatingiz haqida so'rang yoki pastdagi tugmani bosing.",
    notLinked: "Boshlash uchun Mars Space saytiga kiring, profilga o'ting va «Telegramni ulash» tugmasini bosing.",
    tokenInvalid: "Havola yaroqsiz yoki eskirgan. Saytdagi profilda yangisini yarating.",
    chatTaken: "Bu Telegram boshqa akkauntga ulangan.",
    linked: "Tayyor, {{name}} akkaunti ulandi.",
    btnCoins: "Koinlarni ko'rsatish",
    btnAttendance: 'Mening davomatim',
    btnNext: 'Keyingi dars',
    coins: "Sizda {{coins}} koin bor.",
    attendance: "Siz {{total}} ta darsdan {{present}} tasida qatnashgansiz ({{percent}}%).",
    attendanceNone: "Hozircha belgilangan darslar yo'q.",
    next: "Keyingi dars: {{group}}, {{when}}, {{room}}-xona.",
    nextNone: "Hozircha rejalashtirilgan darslar yo'q.",
    cameNotice: "Siz {{group}} darsida ({{date}}) belgilandingiz. Kelganingiz uchun rahmat!",
    absentQuestion: "Siz {{group}} darsida ({{date}}) yo'q deb belgilandingiz. Nima uchun kelmadingiz? Bitta xabar bilan javob bering.",
    reasonSaved: "Rahmat, sabab administratorga yuborildi.",
    aiLimit: "Bugungi savollar limiti tugadi. Ertaga urinib ko'ring.",
    aiFailed: "Hozir javob bera olmayapman. Birozdan keyin urinib ko'ring.",
    unlinked: "Telegram akkauntingizdan uzildi.",
    textOnly: "Men faqat matnli xabarlarni tushunaman.",
    today: 'bugun',
    tomorrow: 'ertaga',
  },
  en: {
    chooseLanguage: 'Choose your language. You can change it with /language.',
    welcome: "Hi, {{name}}! I'm the Mars Space assistant. Ask me about your lessons and attendance, or press a button below.",
    notLinked: 'To start, open the Mars Space site, go to your profile and press "Connect Telegram".',
    tokenInvalid: 'This link is invalid or has expired. Create a new one in your profile on the site.',
    chatTaken: 'This Telegram is already connected to another account.',
    linked: 'Done, the account {{name}} is connected.',
    btnCoins: 'Show coins',
    btnAttendance: 'My attendance',
    btnNext: 'Next lesson',
    coins: 'You have {{coins}} coins.',
    attendance: 'You attended {{present}} of {{total}} lessons ({{percent}}%).',
    attendanceNone: 'No marked lessons yet.',
    next: 'Next lesson: {{group}}, {{when}}, room {{room}}.',
    nextNone: 'No lessons planned yet.',
    cameNotice: 'You were marked present at {{group}} ({{date}}). Thanks for coming!',
    absentQuestion: 'You were marked absent at {{group}} ({{date}}). Why were you not there? Please answer in one message.',
    reasonSaved: 'Thank you, the reason was sent to the administrator.',
    aiLimit: "You've used today's question limit. Try again tomorrow.",
    aiFailed: "I can't answer right now. Please try a bit later.",
    unlinked: 'Telegram was disconnected from your account.',
    textOnly: 'I only understand text messages.',
    today: 'today',
    tomorrow: 'tomorrow',
  },
};

const LANGUAGES = Object.keys(TEXTS);
const LANGUAGE_NAMES = { ru: 'Русский', uz: "O'zbekcha", en: 'English' };

// Text by key in a language, with {{values}} filled in.
const say = (language, key, values = {}) => {
  const template = (TEXTS[language] ?? TEXTS.ru)[key] ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''));
};

// Which action a pressed menu button means, whatever language its label is in.
const actionOfLabel = (text) => {
  const actions = { btnCoins: 'coins', btnAttendance: 'attendance', btnNext: 'next' };
  for (const language of LANGUAGES) {
    for (const [key, action] of Object.entries(actions)) {
      if (TEXTS[language][key] === text) return action;
    }
  }
  return null;
};

const menuFor = (language) => [[say(language, 'btnCoins')], [say(language, 'btnAttendance'), say(language, 'btnNext')]];

module.exports = { LANGUAGES, LANGUAGE_NAMES, say, actionOfLabel, menuFor };
