import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Physics, RigidBody } from "@react-three/rapier";
import type { Group, Vector3 } from "three";
import { getBlockStructure } from "../model/towerPresentation";
import { TowerBlock } from "./TowerBlock";
function PhysicsGroup({
  collapsed,
  staticFall,
  lost,
  risk,
  blockColors,
  blockOffsets,
  expandedBlocks,
  crackedBlocks,
  onSelect,
  reduced,
  onReady,
}: {
  collapsed: boolean;
  staticFall: boolean;
  lost: number;
  risk: boolean;
  blockColors: number[];
  blockOffsets: number[];
  expandedBlocks: boolean[];
  crackedBlocks: boolean[];
  onSelect: (index: number) => void;
  reduced: boolean;
  onReady: () => void;
}) {
  const group = useRef<Group>(null);
  const [settled, setSettled] = useState(false);
  // Solo llega aqui cuando <Physics> dejo de suspender (WASM de Rapier listo).
  useEffect(onReady, [onReady]);
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
            <TowerBlock
              key={index}
              index={index}
              label={getBlockStructure(index).label}
              color={blockColors[index]}
              offset={blockOffsets[index]}
              expanded={expandedBlocks[index]}
              cracked={crackedBlocks[index]}
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
          <meshStandardMaterial color="#f2f2f2" roughness={1} />
        </mesh>
      </RigidBody>
    </Physics>
  );
}
// El contexto WebGL es un recurso escaso (el navegador solo mantiene unos pocos
// vivos). Si el canvas lo pierde, evitamos que el navegador lo dé por perdido
// definitivamente y forzamos un re-render cuando se restaura.
function ContextGuard() {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (event: Event) => {
      event.preventDefault();
    };
    const onRestored = () => {
      invalidate();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [gl, invalidate]);
  return null;
}
// El Canvas ya no se remonta al reiniciar, asi que devolvemos la camara a su
// posicion inicial de forma explicita.
function CameraReset({ resetKey }: { resetKey: number }) {
  const { camera, controls, invalidate } = useThree();
  useEffect(() => {
    camera.position.set(8, 6.3, 9);
    const orbit = controls as { target?: Vector3; update?: () => void } | null;
    orbit?.target?.set(0, 2.3, 0);
    orbit?.update?.();
    invalidate();
  }, [resetKey, camera, controls, invalidate]);
  return null;
}
export function TowerScene({
  resetKey,
  expenseBlocks,
  collapsed,
  staticFall,
  lost,
  risk,
  blockColors,
  blockOffsets,
  expandedBlocks,
  crackedBlocks,
  onSelect,
  reduced,
  onReady,
}: {
  resetKey: number;
  expenseBlocks: number;
  collapsed: boolean;
  staticFall: boolean;
  lost: number;
  risk: boolean;
  blockColors: number[];
  blockOffsets: number[];
  expandedBlocks: boolean[];
  crackedBlocks: boolean[];
  onSelect: (index: number) => void;
  reduced: boolean;
  onReady: () => void;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [8, 6.3, 9], fov: 36 }}
      gl={{ powerPreference: "high-performance", antialias: true }}
    >
      <ContextGuard />
      <CameraReset resetKey={resetKey} />
      <color attach="background" args={["#fafafa"]} />
      <fog attach="fog" args={["#fafafa", 12, 27]} />
      <ambientLight intensity={1.6} />
      <directionalLight
        position={[5, 10, 4]}
        intensity={2.6}
        color="#ffffff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={9}
        shadow-camera-bottom={-8}
      />
      {/* El Suspense va DENTRO del Canvas: <Physics> suspende mientras carga el
          WASM de Rapier, y si el limite estuviera fuera React desmontaria el
          Canvas. R3F responde a ese desmontaje con un gl.forceContextLoss()
          diferido 500 ms, que acabaria matando el contexto ya remontado.
          Solo el mundo de fisica se recrea al reiniciar o cambiar gastos: el
          contexto WebGL del Canvas sigue vivo toda la sesion. */}
      <Suspense fallback={null}>
        <PhysicsGroup
          key={`${resetKey}-${expenseBlocks}`}
          collapsed={collapsed}
          staticFall={staticFall}
          lost={lost}
          risk={risk}
          blockColors={blockColors}
          blockOffsets={blockOffsets}
          expandedBlocks={expandedBlocks}
          crackedBlocks={crackedBlocks}
          onSelect={onSelect}
          reduced={reduced}
          onReady={onReady}
        />
      </Suspense>
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
  );
}
