import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const outDir = join(process.cwd(), '.tmp-jarvis-email-preview');
await mkdir(outDir, { recursive: true });

const shots = [
  { name: 'laptop', width: 1280, height: 720, path: '/dev/jarvis-record' },
  { name: 'phone', width: 390, height: 844, path: '/dev/jarvis-record' },
  { name: 'jarvis-phone', width: 390, height: 844, path: '/jarvis' },
  { name: 'jarvis-laptop', width: 1280, height: 720, path: '/jarvis' },
];

const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
});

const measure = async (page) =>
  page.evaluate(() => {
    const doc = document.documentElement;
    const engine = document.querySelector('.jarvis-demo-engine');
    const orb = document.querySelector('.provvy-orb');
    const chips = document.querySelector('.jarvis-demo-engine ul');
    const header = document.querySelector('header');
    const cookie = Array.from(document.querySelectorAll('h3')).find((el) =>
      /we use cookies/i.test(el.textContent || '')
    );
    const issue = document.querySelector('nextjs-portal');
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    };
    return {
      overflowX: doc.scrollWidth > doc.clientWidth + 1,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      scrollHeight: doc.scrollHeight,
      clientHeight: doc.clientHeight,
      orbState: engine?.getAttribute('data-orb-state') ?? null,
      hero: engine?.getAttribute('data-hero-scenario') ?? null,
      recording: Boolean(document.querySelector('[data-jarvis-recording="true"]')),
      cookieVisible: Boolean(cookie),
      issueBadge: Boolean(issue),
      header: rect(header),
      orb: rect(orb),
      chips: rect(chips),
      engine: rect(engine),
    };
  });

for (const shot of shots) {
  const context = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(`http://localhost:3000${shot.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(800);
  const idle = await measure(page);
  await page.screenshot({
    path: join(outDir, `${shot.name}-idle.png`),
    fullPage: false,
  });
  console.log(JSON.stringify({ shot: `${shot.name}-idle`, ...idle }, null, 2));

  if (shot.path === '/jarvis') {
    try {
      await page.getByRole('button', { name: /accept all/i }).click({ timeout: 2500 });
      await page.waitForTimeout(400);
    } catch {
      // Banner may already be dismissed in this browser profile.
    }
    console.log(JSON.stringify({ shot: `${shot.name}-after-consent`, ...(await measure(page)) }, null, 2));
    await page.screenshot({ path: join(outDir, `${shot.name}-after-consent.png`) });
  }

  if (shot.path === '/dev/jarvis-record') {
    await page.getByRole('button', { name: /start generate an invoice demo/i }).click();
    await page.waitForTimeout(400);
    console.log(JSON.stringify({ shot: `${shot.name}-listening`, ...(await measure(page)) }, null, 2));
    await page.screenshot({ path: join(outDir, `${shot.name}-listening.png`) });

    await page.waitForSelector('[data-orb-state="thinking"]', { timeout: 2000 });
    await page.waitForTimeout(200);
    console.log(JSON.stringify({ shot: `${shot.name}-thinking`, ...(await measure(page)) }, null, 2));
    await page.screenshot({ path: join(outDir, `${shot.name}-thinking.png`) });

    await page.waitForSelector('[data-orb-state="speaking"]', { timeout: 4000 });
    await page.waitForTimeout(400);
    console.log(JSON.stringify({ shot: `${shot.name}-speaking`, ...(await measure(page)) }, null, 2));
    await page.screenshot({ path: join(outDir, `${shot.name}-speaking.png`) });

    await page.waitForSelector('[data-orb-state="executing"]', { timeout: 12000 });
    await page.waitForTimeout(200);
    console.log(JSON.stringify({ shot: `${shot.name}-executing`, ...(await measure(page)) }, null, 2));
    await page.screenshot({ path: join(outDir, `${shot.name}-executing.png`) });

    await page.waitForSelector('[data-orb-state="success"]', { timeout: 4000 });
    await page.waitForTimeout(250);
    console.log(JSON.stringify({ shot: `${shot.name}-success`, ...(await measure(page)) }, null, 2));
    await page.screenshot({ path: join(outDir, `${shot.name}-success.png`) });
  }

  await context.close();
}

await browser.close();
