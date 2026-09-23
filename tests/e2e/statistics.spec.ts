import { test, expect } from '@playwright/test';

test('dashboard shows cumulative unpaid balance and monthly data', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-23T12:00:00+07:00'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('class_checkin_classes', JSON.stringify([{ id: 'class', name: 'Lớp tiếng Anh', salary: 150000, durationHours: 1.5, note: '' }]));
    localStorage.setItem('class_checkin_records', JSON.stringify([
      { id: 'september', classId: 'class', date: '2026-09-22', sessionHours: 1.5, sessionAmount: 225000 },
      { id: 'august', classId: 'class', date: '2026-08-22', sessionHours: 2, sessionAmount: 300000 },
    ]));
    localStorage.setItem('class_checkin_salary_payments', JSON.stringify([{ id: 'paid', date: '2026-09-23', amount: 250000, note: 'Nhận lương thử' }]));
  });
  await page.goto('/statistic');
  await expect(page.getByRole('heading', { name: 'Thu nhập theo lớp' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Chưa được trả' })).toContainText('275.000');
  await expect(page.getByText('1 buổi · 1,5 giờ', { exact: true })).toBeVisible();
  await expect(page.getByText('Nhận lương thử')).not.toBeVisible();
  await page.getByText('Lịch sử nhận lương', { exact: true }).click();
  await expect(page.getByText('Nhận lương thử')).toBeVisible();
  await page.screenshot({ path: '/tmp/dashboard-unpaid.png', fullPage: true });
  await page.getByRole('button', { name: 'Tháng trước' }).click();
  await expect(page.getByText('Chưa có khoản nhận lương trong tháng này.')).toBeVisible();
  await expect(page.getByText('300.000', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('table', { name: 'Thu nhập và thực nhận trong 6 tháng' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
