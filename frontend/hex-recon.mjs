// Recon pass over the logged-in Hex notebook via CDP.
import { chromium } from "@playwright/test";

const cdp = await chromium.connectOverCDP("http://localhost:9222");
const pages = cdp.contexts().flatMap((c) => c.pages());
const page = pages.find((p) => p.url().includes("hex.tech"));
if (!page) {
  console.log("NO HEX PAGE. urls:", pages.map((p) => p.url()));
  process.exit(1);
}
console.log("URL:", page.url());

const recon = await page.evaluate(() => {
  const testids = new Set();
  for (const el of document.querySelectorAll("[data-cy]")) {
    testids.add("cy:" + el.getAttribute("data-cy"));
  }
  for (const el of document.querySelectorAll("[data-testid]")) {
    testids.add("tid:" + el.getAttribute("data-testid"));
  }
  return {
    title: document.title,
    bodyFont: getComputedStyle(document.body).fontFamily,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    counts: {
      dataCy: document.querySelectorAll("[data-cy]").length,
      dataTestid: document.querySelectorAll("[data-testid]").length,
    },
    ids: [...testids].slice(0, 150),
  };
});
console.log(JSON.stringify(recon, null, 1));
await page.screenshot({
  path: "/private/tmp/claude-501/-/f6fe8ca3-3a0d-4934-990e-614e5fa2c782/scratchpad/hex-live.png",
});
await cdp.close();
