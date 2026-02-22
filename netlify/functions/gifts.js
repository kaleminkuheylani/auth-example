import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function getUserFromToken(headers) {
  const authHeader = headers['authorization'] || headers['Authorization'];
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Not authenticated');
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid token');
  return data.user.id;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const path = event.path.replace(/^\/gifts/, '');
  const method = event.httpMethod;

  try {
    // GET /gifts/packages
    if (method === 'GET' && path === '/packages') {
      const { data, error } = await supabaseAdmin
        .from('gift_packages')
        .select('*')
        .eq('is_active', true)
        .order('amount');

      if (error) return json(400, { success: false, error: error.message });
      return json(200, { success: true, packages: data });
    }

    // GET /gifts/balance
    if (method === 'GET' && path === '/balance') {
      const userId = await getUserFromToken(event.headers);
      const { data, error } = await supabaseAdmin.from('user_balances').select('*').eq('user_id', userId).single();

      if (error || !data) {
        await supabaseAdmin
          .from('user_balances')
          .insert({ user_id: userId, balance: 0, total_received: 0, total_sent: 0 });
        return json(200, { success: true, balance: 0, total_received: 0, total_sent: 0 });
      }

      return json(200, {
        success: true,
        balance: parseFloat(data.balance || 0),
        total_received: parseFloat(data.total_received || 0),
        total_sent: parseFloat(data.total_sent || 0),
      });
    }

    // GET /gifts/history
    if (method === 'GET' && path === '/history') {
      const userId = await getUserFromToken(event.headers);
      const limit = parseInt(event.queryStringParameters?.limit || '20');
      const offset = parseInt(event.queryStringParameters?.offset || '0');
      const type = event.queryStringParameters?.type || 'all';

      let query = supabaseAdmin.from('gifts').select('*', { count: 'exact' });
      if (type === 'sent') query = query.eq('from_user_id', userId);
      else if (type === 'received') query = query.eq('to_user_id', userId);
      else query = query.or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);

      const { data: gifts, count, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) return json(400, { success: false, error: error.message });

      const userIds = [...new Set(gifts.flatMap((g) => [g.from_user_id, g.to_user_id]))];
      const pkgIds = [...new Set(gifts.map((g) => g.package_id).filter(Boolean))];

      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, username, real_name')
        .in('id', userIds);
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

      let pkgMap = {};
      if (pkgIds.length) {
        const { data: pkgs } = await supabaseAdmin
          .from('gift_packages')
          .select('id, name, amount')
          .in('id', pkgIds);
        pkgMap = Object.fromEntries((pkgs || []).map((p) => [p.id, p]));
      }

      return json(200, {
        success: true,
        gifts: gifts.map((g) => ({
          ...g,
          from_user: profileMap[g.from_user_id] || null,
          to_user: profileMap[g.to_user_id] || null,
          package: pkgMap[g.package_id] || null,
        })),
        total_count: count || gifts.length,
      });
    }

    // POST /gifts/send
    if (method === 'POST' && path === '/send') {
      const userId = await getUserFromToken(event.headers);
      const body = JSON.parse(event.body);
      const { to_user_id, package_id } = body;

      if (userId === to_user_id) return json(400, { success: false, message: 'Cannot send gift to yourself' });

      const { data: recipient } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', to_user_id)
        .single();
      if (!recipient) return json(404, { success: false, message: 'Recipient not found' });

      const { data: pkg } = await supabaseAdmin
        .from('gift_packages')
        .select('*')
        .eq('id', package_id)
        .eq('is_active', true)
        .single();
      if (!pkg) return json(404, { success: false, message: 'Gift package not found' });

      const giftAmount = pkg.amount;

      const { data: balData } = await supabaseAdmin
        .from('user_balances')
        .select('*')
        .eq('user_id', userId)
        .single();
      const senderBalance = parseFloat(balData?.balance || 0);

      if (senderBalance < giftAmount) {
        return json(400, {
          success: false,
          message: `Insufficient balance. You have ${senderBalance} coins but need ${giftAmount}`,
        });
      }

      const newBalance = senderBalance - giftAmount;
      await supabaseAdmin
        .from('user_balances')
        .upsert({ user_id: userId, balance: newBalance, total_sent: (parseFloat(balData?.total_sent || 0) + giftAmount) });

      const { data: gift, error: giftError } = await supabaseAdmin
        .from('gifts')
        .insert({ from_user_id: userId, to_user_id, package_id, amount: giftAmount })
        .select()
        .single();

      if (giftError) {
        // rollback
        await supabaseAdmin.from('user_balances').update({ balance: senderBalance }).eq('user_id', userId);
        return json(400, { success: false, message: 'Failed to send gift' });
      }

      return json(200, {
        success: true,
        message: 'Gift sent successfully!',
        gift_id: gift.id,
        amount: giftAmount,
        receiver_amount: parseFloat(gift.receiver_amount || 0),
      });
    }

    // POST /gifts/add-balance
    if (method === 'POST' && path === '/add-balance') {
      const userId = await getUserFromToken(event.headers);
      const amount = parseInt(event.queryStringParameters?.amount || '0');
      if (!amount || amount < 1) return json(400, { success: false, message: 'Invalid amount' });

      const { data: existing } = await supabaseAdmin
        .from('user_balances')
        .select('*')
        .eq('user_id', userId)
        .single();

      const newBalance = parseFloat(existing?.balance || 0) + amount;

      if (existing) {
        await supabaseAdmin.from('user_balances').update({ balance: newBalance }).eq('user_id', userId);
      } else {
        await supabaseAdmin
          .from('user_balances')
          .insert({ user_id: userId, balance: amount, total_received: 0, total_sent: 0 });
      }

      return json(200, {
        success: true,
        message: `Added ${amount} coins to your balance`,
        new_balance: newBalance,
      });
    }

    return json(404, { error: 'Not found' });
  } catch (err) {
    const status = err.message === 'Not authenticated' || err.message === 'Invalid token' ? 401 : 400;
    return json(status, { success: false, error: err.message });
  }
};
