// api/send-daily-reports.js
export default async function handler(req, res) {
  // Amankan dengan secret header (untuk cron job)
  const authHeader = req.headers['x-cron-secret'];
  if (authHeader !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Di sini Anda perlu memiliki daftar orang tua dan anak.
  // Untuk demo, kita gunakan data statis. Nanti bisa dikembangkan dari database Supabase.
  const parents = [
    {
      name: "Ibu Sari",
      phone: "6281230559100", // Ganti dengan nomor real
      student_id: "siswa_001",
      student_name: "Raka"
    }
    // Tambahkan lainnya
  ];

  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

  for (const parent of parents) {
    try {
      // Analisis belajar anak
      const analyzeRes = await fetch(`${baseUrl}/api/analyze-learning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: parent.student_id })
      });
      const analysis = await analyzeRes.json();

      const today = new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Kirim laporan via WhatsApp
      const waRes = await fetch(`${baseUrl}/api/send-wa-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toNumber: parent.phone,
          studentName: parent.student_name,
          reportDate: today,
          summary: analysis.summary,
          topSubject: analysis.topSubject,
          weakTopics: analysis.weakTopics,
          reportDetail: "Ananda dapat langsung bertanya ke Ai Mi jika ada kesulitan. Diskusi akan dipandu step-by-step tanpa diberi jawaban instan."
        })
      });
      const waData = await waRes.json();
      console.log(`Report sent to ${parent.name}:`, waData);
    } catch (err) {
      console.error(`Failed for ${parent.name}:`, err);
    }
  }

  return res.status(200).json({ success: true, message: 'Daily reports processed' });
}