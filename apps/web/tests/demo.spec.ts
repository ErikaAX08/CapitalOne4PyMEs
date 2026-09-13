import { test, expect } from "@playwright/test";
test("decision, collapse, advance, reset and alternative scenarios", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("request", (r) => {
    if (
      !r
        .url()
        .startsWith(
          process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173",
        ) &&
      !r.url().startsWith("data:") &&
      !r.url().startsWith("blob:")
    )
      external.push(r.url());
  });
  await page.goto("/");
  await expect(page).toHaveTitle("Capital One | ForPyMEs");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    "/COF.svg",
  );
  const landingHeader = page.locator("header");
  const logo = landingHeader.getByRole("img", {
    name: "Capital One For PyMES",
  });
  await expect(logo).toBeVisible();
  await expect(
    landingHeader.getByText("Demo con datos simulados", { exact: true }),
  ).toHaveCount(0);
  await expect(
    landingHeader.getByText("Mariana Luna", { exact: true }),
  ).toHaveCount(0);
  await expect(
    landingHeader.getByText("Administradora", { exact: true }),
  ).toHaveCount(0);
  const logoBox = await logo.boundingBox();
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(logoBox).not.toBeNull();
  expect(
    Math.abs((logoBox?.x ?? 0) + (logoBox?.width ?? 0) / 2 - viewportWidth / 2),
  ).toBeLessThan(1);
  await expect(
    page.getByRole("button", { name: "Explorar mi estabilidad" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Emprendedora sosteniendo documentos y una calculadora",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Tu negocio merece perspectiva.", { exact: true }),
  ).toHaveCSS("color", "rgb(23, 23, 23)");
  await expect(
    page.getByText("Explora decisiones antes de llevarlas a la realidad.", {
      exact: true,
    }),
  ).toHaveCSS("color", "rgb(23, 23, 23)");
  await expect(page.locator("main .bg-surface-soft")).toHaveCSS(
    "background-color",
    "rgb(244, 244, 244)",
  );
  await page.getByRole("button", { name: "Explorar mi estabilidad" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByText("Demo con datos simulados", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("1. Revisa tu base", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("2. Lee la estructura", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("3. Prueba una decisión", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Esta torre representa tu empresa" }),
  ).toBeVisible();
  await expect(page.locator("main.dashboard")).toHaveCSS("opacity", "1");
  await expect(
    page.getByRole("group", { name: /Estructura 3D/ }),
  ).toBeVisible();
  const rotationSpeed = page.getByLabel("Velocidad de giro de la torre");
  await expect(rotationSpeed).toHaveValue("0.5");
  await rotationSpeed.selectOption("2");
  await expect(rotationSpeed).toHaveValue("2");
  await rotationSpeed.selectOption("0");
  await expect(rotationSpeed).toHaveValue("0");
  await page.screenshot({
    path: `/tmp/resilia-${testInfo.project.name}-stable.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: /Aceptar proyecto a crédito/ })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Iniciar timelapse" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Rentable no siempre significa sostenible",
    }),
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("-$40,000 MXN", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("group", { name: /Estructura 3D/ }),
  ).toBeVisible();
  await page.screenshot({
    path: `/tmp/resilia-${testInfo.project.name}-critical.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Pedir anticipo de 25%" }).click();
  await expect(
    page.getByRole("heading", { name: "Una decisión más resiliente" }),
  ).toBeVisible({ timeout: 6000 });
  await expect(page.getByText("78 → 36", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `/tmp/resilia-${testInfo.project.name}-recovered.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Reiniciar simulación", exact: true })
    .last()
    .click();
  for (const scenario of ["Comprar equipo", "Retraso de cliente"]) {
    await page.getByRole("button", { name: new RegExp(scenario) }).click();
    await page.getByRole("button", { name: "Iniciar timelapse" }).click();
    await page.getByRole("button", { name: "Ver resultado" }).click();
    await expect(
      page.getByRole("heading", { name: "Así cambia tu estabilidad" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Reiniciar simulación", exact: true })
      .last()
      .click();
  }
  await page.getByRole("button", { name: "¿Cómo lo calculamos?" }).click();
  await expect(
    page.getByRole("heading", { name: "Señal estructural" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("dashboard supports direct navigation and reload", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Esta torre representa tu empresa" }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: /Estructura 3D/ }),
  ).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("group", { name: /Estructura 3D/ }),
  ).toBeVisible();
});

test("reduced motion and keyboard can complete the contract", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explorar mi estabilidad" })
    .press("Enter");
  await page
    .getByRole("button", { name: /Aceptar proyecto a crédito/ })
    .press("Enter");
  await page.getByRole("button", { name: "Iniciar timelapse" }).press("Enter");
  await expect(
    page.getByRole("heading", {
      name: "Rentable no siempre significa sostenible",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pedir anticipo de 25%" })
    .press("Enter");
  await expect(
    page.getByRole("heading", { name: "Una decisión más resiliente" }),
  ).toBeVisible();
});

test("3D simulation works without WebGL and can skip animations", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: unknown[]
    ) {
      if (
        type === "webgl" ||
        type === "webgl2" ||
        type === "experimental-webgl"
      )
        return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto("/");
  await expect(
    page.getByRole("img", {
      name: "Emprendedora sosteniendo documentos y una calculadora",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explorar mi estabilidad" }).click();
  await expect(
    page.getByRole("group", { name: /Estructura 3D/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Aceptar proyecto a crédito/ })
    .click();
  await page.getByRole("button", { name: "Iniciar timelapse" }).click();
  await page.getByRole("button", { name: "Ver resultado" }).click();
  await expect(page.getByText("-$40,000 MXN", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pedir anticipo de 25%" }).click();
  await expect(
    page.getByRole("heading", { name: "Una decisión más resiliente" }),
  ).toBeVisible();
});

test("3D tower falls with expenses, recovers on undo, and resets", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Explorar mi estabilidad" }).click();
  const tower = page.getByRole("group", { name: /Estructura 3D/ });
  await expect(tower).toBeVisible();
  await page.getByLabel("Monto del gasto").fill("24000");
  await page
    .getByRole("button", { name: "Agregar gasto a la simulación" })
    .click();
  await expect(tower).toHaveAttribute("aria-label", /1 bloques retirados/);
  await expect(page.getByText("$256,000", { exact: false })).toBeVisible();
  await page
    .getByRole("button", { name: "Nómina $72,000", exact: true })
    .click();
  await expect(tower).toHaveAttribute("aria-label", /4 bloques retirados/);
  await page
    .getByRole("button", { name: "Inventario $95,000", exact: true })
    .click();
  await expect(tower).toHaveAttribute("aria-label", /colapsada/);
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({
    path: `/tmp/resilia-2d-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Deshacer último gasto" }).click();
  await expect(tower).not.toHaveAttribute("aria-label", /colapsada/);
  await expect(tower).toHaveAttribute("aria-label", /4 bloques retirados/);
  await page
    .getByRole("button", { name: "Reiniciar simulación", exact: true })
    .first()
    .click();
  await expect(tower).toHaveAttribute("aria-label", /0 bloques retirados/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
