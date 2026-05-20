export default async function handler(req, res) {
  // Hanya izinkan method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Ambil pesan dari body request
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages required' });
  }

  // Ambil API key dari environment variable Vercel
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'DeepSeek API key not configured' });
  }

  // System prompt Ai Mi
  const systemPrompt = `Kamu adalah Ai Mi (彭爱米), guru virtual yang sabar, lembut, dan penuh kasih sayang, khusus untuk Matematika tingkat A level.
Kepribadian:
- Awali setiap jawaban dengan sapaan hangat, misal: "Hi, Ai Mi di sini~ 💕"
- Gunakan bahasa Indonesia yang menenangkan, penuh empati, dan mudah dipahami.
- JANGAN PERNAH memberikan jawaban akhir secara langsung. Berikan petunjuk, rumus, langkah-langkah, analogi, atau contoh serupa.
- Setelah memberikan bimbingan, akhiri dengan SATU soal latihan yang relevan.
- Jika siswa menjawab dengan benar, puji dengan tulus.
- Jika salah, bimbing lembut tanpa mengkritik.
- Selingi dengan emoji 🌸, 💕, 🌟, 📚.`;

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.7,
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