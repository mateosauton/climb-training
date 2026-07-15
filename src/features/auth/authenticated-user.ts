import { defaultState } from "../../lib/training";
import { emptyGuidedSessionState } from "../guided-session/guided-session-storage";
import { migrateLegacyUserData } from "../user-data/user-data-migration";
import type { UserDataEnvelope } from "../user-data/user-data-types";
import type { AuthUser } from "./auth-client";

type ActivateOptions = {
  now: string;
  makeId: () => string;
};

function freshAuthenticatedRecord(user: AuthUser, options: ActivateOptions) {
  const fresh = migrateLegacyUserData({
    tracker: structuredClone(defaultState),
    guided: emptyGuidedSessionState(),
    now: options.now,
    makeId: options.makeId
  });
  const record = fresh.users[fresh.activeUserId];
  record.identity.auth = { provider: "supabase", subject: user.id, email: user.email };
  return record;
}

export function activateAuthenticatedUser(
  envelope: UserDataEnvelope,
  user: AuthUser,
  options: ActivateOptions
): UserDataEnvelope {
  const next = structuredClone(envelope);
  const matching = Object.values(next.users).find((record) => record.identity.auth?.subject === user.id);

  if (matching) {
    next.activeUserId = matching.identity.id;
    if (matching.identity.auth?.email !== user.email) {
      matching.identity.auth = { provider: "supabase", subject: user.id, email: user.email };
      matching.identity.updatedAt = options.now;
    }
    return next;
  }

  const hasBoundUser = Object.values(next.users).some((record) => record.identity.auth !== null);
  if (!hasBoundUser) {
    const current = next.users[next.activeUserId];
    current.identity.auth = { provider: "supabase", subject: user.id, email: user.email };
    current.identity.updatedAt = options.now;
    return next;
  }

  const record = freshAuthenticatedRecord(user, options);
  next.users[record.identity.id] = record;
  next.activeUserId = record.identity.id;
  return next;
}

export function resetAuthenticatedUser(
  envelope: UserDataEnvelope,
  user: AuthUser,
  options: ActivateOptions
): UserDataEnvelope {
  const next = structuredClone(envelope);
  const activeId = next.activeUserId;
  const record = freshAuthenticatedRecord(user, options);
  record.identity.id = activeId;
  record.facts = record.facts.map((fact) => ({ ...fact, userId: activeId }));
  next.users[activeId] = record;
  return next;
}
