/* Copyright 2026 Marimo. All rights reserved. */

import type React from "react";
import { useId } from "react";

/**
 * A deterministic "poster" for a notebook — a Skies sky-wash scene (mood,
 * sun, blueprint grid, a rising data-trace, and the notebook's initial)
 * seeded entirely by its path. Real notebook thumbnails would require
 * rendering every notebook; this instead gives each project a stable,
 * recognizable, on-brand cover with zero cost.
 */

/** Deterministic 32-bit FNV-1a hash of a string. */
function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small seeded PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Skies "moods": [skyTop, skyMid, skyBottom, accent, sun].
const MOODS: ReadonlyArray<readonly [string, string, string, string, string]> =
  [
    ["#0a1530", "#2a5aa8", "#9cc8f4", "#ffffff", "#e8c44e"], // blue hour
    ["#0b1834", "#141f3c", "#1c2b48", "#5fa6ef", "#dcd7c6"], // deep night
    ["#241207", "#a8542c", "#e0b98a", "#ffe6c2", "#f2e5d2"], // copper dusk
    ["#141207", "#7a5f12", "#c99f14", "#fff2c2", "#ffe07a"], // gold hour
    ["#0e1c3a", "#1b7be4", "#8fc0f2", "#ffffff", "#e8c44e"], // clear sky
    ["#160f22", "#3a2a66", "#7c5cbf", "#d8c8ff", "#c7b3f0"], // dusk violet
  ];

export const NotebookCover: React.FC<{
  path: string;
  name: string;
  className?: string;
}> = ({ path, name, className }) => {
  // useId keeps the two gradient ids unique per rendered card.
  const uid = useId().replace(/:/g, "");
  const seed = hashString(path);
  const rand = mulberry32(seed);
  const [top, mid, bottom, accent, sun] = MOODS[seed % MOODS.length];

  const sunX = 44 + rand() * 232;
  const sunY = 28 + rand() * 46;
  const sunR = 11 + rand() * 9;

  // A rising, seeded data-trace across the lower half.
  const segments = 7;
  const points: Array<[number, number]> = [];
  let y = 128 + rand() * 22;
  for (let i = 0; i <= segments; i++) {
    const x = (320 / segments) * i;
    y = Math.max(52, Math.min(150, y - rand() * 24 + 5));
    points.push([x, y]);
  }
  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  const area = `${line} L320,180 L0,180 Z`;

  const initial = (name.trim()[0] ?? "•").toUpperCase();

  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden={true}
    >
      <defs>
        <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="0.55" stopColor={mid} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
        <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.32" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="320" height="180" fill={`url(#sky-${uid})`} />

      {/* blueprint grid */}
      <g stroke="#ffffff" strokeOpacity="0.06" strokeWidth="1">
        <path d="M80 0V180M160 0V180M240 0V180M0 60H320M0 120H320" />
      </g>

      <circle cx={sunX} cy={sunY} r={sunR} fill={sun} opacity="0.92" />

      {/* the notebook's initial, set in the Skies display serif */}
      <text
        x="16"
        y="152"
        fontFamily='"Source Serif 4", Georgia, serif'
        fontSize="128"
        fontWeight="700"
        fill="#ffffff"
        opacity="0.09"
      >
        {initial}
      </text>

      <path d={area} fill={`url(#fill-${uid})`} />
      <path
        d={line}
        fill="none"
        stroke={accent}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
    </svg>
  );
};
