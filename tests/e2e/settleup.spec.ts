import { test, expect } from '@playwright/test';

test.describe('SettleUp End-to-End Visual Workflows', () => {

  test('should authorize user via Quick Login and load dashboard', async ({ page }) => {
    // 1. Load login page
    await page.goto('/login');
    await expect(page.locator('h1')).toHaveText('SettleUp Portal');

    // 2. Click Quick Login for Aisha
    const aishaButton = page.getByRole('button', { name: /Aisha/ });
    await expect(aishaButton).toBeVisible();
    await aishaButton.click();

    // 3. Verify redirection to Dashboard
    await page.waitForURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Welcome back, Aisha!');
    
    // 4. Verify metrics cards are rendered
    await expect(page.locator('text=Active Groups')).toBeVisible();
    await expect(page.locator('text=Reviews Pending')).toBeVisible();
  });

  test('should create a new roomspace group', async ({ page }) => {
    // 1. Login and go to groups
    await page.goto('/login');
    await page.getByRole('button', { name: /Aisha/ }).click();
    await page.waitForURL('/dashboard');
    
    await page.goto('/groups');
    await expect(page.locator('h1')).toHaveText('Collaborative Rooms');

    // 2. Open group creation dialog
    const createButton = page.locator('#create-group-trigger');
    await createButton.click();

    // 3. Fill in and submit group details
    const groupNameInput = page.locator('#group-name-input');
    await groupNameInput.fill('Playwright Test Flatmates');
    
    const submitButton = page.locator('#group-submit-button');
    await submitButton.click();

    // 4. Verify new group exists on page
    await expect(page.locator('text=Playwright Test Flatmates')).toBeVisible();
  });

  test('should record manual expense and participant splits', async ({ page }) => {
    // 1. Login and navigate to the pre-seeded Spreetail Flatmates group
    await page.goto('/login');
    await page.getByRole('button', { name: /Aisha/ }).click();
    await page.waitForURL('/dashboard');

    await page.goto('/groups');
    const groupLink = page.locator('text=Spreetail Flatmates');
    await groupLink.click();
    
    await page.waitForURL(/\/groups\/[a-f0-9-]+/);
    await expect(page.locator('h1')).toHaveText('Spreetail Flatmates');

    // 2. Open Log Expense Dialog
    await page.getByRole('button', { name: 'Log Expense' }).click();

    // 3. Fill in expense description and amount
    await page.locator('#expense-description-input').fill('Playwright Snacks');
    await page.locator('#expense-amount-input').fill('150.00');

    // 4. Select split strategy and payer
    await page.locator('#expense-payer-select').selectOption({ label: 'Aisha' });
    await page.locator('#expense-strategy-select').selectOption('EQUAL');

    // 5. Submit the expense
    await page.locator('#expense-submit-button').click();

    // 6. Verify expense is added to the feed
    await expect(page.locator('text=Playwright Snacks').first()).toBeVisible();
    await expect(page.locator('text=₹150.00').first()).toBeVisible();
  });

  test('should complete multi-stage CSV dry-run review and final commit', async ({ page }) => {
    // 1. Login and navigate to Import Center
    await page.goto('/login');
    await page.getByRole('button', { name: /Aisha/ }).click();
    await page.waitForURL('/dashboard');

    await page.goto('/import');
    await expect(page.locator('h1')).toContainText('CSV Ingestion Center');

    // 2. Select target group
    await page.locator('#import-group-select').selectOption({ label: 'Spreetail Flatmates' });

    // 3. Prepare mock CSV data (Aisha paid for pizza Friday, Rohan split equal)
    const uniqueDesc = `Ingested Pizza Friday ${Date.now()}`;
    const csvContent = 
      `date,description,amount,currency,payer,split_type,split_with,split_details\n` +
      `2026-02-15,${uniqueDesc},1200,INR,Aisha,equal,Aisha;Rohan,\n`;

    // 4. Upload file in dropzone
    await page.setInputFiles('#file-upload-input', {
      name: 'playwright_upload.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });

    // 5. Verify redirect to the Review Queue workspace
    await page.waitForURL(/\/import\/review\/[a-f0-9-]+/);
    await expect(page.locator('h1')).toContainText('Review Workspace');

    // 6. Renders staged normalization proposals. Click "Approve Change" on the card
    const approveButton = page.locator('button:has-text("Approve Change")');
    if (await approveButton.isVisible()) {
      await approveButton.click();
    }

    // 7. Once proposals are resolved, the Commit Gate opens. Click "Commit Import"
    const commitButton = page.locator('#commit-import-button');
    await expect(commitButton).toBeVisible();
    await commitButton.click();

    // 8. Verify redirection to the final Import Report summary viewer
    await page.waitForURL(/\/import\/report\/[a-f0-9-]+/);
    await expect(page.locator('h1')).toHaveText('Import Ingestion Complete');
    await expect(page.locator(`text=${uniqueDesc}`)).toBeVisible();
  });

});
