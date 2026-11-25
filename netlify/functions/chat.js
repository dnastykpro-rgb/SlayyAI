exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const parsed = JSON.parse(event.body || '{}');
    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];

    // 1. Основной канал с серверов Netlify
    const response = await fetch('https://pollinations.ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: messages,
        temperature: 0.7
      })
    });

    if (response.ok) {
      const data = await response.json();
      const firstChoice = data && Array.isArray(data.choices) ? data.choices.at(0) : null;
      const reply = firstChoice && firstChoice.message ? firstChoice.message.content : null;

      if (reply && reply.trim().length !== 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ reply: reply.trim() })
        };
      }
    }

    // 2. Резервный канал на случай высокой нагрузки
    const lastUserObj = messages.at(-1);
    const sysObj = messages.at(0);
    const lastUserMsg = lastUserObj && lastUserObj.content ? lastUserObj.content : 'Привет';
    const sysPrompt = sysObj && sysObj.content ? sysObj.content : '';
    const prompt = `${sysPrompt}\nПользователь: ${lastUserMsg}\nSlayAI:`;

    const fallbackRes = await fetch(`https://pollinations.ai{encodeURIComponent(prompt)}?model=openai`);
    if (fallbackRes.ok) {
      const fallbackText = (await fallbackRes.text()).trim();
      if (fallbackText.length !== 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ reply: fallbackText })
        };
      }
    }

    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'Шлюз временно занят' })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Ошибка сервера', message: err.message })
    };
  }
};
