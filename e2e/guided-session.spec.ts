import { expect, test, type Page } from "@playwright/test";

async function openPlan(page: Page) {
  await page.goto("./");
  const deferProfile = page.getByRole("button", { name: "Completar mas tarde" });
  if (await deferProfile.isVisible().catch(() => false)) await deferProfile.click();
  await openTab(page, "Plan");
  await expect(page.getByText("Plan por dia", { exact: true })).toBeVisible();
}

async function openTab(page: Page, name: "Plan" | "Video" | "Perfil") {
  const mobileTab = page.getByRole("tab", { name });
  if (await mobileTab.isVisible().catch(() => false)) await mobileTab.click();
  else await page.getByRole("button", { name }).click();
}

async function selectSession(page: Page, sessionId: string) {
  await page.getByRole("button", { name: new RegExp(sessionId, "i") }).click();
}

async function launchSelected(page: Page) {
  await page.getByRole("button", { name: /^(Iniciar|Continuar) sesión/ }).first().click();
}

async function assertMobileLayout(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const primary = page.getByRole("button", { name: /completar y seguir/i });
  if (await primary.isVisible().catch(() => false)) {
    await expect(primary).toBeInViewport();
    const flow = page.getByTestId("guided-session-flow");
    await flow.locator(".overflow-y-auto").evaluate((element) => { element.scrollTop = element.scrollHeight; });
    const cardBounds = await flow.locator('[data-slot="card"]').last().boundingBox();
    const footerBounds = await flow.getByTestId("guided-actions").boundingBox();
    expect((cardBounds?.y || 0) + (cardBounds?.height || 0)).toBeLessThanOrEqual((footerBounds?.y || 0) + 1);
  }
}

test("Plan to W1D1 completion and Log handoff", async ({ page }) => {
  await openPlan(page);
  await launchSelected(page);
  await expect(page.getByTestId("guided-session-flow").getByRole("heading", { name: /w1d1 - limit \+ fuerza/i })).toBeVisible();
  await page.getByRole("button", { name: "Empezar sesión" }).click();
  await assertMobileLayout(page);

  for (let index = 0; index < 12; index += 1) {
    const complete = page.getByRole("button", { name: /completar y seguir/i });
    if (!(await complete.isVisible().catch(() => false))) break;
    await complete.click();
  }

  await expect(page.getByText("Sesión completada")).toBeVisible();
  await page.getByRole("button", { name: "Registrar resultados" }).click();
  await expect(page.getByText("Registro de sesion", { exact: true })).toBeVisible();
  await expect(page.getByText(/w1d1 - limit \+ fuerza/i).first()).toBeVisible();
});

test("pause, reload and resume at the same unresolved block", async ({ page }) => {
  await openPlan(page);
  await launchSelected(page);
  await page.getByRole("button", { name: "Empezar sesión" }).click();
  await page.getByRole("button", { name: /completar y seguir/i }).click();
  const expectedHeading = await page.locator("h1").textContent();
  await page.getByRole("button", { name: "Pausar o salir" }).click();
  await page.getByRole("button", { name: "Pausar y salir" }).click();
  await expect(page.getByLabel("Sesión pausada")).toContainText(/w1d1 - limit \+ fuerza · bloque 2 de 6/i);
  await expect(page.getByLabel("Sesión pausada").getByRole("button", { name: "Continuar sesión" })).toBeVisible();
  await page.reload();
  await openTab(page, "Plan");
  await page.getByRole("button", { name: /continuar sesión/i }).first().click();
  await expect(page.locator("h1")).toHaveText(expectedHeading || "");
});

test("pause dialog actions stay contained and do not overlap at the sm layout", async ({ page }, testInfo) => {
  if (testInfo.project.name === "desktop") await page.setViewportSize({ width: 700, height: 600 });
  await openPlan(page);
  await launchSelected(page);
  await page.getByRole("button", { name: "Empezar sesión" }).click();
  await page.getByRole("button", { name: "Pausar o salir" }).click();

  const dialog = page.getByRole("alertdialog", { name: "Pausar sesión" });
  const footer = dialog.locator('[data-slot="alert-dialog-footer"]');
  const actions = footer.getByRole("button");
  await dialog.evaluate(async (element) => {
    await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)));
  });
  const dialogBounds = await dialog.boundingBox();
  const footerBounds = await footer.boundingBox();

  expect(dialogBounds).not.toBeNull();
  expect(footerBounds).not.toBeNull();
  expect(await actions.count()).toBe(3);

  const actionBounds = await actions.evaluateAll((buttons) =>
    buttons.map((button) => {
      const bounds = button.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    }),
  );

  for (const bounds of actionBounds) {
    expect(bounds.x).toBeGreaterThanOrEqual(dialogBounds!.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(dialogBounds!.x + dialogBounds!.width);
    expect(bounds.x).toBeGreaterThanOrEqual(footerBounds!.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(footerBounds!.x + footerBounds!.width);
  }

  for (let first = 0; first < actionBounds.length; first += 1) {
    for (let second = first + 1; second < actionBounds.length; second += 1) {
      const a = actionBounds[first];
      const b = actionBounds[second];
      const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
      const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
      expect(overlapX && overlapY).toBe(false);
    }
  }

  for (const bounds of actionBounds) expect(bounds.height).toBeGreaterThanOrEqual(44);
});

test("active-session conflict supports cancel and discard", async ({ page }) => {
  await openPlan(page);
  await launchSelected(page);
  await page.getByRole("button", { name: "Empezar sesión" }).click();
  await page.getByRole("button", { name: "Pausar o salir" }).click();
  await page.getByRole("button", { name: "Pausar y salir" }).click();
  await selectSession(page, "w1d2");
  await page.getByRole("button", { name: "Iniciar sesión" }).first().click();
  await expect(page.getByRole("alertdialog", { name: "Sesión en curso" })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByText("Plan por dia", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Iniciar sesión" }).first().click();
  await page.getByRole("button", { name: "Descartar y empezar esta" }).click();
  await expect(page.getByTestId("guided-session-flow").getByRole("heading", { name: /w1d2 - fuerza general/i })).toBeVisible();
});

test("YouTube media is lazy, responsive and never autoplays", async ({ page }) => {
  await openPlan(page);
  await launchSelected(page);
  await page.getByRole("button", { name: "Empezar sesión" }).click();
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: /ver demostración/i }).click();
  const iframe = page.locator("iframe");
  await expect(iframe).toHaveAttribute("title", /mobility para escaladores/i);
  const src = await iframe.getAttribute("src");
  expect(src).toContain("playsinline=1");
  expect(src).not.toContain("autoplay=1");
  const bounds = await iframe.boundingBox();
  expect(bounds?.width || 0).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expect(page.getByRole("link", { name: "Abrir en YouTube" })).toBeVisible();
});

test("written guidance remains usable offline", async ({ page, context }) => {
  await openPlan(page);
  await launchSelected(page);
  await page.getByRole("button", { name: "Empezar sesión" }).click();
  await context.setOffline(true);
  await page.getByRole("button", { name: /ver demostración/i }).click();
  await expect(page.getByText("El video necesita conexión")).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir en YouTube" })).toBeVisible();
  await context.setOffline(false);
  await expect(page.locator("iframe")).toBeVisible();
  await page.getByRole("button", { name: /completar y seguir/i }).click();
  await expect(page.locator("h1")).toBeVisible();
  await assertMobileLayout(page);
});

test("rest day can be completed", async ({ page }) => {
  await openPlan(page);
  await selectSession(page, "w1d7");
  await launchSelected(page);
  await page.getByRole("button", { name: "Empezar sesión" }).click();
  await page.getByRole("button", { name: /completar y seguir/i }).click();
  await expect(page.getByText("Sesión completada")).toBeVisible();
});

test("keyboard opens and operates the exit dialog", async ({ page }) => {
  await openPlan(page);
  const opener = page.getByRole("button", { name: "Iniciar sesión" }).first();
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Sesión guiada" });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  const underlyingDashboard = page.locator("button").filter({ hasText: "Dashboard" }).first();
  expect(await underlyingDashboard.evaluate((element) => Boolean(element.closest("[aria-hidden='true']")))).toBe(true);
  await underlyingDashboard.evaluate((element: HTMLElement) => element.focus());
  await expect(dialog).toContainText(/w1d1 - limit \+ fuerza/i);
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.getByRole("button", { name: "Empezar sesión" }).click();
  const focusableButtons = dialog.locator("button:visible:not([disabled])");
  const count = await focusableButtons.count();
  await focusableButtons.nth(count - 1).focus();
  await page.keyboard.press("Tab");
  await expect(focusableButtons.first()).toBeFocused();
  const exit = page.getByRole("button", { name: "Pausar o salir" });
  await exit.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alertdialog", { name: "Pausar sesión" })).toBeVisible();
  await page.getByRole("button", { name: "Seguir entrenando" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alertdialog", { name: "Pausar sesión" })).toBeHidden();
  await expect(exit).toBeVisible();
});

test("internal guide references open Profile and Video tabs", async ({ page }) => {
  await openPlan(page);
  await selectSession(page, "w4d7");
  await launchSelected(page);
  await page.getByRole("button", { name: "Empezar sesión" }).click();
  await page.getByRole("button", { name: /abrir en la app:.*perfil y respaldo/i }).click();
  await expect(page.getByText("Perfil del escalador", { exact: true })).toBeVisible();

  await page.evaluate(() => {
    const key = "climb4w.users.v3";
    const envelope = JSON.parse(localStorage.getItem(key) || "null");
    const user = envelope.users[envelope.activeUserId];
    user.guidedSessions = { schemaVersion: 1, activeRun: null, history: [] };
    localStorage.setItem(key, JSON.stringify(envelope));
  });
  await page.reload();
  await openTab(page, "Plan");
  await selectSession(page, "w4d6");
  await launchSelected(page);
  await page.getByRole("button", { name: "Empezar sesión" }).click();
  await page.getByRole("button", { name: /completar y seguir/i }).click();
  await page.getByRole("button", { name: /completar y seguir/i }).click();
  await page.getByRole("button", { name: /abrir en la app:.*video propio/i }).click();
  await expect(page.getByText("Video", { exact: true }).first()).toBeVisible();
});

test("runner has no horizontal overflow in light and dark themes", async ({ page }) => {
  await openPlan(page);
  for (let index = 0; index < 2; index += 1) {
    await launchSelected(page);
    await page.getByRole("button", { name: "Empezar sesión" }).click();
    await assertMobileLayout(page);
    await page.getByRole("button", { name: "Pausar o salir" }).click();
    await page.getByRole("button", { name: "Descartar sesión" }).click();
    if (index === 0) {
      const themeToggle = page.getByRole("main").getByRole("switch", { name: /modo (claro|oscuro)/i });
      await themeToggle.click();
    }
  }
});
