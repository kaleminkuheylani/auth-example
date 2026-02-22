// In-memory store (ephemeral per function instance — demo only)
const verificationCodes = {};

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

function generateCode(length = 6) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const path = event.path.replace('/api/email', '');

  // POST /api/email/send-code
  if (event.httpMethod === 'POST' && path === '/send-code') {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return json(400, { success: false, message: 'Invalid JSON' });
    }

    const { email } = body;
    if (!email) return json(400, { success: false, message: 'Email required' });

    const code = generateCode();
    verificationCodes[email] = {
      code,
      expires: Date.now() + 5 * 60 * 1000, // 5 minutes
    };

    // In production: send actual email here via SendGrid / Resend / etc.
    return json(200, {
      success: true,
      message: 'Verification code sent',
      code, // Remove in production!
    });
  }

  // POST /api/email/verify
  if (event.httpMethod === 'POST' && path === '/verify') {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return json(400, { success: false, message: 'Invalid JSON' });
    }

    const { email, code } = body;
    const stored = verificationCodes[email];

    if (!stored) {
      return json(200, { success: false, message: 'No code found. Please request a new one.' });
    }
    if (Date.now() > stored.expires) {
      delete verificationCodes[email];
      return json(200, { success: false, message: 'Code expired. Please request a new one.' });
    }
    if (stored.code !== code) {
      return json(200, { success: false, message: 'Invalid code' });
    }

    delete verificationCodes[email];
    return json(200, { success: true, message: 'Email verified successfully' });
  }

  return json(404, { error: 'Not found' });
};
