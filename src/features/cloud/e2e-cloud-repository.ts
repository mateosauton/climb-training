import type { CloudRepository } from "./cloud-repository";

export function createE2ECloudRepository(): CloudRepository {
  return {
    async ensureProfile() {},
    async hydrate() {
      return {
        facts: [],
        sessionLogs: [],
        guided: { schemaVersion: 1, activeRun: null, history: [] },
        activePlan: null,
        profile: { avatarPath: null }
      };
    },
    async saveAvatarPath() {},
    async submitQuestionnaire() {
      return "e2e-questionnaire";
    },
    async appendFacts() {},
    async saveGuidedState() {},
    async generatePlan() {
      return { jobId: "e2e-plan", status: "published" };
    },
    async listActivePlan() {
      return null;
    },
    async startSessionRun() {},
    async appendSessionLog() {}
  };
}
