import { validateLocalImportEnvelope } from "../../../supabase/functions/_shared/local-import-schema";
import type { UserDataEnvelope } from "./user-data-types";

/** Validates the schema shared by browser recovery data and authenticated import. */
export function validateUserDataEnvelope(value: unknown): UserDataEnvelope | null {
  return validateLocalImportEnvelope(value) ? value as UserDataEnvelope : null;
}
