// Screenshot helper for the Hex restyle iteration loop.
// Usage: node shot.mjs <output.png> [url] [fullpage]
import { chromium } from "@playwright/test";

const out = process.argv[2] ?? "/tmp/shot.png";
const url = process.argv[3] ?? "http://localhost:3000/?file=hex_demo.py";
const fullPage = process.argv[4] === "full";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  colorScheme: "dark",
});
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") {errors.push(msg.text().slice(0, 300));}
});
page.on("pageerror", (err) => errors.push(String(err).slice(0, 300)));

await page.goto(url, { waitUntil: "domcontentloaded" });
try {
  await page.waitForSelector(".marimo-cell", { timeout: 30000 });
  // let the kernel run cells and outputs settle
  await page.waitForTimeout(8000);
} catch {
  errors.push("TIMEOUT: .marimo-cell never appeared");
}
await page.screenshot({ path: out, fullPage });
await browser.close();

if (errors.length) {
  console.log("CONSOLE ERRORS (first 10):");
  for (const e of errors.slice(0, 10)) {console.log(" -", e);}
} else {
  console.log("no console errors");
}
