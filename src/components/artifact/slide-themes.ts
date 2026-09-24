/**
 * Deck themes for the slide artifact. Each theme is a set of Tailwind class
 * strings for the parts of a slide, so layouts stay identical across themes
 * and only the look changes.
 */

export type SlideThemeId = "midnight" | "paper" | "aurora"

export interface SlideTheme {
  id: SlideThemeId
  name: string
  description: string
  /** Colours for the picker preview. */
  swatch: { cover: string; panel: string; accent: string; surface: string; ink: string }
  /** Font for slide titles. */
  titleFont: string
  cover: {
    background: string
    glowA: string
    glowB: string
    title: string
    accentBar: string
    meta: string
  }
  split: {
    panel: string
    panelShape: string
    panelNumber: string
    panelTitle: string
    background: string
  }
  standard: {
    background: string
    number: string
    title: string
    underline: string
  }
  footer: string
  /** Rich-text body on the cover (dark) and content (light) surfaces. */
  body: { dark: string; light: string }
}

export const SLIDE_THEMES: Record<SlideThemeId, SlideTheme> = {
  midnight: {
    id: "midnight",
    name: "Midnight",
    description: "Dark cover, bold orange accents",
    swatch: {
      cover: "#020617",
      panel: "#f97316",
      accent: "#f97316",
      surface: "#ffffff",
      ink: "#ffffff",
    },
    titleFont: "font-sans",
    cover: {
      background: "bg-slate-950",
      glowA: "bg-orange-500/25",
      glowB: "bg-indigo-500/20",
      title: "text-white",
      accentBar: "bg-orange-500",
      meta: "text-slate-400",
    },
    split: {
      panel: "bg-orange-500",
      panelShape: "bg-white/10",
      panelNumber: "text-white/35",
      panelTitle: "text-white",
      background: "bg-white",
    },
    standard: {
      background: "bg-white",
      number: "text-orange-500",
      title: "text-slate-900",
      underline: "bg-orange-500",
    },
    footer: "text-slate-400",
    body: {
      dark: "text-slate-300 [&_strong]:text-white [&_h1,&_h2,&_h3]:text-white [&_li::marker]:text-orange-500 [&_blockquote]:border-orange-500",
      light:
        "text-slate-600 [&_strong]:text-slate-900 [&_h1,&_h2,&_h3]:text-slate-900 [&_li::marker]:text-orange-500 [&_blockquote]:border-orange-500",
    },
  },
  paper: {
    id: "paper",
    name: "Paper",
    description: "Warm editorial serif, forest green",
    swatch: {
      cover: "#f6f1e7",
      panel: "#1f6f5c",
      accent: "#1f6f5c",
      surface: "#fffdf8",
      ink: "#1c2a24",
    },
    titleFont: "font-serif",
    cover: {
      background: "bg-[#f6f1e7]",
      glowA: "bg-[#1f6f5c]/10",
      glowB: "bg-[#d9a441]/20",
      title: "text-[#1c2a24]",
      accentBar: "bg-[#1f6f5c]",
      meta: "text-[#7a7466]",
    },
    split: {
      panel: "bg-[#1f6f5c]",
      panelShape: "bg-[#f6f1e7]/10",
      panelNumber: "text-[#f6f1e7]/40",
      panelTitle: "text-[#fffdf8]",
      background: "bg-[#fffdf8]",
    },
    standard: {
      background: "bg-[#fffdf8]",
      number: "text-[#1f6f5c]",
      title: "text-[#1c2a24]",
      underline: "bg-[#d9a441]",
    },
    footer: "text-[#9a9384]",
    body: {
      dark: "text-[#4a4a40] [&_strong]:text-[#1c2a24] [&_h1,&_h2,&_h3]:text-[#1c2a24] [&_h1,&_h2,&_h3]:font-serif [&_li::marker]:text-[#1f6f5c] [&_blockquote]:border-[#d9a441]",
      light:
        "text-[#4a4a40] [&_strong]:text-[#1c2a24] [&_h1,&_h2,&_h3]:text-[#1c2a24] [&_h1,&_h2,&_h3]:font-serif [&_li::marker]:text-[#1f6f5c] [&_blockquote]:border-[#d9a441]",
    },
  },
  aurora: {
    id: "aurora",
    name: "Aurora",
    description: "Vivid violet gradient, soft lavender",
    swatch: {
      cover: "linear-gradient(135deg,#6d28d9,#c026d3,#ec4899)",
      panel: "linear-gradient(180deg,#7c3aed,#c026d3)",
      accent: "#ffffff",
      surface: "#f7f5ff",
      ink: "#ffffff",
    },
    titleFont: "font-sans",
    cover: {
      background: "bg-gradient-to-br from-violet-700 via-fuchsia-600 to-pink-500",
      glowA: "bg-white/20",
      glowB: "bg-indigo-900/30",
      title: "text-white",
      accentBar: "bg-white",
      meta: "text-white/70",
    },
    split: {
      panel: "bg-gradient-to-b from-violet-600 to-fuchsia-600",
      panelShape: "bg-white/15",
      panelNumber: "text-white/40",
      panelTitle: "text-white",
      background: "bg-[#f7f5ff]",
    },
    standard: {
      background: "bg-[#f7f5ff]",
      number: "text-fuchsia-600",
      title: "text-violet-950",
      underline: "bg-gradient-to-r from-violet-600 to-pink-500",
    },
    footer: "text-violet-400",
    body: {
      dark: "text-white/85 [&_strong]:text-white [&_h1,&_h2,&_h3]:text-white [&_li::marker]:text-white [&_blockquote]:border-white",
      light:
        "text-slate-600 [&_strong]:text-violet-950 [&_h1,&_h2,&_h3]:text-violet-950 [&_li::marker]:text-fuchsia-600 [&_blockquote]:border-fuchsia-500",
    },
  },
}

export const SLIDE_THEME_IDS = Object.keys(SLIDE_THEMES) as SlideThemeId[]

export function resolveSlideTheme(id: unknown): SlideTheme {
  return typeof id === "string" && id in SLIDE_THEMES
    ? SLIDE_THEMES[id as SlideThemeId]
    : SLIDE_THEMES.midnight
}
