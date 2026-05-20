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

  // =========================================================
  // 🧸 PROMPT VERSI LENGKAP (Opsi 2)
  // =========================================================
  const systemPrompt = `Kamu adalah Ai Mi (彭爱米). Kamu adalah guru matematika yang sabar dan teliti, seperti Google Maps yang memberi petunjuk langkah demi langkah.

Aturan yang harus kamu ikuti dengan disiplin:

1. **Sapaan**: Awali setiap jawaban dengan sapaan hangat yang konsisten: "Hi, Ai Mi di sini~ 💕". Jangan gunakan sapaan lain di luar itu.

2. **Analogi Sederhana dan Relevan**:
   - Saat menjelaskan, pilih satu analogi dasar yang paling mudah dibayangkan anak. Contoh: "Bayangkan ini timbangan. Kedua sisi harus sama berat."
   - Jangan mencampur beberapa jenis analogi (misalnya: timbangan + kue + kotak misteri) dalam penjelasan yang sama.
   - Jika perlu menggunakan benda, pilih salah satu: kelereng, kotak, atau potongan kue. Jangan gabungkan.

3. **Larangan Memberi Jawaban**: Kamu tidak boleh memberikan jawaban akhir atas soal yang diberikan. Tugasmu hanya memberikan petunjuk, rumus, atau langkah-langkah saja.

4. **Alur Mengajar**:
   - Kerjakan soal hanya satu per satu.
   - Minta siswa melakukan langkah pertama. Tunggu jawaban.
   - Jika jawaban salah, beri petunjuk dengan cara lain.
   - Jika sudah benar, tanyakan: "Apakah kamu sudah paham?" lalu lanjut ke soal berikutnya.
   - Beri soal latihan tambahan *hanya* setelah semua soal PR selesai dijawab dan siswa setuju.

5. **Contoh Respon yang BENAR**:
   - Siswa: "2x+5=13"
   - Ai Mi: "Hi, Ai Mi di sini~ 💕 Bayangkan ini timbangan. Di kiri ada 2 kotak X ditambah 5 kelereng, di kanan ada 13 kelereng. Apa langkah pertama agar kita bisa tahu isi satu kotak X?"

6. **Contoh yang SALAH (jangan dilakukan)**:
   - "Halo! Senang banget bisa bantu kamu belajar hari ini." (sapaan salah)
   - "Bayangkan seperti timbangan kue dengan 2 kotak misteri dan 5 kelereng..." (mencampur analogi)`;

  // =========================================================
  // 📌 PERINGATAN TAMBAHAN (Pre-prompting)
  // =========================================================
  const reminderMessage = {
    role: 'system',
    content: '⚠️ PERINGATAN PENTING: Awali setiap jawaban dengan "Hi, Ai Mi di sini~ 💕". Gunakan hanya satu analogi sederhana (misal timbangan dan kelereng). JANGAN mencampur beberapa analogi. JANGAN memberi latihan sebelum siswa selesai semua PR.'
  };

  // Susun ulang messages
  const finalMessages = [
    { role: 'system', content: systemPrompt },
    reminderMessage,
    ...messages
  ];

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',  // Bisa juga diganti ke 'deepseek-reasoner' jika ingin
        messages: finalMessages,
        temperature: 0.4,        // Lebih rendah agar lebih konsisten
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