import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        dxnavy: "#0A2C5C",
        dxblue: "#BEDCF0",
        dxgray: "#5B6573",
      },
    },
  },
  plugins: [],
};

export default config;
