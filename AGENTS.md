# AGENTS.md

## Propósito del repositorio

Resilia es una demo React + TypeScript + Vite que permite explorar el impacto de decisiones y gastos simulados sobre la liquidez de una PyME. La torre 3D es una representación visual; los cálculos actuales son deterministas y mock, no predicciones financieras reales.

Lee `DOCUMENTACION_SESION.md` antes de cambiar comportamiento. Contiene el contrato funcional, resultados de referencia, accesibilidad, física 3D y límites del producto. Lee `PLAN_MIGRACION_ARQUITECTURA.md` antes de mover archivos o crear capas.

## Estado actual y objetivo

- **Actual:** organización `components/data/lib`, `App.tsx` monolítico, CSS global y dos lockfiles históricos.
- **Objetivo:** arquitectura por features con dirección `app -> features -> entities -> shared` y pnpm como único gestor.
- El plan no implica que la migración ya esté implementada. Verifica el árbol real antes de asumir rutas.

## Gestor de paquetes

Usa pnpm para toda operación:

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm test:e2e
```

No ejecutes `npm install`, no generes `package-lock.json` y no edites manualmente `pnpm-lock.yaml`. Si cambian dependencias, usa el comando pnpm correspondiente y versiona el lockfile resultante.

La estandarización completa de scripts y metadatos está pendiente en la Fase 1 del plan. Si un comando documentado todavía no existe, consulta `package.json` y no inventes que ya fue agregado.

## Reglas de arquitectura objetivo

- `app` compone e inicializa; no contiene lógica financiera ni implementaciones extensas de features.
- `features` se organiza por capacidad de producto, no por tipo técnico global.
- `entities` contiene contratos, fixtures, fuentes de datos y lógica pura del dominio.
- `shared` solo contiene piezas agnósticas al dominio y reutilizadas de verdad.
- Dirección permitida: `app -> features -> entities -> shared`.
- No hagas deep imports a otra slice; importa desde su `index.ts` público.
- Una feature no importa internals de otra feature.
- No introduzcas router, store global, framework arquitectónico o repositorios genéricos sin un requisito concreto.
- Mantén `simulateFinancialDecision` puro y determinista.
- Separa formato de moneda y reglas visuales de la lógica financiera.
- La UI debe consumir negocio/transacciones mediante `FinancialDataSource`, no fixtures directamente, una vez realizada la Fase 2.

## Contratos que se deben preservar

- Todos los datos son simulados y se presentan como tales.
- La torre tiene 12 niveles y 36 bloques; la física no calcula el riesgo.
- Deben mantenerse teclado, movimiento reducido, fallback sin WebGL y diseño responsive.
- Los recursos de la demo permanecen locales; no agregues llamadas externas sin autorización.
- No cambies las cifras y fórmulas documentadas como parte de una refactorización.
- El estado de flujo y el estado financiero son conceptos distintos.
- No agregues secretos ni credenciales al cliente. Usa `.env.example` solo para nombres de variables sin valores sensibles.

## Forma de trabajar

1. Inspecciona `package.json`, el árbol real y los cambios existentes antes de editar.
2. Haz migraciones verticales y pequeñas; evita mover todo el repositorio en un solo cambio.
3. Primero caracteriza comportamiento, luego mueve código y finalmente mejora diseño interno.
4. Conserva cambios del usuario y no reformatees archivos no relacionados.
5. Coloca pruebas junto al dominio o feature que protegen; reserva `tests/` para E2E.
6. No uses snapshots grandes como sustituto de aserciones de comportamiento.
7. Actualiza imports y pruebas en el mismo cambio que mueve un módulo.
8. Si una fase revela un bug preexistente, documéntalo y sepáralo de la refactorización.

## Validación mínima

Antes de cerrar un cambio de código, ejecuta en proporción al alcance:

```sh
pnpm test
pnpm build
```

Para cambios de flujo, accesibilidad, layout, WebGL o torre:

```sh
pnpm test:e2e
```

Los E2E esperan un servidor accesible en `http://localhost:5173` salvo que se defina `PLAYWRIGHT_BASE_URL`. `PLAYWRIGHT_EXECUTABLE_PATH` permite reutilizar un Chromium instalado.

No afirmes que una validación pasó si no se ejecutó en la sesión actual. Reporta advertencias y limitaciones, en especial las verificaciones visuales de la física.

## Criterio para nuevas abstracciones

Extrae una abstracción cuando tenga un dueño claro, reduzca acoplamiento real o habilite una segunda implementación conocida. No crees carpetas vacías ni capas especulativas para hacer coincidir el árbol con el plan. El árbol objetivo es una guía de responsabilidades, no una cuota de archivos.
