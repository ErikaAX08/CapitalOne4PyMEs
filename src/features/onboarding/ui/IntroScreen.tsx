import { motion } from "framer-motion";
import { ArrowRight, Building2, Layers3, ShieldCheck } from "lucide-react";
import type { SimulationOutput } from "@entities/simulation";
import { ResilienceTower } from "@features/resilience-tower";
import { Card, Badge, Button } from "@shared";
export function IntroScreen({
  onEnter,
  reduced,
  baseline,
}: {
  onEnter: () => void;
  reduced: boolean;
  baseline: SimulationOutput;
}) {
  return (
    <motion.main
      key="intro"
      className="mx-auto grid min-h-[calc(100vh-87px)] max-w-[1440px] grid-cols-2 items-center gap-[7vw] p-[65px_7vw] max-[1000px]:gap-[4vw] max-[1000px]:p-[40px_5vw] max-[700px]:flex max-[700px]:min-h-0 max-[700px]:flex-col max-[700px]:gap-[25px] max-[700px]:p-[35px_22px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -12 }}
    >
      <div className="max-[700px]:w-full">
        <span className="font-title text-[11px] font-semibold tracking-[0.12em] text-brand-blue uppercase max-[700px]:text-[10px]">
          Tu siguiente decisión, con perspectiva
        </span>
        <h1 className="font-title my-[22px] text-[clamp(36px,3.5vw,52px)] leading-[1.18] font-semibold tracking-[-0.06em] max-[700px]:text-[39px] max-[700px]:my-[18px]">
          Crecer es importante.
          <br />
          <span className="text-brand-blue">Mantenerte firme,</span>
          <br />
          también.
        </h1>
        <p className="mb-[10px] text-[17px] leading-[1.6] text-body max-[700px]:text-[15px]">
          Visualiza la resiliencia financiera de tu negocio
        </p>
        <p className="text-[12px] leading-[1.6] text-body-subtle max-[700px]:text-[11px]">
          Decide hoy sin comprometer el mañana de tu negocio.
        </p>
        <Card className="mt-[30px] flex-row items-center gap-[13px] p-[17px] max-[700px]:mt-[22px]">
          <span className="grid h-[45px] w-[43px] place-items-center bg-brand-blue-soft text-brand-blue">
            <Building2 />
          </span>
          <div className="flex-1">
            <small className="font-title text-[10px] tracking-[0.08em] text-body-subtle uppercase">
              Negocio seleccionado
            </small>
            <strong className="my-[5px] block text-[13px] font-semibold">
              Distribuidora Luna
            </strong>
            <span className="text-[12px] text-body-subtle">
              Distribución comercial · 12 empleados
            </span>
          </div>
          <ShieldCheck size={20} className="text-brand-blue" />
        </Card>
        <Button
          variant="primary"
          className="mt-4 w-full justify-between gap-3 max-[700px]:min-h-[46px]"
          onClick={onEnter}
        >
          Explorar mi estabilidad <ArrowRight size={19} />
        </Button>
        <small className="mt-[15px] flex items-center justify-center gap-[6px] text-[12px] text-body-muted">
          <ShieldCheck size={15} /> Datos simulados desde Capital One Nessie
        </small>
      </div>
      <div className="relative h-[620px] overflow-hidden border border-hairline bg-surface-subtle max-[700px]:h-[440px] max-[700px]:w-full max-[1000px]:h-[580px] [&>.tower-3d]:h-full">
        <div className="absolute top-[28px] right-0 left-0 z-[1] text-center max-[700px]:top-[18px]">
          <Badge
            variant="success"
            className="h-auto gap-[6px] px-[10px] py-[6px] text-[12px] font-medium"
          >
            <span className="h-[5px] w-[5px] rounded-full bg-current" />
            Estabilidad que puedes ver
          </Badge>
        </div>
        <ResilienceTower
          state="stable"
          progress={0}
          output={baseline}
          resetKey={0}
          reduced={reduced}
        />
        <div className="intro-scene-note pointer-events-none absolute right-[25px] bottom-[25px] left-[25px] flex items-center gap-3 border border-hairline bg-canvas/85 p-4 text-[12px] text-body max-[700px]:right-[18px] max-[700px]:bottom-[18px] max-[700px]:left-[18px]">
          <Layers3 size={20} />
          <span>
            Cada semana cuenta.
            <small className="mt-1 block text-[12px] text-body-subtle">
              Descubre qué sostiene tu negocio.
            </small>
          </span>
        </div>
      </div>
    </motion.main>
  );
}
