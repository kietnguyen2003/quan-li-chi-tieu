import { supabase } from '../service/supabase/create-client'
import type { ClassCheckIn, SalaryPayment, TeachingClass } from '../types'
import { assertUuid, calendarDate, classToRow, mapAttendanceRows, paymentToRow, scheduleToRow, sessionToRow } from './attendance-mappers'
import type { AttendanceData, ClassRow, ExceptionRow, PaymentRow, ScheduleRow, SessionRow } from './attendance-mappers'
export type { AttendanceData } from './attendance-mappers'
export { getDataErrorMessage } from './attendance-mappers'

const REQUEST_TIMEOUT_MS = 15_000
function requestSignal(): AbortSignal { return AbortSignal.timeout(REQUEST_TIMEOUT_MS) }

function client() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}
function verifyIds(userId: string, id?: string) {
  assertUuid(userId)
  if (id) assertUuid(id)
}
async function allRows<T>(table: string, userId: string, filter?: { column: string; value: string }): Promise<T[]> {
  const pageSize = 1000
  let result: T[] = []
  for (let offset = 0; ; offset += pageSize) {
    let query = client().from(table).select('*').eq('user_id', userId).order('id').range(offset, offset + pageSize - 1).abortSignal(requestSignal())
    if (filter) query = query.eq(filter.column, filter.value)
    const { data, error } = await query.retry(false)
    if (error) throw error
    const page = (data ?? []) as T[]
    result = [...result, ...page]
    if (page.length < pageSize) return result
  }
}
export async function loadAttendance(userId: string): Promise<AttendanceData> {
  verifyIds(userId)
  const [classes, sessions, payments, schedules, exceptions] = await Promise.all([
    allRows<ClassRow>('classes', userId), allRows<SessionRow>('teaching_sessions', userId),
    allRows<PaymentRow>('salary_payments', userId), allRows<ScheduleRow>('recurring_schedules', userId),
    allRows<ExceptionRow>('recurring_schedule_exceptions', userId),
  ])
  return mapAttendanceRows({ classes, sessions, payments, schedules, exceptions })
}
export async function saveClass(userId: string, item: TeachingClass): Promise<void> {
  const row = classToRow(userId, item)
  const schedule = scheduleToRow(userId, item)
  const dates = [...new Set((item.recurringSchedule?.skippedDates ?? []).map(calendarDate))]
  const { error } = await client().from('classes').upsert(row).eq('user_id', userId).abortSignal(requestSignal())
  if (error) throw error
  if (!schedule) return
  const { data, error: scheduleError } = await client().from('recurring_schedules').upsert(schedule, { onConflict: 'user_id,class_id' }).eq('user_id', userId).select('id').abortSignal(requestSignal()).single()
  if (scheduleError) throw scheduleError
  if (!data) throw new Error('Missing saved schedule')
  const scheduleId = String(data.id)
  const existing = await allRows<ExceptionRow>('recurring_schedule_exceptions', userId, { column: 'schedule_id', value: scheduleId })
  const removed = existing.filter(row => !dates.includes(row.exception_date)).map(row => row.exception_date)
  // Delete only dates that were previously present; never wipe all exceptions.
  for (let offset = 0; offset < removed.length; offset += 100) {
    const { error: deleteError } = await client().from('recurring_schedule_exceptions').delete().eq('user_id', userId).eq('schedule_id', scheduleId).in('exception_date', removed.slice(offset, offset + 100)).abortSignal(requestSignal())
    if (deleteError) throw deleteError
  }
  if (dates.length) {
    const { error: exceptionError } = await client().from('recurring_schedule_exceptions').upsert(dates.map(date => ({ user_id: userId, schedule_id: scheduleId, exception_date: date })), { onConflict: 'user_id,schedule_id,exception_date' }).eq('user_id', userId).abortSignal(requestSignal())
    if (exceptionError) throw exceptionError
  }
}
export async function addCheckIn(userId: string, item: ClassCheckIn, classItem: TeachingClass): Promise<void> {
  const { error } = await client().from('teaching_sessions').insert(sessionToRow(userId, item, classItem)).abortSignal(requestSignal())
  if (error) throw error
}
async function deleteOwned(table: string, userId: string, id: string): Promise<void> {
  verifyIds(userId, id)
  const { error } = await client().from(table).delete().eq('user_id', userId).eq('id', id).abortSignal(requestSignal())
  if (error) throw error
}
export function deleteCheckIn(userId: string, id: string): Promise<void> { return deleteOwned('teaching_sessions', userId, id) }
export function deleteClass(userId: string, id: string): Promise<void> { return deleteOwned('classes', userId, id) }
export async function saveSalaryPayment(userId: string, item: SalaryPayment): Promise<void> {
  const { error } = await client().from('salary_payments').insert(paymentToRow(userId, item)).abortSignal(requestSignal())
  if (error) throw error
}
export function deleteSalaryPayment(userId: string, id: string): Promise<void> { return deleteOwned('salary_payments', userId, id) }
