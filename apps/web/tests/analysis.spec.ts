import { test, expect, type Page } from "@playwright/test";

/** The structural-fragility view (PRD 3), fed by GET /v1/analysis.
 *
 *  These cover the acceptance criteria of PRD 8: every control must do
 *  something distinct and visible, and the interface must keep answering with
 *  the network down and say that it is doing so.
 */

const ANALYSIS = "**/v1/analysis*";

async function engineIsReachable(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get(
      "/v1/analysis?action=none&paths=100",
    );
    return response.ok();
  } catch {
    return false;
  }
}

/** Waits for the request the last control change triggered to settle. */
async function settle(page: Page) {
  await page.waitForResponse(
    (response) => response.url().includes("/v1/analysis"),
    { timeout: 20000 },
  );
  await expect(page.getByText("Calculando")).toHaveCount(0, { timeout: 20000 });
}

test.describe("structural fragility view", () => {
  test("every control moves the state, and every figure carries an engine run", async ({
    page,
  }) => {
    test.skip(
      !(await engineIsReachable(page)),
      "services/domain is not running; start it with `go run ./cmd/analysis`",
    );

    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await page.goto("/analysis");
    const survival = page.getByRole("region", {
      name: "Indicador de supervivencia",
    });

    // The base parameterization is stable: the project is affordable at the
    // contracted collection term.
    await settle(page);
    await expect(survival).toContainText("Estable");

    // Scoped to the sandbox: "Retraso en cobranza" is both a stress control
    // here and a tension factor in Module C, and they are different things.
    const sandbox = page.getByRole("region", {
      name: "Prueba una decisión con tus cifras",
    });

    // Crossing the documented breaking point at 16 days moves it to Tensión.
    const delay = sandbox.getByRole("slider", { name: "Retraso en cobranza" });
    await delay.fill("16");
    await delay.dispatchEvent("change");
    await settle(page);
    await expect(survival).toContainText("Tensión");
    // The text names the concrete obligation, never a generic adjective.
    await expect(survival).toContainText("nómina");
    await expect(survival).toContainText("Nómina");

    // Losing the main customer escalates it to Crisis Estructural.
    await sandbox.getByText("Pérdida del cliente principal").click();
    await settle(page);
    await expect(survival).toContainText("Crisis Estructural");

    // The limitations strip is visible in every state and always carries the
    // warnings the engine emitted.
    const strip = page.getByRole("region", { name: "Alcance y limitaciones" });
    await expect(strip).toContainText("Sin validación en población mexicana");
    await expect(strip).toContainText("Semilla 42");

    // Module C shows six bars, sorted descending, and flags the two ranges the
    // PRD declares as assumptions.
    const bars = page.getByRole("meter");
    await expect(bars).toHaveCount(6);
    await expect(page.getByText("supuesto", { exact: true })).toHaveCount(2);

    expect(errors, `page errors: ${errors.join(" | ")}`).toEqual([]);
  });

  test("changing a decision regenerates the form from the contract", async ({
    page,
  }) => {
    test.skip(
      !(await engineIsReachable(page)),
      "services/domain is not running; start it with `go run ./cmd/analysis`",
    );
    await page.goto("/analysis");
    await settle(page);

    // accept_project is the default and declares a hires control.
    await expect(page.getByLabel("Contrataciones")).toBeVisible();

    await page
      .getByRole("button", { name: "Solicitar Financiamiento" })
      .click();
    await settle(page);
    // request_financing declares an annual rate and a grace period instead;
    // no component was written for it.
    await expect(page.getByLabel("Tasa anual")).toBeVisible();
    await expect(page.getByLabel("Meses de gracia")).toBeVisible();
    await expect(page.getByLabel("Contrataciones")).toHaveCount(0);
  });

  test("with the engine unreachable the view still answers and says it is approximate", async ({
    page,
  }) => {
    // The demo cannot depend on the network cooperating (PRD 5.5). The fallback
    // does not invent: it shows a real precomputed state and declares it.
    await page.route(ANALYSIS, (route) => route.abort("failed"));
    await page.goto("/analysis");

    const strip = page.getByRole("region", { name: "Alcance y limitaciones" });
    await expect(strip).toContainText("Escenario aproximado", {
      timeout: 20000,
    });
    await expect(strip).toContainText("sin conexión con el motor");

    // Figures are still on screen, and they are real ones.
    const survival = page.getByRole("region", {
      name: "Indicador de supervivencia",
    });
    await expect(survival).toContainText("semanas");
    await expect(page.getByRole("meter")).toHaveCount(6);
  });
});
