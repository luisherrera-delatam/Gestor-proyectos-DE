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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
