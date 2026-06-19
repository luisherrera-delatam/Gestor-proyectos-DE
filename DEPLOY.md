# Deploy a Vercel con CI/CD

Este proyecto usa **pnpm** (no npm). El archivo `package.json` incluye un `preinstall` con `npx only-allow pnpm` que bloquea cualquier intento de instalar con npm o yarn.

El workflow `.github/workflows/ci.yml` solo **verifica** (Node 22): `typecheck` → `test` → `build` con pnpm. No requiere secrets.

El **deploy lo hace Vercel** directamente mediante su integración con GitHub: cada push a `main` despliega a producción y cada PR genera un preview automático. Por eso el workflow no incluye jobs de deploy (evita duplicar despliegues y fallar por falta de secrets).

> Nota: se testea solo en Node 22 porque es el runtime de producción en Vercel y porque las herramientas de desarrollo (Vitest/Vite) exigen Node `>=20.19 || >=22.12`.

## Setup local

```powershell
# 1. Instalar pnpm (una sola vez, sin pasar por npm)
iwr https://get.pnpm.io/install.ps1 -useb | iex

# 2. Instalar dependencias
pnpm install

# 3. Arrancar dev server
pnpm dev
```

## Conexión con Asana (OAuth)

La app puede conectarse a Asana de dos formas:

- **OAuth** (recomendado): el usuario pulsa "Conectar con Asana", autoriza y
  ve la lista de sus proyectos sin pegar tokens ni URLs.
- **Token manual** (alternativa): si OAuth no está configurado, se usa el
  Personal Access Token que el usuario pega en la interfaz. Siempre disponible.

### Configurar OAuth (una sola vez)

1. Ve a https://app.asana.com/0/my-apps → **Create new app**.
2. En la pestaña **OAuth**, agrega las **Redirect URLs**:
   - `http://localhost:3000/api/auth/callback` (desarrollo)
   - `https://TU-DOMINIO.vercel.app/api/auth/callback` (producción)
3. Copia el **Client ID** y el **Client Secret**.
4. Crea un `.env.local` (local) y agrega las mismas variables en Vercel
   (**Settings → Environment Variables**):

   ```
   ASANA_CLIENT_ID=...
   ASANA_CLIENT_SECRET=...
   SESSION_SECRET=...   # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

Sin estas variables la app arranca igual y muestra el campo de token manual.
Ver `.env.example`.

## Setup CD (una sola vez)

### 1. Crea el proyecto en Vercel

Desde tu máquina, en la raíz del repo:

```powershell
pnpm add --global vercel
vercel login
vercel link
```

Esto crea `.vercel/project.json` con `orgId` y `projectId`. Toma nota de esos valores.

Vercel detecta automáticamente `pnpm-lock.yaml` y usa pnpm para instalar dependencias.

### 2. Genera un Vercel Token

https://vercel.com/account/tokens → **Create Token** con scope para tu proyecto.

### 3. Agrega 3 secrets en GitHub

En tu repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret | Valor |
|---|---|
| `VERCEL_TOKEN` | El token del paso 2 |
| `VERCEL_ORG_ID` | El `orgId` de `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | El `projectId` de `.vercel/project.json` |

### 4. Push y listo

```powershell
git init
git add .
git commit -m "init: asana to closure letter generator"
git remote add origin <tu-repo-en-github>
git push -u origin main
```

A partir de ese push:
- Cada push a `main` → deploy a producción tras pasar tests.
- Cada PR contra `main` → preview deploy comentado en el PR.

## Por qué pnpm en lugar de npm

- **Mejor protección contra supply-chain attacks:** pnpm 11 valida la lockfile contra políticas de cadena de suministro en cada install, y `minimumReleaseAge: 1440` (en `pnpm-workspace.yaml`) bloquea automáticamente paquetes publicados en las últimas 24 horas, lo que mitiga ataques de publicación maliciosa reciente.
- **`allowBuilds` explícito:** solo los scripts de instalación autorizados (`sharp`) corren; el resto se ignora por defecto.
- **Lockfile más estricto:** `pnpm install --frozen-lockfile` falla si el lockfile no concuerda exactamente, evitando instalaciones silenciosas con versiones distintas.
- **`preinstall` bloquea npm:** si alguien intenta `npm install` por error, el comando aborta.

## Alternativa simple (sin GitHub Actions para CD)

Si prefieres que Vercel detecte el repo automáticamente y haga deploys sin pasar por Actions:

1. En vercel.com → **Add New Project** → importa el repo de GitHub.
2. Vercel hace deploys automáticos (sin secrets ni workflow de CD).
3. En ese caso, edita `.github/workflows/ci.yml` y borra los jobs `deploy-preview` y `deploy-production` — deja solo `verify`.

La ventaja del workflow actual es que los deploys quedan **gated por los tests** (Vercel auto-deploy no espera a tus tests).
