import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        barlow: ["var(--font-barlow)", "sans-serif"],
        condensed: ["var(--font-barlow-condensed)", "sans-serif"],
      },
      colors: {
        car: {
          black: "#0d0d12",
          gray: "#141824",
          gray2: "#1e2434",
          gold: "#C9A227",
          "gold-dark": "#a8881f",
          white: "#EEF2FF",
          muted: "#7a8aaa",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
