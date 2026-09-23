import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getAuthErrorMessage, safeReturnPath, validateAuthForm } from '../src/auth/auth-utils.ts'

const valid = { name: 'Nguyễn An', email: 'an@example.com', password: 'password123', confirmPassword: 'password123' }

describe('auth form validation', () => {
  it('accepts valid registration and surrounding email whitespace', () => {
    assert.equal(validateAuthForm('register', { ...valid, email: ' an@example.com ' }), null)
  })
  it('requires a meaningful name only when registering', () => {
    assert.match(validateAuthForm('register', { ...valid, name: '  ' })!, /tên/i)
    assert.equal(validateAuthForm('login', { ...valid, name: '' }), null)
  })
  it('rejects missing and malformed email addresses', () => {
    for (const email of ['', 'a', 'a@b', 'a b@example.com', 'a@@example.com']) {
      assert.match(validateAuthForm('login', { ...valid, email })!, /email/i)
    }
  })
  it('allows existing short passwords for login but requires a password', () => {
    assert.equal(validateAuthForm('login', { ...valid, password: 'short' }), null)
    assert.match(validateAuthForm('login', { ...valid, password: '' })!, /mật khẩu/i)
  })
  it('requires eight characters and matching confirmation for new passwords', () => {
    for (const mode of ['register', 'reset'] as const) {
      assert.match(validateAuthForm(mode, { ...valid, password: 'short' })!, /8/)
      assert.match(validateAuthForm(mode, { ...valid, confirmPassword: '' })!, /khớp/i)
      assert.match(validateAuthForm(mode, { ...valid, confirmPassword: 'different' })!, /khớp/i)
      assert.equal(validateAuthForm(mode, valid), null)
    }
  })
  it('forgot only needs email, and reset does not require email or name', () => {
    assert.equal(validateAuthForm('forgot', { name: '', email: valid.email, password: '', confirmPassword: '' }), null)
    assert.equal(validateAuthForm('reset', { ...valid, email: '', name: '' }), null)
  })
})

describe('safe return paths', () => {
  it('keeps local app paths and query parameters', () => {
    assert.equal(safeReturnPath('/statistics?month=9#summary'), '/statistics?month=9#summary')
    assert.equal(safeReturnPath('/'), '/')
  })
  it('rejects external redirects and ambiguous encodings', () => {
    for (const path of [null, '', 'https://evil.com', '//evil.com', '/\\evil.com', '/%2Fevil.com', '/%5cevil.com', '/\nevil.com', '/%zz', 'javascript:alert(1)']) {
      assert.equal(safeReturnPath(path), '/', String(path))
    }
  })
  it('rejects all auth destinations including normalized paths', () => {
    for (const path of ['/login', '/register?next=/', '/forgot-password', '/reset-password#token', '/auth/callback', '/LOGIN', '/nested/../login', '/%6cogin', '/login/']) {
      assert.equal(safeReturnPath(path), '/', path)
    }
  })
})

describe('localized auth errors', () => {
  it('translates common API codes', () => {
    assert.match(getAuthErrorMessage({ code: 'invalid_credentials' }), /email.*mật khẩu/i)
    assert.match(getAuthErrorMessage({ code: 'email_not_confirmed' }), /xác nhận/i)
    assert.match(getAuthErrorMessage({ code: 'user_already_exists' }), /đăng ký/i)
    assert.match(getAuthErrorMessage({ code: 'over_request_rate_limit' }), /thử lại/i)
    assert.match(getAuthErrorMessage({ code: 'weak_password' }), /mật khẩu/i)
    assert.match(getAuthErrorMessage({ code: 'same_password' }), /khác/i)
    assert.match(getAuthErrorMessage({ code: 'otp_expired' }), /hết hạn/i)
  })
  it('recognizes network errors without displaying technical details', () => {
    assert.match(getAuthErrorMessage(new TypeError('Failed to fetch')), /kết nối/i)
    assert.match(getAuthErrorMessage({ message: 'Network request failed' }), /kết nối/i)
  })
  it('never leaks unknown server errors', () => {
    const fallback = getAuthErrorMessage(null)
    assert.equal(getAuthErrorMessage(new Error('private internal server detail')), fallback)
    assert.equal(getAuthErrorMessage(undefined), fallback)
    assert.equal(getAuthErrorMessage('private detail'), fallback)
  })
})
