import type { MetadataRoute } from "next";

/**
 * Manifiesto de la app web: permite instalar el gestor como aplicación
 * (acceso directo con ícono propio en la computadora y en el celular).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gestor de proyectos Data Express",
    short_name: "Gestor DX",
    description:
      "Portafolios de desarrollo e implementaciones, actas, Gantt e informes de proyectos de Data Express.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f7f9fc",
    theme_color: "#0A2C5C",
    lang: "es",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
