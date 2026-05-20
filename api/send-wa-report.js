// api/send-wa-report.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { toNumber, studentName, reportDate, summary, topSubject, weakTopics, reportDetail } = req.body;

  if (!toNumber || !summary) {
    return res.status(400).json({ error: 'Missing required fields: toNumber, summary' });
  }

  const WAPI_TOKEN = process.env.WAPI_TOKEN;
  if (!WAPI_TOKEN) {
    console.error('WAPI_TOKEN not configured');
    return res.status(500).json({ error: 'WhatsApp API token not configured on server' });
  }

  // Format nomor telepon
  let formattedNumber = toNumber.replace(/\D/g, '');
  if (!formattedNumber.startsWith('62')) {
    formattedNumber = '62' + formattedNumber;
  }

  // Nama siswa (jika ada)
  const studentFirstName = (studentName || 'Ananda').split(' ')[0];

  // Bangun pesan
  let message = `📊 *Laporan Belajar Harian - MindSeek-edu*

Halo Ayah/Bunda ${studentFirstName}!

📅 *Tanggal:* ${reportDate || new Date().toLocaleDateString('id-ID')}
🧑‍🎓 *Nama Anak:* ${studentName || 'Ananda'}
📚 *Pelajaran Favorit:* ${topSubject || 'Belum ada data'}
⭐ *Rangkuman:* ${summary.substring(0, 200)}${summary.length > 200 ? '...' : ''}

`;

  if (weakTopics && weakTopics.length > 0) {
    message += `⚠️ *Area yang Perlu Perhatian:*\n${weakTopics.map(t => `- ${t}`).join('\n')}\n\n`;
  } else {
    message += `✅ *Area yang Perlu Perhatian:* Tidak terdeteksi, pertahankan semangatnya!\n\n`;
  }

  message += `💡 *Detail dari Guru Ai Mi:*\n${(reportDetail || summary).substring(0, 300)}${(reportDetail || summary).length > 300 ? '...' : ''}\n\n`;
  message += `Terus dukung semangat belajar ${studentFirstName} di rumah ya, Ayah/Bunda! 🌟\n\n_Dikirim otomatis oleh sistem MindSeek-edu._`;

  try {
    const response = await fetch('https://gate.whapi.cloud/messages/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WAPI_TOKEN}`
      },
      body: JSON.stringify({
        to: formattedNumber,
        body: message
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('WAPi API Error:', data);
      return res.status(response.status).json({ error: 'Failed to send WhatsApp message', details: data });
    }

    return res.status(200).json({ success: true, message: 'Laporan berhasil dikirim!' });
  } catch (error) {
    console.error('Error sending WhatsApp report:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}