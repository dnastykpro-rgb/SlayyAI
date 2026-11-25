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

// Создание пузыря сообщения в ленте
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

// Плавный эффект печати ответа нейросети
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

// Запрос к языковой модели с учетом истории и памяти
async function fetchAIResponse(userText) {
  const payloadMessages = [
    { role: 'system', content: mem.buildSystemPrompt() },
    ...mem.getHistory().slice(-14)
  ];

  const response = await fetch('https://pollinations.ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      messages: payloadMessages,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    throw new Error('Ошибка ответа шлюза ИИ');
  }

  const data = await response.json();
  const reply = data && data.choices && data.choices.at(0) && data.choices.at(0).message
    ? data.choices.at(0).message.content
    : null;

  return reply || 'Не удалось сформировать ответ. Попробуй переформулировать вопрос.';
}

async function handleSend(customText = null) {
  if (isGenerating) return;
  const text = (customText !== null ? customText : userInput.value).trim();
  if (!text) return;

  if (customText === null) {
    userInput.value = '';
    userInput.style.height = 'auto';
  }

  // Проверяем, нужно ли запомнить факт из фразы пользователя
  const rememberedFact = mem.extractFactFromMessage(text);

  // Отображаем и сохраняем сообщение пользователя
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
    aiBubble.textContent = '⚠️ Временный сбой связи с ядром SlayAI. Проверь интернет и нажми отправить еще раз.';
  } finally {
    isGenerating = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}
// Отрисовка списка фактов в модальном окне «Память»
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

// Инициализация событий интерфейса
function initChatApp() {
  mem.updateBadge();

  // Восстановление предыдущей переписки при открытии сайта
  const savedHistory = mem.getHistory();
  if (savedHistory.length > 0) {
    savedHistory.forEach((m) => {
      appendMessageUI(m.role, m.content);
    });
  }

  // Отправка по кнопке и по Enter (Shift+Enter — перенос строки)
  sendBtn.addEventListener('click', () => handleSend());

  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Автоматическое изменение высоты поля ввода
  userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = `${Math.min(130, userInput.scrollHeight)}px`;
  });

  // Быстрые стартовые подсказки
  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) handleSend(prompt);
    });
  });

  // Кнопка «Новый чат» (очищает ленту, но сохраняет долгосрочную память фактов!)
  document.getElementById('newChatBtn').addEventListener('click', () => {
    mem.clearHistory();
    messagesList.innerHTML = '';
    welcomeScreen.classList.remove('hidden');
  });

  // Модальное окно памяти
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
