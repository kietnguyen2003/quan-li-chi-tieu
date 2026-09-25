import { format, isValid, parseISO } from 'date-fns'
import { calculateSessionAmount } from '../transaction-helpers.ts'
import type { ClassCheckIn, SalaryPayment, TeachingClass } from '../types.ts'

export interface AttendanceData {
  classes: TeachingClass[]
  checkIns: ClassCheckIn[]
  salaryPayments: SalaryPayment[]
}
export interface ClassRow { id: string; name: string; salary_per_hour: number | string; default_duration_hours: number | string; note: string; archived_at: string | null }
export interface SessionRow { id: string; class_id: string; session_date: string; start_time: string | null; end_time: string | null; session_hours: number | string; session_amount: number | string }
export interface PaymentRow { id: string; payment_date: string; amount: number | string; note: string }
export interface ScheduleRow { id: string; class_id: string; weekday: number; start_time: string; enabled: boolean }
export interface ExceptionRow { schedule_id: string; exception_date: string }
export interface AttendanceRows { classes: ClassRow[]; sessions: SessionRow[]; payments: PaymentRow[]; schedules: ScheduleRow[]; exceptions: ExceptionRow[] }

export class AttendanceValidationError extends Error {}
function invalid(message: string): never { throw new AttendanceValidationError(message) }
export function assertUuid(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) invalid('Mã dữ liệu không hợp lệ. Vui lòng tải lại trang.')
}
function numeric(value: number, min: number, max: number, label: string, exclusive = false): number {
  if (!Number.isFinite(value) || value > max || (exclusive ? value <= min : value < min)) invalid(`${label} không hợp lệ.`)
  return value
}
export function calendarDate(value: string): string {
  const parsed = parseISO(value)
  if (!isValid(parsed)) invalid('Ngày không hợp lệ.')
  return format(parsed, 'yyyy-MM-dd')
}
export function timeValue(value: string): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) invalid('Giờ không hợp lệ.')
  return value
}
function localDate(value: string): string { return parseISO(`${calendarDate(value)}T12:00:00`).toISOString() }

export function classToRow(userId: string, item: TeachingClass) {
  assertUuid(userId)
  assertUuid(item.id)
  const name = item.name.trim()
  if (!name || name.length > 200) invalid('Tên lớp cần từ 1 đến 200 ký tự.')
  if (item.archivedAt && !isValid(parseISO(item.archivedAt))) invalid('Ngày lưu trữ không hợp lệ.')
  return { id: item.id, user_id: userId, name, salary_per_hour: numeric(item.salary, 0, 999999999999.99, 'Đơn giá'), default_duration_hours: numeric(item.durationHours, 0, 24, 'Số giờ', true), note: item.note, archived_at: item.archivedAt ?? null }
}
export function sessionToRow(userId: string, item: ClassCheckIn, classItem: TeachingClass) {
  assertUuid(userId)
  assertUuid(item.id)
  assertUuid(item.classId)
  if (item.classId !== classItem.id) invalid('Lớp học không khớp với buổi dạy.')
  if (Boolean(item.startTime) !== Boolean(item.endTime)) invalid('Cần nhập cả giờ bắt đầu và kết thúc.')
  const hours = numeric(item.sessionHours ?? classItem.durationHours, 0, 24, 'Số giờ', true)
  const amount = numeric(item.sessionAmount ?? calculateSessionAmount(classItem, hours), 0, 999999999999.99, 'Tiền buổi dạy')
  return { id: item.id, user_id: userId, class_id: item.classId, session_date: calendarDate(item.date), start_time: item.startTime ? timeValue(item.startTime) : null, end_time: item.endTime ? timeValue(item.endTime) : null, session_hours: hours, session_amount: amount }
}
export function paymentToRow(userId: string, item: SalaryPayment) {
  assertUuid(userId)
  assertUuid(item.id)
  return { id: item.id, user_id: userId, payment_date: calendarDate(item.date), amount: numeric(item.amount, 0, 999999999999.99, 'Số tiền nhận', true), note: item.note }
}
export function scheduleToRow(userId: string, item: TeachingClass) {
  assertUuid(userId)
  assertUuid(item.id)
  const schedule = item.recurringSchedule
  if (!schedule) return null
  if (!Number.isInteger(schedule.weekday) || schedule.weekday < 0 || schedule.weekday > 6) invalid('Thứ trong tuần không hợp lệ.')
  schedule.skippedDates.forEach(calendarDate)
  return { user_id: userId, class_id: item.id, weekday: schedule.weekday, start_time: timeValue(schedule.startTime), enabled: schedule.enabled }
}
export function mapAttendanceRows(rows: AttendanceRows): AttendanceData {
  return {
    classes: rows.classes.map(row => {
      const schedule = rows.schedules.find(item => item.class_id === row.id)
      return { id: row.id, name: row.name, salary: Number(row.salary_per_hour), durationHours: Number(row.default_duration_hours), note: row.note, archivedAt: row.archived_at ?? undefined,
        recurringSchedule: schedule ? { weekday: schedule.weekday, startTime: schedule.start_time.slice(0, 5), enabled: schedule.enabled, skippedDates: rows.exceptions.filter(item => item.schedule_id === schedule.id).map(item => item.exception_date) } : undefined }
    }),
    checkIns: rows.sessions.map(row => {
      const startTime = row.start_time?.slice(0, 5)
      const endTime = row.end_time?.slice(0, 5)
      return { id: row.id, classId: row.class_id, date: localDate(row.session_date), startTime, endTime, sessionHours: Number(row.session_hours), sessionAmount: Number(row.session_amount), timeRange: startTime && endTime ? `${startTime} -> ${endTime}` : undefined }
    }),
    salaryPayments: rows.payments.map(row => ({ id: row.id, date: localDate(row.payment_date), amount: Number(row.amount), note: row.note })),
  }
}
export function getDataErrorMessage(error: unknown): string {
  if (error instanceof AttendanceValidationError) return error.message
  if (error && typeof error === 'object') {
    const code = 'code' in error ? String(error.code) : ''
    const message = 'message' in error ? String(error.message) : ''
    const name = 'name' in error ? String(error.name) : ''
    if (/timeout|timed out|abort/i.test(`${name} ${message}`)) return 'Yêu cầu mất quá lâu. Hãy tải lại dữ liệu để kiểm tra trước khi thử lưu lại.'
    if (code === '23505') return 'Dữ liệu bị trùng. Buổi dạy hoặc bản ghi này đã tồn tại.'
    if (code === '23503') return 'Lớp có lịch sử chấm công hoặc dữ liệu liên quan. Hãy kiểm tra lại trước khi xóa.'
    if (['42501', 'PGRST301', 'PGRST302', 'PGRST303'].includes(code)) return 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.'
    if (code === '23514' || code === '22P02') return 'Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường đã nhập.'
    if (/fetch|network|connection|offline/i.test(message)) return 'Không thể kết nối Supabase. Kiểm tra mạng rồi thử lại.'
  }
  return 'Không thể lưu hoặc tải dữ liệu. Vui lòng thử lại.'
}
