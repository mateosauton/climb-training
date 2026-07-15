import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evaluateSafetyRules, RULESET_VERSION } from "./rules.ts";
import { GENERATED_PLAN_SCHEMA_VERSION, GENERATION_INPUT_SCHEMA_VERSION, parseGeneratedPlan, parseGenerationRequest, publicationHierarchy, type CatalogExercise, type ValidatedGenerationInput } from "./schema.ts";

export interface PlanGenerator { generate(input: ValidatedGenerationInput): Promise<unknown>; }

type RecordValue = Record<string, unknown>;
type Job = { id: string; status: string };
const json = (status: number, body: RecordValue) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const record = (value: unknown): value is RecordValue => !!value && typeof value === "object" && !Array.isArray(value);
const sanitizeError = (code: string) => ({ code, retryable: true });

function generatorFromSecrets(): PlanGenerator | null {
  const provider = Deno.env.get("PLAN_GENERATOR_PROVIDER")?.trim();
  const endpoint = Deno.env.get("PLAN_GENERATOR_ENDPOINT")?.trim();
  const key = Deno.env.get("PLAN_GENERATOR_API_KEY")?.trim();
  if (!provider || !endpoint || !key) return null;
  return { async generate(input) {
    const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "x-plan-generator-provider": provider }, body: JSON.stringify(input), signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error("provider_unavailable");
    return await response.json();
  } };
}

async function ownedQuestionnaire(admin: any, athleteId: string, questionnaireId: string) {
  const { data, error } = await admin.from("questionnaire_submissions").select("id, answers, source").eq("id", questionnaireId).eq("athlete_id", athleteId).maybeSingle();
  if (error || !data || !record(data.answers)) return null;
  const source = record(data.source) ? data.source : {};
  return { id: data.id as string, version: typeof source.version === "number" ? source.version : 1, answers: data.answers };
}

async function publishedCatalog(admin: any): Promise<CatalogExercise[] | null> {
  const { data, error } = await admin.from("exercise_catalog").select("id, content_version, movement_tags, contraindications").not("published_at", "is", null).is("retired_at", null);
  if (error || !data) return null;
  return data.map((exercise: RecordValue) => ({ id: exercise.id as string, contentVersion: exercise.content_version as number, movementTags: Array.isArray(exercise.movement_tags) ? exercise.movement_tags as string[] : [], contraindications: Array.isArray(exercise.contraindications) ? exercise.contraindications as string[] : [] }));
}

async function jobForRequest(admin: any, athleteId: string, questionnaireId: string, idempotencyKey: string, inputSnapshot: RecordValue): Promise<Job | null> {
  const { data, error } = await admin.schema("private").rpc("claim_plan_generation_job", {
    p_athlete_id: athleteId,
    p_questionnaire_id: questionnaireId,
    p_idempotency_key: idempotencyKey,
    p_input_schema_version: GENERATION_INPUT_SCHEMA_VERSION,
    p_input_snapshot: inputSnapshot,
    p_ruleset_version: RULESET_VERSION
  });
  if (error || !data) return null;
  return data as Job;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return json(401, { error: "unauthenticated" });
  const url = Deno.env.get("SUPABASE_URL"), anonKey = Deno.env.get("SUPABASE_ANON_KEY"), serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRole) return json(503, { error: "generation_unavailable" });
  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: auth, error: authError } = await authClient.auth.getUser(authorization.slice(7));
  if (authError || !auth.user) return json(401, { error: "unauthenticated" });
  let input; try { input = parseGenerationRequest(await request.json()); } catch { return json(400, { error: "invalid_generation_request" }); }
  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const questionnaire = await ownedQuestionnaire(admin, auth.user.id, input.questionnaireId);
  if (!questionnaire) return json(404, { error: "questionnaire_not_found" });
  const catalog = await publishedCatalog(admin);
  if (!catalog) return json(503, { error: "generation_unavailable" });
  const job = await jobForRequest(admin, auth.user.id, questionnaire.id, input.idempotencyKey, { questionnaireId: questionnaire.id, questionnaireVersion: questionnaire.version });
  if (!job) return json(503, { error: "generation_unavailable" });
  if (["published", "rejected", "provider_not_configured"].includes(job.status)) return json(200, { jobId: job.id, status: job.status });
  const safety = evaluateSafetyRules(questionnaire, catalog);
  const jobs = admin.schema("private").from("plan_generation_jobs");
  if (safety.status === "rejected") {
    await jobs.update({ status: "rejected", ruleset_version: safety.rulesetVersion, safety_result: safety, completed_at: new Date().toISOString() }).eq("id", job.id).eq("athlete_id", auth.user.id);
    return json(200, { jobId: job.id, status: "rejected" });
  }
  await jobs.update({ status: "validated", ruleset_version: safety.rulesetVersion, safety_result: safety }).eq("id", job.id).eq("athlete_id", auth.user.id);
  const generator = generatorFromSecrets();
  if (!generator) {
    await jobs.update({ status: "provider_not_configured", completed_at: new Date().toISOString() }).eq("id", job.id).eq("athlete_id", auth.user.id);
    return json(200, { jobId: job.id, status: "provider_not_configured" });
  }
  try {
    await jobs.update({ status: "running", started_at: new Date().toISOString() }).eq("id", job.id).eq("athlete_id", auth.user.id);
    const output = parseGeneratedPlan(await generator.generate({ questionnaire, catalog, safety }), catalog, safety);
    const { error } = await admin.schema("private").rpc("publish_and_finalize_training_plan", { p_athlete_id: auth.user.id, p_source_questionnaire_id: questionnaire.id, p_source_generation_job_id: job.id, p_rationale: output.rationale, p_safety_result: safety, p_hierarchy: publicationHierarchy(output), p_generator_version: "provider-adapter-1", p_ruleset_version: safety.rulesetVersion, p_output_schema_version: GENERATED_PLAN_SCHEMA_VERSION, p_output_snapshot: output });
    if (error) throw new Error("publish_failed");
    return json(200, { jobId: job.id, status: "published" });
  } catch (error) {
    const code = error instanceof Error && error.message === "unsupported_exercise_id" ? "invalid_generator_output" : "generation_retryable";
    await jobs.update({ status: "failed", sanitized_error: sanitizeError(code), completed_at: new Date().toISOString() }).eq("id", job.id).eq("athlete_id", auth.user.id);
    return json(503, { jobId: job.id, status: "failed", error: code });
  }
});
