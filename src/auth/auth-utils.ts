export type AuthMode = 'login' | 'register' | 'forgot' | 'reset'

export interface AuthFormValues {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export function validateAuthForm(mode: AuthMode, values: AuthFormValues): string | null {
  if (mode === 'register' && !values.name.trim()) return 'Vui lòng nhập họ và tên.'
  if (mode !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    return 'Vui lòng nhập địa chỉ email hợp lệ.'
  }
  if (mode === 'forgot') return null
  if (!values.password) return 'Vui lòng nhập mật khẩu.'
  if (mode === 'login') return null
  if (values.password.length < 8) return 'Mật khẩu cần có ít nhất 8 ký tự.'
  if (values.password !== values.confirmPassword) return 'Mật khẩu xác nhận chưa khớp.'
  return null
}

const errorMessages: Record<string, string> = {
  invalid_credentials: 'Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.',
  email_not_confirmed: 'Vui lòng xác nhận email trước khi đăng nhập.',
  user_already_exists: 'Email này đã được đăng ký. Bạn có thể đăng nhập hoặc đặt lại mật khẩu.',
  email_exists: 'Email này đã được đăng ký. Bạn có thể đăng nhập hoặc đặt lại mật khẩu.',
  over_request_rate_limit: 'Bạn thao tác quá nhanh. Vui lòng chờ một chút rồi thử lại.',
  over_email_send_rate_limit: 'Vui lòng chờ một chút trước khi yêu cầu gửi lại email.',
  weak_password: 'Mật khẩu chưa đủ mạnh. Hãy sử dụng mật khẩu dài hơn và khó đoán.',
  same_password: 'Mật khẩu mới cần khác mật khẩu hiện tại.',
  otp_expired: 'Liên kết đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu một liên kết mới.',
  session_not_found: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  refresh_token_not_found: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  signup_disabled: 'Đăng ký tài khoản hiện đang tạm đóng. Vui lòng thử lại sau.',
  email_address_invalid: 'Địa chỉ email không được chấp nhận. Vui lòng kiểm tra lại.',
}

export function getAuthErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : ''
    if (Object.hasOwn(errorMessages, code)) return errorMessages[code]
    const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
    if (/failed to fetch|network|fetch failed|load failed/i.test(message)) {
      return 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.'
    }
  }
  return 'Chưa thể hoàn tất thao tác. Vui lòng thử lại sau.'
}

export function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith('/') || /\\|%2f|%5c/i.test(value)) return '/'
  if ([...value].some(character => character.charCodeAt(0) <= 32)) return '/'
  try {
    const url = new URL(value, 'https://app.invalid')
    const pathname = decodeURIComponent(url.pathname).toLowerCase()
    if (url.origin !== 'https://app.invalid' || /^\/(login|register|forgot-password|reset-password|auth)(\/|$)/.test(pathname)) return '/'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/'
  }
}
