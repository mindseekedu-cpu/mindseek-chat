// api/guidance-questions.js
// Mengelola daftar soal perlu dampingan (GET, POST, PUT)
// Sesuai dokumen final Sprint 2

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  } else if (req.method === 'POST') {
    return handlePost(req, res);
  } else if (req.method === 'PUT') {
    return handlePut(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
};

// GET: Ambil daftar soal perlu dampingan (bisa filter status)
async function handleGet(req, res) {
  const { user_id, resolved } = req.query;
  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  let query = supabase
    .from('guidance_questions')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false });

  if (resolved === 'true') {
    query = query.eq('resolved', true);
  } else if (resolved === 'false') {
    query = query.eq('resolved', false);
  }

  const { data, error } = await query;
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch guidance questions' });
  }

  // Pisahkan berdasarkan resolved dan mode untuk frontend nanti
  const unresolved = data.filter(q => !q.resolved);
  const resolvedQuestions = data.filter(q => q.resolved);

  // Kelompokkan unresolved berdasarkan mode (PR vs Practice)
  const unresolvedPR = unresolved.filter(q => q.mode === 'PR');
  const unresolvedPractice = unresolved.filter(q => q.mode === 'Practice');

  return res.status(200).json({
    unresolved: {
      pr: unresolvedPR,
      practice: unresolvedPractice
    },
    resolved: resolvedQuestions
  });
}

// POST: Simpan soal baru (dipanggil oleh AI atau sistem)
async function handlePost(req, res) {
  const { user_id, question_text, topic, difficulty, answer_key, teaching_steps, mode, status } = req.body;
  if (!user_id || !question_text) {
    return res.status(400).json({ error: 'Missing required fields: user_id, question_text' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await supabase
    .from('guidance_questions')
    .insert({
      user_id,
      question_text,
      topic: topic || '',
      difficulty: difficulty || 'medium',
      answer_key: answer_key || '',
      teaching_steps: teaching_steps || '',
      mode: mode || 'Practice', // 'PR' atau 'Practice'
      status: status || 'Minta bantuan', // 'Minta bantuan', 'Ganti soal', 'Diam', 'Salah terus'
      resolved: false,
      created_at: new Date().toISOString()
    })
    .select();

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to save guidance question' });
  }

  return res.status(201).json({ question: data[0] });
}

// PUT: Update status resolved (centang selesai)
async function handlePut(req, res) {
  const { id, resolved } = req.body;
  if (!id || resolved === undefined) {
    return res.status(400).json({ error: 'Missing id or resolved status' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { error } = await supabase
    .from('guidance_questions')
    .update({ resolved: resolved === true, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to update guidance question' });
  }

  return res.status(200).json({ success: true });
}