import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, useTexture } from '@react-three/drei';

const EARTH_TEXTURE =
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r152/examples/textures/planets/earth_atmos_2048.jpg';

function EarthSphere() {
  const colorMap = useTexture(EARTH_TEXTURE);

  return (
    <mesh>
      <sphereGeometry args={[2.15, 64, 64]} />
      <meshStandardMaterial
        map={colorMap}
        roughness={0.85}
        metalness={0.08}
      />
    </mesh>
  );
}

function EarthFallback() {
  return (
    <mesh>
      <sphereGeometry args={[2.15, 48, 48]} />
      <meshStandardMaterial color="#1a5f7a" roughness={0.9} metalness={0.15} />
    </mesh>
  );
}

/**
 * Interactive 3D Earth: drag to orbit (OrbitControls), scroll to zoom.
 * Slow spin on the mesh complements camera orbit.
 */
export default function GlobeScene() {
  return (
    <div className="relative h-full w-full min-h-[280px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
      <Canvas
        camera={{ position: [0, 0.35, 5.2], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <ambientLight intensity={0.45} />
        <directionalLight position={[6, 4, 6]} intensity={1.35} />
        <directionalLight position={[-4, -2, -4]} intensity={0.25} color="#7dd3fc" />
        <Suspense fallback={<EarthFallback />}>
          <EarthSphere />
        </Suspense>
        <Stars
          radius={140}
          depth={60}
          count={4500}
          factor={3.5}
          saturation={0}
          fade
          speed={0.25}
        />
        <OrbitControls
          enablePan={false}
          minPolarAngle={0.35}
          maxPolarAngle={Math.PI - 0.35}
          minDistance={3.4}
          maxDistance={9}
          zoomSpeed={0.85}
          rotateSpeed={0.65}
          autoRotate
          autoRotateSpeed={0.28}
        />
      </Canvas>
      <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[11px] text-cyan-100/60">
        Drag to rotate · Scroll to zoom
      </p>
    </div>
  );
}
