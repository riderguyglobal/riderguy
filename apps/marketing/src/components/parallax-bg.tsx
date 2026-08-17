'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { motion, useScroll, useTransform, useSpring } from 'framer-motion'

interface ParallaxBgProps {
  src: string
  alt: string
  sizes: string
  className?: string
  strength?: number
  priority?: boolean
  quality?: number
  children?: React.ReactNode
}

export function ParallaxBg({
  src,
  alt,
  sizes,
  className = '',
  strength = 60,
  priority = false,
  quality = 90,
  children,
}: ParallaxBgProps) {
  const ref = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const rawY = useTransform(scrollYProgress, [0, 1], [-strength, strength])
  const y = useSpring(rawY, { stiffness: 65, damping: 18, restDelta: 0.001 })

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      {/* Oversized parallax image layer */}
      <div
        style={{
          position: 'absolute',
          top: '-18%',
          left: 0,
          right: 0,
          bottom: '-18%',
        }}
      >
        <motion.div className="relative h-full w-full" style={{ y }}>
          <Image
            src={src}
            alt={alt}
            fill
            priority={priority}
            className="object-cover object-center"
            sizes={sizes}
            quality={quality}
          />
        </motion.div>
      </div>

      {/* Children (overlays, gradients, text) sit above the image */}
      {children}
    </div>
  )
}
