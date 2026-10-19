// PRD v3.0 section 7.6 worked examples, plus edge cases from 7.4 and 7.5.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  cancelInChain,
  cancelReturnsCredit,
  checkBooking,
  periodEnd,
  rechain,
  renewalStart,
  statusOn,
  type BookingCheck,
} from './membership'

const kidsPlan = { programIds: ['kids'], creditsPerCycle: 12, weeklyCap: 3 }
const base: BookingCheck = {
  classDay: '2026-03-16',
  classProgramId: 'kids',
  classProgramName: 'Kids Training',
  plan: kidsPlan,
  periodStart: '2026-03-10',
  periodEnd: '2026-04-09',
  graceDays: 3,
  usedDays: [],
  makeupCredits: 0,
}

describe('period dates (7.4)', () => {
  it('a cycle runs to the day before the same date next month', () => {
    assert.equal(periodEnd('2026-03-10', 1), '2026-04-09')
    assert.equal(periodEnd('2026-03-01', 1), '2026-03-31')
  })
  it('a start on the 31st ends on the last day of a short month', () => {
    assert.equal(periodEnd('2026-01-31', 1), '2026-02-28')
    assert.equal(periodEnd('2028-01-31', 1), '2028-02-29')
  })
  it('multi-month periods', () => {
    assert.equal(periodEnd('2026-03-10', 3), '2026-06-09')
  })
})

describe('example 1: weekly cap', () => {
  it('allows Mon, Wed, Fri and refuses a 4th class that week', () => {
    // 16 Mar 2026 is a Monday
    const used = ['2026-03-16', '2026-03-18', '2026-03-20']
    assert.deepEqual(checkBooking({ ...base, classDay: '2026-03-20', usedDays: used.slice(0, 2) }), { ok: true, usesMakeup: false })
    const r = checkBooking({ ...base, classDay: '2026-03-21', usedDays: used })
    assert.equal(r.ok, false)
    assert.equal(!r.ok && r.message, 'Weekly limit of 3 reached')
  })
  it('a new week resets the cap', () => {
    const used = ['2026-03-16', '2026-03-18', '2026-03-20']
    assert.equal(checkBooking({ ...base, classDay: '2026-03-23', usedDays: used }).ok, true)
  })
})

describe('example 2: credits per cycle', () => {
  const twelve = [
    '2026-03-10', '2026-03-11', '2026-03-12',
    '2026-03-16', '2026-03-17', '2026-03-18',
    '2026-03-23', '2026-03-24', '2026-03-25',
    '2026-03-30', '2026-03-31', '2026-04-01',
  ]
  it('refuses the 13th class in a cycle', () => {
    const r = checkBooking({ ...base, classDay: '2026-04-06', usedDays: twelve })
    assert.equal(r.ok, false)
    assert.equal(!r.ok && r.message, 'No classes left this cycle')
  })
  it('uses a make-up credit when one is available (BKG-9)', () => {
    assert.deepEqual(checkBooking({ ...base, classDay: '2026-04-06', usedDays: twelve, makeupCredits: 1 }), { ok: true, usesMakeup: true })
  })
})

describe('example 3: cancellation cut-off', () => {
  const start = new Date('2026-03-18T12:30:00Z') // 6 pm IST
  it('3 hours before returns the credit', () => {
    assert.equal(cancelReturnsCredit(start, new Date('2026-03-18T09:30:00Z'), 2), true)
  })
  it('1 hour before keeps the credit used', () => {
    assert.equal(cancelReturnsCredit(start, new Date('2026-03-18T11:30:00Z'), 2), false)
  })
})

describe('examples 4 and 5: renewal start', () => {
  it('renewing before the end continues from the day after the end', () => {
    assert.equal(renewalStart({ previousEnd: '2026-05-31', paidOn: '2026-05-29', graceDays: 3 }), '2026-06-01')
  })
  it('renewing during grace still continues from the end (grace is not free)', () => {
    assert.equal(renewalStart({ previousEnd: '2026-05-31', paidOn: '2026-06-02', graceDays: 3 }), '2026-06-01')
  })
  it('paying after grace starts on the payment date', () => {
    assert.equal(renewalStart({ previousEnd: '2026-05-31', paidOn: '2026-06-06', graceDays: 3 }), '2026-06-06')
  })
  it('first payment starts on the payment date', () => {
    assert.equal(renewalStart({ previousEnd: null, paidOn: '2026-06-06', graceDays: 3 }), '2026-06-06')
  })
})

describe('example 6: reversal re-chains queued periods', () => {
  it('May moves to April when April is reversed', () => {
    const chain = rechain(
      [
        { id: 'apr', start: '', months: 1, freezeDays: 0 },
        { id: 'may', start: '', months: 1, freezeDays: 0 },
      ],
      '2026-04-01',
    )
    assert.equal(chain[1].start, '2026-05-01')
    const after = cancelInChain(chain, 'apr')
    assert.equal(after.length, 1)
    assert.equal(after[0].id, 'may')
    assert.equal(after[0].start, '2026-04-01')
    assert.equal(after[0].end, '2026-04-30')
  })
})

describe('example 7: freeze pushes the end date', () => {
  it('a 10-day freeze moves 30 April to 10 May, and later periods follow', () => {
    const chain = rechain(
      [
        { id: 'apr', start: '', months: 1, freezeDays: 10 },
        { id: 'may', start: '', months: 1, freezeDays: 0 },
      ],
      '2026-04-01',
    )
    assert.equal(chain[0].end, '2026-05-10')
    assert.equal(chain[1].start, '2026-05-11')
  })
})

describe('example 9: plan entitlement', () => {
  it('a Group plan cannot book Adult Training', () => {
    const r = checkBooking({
      ...base,
      classProgramId: 'adult',
      classProgramName: 'Adult Training',
      plan: { programIds: ['group'], creditsPerCycle: null, weeklyCap: null },
    })
    assert.equal(r.ok, false)
    assert.equal(!r.ok && r.message, 'Your plan does not include Adult Training')
  })
  it('cannot book beyond the membership plus grace', () => {
    const r = checkBooking({ ...base, classDay: '2026-04-20' })
    assert.equal(!r.ok && r.code, 'OUTSIDE_MEMBERSHIP')
  })
})

describe('status (7.3)', () => {
  const chain = rechain([{ id: 'a', start: '', months: 1, freezeDays: 0 }], '2026-03-10')
  it('active, grace, due', () => {
    assert.equal(statusOn(chain, [], '2026-03-20', 3), 'ACTIVE')
    assert.equal(statusOn(chain, [], '2026-04-11', 3), 'GRACE')
    assert.equal(statusOn(chain, [], '2026-04-13', 3), 'DUE')
  })
  it('scheduled and frozen', () => {
    assert.equal(statusOn(chain, [], '2026-03-01', 3), 'SCHEDULED')
    assert.equal(statusOn(chain, [{ start: '2026-03-15', days: 5 }], '2026-03-17', 3), 'FROZEN')
  })
})
