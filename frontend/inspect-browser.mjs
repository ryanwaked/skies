// Opens a headed Chromium with a persistent profile so the user can log into
// app.hex.tech. Exposes CDP on :9222 so other scripts can connect and inspect.
import { chromium } from "@playwright/test";

const profileDir =
  "/private/tmp/claude-501/-/f6fe8ca3-3a0d-4934-990e-614e5fa2c782/scratchpad/hex-profile";

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: null,
  args: [
    "--remote-debugging-port=9222",
    "--window-size=1440,900",
    "--no-first-run",
  ],
});

const page = context.pages()[0] ?? (await context.newPage());
await page.goto("https://app.hex.tech", { waitUntil: "domcontentloaded" });
console.log("Browser open at app.hex.tech — waiting for user login.");
// Keep the process (and browser) alive until killed.
await new Promise(() => {});
