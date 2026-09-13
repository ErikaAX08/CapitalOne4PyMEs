import { motion } from "framer-motion";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { Card, Button } from "@shared";
export function IntroScreen({ onEnter }: { onEnter: () => void }) {
  return (
    <motion.main
      key="intro"
      className="relative mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-[1200px] grid-cols-2 items-center gap-[7vw] overflow-hidden p-[80px_24px] max-[1000px]:gap-[4vw] max-[1000px]:p-[48px_24px] max-[700px]:flex max-[700px]:min-h-0 max-[700px]:flex-col max-[700px]:gap-6 max-[700px]:p-[40px_16px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -12 }}
    >
      <div className="max-[700px]:w-full">
        <span className="font-mono text-xs font-medium tracking-normal text-body-muted uppercase max-[700px]:text-[11px]">
          Tu siguiente decisión, con perspectiva
        </span>
        <h1 className="font-title my-6 text-[clamp(3rem,4.5vw,4.5rem)] leading-none font-semibold tracking-[-0.055em] max-[700px]:my-5 max-[700px]:text-[2.75rem]">
          Crecer es importante.
          <br />
          <span className="text-brand-blue">Mantenerte firme,</span>
          <br />
          también.
        </h1>
        <p className="mb-3 text-lg leading-normal text-body max-[700px]:text-base">
          Visualiza la resiliencia financiera de tu negocio
        </p>
        <p className="text-sm leading-normal text-body-muted max-[700px]:text-sm">
          Decide hoy sin comprometer el mañana de tu negocio.
        </p>
        <Card className="mt-[30px] flex-row items-center gap-[13px] p-[17px] max-[700px]:mt-[22px]">
          <span className="grid h-[45px] w-[43px] place-items-center rounded-lg bg-surface-muted text-ink">
            <Building2 />
          </span>
          <div className="flex-1">
            <small className="font-mono text-[11px] tracking-normal text-body-muted uppercase">
              Negocio seleccionado
            </small>
            <strong className="my-[5px] block text-[13px] font-semibold">
              Distribuidora Luna
            </strong>
            <span className="text-[12px] text-body-subtle">
              Distribución comercial · 12 empleados
            </span>
          </div>
          <ShieldCheck size={20} className="text-ink" />
        </Card>
        <Button
          variant="primary"
          className="mt-4 w-full justify-between gap-3 px-5 max-[700px]:min-h-[46px]"
          onClick={onEnter}
        >
          Explorar mi estabilidad <ArrowRight size={19} />
        </Button>
        <small className="mt-[15px] flex items-center justify-center gap-[6px] text-[12px] text-body-muted">
          <ShieldCheck size={15} /> Datos simulados desde Capital One Nessie
        </small>
      </div>
      <div className="relative h-[620px] overflow-hidden border border-hairline bg-brand-blue shadow-geist-small max-[700px]:h-[440px] max-[700px]:w-full max-[1000px]:h-[580px]">
        <img
          src="/capital-one-business-owner.jpg"
          alt="Emprendedora sosteniendo documentos y una calculadora"
          width={1200}
          height={1800}
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover object-[center_42%]"
        />
        <div className="absolute right-0 bottom-0 left-0 z-[1] border-t border-hairline bg-surface-soft p-[22px_24px] text-ink max-[700px]:p-[18px_20px]">
          <span className="flex items-start gap-3">
            <ShieldCheck size={20} className="mt-0.5 shrink-0" />
            <span>
              <strong className="block text-sm font-medium">
                Tu negocio merece perspectiva.
              </strong>
              <small className="mt-1 block text-[12px]">
                Explora decisiones antes de llevarlas a la realidad.
              </small>
            </span>
          </span>
        </div>
      </div>
    </motion.main>
  );
}
