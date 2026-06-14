# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settleup.spec.ts >> SettleUp End-to-End Visual Workflows >> should create a new roomspace group
- Location: tests/e2e/settleup.spec.ts:24:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Playwright Test Flatmates')
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for locator('text=Playwright Test Flatmates')

```

```yaml
- complementary:
  - text: SettleUp
  - navigation:
    - link "Dashboard":
      - /url: /dashboard
    - link "Groups":
      - /url: /groups
    - link "Import Center":
      - /url: /import
    - link "Audit Trail":
      - /url: /audit-logs
  - text: AI
  - paragraph: Aisha
  - paragraph: MEMBER
  - button "Sign Out"
- banner:
  - text: SettleUp Shared Expenses Governance Platform
  - button
  - text: Aisha
- main:
  - heading "Collaborative Rooms" [level=1]
  - paragraph: Select a roomspace workspace or initialize a new group roster.
  - button "New Group"
  - paragraph: No rooms active
  - paragraph: Click "New Group" to configure your first roomspace.
  - heading "Initialize New Space Group" [level=3]
  - button
  - text: "Invalid `this.prisma.group.findUnique()` invocation in /Users/navjotkumarsingh/Desktop/SettleUp/.next/dev/server/chunks/[root-of-the-server]__1gjfh53._.js:512:34 509 }); 510 } 511 async findGroupByName(name) { → 512 return this.prisma.group.findUnique( Can't reach database server at `ep-aged-meadow-ahovihfr-pooler.c-3.us-east-1.aws.neon.tech:5432` Please make sure your database server is running at `ep-aged-meadow-ahovihfr-pooler.c-3.us-east-1.aws.neon.tech:5432`. Group Space Name"
  - textbox "e.g. Spreetail Flatmates": Playwright Test Flatmates
  - button "Cancel"
  - button "Create Group"
- alert
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('SettleUp End-to-End Visual Workflows', () => {
  4   | 
  5   |   test('should authorize user via Quick Login and load dashboard', async ({ page }) => {
  6   |     // 1. Load login page
  7   |     await page.goto('/login');
  8   |     await expect(page.locator('h1')).toHaveText('SettleUp Portal');
  9   | 
  10  |     // 2. Click Quick Login for Aisha
  11  |     const aishaButton = page.getByRole('button', { name: /Aisha/ });
  12  |     await expect(aishaButton).toBeVisible();
  13  |     await aishaButton.click();
  14  | 
  15  |     // 3. Verify redirection to Dashboard
  16  |     await page.waitForURL('/dashboard');
  17  |     await expect(page.locator('h1')).toContainText('Welcome back, Aisha!');
  18  |     
  19  |     // 4. Verify metrics cards are rendered
  20  |     await expect(page.locator('text=Active Groups')).toBeVisible();
  21  |     await expect(page.locator('text=Reviews Pending')).toBeVisible();
  22  |   });
  23  | 
  24  |   test('should create a new roomspace group', async ({ page }) => {
  25  |     // 1. Login and go to groups
  26  |     await page.goto('/login');
  27  |     await page.getByRole('button', { name: /Aisha/ }).click();
  28  |     await page.waitForURL('/dashboard');
  29  |     
  30  |     await page.goto('/groups');
  31  |     await expect(page.locator('h1')).toHaveText('Collaborative Rooms');
  32  | 
  33  |     // 2. Open group creation dialog
  34  |     const createButton = page.locator('#create-group-trigger');
  35  |     await createButton.click();
  36  | 
  37  |     // 3. Fill in and submit group details
  38  |     const groupNameInput = page.locator('#group-name-input');
  39  |     await groupNameInput.fill('Playwright Test Flatmates');
  40  |     
  41  |     const submitButton = page.locator('#group-submit-button');
  42  |     await submitButton.click();
  43  | 
  44  |     // 4. Verify new group exists on page
> 45  |     await expect(page.locator('text=Playwright Test Flatmates')).toBeVisible();
      |                                                                  ^ Error: expect(locator).toBeVisible() failed
  46  |   });
  47  | 
  48  |   test('should record manual expense and participant splits', async ({ page }) => {
  49  |     // 1. Login and navigate to the pre-seeded Spreetail Flatmates group
  50  |     await page.goto('/login');
  51  |     await page.getByRole('button', { name: /Aisha/ }).click();
  52  |     await page.waitForURL('/dashboard');
  53  | 
  54  |     await page.goto('/groups');
  55  |     const groupLink = page.locator('text=Spreetail Flatmates');
  56  |     await groupLink.click();
  57  |     
  58  |     await page.waitForURL(/\/groups\/[a-f0-9-]+/);
  59  |     await expect(page.locator('h1')).toHaveText('Spreetail Flatmates');
  60  | 
  61  |     // 2. Open Log Expense Dialog
  62  |     await page.getByRole('button', { name: 'Log Expense' }).click();
  63  | 
  64  |     // 3. Fill in expense description and amount
  65  |     await page.locator('#expense-description-input').fill('Playwright Snacks');
  66  |     await page.locator('#expense-amount-input').fill('150.00');
  67  | 
  68  |     // 4. Select split strategy and payer
  69  |     await page.locator('#expense-payer-select').selectOption({ label: 'Aisha' });
  70  |     await page.locator('#expense-strategy-select').selectOption('EQUAL');
  71  | 
  72  |     // 5. Submit the expense
  73  |     await page.locator('#expense-submit-button').click();
  74  | 
  75  |     // 6. Verify expense is added to the feed
  76  |     await expect(page.locator('text=Playwright Snacks').first()).toBeVisible();
  77  |     await expect(page.locator('text=₹150.00').first()).toBeVisible();
  78  |   });
  79  | 
  80  |   test('should complete multi-stage CSV dry-run review and final commit', async ({ page }) => {
  81  |     // 1. Login and navigate to Import Center
  82  |     await page.goto('/login');
  83  |     await page.getByRole('button', { name: /Aisha/ }).click();
  84  |     await page.waitForURL('/dashboard');
  85  | 
  86  |     await page.goto('/import');
  87  |     await expect(page.locator('h1')).toContainText('CSV Ingestion Center');
  88  | 
  89  |     // 2. Select target group
  90  |     await page.locator('#import-group-select').selectOption({ label: 'Spreetail Flatmates' });
  91  | 
  92  |     // 3. Prepare mock CSV data (Aisha paid for pizza Friday, Rohan split equal)
  93  |     const uniqueDesc = `Ingested Pizza Friday ${Date.now()}`;
  94  |     const csvContent = 
  95  |       `date,description,amount,currency,payer,split_type,split_with,split_details\n` +
  96  |       `2026-02-15,${uniqueDesc},1200,INR,Aisha,equal,Aisha;Rohan,\n`;
  97  | 
  98  |     // 4. Upload file in dropzone
  99  |     await page.setInputFiles('#file-upload-input', {
  100 |       name: 'playwright_upload.csv',
  101 |       mimeType: 'text/csv',
  102 |       buffer: Buffer.from(csvContent),
  103 |     });
  104 | 
  105 |     // 5. Verify redirect to the Review Queue workspace
  106 |     await page.waitForURL(/\/import\/review\/[a-f0-9-]+/);
  107 |     await expect(page.locator('h1')).toContainText('Review Workspace');
  108 | 
  109 |     // 6. Renders staged normalization proposals. Click "Approve Change" on the card
  110 |     const approveButton = page.locator('button:has-text("Approve Change")');
  111 |     if (await approveButton.isVisible()) {
  112 |       await approveButton.click();
  113 |     }
  114 | 
  115 |     // 7. Once proposals are resolved, the Commit Gate opens. Click "Commit Import"
  116 |     const commitButton = page.locator('#commit-import-button');
  117 |     await expect(commitButton).toBeVisible();
  118 |     await commitButton.click();
  119 | 
  120 |     // 8. Verify redirection to the final Import Report summary viewer
  121 |     await page.waitForURL(/\/import\/report\/[a-f0-9-]+/);
  122 |     await expect(page.locator('h1')).toHaveText('Import Ingestion Complete');
  123 |     await expect(page.locator(`text=${uniqueDesc}`)).toBeVisible();
  124 |   });
  125 | 
  126 | });
  127 | 
```