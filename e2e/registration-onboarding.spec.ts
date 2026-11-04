import { expect, test } from "@playwright/test";

test("new user verifies their email, completes onboarding, and generates a plan", async ({ page }, testInfo) => {
  await page.goto("./?e2e-auth=signed-out");

  await expect(page).toHaveURL(/\/escalada\/login/);
  await page.getByRole("link", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/escalada\/signup/);
  await page.getByLabel("Correo").fill("nuevo@example.com");
  await page.getByLabel("Contraseña", { exact: true }).fill("password1");
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page.getByRole("heading", { name: "Confirma tu correo" })).toBeVisible();
  await expect(page.getByText("Te enviamos un enlace para confirmar tu cuenta. Ábrelo desde el correo; no hace falta un código.")).toBeVisible();
  await expect(page.getByLabel("Código de verificación")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("registration-confirm-link.png"), fullPage: true });

  await page.getByRole("button", { name: "Ya abrí el enlace" }).click();

  await expect(page.getByText("Cuestionario del escalador", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Nuevo Escalador");
  await page.screenshot({ path: testInfo.outputPath("questionnaire-start.png"), fullPage: true });

  for (let step = 0; step < 5; step += 1) {
    await page.getByRole("button", { name: "Siguiente" }).click();
  }
  await page.getByRole("button", { name: "Guardar cuestionario" }).click();

  await expect(page.getByText("Tu plan está listo.")).toBeVisible();
  await expect(page.getByText("Cuestionario del escalador", { exact: true })).not.toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("registration-onboarding-complete.png"), fullPage: true });
});
