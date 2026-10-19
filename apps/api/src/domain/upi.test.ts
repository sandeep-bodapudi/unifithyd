import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildUpiLink, isValidUpiId, memberCode, normaliseUtr, upiNote } from './upi'

describe('UPI (PAY-6, PAY-8, PAY-9)', () => {
  it('member codes and notes', () => {
    assert.equal(memberCode(23), 'UF0023')
    assert.equal(upiNote([23], 'KIDS', 3), 'UF0023 KIDS MAR')
    assert.equal(upiNote([23, 24], 'KIDS', 12), 'UF0023+UF0024 KIDS DEC')
  })
  it('validates UPI IDs', () => {
    assert.equal(isValidUpiId('unifit.hyd@okhdfcbank'), true)
    assert.equal(isValidUpiId('no-at-sign'), false)
    assert.equal(isValidUpiId('a@1bank'), false)
  })
  it('builds a link with the exact amount and the note', () => {
    const link = buildUpiLink({ upiId: 'unifit@okaxis', payeeName: 'Unifit Hyd', amountPaise: 300000, note: 'UF0023 KIDS MAR' })
    assert.equal(link, 'upi://pay?pa=unifit%40okaxis&pn=Unifit%20Hyd&am=3000.00&cu=INR&tn=UF0023%20KIDS%20MAR')
  })
  it('rejects bad amounts', () => {
    assert.throws(() => buildUpiLink({ upiId: 'unifit@okaxis', payeeName: 'x', amountPaise: 0, note: '' }))
  })
  it('UTR is 12 digits', () => {
    assert.equal(normaliseUtr('4123 4567 8901'), '412345678901')
    assert.equal(normaliseUtr('12345'), null)
  })
})
