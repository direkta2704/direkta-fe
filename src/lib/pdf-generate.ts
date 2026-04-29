import puppeteer from "puppeteer";
import { readFile } from "fs/promises";
import path from "path";

export async function generateExposePdf(exposeUrl: string): Promise<Buffer> {
  const htmlRes = await fetch(exposeUrl);
  if (!htmlRes.ok) throw new Error(`Failed to fetch expose: ${htmlRes.status}`);
  let html = await htmlRes.text();

  const localImgRegex = /src="(\/uploads\/[^"]+)"/g;
  const matches = [...html.matchAll(localImgRegex)];

  for (const match of matches) {
    const localPath = match[1];
    try {
      const filePath = path.join(process.cwd(), "public", localPath);
      const buf = await readFile(filePath);
      const ext = localPath.split(".").pop()?.toLowerCase();
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const dataUri = `data:${mime};base64,${buf.toString("base64")}`;
      html = html.replaceAll(`src="${localPath}"`, `src="${dataUri}"`);
    } catch {
      // file not found, skip
    }
  }

  const localIframeRegex = /src="(\/uploads\/[^"]+\.pdf[^"]*)"/g;
  html = html.replace(localIframeRegex, 'src="about:blank" data-pdf-removed="true"');

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15000 });

    await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll("img"));
      await Promise.all(imgs.map(img => {
        if (img.complete) return;
        return new Promise(resolve => {
          img.addEventListener("load", resolve);
          img.addEventListener("error", resolve);
        });
      }));
    });

    await page.evaluate(() => {
      document.querySelectorAll("iframe").forEach(el => el.remove());
      const controls = document.querySelector(".print-controls");
      if (controls) controls.remove();
    });

    await page.emulateMediaType("print");

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
