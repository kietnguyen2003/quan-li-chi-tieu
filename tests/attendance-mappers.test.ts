import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { format, parseISO } from 'date-fns'
import { mapAttendanceRows, classToRow, sessionToRow, paymentToRow, calendarDate, assertUuid, getDataErrorMessage, scheduleToRow, AttendanceValidationError } from '../src/data/attendance-mappers.ts'

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const classId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const classItem = { id: classId, name: ' Toán ', salary: 150000, durationHours: 1.5, note: '' }

describe('attendance database mapping', () => {
  it('joins recurring schedules and exceptions, converts numeric strings and preserves archived history', () => {
    const data = mapAttendanceRows({
      classes: [{ id: classId, name: 'Toán', salary_per_hour: '150000.00', default_duration_hours: '1.500', note: '', archived_at: '2026-09-01T00:00:00Z' }],
      schedules: [{ id, class_id: classId, weekday: 2, start_time: '09:00:00', enabled: true }],
      exceptions: [{ schedule_id: id, exception_date: '2026-09-22' }],
      sessions: [{ id, class_id: classId, session_date: '2026-09-22', start_time: '09:00:00', end_time: '10:30:00', session_hours: '1.500', session_amount: '0.00' }],
      payments: [{ id, payment_date: '2026-09-22', amount: '225000.00', note: 'Lương' }],
    })
    assert.equal(data.classes[0].salary, 150000)
    assert.equal(data.classes[0].archivedAt, '2026-09-01T00:00:00Z')
    assert.deepEqual(data.classes[0].recurringSchedule?.skippedDates, ['2026-09-22'])
    assert.equal(data.classes[0].recurringSchedule?.startTime, '09:00')
    assert.equal(data.checkIns[0].sessionAmount, 0)
    assert.equal(data.checkIns[0].timeRange, '09:00 -> 10:30')
    assert.equal(format(parseISO(data.checkIns[0].date), 'yyyy-MM-dd HH:mm'), '2026-09-22 12:00')
    assert.equal(format(parseISO(data.salaryPayments[0].date), 'yyyy-MM-dd'), '2026-09-22')
  })
  it('snapshots default hours and salary, preserving explicit zero amounts', () => {
    const item = { id, classId, date: '2026-09-22T12:00:00' }
    assert.equal(sessionToRow(userId, item, classItem).session_amount, 300000)
    assert.equal(sessionToRow(userId, { ...item, sessionAmount: 0 }, classItem).session_amount, 0)
    assert.equal(sessionToRow(userId, { ...item, sessionHours: 2 }, classItem).session_amount, 300000)
    assert.equal(sessionToRow(userId, { ...item, startTime: '23:00', endTime: '01:00' }, classItem).end_time, '01:00')
  })
  it('uses local calendar dates and rejects invalid dates', () => {
    assert.equal(calendarDate('2026-09-22T12:00:00'), '2026-09-22')
    for (const value of ['2026-02-30', 'no date', '']) assert.throws(() => calendarDate(value))
  })
  it('validates IDs, names, amounts, hours and both session times', () => {
    assert.throws(() => assertUuid('local-id'))
    assert.equal(classToRow(userId, classItem).name, 'Toán')
    for (const salary of [-1, Infinity, NaN, 1e12]) assert.throws(() => classToRow(userId, { ...classItem, salary }))
    for (const durationHours of [0, -1, 25, NaN]) assert.throws(() => classToRow(userId, { ...classItem, durationHours }))
    assert.throws(() => classToRow(userId, { ...classItem, name: '  ' }))
    const item = { id, classId, date: '2026-09-22' }
    assert.throws(() => sessionToRow(userId, { ...item, startTime: '09:00' }, classItem))
    assert.throws(() => sessionToRow(userId, { ...item, startTime: '25:00', endTime: '10:00' }, classItem))
    assert.throws(() => sessionToRow(userId, { ...item, classId: id }, classItem))
    assert.throws(() => paymentToRow(userId, { id, date: item.date, amount: 0, note: '' }))
  })
  it('does not leak raw database errors', () => {
    assert.match(getDataErrorMessage({ code: '23505' }), /trùng/)
    assert.match(getDataErrorMessage({ code: '23503' }), /lịch sử/)
    assert.match(getDataErrorMessage({ code: '42501' }), /đăng nhập/)
    assert.match(getDataErrorMessage(new TypeError('Failed to fetch')), /kết nối/)
    assert.equal(getDataErrorMessage(new Error('private detail')), getDataErrorMessage(null))
  })
})


describe('optional schedules and error recovery', () => {
  it('validates schedules and exceptions before persistence', () => {
    assert.equal(scheduleToRow(userId, classItem), null)
    const recurringSchedule = { weekday: 0, startTime: '00:00', enabled: false, skippedDates: ['2026-09-22'] }
    assert.deepEqual(scheduleToRow(userId, { ...classItem, recurringSchedule }), { user_id: userId, class_id: classId, weekday: 0, start_time: '00:00', enabled: false })
    for (const weekday of [-1, 7, 1.5, NaN]) assert.throws(() => scheduleToRow(userId, { ...classItem, recurringSchedule: { ...recurringSchedule, weekday } }))
    assert.throws(() => scheduleToRow(userId, { ...classItem, recurringSchedule: { ...recurringSchedule, skippedDates: ['2026-02-30'] } }))
    assert.throws(() => classToRow(userId, { ...classItem, archivedAt: 'bad-date' }))
    assert.equal(classToRow(userId, { ...classItem, archivedAt: '2026-09-22T12:00:00Z' }).archived_at, '2026-09-22T12:00:00Z')
    assert.equal(paymentToRow(userId, { id, date: '2026-09-22', amount: 1, note: 'ok' }).amount, 1)
  })
  it('maps unscheduled classes and sessions without times', () => {
    const data = mapAttendanceRows({ classes: [{ id: classId, name: 'Toán', salary_per_hour: 0, default_duration_hours: 1, note: '', archived_at: null }], sessions: [{ id, class_id: classId, session_date: '2026-09-22', start_time: null, end_time: null, session_hours: 1, session_amount: 0 }], schedules: [], exceptions: [], payments: [] })
    assert.equal(data.classes[0].recurringSchedule, undefined)
    assert.equal(data.classes[0].archivedAt, undefined)
    assert.equal(data.checkIns[0].timeRange, undefined)
    assert.deepEqual(mapAttendanceRows({ classes: [], sessions: [], schedules: [], exceptions: [], payments: [] }), { classes: [], checkIns: [], salaryPayments: [] })
  })
  it('explains timeouts, invalid data and local validation safely', () => {
    assert.match(getDataErrorMessage(new DOMException('signal timed out', 'TimeoutError')), /quá lâu/)
    assert.match(getDataErrorMessage({ message: 'AbortError: signal is aborted' }), /quá lâu/)
    for (const code of ['23514', '22P02']) assert.match(getDataErrorMessage({ code }), /không hợp lệ/)
    assert.equal(getDataErrorMessage(new AttendanceValidationError('Ngày không hợp lệ.')), 'Ngày không hợp lệ.')
    assert.equal(getDataErrorMessage({}), getDataErrorMessage(null))
  })
})

for (const [name, hours, billedHours] of [
  ['Sally', 1, 1], ['Sally', 1.5, 2], ['Sally', 2, 2], ['Sally', 2.5, 3],
  ['Hamza', 1, 1], ['Hamza', 1.5, 1], ['Hamza', 2, 2], ['Hamza', 2.5, 2],
  ['  hAMZa  ', 1.5, 1], ['Hamza group', 1.5, 2],
] as const) {
  it(`bills ${name} ${hours}h as ${billedHours}h while preserving actual hours and saved money`, () => {
    const target = { ...classItem, name }
    const session = { id, classId, date: '2026-09-22', sessionHours: hours }
    const row = sessionToRow(userId, session, target)
    assert.equal(row.session_hours, hours)
    assert.equal(row.session_amount, billedHours * target.salary)
    assert.equal(sessionToRow(userId, { ...session, sessionAmount: 123000 }, target).session_amount, 123000)
  })
}
