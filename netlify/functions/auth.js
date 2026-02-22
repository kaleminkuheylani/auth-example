import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const path = event.path.replace('/api/auth', '');

  // POST /api/auth/register
  if (event.httpMethod === 'POST' && path === '/register') {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return json(400, { success: false, message: 'Invalid JSON' });
    }

    const { email, password, realName, username, interests, lifeExpectations, whatBroughtYouHere, linkedinLink } = body;

    let authResponse = null;
    try {
      authResponse = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authResponse.error) {
        return json(400, { success: false, message: authResponse.error.message });
      }

      const userId = authResponse.data.user.id;

      const profileData = {
        id: userId,
        email,
        real_name: realName,
        username,
        email_verified: true,
        interests: interests || [],
        life_expectations: lifeExpectations,
        what_brought_you_here: whatBroughtYouHere,
        linkedin_link: linkedinLink || null,
        linkedin_verified: false,
        is_public_in_recommendations: true,
      };

      const { error: profileError } = await supabaseAdmin.from('profiles').insert(profileData);
      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return json(400, { success: false, message: profileError.message });
      }

      return json(200, { success: true, user_id: userId, message: 'User registered successfully' });
    } catch (err) {
      if (authResponse?.data?.user) {
        await supabaseAdmin.auth.admin.deleteUser(authResponse.data.user.id).catch(() => {});
      }
      return json(400, { success: false, message: err.message });
    }
  }

  // POST /api/auth/login
  if (event.httpMethod === 'POST' && path === '/login') {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return json(400, { success: false, message: 'Invalid JSON' });
    }

    const { email, password } = body;
    try {
      const response = await supabaseAnon.auth.signInWithPassword({ email, password });
      if (response.error) {
        return json(200, { success: false, message: response.error.message });
      }
      return json(200, {
        success: true,
        user_id: response.data.user.id,
        access_token: response.data.session?.access_token,
        message: 'Login successful',
      });
    } catch (err) {
      return json(200, { success: false, message: err.message });
    }
  }

  // GET /api/auth/user
  if (event.httpMethod === 'GET' && path === '/user') {
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return json(401, { error: 'Not authenticated' });
    }
    const token = authHeader.replace('Bearer ', '');
    try {
      const { data, error } = await supabaseAnon.auth.getUser(token);
      if (error || !data.user) return json(401, { error: 'Invalid token' });

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      return json(200, {
        id: data.user.id,
        email: data.user.email,
        username: profile?.username,
        real_name: profile?.real_name,
      });
    } catch (err) {
      return json(400, { error: err.message });
    }
  }

  return json(404, { error: 'Not found' });
};
