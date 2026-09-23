import { test, expect } from '@playwright/test';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded-local')) return;
    sessionStorage.setItem('seeded-local', 'yes');
    localStorage.setItem('unrelated-setting', 'keep');
    localStorage.setItem('class_checkin_classes', JSON.stringify([{ id: 'a', name: 'Lớp thử', salary: 100000, durationHours: 1, note: '' }]));
    localStorage.setItem('class_checkin_records', JSON.stringify([{ id: 'r', classId: 'a', date: '2026-09-23', sessionAmount: 100000, sessionHours: 1 }]));
    localStorage.setItem('class_checkin_salary_payments', JSON.stringify([{ id: 'p', date: '2026-09-23', amount: 50000, note: '' }]));
  });
  await page.goto('/');
});

test('touch selection survives search losing focus without a related target', async ({ page }) => {
  await page.getByRole('button', { name: 'Lọc lớp: Tất cả lớp' }).tap();
  const search = page.getByRole('textbox', { name: 'Tìm lớp học' });
  await expect(search).not.toBeFocused();
  await search.tap();
  await search.fill('lop');
  // Mobile browsers can blur a text input without focusing the tapped button.
  await search.evaluate((element) => (element as HTMLInputElement).blur());
  await page.getByRole('button', { name: 'Lớp thử', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Lọc lớp: Lớp thử' })).toBeVisible();
  await page.getByRole('button', { name: 'Chấm công', exact: true }).tap();
  await page.getByRole('button', { name: 'Lớp chấm công: Chọn lớp học' }).tap();
  await page.getByRole('group', { name: 'Lớp chấm công' }).getByRole('button', { name: /Lớp thử/ }).tap();
  await expect(page.getByRole('button', { name: 'Lớp chấm công: Lớp thử' })).toBeVisible();
});

test('local reset requires confirmation and persists after reload without clearing unrelated storage', async ({ page }) => {
  await page.getByRole('button', { name: 'Menu tiện ích' }).tap();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: /Xóa dữ liệu trên thiết bị/ }).tap();
  expect(await page.evaluate(() => localStorage.getItem('class_checkin_records'))).not.toBeNull();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Xóa dữ liệu trên thiết bị/ }).tap();
  await expect(page.getByRole('status')).toContainText('Đã xóa dữ liệu local');
  for (const key of ['class_checkin_classes', 'class_checkin_records', 'class_checkin_salary_payments']) {
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
  }
  expect(await page.evaluate(() => localStorage.getItem('unrelated-setting'))).toBe('keep');
  await expect(page.getByText('Hiện có 0 lớp')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Menu tiện ích' }).tap();
  await expect(page.getByText('Hiện có 0 lớp')).toBeVisible();
});
