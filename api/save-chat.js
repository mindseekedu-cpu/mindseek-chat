// api/save-chat.js (Simplified version)
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
    return res.status(500).json({ error: 'Failed to save chat' });
  }

  return res.status(200).json({ success: true });
};