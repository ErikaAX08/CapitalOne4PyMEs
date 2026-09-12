import type { Scenario } from "../model/types";
export const scenarios: Scenario[] = [
  {
    id: "contract",
    title: "Aceptar proyecto a crédito",
    description: "El cliente paga 20 días después de la fecha acordada.",
    amount: 800000,
    details: [
      ["Valor del proyecto", "$800,000"],
      ["Costos comprometidos", "$560,000"],
      ["Retraso del cobro", "20 días"],
      ["Futuros simulados", "20,000"],
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
