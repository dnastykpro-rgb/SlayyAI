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
    const step = total > 400 ? 6 : 3;

    const timer = setInterval(() => {
      index = Math.min(total, index + step);
      bubbleEl.textContent = fullText.slice(0, index);
      scrollToBottom();

      if (index === total) {
        clearInterval(timer);
        resolve();
      }
    }, 16);
  });
}

async function fetchAIResponse(userText) {
  const sysPrompt = mem.buildSystemPrompt();
  const recentHistory = mem.getHistory().slice(-8);

  let contextDialog = `Инструкция: ${sysPrompt}\n\nДиалог:\n`;
  recentHistory.forEach((m) => {
    const speaker = m.role === 'user' ? 'Пользователь' : 'SlayAI';
    contextDialog += `${speaker}: ${m.content}\n`;
  });
  contextDialog += 'SlayAI:';

  try {
    const url = `https://pollinations.ai{encodeURIComponent(contextDialog)}?model=openai&seed=${Math.floor(Math.random() * 10000)}`;
    const res = await fetch(url);
    if (res.ok) {
      const text = (await res.text()).trim();
      if (text && text.length > 1) return text;
    }
  } catch (e) {}

  try {
    const res2 = await fetch('https://pollinations.ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: sysPrompt },
          ...recentHistory
        ],
        model: 'openai'
      })
    });
    if (res2.ok) {
      const text2 = (await res2.text()).trim();
      if (text2 && text2.length > 1) return text2;
    }
  } catch (e) {}

  const facts = mem.getFacts();
  const lower = userText.toLowerCase();
  if (lower.includes('привет') || lower.includes('здравствуй')) {
    return facts.length > 0
      ? `Привет! Рад снова тебя видеть. Я помню о тебе: ${facts.join('; ')}. Чем могу помочь?`
      : 'Привет! Я SlayAI. Готов ответить на твои вопросы или запомнить важную информацию о тебе!';
  }
  if (lower.includes('как меня зовут') || lower.includes('что ты обо мне помнишь') || lower.includes('что ты знаешь')) {
    return facts.length > 0
      ? `Вот что сохранено в моей памяти о тебе:\n• ${facts.join('\n• ')}`
      : 'Пока в моей памяти нет записей о тебе. Напиши «Запомни, что...», и я всё сохраню!';
  }
  return 'Я зафиксировал твоё сообщение! Внешний облачный шлюз сейчас перегружен, но моя система памяти и диалога работает стабильно. Попробуй задать вопрос ещё раз через пару секунд.';
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

  const aiBubble = appendMessageUI('assistant', 'SlayAI думает...');

  try {
    const reply = await fetchAIResponse(text);
    await typeWriterEffect(aiBubble, reply);
    mem.addMessage('assistant', reply);
  } catch (err) {
    aiBubble.textContent = '⚠️ Не удалось получить ответ. Попробуй ещё раз.';
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
