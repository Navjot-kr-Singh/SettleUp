import { test, expect } from '@playwright/test';

test.describe('Self-Service Authentication & Signup Workflows', () => {

  test('Flow A: Register New User -> Auto Login -> Create Group & Expense -> Logout -> Login Again', async ({ page }) => {
    // 1. Visit signup page
    await page.goto('/signup');
    await expect(page.locator('h1')).toHaveText('Create Account');

    const uniqueEmail = `testuser-${Date.now()}@example.com`;
    const password = 'securePassword123';

    // 2. Fill registration details
    await page.locator('#name-input').fill('Alice Test');
    await page.locator('#email-input').fill(uniqueEmail);
    await page.locator('#password-input').fill(password);
    await page.locator('#confirm-password-input').fill(password);

    // 3. Submit registration (this triggers auto-login and redirects to dashboard)
    await page.locator('#signup-submit-button').click();
    await page.waitForURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Welcome back, Alice Test!');

    // 4. Navigate to Groups and create a new group
    await page.goto('/groups');
    await expect(page.locator('h1')).toHaveText('Collaborative Rooms');

    const uniqueGroupName = `Alice Flatmates ${Date.now()}`;
    await page.locator('#create-group-trigger').click();
    await page.locator('#group-name-input').fill(uniqueGroupName);
    await page.locator('#group-submit-button').click();

    // Verify group exists
    const groupLink = page.locator(`text=${uniqueGroupName}`);
    await expect(groupLink).toBeVisible();

    // 5. Navigate to the new group workspace and add an expense
    await groupLink.click();
    await page.waitForURL(/\/groups\/[a-f0-9-]+/);
    await expect(page.locator('h1')).toHaveText(uniqueGroupName);

    await page.getByRole('button', { name: 'Log Expense' }).click();
    await page.locator('#expense-description-input').fill('House Groceries');
    await page.locator('#expense-amount-input').fill('600.00');
    await page.locator('#expense-payer-select').selectOption({ label: 'Alice Test' });
    await page.locator('#expense-strategy-select').selectOption('EQUAL');
    await page.locator('#expense-submit-button').click();

    // Verify expense appears
    await expect(page.locator('text=House Groceries').first()).toBeVisible();
    await expect(page.locator('text=₹600.00').first()).toBeVisible();

    // 6. Logout of the application
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await page.waitForURL('/login');
    await expect(page.locator('h1')).toHaveText('SettleUp Portal');

    // 7. Login again with the newly created account credentials
    await page.locator('#email-input').fill(uniqueEmail);
    await page.locator('#password-input').fill(password);
    await page.locator('#login-submit-button').click();
    await page.waitForURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Welcome back, Alice Test!');

    // 8. Go back to groups and verify that the group and expense data persist
    await page.goto('/groups');
    await expect(page.locator(`text=${uniqueGroupName}`)).toBeVisible();
    await page.locator(`text=${uniqueGroupName}`).click();
    await page.waitForURL(/\/groups\/[a-f0-9-]+/);
    await expect(page.locator('text=House Groceries').first()).toBeVisible();
  });

  test('Flow B: Demo Reviewer Quick Login (Aisha)', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Login as Aisha' }).click();
    await page.waitForURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Welcome back, Aisha!');
  });

  test('Flow E: Guest Login Attempt -> Rejected', async ({ page }) => {
    await page.goto('/login');
    // Attempt login with a guest placeholder email and password
    await page.locator('#email-input').fill('guest-some-random-uuid@settleup.local');
    await page.locator('#password-input').fill('guest-account');
    await page.locator('#login-submit-button').click();

    // Verify error notification is displayed
    await expect(page.locator('.bg-red-50')).toBeVisible();
    await expect(page.locator('.bg-red-50')).toContainText('Invalid email or password');
  });

});
