// Pass 2: cell frame anatomy, code/source area, gutter, spacing, rail.
import { chromium } from "@playwright/test";

const cdp = await chromium.connectOverCDP("http://localhost:9222");
const page = cdp
  .contexts()
  .flatMap((c) => c.pages())
  .find((p) => p.url().includes("hex.tech"));

const data = await page.evaluate(() => {
  const pickCS = (el, props) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const out = {
      tag: el.tagName.toLowerCase(),
      cls: (el.className?.baseVal ?? el.className ?? "").slice(0, 60),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    };
    for (const p of props) out[p] = cs[p];
    return out;
  };
  const byText = (text, sizeMax = 999) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (n.textContent.trim() === text) {
        const el = n.parentElement;
        if (parseFloat(getComputedStyle(el).fontSize) <= sizeMax) return el;
      }
    }
    return null;
  };

  const out = {};

  // Walk up from the on-border label and record every ancestor's box styles.
  const label = byText("Introduction", 13);
  const chain = [];
  let el = label;
  for (let i = 0; el && i < 8; i++) {
    chain.push(
      pickCS(el, [
        "border", "borderTop", "boxShadow", "borderRadius", "backgroundColor",
        "padding", "margin", "position", "display",
      ]),
    );
    el = el.parentElement;
  }
  out.labelAncestors = chain;

  // Fieldset/legend?
  out.fieldsets = document.querySelectorAll("fieldset").length;
  out.legends = document.querySelectorAll("legend").length;

  // Monospace source inside the markdown cell: find token with fontFamily mono.
  const monoEls = [...document.querySelectorAll("span, div")]
    .filter((e) => {
      const cs = getComputedStyle(e);
      return (
        cs.fontFamily.includes("Plex Mono") &&
        e.getBoundingClientRect().height > 0 &&
        e.textContent.trim().length > 3
      );
    })
    .slice(0, 3);
  out.monoSamples = monoEls.map((e) =>
    pickCS(e, ["fontSize", "lineHeight", "color", "backgroundColor", "fontFamily"]),
  );

  // The left icon rail: leftmost narrow full-height column.
  const rail = [...document.querySelectorAll("div, nav, aside")].find((d) => {
    const r = d.getBoundingClientRect();
    return r.x < 5 && r.width > 30 && r.width < 80 && r.height > innerHeight * 0.7;
  });
  out.rail = pickCS(rail, ["backgroundColor", "borderRight", "width", "padding"]);

  // Cell frames: Hex cells likely live in a container per cell; find elements
  // with 1px solid border in the #35354x range.
  const frames = [...document.querySelectorAll("div")].filter((d) => {
    const cs = getComputedStyle(d);
    const r = d.getBoundingClientRect();
    return (
      r.width > 500 && r.height > 60 &&
      cs.borderTopWidth === "1px" &&
      cs.borderTopStyle === "solid" &&
      (cs.borderTopColor.startsWith("rgb(53,") || cs.borderTopColor.startsWith("rgb(53, 53"))
    );
  });
  out.borderedDivCount = frames.length;
  out.firstFrames = frames.slice(0, 5).map((f) =>
    pickCS(f, ["border", "borderRadius", "backgroundColor", "padding", "boxShadow"]),
  );
  // Any border color variants in big divs.
  const borderColors = {};
  for (const d of document.querySelectorAll("div")) {
    const r = d.getBoundingClientRect();
    if (r.width > 500 && r.height > 60) {
      const cs = getComputedStyle(d);
      if (cs.borderTopWidth === "1px" && cs.borderTopStyle === "solid") {
        borderColors[cs.borderTopColor] = (borderColors[cs.borderTopColor] ?? 0) + 1;
      }
    }
  }
  out.bigDivBorderColors = borderColors;

  return out;
});

console.log(JSON.stringify(data, null, 1));
await cdp.close();
