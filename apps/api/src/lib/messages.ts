// Notifications (PRD 8.8). Every message is logged once per dedupe key (MSG-5).
// Email goes through Resend when RESEND_API_KEY is set; otherwise it is printed
// to the console so development works without a provider. WhatsApp and SMS fall
// back to email until a provider is configured (MSG-2).
import { prisma } from '../db'
import { env } from '../env'

type Data = Record<string, string | number | undefined>

const TEMPLATES: Record<string, (d: Data) => { subject: string; text: string }> = {
  login_code: (d) => ({ subject: `Your Unifit login code: ${d.code}`, text: `Your Unifit.hyd login code is ${d.code}. It expires in 10 minutes. If you did not ask for it, ignore this message.` }),
  welcome: (d) => ({ subject: 'Welcome to Unifit.hyd', text: `Hi ${d.name}, welcome to Unifit.hyd! Your member code is ${d.code}. Pick a plan and book your first class in the app.` }),
  booking_confirmed: (d) => ({ subject: `Booked: ${d.title}, ${d.when}`, text: `${d.profile} is booked for ${d.title} on ${d.when}. ${d.where ?? ''}` }),
  booking_cancelled: (d) => ({ subject: `Cancelled: ${d.title}, ${d.when}`, text: `${d.profile}'s booking for ${d.title} on ${d.when} is cancelled. ${d.credit}` }),
  class_changed: (d) => ({ subject: `Class changed: ${d.title}`, text: `${d.title} has changed: ${d.change}. You can cancel without using a class if this no longer suits you.` }),
  class_cancelled: (d) => ({ subject: `Class cancelled: ${d.title}, ${d.when}`, text: `Sorry, ${d.title} on ${d.when} is cancelled by the studio. The class is back on your plan${d.makeup ? ' and you have a make-up class' : ''}.` }),
  reminder: (d) => ({ subject: `Reminder: ${d.title} at ${d.time}`, text: `${d.profile} has ${d.title} today at ${d.time}. ${d.where ?? ''}` }),
  waitlist_promoted: (d) => ({ subject: `You're in: ${d.title}, ${d.when}`, text: `A spot opened and ${d.profile} is now booked for ${d.title} on ${d.when}.` }),
  payment_pending: (d) => ({ subject: 'We received your payment details', text: `Thanks! We received UTR ${d.utr} for ${d.amount}. We will confirm it shortly.` }),
  payment_verified: (d) => ({ subject: `Payment confirmed, receipt ${d.receipt}`, text: `Your payment of ${d.amount} for ${d.plan} is confirmed. Membership for ${d.profile} runs until ${d.until}. Receipt: ${d.receipt}.` }),
  payment_rejected: (d) => ({ subject: 'We could not confirm your payment', text: `We could not match your payment (UTR ${d.utr}). Reason: ${d.reason}. Please contact the studio.` }),
  expiry_soon: (d) => ({ subject: `${d.profile}'s membership ends on ${d.until}`, text: `${d.profile}'s ${d.plan} membership ends on ${d.until}. Renew in the app to keep booking.` }),
  expiry_today: (d) => ({ subject: `${d.profile}'s membership ends today`, text: `${d.profile}'s ${d.plan} membership ends today. Renew in the app to keep booking.` }),
  now_due: (d) => ({ subject: `${d.profile}'s membership is due`, text: `${d.profile}'s ${d.plan} membership has ended. Renew in the app to book classes again.` }),
  freeze_applied: (d) => ({ subject: 'Membership paused', text: `${d.profile}'s membership is paused for ${d.days} days from ${d.from}. It now ends on ${d.until}.` }),
  admin_daily: (d) => ({ subject: `Unifit daily summary, ${d.date}`, text: `Pending payments: ${d.pending}. Entering Due today: ${d.due}. In grace: ${d.grace}. Leads to follow up: ${d.leads}.` }),
  admin_alert: (d) => ({ subject: `Unifit alert: ${d.title}`, text: String(d.text) }),
  coach_message: (d) => ({ subject: `Message about ${d.title}`, text: String(d.text) }),
}

export type Template = keyof typeof TEMPLATES

export async function sendMessage(opts: { accountId: string; template: Template; data: Data; dedupeKey: string }) {
  const account = await prisma.account.findUnique({ where: { id: opts.accountId } })
  if (!account || account.disabled) return
  const existing = await prisma.messageLog.findUnique({ where: { dedupeKey: opts.dedupeKey } })
  if (existing) return // already sent: jobs can run twice safely
  const { subject, text } = TEMPLATES[opts.template](opts.data)
  const log = await prisma.messageLog.create({
    data: { accountId: account.id, channel: 'EMAIL', template: opts.template, dedupeKey: opts.dedupeKey, status: 'QUEUED' },
  })
  await deliver(log.id, account.email, subject, text)
}

async function deliver(logId: string, to: string, subject: string, text: string, attempt = 1): Promise<void> {
  try {
    let providerId: string | null = null
    if (env.RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.MAIL_FROM, to, subject, text, html: emailHtml(subject, text) }),
      })
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
      providerId = ((await res.json()) as { id?: string }).id ?? null
    } else {
      console.log(`\n[email to ${to}] ${subject}\n${text}\n`)
    }
    await prisma.messageLog.update({ where: { id: logId }, data: { status: 'SENT', attempts: attempt, providerId, sentAt: new Date() } })
  } catch (e) {
    const failed = attempt >= 3
    await prisma.messageLog.update({ where: { id: logId }, data: { status: failed ? 'FAILED' : 'QUEUED', attempts: attempt, error: String(e) } })
    if (!failed) setTimeout(() => void deliver(logId, to, subject, text, attempt + 1), 2 ** attempt * 1000)
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// Branded email (MSG-4): navy header with the wordmark colours on a light body
function emailHtml(subject: string, text: string) {
  return `<!doctype html><html><body style="margin:0;background:#F5F7FB;font-family:Segoe UI,Roboto,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0B1F3F;padding:20px 28px;font:800 italic 24px Poppins,Arial,sans-serif;color:#fff">uni<span style="color:#4AA82A">fit</span><span style="color:#9FB4D3">.hyd</span></td></tr>
<tr><td style="padding:28px;color:#12335F"><h1 style="font-size:20px;margin:0 0 12px">${esc(subject)}</h1><p style="font-size:15px;line-height:1.6;margin:0">${esc(text)}</p></td></tr>
<tr><td style="padding:16px 28px;background:#EAF0F8;color:#4A5D78;font-size:12px;letter-spacing:.2em">TRAIN • TRANSFORM • THRIVE</td></tr>
</table></td></tr></table></body></html>`
}

/** Send to every admin and the owner */
export async function notifyAdmins(template: Template, data: Data, dedupeKey: string) {
  const admins = await prisma.account.findMany({ where: { disabled: false, roles: { some: { role: { in: ['ADMIN', 'OWNER'] } } } } })
  for (const a of admins) await sendMessage({ accountId: a.id, template, data, dedupeKey: `${dedupeKey}:${a.id}` })
}
