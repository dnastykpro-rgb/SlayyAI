export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages } = req.body;

    // 1. Основной канал с серверов Vercel (OpenAI-совместимый шлюз без ключа)
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
      const reply = data.choices && data.choices.at(0) && data.choices.at(0).message
        ? data.choices.at(0).message.content
        : null;

      if (reply && reply.trim().length > 1) {
        return res.status(200).json({ reply: reply.trim() });
      }
    }

    // 2. Резервный канал на случай высокой нагрузки
    const lastUserMsg = messages.at(-1)?.content || 'Привет';
    const sysPrompt = messages.at(0)?.content || '';
    const prompt = `${sysPrompt}\nПользователь: ${lastUserMsg}\nSlayAI:`;

    const fallbackRes = await fetch(`https://pollinations.ai{encodeURIComponent(prompt)}?model=openai`);
    if (fallbackRes.ok) {
      const fallbackText = (await fallbackRes.text()).trim();
      if (fallbackText.length > 1) {
        return res.status(200).json({ reply: fallbackText });
      }
    }

    return res.status(502).json({ error: 'Шлюз временно занят' });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка сервера', message: err.message });
  }
}
