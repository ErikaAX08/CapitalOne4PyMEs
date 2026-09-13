import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line, RoundedBox } from "@react-three/drei";
import { Color } from "three";
import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { BLOCK_HEX_COLORS } from "../model/towerPresentation";
export function TowerBlock({
  index,
  color,
  offset,
  expanded,
  cracked,
  collapsed,
  staticFall,
  lost,
  onSelect,
}: {
  index: number;
  color: number;
  offset: number;
  expanded: boolean;
  cracked: boolean;
  collapsed: boolean;
  staticFall: boolean;
  lost: number;
  onSelect: (index: number) => void;
}) {
  const body = useRef<RapierRigidBody>(null);
  const crackColor = new Color(BLOCK_HEX_COLORS[color]).multiplyScalar(0.32);
  const applied = useRef(false);
  const week = Math.floor(index / 3),
    slot = index % 3,
    odd = week % 2 === 1;
  const centeredPosition: [number, number, number] = [
    odd ? -offset : (slot - 1) * 0.76,
    0.25 + Math.max(0, week - Math.floor(lost / 3)) * 0.46,
    odd ? (slot - 1) * 0.76 : -offset,
  ];
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
          : centeredPosition
      }
      rotation={
        staticFall
          ? [0, index * 1.1, 0.12 * (index % 2)]
          : [0, odd ? Math.PI / 2 : 0, 0]
      }
      friction={0.65}
      restitution={0.12}
    >
      <group scale={[expanded ? 1.16 : 1, 1, 1]}>
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
            color={BLOCK_HEX_COLORS[color]}
            roughness={0.45}
            metalness={0.06}
          />
        </RoundedBox>
        {cracked && (
          <group>
            <Line
              points={[
                [0.36, 0.18, 0.5],
                [0.365, 0.08, 0.3],
                [0.365, 0.01, 0.4],
                [0.365, -0.1, 0.16],
                [0.36, -0.19, 0.23],
              ]}
              color={crackColor}
              lineWidth={2.5}
            />
            <Line
              points={[
                [0.365, 0.01, 0.4],
                [0.365, -0.04, 0.64],
                [0.365, -0.15, 0.75],
              ]}
              color={crackColor}
              lineWidth={1.5}
            />
            <Line
              points={[
                [0.34, 0.225, 0.5],
                [0.15, 0.225, 0.36],
                [0.02, 0.225, 0.48],
                [-0.2, 0.225, 0.3],
                [-0.34, 0.225, 0.4],
              ]}
              color={crackColor}
              lineWidth={2.5}
            />
            <Line
              points={[
                [-0.2, 0.18, 1.155],
                [-0.07, 0.07, 1.155],
                [-0.14, -0.02, 1.155],
                [0.07, -0.18, 1.155],
              ]}
              color={crackColor}
              lineWidth={2.5}
            />
          </group>
        )}
      </group>
    </RigidBody>
  );
}
