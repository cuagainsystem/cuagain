// Edge Function: process-email-outbox
//
// Sends the pending rows of public.email_outbox through Brevo. In-app notifications already exist
// before this runs, so a failure here never loses an alert; the row stays visible to admins.
//
// Secrets (set with `supabase secrets set`, never put in the app or in git):
//   BREVO_API_KEY        Brevo transactional API key
//   BREVO_SENDER_EMAIL   a sender address verified in Brevo
//   BREVO_SENDER_NAME    optional, defaults to "CUAgain"
//   APP_URL              public address of the app, for example https://cuagain.pages.dev
//   WEBHOOK_SECRET       long random text; the Database Webhook sends it in x-webhook-secret
// Supabase provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY automatically.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildEmail } from './template.ts';

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 5;

interface ClaimedEmail {
  outbox_id: string;
  template: string;
  attempts: number;
  to_email: string;
  to_name: string | null;
  title: string;
  body: string | null;
  link: string | null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Compares two strings in constant time, so the secret cannot be guessed by timing. */
function sameSecret(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

async function sendWithBrevo(
  apiKey: string,
  sender: { name: string; email: string },
  to: { email: string; name: string },
  content: { subject: string; html: string; text: string },
): Promise<void> {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender,
      to: [to],
      subject: content.subject,
      htmlContent: content.html,
      textContent: content.text,
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Brevo ${response.status}: ${detail}`);
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const secret = Deno.env.get('WEBHOOK_SECRET') ?? '';
  const given = request.headers.get('x-webhook-secret') ?? '';
  if (!secret || !sameSecret(secret, given)) return json({ error: 'Not allowed.' }, 401);

  const apiKey = Deno.env.get('BREVO_API_KEY');
  const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL');
  const appUrl = Deno.env.get('APP_URL');
  if (!apiKey || !senderEmail || !appUrl) return json({ error: 'Email settings are incomplete.' }, 500);
  const sender = { name: Deno.env.get('BREVO_SENDER_NAME') ?? 'CUAgain', email: senderEmail };

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc('claim_pending_emails', { p_limit: BATCH_SIZE });
  if (error) return json({ error: 'Could not read the email queue.' }, 500);

  const batch = (data ?? []) as ClaimedEmail[];
  let sent = 0;
  let failed = 0;

  for (const item of batch) {
    try {
      const content = buildEmail({
        template: item.template,
        toName: item.to_name ?? '',
        title: item.title,
        body: item.body,
        link: item.link,
        appUrl,
      });
      await sendWithBrevo(apiKey, sender, { email: item.to_email, name: item.to_name ?? item.to_email }, content);
      await supabase
        .from('email_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
        .eq('id', item.outbox_id);
      sent += 1;
    } catch (err) {
      failed += 1;
      const message = (err instanceof Error ? err.message : 'Unknown error').slice(0, 480);
      // Stays pending for another try until the attempts run out, then it is marked failed.
      await supabase
        .from('email_outbox')
        .update({ status: item.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', last_error: message })
        .eq('id', item.outbox_id);
    }
  }

  return json({ claimed: batch.length, sent, failed });
});
