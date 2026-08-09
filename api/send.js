const DEFAULT_ALLOWED = '+38975560524';

/**
 * Normalize a Macedonian mobile number to E.164 (+389XXXXXXXX).
 * Accepts: +389 75 560 524, 0038975560524, 38975560524, 075 560 524, 75560524
 * Returns null if the input can't be read as a Macedonian mobile number.
 */
export function normalize(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  if (!digits) return null;

  let national;
  if (digits.startsWith('00389')) national = digits.slice(5);
  else if (digits.startsWith('389')) national = digits.slice(3);
  else if (digits.startsWith('0')) national = digits.slice(1);
  else national = digits;

  // Macedonian mobiles are 7X XXX XXX — 8 digits nationally, first digit 7.
  if (!/^7\d{7}$/.test(national)) return null;
  return `+389${national}`;
}

/** DD.MM.YYYY HH:mm in Europe/Skopje (Vercel runs in UTC, so the zone is explicit). */
export function skopjeStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Skopje',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

  const expectedPin = process.env.APP_PIN;
  if (!expectedPin) return res.status(500).json({ ok: false, error: 'APP_PIN is not configured' });
  if (!constantTimeEqual(String(body.pin || ''), expectedPin)) {
    return res.status(401).json({ ok: false, error: 'Wrong PIN' });
  }

  const to = normalize(body.number);
  const allowed = (process.env.ALLOWED_NUMBERS || DEFAULT_ALLOWED)
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);

  if (!to || !allowed.includes(to)) {
    return res.status(403).json({ ok: false, error: 'This number is not allowed' });
  }

  const text = `Kupivte bilet za edno vozenje so cena od 40 denari na ${skopjeStamp()}`;

  if (process.env.DRY_RUN === '1') {
    return res.status(200).json({ ok: true, dryRun: true, to, text });
  }

  const { VONAGE_API_KEY, VONAGE_API_SECRET, SMS_SENDER } = process.env;
  if (!VONAGE_API_KEY || !VONAGE_API_SECRET || !SMS_SENDER) {
    return res.status(500).json({ ok: false, error: 'SMS provider is not configured' });
  }

  let payload;
  try {
    const upstream = await fetch('https://rest.nexmo.com/sms/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        api_key: VONAGE_API_KEY,
        api_secret: VONAGE_API_SECRET,
        from: SMS_SENDER,
        to: to.replace('+', ''),
        text,
      }),
    });
    payload = await upstream.json();
  } catch (err) {
    return res.status(502).json({ ok: false, error: `Could not reach SMS provider: ${err.message}` });
  }

  // Vonage answers 200 even when the send fails; status "0" in the first message is the real result.
  const result = payload?.messages?.[0];
  if (result?.status !== '0') {
    return res.status(502).json({
      ok: false,
      error: result?.['error-text'] || 'SMS provider rejected the message',
      providerStatus: result?.status ?? null,
    });
  }

  return res.status(200).json({
    ok: true,
    to,
    text,
    messageId: result['message-id'],
    remainingBalance: result['remaining-balance'],
  });
}
