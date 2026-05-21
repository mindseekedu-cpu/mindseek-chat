export default async function handler(req, res) {
  // Hanya izinkan method POST
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
    console.error('Supabase credentials missing');
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/chats?user_id=eq.${user_id}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Delete error:', text);
      return res.status(500).json({ error: 'Failed to delete chats' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Delete chat error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}