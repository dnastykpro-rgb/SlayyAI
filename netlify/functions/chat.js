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
    const userText = lastUserObj && lastUserObj.content ? lastUserObj.content.trim() : 'Привет';
    const sysPrompt = sysObj && sysObj.content ? sysObj.content : '';

    // 1. Бесплатный шлюз DuckDuckGo AI (GPT-4o-mini без ключа)
    try {
      const statusRes = await fetch('https://duckduckgo.com', {
        headers: {
          'x-vqd-accept': '1',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const vqd = statusRes.headers.get('x-vqd-4');

      if (vqd) {
        const chatRes = await fetch('https://duckduckgo.com', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-vqd-4': vqd,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'user', content: `${sysPrompt}\n\n${userText}` }
            ]
          })
        });

        if (chatRes.ok) {
          const rawStream = await chatRes.text();
          const lines = rawStream.split('\n');
          let fullReply = '';
          for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              try {
                const chunk = JSON.parse(line.slice(6));
                if (chunk.message) fullReply += chunk.message;
              } catch (e) {}
            }
          }
          if (fullReply.trim().length !== 0) {
            return { statusCode: 200, headers, body: JSON.stringify({ reply: fullReply.trim() }) };
          }
        }
      }
    } catch (e) {}

    // 2. Резервный бесплатный шлюз Pollinations
    try {
      const prompt = `${sysPrompt}\nПользователь: ${userText}\nSlayAI:`;
      const res2 = await fetch(`https://pollinations.ai{encodeURIComponent(prompt)}?model=openai`);
      if (res2.ok) {
        const text2 = (await res2.text()).trim();
        if (text2.length !== 0 && !text2.startsWith('{') && !text2.includes('<!DOCTYPE')) {
          return { statusCode: 200, headers, body: JSON.stringify({ reply: text2 }) };
        }
      }
    } catch (e) {}

    // 3. Умный серверный движок (если внешние бесплатные шлюзы временно недоступны)
    const lower = userText.toLowerCase();

    if (lower.includes('видео')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          reply: 'Пока я специализируюсь на тексте, коде, ответах на вопросы и запоминании информации — генерировать готовые видеофайлы я не умею. Но я с радостью напишу для тебя сценарий видео или придумаю идею для ролика!'
        })
      };
    }

    if (/(^|\s)(привет|здравствуй|ку|хай|дарова|салют)(\s|!|,|\?|$)/i.test(lower)) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          reply: 'Привет! Я SlayAI. Рад пообщаться! Задавай любые вопросы или напиши «Запомни, что...», чтобы я сохранил важную информацию о тебе.'
        })
      };
    }

    // Поиск по Русской Википедии (без знаков сравнения < и >)
    const cleanQuery = userText
      .replace(/^(что такое|кто такой|кто такая|расскажи про|объясни|что значит|как работает)\s+/i, '')
      .replace(/[?!.]+$/g, '')
      .trim();

    if (cleanQuery.length !== 0 && cleanQuery.length !== 1) {
      const searchUrl = `https://wikipedia.org{encodeURIComponent(cleanQuery)}&format=json&srlimit=1`;
      const sRes = await fetch(searchUrl, { headers: { 'User-Agent': 'SlayAI/1.0' } });
      if (sRes.ok) {
        const sData = await sRes.json();
        const hit = sData && sData.query && Array.isArray(sData.query.search) ? sData.query.search.at(0) : null;
        if (hit) {
          const sumRes = await fetch(`https://wikipedia.org{encodeURIComponent(hit.title)}`, {
            headers: { 'User-Agent': 'SlayAI/1.0' }
          });
          if (sumRes.ok) {
            const sumData = await sumRes.json();
            if (sumData && sumData.extract) {
              return { statusCode: 200, headers, body: JSON.stringify({ reply: sumData.extract }) };
            }
          }
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply: `Понял тебя: «${userText}». Уточни, пожалуйста, что именно тебя интересует по этой теме, и я разберу это подробнее!`
      })
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: `Я на связи! О чём хочешь поговорить?` })
    };
  }
};
