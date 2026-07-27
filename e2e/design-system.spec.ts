import { expect, test } from "@playwright/test";

test("design-system gallery documents custom components and grade progression", async ({ page }) => {
  await page.goto("./?mockup=design-system");
  await expect(page.getByRole("heading", { name: "Sistema de diseño" })).toBeVisible();
  await expect(page.getByText("Botón de ruta", { exact: true })).toBeVisible();
  await expect(page.getByText("Selector de estilo", { exact: true })).toBeVisible();
  await expect(page.getByText("Escala de carga", { exact: true })).toBeVisible();
  await expect(page.getByText("Tarjeta de sesión", { exact: true })).toBeVisible();
  await expect(page.getByText("Pulso de recuperación", { exact: true })).toBeVisible();
  await expect(page.getByText("Verde → Azul → Amarillo → Naranja → Rojo → Violeta → Negro", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("product flow mockups expose every primary flow without horizontal overflow", async ({ page }) => {
  await page.goto("./?mockup=flows");
  for (const name of ["Acceso", "Dashboard", "Plan", "Log", "Video", "Perfil"]) {
    const tab = page.getByRole("button", { name });
    await expect(tab).toBeVisible();
    await tab.click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  }
});
