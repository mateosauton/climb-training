import { describe, expect, it } from "vitest";

import fixture from "../../../supabase/fixtures/training-data-model-ac02-v1.json";

describe("training data model fixture training-data-model-ac02-v1", () => {
  it("names the canonical plan session and standardized metrics", () => {
    expect(fixture.id).toBe("training-data-model-ac02-v1");
    expect(fixture.session_log).toHaveProperty("plan_session_id");
    expect(fixture.session_log.legacy_session_key).toBe("w1d1");
    expect(fixture.session_log.best_link).toBe(2);
    expect(fixture.mapped_session_log.plan_session_id).toBe("00000000-0000-4000-8000-000000000a21");
    expect(fixture.mapped_session_log.session_binding).toBe("plan");
    expect(fixture.canonical_metric_names).toEqual([
      "attempts",
      "best_link",
      "foot_cuts",
      "moves",
      "pull_weight",
      "sleep"
    ]);
    expect(fixture.read_model_version).toBe(1);
  });
});
