// Service worker mínimo del Gestor de proyectos Data Express.
// Solo existe para que el navegador permita instalar el gestor como app.
// No guarda nada en caché: todas las peticiones van a la red como siempre
// (los datos de Asana y los documentos siempre se generan en el momento).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Sin respondWith: el navegador resuelve la petición normalmente.
});
