export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, user_message, ai_message, subject } = req.body;
  if (!user_id || !user_message || !ai_message) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase credentials missing');
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({
        user_id: user_id,
        user_message: user_message,
        ai_message: ai_message,
        subject: subject || 'Matematika A level',
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Supabase insert error:', text);
      return res.status(500).json({ error: 'Failed to save chat' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Save chat error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}