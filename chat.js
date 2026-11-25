const mem = window.SlayMemory;

const chatContainer = document.getElementById('chatContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const messagesList = document.getElementById('messagesList');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

let isGenerating = false;
let localGenerator = null;
let isModelLoading = false;

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

// Загрузка ядра SlayAI с открытого зеркала (без блокировок и API-ключей)
async function getLocalModel(statusBubble) {
  if (localGenerator) return localGenerator;
  if (isModelLoading) return null;

  isModelLoading = true;
  try {
    const { pipeline, env } = await import('https://jsdelivr.net');
    env.allowLocalModels = false;
    env.remoteHost = 'https://hf-mirror.com';

    localGenerator = await pipeline(
      'text-generation',
      'onnx-community/Qwen2.5-0.5B-Instruct',
      {
        dtype: 'q4',
        progress_callback: (info) => {
          if (info.status === 'progress' && info.progress && statusBubble) {
            const pct = Math.round(info.progress);
            statusBubble.textContent = `⚡ Подключение ядра SlayAI: ${pct}%...`;
            scrollToBottom();
          }
        }
      }
    );
    return localGenerator;
  } finally {
    isModelLoading = false;
  }
}

async function fetchAIResponse(userText, statusBubble) {
  const generator = await getLocalModel(statusBubble);
  if (!generator) {
    return 'Ядро SlayAI ещё загружается, подожди пару секунд и повтори запрос.';
  }

  statusBubble.textContent = 'SlayAI формулирует ответ...';

  const messages = [
    { role: 'system', content: mem.buildSystemPrompt() },
    ...mem.getHistory().slice(-10)
  ];

  const output = await generator(messages, {
    max_new_tokens: 320,
    temperature: 0.7,
    do_sample: true
  });

  const generated = output && output.at(0) && output.at(0).generated_text;
  if (Array.isArray(generated)) {
    const lastMsg = generated.at(-1);
    if (lastMsg && lastMsg.content) return lastMsg.content.trim();
  }
  return 'Готово! Чем ещё могу помочь?';
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

  const aiBubble = appendMessageUI('assistant', 'Подготовка ядра SlayAI...');

  try {
    const reply = await fetchAIResponse(text, aiBubble);
    aiBubble.textContent = reply;
    mem.addMessage('assistant', reply);
    scrollToBottom();
  } catch (err) {
    aiBubble.textContent = '⚠️ Ошибка загрузки ядра. Проверь соединение с интернетом и обнови страницу.';
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
