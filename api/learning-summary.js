// api/learning-summary.js
// Mengambil data ringkasan belajar untuk orang tua (halaman utama)
// Sesuai dokumen final Sprint 2

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, date } = req.query;
  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Tentukan tanggal target (default hari ini)
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Ambil semua sesi pada tanggal tersebut (baik practice maupun homework)
  const { data: sessions, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', user_id)
    .gte('timestamp', startOfDay.toISOString())
    .lte('timestamp', endOfDay.toISOString())
    .order('timestamp', { ascending: true });

  if (sessionError) {
    console.error(sessionError);
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }

  // Pisahkan berdasarkan session_type ('homework' vs 'practice')
  const homeworkSessions = (sessions || []).filter(s => s.session_type === 'homework');
  const practiceSessions = (sessions || []).filter(s => s.session_type === 'practice' || !s.session_type); // default practice

  // Fungsi untuk mengelompokkan per topik dan menghitung agregat
  function aggregateByTopic(sessionsList) {
    const map = new Map();
    for (const sess of sessionsList) {
      const topic = sess.topic || 'Umum';
      if (!map.has(topic)) {
        map.set(topic, {
          topic,
          total_questions: 0,
          completed: 0,
          independent: 0,
          assisted: 0,
          skipped: 0,
          need_guidance: 0,
        });
      }
      const t = map.get(topic);
      t.total_questions += sess.total_questions || 0;
      t.completed += (sess.independent_count || 0) + (sess.ai_assisted_count || 0);
      t.independent += sess.independent_count || 0;
      t.assisted += sess.ai_assisted_count || 0;
      t.skipped += sess.skipped_count || 0;
      t.need_guidance += sess.need_guidance_count || 0;
    }
    return Array.from(map.values());
  }

  const homeworkTopics = aggregateByTopic(homeworkSessions);
  const practiceTopics = aggregateByTopic(practiceSessions);

  // Untuk practice, tambahkan kolom kemandirian (mandiri / total_soal * 100)
  const practiceWithIndependence = practiceTopics.map(t => ({
    ...t,
    independence_percentage: t.total_questions > 0 ? (t.independent / t.total_questions) * 100 : 0
  }));

  // Ambil data kemarin untuk perbandingan (hanya untuk topik practice yang sama)
  const yesterday = new Date(targetDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const startYesterday = new Date(yesterday);
  startYesterday.setHours(0,0,0,0);
  const endYesterday = new Date(yesterday);
  endYesterday.setHours(23,59,59,999);

  const { data: yesterdaySessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', user_id)
    .eq('session_type', 'practice')
    .gte('timestamp', startYesterday.toISOString())
    .lte('timestamp', endYesterday.toISOString());

  const yesterdayMap = new Map();
  if (yesterdaySessions) {
    for (const sess of yesterdaySessions) {
      const topic = sess.topic || 'Umum';
      if (!yesterdayMap.has(topic)) {
        yesterdayMap.set(topic, { total: 0, independent: 0 });
      }
      const y = yesterdayMap.get(topic);
      y.total += sess.total_questions || 0;
      y.independent += sess.independent_count || 0;
    }
  }

  // Tambahkan perbandingan dan rata-rata 7 hari untuk setiap topik practice
  const sevenDaysAgo = new Date(targetDate);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0,0,0,0);

  const { data: weekSessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', user_id)
    .eq('session_type', 'practice')
    .gte('timestamp', sevenDaysAgo.toISOString());

  const weekMap = new Map();
  if (weekSessions) {
    for (const sess of weekSessions) {
      const topic = sess.topic || 'Umum';
      if (!weekMap.has(topic)) {
        weekMap.set(topic, { total: 0, independent: 0 });
      }
      const w = weekMap.get(topic);
      w.total += sess.total_questions || 0;
      w.independent += sess.independent_count || 0;
    }
  }

  const practiceWithCompare = practiceWithIndependence.map(t => {
    const yesterdayData = yesterdayMap.get(t.topic);
    let yesterdayPct = null;
    if (yesterdayData && yesterdayData.total > 0) {
      yesterdayPct = (yesterdayData.independent / yesterdayData.total) * 100;
    }
    const weekData = weekMap.get(t.topic);
    let weekAvg = null;
    if (weekData && weekData.total > 0) {
      weekAvg = (weekData.independent / weekData.total) * 100;
    }
    return {
      ...t,
      yesterday_independence: yesterdayPct,
      week_average: weekAvg,
      change: yesterdayPct !== null ? (t.independence_percentage - yesterdayPct) : null
    };
  });

  // Hitung konsistensi 7 hari (Simbol ✅❌ berurutan, dan angka aktif)
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(targetDate);
    d.setDate(d.getDate() - i);
    d.setHours(0,0,0,0);
    const nextDay = new Date(d);
    nextDay.setDate(d.getDate() + 1);
    const { data: daySessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', user_id)
      .gte('timestamp', d.toISOString())
      .lt('timestamp', nextDay.toISOString())
      .limit(1);
    last7Days.push(daySessions && daySessions.length > 0 ? '✅' : '❌');
  }
  const active7 = last7Days.filter(s => s === '✅').length;

  // Konsistensi 30 hari: hanya ✅(X aktif) ❌(Y tidak aktif)
  const startMonth = new Date(targetDate);
  startMonth.setDate(1);
  startMonth.setHours(0,0,0,0);
  const endMonth = new Date(targetDate);
  endMonth.setMonth(endMonth.getMonth() + 1);
  endMonth.setDate(0);
  endMonth.setHours(23,59,59,999);
  const { data: monthSessions } = await supabase
    .from('sessions')
    .select('timestamp')
    .eq('user_id', user_id)
    .gte('timestamp', startMonth.toISOString())
    .lte('timestamp', endMonth.toISOString());
  const uniqueDays = new Set();
  if (monthSessions) {
    for (const s of monthSessions) {
      uniqueDays.add(new Date(s.timestamp).toDateString());
    }
  }
  const active30 = uniqueDays.size;
  const totalDays = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
  const inactive30 = totalDays - active30;

  // Topik paling sering diulang (30 hari terakhir, berdasarkan jumlah sesi)
  const thirtyDaysAgo = new Date(targetDate);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0,0,0,0);
  const { data: last30Sessions } = await supabase
    .from('sessions')
    .select('topic, total_questions')
    .eq('user_id', user_id)
    .eq('session_type', 'practice')
    .gte('timestamp', thirtyDaysAgo.toISOString());

  const topicSessionCount = new Map();
  if (last30Sessions) {
    for (const s of last30Sessions) {
      const topic = s.topic || 'Umum';
      if (!topicSessionCount.has(topic)) {
        topicSessionCount.set(topic, { count: 0, total_questions: 0 });
      }
      const t = topicSessionCount.get(topic);
      t.count++;
      t.total_questions += s.total_questions || 0;
    }
  }
  const topTopics = Array.from(topicSessionCount.entries())
    .map(([topic, data]) => ({ topic, sessions: data.count, total_questions: data.total_questions }))
    .sort((a,b) => b.sessions - a.sessions)
    .slice(0, 3);

  // Catatan Ai Mi: fokus pada topik practice dengan persentase kemandirian terendah
  let aiNote = '';
  if (practiceWithCompare.length > 0) {
    const lowest = practiceWithCompare.reduce((min, t) => t.independence_percentage < min.independence_percentage ? t : min, practiceWithCompare[0]);
    aiNote = `Fokus pada topik "${lowest.topic}" (${lowest.independence_percentage.toFixed(1)}% kemandirian). Luangkan 10 menit setiap hari berlatih soal cerita atau gunakan alat peraga di rumah.`;
  } else {
    aiNote = 'Ajak anak mulai latihan untuk melihat perkembangan kemandirian.';
  }

  return res.status(200).json({
    date: targetDate.toISOString().split('T')[0],
    homework: homeworkTopics,
    practice: practiceWithCompare,
    consistency_7_days: {
      symbols: last7Days.join(''),
      active: active7
    },
    consistency_30_days: {
      active: active30,
      inactive: inactive30,
      month: targetDate.toLocaleString('id-ID', { month: 'long' })
    },
    top_topics: topTopics,
    ai_note: aiNote,
    message: 'success'
  });
};