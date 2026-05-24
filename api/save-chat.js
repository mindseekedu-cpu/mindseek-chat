// api/save-chat.js
// Menyimpan chat dan mencatat metrik sesi (Sprint 2 final)

const { createClient } = require('@supabase/supabase-js');

// Helper: parsing ringkasan dari balasan AI (format ⭐👑)
// Contoh balasan: 
// 🌟 Hasil Latihanmu:\n\nKamu berhasil menjawab 8 soal dengan benar!\n- 5 soal kamu kerjakan sendiri 👑\n- 3 soal kamu butuh bantuan Ai Mi ⭐\n- 1 soal kamu ganti ke soal lain\n- 1 soal kamu simpan untuk didiskusikan dengan orang tua\n\nTotal bintang: 8 dari 10 ⭐\nMahkota kemandirian: 5 👑
function parseSummary(aiReply) {
  // Cari angka setelah "berhasil menjawab" atau "answered"
  let completed = 0;
  let independent = 0;
  let assisted = 0;
  let skipped = 0;
  let needGuidance = 0;
  
  // Pola: "Kamu berhasil menjawab (angka) soal dengan benar!" atau "You answered (angka) questions correctly!"
  const completedMatch = aiReply.match(/(?:berhasil menjawab|answered)\s+(\d+)\s+soal/);
  if (completedMatch) completed = parseInt(completedMatch[1]);
  
  // Pola untuk mandiri: "soal kamu kerjakan sendiri 👑" atau "questions you did by yourself 👑"
  const independentMatch = aiReply.match(/(\d+)\s+soal kamu kerjakan sendiri|(\d+)\s+questions you did by yourself/);
  if (independentMatch) independent = parseInt(independentMatch[1] || independentMatch[2]);
  
  // Pola untuk dibantu: "soal kamu butuh bantuan Ai Mi ⭐" atau "questions you needed Ai Mi's help ⭐"
  const assistedMatch = aiReply.match(/(\d+)\s+soal kamu butuh bantuan Ai Mi|(\d+)\s+questions you needed Ai Mi's help/);
  if (assistedMatch) assisted = parseInt(assistedMatch[1] || assistedMatch[2]);
  
  // Pola untuk skip: "soal kamu ganti ke soal lain" atau "questions you changed"
  const skippedMatch = aiReply.match(/(\d+)\s+soal kamu ganti|(\d+)\s+questions you changed/);
  if (skippedMatch) skipped = parseInt(skippedMatch[1] || skippedMatch[2]);
  
  // Pola untuk dampingan: "soal kamu simpan untuk didiskusikan" atau "questions you saved for parent/teacher"
  const guidanceMatch = aiReply.match(/(\d+)\s+soal kamu simpan|(\d+)\s+questions you saved/);
  if (guidanceMatch) needGuidance = parseInt(guidanceMatch[1] || guidanceMatch[2]);
  
  // Jika tidak dapat parsing, coba hitung dari total bintang dan mahkota (fallback)
  if (completed === 0) {
    const starMatch = aiReply.match(/Total bintang:\s*(\d+)\s+dari\s+(\d+)/);
    if (starMatch) completed = parseInt(starMatch[1]);
  }
  if (independent === 0) {
    const crownMatch = aiReply.match(/Mahkota kemandirian:\s*(\d+)/);
    if (crownMatch) independent = parseInt(crownMatch[1]);
  }
  
  const total = independent + assisted + skipped + needGuidance;
  return {
    total_questions: total,
    completed_count: completed,
    independent_count: independent,
    ai_assisted_count: assisted,
    skipped_count: skipped,
    need_guidance_count: needGuidance
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    user_id, 
    user_message, 
    ai_message, 
    subject, 
    grade, 
    topic, 
    session_id, 
    difficulty_distribution,
    session_type  // 'practice' atau 'homework'
  } = req.body;
  
  if (!user_id || !user_message || !ai_message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase credentials missing');
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 1. Simpan chat ke tabel chats
  const { error: chatError } = await supabase
    .from('chats')
    .insert({
      user_id,
      user_message,
      ai_message,
      subject: subject || 'Matematika',
      grade: grade || '',
      topic: topic || '',
      session_type: session_type || 'practice',
      timestamp: new Date().toISOString()
    });
  if (chatError) {
    console.error('Error saving chat:', chatError);
    return res.status(500).json({ error: 'Failed to save chat' });
  }

  // 2. Jika pesan AI mengandung ringkasan (ada pola "Hasil Latihanmu" atau "Your practice results")
  if (ai_message.includes('Hasil Latihanmu') || ai_message.includes('Your practice results')) {
    const summary = parseSummary(ai_message);
    const { easy = 0, medium = 0, hard = 0 } = difficulty_distribution || {};
    const finalSessionType = session_type === 'homework' ? 'homework' : 'practice';
    
    // Simpan sesi ke tabel sessions
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id,
        session_id: session_id || crypto.randomUUID(),
        grade: grade || '',
        topic: topic || '',
        subject: subject || 'Matematika',
        total_questions: summary.total_questions,
        completed_count: summary.completed_count,
        independent_count: summary.independent_count,
        ai_assisted_count: summary.ai_assisted_count,
        skipped_count: summary.skipped_count,
        need_guidance_count: summary.need_guidance_count,
        easy_count: easy,
        medium_count: medium,
        hard_count: hard,
        session_type: finalSessionType,
        timestamp: new Date().toISOString()
      });
    if (sessionError) {
      console.error('Error saving session:', sessionError);
      // Tidak mengembalikan error agar chat tetap tersimpan
    }

    // 3. Update tabel topics_progress hanya jika session_type = 'practice' dan topik valid
    if (finalSessionType === 'practice' && topic && grade && summary.total_questions > 0) {
      // Ambil data existing
      const { data: existing, error: fetchError } = await supabase
        .from('topics_progress')
        .select('*')
        .eq('user_id', user_id)
        .eq('grade', grade)
        .eq('topic', topic)
        .maybeSingle();
      
      const now = new Date().toISOString();
      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Fetch topics_progress error:', fetchError);
      }
      
      if (existing) {
        // Update existing
        const newTotal = (existing.total_questions || 0) + summary.total_questions;
        const newIndependent = (existing.independent_count || 0) + summary.independent_count;
        const newEasy = (existing.easy_count || 0) + easy;
        const newMedium = (existing.medium_count || 0) + medium;
        const newHard = (existing.hard_count || 0) + hard;
        await supabase
          .from('topics_progress')
          .update({
            total_questions: newTotal,
            independent_count: newIndependent,
            easy_count: newEasy,
            medium_count: newMedium,
            hard_count: newHard,
            last_practiced: now
          })
          .eq('user_id', user_id)
          .eq('grade', grade)
          .eq('topic', topic);
      } else {
        // Insert baru
        await supabase
          .from('topics_progress')
          .insert({
            user_id,
            grade,
            topic,
            subject: subject || 'Matematika',
            total_questions: summary.total_questions,
            independent_count: summary.independent_count,
            easy_count: easy,
            medium_count: medium,
            hard_count: hard,
            last_practiced: now
          });
      }
    }
    
    // 4. Simpan soal perlu dampingan jika ada (dari pilihan 3 atau skip)
    // Untuk MVP, kita akan simpan jika ada need_guidance_count > 0 atau skipped_count > 0
    // Tapi karena kita tidak punya detail soal per soal di sini, kita hanya catat bahwa ada yang butuh dampingan.
    // Jika ingin menyimpan soal spesifik, frontend harus mengirim array. Untuk sementara, kita lewati.
    // Bisa ditambahkan nanti.
  }

  return res.status(200).json({ success: true });
};