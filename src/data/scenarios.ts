import type { Scenario } from "./types";
export const scenarios: Scenario[] = [
  {
    id: "contract",
    title: "Aceptar nuevo contrato",
    description: "Crece hoy. Cobra en 60 días.",
    amount: 180000,
    details: [
      ["Inversión inicial", "$180,000"],
      ["Ingreso esperado", "$320,000"],
      ["Fecha de cobro", "60 días"],
      ["Margen estimado", "28%"],
    ],
  },
  {
    id: "equipment",
    title: "Comprar equipo",
    description: "Invierte en una operación más eficiente.",
    amount: 110000,
    details: [
      ["Pago inicial", "$110,000"],
      ["Ahorro mensual", "$18,000"],
      ["Recuperación", "7 meses"],
    ],
  },
  {
    id: "delay",
    title: "Retraso de cliente",
    description: "¿Qué pasa si tu mayor cliente tarda?",
    amount: 160000,
    details: [
      ["Cobro afectado", "$160,000"],
      ["Retraso simulado", "30 días"],
      ["Participación en ingresos", "42%"],
    ],
  },
];
