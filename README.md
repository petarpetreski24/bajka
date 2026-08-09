# bajka

Minimal web form that sends one fixed SMS to a whitelisted Macedonian number.
Static HTML + one Vercel serverless function. No dependencies, no build step, €0/month.

Message body:

```
Kupivte bilet za edno vozenje so cena od 40 denari na DD.MM.YYYY HH:mm
```

The timestamp is generated at request time in `Europe/Skopje`.

## How it works

- [index.html](index.html) — one page, one field, one button. Posts JSON to `/api/send`.
- [api/send.js](api/send.js) — validates the PIN, normalizes the number to E.164, checks it against
  the whitelist, builds the timestamp, and hands off to the provider selected by `SMS_PROVIDER`.
  Providers live in the `PROVIDERS` map at the top of that file — adding one is ~15 lines.
- [test.js](test.js) — `node test.js` checks normalization and the timestamp. Sends nothing.

Any number not in `ALLOWED_NUMBERS` gets a 403 and no provider call is made.

## Setup

1. **Plivo account** — sign up at [plivo.com](https://www.plivo.com/), no card required. Copy the
   Auth ID and Auth Token from the dashboard home. Trial credit is $10.
2. **Buy a number** — Plivo trial accounts cannot use alphanumeric sender IDs, so buy an
   SMS-capable number with the trial credit. That number, digits only, becomes `SMS_SENDER`.
3. **Verify the destination** — trial accounts only send to *sandboxed* numbers. Add
   `+389 75 560 524` in the dashboard and confirm the code it texts you.
4. **Env vars** — copy [.env.example](.env.example) to `.env.local` and fill it in.
5. **Deploy** — import the repo at [vercel.com/new](https://vercel.com/new), leave the build settings
   alone (there is no framework and no build step), and paste the variables from `.env.local` into
   Environment Variables before deploying. No CLI needed.

## Testing without spending credit

Set `DRY_RUN=1` and the endpoint returns the composed message instead of sending it:

```sh
vercel dev
```

Then submit the form and confirm the timestamp matches the wall clock in Skopje.
Unset `DRY_RUN` before the first real send.

## Diagnosing a message that never arrives

A `202` only means *accepted*. Both providers reject asynchronously, so a success response is no
proof of delivery — check the provider's own logs (Plivo: Messages log in the dashboard).

For Vonage specifically, the Reports API gives the final status:

```sh
curl -s -u "$VONAGE_API_KEY:$VONAGE_API_SECRET" -G https://api.nexmo.com/v2/reports/records \
  --data-urlencode "account_id=$VONAGE_API_KEY" \
  --data-urlencode "product=MESSAGES" \
  --data-urlencode "direction=outbound" \
  --data-urlencode "date_start=$(date -u +%Y-%m-%dT00:00:00Z)"
```

Look at `status` and `error_code` in the returned records. Codes seen so far:

| Code | Meaning | Fix |
| --- | --- | --- |
| `1474` | Non-whitelisted destination | Add the number as a verified test number in the dashboard (trial accounts only) |

A `total_price` of `0.0000` on a record confirms nothing was billed, i.e. nothing was sent.

## Notes

- **Trial accounts brand the message body.** Vonage appends `[FREE SMS DEMO, TEST MESSAGE]` until
  you top up, and Twilio prepends `Sent from your Twilio trial account -`. Since this app's whole
  point is an exact body, verify on a real handset before trusting any provider's free tier.
- Vonage was dropped because removing that suffix requires a top-up, and the only payment method
  offered was a €200 bank transfer. The `vonage` provider is kept in case that changes.
- `SMS_SENDER` for Plivo is the phone number you bought, digits only. A carrier may still rewrite
  the displayed sender; if the handset shows something else, that's the carrier, not this code.
- No rate limiting. Serverless functions are stateless, so it would need a paid store. The
  whitelist plus the optional `?k=` key is the cheap equivalent.
- `APP_PIN` is optional. Set it and bookmark `https://your-app.vercel.app/?k=THAT_VALUE` — the page
  stays a single field, but anyone who finds the bare URL gets a 401 instead of a free SMS on your
  credit. Leave it unset and the whitelist is the only gate.
