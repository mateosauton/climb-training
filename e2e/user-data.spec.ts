import { expect, test, type Page } from "@playwright/test";

const USER_KEY = "climb4w.users.v3";
const LEGACY_KEY = "climb4w.state.v1";

async function seedLegacy(page: Page) {
  const legacy = {
    goals: { currentGrade: "6c" },
    profile: {
      name: "Mateo",
      questionnaireCompleted: true,
      questionnaireCompletedAt: "2026-07-10T10:00:00.000Z",
      questionnaireVersion: 1
    },
    logs: [{
      id: "legacy-log", sessionId: "w1d1", createdAt: "2026-07-10T11:00:00.000Z", notes: "migrated",
      rpe: 8, pump: 7, pain: 0, attempts: 12, moves: 40, bestLink: 20, footCuts: 1,
      pullWeight: 0, sleep: 7, energy: 8
    }],
    videos: []
  };
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: LEGACY_KEY,
    value: JSON.stringify(legacy)
  });
}

async function openProfile(page: Page) {
  await page.getByRole("button", { name: /Abrir perfil de/ }).click();
  await expect(page.getByText("Perfil del escalador", { exact: true })).toBeVisible();
}

test("legacy data migrates once and remains stable after reload", async ({ page }) => {
  await seedLegacy(page);
  await page.goto("./");

  const first = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), USER_KEY);
  expect(first.schemaVersion).toBe(3);
  expect(Object.keys(first.users)).toEqual([first.activeUserId]);
  expect(first.migration.migratedFrom).toBe(LEGACY_KEY);
  expect(first.users[first.activeUserId].sessionLogs).toHaveLength(1);
  expect(await page.evaluate((key) => localStorage.getItem(key), LEGACY_KEY)).not.toBeNull();

  const counts = { facts: first.users[first.activeUserId].facts.length, logs: first.users[first.activeUserId].sessionLogs.length };
  await page.reload();
  const second = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), USER_KEY);
  expect(second.activeUserId).toBe(first.activeUserId);
  expect(second.users[second.activeUserId].facts).toHaveLength(counts.facts);
  expect(second.users[second.activeUserId].sessionLogs).toHaveLength(counts.logs);
});

test("profile history and export controls remain usable without leaking data", async ({ page }) => {
  await seedLegacy(page);
  const leakedRequests: string[] = [];
  page.on("request", (request) => {
    const payload = `${request.url()} ${request.postData() || ""}`;
    if (payload.includes(USER_KEY) || payload.includes("legacy-log")) leakedRequests.push(payload);
  });
  await page.goto("./");
  await openProfile(page);

  for (const value of ["7a", "7b"]) {
    await page.getByLabel("Grado actual").fill(value);
    await page.getByRole("button", { name: "Guardar objetivos" }).click();
  }
  await page.getByRole("button", { name: "Ver JSON" }).click();
  const exported = JSON.parse(await page.getByLabel("JSON exportado del tracker").inputValue());
  const chain = exported.users[exported.activeUserId].facts.filter((fact: { key: string }) => fact.key === "currentGrade");
  expect(chain.map((fact: { value: string }) => fact.value)).toEqual(["6c", "7a", "7b"]);
  expect(chain[1].supersedes).toBe(chain[0].id);
  expect(chain[2].supersedes).toBe(chain[1].id);
  expect(exported).not.toHaveProperty("plan");

  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  for (const name of ["Copiar JSON", "Descargar", "Ocultar JSON"]) {
    await expect(page.getByRole("button", { name })).toBeInViewport();
  }
  expect(leakedRequests).toEqual([]);
});
