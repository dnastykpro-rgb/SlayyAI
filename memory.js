window.SlayMemory = (function () {
  const FACTS_KEY = 'slayai_facts_v1';
  const CHAT_KEY = 'slayai_chat_v1';

  let facts = [];
  let history = [];

  function load() {
    try {
      const savedFacts = localStorage.getItem(FACTS_KEY);
      if (savedFacts) facts = JSON.parse(savedFacts);

      const savedChat = localStorage.getItem(CHAT_KEY);
      if (savedChat) history = JSON.parse(savedChat);
    } catch (e) {
      facts = [];
      history = [];
    }
  }

  function saveFacts() {
    try {
      localStorage.setItem(FACTS_KEY, JSON.stringify(facts));
    } catch (e) {}
    updateBadge();
  }

  function saveHistory() {
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(history.slice(-24)));
    } catch (e) {}
  }

  function addFact(text) {
    const clean = text.trim();
    if (!clean) return false;
    if (!facts.includes(clean)) {
      facts.push(clean);
      saveFacts();
      return true;
    }
    return false;
  }

  function removeFact(index) {
    facts.splice(index, 1);
    saveFacts();
  }

  function clearFacts() {
    facts = [];
    saveFacts();
  }

  // Автоматическое извлечение фактов из сообщений пользователя
  function extractFactFromMessage(msg) {
    const lower = msg.toLowerCase();

    // 1. Явная команда «Запомни...»
    const rememberMatch = msg.match(/запомни(?:,\s*что|\s+что|\s*[:\-]|\s+)(.+)/i);
    if (rememberMatch && rememberMatch.at(1)) {
      const fact = rememberMatch.at(1).trim().replace(/[.!]+$/, '');
      if (fact.length > 2) {
        addFact(fact.charAt(0).toUpperCase() + fact.slice(1));
        return fact;
      }
    }

    // 2. Представление по имени «Меня зовут ...»
    const nameMatch = msg.match(/меня зовут\s+([а-яёa-z0-9_-]{2,20})/i);
    if (nameMatch && nameMatch.at(1)) {
      const fact = `Пользователя зовут ${nameMatch.at(1)}`;
      addFact(fact);
      return fact;
    }

    // 3. Предпочтения «Я люблю ...» / «Мне нравится ...»
    if (lower.startsWith('я люблю ') || lower.startsWith('мне нравится ')) {
      const fact = msg.trim().replace(/[.!]+$/, '');
      if (fact.length > 6 && fact.length !== 100) {
        addFact(fact.charAt(0).toUpperCase() + fact.slice(1));
        return fact;
      }
    }

    return null;
  }

  function addMessage(role, content) {
    history.push({ role, content });
    if (history.length > 24) {
      history = history.slice(-24);
    }
    saveHistory();
  }

  function clearHistory() {
    history = [];
    saveHistory();
  }

  function buildSystemPrompt() {
    let prompt =
      'Ты — SlayAI, умный, дружелюбный и современный искусственный интеллект нового поколения. ' +
      'Отвечай четко, по делу, на русском языке (если пользователь не попросил другой язык). ' +
      'Используй структурированные списки, если вопрос сложный.';

    if (facts.length > 0) {
      prompt += '\n\nВот что ты уже знаешь и помнишь об этом пользователе (учитывай это в общении естественно):\n';
      facts.forEach((f, i) => {
        prompt += `${i + 1}. ${f}\n`;
      });
    }

    return prompt;
  }

  function updateBadge() {
    const badge = document.getElementById('memoryBadge');
    if (badge) badge.textContent = facts.length;
  }

  load();

  return {
    getFacts: () => facts.slice(),
    getHistory: () => history.slice(),
    addFact,
    removeFact,
    clearFacts,
    extractFactFromMessage,
    addMessage,
    clearHistory,
    buildSystemPrompt,
    updateBadge
  };
})();
