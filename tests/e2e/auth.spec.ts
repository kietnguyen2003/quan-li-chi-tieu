import { test, expect, type Page } from '@playwright/test';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  aud: 'authenticated', role: 'authenticated', email: 'teacher@example.com',
  email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Giáo viên thử' }, created_at: new Date().toISOString(),
};

async function mockAuth(page: Page, mode: 'success' | 'invalid' | 'offline' = 'success') {
  const requests: string[] = [];
  await page.route('**/rest/v1/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/auth/v1/**', async (route) => {
    requests.push(route.request().url());
    if (mode === 'offline') return route.abort('failed');
    if (route.request().url().includes('/token')) {
      if (mode === 'invalid') return route.fulfill({ status: 400, json: { code: 'invalid_credentials', msg: 'Invalid login credentials' } });
      return route.fulfill({ json: { access_token: 'test-access-token', refresh_token: 'test-refresh-token', token_type: 'bearer', expires_in: 3600, user } });
    }
    if (route.request().url().includes('/signup')) return route.fulfill({ json: { user, session: null } });
    if (route.request().url().includes('/user')) return route.fulfill({ json: user });
    return route.fulfill({ json: {} });
  });
  return requests;
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('teacher@example.com');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
}

test('login and registration are usable on mobile without overflow', async ({ page }) => {
  await mockAuth(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Chào mừng trở lại.' })).toBeVisible();
  await page.getByRole('link', { name: 'Đăng ký', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bắt đầu cùng Training Camp.' })).toBeVisible();
  await page.getByLabel('Họ và tên').fill('Giáo viên thử');
  await page.getByLabel('Email', { exact: true }).fill('teacher@example.com');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('password123');
  await page.getByLabel('Nhập lại mật khẩu').fill('different123');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('khớp');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('registration with confirmation does not pretend to be signed in', async ({ page }) => {
  await mockAuth(page);
  await page.goto('/register');
  await page.getByLabel('Họ và tên').fill('Giáo viên thử');
  await page.getByLabel('Email', { exact: true }).fill('teacher@example.com');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('password123');
  await page.getByLabel('Nhập lại mật khẩu').fill('password123');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('email');
  await expect(page).toHaveURL(/register/);
});

test('invalid login shows a localized error and allows retry', async ({ page }) => {
  await mockAuth(page, 'invalid');
  await login(page);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeEnabled();
  await expect(page).toHaveURL(/login/);
});

test('login, reload and logout preserve guest data and separate account data', async ({ page }) => {
  await mockAuth(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('class_checkin_classes', JSON.stringify([
    { id: 'guest-class', name: 'Lớp dữ liệu cũ', salary: 100000, durationHours: 1, note: '' },
  ])));
  await login(page);
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('class_checkin_classes') || '[]')[0].name)).toBe('Lớp dữ liệu cũ');
  expect(await page.evaluate((id) => JSON.parse(localStorage.getItem(`class_checkin_classes:${id}`) || '[]'), user.id)).toEqual([]);
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/login/);
});

test('password recovery submits an email and reset requires a session', async ({ page }) => {
  const requests = await mockAuth(page);
  await page.goto('/forgot-password');
  await page.getByLabel('Email', { exact: true }).fill('teacher@example.com');
  await page.getByRole('button', { name: 'Gửi liên kết đặt lại' }).click();
  await expect(page.getByRole('status')).toContainText('email');
  expect(requests.some((url) => url.includes('/recover'))).toBe(true);
  await page.goto('/reset-password');
  await expect(page.getByRole('button', { name: 'Lưu mật khẩu mới' })).toBeDisabled();
});

test('callback without a valid session shows an actionable error', async ({ page }) => {
  await mockAuth(page);
  await page.goto('/auth/callback#error=access_denied&error_description=Expired');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Về trang đăng nhập' })).toBeVisible();
});

test('valid recovery link updates the password and allows returning to the app', async ({ page }) => {
  const requests = await mockAuth(page);
  await page.goto('/reset-password#access_token=test-access-token&refresh_token=test-refresh-token&expires_in=3600&token_type=bearer&type=recovery');
  await expect(page.getByRole('button', { name: 'Lưu mật khẩu mới' })).toBeEnabled();
  await page.getByLabel('Mật khẩu', { exact: true }).fill('new-password123');
  await page.getByLabel('Nhập lại mật khẩu').fill('new-password123');
  await page.getByRole('button', { name: 'Lưu mật khẩu mới' }).click();
  await expect(page.getByRole('status')).toContainText('Đã cập nhật mật khẩu');
  expect(requests.some((url) => url.includes('/user'))).toBe(true);
  await page.getByRole('link', { name: 'Về lịch dạy', exact: true }).last().click();
  await expect(page).toHaveURL('/');
});

test('recovery can be cancelled without trapping navigation', async ({ page }) => {
  await mockAuth(page);
  await page.goto('/reset-password#access_token=test-access-token&refresh_token=test-refresh-token&expires_in=3600&token_type=bearer&type=recovery');
  await page.getByRole('button', { name: 'Hủy đặt lại mật khẩu và đăng xuất' }).click();
  await expect(page).toHaveURL(/login/);
  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeEnabled();
});

test('network failure is recoverable and does not navigate away', async ({ page }) => {
  await mockAuth(page, 'offline');
  await login(page);
  await expect(page.getByRole('alert')).toContainText('kết nối');
  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeEnabled();
  await expect(page).toHaveURL(/login/);
});

test('login returns to requested statistics page and rejects external redirects', async ({ page }) => {
  await mockAuth(page);
  await page.goto('/login?next=%2Fstatistic');
  await page.getByLabel('Email', { exact: true }).fill('teacher@example.com');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/statistic');
  await page.goto('/login?next=https%3A%2F%2Fevil.example');
  await expect(page).toHaveURL('/');
});
