import { expect, test } from '@playwright/test'

test('generates and downloads a simulated NC job', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Box CAM' })).toBeVisible()
  await expect(page.getByText('5 panels ready')).toBeVisible()

  await page.getByLabel('Outside X width (mm)').fill('180')
  await expect(page.getByText('Unsaved changes')).toBeVisible()

  await page.getByRole('button', { name: 'Generate NC' }).click()
  const generatedNcOutput = page.getByLabel('Generated NC output').locator('textarea')
  await expect(generatedNcOutput).toHaveValue(/G21/)
  await expect(generatedNcOutput).toHaveValue(/M30/)
  await expect(page.getByText(/NC ready, \d+ simulated moves/)).toBeVisible()

  await page.getByRole('button', { name: 'Run' }).click()
  await expect(page.getByLabel('Simulation controls')).toContainText(/\d+:\d{2} \/ \d+:\d{2}/)
  await page.getByRole('button', { name: 'Pause' }).click()
  await page.getByRole('button', { name: 'Restart' }).click()

  const projectDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save Project' }).click()
  expect((await projectDownload).suggestedFilename()).toBe('finger-box.boxcreator.json')

  const ncDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save NC' }).click()
  expect((await ncDownload).suggestedFilename()).toBe('finger-box.nc')
})
