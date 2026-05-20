// api/send-daily-reports.js
export default async function handler(req, res) {
  // 1. Keamanan cron job
  const authHeader = req.headers['x-cron-secret'];
  if (authHeader !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Gunakan domain tetap (ganti dengan domain Anda)
  const baseUrl = 'https://mindseek-chat.vercel.app';

  // 3. Data orang tua (validasi nomor telepon)
  const parents = [
    {
      name: "Ibu Olivia",
      phone: "6281230559100",  // pastikan nomor ini adalah WhatsApp yang aktif
      student_id: "siswa_001",
      student_name: "Shawn Audrich Pangestu"
    }
  ];

  const errors = [];
  let anySuccess = false;

  for (const parent of parents) {
    try {
      // Panggil analisis belajar
      console.log(`Menganalisis belajar untuk ${parent.student_name}...`);
      const analyzeRes = await fetch(`${baseUrl}/api/analyze-learning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: parent.student_id })
      });

      if (!analyzeRes.ok) {
        throw new Error(`Analisis gagal: ${analyzeRes.status} ${await analyzeRes.text()}`);
      }

      const analysis = await analyzeRes.json();

      const today = new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Kirim laporan WhatsApp
      console.log(`Mengirim WA ke ${parent.phone}...`);
      const waRes = await fetch(`${baseUrl}/api/send-wa-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toNumber: parent.phone,
          studentName: parent.student_name,
          reportDate: today,
          summary: analysis.summary || "Belum ada data pembelajaran.",
          topSubject: analysis.topSubject || "Belum ada topik",
          weakTopics: analysis.weakTopics || [],
          reportDetail: "Ananda dapat langsung bertanya ke Ai Mi jika ada kesulitan. Diskusi akan dipandu step-by-step tanpa diberi jawaban instan."
        })
      });

      const waData = await waRes.json();
      if (waRes.ok) {
        console.log(`✅ Laporan terkirim ke ${parent.name} (${parent.phone})`);
        anySuccess = true;
      } else {
        throw new Error(`WA API error: ${waRes.status} - ${JSON.stringify(waData)}`);
      }
    } catch (err) {
      console.error(`❌ Gagal untuk ${parent.name}:`, err.message);
      errors.push({ parent: parent.name, error: err.message });
    }
  }

  // 4. Response yang informatif
  if (errors.length === parents.length) {
    return res.status(500).json({
      success: false,
      message: 'Semua laporan gagal dikirim',
      errors
    });
  }

  return res.status(200).json({
    success: true,
    message: anySuccess ? 'Beberapa laporan berhasil dikirim' : 'Tidak ada laporan terkirim',
    errors: errors.length > 0 ? errors : undefined
  });
}