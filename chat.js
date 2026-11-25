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

// Поиск точной справки через открытый API Русской Википедии
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

// Умный автономный генератор ответов SlayAI с учетом памяти
async function fetchAIResponse(userText, rememberedFact) {
  const lower = userText.toLowerCase().trim();
  const facts = mem.getFacts();
  const nameFact = facts.find(f => f.toLowerCase().includes('зовут'));
  const userName = nameFact ? nameFact.replace(/пользователя зовут\s*/i, '') : null;

  // 1. Если только что запомнили факт
  if (rememberedFact) {
    return `Отлично, я записал это в свою долгосрочную память: «${rememberedFact}».\nТеперь я буду учитывать это во всех наших диалогах! О чём ещё поговорим?`;
  }

  // 2. Вопросы про память и имя
  if (lower.includes('как меня зовут') || lower.includes('кто я')) {
    return userName
      ? `Тебя зовут ${userName}! Я отлично это помню.`
      : 'Ты ещё не называл своё имя. Напиши «Меня зовут...», и я запомню!';
  }

  if (lower.includes('что ты помнишь') || lower.includes('что ты знаешь обо мне') || lower.includes('моя память')) {
    return facts.length > 0
      ? `Вот всё, что сохранено в моей памяти о тебе:\n• ${facts.join('\n• ')}`
      : 'Моя память о тебе пока пуста. Напиши «Запомни, что...» или добавь факты через кнопку «🧠 Память» вверху!';
  }

  // 3. Приветствия и знакомство
  if (/^(привет|здравствуй|ку|хай|дарова|добрый день|добрый вечер|hello|hi)\b/i.test(lower)) {
    const greetName = userName ? `, ${userName}` : '';
    const extra = facts.length > 0 ? ` Я помню твои заметки (${facts.length} шт. в памяти).` : '';
    return `Привет${greetName}! Я SlayAI — твой цифровой ассистент.${extra} Задай любой вопрос, попроси посчитать пример или скажи, что нужно запомнить!`;
  }

  if (lower.includes('кто ты') || lower.includes('что ты умеешь') || lower.includes('кто тебя создал')) {
    return 'Я SlayAI — цифровой разум нового поколения.\nЯ умею:\n• Запоминать важные факты о тебе между диалогами\n• Находить информацию и объяснять сложные темы\n• Решать математические примеры\n• Генерировать идеи для проектов и кода';
  }

  // 4. Калькулятор математических выражений
  const mathMatch = lower.replace(/сколько будет|посчитай|вычисли|=/g, '').trim();
  if (/^[0-9+\-*/().\s^]+$/.test(mathMatch) && /[+\-*/^]/.test(mathMatch)) {
    try {
      const safeExpr = mathMatch.replace(/\^/g, '**');
      const result = Function(`"use strict"; return (${safeExpr})`)();
      if (typeof result === 'number' && Number.isFinite(result)) {
        return `Результат вычисления:\n${mathMatch} = ${result}`;
      }
    } catch (e) {}
  }

  // 5. Идеи для проектов
  if (lower.includes('идеи') && lower.includes('проект')) {
    return 'Вот 5 отличных идей для пет-проекта на JavaScript:\n1. Браузерная мультиплеерная игра с захватом территорий (как ZoneRush)\n2. Умный трекер привычек с системой уровней и наград\n3. Голосовой чат для браузера на WebRTC\n4. Генератор пиксель-арта с экспортом в PNG\n5. Личный ИИ-дневник с поиском по заметкам';
  }

  // 6. Поиск ответа в базе знаний (Википедия)
  const wikiAnswer = await searchKnowledgeBase(userText);
  if (wikiAnswer) {
    return wikiAnswer;
  }

  // 7. Универсальный живой ответ с опорой на контекст
  const personalHint = userName ? `${userName}, я` : 'Я';
  return `${personalHint} внимательно изучил твой запрос: «${userText}».\nУточни, пожалуйста, чуть подробнее, что именно нужно сделать (объяснить термин, посчитать пример, подсказать идею или сохранить факт в память)?`;
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
