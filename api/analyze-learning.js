// api/analyze-learning.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  try {
    // Ambil 50 chat terakhir
    const response = await fetch(
      `${supabaseUrl}/rest/v1/chats?user_id=eq.${user_id}&order=timestamp.desc&limit=50`,
      {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      }
    );
    const chats = await response.json();

    if (!chats || chats.length === 0) {
      return res.status(200).json({
        summary: 'Ananda belum memulai sesi belajar hari ini. Yuk, ajak ia belajar bersama Ai Mi!',
        weakTopics: [],
        topSubject: 'Belum ada data'
      });
    }

    // Hitung subject favorit
    const subjectCount = {};
    for (const chat of chats) {
      const subj = chat.subject || 'Matematika A level';
      subjectCount[subj] = (subjectCount[subj] || 0) + 1;
    }
    const topSubject = Object.entries(subjectCount).sort((a,b) => b[1] - a[1])[0]?.[0] || 'Matematika A level';

    // Deteksi kelemahan sederhana: cari kata kunci error di pesan AI
    const errorKeywords = ['salah', 'keliru', 'belum tepat', 'coba lagi', 'perhatikan', 'seharusnya'];
    const weakSet = new Set();
    for (const chat of chats) {
      const aiMsg = chat.ai_message?.toLowerCase() || '';
      if (errorKeywords.some(kw => aiMsg.includes(kw))) {
        weakSet.add(chat.subject || 'Matematika A level');
      }
    }
    const weakTopics = Array.from(weakSet).slice(0, 3);

    // Buat ringkasan berdasarkan jumlah chat
    let summary = '';
    if (chats.length >= 10) {
      summary = `Ananda sangat rajin! Telah menyelesaikan ${chats.length} sesi diskusi dengan Ai Mi. Pertahankan ya!`;
    } else if (chats.length >= 3) {
      summary = `Hari ini Ananda belajar dengan cukup baik, dengan ${chats.length} topik yang didiskusikan.`;
    } else {
      summary = `Ananda baru memulai ${chats.length} topik hari ini. Ayo lebih semangat lagi!`;
    }

    return res.status(200).json({ summary, weakTopics, topSubject });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to analyze learning' });
  }
}