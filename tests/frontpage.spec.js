import { test, expect } from '@playwright/test'

test.describe('Frontpage — Switch Company', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display KMB as default active company', async ({ page }) => {
    const kmbBtn = page.locator('.company-btn[data-company="kmb"]')
    const ctbBtn = page.locator('.company-btn[data-company="ctb"]')
    await expect(kmbBtn).toHaveClass(/active/)
    await expect(ctbBtn).not.toHaveClass(/active/)
  })

  test('should switch from KMB to CTB', async ({ page }) => {
    const kmbBtn = page.locator('.company-btn[data-company="kmb"]')
    const ctbBtn = page.locator('.company-btn[data-company="ctb"]')

    await ctbBtn.click()

    await expect(ctbBtn).toHaveClass(/active/)
    await expect(kmbBtn).not.toHaveClass(/active/)

    const title = page.locator('.landing-title')
    await expect(title).toContainText('城巴即時到站')
  })

  test('should switch from CTB back to KMB', async ({ page }) => {
    const kmbBtn = page.locator('.company-btn[data-company="kmb"]')
    const ctbBtn = page.locator('.company-btn[data-company="ctb"]')

    await ctbBtn.click()
    await expect(ctbBtn).toHaveClass(/active/)

    await kmbBtn.click()
    await expect(kmbBtn).toHaveClass(/active/)
    await expect(ctbBtn).not.toHaveClass(/active/)

    const title = page.locator('.landing-title')
    await expect(title).toContainText('九巴即時到站')
  })

  test('should show CTB landing style when CTB is active', async ({ page }) => {
    const ctbBtn = page.locator('.company-btn[data-company="ctb"]')
    await ctbBtn.click()

    const landing = page.locator('.landing')
    await expect(landing).toHaveClass(/landing-ctb/)
  })

  test('should persist company selection across page reload', async ({ page }) => {
    const ctbBtn = page.locator('.company-btn[data-company="ctb"]')
    await ctbBtn.click()
    await expect(ctbBtn).toHaveClass(/active/)

    await page.reload()

    const ctbBtnAfter = page.locator('.company-btn[data-company="ctb"]')
    await expect(ctbBtnAfter).toHaveClass(/active/)
  })

  test('CTB mode should show CTB data source text', async ({ page }) => {
    const ctbBtn = page.locator('.company-btn[data-company="ctb"]')
    await ctbBtn.click()

    const footer = page.locator('.landing-footer')
    await expect(footer).toContainText('CTB')
  })

  test('KMB mode should show KMB data source text', async ({ page }) => {
    const footer = page.locator('.landing-footer')
    await expect(footer).toContainText('KMB')
  })
})

test.describe('Frontpage — Switch Language', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should start with Traditional Chinese by default', async ({ page }) => {
    const langBtn = page.locator('#langBtn')
    await expect(langBtn).toHaveText('繁')

    const title = page.locator('.landing-title')
    await expect(title).toContainText('九巴即時到站')
  })

  test('should cycle language: 繁 → EN → 简 → 繁', async ({ page }) => {
    const langBtn = page.locator('#langBtn')

    await langBtn.click()
    await expect(langBtn).toHaveText('EN')

    const titleEn = page.locator('.landing-title')
    await expect(titleEn).toContainText('HK Bus Tracker')

    await langBtn.click()
    await expect(langBtn).toHaveText('简')

    const titleSc = page.locator('.landing-title')
    await expect(titleSc).toContainText('巴士动态')

    await langBtn.click()
    await expect(langBtn).toHaveText('繁')

    const titleTc = page.locator('.landing-title')
    await expect(titleTc).toContainText('九巴即時到站')
  })

  test('should update subtitle text when language changes', async ({ page }) => {
    const langBtn = page.locator('#langBtn')
    const sub = page.locator('.landing-sub')

    await langBtn.click()
    await expect(sub).toContainText('Real-time')
    await expect(sub).toContainText('KMB')

    await langBtn.click()
    await expect(sub).toContainText('九巴')
  })

  test('should update search placeholder when language changes', async ({ page }) => {
    const langBtn = page.locator('#langBtn')

    await langBtn.click()
    const inputEn = page.locator('#searchInput')
    await expect(inputEn).toHaveAttribute('placeholder', /Search route/)

    await langBtn.click()
    const inputSc = page.locator('#searchInput')
    await expect(inputSc).toHaveAttribute('placeholder', /输入路线/)
  })

  test('should persist language across page reload', async ({ page }) => {
    const langBtn = page.locator('#langBtn')

    await langBtn.click()
    await expect(langBtn).toHaveText('EN')

    await page.reload()

    const langBtnAfter = page.locator('#langBtn')
    await expect(langBtnAfter).toHaveText('EN')

    const title = page.locator('.landing-title')
    await expect(title).toContainText('HK Bus Tracker')
  })

  test('should update search button text when language changes', async ({ page }) => {
    const langBtn = page.locator('#langBtn')
    const searchBtn = page.locator('.search-btn')

    await langBtn.click()
    await expect(searchBtn).toHaveText('GO')
  })
})

test.describe('Frontpage — Company and Language combined', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('switching company preserves current language', async ({ page }) => {
    const langBtn = page.locator('#langBtn')
    await langBtn.click()
    await expect(langBtn).toHaveText('EN')

    const ctbBtn = page.locator('.company-btn[data-company="ctb"]')
    await ctbBtn.click()

    const langBtnAfter = page.locator('#langBtn')
    await expect(langBtnAfter).toHaveText('EN')

    const title = page.locator('.landing-title')
    await expect(title).toContainText('CTB Bus Tracker')
  })

  test('switching language preserves current company', async ({ page }) => {
    const ctbBtn = page.locator('.company-btn[data-company="ctb"]')
    await ctbBtn.click()

    const landing = page.locator('.landing')
    await expect(landing).toHaveClass(/landing-ctb/)

    const langBtn = page.locator('#langBtn')
    await langBtn.click()

    const landingAfter = page.locator('.landing')
    await expect(landingAfter).toHaveClass(/landing-ctb/)
  })
})