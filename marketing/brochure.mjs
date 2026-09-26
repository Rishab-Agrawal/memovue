/*
  Renders the collab brochure at /collab to public/memovue-collab.pdf, as one page as tall as
  the brochure so no section breaks across pages. Phone width, since that is where it is read.
  Needs the app running:

    node marketing/brochure.mjs [base url, default http://localhost:3000]
*/
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const base = process.argv[2] ?? "http://localhost:3000";
const out = fileURLToPath(
  new URL("../public/memovue-collab.pdf", import.meta.url),
);
const width = 540;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });
await page.goto(`${base}/collab`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.emulateMedia({ media: "print" });

const height = await page.evaluate(() => document.documentElement.scrollHeight);
await page.pdf({
  path: out,
  width: `${width}px`,
  height: `${height}px`,
  printBackground: true,
  pageRanges: "1",
});
console.log(out, `${width}x${height}`);

await browser.close();
