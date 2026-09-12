import {
  Component,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox } from "@react-three/drei";
import { Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import type { Group } from "three";
import type { AppState } from "../data/types";
import type { SimulationOutput } from "../entities/simulation";
import { formatMoney } from "../shared";
const colors = ["#4389dc", "#58b69b", "#afbac9", "#e48b7d", "#e3bd56"];
const labels = [
  "Liquidez disponible",
  "Cobro esperado",
  "Gasto operativo",
  "Nómina",
  "Cobro retrasado",
];
const values = [24000, 68000, 24000, 72000, 160000];
interface Props {
  state: AppState;
  progress: number;
  output: SimulationOutput;
  resetKey: number;
  reduced: boolean;
  instantResult?: boolean;
  expenseBlocks?: number;
}
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback">
        Vista 3D no disponible. Puedes seguir simulando gastos y consultar las
        métricas.
      </div>
    ) : (
      this.props.children
    );
  }
}
function Block({
  index,
  color,
  collapsed,
  staticFall,
  lost,
  onSelect,
}: {
  index: number;
  color: number;
  collapsed: boolean;
  staticFall: boolean;
  lost: number;
  onSelect: (index: number) => void;
}) {
  const body = useRef<RapierRigidBody>(null);
  const applied = useRef(false);
  const week = Math.floor(index / 3),
    slot = index % 3,
    odd = week % 2 === 1;
  useFrame(() => {
    const rb = body.current;
    if (
      collapsed &&
      !staticFall &&
      !applied.current &&
      rb?.isValid() &&
      rb.isDynamic()
    ) {
      rb.setLinvel(
        { x: 0.8 + week * 0.13, y: 0.05, z: (slot - 1) * 0.7 },
        true,
      );
      rb.setAngvel({ x: 0.4, y: 0.2, z: -0.8 }, true);
      applied.current = true;
    }
  });
  return (
    <RigidBody
      ref={body}
      type={collapsed && !staticFall ? "dynamic" : "fixed"}
      colliders="cuboid"
      position={
        staticFall
          ? [
              ((index % 6) - 2.5) * 0.75,
              0.25 + Math.floor(index / 6) * 0.28,
              ((Math.floor(index / 6) % 3) - 1) * 0.7,
            ]
          : [
              odd ? 0 : (slot - 1) * 0.76,
              0.25 + Math.max(0, week - Math.floor(lost / 3)) * 0.46,
              odd ? (slot - 1) * 0.76 : 0,
            ]
      }
      rotation={
        staticFall
          ? [0, index * 1.1, 0.12 * (index % 2)]
          : [0, odd ? Math.PI / 2 : 0, 0]
      }
      friction={0.65}
      restitution={0.12}
    >
      <RoundedBox
        args={[0.72, 0.44, 2.3]}
        radius={0.055}
        smoothness={2}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect(index);
        }}
      >
        <meshStandardMaterial
          color={colors[color]}
          roughness={0.45}
          metalness={0.06}
        />
      </RoundedBox>
    </RigidBody>
  );
}
function Scene({
  collapsed,
  staticFall,
  lost,
  risk,
  color,
  onSelect,
  reduced,
}: {
  collapsed: boolean;
  staticFall: boolean;
  lost: number;
  risk: boolean;
  color: (index: number) => number;
  onSelect: (index: number) => void;
  reduced: boolean;
}) {
  const group = useRef<Group>(null);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    if (!collapsed) return;
    const timer = setTimeout(() => setSettled(true), 2800);
    return () => clearTimeout(timer);
  }, [collapsed]);
  useFrame(({ clock }) => {
    if (group.current)
      group.current.rotation.z =
        reduced || collapsed
          ? 0
          : Math.sin(clock.elapsedTime * (risk ? 2.3 : 1.2)) *
            (risk ? 0.018 : 0.003);
  });
  return (
    <Physics
      gravity={[0, -9.81, 0]}
      paused={staticFall || settled}
      timeStep={1 / 60}
    >
      <group ref={group}>
        {Array.from({ length: 36 }, (_, index) =>
          index < lost ? null : (
            <Block
              key={index}
              index={index}
              color={color(index)}
              collapsed={collapsed}
              staticFall={staticFall}
              lost={lost}
              onSelect={onSelect}
            />
          ),
        )}
      </group>
      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.18, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[200, 0.3, 200]} />
          <meshStandardMaterial color="#eef2f6" roughness={1} />
        </mesh>
      </RigidBody>
    </Physics>
  );
}
export function ResilienceTower({
  state,
  progress,
  output,
  resetKey,
  reduced,
  instantResult = false,
  expenseBlocks = 0,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [webgl] = useState(() => {
    try {
      const context = document.createElement("canvas").getContext("webgl2");
      if (!context) return false;
      context.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
    } catch {
      return false;
    }
  });
  useEffect(() => setSelected(null), [resetKey, expenseBlocks]);
  const scenarioLoss = output.towerBlockChanges.filter(
    (c) => c.action === "removeLiquidity",
  ).length;
  const removed =
    state === "simulating"
      ? Math.floor(scenarioLoss * Math.min(progress / 0.45, 1))
      : state === "critical"
        ? scenarioLoss
        : 0;
  const lost = Math.min(35, expenseBlocks + removed);
  const collapsed =
    (expenseBlocks > 0 && output.minimumProjectedBalance < 0) ||
    (output.status === "Crítico" &&
      (state === "critical" || (state === "simulating" && progress >= 0.78)));
  const staticFall = collapsed && (reduced || instantResult);
  function color(index: number) {
    const week = Math.floor(index / 3) + 1;
    if (
      output.towerBlockChanges.some((c) => c.action === "delayIncome") &&
      progress > 0.58 &&
      week >= 6 &&
      week <= 8
    )
      return 4;
    if (
      output.towerBlockChanges.some((c) => c.action === "addIncome") &&
      progress > 0.35 &&
      week >= 9
    )
      return 1;
    if ((state === "mitigating" || state === "recovered") && week <= 4)
      return 0;
    return index % 3 === 0 ? 0 : (index + Math.floor(index / 6)) % 4;
  }
  const description = `Torre 3D: ${collapsed ? "colapsada" : output.status.toLowerCase()}. ${lost} bloques retirados. ${output.survivalWeeks} semanas de supervivencia.`;
  return (
    <div className="tower-3d" role="group" aria-label={description}>
      {webgl ? (
        <SceneBoundary key={resetKey}>
          <Suspense
            fallback={
              <div className="scene-fallback">Preparando tu torre 3D…</div>
            }
          >
            <Canvas
              key={`${resetKey}-${expenseBlocks}`}
              shadows
              dpr={[1, 1.5]}
              camera={{ position: [8, 6.3, 9], fov: 36 }}
            >
              <color attach="background" args={["#f0f4f8"]} />
              <fog attach="fog" args={["#f0f4f8", 12, 27]} />
              <ambientLight intensity={1.6} />
              <directionalLight
                position={[5, 10, 4]}
                intensity={2.6}
                color="#fff5e9"
                castShadow
                shadow-mapSize={[1024, 1024]}
                shadow-camera-left={-8}
                shadow-camera-right={8}
                shadow-camera-top={9}
                shadow-camera-bottom={-8}
              />
              <Scene
                collapsed={collapsed}
                staticFall={staticFall}
                lost={lost}
                risk={output.fragilityScore >= 40}
                color={color}
                onSelect={setSelected}
                reduced={reduced}
              />
              <OrbitControls
                makeDefault
                target={[0, 2.3, 0]}
                enablePan={false}
                minDistance={9}
                maxDistance={17}
                minPolarAngle={0.5}
                maxPolarAngle={1.45}
              />
            </Canvas>
          </Suspense>
        </SceneBoundary>
      ) : (
        <div className="scene-fallback">
          Vista 3D no disponible. {description} Puedes seguir simulando gastos y
          consultar las métricas.
        </div>
      )}
      {selected !== null && (
        <div className="block-tooltip">
          <button
            aria-label="Cerrar detalle de bloque"
            onClick={() => setSelected(null)}
          >
            ×
          </button>
          <span>SEMANA {Math.floor(selected / 3) + 1}</span>
          <strong>
            {labels[color(selected)]} · {formatMoney(values[color(selected)])}
          </strong>
          <small>
            Estado:{" "}
            {color(selected) === 4
              ? "Retrasado"
              : color(selected) === 1
                ? "Esperado"
                : "Confirmado"}
          </small>
          <small>Bloque ilustrativo · datos simulados</small>
        </div>
      )}
    </div>
  );
}
