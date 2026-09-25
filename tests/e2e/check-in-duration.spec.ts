import { test, expect } from '@playwright/test';

for (const name of ['Sally', 'Hamza']) {
for (const hours of [1, 1.5, 2, 2.5]) {
  const billableHours = name === 'Hamza' ? Math.floor(hours) : Math.ceil(hours);
  test(`check-in saves ${name} ${hours} hours and calculates overnight end time and pay`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((className) => {
      localStorage.setItem('class_checkin_classes', JSON.stringify([{ id: 'duration', name: className, salary: 120000, durationHours: 1, note: '' }]));
    }, name);
    await page.goto('/');
    await page.getByRole('button', { name: 'Chấm công', exact: true }).click();
    await page.getByRole('button', { name: 'Lớp chấm công: Chọn lớp học' }).click();
    await page.getByRole('group', { name: 'Lớp chấm công' }).getByRole('button', { name, exact: false }).click();
    await page.getByRole('radio', { name: `Tập trong ${hours}h`, exact: true }).check();
    await page.locator('input[type="time"]').fill('23:00');
    await expect(page.getByText(`Dự kiến: ${(billableHours * 120000).toLocaleString('vi-VN')}`, { exact: false })).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(4);
    await expect(page.getByRole('radio', { name: `Tập trong ${hours}h`, exact: true })).toBeChecked();
    if (name === 'Sally' && hours === 2.5) await page.screenshot({ path: '/tmp/check-in-duration-mobile.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Xác nhận chấm công' }).click();
    const records = await page.evaluate(() => JSON.parse(localStorage.getItem('class_checkin_records') || '[]'));
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ sessionHours: hours, sessionAmount: billableHours * 120000, startTime: '23:00', endTime: `${String(Math.floor(hours - 1)).padStart(2, '0')}:${hours % 1 ? '30' : '00'}` });
    await page.reload();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('class_checkin_records') || '[]')[0].sessionHours)).toBe(hours);
  });
}

}

test('creates a class without entering number of hours', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Chấm công', exact: true }).click();
  await expect(page.getByPlaceholder('Số giờ (VD: 1.5)')).toHaveCount(0);
  await page.getByPlaceholder('Tên lớp (VD: Keming, Lyra)').fill('Lớp mới');
  await page.getByPlaceholder('Lương/giờ (VD: 150000)').fill('120000');
  await page.getByRole('button', { name: 'Lưu lớp học', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Tập trong 1h', exact: true })).toBeChecked();
});
