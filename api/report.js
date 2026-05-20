export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { user_id } = req.query;
  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/chats?user_id=eq.${user_id}&order=timestamp.desc&limit=30`,
      {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      }
    );
    if (!response.ok) {
      const text = await response.text();
      console.error('Supabase fetch error:', text);
      return res.status(500).json({ error: 'Failed to fetch chats' });
    }
    const chats = await response.json();
    return res.status(200).json({ chats });
  } catch (err) {
    console.error('Report error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}