import type { CloudRepository } from "./cloud-repository";
import type { CloudHydration } from "./cloud-types";

function isoDay(offset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** Dev-only Camino A preview. Open /escalada/?p0=1 with the e2e auth client. Not an athlete seed. */
function previewHydration(): CloudHydration {
  const today = isoDay(0);
  return {
    facts: [{
      id: "fact-q",
      fact_key: "questionnaireCompleted",
      value: true,
      source: { type: "import", field: "questionnaireCompleted", version: 1 },
      created_at: `${today}T00:00:00.000Z`
    }],
    sessionLogs: [
      { id: "log-s1", session_binding: "legacy", legacy_session_key: "past-week-1", rpe: 7, pain: 2, created_at: `${isoDay(-21)}T12:00:00.000Z`, metrics: { bestLink: 5, footCuts: 5, attempts: 6 } },
      { id: "log-s3", session_binding: "legacy", legacy_session_key: "past-week-3", rpe: 7, pain: 1, created_at: `${isoDay(-7)}T12:00:00.000Z`, metrics: { bestLink: 6, footCuts: 4, attempts: 8 } },
      { id: "log-s4", session_binding: "legacy", legacy_session_key: "past-week-4", rpe: 7, pain: 1, created_at: `${isoDay(-1)}T12:00:00.000Z`, metrics: { bestLink: 8, footCuts: 3, attempts: 6 } }
    ],
    guided: { schemaVersion: 1, activeRun: null, history: [] },
    activePlan: {
      id: "preview-plan",
      published_at: `${today}T00:00:00.000Z`,
      rationale: "Preview",
      version_number: 1,
      sessions: [
        {
          id: "preview-strength",
          position: 1,
          scheduled_offset_days: 0,
          phase: "Fuerza",
          objective: "Dedos.",
          intensity: "moderate",
          expected_duration_minutes: 45,
          recovery_guidance: "Descansá si el dolor pasa de 2.",
          blocks: [{ id: "preview-block", position: 1, phase: "work", title: "Fuerza de dedos", instructions: "Hangboard.", duration_minutes: 45, exercises: [{ id: "preview-ex", position: 1, exercise_id: "ex", exercise_content_version: 1, sets: 6, reps: 10, duration_seconds: null }] }]
        },
        {
          id: "preview-project",
          position: 2,
          scheduled_offset_days: 1,
          phase: "Fuerza",
          objective: "Proyecto.",
          intensity: "high",
          expected_duration_minutes: 60,
          recovery_guidance: "Descansá.",
          blocks: [{ id: "preview-block-2", position: 1, phase: "work", title: "Bloque proyecto", instructions: "Intentos cortos.", duration_minutes: 60, exercises: [] }]
        },
        {
          id: "preview-endurance",
          position: 3,
          scheduled_offset_days: 3,
          phase: "Resistencia",
          objective: "Continuidad.",
          intensity: "moderate",
          expected_duration_minutes: 50,
          recovery_guidance: "Descansá.",
          blocks: [{ id: "preview-block-3", position: 1, phase: "work", title: "Resistencia 4x4", instructions: "Calidad.", duration_minutes: 50, exercises: [] }]
        }
      ]
    },
    profile: { avatarPath: null }
  };
}

export function createE2ECloudRepository(): CloudRepository {
  return {
    async ensureProfile() {},
    async hydrate() {
      const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
      if (params.get("p0") === "1") return previewHydration();
      const blank = {
        facts: params.get("e2e-cloud") === "1" ? [{
          id: "fact-q",
          fact_key: "questionnaireCompleted",
          value: true,
          source: { type: "import", field: "questionnaireCompleted", version: 1 },
          created_at: "2026-11-03T00:00:00.000Z"
        }] : [],
        sessionLogs: [],
        guided: { schemaVersion: 1, activeRun: null, history: [] },
        activePlan: null,
        profile: { avatarPath: null }
      };
      return blank;
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
