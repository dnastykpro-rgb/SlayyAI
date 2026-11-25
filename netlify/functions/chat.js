exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const parsed = JSON.parse(event.body || '{}');
    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    const lastUserObj = messages.at(-1);
    const sysObj = messages.at(0);
    const lastUserMsg = lastUserObj && lastUserObj.content ? lastUserObj.content : 'Привет';
    const sysPrompt = sysObj && sysObj.content ? sysObj.content : '';

    // Канал 1: OpenAI-совместимый запрос
    try {
      const res1 = await fetch('https://pollinations.ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SlayAI/1.0'
        },
        body: JSON.stringify({
          model: 'openai',
          messages: messages,
          temperature: 0.7
        })
      });

      if (res1.ok) {
        const data = await res1.json();
        const firstChoice = data && Array.isArray(data.choices) ? data.choices.at(0) : null;
        const reply = firstChoice && firstChoice.message ? firstChoice.message.content : null;
        if (reply && reply.trim().length !== 0) {
          return { statusCode: 200, headers, body: JSON.stringify({ reply: reply.trim() }) };
        }
      }
    } catch (e) {}

    // Канал 2: Текстовый GET-запрос с контекстом
    try {
      const prompt = `${sysPrompt}\nПользователь: ${lastUserMsg}\nSlayAI:`;
      const res2 = await fetch(`https://pollinations.ai{encodeURIComponent(prompt)}?model=mistral`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (res2.ok) {
        const text2 = (await res2.text()).trim();
        if (text2.length !== 0 && !text2.startsWith('{')) {
          return { statusCode: 200, headers, body: JSON.stringify({ reply: text2 }) };
        }
      }
    } catch (e) {}

    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'Внешний ИИ-шлюз не ответил' })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Ошибка функции', message: err.message })
    };
  }
};
