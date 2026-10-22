// server/mailer.js
// Outbound e-mail for verification and password-reset codes.
// Configured from server/data/smtp.json (mode 600, gitignored) or env:
//   TC_SMTP_HOST, TC_SMTP_PORT, TC_SMTP_USER, TC_SMTP_PASS, TC_SMTP_FROM, TC_SMTP_SECURE
// When no SMTP is configured, codes stay in the server outbox and an
// administrator delivers them (admin console → user → send reset). The API
// tells the client which mode is active so the UI never promises an e-mail
// that will not arrive.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONF_FILE = path.join(__dirname, 'data', 'smtp.json');

let transport = null;
let conf = null;
let lastError = null;

function loadConf() {
  let c = null;
  try { c = JSON.parse(fs.readFileSync(CONF_FILE, 'utf8')); } catch (e) { c = null; }
  if (!c && process.env.TC_SMTP_HOST) {
    c = {
      host: process.env.TC_SMTP_HOST, port: Number(process.env.TC_SMTP_PORT || 587),
      user: process.env.TC_SMTP_USER, pass: process.env.TC_SMTP_PASS,
      from: process.env.TC_SMTP_FROM, secure: process.env.TC_SMTP_SECURE === 'true'
    };
  }
  if (!c || !c.host || !c.from) return null;
  return c;
}

export async function initMailer() {
  conf = loadConf();
  if (!conf) { transport = null; return false; }
  try {
    const nodemailer = (await import('nodemailer')).default;
    transport = nodemailer.createTransport({
      host: conf.host, port: conf.port || 587, secure: !!conf.secure,
      auth: conf.user ? { user: conf.user, pass: conf.pass } : undefined,
      disableFileAccess: true, disableUrlAccess: true,
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
    });
    return true;
  } catch (e) {
    lastError = e.message; transport = null; return false;
  }
}

export function mailEnabled() { return !!transport; }
export function mailStatus() { return { enabled: !!transport, host: conf?.host || null, lastError }; }

const SUBJECTS = {
  verify: { fa: 'کد تأیید ایمیل چارتیویا', en: 'Your Chartivia verification code' },
  reset: { fa: 'کد بازیابی گذرواژه چارتیویا', en: 'Your Chartivia password reset code' }
};

export async function sendCode(kind, email, code) {
  if (!transport) return false;
  const s = SUBJECTS[kind] || SUBJECTS.verify;
  const text = `${s.fa}: ${code}\nاین کد تا ۱۵ دقیقه معتبر است. اگر این درخواست از طرف شما نبوده، این پیام را نادیده بگیرید.\n\n${s.en}: ${code}\nThis code expires in 15 minutes. If you did not request it, ignore this message.`;
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:14px;line-height:1.8">${s.fa}:<div style="font-size:26px;font-weight:700;letter-spacing:6px;direction:ltr;margin:10px 0">${code}</div>این کد تا ۱۵ دقیقه معتبر است. اگر این درخواست از طرف شما نبوده، این پیام را نادیده بگیرید.</div><hr><div dir="ltr" style="font-family:Arial,sans-serif;font-size:13px;color:#555">${s.en}: <b>${code}</b> — expires in 15 minutes.</div>`;
  try {
    await transport.sendMail({ from: conf.from, to: email, subject: `${s.fa} | ${s.en}`, text, html });
    lastError = null;
    return true;
  } catch (e) {
    lastError = e.message;
    console.error('[mailer] send failed:', e.message);
    return false;
  }
}
