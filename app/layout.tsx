import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acta de Cierre — Data Express",
  description: "Genera el Acta de Cierre de Proyecto desde Asana",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
