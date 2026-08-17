'use client'

import { useRef, useCallback } from 'react'
import Image from 'next/image'
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
} from 'framer-motion'

interface ParallaxImageProps {
  src: string
  alt: string
  sizes: string
  aspect?: string
  objectPosition?: string
  tilt?: number
  parallaxStrength?: number
  priority?: boolean
  className?: string
}

// The oversized inner container is OVERSIZE_FACTOR of the visible area.
// The `sizes` hint must match this inflated size so Next.js generates a
// high-enough resolution image — otherwise the browser picks a too-small
// srcset entry and the image looks blurry.
const OVERSIZE = 0.14  // 14 % bleed on each side → 128 % total
const SCALE = 1 + 2 * OVERSIZE  // 1.28

function inflatedSizes(sizes: string): string {
  return sizes.replace(/(\d+(?:\.\d+)?)vw/gi, (_, n) =>
    `${Math.round(parseFloat(n) * SCALE)}vw`,
  )
}

export function ParallaxImage({
  src,
  alt,
  sizes,
  aspect = 'aspect-[4/5]',
  objectPosition = 'object-center',
  tilt = 8,
  parallaxStrength = 55,
  priority = false,
  className = '',
}: ParallaxImageProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Scroll-based vertical parallax
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const rawY = useTransform(
    scrollYProgress,
    [0, 1],
    [-parallaxStrength, parallaxStrength],
  )
  const y = useSpring(rawY, { stiffness: 65, damping: 18, restDelta: 0.001 })

  // Mouse 3-D tilt
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rotateX = useSpring(
    useTransform(my, [-0.5, 0.5], [tilt, -tilt]),
    { stiffness: 140, damping: 22 },
  )
  const rotateY = useSpring(
    useTransform(mx, [-0.5, 0.5], [-tilt, tilt]),
    { stiffness: 140, damping: 22 },
  )

  // Specular highlight position (hook at top level)
  const shineX = useTransform(mx, [-0.5, 0.5], ['-10%', '60%'])
  const shineY = useTransform(my, [-0.5, 0.5], ['-10%', '60%'])

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect()
      mx.set((e.clientX - r.left) / r.width - 0.5)
      my.set((e.clientY - r.top) / r.height - 0.5)
    },
    [mx, my],
  )
  const onLeave = useCallback(() => {
    mx.set(0)
    my.set(0)
  }, [mx, my])

  const pct = `${OVERSIZE * 100}%`
  const dim = `${SCALE * 100}%`

  return (
    <div
      ref={ref}
      className={`relative ${aspect} ${className}`}
      style={{ perspective: '1100px' }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {/* 3-D tilt card */}
      <motion.div
        className="absolute inset-0 overflow-hidden rounded-2xl"
        style={{
          rotateX,
          rotateY,
          boxShadow:
            '0 50px 90px -20px rgba(0,0,0,0.45), 0 25px 50px -15px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.06)',
        }}
        whileHover={{
          boxShadow:
            '0 70px 120px -20px rgba(0,0,0,0.55), 0 40px 70px -10px rgba(0,0,0,0.38), 0 0 0 1px rgba(255,255,255,0.08)',
        }}
        transition={{ duration: 0.4 }}
      >
        {/* Oversized container — edge padding so parallax/tilt never reveals blank space */}
        <div
          style={{
            position: 'absolute',
            top: `-${pct}`,
            left: `-${pct}`,
            width: dim,
            height: dim,
          }}
        >
          <motion.div className="relative h-full w-full" style={{ y }}>
            <Image
              src={src}
              alt={alt}
              fill
              priority={priority}
              className={`object-cover ${objectPosition}`}
              sizes={inflatedSizes(sizes)}
              quality={90}
            />
          </motion.div>
        </div>

        {/* Bottom depth vignette */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

        {/* Top edge catchlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Specular highlight tracks mouse */}
        <motion.div
          className="pointer-events-none absolute"
          style={{
            width: '50%',
            height: '50%',
            background:
              'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)',
            x: shineX,
            y: shineY,
          }}
        />
      </motion.div>
    </div>
  )
}
