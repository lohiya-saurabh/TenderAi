/**
 * Clause workspace (Phase 2): U2–U13 of the test plan, against the real API and web app,
 * with tenders seeded through the extraction-completed webhook.
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { USERS, goldenEvent, navigate, scaleEvent, seedTender, uiLogin } from './support/clauseFixture';

const MANAGER = 'Vikramaditya Sharma'; // seeded bid manager (bidmanager@acme.com)
let bidId = '';
let scaleBidId = '';

const row = (page: Page, text: string) =>
  page.locator('[data-testid^="clause-row-"]').filter({ hasText: text }).first();

async function openWorkspace(page: Page, query = '') {
  await navigate(page, `/bids/${bidId}/clauses${query}`);
  await expect(page.getByTestId('clause-list')).toBeVisible();
}

test.describe.serial('clause workspace', () => {
  test.beforeAll(async ({ request }) => {
    ({ bidId } = await seedTender(request, 'E2E Fixture Works Tender', goldenEvent()));
    ({ bidId: scaleBidId } = await seedTender(request, 'E2E Scale Works Tender', scaleEvent(700)));
  });

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (e) => console.log('PAGEERR', e.message));
    await uiLogin(page);
  });

  test('U1 overview entry is truthful and opens filtered views', async ({ page }) => {
    await navigate(page, `/bids/${bidId}`);
    const entry = page.getByTestId('clause-entry');
    await expect(entry).toContainText('9 clauses from 1 document');
    await expect(page.locator('body')).not.toContainText('ZERO');
    const tiles = entry.getByTestId('attention-tile');
    await expect(tiles.filter({ hasText: 'Conflicts' })).toContainText('2');
    await expect(tiles.filter({ hasText: 'Pages not analysed' })).toContainText('1');
    await tiles.filter({ hasText: 'Conflicts' }).click();
    await expect(page).toHaveURL(/view=conflict/);
    await expect(page.getByTestId('showing-count')).toHaveText('Showing 4 of 9');
  });

  test('U2 document order, section groups, view kept in the URL', async ({ page }) => {
    await openWorkspace(page);
    const refs = await page.locator('[data-testid^="clause-row-"] button span.font-mono > span:first-child').allInnerTexts();
    expect(refs).toEqual(['2.1', '3.1', '4.1', 'A1.1', 'A1.2', 'A1.3', 'SCC 7.1', 'No clause no.', '9.1']);
    await expect(page.getByRole('list', { name: 'Clauses' })).toContainText('Clause 2');

    await page.getByRole('tab', { name: /Disqualifying if missed/ }).click();
    await page.getByLabel('Group by').selectOption('stage');
    await expect(page).toHaveURL(/view=dq/);
    await expect(page).toHaveURL(/group=stage/);
    await expect(page.getByTestId('showing-count')).toHaveText('Showing 2 of 9');
    await expect(page.getByRole('list', { name: 'Clauses' })).toContainText('With bid online');

    // A shared link restores the same view.
    const url = new URL(page.url());
    await navigate(page, `/bids/${bidId}`);
    await navigate(page, url.pathname + url.search);
    await expect(page.getByTestId('showing-count')).toHaveText('Showing 2 of 9');
    await expect(page.getByLabel('Group by')).toHaveValue('stage');
  });

  test('U3 rows show the tender reference and only stated attestation', async ({ page }) => {
    await openWorkspace(page);
    const affidavit = row(page, 'Non-blacklisting affidavit');
    await expect(affidavit).toContainText('A1.2');
    await expect(affidavit).toContainText('p.3');
    await expect(affidavit).toContainText('Stamp ₹10');
    await expect(affidavit).toContainText('Notarised');
    await expect(row(page, 'Turnover certificate')).toContainText('UDIN');
    await expect(row(page, 'Turnover certificate')).not.toContainText('Notarised');
    await expect(row(page, 'Bid validity')).toContainText('No clause no.');
    await expect(row(page, 'Defect liability')).not.toContainText('Stamp');
  });

  test('U4 panel opens beside the list; source page highlights the quote; no new tab', async ({ page, context }) => {
    await openWorkspace(page);
    const tabs = context.pages().length;
    await row(page, 'Non-blacklisting affidavit').getByRole('button').click();
    const panel = page.getByTestId('clause-panel');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('clause-list')).toBeVisible();
    expect(context.pages().length).toBe(tabs);
    const quote = (await panel.getByTestId('panel-quote').innerText()).replace(/\s+/g, ' ').trim();
    await panel.getByTestId('open-source').click();
    const mark = page.getByTestId('source-highlight');
    await expect(mark).toBeVisible();
    expect((await mark.innerText()).replace(/\s+/g, ' ').trim()).toBe(quote);
    await expect(panel).toContainText('Found on p.3');
    await expect(panel.getByTestId('not-stated')).toContainText('deadline');
  });

  test('U5 disqualifying clause needs the source before Confirm; Undo restores', async ({ page }) => {
    await openWorkspace(page);
    await row(page, 'Physical originals deadline').getByRole('button').click();
    const panel = page.getByTestId('clause-panel');
    const confirm = panel.getByTestId('review-confirm');
    await expect(confirm).toBeDisabled();
    await expect(panel.getByTestId('confirm-hint')).toContainText('disqualifying');
    await panel.getByTestId('open-source').click();
    await expect(page.getByTestId('source-highlight')).toBeVisible();
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(panel).toContainText(`Confirmed · ${MANAGER}`);
    await expect(page.getByTestId('toast')).toContainText('3.1: confirmed');
    await expect(row(page, 'Physical originals deadline')).toContainText('Confirmed');
    await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click();
    await expect(panel).toContainText('Unreviewed');
    await expect(row(page, 'Physical originals deadline')).toContainText('Unreviewed');
  });

  test('U6 correct records the change and persists', async ({ page }) => {
    await openWorkspace(page);
    await row(page, 'Defect liability period').getByRole('button').click();
    const panel = page.getByTestId('clause-panel');
    await panel.getByTestId('review-correct').click();
    await panel.getByTestId('correct-form').getByLabel('Title').fill('Defect liability: 24 months');
    await panel.getByTestId('correct-save').click();
    await expect(panel).toContainText('Corrected');
    await expect(panel.getByRole('heading', { level: 2 })).toHaveText('Defect liability: 24 months');
    await expect(panel).toContainText('changed title');
    await navigate(page, `/bids/${bidId}`);
    await openWorkspace(page);
    await expect(row(page, 'Defect liability: 24 months')).toContainText('Corrected');
  });

  test('U7 conflicts view: both values with their quotes, AI note labelled, query cites both', async ({ page }) => {
    await navigate(page, `/bids/${bidId}/conflicts`);
    const card = page.getByTestId('conflict-card').filter({ hasText: 'EMD amount' });
    await expect(card).toContainText('Rs. 7,500');
    await expect(card).toContainText('Rs. 12,500');
    await expect(card).toContainText('2.1 · p.1');
    await expect(card).toContainText('A1.1 · p.3');
    const draft = await card.getByTestId('query-draft').inputValue();
    expect(draft).toContain('Clause 2.1 (page 1)');
    expect(draft).toContain('Clause A1.1 (page 3)');
    await card.getByRole('button', { name: 'Accept Rs. 7,500' }).click();
    await expect(card).toContainText(`Value accepted · ${MANAGER}`);
    await openWorkspace(page);
    await expect(row(page, 'Earnest Money Deposit')).not.toContainText('Conflict');
  });

  test('U8 coverage banner names the unread page and opens it', async ({ page }) => {
    await openWorkspace(page);
    await expect(row(page, 'Defect liability')).toContainText('Near unread page');
    const banner = page.getByTestId('coverage-banner');
    await expect(banner).toContainText('Page 7 of Fixture_NIT_2026.pdf');
    await banner.getByRole('button', { name: 'View page 7' }).click();
    await expect(page.getByTestId('page-not-analysed')).toBeVisible();
    await expect(page.getByTestId('source-viewer')).toContainText('p.7');
  });

  test('U9 keyboard review: J/K move, A confirms a spot-check, row stays visible, shortcuts can be off', async ({ page }) => {
    await openWorkspace(page);
    await row(page, 'Bid validity').getByRole('button').click();
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('k');
    await expect(page).toHaveURL(new RegExp(`clause=`));
    const afterK = new URL(page.url()).searchParams.get('clause');
    await page.keyboard.press('j');
    const afterJ = new URL(page.url()).searchParams.get('clause');
    expect(afterJ).not.toBe(afterK);
    await expect(page.getByTestId('clause-panel')).toContainText('Bid validity');
    await page.keyboard.press('a');
    await expect(page.getByTestId('clause-panel')).toContainText(`Confirmed · ${MANAGER}`);

    const list = await page.getByTestId('clause-list').boundingBox();
    const selected = await page.locator('[data-testid^="clause-row-"][aria-current="true"]').boundingBox();
    expect(selected!.y).toBeGreaterThanOrEqual(list!.y + 30);

    await page.getByRole('button', { name: /Shortcuts on/ }).click();
    const before = page.url();
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('j');
    expect(page.url()).toBe(before);
    await page.getByRole('button', { name: /Shortcuts off/ }).click();
  });

  test('U10 bulk confirm only takes clean spot-check clauses', async ({ page }) => {
    await navigate(page, `/bids/${scaleBidId}/clauses`);
    await expect(page.getByTestId('clause-list')).toBeVisible();
    await page.getByLabel('Select 1.2', { exact: true }).check();
    await page.getByLabel('Select 1.3', { exact: true }).check();
    await page.getByLabel('Select 1.1', { exact: true }).check(); // disqualifying -> skipped
    const bar = page.getByTestId('batch-bar');
    await expect(bar).toContainText('3 selected');
    await expect(bar).toContainText('Confirm 2 spot-check clauses');
    await expect(bar).toContainText('1 flagged or non-spot-check clauses will be skipped');
    await bar.getByRole('button', { name: /Confirm 2/ }).click();
    await expect(page.getByTestId('toast')).toContainText('Confirmed 2 spot-check clauses; 1 skipped');
    await expect(row(page, 'Requirement 2')).toContainText('Confirmed');
  });

  test('U11 700 clauses: fast first paint, fast filtering, bounded DOM', async ({ page }) => {
    const start = Date.now();
    await navigate(page, `/bids/${scaleBidId}/clauses`);
    await expect(page.locator('[data-testid^="clause-row-"]').first()).toBeVisible();
    expect(Date.now() - start).toBeLessThan(5000);
    expect(await page.locator('[data-testid^="clause-row-"]').count()).toBeLessThan(60);
    await expect(page.getByTestId('showing-count')).toHaveText('Showing 700 of 700');
    const t0 = Date.now();
    await page.getByRole('tab', { name: /Disqualifying if missed/ }).click();
    await expect(page.getByTestId('showing-count')).toHaveText('Showing 14 of 700');
    expect(Date.now() - t0).toBeLessThan(1000);
    await page.getByRole('tab', { name: /^All/ }).click();
    await page.getByTestId('clause-list').evaluate((el) => (el.scrollTop = 30000));
    await expect(page.getByRole('list', { name: 'Clauses' })).toBeVisible();
    expect(await page.locator('[data-testid^="clause-row-"]').count()).toBeLessThan(60);
  });

  test('U12 accessibility: no serious violations', async ({ page }) => {
    const scan = async (label: string) => {
      const results = await new AxeBuilder({ page }).include('main').analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${label}: ${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
    };
    await openWorkspace(page);
    await scan('workspace');
    await row(page, 'Non-blacklisting affidavit').getByRole('button').click();
    await expect(page.getByTestId('clause-panel')).toBeVisible();
    await scan('panel');
    await navigate(page, `/bids/${bidId}/conflicts`);
    await expect(page.getByTestId('conflict-card').first()).toBeVisible();
    await scan('conflicts');
  });

  test('U13 read-only users see the clauses but no review actions', async ({ page }) => {
    await page.context().clearCookies();
    await uiLogin(page, USERS.readOnly);
    await openWorkspace(page);
    await expect(page.locator('[data-testid^="clause-row-"] input[type="checkbox"]')).toHaveCount(0);
    await row(page, 'Non-blacklisting affidavit').getByRole('button').click();
    const panel = page.getByTestId('clause-panel');
    await expect(panel.getByTestId('read-only-note')).toBeVisible();
    await expect(panel.getByTestId('review-confirm')).toHaveCount(0);
  });

  test('old review links open the clause in the workspace', async ({ page }) => {
    await openWorkspace(page);
    await row(page, 'Bid validity').getByRole('button').click();
    const id = new URL(page.url()).searchParams.get('clause');
    await navigate(page, `/bids/${bidId}/compliance/${id}`);
    await expect(page).toHaveURL(new RegExp(`/bids/${bidId}/clauses\\?clause=${id}`));
    await expect(page.getByTestId('clause-panel')).toContainText('Bid validity');
  });
});
