import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Generador de Documentos — Data Express",
  description:
    "Genera el Acta de Inicio, el Acta de Cierre y el Gantt del proyecto desde Asana.",
  icons: {
    icon: [
      { url: "/logo_dx.png", type: "image/png" },
    ],
    shortcut: "/logo_dx.png",
    apple: "/logo_dx.png",
  },
};

// Se ejecuta antes del primer paint para aplicar la clase `dark` sin parpadeo.
// Lee la preferencia guardada; si no hay, usa la preferencia del sistema.
const themeInitScript = `
(function () {
  try {
    var saved = localStorage.getItem("asanaweb.theme.v1");
    var dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
