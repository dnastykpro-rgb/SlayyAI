const mem = window.SlayMemory;

const chatContainer = document.getElementById('chatContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const messagesList = document.getElementById('messagesList');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

let isGenerating = false;
let llmPipeline = null;
let modelStatusText = 'Ожидание...';

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

// Фоновая загрузка настоящей языковой нейросети в браузер
async function initNeuralEngine() {
  const subtitleEl = document.querySelector('.subtitle');
  try {
    const transformers = await import('https://jsdelivr.net');
    transformers.env.allowLocalModels = false;
    transformers.env.remoteHost = 'https://hf-mirror.com';

    llmPipeline = await transformers.pipeline(
      'text2text-generation',
      'Xenova/LaMini-Flan-T5-248M',
      {
        progress_callback: (p) => {
          if (p.status === 'progress' && p.progress && subtitleEl) {
            const pct = Math.round(p.progress);
            modelStatusText = `Загрузка нейросети: ${pct}%`;
            subtitleEl.textContent = modelStatusText;
          }
        }
      }
    );
    if (subtitleEl) subtitleEl.textContent = 'Нейросеть активна • Готов к диалогу';
  } catch (err) {
    console.warn('Переход в гибридный режим:', err);
    if (subtitleEl) subtitleEl.textContent = 'Цифровой разум нового поколения';
  }
}

// Поиск справки в Википедии по ключевым словам
async function searchWiki(query) {
  try {
    const clean = query
      .replace(/^(что такое|кто такой|кто такая|расскажи про|объясни|что значит|как работает|почему)\s+/i, '')
      .replace(/[?!.]+$/g, '')
      .trim();
    if (clean.length < 3) return null;

    const url = `https://wikipedia.org{encodeURIComponent(clean)}&format=json&origin=*&srlimit=1`;
    const res = await fetch(url);
    const data = await res.json();
    const hit = data && data.query && data.query.search && data.query.search.at(0);
    if (!hit) return null;

    const sumRes = await fetch(`https://wikipedia.org{encodeURIComponent(hit.title)}`);
    const sumData = await sumRes.json();
    return sumData && sumData.extract ? sumData.extract : null;
  } catch (e) {
    return null;
  }
}

async function generateSmartReply(userText, rememberedFact) {
  const lower = userText.toLowerCase().trim();
  const facts = mem.getFacts();

  // Обработка просьбы общаться проще / без «создателя»
  if (lower.includes('без создатель') || lower.includes('на ты')) {
    mem.addFact('Общаться на «ты», просто и дружелюбно, без слова «Создатель»');
    return 'Договорились! Буду общаться с тобой просто на «ты» и без официоза. О чём поговорим?';
  }

  if (rememberedFact) {
    return `Запомнил: «${rememberedFact}». Учту это в нашем разговоре!`;
  }

  // Если загружена настоящая нейросеть — генерируем живой ответ через неё
  if (llmPipeline) {
    const context = facts.length > 0 ? `Facts about user: ${facts.join('. ')}. ` : '';
    const prompt = `${context}User asks: ${userText}. Give a helpful, friendly answer:`;
    const out = await llmPipeline(prompt, { max_new_tokens: 160, temperature: 0.7 });
    if (out && out.at(0) && out.at(0).generated_text) {
      return out.at(0).generated_text.trim();
    }
  }

  // Прямые осмысленные ответы на частые вопросы (пока нейросеть догружается)
  if (lower.includes('видео')) {
    return 'Пока я работаю с текстом, логикой и памятью — генерировать видеофайлы напрямую в браузере я не умею. Но я могу написать подробный сценарий для ролика, придумать идею для TikTok или помочь с кодом!';
  }
  if (lower.includes('картинк') || lower.includes('фото') || lower.includes('рису')) {
    return 'Генерация картинок сейчас отключена, но я могу подробно описать идею для арта или помочь с любым текстовым вопросом!';
  }
  if (lower.includes('как меня зовут') || lower.includes('что ты помнишь')) {
    return facts.length > 0
      ? `Вот что я помню о тебе:\n• ${facts.join('\n• ')}`
      : 'В моей памяти пока пусто. Напиши «Меня зовут...» или «Запомни, что...»!';
  }

  // Поиск ответа в базе знаний по сути вопроса
  const wiki = await searchWiki(userText);
  if (wiki) return wiki;

  return `Я ещё подгружаю языковую модель в память браузера (${modelStatusText}), поэтому пока могу отвечать на базовые вопросы, считать примеры и искать информацию по терминам. Попробуй спросить «Что такое нейросеть?» или подожди 10 секунд!`;
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
    const reply = await generateSmartReply(text, rememberedFact);
    aiBubble.textContent = reply;
    mem.addMessage('assistant', reply);
    scrollToBottom();
  } catch (err) {
    aiBubble.textContent = 'Не удалось обработать запрос. Попробуй написать ещё раз!';
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
  initNeuralEngine();

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
