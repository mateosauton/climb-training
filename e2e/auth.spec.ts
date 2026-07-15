import { expect, test } from "@playwright/test";

test("authenticated Apple user keeps one local record across reload", async ({ page }) => {
  await page.goto("./");

  await page.waitForFunction(() => localStorage.getItem("climb4w.users.v3") !== null);
  const before = await page.evaluate(() => {
    const envelope = JSON.parse(localStorage.getItem("climb4w.users.v3") || "null");
    return { activeUserId: envelope.activeUserId, subject: envelope.users[envelope.activeUserId].identity.auth.subject };
  });
  expect(before.subject).toBe("e2e-apple-user");

  await page.reload();
  await page.waitForFunction(() => localStorage.getItem("climb4w.users.v3") !== null);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("climb4w.users.v3") || "null").activeUserId);
  expect(after).toBe(before.activeUserId);
});

test("sign-out returns to the Apple gate", async ({ page }) => {
  await page.goto("./");
  const skipQuestionnaire = page.getByRole("button", { name: "Completar mas tarde" });
  if (await skipQuestionnaire.isVisible().catch(() => false)) await skipQuestionnaire.click();
  const mobileTab = page.getByRole("tab", { name: "Perfil" });
  if (await mobileTab.isVisible().catch(() => false)) await mobileTab.click();
  else await page.getByRole("button", { name: "Perfil", exact: true }).click();
  await page.getByRole("button", { name: "Cerrar sesión" }).last().click();
  await expect(page.getByRole("button", { name: "Continuar con Apple" })).toBeVisible();
});
