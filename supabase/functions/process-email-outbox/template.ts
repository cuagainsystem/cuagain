// Builds the subject, HTML and plain-text body of one email. Pure functions, no network,
// so they can be tested anywhere. No emojis; the look matches the app (red and white).

export interface EmailInput {
  template: string;
  toName: string;
  title: string;
  body: string | null;
  link: string | null;
  appUrl: string;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const HEADLINES: Record<string, string> = {
  report_submitted: 'Your report was submitted',
  claim_received: 'Someone claimed an item you found',
  claim_submitted: 'A new ownership claim needs review',
  claim_resubmitted: 'A claimant sent more information',
  claim_approved: 'Your claim was approved',
  claim_rejected: 'Your claim was not approved',
  claim_more_info_required: 'More information is needed for your claim',
  claim_completed: 'Handover confirmed',
  item_returned: 'Your item was returned',
  message_request: 'You have a new message request',
  message_request_accepted: 'Your message request was accepted',
  new_message: 'You have a new message',
};

const BUTTONS: Record<string, string> = {
  report_submitted: 'View your report',
  claim_received: 'View the report',
  claim_submitted: 'Review the claim',
  claim_resubmitted: 'Review the claim',
  claim_approved: 'View your claim',
  claim_rejected: 'View your claim',
  claim_more_info_required: 'Add information',
  claim_completed: 'View your claim',
  item_returned: 'View details',
  message_request: 'See the request',
  message_request_accepted: 'Open the conversation',
  new_message: 'Read the message',
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only same-app paths become links. Anything else is dropped so a bad row cannot send people elsewhere. */
export function buildLink(appUrl: string, link: string | null): string | null {
  if (!link || !link.startsWith('/') || link.startsWith('//')) return null;
  return appUrl.replace(/\/+$/, '') + link;
}

export function buildEmail(input: EmailInput): EmailContent {
  const headline = HEADLINES[input.template] ?? input.title;
  const button = BUTTONS[input.template] ?? 'Open CUAgain';
  const url = buildLink(input.appUrl, input.link);
  const name = input.toName.trim() || 'there';
  const detail = (input.body ?? '').trim();
  const subject = `CUAgain: ${headline}`;

  const text = [
    `Hello ${name},`,
    '',
    headline + (detail ? `: ${detail}` : '.'),
    ...(url ? ['', `${button}: ${url}`] : []),
    '',
    'You are receiving this because of your CUAgain notification settings.',
    'You can change them any time on the Notifications page.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#f6f1f1;font-family:Arial,Helvetica,sans-serif;color:#2a1f1f;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1f1;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:#b3202a;padding:18px 28px;color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:0.3px;">CUAgain</td></tr>
<tr><td style="padding:28px;">
<p style="margin:0 0 6px;font-size:14px;color:#6b5a5a;">Hello ${escapeHtml(name)},</p>
<h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:#2a1f1f;">${escapeHtml(headline)}</h1>
${detail ? `<p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#2a1f1f;">${escapeHtml(detail)}</p>` : ''}
${url ? `<p style="margin:0 0 22px;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#b3202a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:15px;font-weight:bold;">${escapeHtml(button)}</a></p>` : ''}
<p style="margin:0;font-size:12px;line-height:1.5;color:#8a7878;">You are receiving this because of your CUAgain notification settings. You can change them any time on the Notifications page.</p>
</td></tr>
</table>
<p style="margin:14px 0 0;font-size:12px;color:#8a7878;">Capitol University lost and found</p>
</td></tr>
</table>
</body></html>`;

  return { subject, html, text };
}
