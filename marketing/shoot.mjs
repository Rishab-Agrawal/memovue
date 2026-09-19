/*
  Screenshots every .slide in carousel.html to marketing/out/NN.png at exactly 1080x1350.
  Playwright is already here for the test suite, so this needs nothing new.

    node marketing/shoot.mjs
*/
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } });
await page.goto(pathToFileURL(join(here, "carousel.html")).href);
// Webfont metrics change the line breaks, so nothing is shot until Archivo has landed.
await page.evaluate(() => document.fonts.ready);

const slides = await page.locator(".slide").all();
for (const [index, slide] of slides.entries()) {
  const name = String(index + 1).padStart(2, "0") + ".png";
  await slide.screenshot({ path: join(out, name) });
  console.log(name, await slide.boundingBox().then((b) => `${b.width}x${b.height}`));
}

await browser.close();
