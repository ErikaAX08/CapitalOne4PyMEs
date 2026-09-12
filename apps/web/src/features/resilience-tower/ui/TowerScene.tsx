import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Physics, RigidBody } from "@react-three/rapier";
import type { Group } from "three";
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
            <TowerBlock
              key={index}
              index={index}
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
          <meshStandardMaterial color="#eef2f6" roughness={1} />
        </mesh>
      </RigidBody>
    </Physics>
  );
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
}) {
  return (
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
      <PhysicsGroup
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
  );
}
