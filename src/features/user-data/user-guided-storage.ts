import { GUIDED_STORAGE_KEY, emptyGuidedSessionState, isGuidedSessionState } from "../guided-session/guided-session-storage";
import type { GuidedSessionState } from "../guided-session/guided-session-types";

type GuidedStorageBridgeOptions = {
  storage: Storage;
  getGuidedSessions: () => GuidedSessionState;
  replaceGuidedSessions: (next: GuidedSessionState) => void;
};

export function createUserGuidedStorage(options: GuidedStorageBridgeOptions): Storage {
  return {
    get length() { return options.storage.length; },
    key(index: number) { return options.storage.key(index); },
    clear() { options.storage.clear(); },
    getItem(key: string) {
      return key === GUIDED_STORAGE_KEY ? JSON.stringify(options.getGuidedSessions()) : options.storage.getItem(key);
    },
    setItem(key: string, value: string) {
      if (key !== GUIDED_STORAGE_KEY) return options.storage.setItem(key, value);
      let parsed: unknown;
      try { parsed = JSON.parse(value); } catch { throw new Error("Invalid guided session data"); }
      if (!isGuidedSessionState(parsed)) throw new Error("Invalid guided session data");
      options.replaceGuidedSessions(parsed);
    },
    removeItem(key: string) {
      if (key === GUIDED_STORAGE_KEY) options.replaceGuidedSessions(emptyGuidedSessionState());
      else options.storage.removeItem(key);
    }
  };
}
