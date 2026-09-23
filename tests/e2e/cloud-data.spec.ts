import { test, expect, type Page } from '@playwright/test';

const owner = '11111111-1111-4111-8111-111111111111';
const classId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
type Row = Record<string, unknown>;

async function mockCloud(page: Page) {
  const tables: Record<string, Row[]> = {
    classes: [{ id: classId, user_id: owner, name: 'Lớp trên Supabase', salary_per_hour: 150000, default_duration_hours: 1.5, note: '', archived_at: null }],
    teaching_sessions: [], salary_payments: [], recurring_schedules: [], recurring_schedule_exceptions: [],
  };
  const requests: { table: string; method: string; ownerFilter: string | null }[] = [];
  const failures = { read: false, write: false };
  const user = { id: owner, aud: 'authenticated', email: 'cloud@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/token')) return route.fulfill({ json: { user, access_token: 'mock-token', refresh_token: 'mock-refresh', expires_in: 3600, token_type: 'bearer' } });
    if (url.includes('/user')) return route.fulfill({ json: user });
    return route.fulfill({ json: {} });
  });
  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/').pop()!;
    const method = request.method();
    requests.push({ table, method, ownerFilter: url.searchParams.get('user_id') });
    if ((method === 'GET' && failures.read) || (method !== 'GET' && failures.write)) return route.fulfill({ status: 400, json: { message: 'Database request rejected' } });
    if (!(table in tables)) return route.fulfill({ status: 404, json: { code: '42P01' } });
    const matches = (row: Row) => [...url.searchParams].every(([key, filter]) => {
      if (['select', 'order', 'offset', 'limit', 'on_conflict'].includes(key)) return true;
      if (filter.startsWith('eq.')) return String(row[key]) === filter.slice(3);
      if (filter.startsWith('in.(')) return filter.slice(4, -1).split(',').includes(String(row[key]));
      return true;
    });
    if (method === 'GET') return route.fulfill({ json: tables[table].filter(matches) });
    if (method === 'DELETE') {
      const removed = tables[table].filter(matches);
      tables[table] = tables[table].filter((row) => !matches(row));
      return route.fulfill({ json: removed });
    }
    const body = request.postDataJSON();
    const incoming: Row[] = Array.isArray(body) ? body : [body];
    const saved = incoming.map((row) => {
      const previous = tables[table].find((item) => row.id ? item.id === row.id : table === 'recurring_schedules' && item.class_id === row.class_id && item.user_id === row.user_id);
      const next = { id: previous?.id ?? crypto.randomUUID(), ...previous, ...row };
      tables[table] = [...tables[table].filter((item) => item.id !== next.id), next];
      return next;
    });
    return route.fulfill({ json: request.headers().accept?.includes('vnd.pgrst.object') ? saved[0] : saved });
  });
  return { tables, requests, failures };
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('cloud@example.com');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByText('Đang tải lịch dạy…')).not.toBeVisible();
}

test('signed-in calendar loads cloud classes and check-ins survive a reload', async ({ page }) => {
  const cloud = await mockCloud(page);
  await login(page);
  await page.getByRole('button', { name: 'Chấm công', exact: true }).click();
  await page.getByRole('button', { name: 'Lớp chấm công: Chọn lớp học' }).click();
  await page.getByRole('textbox', { name: 'Tìm lớp học' }).fill('lop tren');
  await page.getByRole('group', { name: 'Lớp chấm công' }).getByRole('button', { name: /Lớp trên Supabase/ }).click();
  await page.getByRole('button', { name: 'Xác nhận chấm công' }).click();
  await expect(page.getByRole('heading', { name: /Chấm công ngày/ })).not.toBeVisible();
  expect(cloud.tables.teaching_sessions).toHaveLength(1);
  expect(cloud.tables.teaching_sessions[0]).toMatchObject({ user_id: owner, class_id: classId, session_hours: 1.5, session_amount: 225000 });
  await page.reload();
  await expect(page.getByText('(1 buổi)', { exact: true })).toBeVisible();
  expect(cloud.requests.filter((request) => request.method === 'GET').every((request) => request.ownerFilter === `eq.${owner}`)).toBe(true);
});

test('database load failure shows retry and never writes an empty local snapshot', async ({ page }) => {
  const cloud = await mockCloud(page);
  cloud.failures.read = true;
  await login(page);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tải lại dữ liệu' })).toBeVisible();
  expect(cloud.requests.some((request) => request.method !== 'GET')).toBe(false);
  cloud.failures.read = false;
  await page.getByRole('button', { name: 'Tải lại dữ liệu' }).click();
  await page.getByRole('button', { name: 'Chấm công', exact: true }).click();
  await page.getByRole('button', { name: 'Lớp chấm công: Chọn lớp học' }).click();
  await expect(page.getByRole('group', { name: 'Lớp chấm công' }).getByRole('button', { name: /Lớp trên Supabase/ })).toBeVisible();
});

test('failed save keeps the form open and does not invent a completed session', async ({ page }) => {
  const cloud = await mockCloud(page);
  await login(page);
  await page.getByRole('button', { name: 'Chấm công', exact: true }).click();
  await page.getByRole('button', { name: 'Lớp chấm công: Chọn lớp học' }).click();
  await page.getByRole('textbox', { name: 'Tìm lớp học' }).fill('lop tren');
  await page.getByRole('group', { name: 'Lớp chấm công' }).getByRole('button', { name: /Lớp trên Supabase/ }).click();
  cloud.failures.write = true;
  await page.getByRole('button', { name: 'Xác nhận chấm công' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Chấm công ngày/ })).toBeVisible();
  expect(cloud.tables.teaching_sessions).toHaveLength(0);
});

test('guest use makes no database requests', async ({ page }) => {
  const cloud = await mockCloud(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Chấm công', exact: true })).toBeVisible();
  expect(cloud.requests).toHaveLength(0);
});

test('creating a weekly class saves its schedule and a salary payment survives reload', async ({ page }) => {
  const cloud = await mockCloud(page);
  await login(page);
  await page.getByRole('button', { name: 'Chấm công', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo lớp học mới' }).click();
  await page.getByPlaceholder('Tên lớp (VD: Keming, Lyra)').fill('Lớp mới có lịch tuần');
  await page.getByPlaceholder('Lương/giờ (VD: 150000)').fill('200000');
  await page.getByPlaceholder('Số giờ (VD: 1.5)').fill('2');
  await page.getByLabel('Đây là lớp cố định theo tuần').check();
  await page.getByRole('button', { name: 'Lưu lớp học', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Lớp chấm công: Lớp mới có lịch tuần' })).toBeVisible();
  expect(cloud.tables.classes).toHaveLength(2);
  expect(cloud.tables.recurring_schedules).toHaveLength(1);
  expect(cloud.tables.recurring_schedules[0]).toMatchObject({ user_id: owner, enabled: true, weekday: 1 });
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await page.getByRole('button', { name: 'Menu tiện ích' }).click();
  await page.getByRole('button', { name: /Ghi nhận nhận lương/ }).click();
  await page.getByPlaceholder('VD: 5000000').fill('500000');
  await page.getByRole('button', { name: 'Lưu thanh toán' }).click();
  await expect(page.getByRole('heading', { name: 'Ghi nhận thanh toán lương' })).not.toBeVisible();
  expect(cloud.tables.salary_payments).toHaveLength(1);
  expect(cloud.tables.salary_payments[0]).toMatchObject({ user_id: owner, amount: 500000 });
  await page.goto('/statistic');
  await page.getByText('Lịch sử nhận lương', { exact: true }).click();
  await expect(page.getByText('+500.000', { exact: false })).toBeVisible();
});

test('bulk import saves class and session snapshots and does not duplicate on retry', async ({ page }) => {
  const cloud = await mockCloud(page);
  await login(page);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.getByRole('button', { name: 'Menu tiện ích' }).click();
    await page.getByRole('button', { name: /Nhập hàng loạt/ }).click();
    await page.locator('textarea').fill('Lớp nhập mới\n120000\n22/9/2026: 9h -> 10h30');
    await page.getByRole('button', { name: 'Xác nhận nhập', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nhập dữ liệu hàng loạt' })).not.toBeVisible();
  }
  expect(cloud.tables.teaching_sessions).toHaveLength(1);
  expect(cloud.tables.teaching_sessions[0]).toMatchObject({ user_id: owner, session_amount: 180000, session_hours: 1.5, session_date: '2026-09-22' });
});
