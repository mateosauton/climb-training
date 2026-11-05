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

test("new user gets a magic link, can skip Salud, and reaches Hoy without the questionnaire", async ({ page }) => {
  await page.goto("./?e2e-auth=signed-out");

  await expect(page).toHaveURL(/\/escalada\/login/);
  await expect(page.getByLabel("Contraseña")).toHaveCount(0);
  await expect(page.getByLabel(/código/i)).toHaveCount(0);
  await page.getByLabel("Correo").fill("nuevo@example.com");
  await page.getByRole("button", { name: "Enviar link" }).click();

  await expect(page.getByRole("heading", { name: "Revisa tu correo" })).toBeVisible();
  await expect(page.getByText("El link vence en 15 minutos.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reenviar link" })).toBeVisible();
  await expect(page.getByLabel(/código/i)).toHaveCount(0);
  await expect(page.getByText("Cuestionario del escalador")).toHaveCount(0);

  await page.evaluate(() => {
    (window as Window & { __maillonOpenMagicLink?: () => void }).__maillonOpenMagicLink?.();
  });

  await expect(page.getByRole("heading", { name: "Entrena según cómo dormiste" })).toBeVisible();
  await expect(page.getByText("Solo lectura. No es consejo médico: Maillon usa esto únicamente para ajustar descanso y carga. Puedes desconectar en Perfil.")).toBeVisible();
  const apple = page.getByRole("button", { name: "Conectar Apple Salud" });
  const android = page.getByRole("button", { name: "Usar Health Connect (Android)" });
  await expect(apple.or(android)).toHaveCount(1);
  await expect(page.getByText("Cuestionario del escalador")).toHaveCount(0);

  await page.getByRole("button", { name: "Ahora no" }).first().click();
  await expect(page.getByTestId("hoy")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Listo, ya leemos tu día" })).toHaveCount(0);
  await expect(page.getByText("Cuestionario del escalador")).toHaveCount(0);

  await openProfile(page);
  await page.getByRole("button", { name: "Abrir cuestionario" }).click();
  await expect(page.getByText("Cuestionario del escalador", { exact: true })).toBeVisible();
});
