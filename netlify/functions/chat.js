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

  // Remove /chat prefix
  const path = event.path.replace(/^\/chat/, '');
  const method = event.httpMethod;

  try {
    // GET /chat/rooms — list rooms for current user
    if (method === 'GET' && path === '/rooms') {
      const userId = await getUserFromToken(event.headers);
      const { data: rooms, error } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('last_message_at', { ascending: false });

      if (error) return json(400, { success: false, error: error.message });

      const enriched = await Promise.all(
        rooms.map(async (room) => {
          const otherId = room.initiator_id === userId ? room.recipient_id : room.initiator_id;
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id, username, real_name')
            .eq('id', otherId)
            .single();
          return { ...room, other_user: profile || null };
        })
      );

      return json(200, { success: true, rooms: enriched });
    }

    // POST /chat/rooms — create or get existing room
    if (method === 'POST' && path === '/rooms') {
      const userId = await getUserFromToken(event.headers);
      const body = JSON.parse(event.body);
      const { recipient_id } = body;

      if (userId === recipient_id) return json(400, { success: false, message: 'Cannot create room with yourself' });

      const { data: existing } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .or(
          `and(initiator_id.eq.${userId},recipient_id.eq.${recipient_id}),and(initiator_id.eq.${recipient_id},recipient_id.eq.${userId})`
        )
        .limit(1);

      if (existing?.length > 0) {
        return json(200, { success: true, room: existing[0], message: 'Room already exists' });
      }

      const { data: newRoom, error } = await supabaseAdmin
        .from('conversations')
        .insert({ initiator_id: userId, recipient_id })
        .select()
        .single();

      if (error) return json(400, { success: false, message: error.message });
      return json(200, { success: true, room: newRoom, message: 'Room created successfully' });
    }

    // GET /chat/rooms/:roomId
    const roomMatch = path.match(/^\/rooms\/([^/]+)$/);
    if (method === 'GET' && roomMatch) {
      const roomId = roomMatch[1];
      const userId = await getUserFromToken(event.headers);

      const { data: room, error } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('id', roomId)
        .single();

      if (error || !room) return json(404, { success: false, message: 'Room not found' });
      if (room.initiator_id !== userId && room.recipient_id !== userId) {
        return json(403, { success: false, message: 'Not authorized' });
      }

      const otherId = room.initiator_id === userId ? room.recipient_id : room.initiator_id;
      const { data: otherUser } = await supabaseAdmin
        .from('profiles')
        .select('id, username, real_name')
        .eq('id', otherId)
        .single();

      return json(200, { success: true, room: { ...room, other_user: otherUser || null }, message: 'Room found' });
    }

    // GET /chat/messages/:roomId
    const msgRoomMatch = path.match(/^\/messages\/([^/]+)$/);
    if (method === 'GET' && msgRoomMatch) {
      const roomId = msgRoomMatch[1];
      const userId = await getUserFromToken(event.headers);
      const limit = parseInt(event.queryStringParameters?.limit || '50');
      const offset = parseInt(event.queryStringParameters?.offset || '0');

      const { data: room } = await supabaseAdmin.from('conversations').select('*').eq('id', roomId).single();
      if (!room) return json(404, { success: false, message: 'Room not found' });
      if (room.initiator_id !== userId && room.recipient_id !== userId) {
        return json(403, { success: false, message: 'Not authorized' });
      }

      const { data: messages } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('conversation_id', roomId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      const senderIds = [...new Set(messages.map((m) => m.sender_id))];
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, username, real_name')
        .in('id', senderIds);

      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

      // Mark as read
      await supabaseAdmin
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', roomId)
        .neq('sender_id', userId)
        .eq('is_read', false);

      return json(200, {
        success: true,
        messages: messages.map((m) => ({ ...m, sender: profileMap[m.sender_id] || null })),
      });
    }

    // POST /chat/messages — send a message
    if (method === 'POST' && path === '/messages') {
      const userId = await getUserFromToken(event.headers);
      const body = JSON.parse(event.body);
      const { conversation_id, content } = body;

      if (!content?.trim()) return json(400, { success: false, message: 'Message cannot be empty' });

      const { data: room } = await supabaseAdmin.from('conversations').select('*').eq('id', conversation_id).single();
      if (!room) return json(404, { success: false, message: 'Room not found' });
      if (room.initiator_id !== userId && room.recipient_id !== userId) {
        return json(403, { success: false, message: 'Not authorized' });
      }

      const { data: msg, error } = await supabaseAdmin
        .from('messages')
        .insert({ conversation_id, sender_id: userId, content: content.trim() })
        .select()
        .single();

      if (error) return json(400, { success: false, error: error.message });

      await supabaseAdmin
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation_id);

      const { data: sender } = await supabaseAdmin
        .from('profiles')
        .select('id, username, real_name')
        .eq('id', userId)
        .single();

      return json(200, { success: true, message: { ...msg, sender: sender || null } });
    }

    // GET /chat/unread-count
    if (method === 'GET' && path === '/unread-count') {
      const userId = await getUserFromToken(event.headers);
      const { data: rooms } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`);

      if (!rooms?.length) return json(200, { success: true, unread_count: 0 });

      const roomIds = rooms.map((r) => r.id);
      const { count } = await supabaseAdmin
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', roomIds)
        .neq('sender_id', userId)
        .eq('is_read', false);

      return json(200, { success: true, unread_count: count || 0 });
    }

    return json(404, { error: 'Not found' });
  } catch (err) {
    const status = err.message === 'Not authenticated' || err.message === 'Invalid token' ? 401 : 400;
    return json(status, { success: false, error: err.message });
  }
};
