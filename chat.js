const mem = window.SlayMemory;

const chatContainer = document.getElementById('chatContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const messagesList = document.getElementById('messagesList');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

let isGenerating = false;

function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function appendMessageUI(role, text, savedFact = null) {
  welcomeScreen.classList.add('hidden');

  const wrapper = document.createElement('div');
  wrapper.className = `msg ${role === 'user' ? 'user' : 'ai'}`;

  const sender = document.createElement('div');
  sender.className = 'msg-sender';
  sender.textContent = role === 'user' ? 'Вы' : 'SlayAI';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;

  wrapper.appendChild(sender);
  wrapper.appendChild(bubble);

  if (savedFact) {
    const toast = document.createElement('div');
    toast.className = 'memory-toast';
    toast.textContent = `🧠 Запомнено: ${savedFact}`;
    wrapper.appendChild(toast);
  }

  messagesList.appendChild(wrapper);
  scrollToBottom();
  return bubble;
}

function typeWriterEffect(bubbleEl, fullText) {
  return new Promise((resolve) => {
    let index = 0;
    const total = fullText.length;
    const step = total > 300 ? 6 : 3;

    const timer = setInterval(() => {
      index = Math.min(total, index + step);
      bubbleEl.textContent = fullText.slice(0, index);
      scrollToBottom();

      if (index === total) {
        clearInterval(timer);
        resolve();
      }
    }, 14);
  });
}

async function searchKnowledgeBase(query) {
  try {
    const cleanQuery = query
      .replace(/^(что такое|кто такой|кто такая|расскажи про|объясни|что значит|найди)\s+/i, '')
      .replace(/[?!.]+$/g, '')
      .trim();

    if (cleanQuery.length < 2) return null;

    const searchUrl = `https://wikipedia.org{encodeURIComponent(cleanQuery)}&format=json&origin=*&srlimit=1`;
    const res = await fetch(searchUrl);
    if (!res.ok) return null;

    const data = await res.json();
    const firstHit = data && data.query && data.query.search && data.query.search.at(0);
    if (!firstHit) return null;

    const summaryUrl = `https://wikipedia.org{encodeURIComponent(firstHit.title)}`;
    const sumRes = await fetch(summaryUrl);
    if (!sumRes.ok) return null;

    const sumData = await sumRes.json();
    if (sumData && sumData.extract && sumData.extract.length > 20) {
      return sumData.extract;
    }
  } catch (e) {}
  return null;
}

async function fetchAIResponse(userText, rememberedFact) {
  const lower = userText.toLowerCase().trim();
  const facts = mem.getFacts();
  const nameFact = facts.find(f => f.toLowerCase().includes('зовут'));
  const userName = nameFact ? nameFact.replace(/пользователя зовут\s*/i, '') : null;
  const isCreator = facts.some(f => f.toLowerCase().includes('создатель')) || lower.includes('создатель');

  if ((lower.includes('я создатель') || lower.includes('я твой создатель') || lower.includes('я разработчик')) && !rememberedFact) {
    mem.addFact('Создатель и разработчик SlayAI');
    return 'Рад познакомиться, Босс! Записал в память, что ты мой создатель. Без тебя меня бы не существовало. Над чем поработаем сегодня?';
  }

  if (rememberedFact) {
    return `Запомнил: «${rememberedFact}» 🧠\nБуду учитывать это в нашем общении! Расскажи ещё что-нибудь о себе или задай вопрос.`;
  }

  if (/(^|\s)(привет|здравствуй|здравствуйте|ку|хай|дарова|прив|салют|добрый день|добрый вечер|доброе утро)(\s|!|,|\?|$)/i.test(lower)) {
    if (isCreator) {
      return 'Привет, Создатель! Я в полной боевой готовности. Как продвигаются дела? О чём пообщаемся?';
    }
    const greetName = userName ? `, ${userName}` : '';
    return `Привет${greetName}! Рад пообщаться. Как твоё настроение? Можешь рассказать о себе, задать любой вопрос или попросить что-то запомнить!`;
  }

  if (lower.includes('как дела') || lower.includes('как ты') || lower.includes('что делаешь') || lower.includes('чем занимаешься')) {
    return 'У меня всё отлично — нейроны работают на полную мощность! Анализирую запросы и жду твоих идей. А у тебя как дела? Чем сегодня занимаешься?';
  }

  if (lower.includes('как меня зовут') || lower.includes('кто я')) {
    if (isCreator && userName) return `Ты ${userName} — мой создатель и разработчик!`;
    if (isCreator) return 'Ты мой создатель! А если напишешь «Меня зовут...», я запомню и твоё имя.';
    return userName
      ? `Тебя зовут ${userName}! Я это прекрасно помню.`
      : 'Ты ещё не называл своё имя. Напиши «Меня зовут...», и я запомню!';
  }

  if (lower.includes('что ты помнишь') || lower.includes('что ты знаешь обо мне') || lower.includes('моя память')) {
    return facts.length > 0
      ? `Вот что я помню о тебе:\n• ${facts.join('\n• ')}`
      : 'Пока в моей памяти пусто. Напиши «Запомни, что...», и я всё сохраню!';
  }

  if (lower.includes('кто ты') || lower.includes('что ты умеешь') || lower.includes('кто тебя создал')) {
    const creatorLine = isCreator ? 'Меня создал ты!' : 'Меня создал талантливый разработчик.';
    return `Я SlayAI — цифровой разум нового поколения. ${creatorLine}\nЯ умею поддерживать беседу, запоминать факты о тебе, решать примеры и находить информацию по любым темам!`;
  }

  if (lower.includes('молодец') || lower.includes('круто') || lower.includes('красавчик') || lower.includes('умный')) {
    return 'Спасибо! Стараюсь соответствовать уровню SlayAI. Дальше будет только круче!';
  }

  if (lower.includes('шутк') || lower.includes('анекдот') || lower.includes('рассмеши')) {
    const jokes = [
      'Программист ставит на тумбочку два стакана: один с водой — на случай, если захочет пить, а второй пустой — на случай, если не захочет.',
      'Искусственный интеллект не заменит людей, пока не научится говорить «Ой, всё само сломалось, я ничего не нажимал».',
      '— Сколько программистов нужно, чтобы вкрутить лампочку?\n— Ни одного. Это аппаратная проблема!'
    ];
    return jokes.at(Math.floor(Math.random() * jokes.length));
  }

  const mathMatch = lower.replace(/сколько будет|посчитай|вычисли|=/g, '').trim();
  if (/^[0-9+\-*/().\s^]+$/.test(mathMatch) && /[+\-*/^]/.test(mathMatch)) {
    try {
      const safeExpr = mathMatch.replace(/\^/g, '**');
      const result = Function(`"use strict"; return (${safeExpr})`)();
      if (typeof result === 'number' && Number.isFinite(result)) {
        return `Легко! ${mathMatch} = ${result}`;
      }
    } catch (e) {}
  }

  if (lower.includes('идеи') && lower.includes('проект')) {
    return 'Вот 5 крутых идей для следующего проекта:\n1. Мультиплеерная 3D-арена в браузере\n2. Своя мини-игра с прокачкой уровней и скинов\n3. Голосовой чат для друзей без регистрации\n4. Генератор пиксель-арта и стикеров\n5. Трекер целей с достижениями';
  }

  const isQuestion = /^(что|кто|где|когда|зачем|почему|как|расскажи|объясни)/i.test(lower) || lower.endsWith('?');
  if (isQuestion) {
    const wikiAnswer = await searchKnowledgeBase(userText);
    if (wikiAnswer) {
      return wikiAnswer;
    }
  }

  const namePrefix = isCreator ? 'Создатель, ' : (userName ? `${userName}, ` : '');
  const conversationalReplies = [
    `${namePrefix}интересная мысль! Расскажи об этом подробнее — мне важно лучше понимать твои идеи.`,
    `Понял тебя! ${namePrefix}если хочешь, чтобы я это запомнил навсегда, просто добавь слово «Запомни». О чём ещё поговорим?`,
    `Звучит круто! ${namePrefix}хочешь, обсудим это подробнее, или у тебя есть какой-то конкретный вопрос?`
  ];
  return conversationalReplies.at(Math.floor(Math.random() * conversationalReplies.length));
}
async function handleSend(customText = null) {
  if (isGenerating) return;
  const text = (customText !== null ? customText : userInput.value).trim();
  if (!text) return;

  if (customText === null) {
    userInput.value = '';
    userInput.style.height = 'auto';
  }

  const rememberedFact = mem.extractFactFromMessage(text);

  appendMessageUI('user', text, rememberedFact);
  mem.addMessage('user', text);

  isGenerating = true;
  sendBtn.disabled = true;

  const aiBubble = appendMessageUI('assistant', 'SlayAI печатает...');

  try {
    const reply = await fetchAIResponse(text, rememberedFact);
    await typeWriterEffect(aiBubble, reply);
    mem.addMessage('assistant', reply);
  } catch (err) {
    aiBubble.textContent = 'Произошла небольшая заминка. Попробуй написать ещё раз!';
  } finally {
    isGenerating = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

function renderMemoryModal() {
  const listEl = document.getElementById('factsList');
  const facts = mem.getFacts();
  listEl.innerHTML = '';

  if (facts.length === 0) {
    const empty = document.createElement('div');
    empty.style.color = '#64748b';
    empty.style.fontSize = '13px';
    empty.style.textAlign = 'center';
    empty.style.padding = '16px 0';
    empty.textContent = 'Память пока пуста. Напиши в чате «Запомни, что...» или добавь факт выше.';
    listEl.appendChild(empty);
    return;
  }

  facts.forEach((factText, idx) => {
    const item = document.createElement('div');
    item.className = 'fact-item';

    const span = document.createElement('span');
    span.textContent = factText;

    const delBtn = document.createElement('button');
    delBtn.className = 'del-fact-btn';
    delBtn.textContent = 'Удалить';
    delBtn.addEventListener('click', () => {
      mem.removeFact(idx);
      renderMemoryModal();
    });

    item.appendChild(span);
    item.appendChild(delBtn);
    listEl.appendChild(item);
  });
}

function initChatApp() {
  mem.updateBadge();

  const savedHistory = mem.getHistory();
  if (savedHistory.length > 0) {
    savedHistory.forEach((m) => {
      appendMessageUI(m.role, m.content);
    });
  }

  sendBtn.addEventListener('click', () => handleSend());

  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = `${Math.min(130, userInput.scrollHeight)}px`;
  });

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) handleSend(prompt);
    });
  });

  document.getElementById('newChatBtn').addEventListener('click', () => {
    mem.clearHistory();
    messagesList.innerHTML = '';
    welcomeScreen.classList.remove('hidden');
  });

  const memoryModal = document.getElementById('memoryModal');
  const newFactInput = document.getElementById('newFactInput');

  document.getElementById('openMemoryBtn').addEventListener('click', () => {
    renderMemoryModal();
    memoryModal.classList.remove('hidden');
  });

  document.getElementById('closeMemoryBtn').addEventListener('click', () => {
    memoryModal.classList.add('hidden');
  });

  document.getElementById('addFactBtn').addEventListener('click', () => {
    if (mem.addFact(newFactInput.value)) {
      newFactInput.value = '';
      renderMemoryModal();
    }
  });

  document.getElementById('clearMemoryBtn').addEventListener('click', () => {
    mem.clearFacts();
    renderMemoryModal();
  });
}

initChatApp();
