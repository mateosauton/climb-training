import { defaultState, type TrackerState } from "./training";

export function cloudBaselineState(): TrackerState {
  const tracker = structuredClone(defaultState);
  tracker.profile.name = "";
  tracker.profile.injuryHistory = "";
  tracker.profile.recoveryNotes = "";
  return tracker;
}
