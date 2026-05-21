export default async function handler(req, res) {
  // Hanya izinkan method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Ambil pesan dari body request (sudah termasuk system prompt dari frontend)
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages required' });
  }

  // Ambil API key dari environment variable Vercel
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'DeepSeek API key not configured' });
  }

  // Tidak perlu menambahkan system prompt lagi karena frontend sudah mengirimnya
  // sesuai bahasa pilihan (ID atau EN). Langsung gunakan messages dari request.
  const finalMessages = messages;

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',   // Model terbaru, cepat dan hemat
        messages: finalMessages,
        temperature: 0.2,             // Konsisten, tidak kreatif
        max_tokens: 1024
      })
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