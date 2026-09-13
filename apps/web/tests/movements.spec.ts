import { test, expect, type Page } from "@playwright/test";

/** The company's ledger (docs/data-model.md §3), served by /v1/movements.
 *
 *  The rule these pin down: reading degrades and says so, writing never does.
 *  A movement the service could not take is queued as unsent — it must never
 *  appear in the ledger as though it had been stored. */

const MOVEMENTS = "**/v1/movements*";

async function databaseIsReachable(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get("/v1/movements");
    return response.ok();
  } catch {
    return false;
  }
}

test("the ledger lists what the database holds and records a new movement", async ({
  page,
}) => {
  test.skip(
    !(await databaseIsReachable(page)),
    "no movements database reachable; start services/domain with DATABASE_CONNECTION_STRING set",
  );

  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/movements");
  const banner = page.getByRole("status").first();
  await expect(banner).toContainText("base de datos");

  const list = page.locator("#lista-movimientos li");
  const before = await list.count();

  // A description unique to this run, so the assertion cannot pass on a row
  // some earlier run left behind.
  const description = `Cobro E2E ${Date.now()}`;
  await page.getByRole("radio", { name: /Entrada/ }).click();
  // Choosing "Entrada" must move the category off payroll, which is an
  // outgoing obligation and cannot be an incoming movement.
  await expect(page.getByLabel("Categoría")).toContainText("Cobranza");

  await page.getByLabel("Monto").fill("45000");
  await page.getByPlaceholder("Nómina quincenal").fill(description);
  await page.getByRole("button", { name: /Guardar movimiento/ }).click();

  await expect(page.getByText(description)).toBeVisible({ timeout: 15000 });
  await expect(list).toHaveCount(before + 1);
  // Scoped to this run's own row: the assertion is about the movement just
  // recorded, not about any row an earlier run left in the database.
  const row = list.filter({ hasText: description });
  // The amount is rendered from the stored cents, not from what was typed.
  await expect(row).toContainText("+$45,000");
  await expect(row).toContainText("Cobranza");

  // It survives a reload, which is what distinguishes it from the dashboard's
  // simulated expenses.
  await page.reload();
  await expect(page.getByText(description)).toBeVisible({ timeout: 15000 });

  expect(errors, `page errors: ${errors.join(" | ")}`).toEqual([]);
});

test("with the service unreachable the ledger degrades and queues the addition", async ({
  page,
}) => {
  await page.route(MOVEMENTS, (route) => route.abort("failed"));
  await page.goto("/movements");

  const banner = page.getByRole("status").first();
  await expect(banner).toContainText("Libro aproximado", { timeout: 15000 });
  await expect(banner).toContainText("no hay conexión");
  // Degrading still shows real movements, and it declares that it did.
  await expect(page.locator("#lista-movimientos li").first()).toBeVisible();

  const description = "Movimiento sin conexión";
  await page.getByLabel("Monto").fill("12345");
  await page.getByPlaceholder("Nómina quincenal").fill(description);
  await page.getByRole("button", { name: /Guardar movimiento/ }).click();

  await expect(page.getByText("1 movimiento sin guardar")).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  // The one thing that must never happen: an unsaved movement presented as
  // part of the ledger.
  await expect(
    page.locator("#lista-movimientos").getByText(description),
  ).toHaveCount(0);
});

test("a movement the service rejects is reported, not queued", async ({
  page,
}) => {
  await page.route(MOVEMENTS, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: "ConflictingImport",
        message: "conflicting re-import: cfdi/UUID-A already exists",
      }),
    });
  });
  await page.goto("/movements");

  await page.getByLabel("Monto").fill("5000");
  await page.getByRole("button", { name: /Guardar movimiento/ }).click();

  await expect(page.getByRole("alert")).toContainText("already exists", {
    timeout: 15000,
  });
  // A rejection is about this movement: retrying it unchanged would fail
  // again, so it is not queued.
  await expect(page.getByText(/movimientos? sin guardar/)).toHaveCount(0);
});

test("the ledger is reachable from the shell on both widths", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Movimientos" }).first().click();
  await expect(page).toHaveURL(/\/movements$/);
  await expect(
    page.getByRole("heading", { name: /Todo lo que entra/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
