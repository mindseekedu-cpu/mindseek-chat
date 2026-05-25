// api/save-chat.js
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, user_message, ai_message, subject, grade, topic, session_type } = req.body;
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

  // 1. Simpan ke tabel chats
  const { error: chatError } = await supabase
    .from('chats')
    .insert({
      user_id,
      user_message,
      ai_message,
      subject: subject || 'Matematika',
      grade: grade || '',
      topic: topic || '',
      session_type: session_type || 'Practice',
      timestamp: new Date().toISOString()
    });

  if (chatError) {
    console.error('Save chat error:', chatError);
    // Tetap lanjut, karena yang penting chat sudah diterima, kita tetap return success? Lebih baik return error agar client tahu.
    // Tapi untuk MVP, kita return error agar bisa debug.
    return res.status(500).json({ error: 'Failed to save chat', detail: chatError.message });
  }

  // 2. Deteksi apakah ini pesan ringkasan akhir sesi (baik dari mode PR maupun Practice)
  const isSummary = ai_message.includes('Hasil Latihanmu') || ai_message.includes('Your practice results') ||
                    ai_message.includes('Hasil PR-mu') || ai_message.includes('Homework results');
  
  if (isSummary) {
    // Ekstraksi data dari ringkasan (mendukung bahasa Indonesia dan Inggris)
    const indonesian = ai_message.includes('Hasil Latihanmu') || ai_message.includes('Hasil PR-mu');
    
    let independent = 0, assisted = 0, skipped = 0, needGuidance = 0, total = 0;
    
    if (indonesian) {
      const independentMatch = ai_message.match(/(\d+)\s*soal kamu kerjakan sendiri/i);
      const assistedMatch = ai_message.match(/(\d+)\s*soal kamu butuh bantuan Ai Mi/i);
      const skippedMatch = ai_message.match(/(\d+)\s*soal kamu ganti ke soal lain/i);
      const guidanceMatch = ai_message.match(/(\d+)\s*soal kamu simpan untuk didiskusikan/i);
      const totalMatch = ai_message.match(/dari (\d+) ⭐/i);
      
      independent = independentMatch ? parseInt(independentMatch[1]) : 0;
      assisted = assistedMatch ? parseInt(assistedMatch[1]) : 0;
      skipped = skippedMatch ? parseInt(skippedMatch[1]) : 0;
      needGuidance = guidanceMatch ? parseInt(guidanceMatch[1]) : 0;
      total = totalMatch ? parseInt(totalMatch[1]) : (independent + assisted + skipped + needGuidance);
    } else {
      // English version
      const independentMatch = ai_message.match(/(\d+)\s*questions you did by yourself/i);
      const assistedMatch = ai_message.match(/(\d+)\s*questions you needed Ai Mi's help/i);
      const skippedMatch = ai_message.match(/(\d+)\s*questions you changed/i);
      const guidanceMatch = ai_message.match(/(\d+)\s*questions you saved for parent/i);
      const totalMatch = ai_message.match(/out of (\d+) ⭐/i);
      
      independent = independentMatch ? parseInt(independentMatch[1]) : 0;
      assisted = assistedMatch ? parseInt(assistedMatch[1]) : 0;
      skipped = skippedMatch ? parseInt(skippedMatch[1]) : 0;
      needGuidance = guidanceMatch ? parseInt(guidanceMatch[1]) : 0;
      total = totalMatch ? parseInt(totalMatch[1]) : (independent + assisted + skipped + needGuidance);
    }
    
    const completed = independent + assisted;
    
    // Simpan ke tabel sessions
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id,
        session_id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        session_type: session_type || 'Practice',
        grade: grade || '',
        topic: topic || '',
        subject: subject || 'Matematika',
        total_questions: total,
        completed_count: completed,
        independent_count: independent,
        ai_assisted_count: assisted,
        skipped_count: skipped,
        need_guidance_count: needGuidance,
        easy_count: 0,    // Bisa diisi nanti jika frontend mengirim distribusi
        medium_count: 0,
        hard_count: 0,
        timestamp: new Date().toISOString()
      });
    
    if (sessionError) {
      console.error('Save session error:', sessionError);
      // Tidak perlu return error karena chat sudah tersimpan
    }
  }

  return res.status(200).json({ success: true });
};