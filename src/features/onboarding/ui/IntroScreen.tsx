import { motion } from "framer-motion";
import { ArrowRight, Building2, Layers3, ShieldCheck } from "lucide-react";
import type { SimulationOutput } from "../../../entities/simulation";
import { ResilienceTower } from "../../resilience-tower";
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
        <span className="text-[11px] font-semibold tracking-[1.4px] text-[#467dd0] max-[700px]:text-[10px]">
          TU SIGUIENTE DECISIÓN, CON PERSPECTIVA
        </span>
        <h1 className="my-[22px] text-[clamp(36px,3.5vw,52px)] leading-[1.18] font-semibold tracking-[-2.5px] max-[700px]:text-[39px] max-[700px]:tracking-[-1.8px] max-[700px]:my-[18px]">
          Crecer es importante.
          <br />
          <span className="text-[#3776d2]">Mantenerte firme,</span>
          <br />
          también.
        </h1>
        <p className="mb-[10px] text-[17px] leading-[1.6] text-[#526b8a] max-[700px]:text-[15px]">
          Visualiza la resiliencia financiera de tu negocio
        </p>
        <p className="text-[12px] leading-[1.6] text-[#8b98aa] max-[700px]:text-[11px]">
          Decide hoy sin comprometer el mañana de tu negocio.
        </p>
        <div className="mt-[30px] flex items-center gap-[13px] rounded-[11px] border border-[#e1e7ef] bg-white p-[17px] max-[700px]:mt-[22px]">
          <span className="grid h-[45px] w-[43px] place-items-center rounded-[9px] bg-[#eff4fc] text-[#6486b5]">
            <Building2 />
          </span>
          <div className="flex-1">
            <small className="text-[10px] tracking-[1px] text-[#8b9aaf]">
              NEGOCIO SELECCIONADO
            </small>
            <strong className="my-[5px] block text-[13px] font-semibold">
              Distribuidora Luna
            </strong>
            <span className="text-[12px] text-[#8d9bb0]">
              Distribución comercial · 12 empleados
            </span>
          </div>
          <ShieldCheck size={20} className="text-[#7e9cbb]" />
        </div>
        <button
          className="mt-4 inline-flex w-full items-center justify-between gap-3 rounded-lg border border-[#296bd5] bg-[#296bd5] px-[18px] py-[14px] text-[13px] font-medium text-white shadow-[0_4px_9px_#296bd51a] hover:bg-[#205cbd] max-[700px]:min-h-[46px]"
          onClick={onEnter}
        >
          Explorar mi estabilidad <ArrowRight size={19} />
        </button>
        <small className="mt-[15px] flex items-center justify-center gap-[6px] text-[12px] text-[#65778e]">
          <ShieldCheck size={15} /> Datos simulados desde Capital One Nessie
        </small>
      </div>
      <div className="relative h-[620px] overflow-hidden rounded-[24px] border border-[#e4eaf1] bg-[#f0f4f8] max-[700px]:h-[440px] max-[700px]:w-full max-[700px]:rounded-2xl max-[1000px]:h-[580px] [&>.tower-3d]:h-full">
        <div className="absolute top-[28px] right-0 left-0 z-[1] text-center max-[700px]:top-[18px]">
          <span className="inline-flex items-center gap-[6px] rounded-[20px] bg-[#eaf6f0] px-[10px] py-[6px] text-[12px] font-medium whitespace-nowrap text-[#318663]">
            <span className="h-[5px] w-[5px] rounded-full bg-current" />
            Estabilidad que puedes ver
          </span>
        </div>
        <ResilienceTower
          state="stable"
          progress={0}
          output={baseline}
          resetKey={0}
          reduced={reduced}
        />
        <div className="intro-scene-note pointer-events-none absolute right-[25px] bottom-[25px] left-[25px] flex items-center gap-3 rounded-[10px] border border-[#e3eaf1] bg-[#ffffffd9] p-4 text-[12px] text-[#557599] max-[700px]:right-[18px] max-[700px]:bottom-[18px] max-[700px]:left-[18px]">
          <Layers3 size={20} />
          <span>
            Cada semana cuenta.
            <small className="mt-1 block text-[12px] text-[#91a1b5]">
              Descubre qué sostiene tu negocio.
            </small>
          </span>
        </div>
      </div>
    </motion.main>
  );
}
