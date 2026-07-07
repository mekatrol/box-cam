import { expect, test } from '@playwright/test'

test('generates and downloads a simulated NC job', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Box CAM' })).toBeVisible()
  await expect(page.getByText('5 panels ready')).toBeVisible()

  await page.getByLabel('Outside X width (mm)').fill('180')
  await expect(page.getByText('Unsaved changes')).toBeVisible()

  await page.getByRole('button', { name: 'Generate NC' }).click()
  await expect(page.getByLabel('Generated NC output').locator('textarea')).toContainText('G21')
  await expect(page.getByLabel('Generated NC output').locator('textarea')).toContainText('M30')
  await expect(page.getByText(/NC ready, \d+ simulated moves/)).toBeVisible()

  await page.getByRole('button', { name: 'Run' }).click()
  await expect(page.getByLabel('Simulation controls')).toContainText(/\d+:\d{2} \/ \d+:\d{2}/)
  await page.getByRole('button', { name: 'Pause' }).click()
  await page.getByRole('button', { name: 'Restart' }).click()

  const projectDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save Project' }).click()
  await expect(await projectDownload).toHaveSuggestedFilename('finger-box.boxcreator.json')

  const ncDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save NC' }).click()
  await expect(await ncDownload).toHaveSuggestedFilename('finger-box.nc')
})
