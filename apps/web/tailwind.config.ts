import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        clay: {
          50: "#FBF3EF",
          100: "#F5E1D6",
          200: "#EAC3AC",
          300: "#DE9F7E",
          400: "#CD7B54",
          500: "#B85C36",
          600: "#9C4526",
          700: "#7D3620",
          800: "#5F291A",
          900: "#3F1B12",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        "page-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "page-in": "page-in 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
