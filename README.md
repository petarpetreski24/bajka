# bajka

Minimal web form that sends one fixed SMS to a whitelisted Macedonian number.
Static HTML + one Vercel serverless function. No dependencies, no build step, €0/month.

Message body:

```
Kupivte bilet za edno vozenje so cena od 40 denari na DD.MM.YYYY HH:mm
```

The timestamp is generated at request time in `Europe/Skopje`.

## How it works

- [index.html](index.html) — the form (number + PIN), posts JSON to `/api/send`.
- [api/send.js](api/send.js) — validates the PIN, normalizes the number to E.164, checks it against
  the whitelist, builds the timestamp, and calls the Vonage Messages API with `fetch`.
- [test.js](test.js) — `node test.js` checks normalization and the timestamp. Sends nothing.

Any number not in `ALLOWED_NUMBERS` gets a 403 and no provider call is made.

## Setup

1. **Vonage account** — sign up at [vonage.com](https://www.vonage.com/communications-apis/), copy the
   API key and secret from the dashboard. Signup credit is roughly €2, about 25–30 SMS to +389.
2. **Verify the destination** — while the account is on trial, Vonage only sends to numbers you add
   as test numbers in the dashboard. Add `+389 75 560 524` there.
3. **Env vars** — copy [.env.example](.env.example) to `.env.local` and fill it in. Pick any PIN.
4. **Deploy**

   ```sh
   npm i -g vercel
   vercel            # link and deploy a preview
   ```

   Add the five variables in the Vercel dashboard (Settings → Environment Variables), or:

   ```sh
   vercel env add VONAGE_API_KEY
   vercel env add VONAGE_API_SECRET
   vercel env add SMS_SENDER
   vercel env add ALLOWED_NUMBERS
   vercel env add APP_PIN
   vercel --prod
   ```

## Testing without spending credit

Set `DRY_RUN=1` and the endpoint returns the composed message instead of sending it:

```sh
vercel dev
```

Then submit the form and confirm the timestamp matches the wall clock in Skopje.
Unset `DRY_RUN` before the first real send.

## Notes

- Uses the **Messages API** (`api.nexmo.com/v1/messages`) with Basic auth, which is what new Vonage
  accounts are provisioned for. If sends fail complaining about the API type, check
  Dashboard → Settings → *Default SMS Setting* and make sure it is set to **Messages API**.
- `SMS_SENDER` defaults to `Vonage APIs`. A custom alphanumeric ID may be silently replaced by the
  Macedonian carrier; if the handset shows something else, that's the carrier, not this code.
- No rate limiting. Serverless functions are stateless, so it would need a paid store. The PIN plus
  a one-number whitelist is the cheap equivalent.
