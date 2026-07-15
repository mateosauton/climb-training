export type AuthConfig = {
  url: string;
  publishableKey: string;
};

export function readAuthConfig(env: Record<string, string | undefined>): AuthConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim();
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && publishableKey ? { url, publishableKey } : null;
}

export function appleRedirectUrl(origin: string, baseUrl: string): string {
  return new URL(baseUrl, origin).toString();
}
