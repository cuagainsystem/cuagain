# Phase 6 email setup (Brevo), step by step

CUAgain always saves the in-app notification first. The email is an extra. If email is not set up yet,
everything in the app still works; emails just wait in the queue (admins can see it).

You do these steps once. Nothing here goes into the app code or into git.

## 1. Brevo account and sender

1. Create a free account at brevo.com.
2. Brevo: Senders, Domains and Dedicated IPs, Senders: add the address emails will come from and
   verify it with the link Brevo sends. (A school-owned address is best. A personal Gmail address works
   for testing but may land in spam.)
3. Brevo: SMTP and API, API Keys: create a key named `cuagain`. Copy it once; Brevo will not show it again.

## 2. Deploy the function

Install the Supabase CLI, then in the project folder:

```
supabase login
supabase link --project-ref moplevpqrcphrdvadabh
supabase functions deploy process-email-outbox --no-verify-jwt
```

`--no-verify-jwt` is correct here: the function protects itself with the secret in step 3.

## 3. Set the secrets

Make up a long random text for WEBHOOK_SECRET (for example 40 random letters and digits).

```
supabase secrets set BREVO_API_KEY=your-brevo-key
supabase secrets set BREVO_SENDER_EMAIL=the-verified-sender@example.com
supabase secrets set BREVO_SENDER_NAME=CUAgain
supabase secrets set APP_URL=https://your-live-app-address
supabase secrets set WEBHOOK_SECRET=your-long-random-text
```

## 4. Make new emails send right away (Database Webhook)

Supabase dashboard: Integrations, Database Webhooks, Create a new hook.

- Name: `send-email-outbox`
- Table: `email_outbox`, event: Insert
- Type: Supabase Edge Functions, function: `process-email-outbox`, method POST
- Add an HTTP header: `x-webhook-secret` with the same value as WEBHOOK_SECRET

## 5. Retry anything that failed (optional but recommended)

A failed email stays pending and is tried again up to 5 times. To retry automatically every 5 minutes,
enable the `pg_cron` and `pg_net` extensions (Database, Extensions) and run this once in the SQL editor,
replacing the two placeholders:

```sql
select cron.schedule(
  'retry-email-outbox', '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://moplevpqrcphrdvadabh.supabase.co/functions/v1/process-email-outbox',
       headers := jsonb_build_object('x-webhook-secret', 'your-long-random-text', 'content-type', 'application/json'),
       body := '{}'::jsonb) $$
);
```

## 6. Check it works

1. Sign in, open Notifications, keep "Email me about my reports and claims" on.
2. Submit a report. A "Report submitted" email should arrive within a minute.
3. If not: Supabase, Edge Functions, process-email-outbox, Logs. Also, as admin, check the
   `email_outbox` table: `last_error` says what Brevo answered.

## 7. Registration and password-reset emails (Supabase Auth)

These are sent by Supabase Auth, not by the function above. To send them through Brevo too:

1. Brevo: SMTP and API, SMTP: copy the SMTP server, port, login and generate an SMTP key.
2. Supabase: Authentication, Emails, SMTP Settings: turn on custom SMTP and enter the sender
   address (the same verified sender), the Brevo host, port 587, the login and the SMTP key.
3. Authentication, URL Configuration: set the Site URL to your live app address and add it to Redirect URLs.

Without custom SMTP, Supabase's built-in sender is limited to a few emails per hour and is meant for testing only.
