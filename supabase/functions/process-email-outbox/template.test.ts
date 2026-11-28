// Run with: node --experimental-strip-types supabase/functions/process-email-outbox/template.test.ts
import assert from 'node:assert/strict';
import { buildEmail, buildLink, escapeHtml } from './template.ts';

const base = { toName: 'Dave', title: 't', body: 'Blue bottle', link: '/claims/abc', appUrl: 'https://app.test/' };

const a = buildEmail({ ...base, template: 'claim_approved' });
assert.equal(a.subject, 'CUAgain: Your claim was approved');
assert.ok(a.html.includes('href="https://app.test/claims/abc"'));
assert.ok(a.text.includes('https://app.test/claims/abc'));

const x = buildEmail({ ...base, template: 'claim_rejected', toName: '<b>x</b>', body: '<script>alert(1)</script>' });
assert.ok(!x.html.includes('<script>') && !x.html.includes('<b>x</b>'));

assert.equal(buildLink('https://app.test', 'https://evil.test'), null);
assert.equal(buildLink('https://app.test', '//evil.test'), null);
assert.equal(buildLink('https://app.test', null), null);
assert.equal(buildLink('https://app.test/', '/messages'), 'https://app.test/messages');

const n = buildEmail({ ...base, template: 'unknown_type', link: null, body: null });
assert.equal(n.subject, 'CUAgain: t');
assert.ok(!n.html.includes('<a '));
assert.equal(escapeHtml(`"'&`), '&quot;&#39;&amp;');
assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(a.html + a.text), 'no emojis');
console.log('template tests passed');
