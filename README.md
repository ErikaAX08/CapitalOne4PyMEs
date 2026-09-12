# Resilia · Torre financiera 3D

Dashboard light para explorar la liquidez de Distribuidora Luna antes de tomar una decisión. Usa React, TypeScript, Vite, Tailwind, Framer Motion e Inter local. La torre usa Three.js, React Three Fiber, Drei y física Rapier. No necesita backend ni servicios externos.

## Ejecutar

Requiere Node.js 20.19+ o 22.12+.

```sh
npm install
npm run dev
```

También se admite `pnpm install` y `pnpm dev`. Abrir la URL que imprime Vite. `npm run build` genera la versión estática en `dist/`.

## Simular gastos

1. Entrar al dashboard y elegir tipo y monto del gasto, o usar los accesos rápidos.
2. Cada gasto retira al menos un bloque; montos mayores retiran más soporte (un bloque por cada $24,000, redondeando hacia arriba). La equivalencia es ilustrativa, no contable.
3. El motor actualiza saldo, fragilidad, supervivencia y proyecciones. La torre pierde altura gradualmente y colapsa si el saldo mínimo proyectado es negativo.
4. «Deshacer último gasto» revierte la última entrada. «Reiniciar simulación» limpia todos los gastos y escenarios.

Los escenarios de contrato, compra de equipo y retraso de cliente siguen disponibles. El contrato conserva su secuencia de ocho segundos, resultado y mitigación con anticipo. Los gastos adicionales se incluyen en el mismo motor; no son cargos reales.

## Arquitectura

- `src/App.tsx`: estado central del dashboard, escenarios y gastos acumulados.
- `src/components/ResilienceTower.tsx`: torre 3D con 36 bloques, rotación táctil, zoom limitado y colapso con física. Incluye una alternativa textual cuando WebGL no está disponible.
- `src/components/ExpensePanel.tsx`: captura, accesos rápidos, historial y deshacer gastos.
- `src/components/Modal.tsx`: panel accesible de escenarios y explicación técnica.
- `src/lib/mockFinancialEngine.ts`: resultados deterministas y cálculo central del impacto de gastos.
- `src/data/`: negocio, 40 transacciones, escenarios, proyecciones e interfaces tipadas.

`FinancialDataSource` y `mockDataSource` delimitan el futuro adaptador para Capital One Nessie. Los comentarios del motor marcan la futura integración TDA y simulación de caja real. Hoy todo es mock; no se ejecuta homología persistente ni se afirma poder predictivo científico.

## Verificar

```sh
npm test
npx playwright install chromium
npm run test:e2e
```

Las pruebas de navegador requieren Vite activo. Cubren escritorio y teléfono, registro de gastos, colapso, deshacer, reinicio, contrato y anticipo, escenarios alternativos y funcionamiento sin WebGL. Permiten `PLAYWRIGHT_BASE_URL` y `PLAYWRIGHT_EXECUTABLE_PATH` para reutilizar otro puerto o un navegador instalado.

`prefers-reduced-motion` y «Ver resultado» permiten evitar las animaciones. Inter y todos los recursos se sirven localmente. Los overrides de Motion se conservan en ambos gestores para una instalación reproducible.

## Documentación de la sesión

Consulta [DOCUMENTACION_SESION.md](DOCUMENTACION_SESION.md) para conocer la evolución del proyecto, arquitectura, módulos, reglas mock, torre 3D, validaciones e integraciones pendientes.
