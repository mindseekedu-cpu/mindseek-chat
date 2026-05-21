// api/chat.js
export default async function handler(req, res) {
  // Hanya terima method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Ambil messages dari frontend (sudah termasuk system prompt sesuai bahasa)
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages required' });
  }

  // API Key dari environment variable Vercel
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'DeepSeek API key not configured' });
  }

  // Fungsi untuk melakukan fetch dengan retry (exponential backoff)
  async function fetchWithRetry(url, options, maxRetries = 3, initialDelay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        // Jika status 429 (Too Many Requests) atau 503 (Service Unavailable), kita coba ulang
        if (response.status !== 429 && response.status !== 503) {
          return response;
        }
        if (attempt === maxRetries) {
          return response; // Kembalikan response error terakhir
        }
        // Exponential backoff + jitter
        const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), 10000) * (0.8 + Math.random() * 0.4);
        console.log(`Retry attempt ${attempt} after ${Math.round(delay)}ms due to status ${response.status}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (err) {
        if (attempt === maxRetries) throw err;
        const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), 10000);
        console.log(`Retry attempt ${attempt} after ${Math.round(delay)}ms due to network error: ${err.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Siapkan payload untuk DeepSeek API
  const requestBody = {
    model: 'deepseek-v4-flash',   // Model terbaru, cepat dan hemat
    messages: messages,           // Langsung dari frontend (sudah termasuk system prompt)
    temperature: 0.2,             // Konsisten, tidak kreatif (efektif untuk tutoring)
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

    const aiReply = data.choices?.[0]?.message?.content || 'Maaf, Ai Mi tidak bisa menjawab.';
    return res.status(200).json({ reply: aiReply });
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}