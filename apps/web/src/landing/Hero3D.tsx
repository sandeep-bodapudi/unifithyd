// 3D hero: the Unifit "U" extruded from the logo geometry, floating among
// brand-coloured rings and sparks. Follows the pointer and the scroll position.
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float, Sparkles, RoundedBox } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { MARK_H, MARK_W } from '../brand/Logo'

const GREEN = '#4AA82A'
const SLATE = '#9FB4D3'
const YELLOW = '#F5C518'
const BLUE = '#2A6FC4'

// The two halves of the logo "U" (same geometry as MARK_LEFT / MARK_RIGHT),
// built in y-up space and centred on the origin.
function markShapes() {
  const P = (x: number, y: number): [number, number] => [x - MARK_W / 2, MARK_H / 2 - y]
  const [cx, cy] = P(157.5, 222) // centre of both arcs
  const { PI } = Math

  const left = new THREE.Shape()
  left.moveTo(...P(0, 104))
  left.lineTo(...P(105, 104))
  left.lineTo(...P(105, 222))
  left.absarc(cx, cy, 52.5, PI, PI * 1.5, false)
  left.lineTo(...P(157.5, 379.5))
  left.absarc(cx, cy, 157.5, PI * 1.5, PI, true)
  left.closePath()

  const right = new THREE.Shape()
  right.moveTo(...P(157.5, 379.5))
  right.lineTo(...P(157.5, 274.5))
  right.absarc(cx, cy, 52.5, PI * 1.5, PI * 2, false)
  right.lineTo(...P(210, 69))
  right.lineTo(...P(315, 0))
  right.lineTo(...P(315, 222))
  right.absarc(cx, cy, 157.5, 0, -PI / 2, true)
  right.closePath()
  return [left, right]
}

function useMarkGeometries() {
  return useMemo(
    () =>
      markShapes().map((shape) => {
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: 70,
          bevelEnabled: true,
          bevelThickness: 8,
          bevelSize: 6,
          bevelSegments: 6,
          curveSegments: 48,
        })
        geo.translate(0, 0, -35)
        geo.scale(0.0068, 0.0068, 0.0068)
        return geo
      }),
    [],
  )
}

function LogoMark({ leftColor }: { leftColor: string }) {
  const group = useRef<THREE.Group>(null)
  const [left, right] = useMarkGeometries()
  const { pointer } = useThree()

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const scroll = Math.min(window.scrollY / window.innerHeight, 1.5)
    const t = state.clock.elapsedTime
    const targetY = pointer.x * 0.5 + Math.sin(t * 0.4) * 0.25 + scroll * Math.PI
    const targetX = -pointer.y * 0.3 + scroll * 0.3
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, targetY, 3, delta)
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, targetX, 3, delta)
  })

  return (
    <group ref={group}>
      <mesh geometry={left} castShadow>
        <meshPhysicalMaterial color={leftColor} emissive={leftColor} emissiveIntensity={0.12} roughness={0.3} metalness={0.1} clearcoat={1} clearcoatRoughness={0.15} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={right} castShadow>
        <meshPhysicalMaterial
          color={GREEN}
          emissive={GREEN}
          emissiveIntensity={0.18}
          roughness={0.2}
          metalness={0.15}
          clearcoat={1}
          clearcoatRoughness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

function Ring({ radius, color, speed, tilt }: { radius: number; color: string; speed: number; tilt: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z += delta * speed
  })
  return (
    <mesh ref={ref} rotation={tilt}>
      <torusGeometry args={[radius, 0.012, 16, 160]} />
      <meshBasicMaterial color={color} transparent opacity={0.55} />
    </mesh>
  )
}

// Small floating "plates" in brand colours, like weights orbiting the mark
function Orbiters() {
  const group = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.15
  })
  const items: { pos: [number, number, number]; color: string; size: number }[] = [
    { pos: [2.6, 1.1, -0.6], color: GREEN, size: 0.32 },
    { pos: [-2.7, -0.9, 0.4], color: SLATE, size: 0.26 },
    { pos: [-2.1, 1.6, -1.2], color: YELLOW, size: 0.16 },
    { pos: [2.2, -1.5, 0.8], color: BLUE, size: 0.22 },
  ]
  return (
    <group ref={group}>
      {items.map((it, i) => (
        <Float key={i} speed={1.5 + i * 0.3} rotationIntensity={1.4} floatIntensity={1.2}>
          <RoundedBox args={[it.size, it.size, it.size]} radius={it.size * 0.25} position={it.pos}>
            <meshStandardMaterial color={it.color} roughness={0.35} metalness={0.2} />
          </RoundedBox>
        </Float>
      ))}
    </group>
  )
}

function Scene({ light }: { light: boolean }) {
  return (
    <>
      <ambientLight intensity={light ? 0.9 : 0.55} />
      <directionalLight position={[4, 5, 6]} intensity={1.6} />
      <pointLight position={[-4, -2, 3]} intensity={18} color={GREEN} />
      <pointLight position={[3, 2, -3]} intensity={10} color={BLUE} />
      <Float speed={1.4} rotationIntensity={0.2} floatIntensity={0.6}>
        <LogoMark leftColor={light ? '#12335F' : '#FFFFFF'} />
      </Float>
      <Ring radius={2.3} color={GREEN} speed={0.25} tilt={[1.2, 0.2, 0]} />
      <Ring radius={2.7} color={SLATE} speed={-0.18} tilt={[1.4, -0.3, 0.4]} />
      <Orbiters />
      <Sparkles count={60} scale={[8, 5, 4]} size={2.2} speed={0.35} color={GREEN} opacity={0.7} />
      <Sparkles count={25} scale={[8, 5, 4]} size={1.6} speed={0.25} color={YELLOW} opacity={0.6} />
    </>
  )
}

function useLightTheme() {
  const read = () => {
    const forced = document.documentElement.dataset.theme
    if (forced) return forced === 'light'
    return window.matchMedia('(prefers-color-scheme: light)').matches
  }
  const [light, setLight] = useState(read)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const update = () => setLight(read())
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    mq.addEventListener('change', update)
    return () => {
      obs.disconnect()
      mq.removeEventListener('change', update)
    }
  }, [])
  return light
}

export default function Hero3D() {
  const wrap = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const light = useLightTheme()

  // Stop rendering when the hero is off-screen to save battery
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={wrap} className="hero-canvas">
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 7], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        aria-label="3D Unifit logo"
      >
        <Scene light={light} />
      </Canvas>
    </div>
  )
}
