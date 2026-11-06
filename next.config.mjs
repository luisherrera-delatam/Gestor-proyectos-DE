/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure the logo PNG is included in the Vercel serverless function bundle
  // for the API routes that read it from disk via fs.readFileSync.
  outputFileTracingIncludes: {
    "/api/generate": ["./public/logo_dx.png"],
    "/api/generate-inicio": ["./public/logo_dx.png"],
    "/api/gantt": ["./public/logo_dx.png"],
    // Plantilla Word del Informe ejecutivo de portafolio (se lee con fs).
    "/api/portfolio-report": ["./lib/templates/informe-ejecutivo.docx"],
  },
};

export default nextConfig;
