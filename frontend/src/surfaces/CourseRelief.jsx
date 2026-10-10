import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { BOARD, ISOM, drawCourseSheet, makeProjection, makeStudioEnvTexture } from './mapSheet';

const PLATE_THICKNESS = 0.055;
const COURSE_LIFT = PLATE_THICKNESS / 2 + 0.012;
const CONTROL_CODES = { pickup: 'P', rest: 'R', fuel: 'F', dropoff: 'D' };

/** Local daylight studio, so painted surfaces have something to reflect. */
function StudioRig() {
  const { scene } = useThree();
  const envTexture = useMemo(() => makeStudioEnvTexture(THREE), []);

  useEffect(() => {
    scene.environment = envTexture;
    scene.environmentIntensity = 0.6;
    return () => {
      scene.environment = null;
      envTexture.dispose();
    };
  }, [scene, envTexture]);

  return (
    <>
      <ambientLight intensity={0.75} color="#ffffff" />
      <directionalLight position={[2.6, 4.2, 2.2]} intensity={1.5} color="#fffdf6" />
      <directionalLight position={[-3.2, 2.0, -2.6]} intensity={0.55} color="#dbe6f5" />
      <directionalLight position={[0, -1.6, 1.2]} intensity={0.25} color="#efe7d6" />
    </>
  );
}

/** A printed numeral on a small billboard, used for control codes. */
function codeTexture(label) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.font = `700 92px 'Archivo', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ISOM.paper;
  ctx.strokeStyle = ISOM.courseDeep;
  ctx.lineWidth = 7;
  ctx.strokeText(label, 64, 68);
  ctx.fillText(label, 64, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function ControlMarker({ position, code, number }) {
  const texture = useMemo(() => codeTexture(code), [code]);
  const numberTexture = useMemo(() => codeTexture(String(number)), [number]);

  return (
    <group position={[position[0], COURSE_LIFT, position[1]]}>
      {/* Flat control circle, exactly as it is printed on the sheet. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[0.052, 0.064, 40]} />
        <meshStandardMaterial
          color={ISOM.course}
          roughness={0.45}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* The pillar that makes this a relief rather than a drawing. */}
      <mesh position={[0, 0.075, 0]}>
        <cylinderGeometry args={[0.012, 0.014, 0.15, 12]} />
        <meshStandardMaterial color={ISOM.ink} roughness={0.6} metalness={0.16} />
      </mesh>

      <sprite position={[0, 0.19, 0]} scale={[0.085, 0.085, 0.085]}>
        <spriteMaterial map={texture} transparent depthWrite={false} />
      </sprite>

      <sprite position={[0, 0.132, 0]} scale={[0.05, 0.05, 0.05]}>
        <spriteMaterial map={numberTexture} transparent depthWrite={false} />
      </sprite>
    </group>
  );
}

/**
 * The board itself: the printed sheet, its paper edge, the purple course laid
 * over the terrain, and a runner travelling it.
 *
 * The course layer never edits the terrain: the sheet under the ribbon is
 * repainted only to ink the course in further, and the terrain drawn into it is
 * generated from a fixed seed.
 */
function Board({ trip, running, onInked }) {
  const runner = useRef();
  const sheetCanvas = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1000;
    return canvas;
  }, []);

  const sheetTexture = useMemo(() => {
    const texture = new THREE.CanvasTexture(sheetCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }, [sheetCanvas]);

  useEffect(() => () => sheetTexture.dispose(), [sheetTexture]);

  const progressRef = useRef(0);
  const paintedRef = useRef(-1);

  const paint = (progress) => {
    drawCourseSheet(sheetCanvas, { trip, progress });
    sheetTexture.needsUpdate = true;
    paintedRef.current = progress;
  };

  useEffect(() => {
    progressRef.current = running ? 0 : 1;
    paint(progressRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip, running, sheetCanvas, sheetTexture]);

  const finishedRef = useRef(false);

  useFrame((_, delta) => {
    if (progressRef.current < 1) {
      progressRef.current = Math.min(1, progressRef.current + delta * 0.55);
      if (progressRef.current - paintedRef.current > 0.012) {
        paint(progressRef.current);
      }
    } else if (!finishedRef.current && running) {
      finishedRef.current = true;
      onInked?.();
    }

    // The printed course and the raised ribbon ink in together, one step ahead
    // of the runner, so the relief and the sheet can never disagree.
    if (tube) {
      const total = tube.index.count;
      const revealed = Math.max(3, Math.floor((total * progressRef.current) / 3) * 3);
      tube.setDrawRange(0, revealed);
    }

    if (runner.current && curveRef.current) {
      const t = Math.min(0.999, Math.max(0, progressRef.current));
      const point = curveRef.current.getPointAt(t);
      const tangent = curveRef.current.getTangentAt(t);
      runner.current.visible = t > 0.015;
      runner.current.position.set(point.x, COURSE_LIFT + 0.022, point.z);
      runner.current.rotation.z = Math.atan2(-tangent.x, -tangent.z);
    }
  });

  const course = useMemo(() => {
    const projection = makeProjection(trip);
    const geometry = Array.isArray(trip?.route_geometry) ? trip.route_geometry : [];
    return geometry.map((pair) => {
      const unit = projection.toUnit(pair[0], pair[1]);
      return [
        (unit[0] - 0.5) * BOARD.width,
        (unit[1] - 0.5) * BOARD.height,
      ];
    });
  }, [trip]);

  const curve = useMemo(() => {
    if (course.length < 2) return null;
    const points = course.map(([x, z]) => new THREE.Vector3(x, COURSE_LIFT + 0.01, z));
    return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2);
  }, [course]);

  const curveRef = useRef(null);
  curveRef.current = curve;

  const tube = useMemo(() => {
    if (!curve) return null;
    return new THREE.TubeGeometry(curve, Math.max(48, course.length * 6), 0.009, 10, false);
  }, [curve, course.length]);

  const projection = useMemo(() => makeProjection(trip), [trip]);
  const controls = useMemo(
    () =>
      (trip?.stops || [])
        .filter((stop) =>
          ['pickup', 'rest', 'fuel', 'dropoff'].includes(stop.type) &&
          Number.isFinite(stop.latitude) &&
          Number.isFinite(stop.longitude),
        )
        .map((stop, index) => {
          const unit = projection.toUnit(stop.latitude, stop.longitude);
          return {
            key: `${stop.type}-${index}`,
            code: CONTROL_CODES[stop.type] || 'C',
            number: index + 1,
            position: [(unit[0] - 0.5) * BOARD.width, (unit[1] - 0.5) * BOARD.height],
          };
        }),
    [trip, projection],
  );

  return (
    <group rotation={[-0.06, 0, 0]}>
      {/* Paper plate: printed face on top, cut paper edge around it. */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[BOARD.width, PLATE_THICKNESS, BOARD.height]} />
        {[
          <meshStandardMaterial key="px" color="#e6e0cf" roughness={0.95} metalness={0} />,
          <meshStandardMaterial key="nx" color="#e6e0cf" roughness={0.95} metalness={0} />,
          <meshStandardMaterial key="py" color="#ffffff" roughness={0.9} metalness={0} />,
          <meshStandardMaterial key="ny" color="#cfc7b3" roughness={0.95} metalness={0} />,
          <meshStandardMaterial key="pz" color="#e6e0cf" roughness={0.95} metalness={0} />,
          <meshStandardMaterial key="nz" color="#e6e0cf" roughness={0.95} metalness={0} />,
        ]}
      </mesh>

      {/* The printed sheet, laid flat so image rows map to board rows. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, PLATE_THICKNESS / 2 + 0.001, 0]}>
        <planeGeometry args={[BOARD.width, BOARD.height]} />
        <meshStandardMaterial map={sheetTexture} roughness={0.92} metalness={0} />
      </mesh>

      {tube && (
        <mesh geometry={tube}>
          <meshStandardMaterial
            color={ISOM.course}
            roughness={0.34}
            metalness={0.08}
            emissive={ISOM.courseDeep}
            emissiveIntensity={0.14}
          />
        </mesh>
      )}

      {controls.map((control) => (
        <ControlMarker
          key={control.key}
          position={control.position}
          code={control.code}
          number={control.number}
        />
      ))}

      {curve && (
        <mesh ref={runner} rotation={[-Math.PI / 2, 0, 0]}>{
          /* The orienteering start triangle, travelling the course. */
        }
          <coneGeometry args={[0.032, 0.075, 18]} />
          <meshStandardMaterial
            color={ISOM.courseDeep}
            roughness={0.35}
            metalness={0.1}
            emissive={ISOM.course}
            emissiveIntensity={0.3}
          />
        </mesh>
      )}
    </group>
  );
}

export default function CourseRelief({ trip, running, onInked }) {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 2.05, 2.15], fov: 34, near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.02;
      }}
    >
      <StudioRig />
      <Board trip={trip} running={running} onInked={onInked} />
      <ParallaxTarget height={2.05} />
    </Canvas>
  );
}

/** The board is rigid; the camera drifts for parallax instead of orbiting it. */
function ParallaxTarget({ height }) {
  const { camera } = useThree();
  const target = useRef({ x: 0, y: 0, ready: false });

  useEffect(() => {
    const handler = (event) => {
      target.current.x = (event.clientX / window.innerWidth - 0.5) * 0.42;
      target.current.y = (event.clientY / window.innerHeight - 0.5) * 0.16;
      target.current.ready = true;
    };
    window.addEventListener('pointermove', handler);
    return () => window.removeEventListener('pointermove', handler);
  }, []);

  useFrame((_, delta) => {
    if (!target.current.ready) return;
    const amount = Math.min(1, delta * 3);
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, target.current.x, amount);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, height + target.current.y, amount);
    camera.lookAt(0, 0.05, 0);
  });

  return null;
}
