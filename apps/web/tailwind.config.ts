import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        invictus: {
          DEFAULT: "#1e2bd6",
          dark: "#141c9e",
          deep: "#0b1340",
          accent: "#ffc821",
          ink: "#0b1340",
          bg: "#f3f4f8",
          card: "#ffffff",
          muted: "#6b7280",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
