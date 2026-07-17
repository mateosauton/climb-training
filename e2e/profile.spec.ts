import { expect, test, type Page } from "@playwright/test";

const LEGACY_KEY = "climb4w.state.v1";

async function seedProfile(page: Page) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: LEGACY_KEY,
    value: JSON.stringify({
      goals: { currentGrade: "V6", targetGrade: "V8", project: "Moonboard", focus: "Lectura de pies" },
      profile: {
        name: "Mateo Sautón",
        age: "28",
        location: "Salta",
        strengths: "Regletas",
        limiters: "Tensión corporal",
        questionnaireCompleted: true,
        questionnaireCompletedAt: "2026-07-10T10:00:00.000Z",
        questionnaireVersion: 1
      },
      logs: [{
        id: "profile-log",
        sessionId: "w1d1",
        createdAt: "2026-07-17T11:00:00.000Z",
        notes: "profile metric",
        rpe: 8,
        pump: 6,
        pain: 0,
        attempts: 12,
        moves: 40,
        bestLink: 20,
        footCuts: 1,
        pullWeight: 0,
        sleep: 8,
        energy: 8
      }],
      videos: []
    })
  });
}

async function openProfile(page: Page) {
  const profileButton = page.getByRole("button", { name: /Abrir perfil de/ });
  if ((page.viewportSize()?.width || 0) < 768) await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
  await profileButton.click();
  await expect(page.getByRole("heading", { name: "Mateo Sautón" })).toBeVisible();
}

test("profile shows age, preserves a cross-tab draft and persists it", async ({ page }) => {
  await seedProfile(page);
  await page.goto("./");
  await openProfile(page);

  await expect(page.getByText("28 años · Salta")).toBeVisible();
  await expect(page.getByText("V6 actual")).toBeVisible();
  await expect(page.getByText("V8 objetivo")).toBeVisible();
  for (const metric of ["Racha", "Esta semana", "Carga", "Progreso"]) await expect(page.getByText(metric, { exact: true })).toBeVisible();

  await page.getByLabel("Edad").fill("29");
  await page.getByRole("tab", { name: "Escalada" }).click();
  await page.getByLabel("Grado actual").fill("V7");
  await page.getByRole("tab", { name: "General" }).click();
  await expect(page.getByLabel("Edad")).toHaveValue("29");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados.", { exact: true })).toBeVisible();

  await page.reload();
  await openProfile(page);
  await expect(page.getByText("29 años · Salta")).toBeVisible();
  await expect(page.getByText("V7 actual")).toBeVisible();
  await expect(page.getByRole("tab", { name: "General" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Cuenta" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
