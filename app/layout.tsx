import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Generador de Documentos — Data Express",
  description:
    "Genera el Acta de Inicio, el Acta de Cierre y el Gantt del proyecto desde Asana.",
  applicationName: "Gestor DX",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  // iPhone / iPad: al "Agregar a inicio" se abre como app, con este nombre.
  appleWebApp: { capable: true, title: "Gestor DX", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0A2C5C" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1f26" },
  ],
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
