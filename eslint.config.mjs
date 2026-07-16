import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  {
    ignores: [
      ".next/**",
      "coverage/**",
      "next-env.d.ts",
      "public/**",
      "docs-gen/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    // El <Image> de @react-pdf/renderer es una primitiva de PDF, no un <img> de
    // web: no existe la prop alt ni hay lector de pantalla que la use. La regla
    // lo confunde con el <Image> de next/image por el nombre.
    files: ["lib/gantt-pdf.tsx"],
    rules: { "jsx-a11y/alt-text": "off" },
  },
];

export default config;
