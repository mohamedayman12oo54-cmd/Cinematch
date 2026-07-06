import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const RED = new THREE.Color('#e50914');
const PURPLE = new THREE.Color('#8b5cf6');
const CYAN = new THREE.Color('#00e5ff');

const COUNT = 3200;
const RADIUS = 2.4;

function fibonacciSpherePoints(count, radius) {
  const positions = new Float32Array(count * 3);
  const colorSeeds = new Float32Array(count); // 0..1, used to pick a color blend per point
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2; // -1..1
    const r = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;

    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;

    // Slight jitter so it reads as a cloud, not a perfect lattice.
    const jitter = 1 + (Math.random() - 0.5) * 0.06;

    positions[i * 3] = x * radius * jitter;
    positions[i * 3 + 1] = y * radius * jitter;
    positions[i * 3 + 2] = z * radius * jitter;

    colorSeeds[i] = Math.random();
  }

  return { positions, colorSeeds };
}

function ParticleField() {
  const pointsRef = useRef(null);
  const materialRef = useRef(null);
  const { viewport } = useThree();

  const { positions, colorSeeds } = useMemo(() => fibonacciSpherePoints(COUNT, RADIUS), []);

  const colorArray = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const seed = colorSeeds[i];
      // Blend across the three brand colors based on each point's seed,
      // so the sphere reads as a gradient cloud rather than flat color.
      const c = new THREE.Color();
      if (seed < 0.34) c.lerpColors(RED, PURPLE, seed / 0.34);
      else if (seed < 0.67) c.lerpColors(PURPLE, CYAN, (seed - 0.34) / 0.33);
      else c.lerpColors(CYAN, RED, (seed - 0.67) / 0.33);
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, [colorSeeds]);

  const targetRotation = useRef({ x: 0, y: 0 });
  const idleTime = useRef(0);

  useFrame((state, delta) => {
    idleTime.current += delta;

    // Mouse-driven tilt: pointer position normalized -1..1 across the viewport.
    const mx = (state.pointer.x * viewport.width) / viewport.width;
    const my = (state.pointer.y * viewport.height) / viewport.height;
    targetRotation.current.y = mx * 0.6;
    targetRotation.current.x = -my * 0.4;

    if (pointsRef.current) {
      pointsRef.current.rotation.y += (targetRotation.current.y + idleTime.current * 0.05 - pointsRef.current.rotation.y) * 0.04;
      pointsRef.current.rotation.x += (targetRotation.current.x - pointsRef.current.rotation.x) * 0.04;
    }

    if (materialRef.current) {
      // Gentle pulsing point size, like the field is breathing.
      materialRef.current.size = 0.028 + Math.sin(idleTime.current * 1.4) * 0.006;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={COUNT} array={colorArray} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        size={0.03}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * Signature hero visual: a mouse-reactive 3D particle sphere blending the
 * brand's red/purple/cyan palette. Kept to a single draw call (one Points
 * object) so it stays smooth even on modest hardware.
 */
export default function ParticleSphere() {
  return (
    <Canvas
      className="particle-sphere"
      camera={{ position: [0, 0, 6], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: true }}
    >
      <ParticleField />
    </Canvas>
  );
}
