// Pass 3: frame border mechanics, paddings, SQL/table/chart cells.
import { chromium } from "@playwright/test";

const cdp = await chromium.connectOverCDP("http://localhost:9222");
const page = cdp
  .contexts()
  .flatMap((c) => c.pages())
  .find((p) => p.url().includes("hex.tech"));

const data = await page.evaluate(() => {
  const cs2 = (el, pseudo, props) => {
    if (!el) return null;
    const cs = getComputedStyle(el, pseudo);
    const out = {};
    for (const p of props) out[p] = cs[p];
    return out;
  };
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };

  const out = {};
  const props = ["content", "border", "borderTop", "borderLeft", "borderRight", "borderBottom", "borderRadius", "width", "height", "top", "left", "right", "position", "boxShadow", "backgroundColor"];

  const header = document.querySelector('[class*="SourceCellContainer__CellHeader"]');
  out.headerBefore = cs2(header, "::before", props);
  out.headerAfter = cs2(header, "::after", props);

  const container = document.querySelector('[class*="SourceCellContainer__CellContainer"]');
  out.containerBefore = cs2(container, "::before", props);
  out.containerAfter = cs2(container, "::after", props);
  // The cell body (border left/right/bottom?) — check all children of container.
  const kids = container ? [...container.children].map((k) => ({
    cls: (k.className ?? "").slice(0, 55),
    rect: rect(k),
    border: getComputedStyle(k).border,
    borderTop: getComputedStyle(k).borderTop,
    borderRadius: getComputedStyle(k).borderRadius,
    bg: getComputedStyle(k).backgroundColor,
    padding: getComputedStyle(k).padding,
  })) : null;
  out.containerKids = kids;

  // Source editor block padding (Monaco wrapper inside frame).
  const monaco = document.querySelector(".monaco-editor");
  if (monaco) {
    out.monaco = { rect: rect(monaco), bg: getComputedStyle(monaco).backgroundColor };
    let p = monaco.parentElement;
    for (let i = 0; p && i < 4; i++) {
      if (getComputedStyle(p).paddingLeft !== "0px" || getComputedStyle(p).paddingTop !== "0px") {
        out.monacoPaddedAncestor = {
          cls: (p.className ?? "").slice(0, 55),
          padding: getComputedStyle(p).padding,
          rect: rect(p),
        };
        break;
      }
      p = p.parentElement;
    }
  }

  // Cell vertical rhythm: all CellBlockContainer LIs.
  const lis = [...document.querySelectorAll('li[class*="CellBlockContainer"]')];
  out.cellRects = lis.slice(0, 12).map((li) => rect(li));

  // SQL / table / chart discovery across the whole doc (page is virtualized?).
  out.hasTable = Boolean(document.querySelector('[class*="Table"], table'));
  const tableEl = document.querySelector('[class*="TableOutput"], [class*="DataGrid"], [class*="glide"], table');
  if (tableEl) {
    out.table = {
      cls: (tableEl.className ?? "").toString().slice(0, 60),
      rect: rect(tableEl),
      font: getComputedStyle(tableEl).fontFamily.slice(0, 40),
      fontSize: getComputedStyle(tableEl).fontSize,
      bg: getComputedStyle(tableEl).backgroundColor,
      border: getComputedStyle(tableEl).border,
    };
  }
  out.hasCanvasChart = Boolean(document.querySelector("canvas"));
  out.hasSvgChart = Boolean(document.querySelector('[class*="vega"], .marks'));

  return out;
});

console.log(JSON.stringify(data, null, 1));
await cdp.close();
