// Pass 4: icon rail anatomy, side panel typography, prose scale re-check.
import { chromium } from "@playwright/test";

const cdp = await chromium.connectOverCDP("http://localhost:9222");
const page = cdp
  .contexts()
  .flatMap((c) => c.pages())
  .find((p) => p.url().includes("hex.tech"));
console.log("URL:", page.url());

const data = await page.evaluate(() => {
  const pick = (el, props) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const out = {
      tag: el.tagName.toLowerCase(),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    };
    for (const p of props) out[p] = cs[p];
    return out;
  };

  const out = { viewport: { w: innerWidth, h: innerHeight } };

  // --- Left icon rail: buttons/anchors in the leftmost 60px, full height.
  const railItems = [...document.querySelectorAll("button, a, [role=button]")]
    .filter((b) => {
      const r = b.getBoundingClientRect();
      return r.x < 55 && r.width > 10 && r.width < 55 && r.y > 40 && r.height > 10;
    })
    .sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y);
  out.railItems = railItems.map((b) => {
    const r = b.getBoundingClientRect();
    const svg = b.querySelector("svg");
    const sr = svg?.getBoundingClientRect();
    const cs = getComputedStyle(b);
    return {
      y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      svg: sr ? { w: Math.round(sr.width), h: Math.round(sr.height) } : null,
      bg: cs.backgroundColor, color: cs.color, radius: cs.borderRadius,
      label: (b.getAttribute("aria-label") || b.getAttribute("data-tooltip") || b.title || "").slice(0, 30),
    };
  });

  // --- The open side panel (left of the notebook, right of the rail).
  // Find a wide-ish column starting near x=48.
  const panel = [...document.querySelectorAll("div")].find((d) => {
    const r = d.getBoundingClientRect();
    return r.x > 40 && r.x < 80 && r.width > 250 && r.width < 500 && r.height > innerHeight * 0.7;
  });
  out.panel = pick(panel, ["backgroundColor", "borderRight", "width", "padding", "fontSize"]);
  if (panel) {
    // headings inside panel
    const heads = [...panel.querySelectorAll("h1,h2,h3,h4,h5,h6,[class*=Heading],[class*=Title]")].slice(0, 4);
    out.panelHeads = heads.map((h) => ({
      text: h.textContent.trim().slice(0, 30),
      ...pick(h, ["fontSize", "fontWeight", "color", "marginBottom", "fontFamily"]),
    }));
    // body text sample
    const body = [...panel.querySelectorAll("p, span, div")].find(
      (e) => e.children.length === 0 && e.textContent.trim().length > 40,
    );
    out.panelBody = { text: body?.textContent.trim().slice(0, 40), ...pick(body, ["fontSize", "lineHeight", "color"]) };
  }

  // --- Rendered markdown prose in the notebook (Explanation cell).
  const prose = [...document.querySelectorAll("p")].filter((p) =>
    p.textContent.includes("comprehensive annual survey"),
  );
  out.proseAll = prose.map((p) => pick(p, ["fontSize", "lineHeight", "fontFamily", "color"]));

  // Rendered markdown headings anywhere in the doc.
  const hs = {};
  for (const tag of ["h1", "h2", "h3"]) {
    const el = [...document.querySelectorAll(tag)].find((h) => h.getBoundingClientRect().width > 100);
    if (el) hs[tag] = { text: el.textContent.trim().slice(0, 25), ...pick(el, ["fontSize", "fontWeight", "letterSpacing", "lineHeight"]) };
  }
  out.renderedHeadings = hs;

  // --- Monaco source font size (markdown source area).
  const view = [...document.querySelectorAll(".view-lines")].map((v) => ({
    ...pick(v, ["fontSize", "lineHeight"]),
    sample: v.textContent.trim().slice(0, 30),
  }));
  out.monacoAreas = view.slice(0, 4);

  // --- Cell on-border label size (re-check).
  const label = [...document.querySelectorAll("span, div")].find(
    (e) => e.children.length === 0 && ["Explanation", "Introduction"].includes(e.textContent.trim()),
  );
  out.cellLabel = pick(label, ["fontSize", "color", "fontWeight"]);

  // --- Global UI font sanity (body + a top bar button).
  out.bodyFontSize = getComputedStyle(document.body).fontSize;

  return out;
});
console.log(JSON.stringify(data, null, 1));
await page.screenshot({
  path: "/private/tmp/claude-501/-/f6fe8ca3-3a0d-4934-990e-614e5fa2c782/scratchpad/hex-live2.png",
});
await cdp.close();
