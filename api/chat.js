// ---------------------------------------------------------------------------
// In-memory rate limiter (resets when the serverless instance cold-starts,
// which is fine — Vercel instances are per-region and short-lived).
// ---------------------------------------------------------------------------

const RATE_LIMIT   = 20;   // max requests per IP per window
const WINDOW_MS    = 60 * 60 * 1000; // 1 hour
const MAX_TOKENS   = 1024; // max tokens per response
const ipStore      = new Map(); // ip -> { count, windowStart }

function isRateLimited(ip) {
  const now  = Date.now();
  const entry = ipStore.get(ip) ?? { count: 0, windowStart: now };
  if (now - entry.windowStart > WINDOW_MS) {
    entry.count       = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  ipStore.set(ip, entry);
  return entry.count > RATE_LIMIT;
}

// ---------------------------------------------------------------------------
// Trim messages to stay within a sane context size.
// Keep the last 12 exchanges (24 messages) — enough for continuity without
// sending the full session history on every request.
// ---------------------------------------------------------------------------

function trimMessages(messages) {
  const MAX_MESSAGES = 24;
  if (messages.length <= MAX_MESSAGES) return messages;
  return messages.slice(messages.length - MAX_MESSAGES);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {

  // --- Method guard ---------------------------------------------------------
  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'Method not allowed' });
  }

  // --- Access token check ---------------------------------------------------
  // Set ACCESS_TOKEN in Vercel environment variables.
  // If not set, the endpoint is open (for local dev convenience).
  const requiredToken = process.env.ACCESS_TOKEN;
  if (requiredToken) {
    const provided = req.headers['x-access-token'] ?? '';
    if (provided !== requiredToken) {
      return res.status(401).json({ detail: 'Unauthorised' });
    }
  }

  // --- Rate limit -----------------------------------------------------------
  const ip = (
    req.headers['x-forwarded-for']?.split(',')[0] ??
    req.socket?.remoteAddress ??
    'unknown'
  ).trim();

  if (isRateLimited(ip)) {
    return res.status(429).json({
      detail: 'Rate limit exceeded — maximum 20 requests per hour per user.',
    });
  }

  // --- Parse body -----------------------------------------------------------
  const { system, messages } = req.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ detail: 'messages must not be empty' });
  }

  // --- API key --------------------------------------------------------------
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      detail: 'ANTHROPIC_API_KEY is not set in Vercel environment variables.',
    });
  }

  // --- Call Anthropic -------------------------------------------------------
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: MAX_TOKENS,
        system:     system ?? '',
        messages:   trimMessages(messages),
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        detail: data?.error?.message ?? `Anthropic API error ${upstream.status}`,
      });
    }

    return res.status(200).json({ content: data.content[0].text });

  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
}
