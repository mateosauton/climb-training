import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const modulePath = path.join(root, "src/lib/profile-questionnaire.ts");
const compiled = fs.readFileSync(modulePath, "utf8")
  .replace(/export type[\s\S]*?const gradeBoulderOptions/, "const gradeBoulderOptions")
  .replace(/: QuestionnaireOption\[\]/g, "")
  .replace(/: QuestionnaireSection\[\]/g, "")
  .replace(/: Record<string, unknown>/g, "")
  .replace(/: FormData/g, "")
  .replace(/export const (\w+) =/g, "const $1 = exports.$1 =")
  .replace(/export function (\w+)/g, "exports.$1 = function $1");

const sandbox = {
  exports: {},
  module: { exports: {} }
};
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(compiled, sandbox, { filename: modulePath });

const {
  QUESTIONNAIRE_SECTIONS,
  QUESTIONNAIRE_VERSION,
  profileQuestionnaireFields,
  calculateQuestionnaireCompletion,
  buildProfileFromQuestionnaireForm
} = sandbox.module.exports;

assert.equal(QUESTIONNAIRE_VERSION, 2, "questionnaire version should track the new stepped schema");
assert.equal(QUESTIONNAIRE_SECTIONS.length >= 6, true, "questionnaire should cover the major profile areas");
assert.equal(profileQuestionnaireFields.includes("height"), true, "height is required for morphology context");
assert.equal(profileQuestionnaireFields.includes("wingspan"), true, "wingspan is required for reach context");
assert.equal(profileQuestionnaireFields.includes("apeIndex"), true, "ape index is required for reach context");
assert.equal(profileQuestionnaireFields.includes("fingerStrength"), true, "finger strength is required for climbing-specific capacity");
assert.equal(profileQuestionnaireFields.includes("injuryHistory"), true, "injury history is required for load-risk decisions");
assert.equal(profileQuestionnaireFields.includes("recoveryNotes"), true, "recovery notes are required for training adjustment");

const fieldsByName = new Map(
  QUESTIONNAIRE_SECTIONS.flatMap((section) => section.fields.map((field) => [field.name, field]))
);

assert.equal(fieldsByName.get("height").kind, "number", "height should use a numeric stepper");
assert.equal(fieldsByName.get("currentPain").kind, "number", "pain should use a numeric stepper");
assert.equal(fieldsByName.get("maxBoulder").kind, "choice", "max boulder should use selectable options");
assert.equal(fieldsByName.get("styleStrengths").kind, "multi", "style strengths should use multi-select chips");
assert.equal(fieldsByName.get("styleStrengths").options.length >= 12, true, "style strengths should expose broad climbing styles");
assert.match(fieldsByName.get("apeIndex").help, /envergadura menos altura/i);
assert.match(fieldsByName.get("apeIndex").helpExample, /dedo medio/i);

const blankCompletion = calculateQuestionnaireCompletion({});
assert.equal(blankCompletion.answered, 0);
assert.equal(blankCompletion.total, profileQuestionnaireFields.length);
assert.equal(blankCompletion.percent, 0);

const form = new FormData();
form.set("height", "178");
form.set("wingspan", "183");
form.set("apeIndex", "5");
form.set("fingerStrength", "+20 kg 20 mm 7s");
form.append("injuryHistory", "Polea / A2 / dedos");
form.append("injuryHistory", "Codo");
form.append("recoveryNotes", "Dedos sensibles");
form.append("recoveryNotes", "Sueno bajo");

const profile = buildProfileFromQuestionnaireForm(form, {});
assert.equal(profile.height, "178");
assert.equal(profile.wingspan, "183");
assert.equal(profile.apeIndex, "5");
assert.equal(profile.injuryHistory, "Polea / A2 / dedos, Codo");
assert.equal(profile.recoveryNotes, "Dedos sensibles, Sueno bajo");
assert.equal(profile.questionnaireCompleted, true);
assert.equal(profile.questionnaireVersion, QUESTIONNAIRE_VERSION);

const partialCompletion = calculateQuestionnaireCompletion(profile);
assert.equal(partialCompletion.answered, 6);
assert.equal(partialCompletion.total, profileQuestionnaireFields.length);
