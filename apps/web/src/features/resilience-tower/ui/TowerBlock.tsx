import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line, RoundedBox } from "@react-three/drei";
import { CanvasTexture, Color, LinearFilter, SRGBColorSpace } from "three";
import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { BLOCK_HEX_COLORS } from "../model/towerPresentation";
export function TowerBlock({
  index,
  label,
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
  label: string;
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
  const faceColor = color === 2 ? "#26354a" : "#ffffff";
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
        <BlockFaceLabel label={label} color={faceColor} side={1} />
        <BlockFaceLabel label={label} color={faceColor} side={-1} />
        {[1, -1].map((side) => (
          <BlockFaceIcon
            key={`icon-${side}`}
            label={label}
            color={faceColor}
            side={side as 1 | -1}
          />
        ))}
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

const labelTextures = new Map<string, CanvasTexture>();

function getLabelTexture(label: string, color: string) {
  const key = `${label}-${color}`;
  const existing = labelTextures.get(key);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la etiqueta del bloque.");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = color;
  context.font = `600 ${label.length > 17 ? 31 : 36}px Inter, Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, 256, 50, 470);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  labelTextures.set(key, texture);
  return texture;
}

function BlockFaceLabel({
  label,
  color,
  side,
}: {
  label: string;
  color: string;
  side: 1 | -1;
}) {
  const texture = useMemo(() => getLabelTexture(label, color), [label, color]);
  return (
    <mesh
      position={[side * 0.366, 0, 0]}
      rotation={[0, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
    >
      <planeGeometry args={[1.9, 0.3]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

type IconPath = [number, number][];

const ICON_PATHS: Record<string, IconPath[]> = {
  Efectivo: [
    [
      [0, 0.18],
      [0, -0.18],
    ],
    [
      [0.11, 0.12],
      [0.05, 0.17],
      [-0.08, 0.13],
      [-0.09, 0.03],
      [0.08, -0.03],
      [0.09, -0.13],
      [0.03, -0.17],
      [-0.11, -0.12],
    ],
  ],
  "Cuentas por cobrar": [
    [
      [-0.17, 0.1],
      [0.05, 0.1],
      [0.05, -0.11],
    ],
    [
      [-0.02, -0.04],
      [0.05, -0.12],
      [0.13, -0.04],
    ],
  ],
  "Crédito disponible": [
    [
      [-0.18, 0.13],
      [0.18, 0.13],
      [0.18, -0.13],
      [-0.18, -0.13],
      [-0.18, 0.13],
    ],
    [
      [-0.16, 0.04],
      [0.16, 0.04],
    ],
  ],
  Reservas: [
    [
      [0, 0.18],
      [0.15, 0.11],
      [0.12, -0.08],
      [0, -0.18],
      [-0.12, -0.08],
      [-0.15, 0.11],
      [0, 0.18],
    ],
  ],
  Nómina: [
    [
      [-0.05, 0.13],
      [0, 0.18],
      [0.05, 0.13],
      [0, 0.08],
      [-0.05, 0.13],
    ],
    [
      [-0.16, -0.16],
      [-0.1, 0],
      [0.1, 0],
      [0.16, -0.16],
    ],
  ],
  Proveedores: [
    [
      [-0.19, 0.08],
      [0.05, 0.08],
      [0.12, 0],
      [0.19, 0],
      [0.19, -0.1],
      [-0.19, -0.1],
      [-0.19, 0.08],
    ],
    [
      [0.08, 0.08],
      [0.08, 0],
      [0.18, 0],
    ],
  ],
  Inventario: [
    [
      [0, 0.18],
      [0.17, 0.08],
      [0.17, -0.12],
      [0, -0.2],
      [-0.17, -0.12],
      [-0.17, 0.08],
      [0, 0.18],
    ],
    [
      [-0.17, 0.08],
      [0, -0.01],
      [0.17, 0.08],
    ],
  ],
  Capacidad: [
    [
      [-0.18, -0.12],
      [-0.13, 0.05],
      [0, 0.14],
      [0.13, 0.05],
      [0.18, -0.12],
    ],
    [
      [0, -0.03],
      [0.1, 0.08],
    ],
  ],
  Contratos: [
    [
      [-0.13, 0.18],
      [0.08, 0.18],
      [0.15, 0.11],
      [0.15, -0.18],
      [-0.13, -0.18],
      [-0.13, 0.18],
    ],
    [
      [-0.07, 0.04],
      [0.08, 0.04],
    ],
    [
      [-0.07, -0.05],
      [0.08, -0.05],
    ],
  ],
  Proyectos: [
    [
      [-0.18, 0.09],
      [0.18, 0.09],
      [0.18, -0.15],
      [-0.18, -0.15],
      [-0.18, 0.09],
    ],
    [
      [-0.07, 0.09],
      [-0.07, 0.16],
      [0.07, 0.16],
      [0.07, 0.09],
    ],
  ],
  "Cliente principal": [
    [
      [-0.05, 0.13],
      [0, 0.18],
      [0.05, 0.13],
      [0, 0.08],
      [-0.05, 0.13],
    ],
    [
      [-0.15, -0.16],
      [-0.1, -0.01],
      [0.1, -0.01],
      [0.15, -0.16],
    ],
  ],
  "Cumplimiento fiscal": [
    [
      [0, 0.18],
      [0.15, 0.1],
      [0.12, -0.09],
      [0, -0.18],
      [-0.12, -0.09],
      [-0.15, 0.1],
      [0, 0.18],
    ],
    [
      [-0.08, 0],
      [-0.02, -0.07],
      [0.09, 0.07],
    ],
  ],
};

function BlockFaceIcon({
  label,
  color,
  side,
}: {
  label: string;
  color: string;
  side: 1 | -1;
}) {
  return (
    <group
      position={[0, 0, side * 1.156]}
      rotation={[0, side > 0 ? 0 : Math.PI, 0]}
      scale={0.68}
    >
      {(ICON_PATHS[label] ?? ICON_PATHS.Proyectos).map((points, pathIndex) => (
        <Line
          key={pathIndex}
          points={points.map(([x, y]) => [x, y, 0] as [number, number, number])}
          color={color}
          lineWidth={1.7}
        />
      ))}
    </group>
  );
}
