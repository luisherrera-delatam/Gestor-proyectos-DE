/**
 * Cliente OAuth 2.0 (Authorization Code) para Asana.
 *
 * Requiere dos variables de entorno:
 *   - ASANA_CLIENT_ID
 *   - ASANA_CLIENT_SECRET
 *
 * El redirect_uri se deriva del origen de la petición (origin + /api/auth/callback),
 * así funciona igual en localhost y en Vercel sin hardcodear dominios. Hay que
 * registrar ambos en la configuración OAuth de la app de Asana.
 */

const AUTHORIZE_URL = "https://app.asana.com/-/oauth_authorize";
const TOKEN_URL = "https://app.asana.com/-/oauth_token";

export function isOAuthConfigured(): boolean {
  return Boolean(process.env.ASANA_CLIENT_ID && process.env.ASANA_CLIENT_SECRET);
}

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.ASANA_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // segundos
  token_type?: string;
  data?: { gid?: string; name?: string; email?: string };
}

async function postToken(params: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Error de OAuth de Asana (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as TokenResponse;
}

export function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
  return postToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.ASANA_CLIENT_ID || "",
      client_secret: process.env.ASANA_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
      code,
    })
  );
}

export function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return postToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ASANA_CLIENT_ID || "",
      client_secret: process.env.ASANA_CLIENT_SECRET || "",
      refresh_token: refreshToken,
    })
  );
}
