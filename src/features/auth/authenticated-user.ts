import { defaultState } from "../../lib/training";
import { emptyGuidedSessionState } from "../guided-session/guided-session-storage";
import { migrateLegacyUserData } from "../user-data/user-data-migration";
import type { UserDataEnvelope } from "../user-data/user-data-types";
import type { AuthUser } from "./auth-client";

type ActivateOptions = {
  now: string;
  makeId: () => string;
};

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
      matching.identity.auth = { provider: "apple", subject: user.id, email: user.email };
      matching.identity.updatedAt = options.now;
    }
    return next;
  }

  const hasBoundUser = Object.values(next.users).some((record) => record.identity.auth !== null);
  if (!hasBoundUser) {
    const current = next.users[next.activeUserId];
    current.identity.auth = { provider: "apple", subject: user.id, email: user.email };
    current.identity.updatedAt = options.now;
    return next;
  }

  const fresh = migrateLegacyUserData({
    tracker: structuredClone(defaultState),
    guided: emptyGuidedSessionState(),
    now: options.now,
    makeId: options.makeId
  });
  const record = fresh.users[fresh.activeUserId];
  record.identity.auth = { provider: "apple", subject: user.id, email: user.email };
  next.users[record.identity.id] = record;
  next.activeUserId = record.identity.id;
  return next;
}
