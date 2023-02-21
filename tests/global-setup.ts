import { chromium } from '@playwright/test';
import login from './login.js';

const username = process.env.GITHUB_USER ?? '';
const password = process.env.GITHUB_PASS ?? '';

async function globalSetup(config: FullConfig): Promise<void> {
  const { storageState } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await login(page, username, password);
  await page.context().storageState({
    path: storageState,
  });
  await browser.close();
}

export default globalSetup;
