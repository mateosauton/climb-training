import { expect, test, type Page } from "@playwright/test";

async function openProfile(page: Page) {
  const profileButton = page.getByRole("button", { name: /Abrir perfil de/ });
  if ((page.viewportSize()?.width || 0) < 768) {
    await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
  }
  await expect(profileButton).toBeInViewport();
  await profileButton.click();
  await expect(page.getByText("Perfil del escalador", { exact: true })).toBeVisible();
}

test("authenticated Supabase user keeps one local record across reload", async ({ page }) => {
  await page.goto("./");

  await page.waitForFunction(() => localStorage.getItem("climb4w.users.v3") !== null);
  const before = await page.evaluate(() => {
    const envelope = JSON.parse(localStorage.getItem("climb4w.users.v3") || "null");
    return { activeUserId: envelope.activeUserId, subject: envelope.users[envelope.activeUserId].identity.auth.subject };
  });
  expect(before.subject).toBe("e2e-supabase-user");

  await page.reload();
  await page.waitForFunction(() => localStorage.getItem("climb4w.users.v3") !== null);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("climb4w.users.v3") || "null").activeUserId);
  expect(after).toBe(before.activeUserId);
});

test("sign-out returns to the email gate", async ({ page }) => {
  await page.goto("./");
  const questionnaire = page.getByRole("dialog");
  if (await questionnaire.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: /^6\./ }).click();
    await page.getByRole("button", { name: "Guardar cuestionario" }).click();
    await expect(questionnaire).not.toBeVisible();
  }
  await openProfile(page);
  await page.getByRole("tab", { name: "Cuenta" }).click();
  await page.getByRole("button", { name: "Cerrar sesión" }).last().click();
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
});
