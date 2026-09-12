# AGENTS.md

## Propósito del repositorio

Resilia es una demo React + TypeScript + Vite que permite explorar el impacto de decisiones y gastos simulados sobre la liquidez de una PyME. La torre 3D es una representación visual; los cálculos actuales son deterministas y mock, no predicciones financieras reales.

Lee `DOCUMENTACION_SESION.md` antes de cambiar comportamiento. Contiene el contrato funcional, resultados de referencia, accesibilidad, física 3D y límites del producto. `PLAN_MIGRACION_ARQUITECTURA.md` describe la migración ya completada — consúltalo para el razonamiento de cada fase, pero el árbol real (`src/app`, `src/features`, `src/entities`, `src/shared`) es la fuente de verdad sobre la estructura vigente.

## Estado actual

- Arquitectura por features con dirección `app -> features -> entities -> shared`, verificada por `pnpm check:boundaries`.
- pnpm es el único gestor, con `packageManager` fijado y un solo lockfile.
- Estilos con Tailwind CSS v4 (clases utilitarias en cada componente); `src/app/styles.css` solo tiene `@theme`, `@layer base` y el reset de `prefers-reduced-motion`. No hay CSS por feature ni hoja monolítica.
- Verifica el árbol real (`find src -maxdepth 2`) antes de asumir rutas: este documento se actualiza, pero el código manda.

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

Añade `typecheck`, `test`, `test:e2e`, `check:boundaries`, `format` y `format:check` a `package.json` si algún día faltan; hoy todos existen.

## Reglas de arquitectura

- `app` (`src/app/`) compone e inicializa; no contiene lógica financiera ni implementaciones extensas de features.
- `features` (`src/features/<nombre>/`) se organiza por capacidad de producto, no por tipo técnico global.
- `entities` (`src/entities/<nombre>/`) contiene contratos, fixtures, fuentes de datos y lógica pura del dominio.
- `shared` (`src/shared/`) solo contiene piezas agnósticas al dominio y reutilizadas de verdad (hoy: `Modal`, `formatMoney`).
- Dirección permitida: `app -> features -> entities -> shared`. `pnpm check:boundaries` la verifica; ejecútalo si tocas imports entre slices.
- No hagas deep imports a otra slice; importa desde su `index.ts` público (usa los alias `@app`, `@features/<nombre>`, `@entities/<nombre>`, `@shared` para cruzar de slice — imports relativos solo dentro de la misma slice).
- Una feature no importa internals de otra feature; una entidad puede importar otra entidad y `shared`, pero nunca una feature o `app`.
- No introduzcas router, store global, framework arquitectónico o repositorios genéricos sin un requisito concreto.
- Mantén `simulateFinancialDecision` (en `entities/simulation`) puro y determinista.
- `formatMoney` vive en `shared/lib/`, no en el motor ni en ninguna feature.
- La UI consume negocio/transacciones mediante `mockFinancialDataSource` (en `entities/business`), no importando fixtures directamente. Los escenarios (`entities/scenario`) son la excepción: no tienen fuente de datos async, se importan como fixture porque no hay un adaptador equivalente a Nessie para ellos.
- Estilos: usa clases utilitarias de Tailwind directamente en el JSX del componente. Reserva `@layer base` en `src/app/styles.css` para resets de elemento (botones, encabezados, foco) que de otra forma habría que repetir en cada componente; no le añadas ahí estilos de una sola feature.

## Contratos que se deben preservar

- Todos los datos son simulados y se presentan como tales.
- La torre tiene 12 niveles y 36 bloques; la física no calcula el riesgo.
- Deben mantenerse teclado, movimiento reducido, fallback sin WebGL y diseño responsive.
- Los recursos de la demo permanecen locales; no agregues llamadas externas sin autorización.
- No cambies las cifras y fórmulas documentadas como parte de una refactorización.
- El estado de flujo (`SimulationFlowState`, en `features/scenario-simulation`) y el estado financiero (`SimulationOutput.status`) son conceptos distintos; ya no comparten el nombre `critical` (el de flujo es `result`).
- No agregues secretos ni credenciales al cliente. Usa `.env.example` solo para nombres de variables sin valores sensibles.
- Las etiquetas de semana de la torre y el subtítulo "Sin afectar tu negocio real" ahora son visibles (corregido en DOCUMENTACION_SESION.md §16; antes estaban ocultos por CSS heredado de la etapa 2D). Si descubres otro comportamiento heredado similar, documéntalo y pregunta antes de "arreglarlo" dentro de un refactor no relacionado.

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
pnpm typecheck
pnpm test
pnpm build
```

Si tocaste imports entre slices:

```sh
pnpm check:boundaries
```

Para cambios de flujo, accesibilidad, layout, WebGL o torre:

```sh
pnpm test:e2e
```

Los E2E esperan un servidor accesible en `http://localhost:5173` salvo que se defina `PLAYWRIGHT_BASE_URL`. `PLAYWRIGHT_EXECUTABLE_PATH` permite reutilizar un Chromium instalado.

No afirmes que una validación pasó si no se ejecutó en la sesión actual. Reporta advertencias y limitaciones, en especial las verificaciones visuales de la física.

## Criterio para nuevas abstracciones

Extrae una abstracción cuando tenga un dueño claro, reduzca acoplamiento real o habilite una segunda implementación conocida. No crees carpetas vacías ni capas especulativas para hacer coincidir el árbol con el plan. El árbol objetivo es una guía de responsabilidades, no una cuota de archivos.
