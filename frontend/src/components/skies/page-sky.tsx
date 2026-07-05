/* Copyright 2026 Marimo. All rights reserved. */

import { useEffect, useRef } from "react";

/**
 * Page sky — the Skies hero wash from ryanwaked.com: a colored band (day
 * blue settling into paper beige; starlit indigo at night) behind the top
 * of the page that dissolves back to the desk grid over the first ~320px
 * of scroll. Drop it as the first child of a positioned container.
 *
 * Styles live in css/app/skies.css (.skies-sky and friends).
 */
export const PageSky: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const f = Math.max(0, 1 - window.scrollY / 320);
      // Set on the parent so siblings (hero text, over-sky controls) can
      // blend their ink with the wash: white over the sky, back to the
      // theme's ink as the band dissolves. The band itself inherits it.
      (el.parentElement ?? el).style.setProperty(
        "--sky-fade",
        (f * f).toFixed(3),
      );
    };
    const onScroll = () => {
      if (!raf) {
        raf = requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) {
        cancelAnimationFrame(raf);
      }
    };
  }, []);

  return (
    <div className="skies-sky" ref={ref} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </div>
  );
};
