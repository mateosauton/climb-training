import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { AuthConfig } from "../auth/auth-config";

export type CloudClient = SupabaseClient;

export function createCloudClient(config: AuthConfig | null): CloudClient | null {
  if (!config) return null;
  return createClient(config.url, config.publishableKey);
}
