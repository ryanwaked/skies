// Measurement pass: computed styles + geometry of the live Hex notebook.
import { chromium } from "@playwright/test";

const cdp = await chromium.connectOverCDP("http://localhost:9222");
const page = cdp
  .contexts()
  .flatMap((c) => c.pages())
  .find((p) => p.url().includes("hex.tech"));

const data = await page.evaluate(() => {
  const pick = (el, props) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const out = { rect: { x: r.x, y: r.y, w: r.width, h: r.height } };
    for (const p of props) out[p] = cs[p];
    return out;
  };
  const byText = (text, sizeMax = 999) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const hits = [];
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (n.textContent.trim() === text) {
        const el = n.parentElement;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs <= sizeMax) hits.push(el);
      }
    }
    return hits;
  };

  const out = {};

  // Top bar: element containing the Notebook/App builder toggle.
  const notebookBtn = byText("Notebook")[0];
  let bar = notebookBtn;
  while (bar && bar.getBoundingClientRect().width < innerWidth * 0.95) {
    bar = bar.parentElement;
  }
  out.topBar = pick(bar, [
    "height", "backgroundColor", "borderBottom", "paddingLeft", "paddingRight",
  ]);
  out.notebookToggle = pick(notebookBtn?.closest("button") ?? notebookBtn, [
    "backgroundColor", "borderRadius", "color", "fontSize", "fontWeight",
    "padding", "height", "fontFamily",
  ]);
  const appBuilder = byText("App builder")[0];
  out.appBuilderToggle = pick(appBuilder?.closest("button") ?? appBuilder, [
    "backgroundColor", "color", "fontSize", "padding",
  ]);
  const share = byText("Share")[0];
  out.shareBtn = pick(share?.closest("button") ?? share, [
    "backgroundColor", "color", "fontSize", "border", "borderRadius", "height", "padding",
  ]);
  const publish = byText("Publish app")[0];
  out.publishBtn = pick(publish?.closest("button") ?? publish, [
    "backgroundColor", "color", "fontSize", "border", "borderRadius", "height", "padding",
  ]);

  // Cell frame: the on-border label "Introduction" (small text), climb to the
  // framed ancestor = first ancestor with a visible border or ring box-shadow.
  const label = byText("Introduction", 13)[0];
  out.cellLabel = pick(label, [
    "fontSize", "fontWeight", "color", "backgroundColor", "fontFamily",
    "padding", "position", "top", "left", "lineHeight", "letterSpacing",
  ]);
  let frame = label?.parentElement;
  while (frame) {
    const cs = getComputedStyle(frame);
    if (
      (cs.borderTopWidth !== "0px" && cs.borderTopStyle !== "none") ||
      cs.boxShadow.includes("0px 0px 0px 1px")
    ) {
      break;
    }
    frame = frame.parentElement;
  }
  out.cellFrame = pick(frame, [
    "border", "boxShadow", "borderRadius", "backgroundColor", "padding", "margin",
  ]);

  // All cell frames on the canvas: same box-shadow/border signature → spacing.
  if (frame) {
    const sig = getComputedStyle(frame).boxShadow;
    const frames = [...document.querySelectorAll("div")].filter(
      (d) => getComputedStyle(d).boxShadow === sig && d.getBoundingClientRect().width > 400,
    );
    out.frameCount = frames.length;
    out.frameRects = frames.slice(0, 6).map((f) => {
      const r = f.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    });
  }

  // Markdown source area inside the cell (the "# Introduction" line).
  const srcTok = byText("# Introduction")[0] ?? byText("Introduction")[1];
  out.codeArea = pick(srcTok?.closest(".monaco-editor") ?? srcTok, [
    "fontSize", "fontFamily", "lineHeight", "color", "backgroundColor",
  ]);

  // Rendered markdown h1 + body prose.
  const h1 = [...document.querySelectorAll("h1")].find((h) => h.textContent.trim() === "Introduction");
  out.mdH1 = pick(h1, [
    "fontSize", "fontWeight", "fontFamily", "letterSpacing", "lineHeight",
    "color", "marginTop", "marginBottom",
  ]);
  const prose = [...document.querySelectorAll("p")].find((p) =>
    p.textContent.includes("This paper looks to analyze"),
  );
  out.mdBody = pick(prose, ["fontSize", "lineHeight", "fontFamily", "color"]);

  // Section heading (frameless): "Exploring the data".
  const section = byText("Exploring the data")[0];
  out.sectionHeading = pick(section, [
    "fontSize", "fontWeight", "fontFamily", "letterSpacing", "color", "lineHeight",
  ]);

  // Restart and run pill.
  const restart = byText("Restart and run")[0];
  out.restartPill = pick(restart?.closest("button") ?? restart, [
    "backgroundColor", "color", "fontSize", "border", "borderRadius", "height",
  ]);

  // Canvas / content column.
  out.viewport = { w: innerWidth, h: innerHeight };
  return out;
});

console.log(JSON.stringify(data, null, 1));
await cdp.close();
