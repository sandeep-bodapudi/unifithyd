// UPI payment link and note: PRD v3.0 PAY-1, PAY-6, PAY-9.

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** UF0023 */
export function memberCode(memberNo: number): string {
  return `UF${String(memberNo).padStart(4, '0')}`
}

/** "UF0023 KIDS MAR", or "UF0023+UF0024 KIDS MAR" for one payment covering several children */
export function upiNote(memberNos: number[], planShortCode: string, cycleStartMonth: number): string {
  return `${memberNos.map(memberCode).join('+')} ${planShortCode} ${MONTHS[cycleStartMonth - 1]}`
}

/** handle@bank: letters, digits, dot, hyphen or underscore, then @ and a provider handle */
export function isValidUpiId(id: string): boolean {
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/.test(id.trim())
}

export function buildUpiLink(opts: { upiId: string; payeeName: string; amountPaise: number; note: string }): string {
  if (!isValidUpiId(opts.upiId)) throw new Error('Invalid UPI ID')
  if (!Number.isInteger(opts.amountPaise) || opts.amountPaise <= 0) throw new Error('Invalid amount')
  const params = new URLSearchParams({
    pa: opts.upiId.trim(),
    pn: opts.payeeName.trim(),
    am: (opts.amountPaise / 100).toFixed(2),
    cu: 'INR',
    tn: opts.note,
  })
  // UPI apps expect %20 rather than + for spaces
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`
}

/** UTR: 12 digits (PAY-8) */
export function normaliseUtr(raw: string): string | null {
  const digits = raw.replace(/\s/g, '')
  return /^\d{12}$/.test(digits) ? digits : null
}
