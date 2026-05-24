// api/topic-progress.js
// Mengambil data akumulasi per topik untuk halaman Progress per Topik
// Sesuai dokumen final Sprint 2

const { createClient } = require('@supabase/supabase-js');

// Fungsi menentukan status data berdasarkan total soal dan distribusi
function getDataStatus(total, easy, medium, hard) {
  if (total >= 60 && easy >= 15 && medium >= 15 && hard >= 15) return 'Tinggi';
  if (total >= 45 && easy >= 12 && medium >= 12 && hard >= 12) return 'Cukup';
  if (total >= 30 && easy >= 8 && medium >= 8 && hard >= 8) return 'Awal';
  return 'Nihil';
}

// Fungsi evaluasi (hanya jika status Tinggi atau Cukup)
function getEvaluation(percentage, status) {
  if (status !== 'Tinggi' && status !== 'Cukup') return null;
  if (percentage >= 80) return '✅ Kuasai';
  if (percentage >= 50) return '⚠️ Latihan lagi';
  return '🔴 Perlu dampingan';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, grade } = req.query;
  if (!user_id || !grade) {
    return res.status(400).json({ error: 'user_id and grade required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Ambil semua progress topik untuk grade tertentu (hanya dari sesi practice)
  const { data: topics, error } = await supabase
    .from('topics_progress')
    .select('*')
    .eq('user_id', user_id)
    .eq('grade', grade)
    .order('topic', { ascending: true });

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch topic progress' });
  }

  const processed = (topics || []).map(t => {
    const percentage = t.total_questions > 0 ? (t.independent_count / t.total_questions) * 100 : 0;
    const status = getDataStatus(t.total_questions, t.easy_count || 0, t.medium_count || 0, t.hard_count || 0);
    const evaluation = getEvaluation(percentage, status);
    return {
      topic: t.topic,
      total_questions: t.total_questions,
      independent_count: t.independent_count,
      percentage: percentage.toFixed(1),
      distribution: `${t.easy_count || 0}/${t.medium_count || 0}/${t.hard_count || 0}`,
      data_status: status,
      evaluation: evaluation,
      last_practiced: t.last_practiced
    };
  });

  // Catatan Ai Mi: 3 topik terkuat & 3 terlemah (berdasarkan persentase, hanya yang status Cukup/Tinggi)
  const eligible = processed.filter(t => t.data_status === 'Cukup' || t.data_status === 'Tinggi');
  const sorted = [...eligible].sort((a,b) => b.percentage - a.percentage);
  const strongest = sorted.slice(0, 3);
  const weakest = sorted.slice(-3).reverse();

  let aiNote = '';
  if (strongest.length) {
    aiNote += `✅ Topik kuat: ${strongest.map(t => `${t.topic} (${t.percentage}%)`).join(', ')} – pertahankan.\n`;
  }
  if (weakest.length) {
    aiNote += `🔴 Topik lemah: ${weakest.map(t => `${t.topic} (${t.percentage}%)`).join(', ')} – fokus latihan 3x seminggu.\n`;
  }
  const anyNihilOrAwal = processed.some(t => t.data_status === 'Nihil' || t.data_status === 'Awal');
  if (anyNihilOrAwal) {
    aiNote += `💡 Beberapa topik masih minim data. Ajak anak latihan minimal 30 soal dengan distribusi seimbang (mudah, sedang, sulit) untuk penilaian akurat.`;
  }

  return res.status(200).json({
    grade,
    topics: processed,
    ai_note: aiNote.trim(),
    message: 'success'
  });
};