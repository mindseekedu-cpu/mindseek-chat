// =========================================================
// MindSeek.edu - API Chat (CommonJS version for Vercel)
// =========================================================

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Import prompts dari folder lib
const { SYSTEM_PROMPT_ID, SYSTEM_PROMPT_EN } = require('../lib/prompts');

// Helper function retry
async function fetchWithRetry(url, options, maxRetries = 3, initialDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status !== 429 && response.status !== 503) return response;
      if (attempt === maxRetries) return response;
      const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), 10000) * (0.8 + Math.random() * 0.4);
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

// Handler utama (CommonJS style)
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, language } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages required' });
  }

  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'DeepSeek API key not configured' });
  }

  // Pilih prompt berdasarkan language
  let systemPrompt = SYSTEM_PROMPT_ID;
  if (language === 'en') {
    systemPrompt = SYSTEM_PROMPT_EN;
  }

  const finalMessages = [{ role: 'system', content: systemPrompt }, ...messages];

  const requestBody = {
    model: 'deepseek-v4-flash',  // gunakan flash, lebih murah & cepat
    messages: finalMessages,
    temperature: 0.2,
    max_tokens: 1024
  };

  try {
    const response = await fetchWithRetry('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('DeepSeek API error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'DeepSeek error' });
    }

    const aiReply = data.choices?.[0]?.message?.content || (systemPrompt === SYSTEM_PROMPT_ID ? 'Maaf, Ai Mi tidak bisa menjawab.' : 'Sorry, Ai Mi cannot answer.');
    return res.status(200).json({ reply: aiReply });
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};