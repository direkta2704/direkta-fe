import type { Browser } from "puppeteer-core";

const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

export async function launchBrowser(): Promise<Browser> {
  if (isVercel) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = (await import("puppeteer-core")).default;

    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
      defaultViewport: { width: 1280, height: 800 },
    });
  }

  const puppeteer = (await import("puppeteer")).default;
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  }) as unknown as Browser;
}
