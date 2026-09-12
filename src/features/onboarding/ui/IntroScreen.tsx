import { motion } from "framer-motion";
import { ArrowRight, Building2, Layers3, ShieldCheck } from "lucide-react";
import type { SimulationOutput } from "../../../entities/simulation";
import { ResilienceTower } from "../../../components/ResilienceTower";
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
      className="intro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -12 }}
    >
      <div className="intro-copy">
        <span className="eyebrow blue">
          TU SIGUIENTE DECISIÓN, CON PERSPECTIVA
        </span>
        <h1>
          Crecer es importante.
          <br />
          <span>Mantenerte firme,</span>
          <br />
          también.
        </h1>
        <p className="intro-subtitle">
          Visualiza la resiliencia financiera de tu negocio
        </p>
        <p>Decide hoy sin comprometer el mañana de tu negocio.</p>
        <div className="business-picker">
          <span className="business-icon">
            <Building2 />
          </span>
          <div>
            <small>NEGOCIO SELECCIONADO</small>
            <strong>Distribuidora Luna</strong>
            <span>Distribución comercial · 12 empleados</span>
          </div>
          <ShieldCheck size={20} />
        </div>
        <button className="primary intro-button" onClick={onEnter}>
          Explorar mi estabilidad <ArrowRight size={19} />
        </button>
        <small className="source-label">
          <ShieldCheck size={15} /> Datos simulados desde Capital One Nessie
        </small>
      </div>
      <div className="intro-scene">
        <div className="intro-scene-title">
          <span className="status stable">
            <span />
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
        <div className="intro-scene-note">
          <Layers3 size={20} />
          <span>
            Cada semana cuenta.
            <small>Descubre qué sostiene tu negocio.</small>
          </span>
        </div>
      </div>
    </motion.main>
  );
}
