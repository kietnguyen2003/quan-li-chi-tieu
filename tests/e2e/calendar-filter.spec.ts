import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('calendar filter and export share the selected class and month, including planned sessions', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-23T12:00:00+07:00'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('class_checkin_classes', JSON.stringify([
      { id: 'a', name: 'Alpha', salary: 100000, durationHours: 1, note: '', recurringSchedule: { enabled: true, weekday: 1, startTime: '09:00', skippedDates: [] } },
      { id: 'b', name: 'Beta', salary: 200000, durationHours: 1, note: '' },
    ]));
    localStorage.setItem('class_checkin_records', JSON.stringify([
      { id: 'a1', classId: 'a', date: '2026-09-22', sessionHours: 1, sessionAmount: 100000 },
      { id: 'b1', classId: 'b', date: '2026-09-22', sessionHours: 1, sessionAmount: 200000 },
      { id: 'old', classId: 'a', date: '2026-08-22', sessionHours: 1, sessionAmount: 900000 },
    ]));
    localStorage.setItem('class_checkin_salary_payments', '[]');
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Lọc lớp: Tất cả lớp' }).click();
  await page.getByRole('textbox', { name: 'Tìm lớp học' }).fill('alp');
  await expect(page.getByRole('button', { name: 'Beta', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Alpha', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Lọc lớp: Alpha' })).toBeFocused();
  await page.getByRole('button', { name: 'Lọc lớp: Alpha' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', { name: 'Tìm lớp học' })).toHaveCount(0);
  await expect(page.getByRole('button').filter({ hasText: 'Beta' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Xuất danh sách', exact: true }).click();
  const report = page.locator('textarea[readonly]');
  await expect(report).toHaveValue(/Alpha/);
  await expect(report).toHaveValue(/100\.000/);
  await expect(report).toHaveValue(/Dự kiến/);
  await expect(report).not.toHaveValue(/Beta|900\.000|22\/8/);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải .txt' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('lich-day-2026-09.txt');
  expect((await readFile((await download.path())!, 'utf8')).replace(/^\uFEFF/, '')).toBe(await report.inputValue());
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
