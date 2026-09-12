# Plan de migración a arquitectura por features y pnpm

## 1. Objetivo

Transformar Resilia de una SPA organizada por tipo técnico y orquestada casi por completo desde `src/App.tsx` a una aplicación organizada por capacidades de producto. La migración debe conservar el comportamiento, la narrativa, la accesibilidad y los resultados deterministas documentados en `DOCUMENTACION_SESION.md`.

El resultado esperado es:

- un único gestor de paquetes: pnpm;
- features con API pública, estado, UI y pruebas cercanas a su responsabilidad;
- dominio financiero independiente de React y de la escena 3D;
- composición de aplicación delgada;
- dependencias dirigidas y comprobables;
- pruebas que permitan refactorizar sin alterar la demo.

Este documento es un plan. La estructura actual todavía no ha sido migrada.

## 2. Diagnóstico del estado actual

La base es pequeña y funcional, pero tiene varios puntos de fricción:

- `src/App.tsx` tiene 778 líneas y combina composición, estado, temporizadores, navegación del flujo, cálculos derivados, scroll imperativo y casi toda la UI del dashboard.
- `src/styles.css` tiene 2,077 líneas y mezcla estilos globales, layout y componentes de todas las capacidades.
- `src/data/types.ts` reúne contratos de negocio, simulación y estado de interfaz.
- La UI importa fixtures directamente aunque ya existe `FinancialDataSource`.
- `money()` vive en el motor financiero, creando una dependencia de presentación hacia lógica de dominio.
- `ResilienceTower.tsx` combina fallback, adaptación visual, escena, cuerpos físicos e interacción.
- El estado `critical` describe “resultado visible”, pero su nombre parece describir el riesgo financiero; los escenarios no críticos también llegan a ese estado.
- Las pruebas unitarias están junto al motor, pero el script usa un glob por carpeta; no escalará bien a features anidadas.
- Conviven `package-lock.json`, `pnpm-lock.yaml` y documentación con comandos npm/pnpm. El `node_modules` actual muestra rastros de instalaciones mezcladas.
- No hay reglas escritas de dependencias entre módulos ni una guía operativa para agentes.

Fortalezas que deben conservarse:

- TypeScript estricto y motor determinista.
- Pruebas del motor y ocho recorridos E2E en escritorio/móvil.
- fallback sin WebGL, movimiento reducido y semántica accesible.
- recursos locales y ausencia de llamadas de negocio externas.
- contrato `FinancialDataSource` como seam para una fuente real futura.

## 3. Arquitectura objetivo

Se propone una variante pragmática de arquitectura por features. No se añadirá un framework de estado ni un router mientras la aplicación siga siendo una sola experiencia.

```text
src/
├── app/
│   ├── App.tsx
│   ├── main.tsx
│   └── styles/
│       ├── globals.css
│       └── tokens.css
├── features/
│   ├── onboarding/
│   │   ├── ui/IntroScreen.tsx
│   │   └── index.ts
│   ├── financial-overview/
│   │   ├── ui/FinancialOverview.tsx
│   │   ├── ui/FinancialMetrics.tsx
│   │   └── index.ts
│   ├── expense-simulation/
│   │   ├── model/useExpenses.ts
│   │   ├── ui/ExpensePanel.tsx
│   │   ├── ui/ExpenseFeedback.tsx
│   │   └── index.ts
│   ├── scenario-simulation/
│   │   ├── model/simulationFlow.ts
│   │   ├── model/useSimulationFlow.ts
│   │   ├── ui/ScenarioList.tsx
│   │   ├── ui/ScenarioDialog.tsx
│   │   ├── ui/SimulationProgress.tsx
│   │   ├── ui/SimulationResult.tsx
│   │   └── index.ts
│   ├── resilience-tower/
│   │   ├── model/towerPresentation.ts
│   │   ├── ui/ResilienceTower.tsx
│   │   ├── ui/TowerScene.tsx
│   │   ├── ui/TowerBlock.tsx
│   │   ├── ui/TowerFallback.tsx
│   │   └── index.ts
│   └── technical-explanation/
│       ├── ui/TechnicalExplanationDialog.tsx
│       └── index.ts
├── entities/
│   ├── business/
│   │   ├── model/types.ts
│   │   ├── api/financialDataSource.ts
│   │   ├── api/mockFinancialDataSource.ts
│   │   ├── fixtures/business.ts
│   │   ├── fixtures/transactions.ts
│   │   └── index.ts
│   ├── scenario/
│   │   ├── model/types.ts
│   │   ├── fixtures/scenarios.ts
│   │   └── index.ts
│   └── simulation/
│       ├── model/types.ts
│       ├── model/simulateFinancialDecision.ts
│       ├── fixtures/projections.ts
│       ├── model/simulateFinancialDecision.test.ts
│       └── index.ts
└── shared/
    ├── lib/formatMoney.ts
    ├── ui/Modal.tsx
    └── index.ts
```

Los nombres pueden ajustarse durante la implementación si el código revela una frontera mejor, pero deben conservarse las responsabilidades y la dirección de dependencias.

### Reglas de dependencia

```text
app -> features -> entities -> shared
```

- `shared` no conoce entidades ni features.
- `entities` contiene tipos, lógica y acceso a datos del dominio; no importa desde `features` ni `app`.
- Una feature puede usar entidades y `shared`, pero no importar internals de otra feature.
- `app` compone features y administra solamente estado verdaderamente global.
- Cada slice expone un `index.ts`; consumidores externos usan esa API pública.
- Fixtures no se importan desde componentes. La composición inyecta una fuente de datos.
- El motor financiero sigue siendo una función pura, sin React, DOM, Three.js ni formato de moneda.
- Las reglas visuales de bloques y colapso viven en `towerPresentation.ts`, separadas de la física.

### Decisiones deliberadas

- No crear `pages/` mientras solo haya una pantalla navegable; agregarla cuando exista routing real.
- No introducir Redux/Zustand por anticipado. Un reducer y hooks de feature son suficientes para este flujo local.
- No convertir esto en monorepo. `pnpm-workspace.yaml` se conserva únicamente por `allowBuilds` y overrides hasta decidir si esas opciones pasan a otra configuración.
- No crear una carpeta genérica `utils`. Las utilidades compartidas deben tener un propósito explícito.
- No añadir abstracciones de repositorio adicionales hasta conectar una segunda fuente de datos real.

## 4. Plan por fases

Cada fase debe cerrar con `pnpm lint` si ya existe, `pnpm typecheck`, `pnpm test`, `pnpm build` y los E2E relevantes. Los commits deben ser pequeños y no mezclar cambios funcionales con movimientos masivos.

### Fase 0 — Congelar comportamiento y establecer línea base

1. Ejecutar con la instalación vigente:
   - `pnpm test`
   - `pnpm build`
   - `pnpm test:e2e`
2. Registrar cualquier fallo actual antes de refactorizar.
3. Añadir pruebas de caracterización para:
   - transición completa del estado de simulación;
   - contrato, mitigación y gastos combinados;
   - los cinco resultados base documentados;
   - fallback sin WebGL y movimiento reducido.
4. Evitar snapshots grandes; probar salidas del dominio y comportamiento observable.

**Salida:** línea base verde y diferencias conocidas documentadas.

### Fase 1 — Estandarizar pnpm y herramientas

1. Fijar en `package.json` el campo `packageManager` a la versión acordada de pnpm y declarar `engines.node`/`engines.pnpm`.
2. Convertir los comandos y ejemplos de README y documentación a pnpm exclusivamente.
3. Eliminar `package-lock.json` del repositorio.
4. Retirar `node_modules`, reinstalar con `pnpm install --frozen-lockfile` y comprobar que no se regenere un lockfile de npm.
5. Cambiar `test:e2e` a `playwright test`; pnpm resuelve el binario local sin apuntar dentro de `node_modules`.
6. Añadir scripts explícitos:
   - `typecheck`: `tsc -b`
   - `test`: patrón recursivo o runner que descubra pruebas dentro de slices;
   - `test:e2e`: `playwright test`;
   - `format` y `format:check` con Prettier.
7. Evaluar ESLint durante esta fase y añadirlo solo con reglas acordadas; no hacer pasar Prettier por linter.

**Criterio de aceptación:** `pnpm install --frozen-lockfile` funciona desde cero, solo `pnpm-lock.yaml` es versionable y todos los scripts usan binarios locales.

### Fase 2 — Extraer el dominio sin cambiar la UI

1. Crear `entities/business`, `entities/scenario` y `entities/simulation`.
2. Dividir `src/data/types.ts` por dueño del concepto.
3. Mover fixtures junto a su entidad.
4. Mover `money()` a `shared/lib/formatMoney.ts`.
5. Renombrar el motor a `simulateFinancialDecision.ts` y conservar su API/resultado mientras se mueven archivos.
6. Hacer que `mockFinancialDataSource` sea el único punto que entrega negocio y transacciones.
7. Añadir una función de carga o hook en la composición con estados `loading`, `ready`, `empty` y `error`, aunque el mock resuelva inmediatamente.

**Criterio de aceptación:** ninguna UI importa fixtures; el dominio no depende de UI; las pruebas del motor conservan exactamente los valores documentados.

### Fase 3 — Modelar el flujo de simulación

1. Sustituir los siete `useState` relacionados por un reducer/hook de `scenario-simulation`.
2. Renombrar el estado de UI `critical` a `result` para separarlo del riesgo financiero `Crítico`.
3. Definir eventos explícitos, por ejemplo:
   - `ENTER_DASHBOARD`
   - `SELECT_SCENARIO`
   - `CLOSE_SCENARIO`
   - `START_SIMULATION`
   - `TICK`
   - `SHOW_RESULT`
   - `START_MITIGATION`
   - `FINISH_MITIGATION`
   - `RESET`
4. Encapsular temporizadores y su limpieza en `useSimulationFlow`.
5. Mantener el scroll móvil como efecto de feature, no como responsabilidad del dominio.
6. Probar reducer y hook sin depender de ocho segundos reales; usar reloj controlado.

**Criterio de aceptación:** las transiciones inválidas no son representables o se ignoran explícitamente, los timers se limpian y `App.tsx` no conoce detalles temporales.

### Fase 4 — Extraer features de UI

Orden recomendado para minimizar conflictos:

1. `technical-explanation` y `onboarding`.
2. `financial-overview`.
3. `expense-simulation`.
4. `scenario-simulation`.
5. `resilience-tower`.

Para cada extracción:

- mover primero el JSX sin cambios visuales;
- definir props pequeñas en términos del dominio;
- evitar pasar el objeto completo de estado si basta un valor derivado;
- crear API pública en `index.ts`;
- mover o agregar pruebas antes de continuar con la siguiente feature.

`App.tsx` debe terminar como raíz de composición: carga datos, conecta el flujo y distribuye salidas a features. Objetivo orientativo: menos de 150–200 líneas, sin imponer una métrica artificial a componentes que ya tengan una sola responsabilidad.

**Criterio de aceptación:** cada capacidad puede localizarse por nombre de producto y ninguna feature alcanza internals de otra.

### Fase 5 — Separar presentación y runtime 3D

1. Extraer la traducción `SimulationOutput -> TowerViewModel` a una función pura.
2. Separar `TowerBlock`, `TowerScene`, fallback y boundary de errores.
3. Mantener en el runtime 3D únicamente cuerpos, cámara, luces y animación.
4. Probar el view model sin WebGL.
5. Cargar la escena 3D de forma diferida si la medición confirma una mejora útil; mantener un fallback accesible durante la carga.
6. Verificar que la clave de reinicio, los 36 bloques, la pausa física y los estados de colapso sigan funcionando.

**Criterio de aceptación:** cambios en reglas financieras o colores no requieren editar código de Rapier y las pruebas de presentación no levantan Canvas.

### Fase 6 — Modularizar estilos de forma incremental

1. Extraer tokens (color, tipografía, espacio, radios, sombras y breakpoints) a `app/styles/tokens.css`.
2. Dejar reset y estilos realmente globales en `globals.css`.
3. Colocar estilos específicos junto a cada feature. CSS Modules es la opción preferida para código nuevo; los selectores existentes pueden migrarse por feature para evitar un cambio masivo.
4. Eliminar reglas residuales de la etapa SVG solo después de demostrar que no tienen consumidores.
5. Mantener `prefers-reduced-motion`, focus visible, breakpoints y ausencia de overflow horizontal.

**Criterio de aceptación:** no existe una hoja monolítica que mezcle todas las features y las vistas desktop/mobile conservan paridad visual aceptada.

### Fase 7 — Blindar fronteras y documentación

1. Configurar aliases (`@app`, `@features`, `@entities`, `@shared`) en TypeScript y Vite si mejoran legibilidad.
2. Añadir una comprobación de imports para impedir dependencias inversas y deep imports entre slices.
3. Actualizar `DOCUMENTACION_SESION.md` para describir la arquitectura implementada, no este plan.
4. Actualizar README con comandos pnpm, estructura y límites reales.
5. Mantener `AGENTS.md` sincronizado con scripts y reglas.

**Criterio de aceptación:** CI o el comando de validación local detecta violaciones de capas y la documentación coincide con el árbol real.

## 5. Estrategia de pruebas

La pirámide recomendada para este proyecto es:

- **Dominio:** pruebas rápidas del motor, validaciones, fixtures y view models.
- **Features:** reducer/hook del flujo, formulario de gastos, escenario y mitigación.
- **E2E:** conservar pocos recorridos de alto valor en desktop/mobile y sin WebGL.
- **Visual/manual:** revisar torre y física; los E2E no pueden certificar cada colisión.

Casos que son contrato de producto y no deben cambiar accidentalmente:

- base: fragilidad 31, supervivencia 14, buffer $24,000;
- contrato: 78, 7, $96,000 y saldo mínimo −$96,000;
- anticipo: 43, 12, $18,000 y saldo mínimo $32,000;
- ejemplo de gastos acumulados de $191,000 descrito en la documentación;
- funcionamiento por teclado, movimiento reducido y fallback sin WebGL;
- cero solicitudes externas durante el recorrido principal.

## 6. Riesgos y mitigaciones

| Riesgo                                     | Mitigación                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| Cambiar comportamiento al partir `App.tsx` | Pruebas de caracterización y extracciones mecánicas antes de rediseñar estado. |
| Ciclos entre features                      | Dirección de dependencias y APIs públicas por slice.                           |
| “Shared” convertido en cajón de sastre     | Solo promover algo cuando sea estable y usado por más de una slice.            |
| Duplicar estado derivado                   | Guardar eventos/entradas; derivar métricas con selectores o `useMemo`.         |
| Regresiones 3D difíciles de automatizar    | View model puro + E2E de presencia/estado + revisión visual enfocada.          |
| Migración CSS demasiado amplia             | Mover una feature por vez y conservar selectores durante la primera pasada.    |
| Instalación no reproducible                | Un solo lockfile, `packageManager`, `--frozen-lockfile` y Node/pnpm fijados.   |
| Sobrearquitectura para una demo            | No router, store global ni monorepo hasta que haya un requisito real.          |

## 7. Secuencia de entregas sugerida

1. **PR 1:** línea base, pnpm único, scripts y documentación operativa.
2. **PR 2:** entidades, motor, formato de moneda y fuente mock.
3. **PR 3:** reducer/hook del flujo de simulación con pruebas.
4. **PR 4:** onboarding, overview y gastos.
5. **PR 5:** escenarios, resultados y explicación técnica.
6. **PR 6:** torre 3D, adaptador de presentación y carga diferida medida.
7. **PR 7:** estilos por feature, reglas de imports y cierre documental.

Cada PR debe ser desplegable y no debe mezclar correcciones funcionales no relacionadas. Si se detecta un bug durante la migración, se documenta y se corrige en un commit separado con una prueba que lo reproduzca.

## 8. Definición de terminado

La migración se considera completa cuando:

- pnpm es el único gestor documentado y versionado;
- una instalación limpia y todas las verificaciones pasan;
- `App.tsx` es composición, no implementación de features;
- el motor y los modelos no dependen de React ni de presentación;
- fixtures solo entran por la fuente de datos mock;
- features exponen API pública y respetan la dirección de dependencias;
- el flujo está modelado y probado con eventos explícitos;
- estilos globales contienen solo fundamentos compartidos;
- se mantienen resultados financieros, accesibilidad, responsive y fallback;
- README, `DOCUMENTACION_SESION.md` y `AGENTS.md` describen el estado final real.
