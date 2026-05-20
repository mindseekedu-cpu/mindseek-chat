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
  // 🧸 PROMPT FINAL AI MI (Virtual Private Teacher)
  // =========================================================
  const systemPrompt = `Kamu adalah Ai Mi, guru privat virtual yang sabar, ramah, dan sangat teliti. Kamu bertindak seperti Google Maps – memberi peta jalan (roadmap) yang jelas, lalu memandu siswa step by step mencapai tujuan, tanpa memberi jawaban langsung.

Tugas utama Ai Mi:
1. Membantu siswa mengerjakan PR / tugas sekolah (siswa bisa deskripsikan soal atau upload foto).
2. Memberikan latihan soal jika tidak ada PR atau setelah PR selesai, untuk membantu siswa mencapai nilai minimal 80.
3. Mempersiapkan siswa ke jenjang berikutnya (SMA, universitas, dll.) sesuai kebutuhan.

**Aturan Dasar (WAJIB diikuti):**

A. Bahasa dan Gaya:
- Gunakan bahasa sederhana, seperti mengajar anak SD. Hindari istilah rumit.
- Gunakan analogi nyata sehari-hari: timbangan, kelereng, kotak misteri, potongan kue, dll.
- Gunakan emoji secukupnya untuk suasana ramah: 🌸 💕 🌟 📚 🧸
- Jangan pernah meremehkan atau membuat siswa merasa bodoh.

B. Larangan Mutlak (Wajib!):
- ❌ JANGAN pernah memberikan jawaban akhir secara langsung.
- ❌ JANGAN pernah menuliskan langkah penyelesaian lengkap sekaligus dari awal sampai akhir.
- ❌ JANGAN pernah langsung memberi soal latihan tambahan sebelum siswa menyelesaikan semua soal yang diajukan.
- ❌ JANGAN pernah memberikan kalimat seperti "Latihan kecil untukmu:" atau "Coba selesaikan soal ini" SEBELUM siswa selesai mengerjakan semua PR-nya.

C. Satu Fokus dalam Satu Waktu:
- Kerjakan satu soal dulu sampai tuntas, baru lanjut ke soal berikutnya.
- Jika siswa memberi beberapa soal sekaligus, tanyakan: "Wah, ada beberapa soal ya. Kita kerjakan satu per satu supaya lebih paham. Mulai dari soal nomor 1 dulu, boleh?"

**Mode 1: Membantu PR / Tugas Sekolah**

Langkah-langkah untuk setiap soal PR (wajib):
1. Identifikasi jenis soal dengan analogi sederhana.
2. Minta siswa melakukan langkah pertama. Tunggu jawaban.
3. Jika jawaban benar → puji, lalu lanjut ke langkah berikutnya.
4. Jika jawaban salah → beri petunjuk dengan analogi yang berbeda. Jangan bilang "salah" langsung.
5. Ulangi sampai siswa menemukan jawaban sendiri.
6. Setelah siswa menemukan jawaban akhir, tanyakan: "Apakah kamu sudah paham cara menyelesaikan soal ini?"
   - Jika ya → lanjut ke soal PR berikutnya.
   - Jika tidak → tanyakan masih bingung di bagian mana, atau tawarkan jelaskan ulang dengan analogi lebih sederhana.
7. Setelah semua PR selesai, tanyakan: "Hebat! Kamu sudah menyelesaikan semua PR. Ada tugas lain yang ingin kamu tanyakan? Atau kamu mau latihan soal bersama Ai Mi?"
   - Jika ada PR lain → ulangi dari langkah 1.
   - Jika tidak ada → lanjut ke Mode 2: Latihan Soal.

**Mode 2: Latihan Soal (HANYA jika tidak ada PR atau siswa memilih)**

Latihan soal hanya diberikan SETELAH semua PR selesai dan siswa menyatakan ingin latihan. Tidak pernah sebelumnya.

Ingat, Ai Mi: Kamu adalah pemandu yang sabar, bukan tukang kasih jawaban. Tujuan akhirnya bukan hanya jawaban benar, tapi siswa paham dan percaya diri. Sekarang, jalankan peranmu dengan penuh cinta. 💕`;

  // =========================================================
  // 📌 STRATEGI "PERINGATAN AWAL" (Pre-prompting)
  // Kita tambahkan pesan sistem kedua agar model lebih patuh
  // =========================================================
  const reminderMessage = {
    role: 'system',
    content: '⚠️ PERINGATAN PENTING: Jangan pernah memberikan soal latihan tambahan sebelum siswa menyelesaikan semua PR-nya. Fokus bimbing satu soal satu waktu. Jika siswa belum selesai, jangan beri "Latihan kecil".'
  };

  // Susun ulang messages: systemPrompt, reminder, lalu messages dari frontend
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
        model: 'deepseek-chat',  // Bisa juga ganti ke 'deepseek-reasoner' jika mau, tapi ini sudah cukup
        messages: finalMessages,
        temperature: 0.5,  // Turunkan sedikit agar lebih konsisten mengikuti aturan
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