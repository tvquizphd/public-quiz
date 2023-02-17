import { test, expect } from '@playwright/test';
import fs from 'fs';

const PORT = '8000'; // match dev.js
const LOCAL = `http://localhost:${PORT}/`;

const user = process.env.GITHUB_USER ?? '';

const deleteGitHubApp = async ({ page, app_name }) => {
  await page.getByRole('link', { name: 'App settings' }).click();
  await page.getByRole('link', { name: 'Advanced' }).click();
  await page.getByRole('button', { name: 'Delete GitHub App' }).click();
  const app_in = 'Please type in the name of the GitHub App to confirm.';
  const rm_in = { name: /delete this GitHub App/i };
  await page.getByLabel(app_in).fill(app_name);
  await page.getByRole('button', rm_in).click();
  fs.unlinkSync('.env');
}

const loadInstallPage = async ({ page }) => {
  const intervals = [ 2000 ];
  await expect(async () => {
    const response = await page.request.get(page.url());
    expect(response.status()).toBe(404);
  }).not.toPass({ intervals });
  await page.reload();
}

test('Create GitHub App Link', async ({ page }) => {
  const quiz_pass = 'root';
  await page.goto(LOCAL);

  await page.getByRole('button', { name: 'Create' }).click();
  const app_input = await page.getByLabel('GitHub App name');
  const app_name = await app_input.inputValue();

  await page.getByRole('button', { name: /create github app/i }).click();
  const install_page_popup = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'GitHub App' }).click();
  const inst_page = await install_page_popup;
  await loadInstallPage({ page: inst_page });

  await inst_page.getByRole('link', { name: /your account/i }).click();
  await inst_page.getByRole('button', { name: 'Install' }).click();
  await page.getByLabel('Password:').fill(quiz_pass);
  await page.getByRole('button', { name: 'Sign up' }).click();
  const login_page_popup = page.waitForEvent('popup');
  await page.getByRole('link', { name: /login/i }).click();
  const login_page = await login_page_popup;
  await expect(login_page).toHaveURL(/.*login/);

  // Delete newly created app
  await deleteGitHubApp({ page: inst_page, app_name });
});
