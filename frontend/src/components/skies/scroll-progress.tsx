/* Copyright 2026 Marimo. All rights reserved. */

import { useEffect, useRef } from "react";

/**
 * Scroll progress — the site's white-into-blue hairline, riding the top
 * bar's bottom edge. Tracks the notebook's scroll container (#App) via a
 * capture-phase document listener so it survives remounts on mode
 * switches. Styles live in css/app/skies.css (.skies-progress).
 */
export const ScrollProgress: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const app = document.getElementById("App");
      if (!app) {
        el.style.setProperty("--scroll-p", "0");
        return;
      }
      const max = app.scrollHeight - app.clientHeight;
      const p = max > 0 ? app.scrollTop / max : 0;
      el.style.setProperty("--scroll-p", p.toFixed(4));
    };
    const schedule = () => {
      if (!raf) {
        raf = requestAnimationFrame(update);
      }
    };
    // Scroll events don't bubble, but they do capture — one document-level
    // listener covers #App across remounts.
    document.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", schedule);
    update();
    return () => {
      document.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      if (raf) {
        cancelAnimationFrame(raf);
      }
    };
  }, []);

  return <div ref={ref} className="skies-progress" aria-hidden="true" />;
};
