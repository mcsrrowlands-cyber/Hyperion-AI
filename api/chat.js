// ---------------------------------------------------------------------------
// In-memory rate limiter (resets when the serverless instance cold-starts,
// which is fine — Vercel instances are per-region and short-lived).
// ---------------------------------------------------------------------------

const RATE_LIMIT   = 20;          // max requests per IP per window
const WINDOW_MS    = 60 * 60 * 1000; // 1 hour
const MAX_TOKENS   = 2000;        // max tokens per response
const ipStore      = new Map();   // ip -> { count, windowStart }

function isRateLimited(ip) {
  const now   = Date.now();
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

  // --- Call Anthropic with streaming ----------------------------------------
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
        stream:     true,
        system:     system ?? '',
        messages:   trimMessages(messages),
      }),
    });

    if (!upstream.ok) {
      const errData = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({
        detail: errData?.error?.message ?? `Anthropic API error ${upstream.status}`,
      });
    }

    // --- Stream SSE back to client ------------------------------------------
    // Piping chunks as they arrive prevents Vercel function timeout — the
    // connection stays alive as long as tokens are flowing from Anthropic.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const reader  = upstream.body.getReader();
    const decoder = new TextDecoder();
    let fullText  = '';
    let buf       = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const evt = JSON.parse(data);
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            fullText += evt.delta.text;
            res.write(`data: ${JSON.stringify({ delta: evt.delta.text })}\n\n`);
          }
          if (evt.type === 'message_stop') {
            res.write(`data: ${JSON.stringify({ done: true, content: fullText })}\n\n`);
          }
        } catch (_) {
          // skip malformed SSE lines
        }
      }
    }

    res.end();

  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ detail: err.message });
    }
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}
