import { expect, test } from "@playwright/test";

test("new user verifies their email, completes onboarding, and generates a plan", async ({ page }, testInfo) => {
  await page.goto("./?e2e-auth=signed-out");

  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByLabel("Correo electrónico").fill("nuevo@example.com");
  await page.getByLabel("Contraseña", { exact: true }).fill("password1");
  await page.getByLabel("Confirmar contraseña").fill("password1");
  await page.getByRole("button", { name: "Registrarme" }).click();

  await expect(page.getByText("Revisa tu correo para obtener el código de seis dígitos.")).toBeVisible();
  await expect(page.getByLabel("Código de verificación")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("registration-code.png"), fullPage: true });

  await page.getByLabel("Código de verificación").fill("123456");
  await page.getByRole("button", { name: "Confirmar código" }).click();

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
