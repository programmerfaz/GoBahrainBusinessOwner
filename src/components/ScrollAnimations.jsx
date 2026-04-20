import { motion, useInView, useAnimation, useReducedMotion } from 'framer-motion'
import { useRef, useEffect } from 'react'

const easeOut = [0.22, 1, 0.36, 1]

/** Shared viewport for scroll reveals — animate once per mount */
export const revealViewport = { once: true, margin: '-40px' }

export function FadeInUp({ children, delay = 0, duration = 0.6, className = '' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, revealViewport)
  const reduced = useReducedMotion()

  const from = reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }
  const to = { opacity: 1, y: 0 }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={from}
      animate={reduced || isInView ? to : from}
      transition={{ duration: reduced ? 0 : duration, delay: reduced ? 0 : delay, ease: easeOut }}
    >
      {children}
    </motion.div>
  )
}

export function FadeInLeft({ children, delay = 0, duration = 0.6, className = '' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, revealViewport)
  const reduced = useReducedMotion()
  const from = reduced ? { opacity: 1, x: 0 } : { opacity: 0, x: -60 }
  const to = { opacity: 1, x: 0 }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={from}
      animate={reduced || isInView ? to : from}
      transition={{ duration: reduced ? 0 : duration, delay: reduced ? 0 : delay, ease: easeOut }}
    >
      {children}
    </motion.div>
  )
}

export function FadeInRight({ children, delay = 0, duration = 0.6, className = '' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, revealViewport)
  const reduced = useReducedMotion()
  const from = reduced ? { opacity: 1, x: 0 } : { opacity: 0, x: 60 }
  const to = { opacity: 1, x: 0 }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={from}
      animate={reduced || isInView ? to : from}
      transition={{ duration: reduced ? 0 : duration, delay: reduced ? 0 : delay, ease: easeOut }}
    >
      {children}
    </motion.div>
  )
}

export function ScaleIn({ children, delay = 0, duration = 0.5, className = '' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-30px' })
  const reduced = useReducedMotion()
  const from = reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }
  const to = { opacity: 1, scale: 1 }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={from}
      animate={reduced || isInView ? to : from}
      transition={{ duration: reduced ? 0 : duration, delay: reduced ? 0 : delay, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerContainer({ children, staggerDelay = 0.1, className = '' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, revealViewport)
  const reduced = useReducedMotion()

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduced ? 'visible' : 'hidden'}
      animate={reduced || isInView ? 'visible' : 'hidden'}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: reduced ? 0 : staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className = '' }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: reduced ? 0 : 0.5, ease: easeOut },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

export function ParallaxSection({ children, className = '' }) {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ y: 0 }}
      whileInView={{ y: 0 }}
      viewport={{ once: false }}
      transition={{ type: 'spring', stiffness: 100 }}
    >
      {children}
    </motion.div>
  )
}

export function FloatingElement({ children, className = '', yOffset = 10, duration = 3 }) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={className}
      animate={{ y: [-yOffset, yOffset, -yOffset] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}

export function PulseElement({ children, className = '', scale = 1.05, duration = 2 }) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={className}
      animate={{ scale: [1, scale, 1] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}

export function RotateIn({ children, delay = 0, duration = 0.7, className = '' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, revealViewport)
  const reduced = useReducedMotion()
  const from = reduced ? { opacity: 1, rotate: 0, scale: 1 } : { opacity: 0, rotate: -10, scale: 0.9 }
  const to = { opacity: 1, rotate: 0, scale: 1 }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={from}
      animate={reduced || isInView ? to : from}
      transition={{ duration: reduced ? 0 : duration, delay: reduced ? 0 : delay, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function BlurIn({ children, delay = 0, duration = 0.8, className = '' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, revealViewport)
  const reduced = useReducedMotion()
  const from = reduced ? { opacity: 1 } : { opacity: 0, filter: 'blur(10px)' }
  const to = reduced ? { opacity: 1 } : { opacity: 1, filter: 'blur(0px)' }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={from}
      animate={reduced || isInView ? to : from}
      transition={{ duration: reduced ? 0 : duration, delay: reduced ? 0 : delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

export function CountUp({ end, duration = 2, delay = 0, prefix = '', suffix = '', className = '' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const controls = useAnimation()
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced || isInView) {
      controls.start({
        value: end,
        transition: { duration: reduced ? 0 : duration, delay: reduced ? 0 : delay, ease: 'easeOut' },
      })
    }
  }, [isInView, end, duration, delay, controls, reduced])

  return (
    <motion.span ref={ref} className={className} initial={{ value: 0 }} animate={controls}>
      {(val) => `${prefix}${Math.round(val?.value || 0)}${suffix}`}
    </motion.span>
  )
}

export function SlideReveal({ children, delay = 0, duration = 0.8, className = '', direction = 'up' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-30px' })
  const reduced = useReducedMotion()

  const directions = {
    up: { y: 100 },
    down: { y: -100 },
    left: { x: 100 },
    right: { x: -100 },
  }

  const off = { ...directions[direction], opacity: 0 }
  const on = { x: 0, y: 0, opacity: 1 }

  return (
    <motion.div ref={ref} className={className} style={{ overflow: 'hidden' }}>
      <motion.div
        initial={reduced ? on : off}
        animate={reduced || isInView ? on : off}
        transition={{ duration: reduced ? 0 : duration, delay: reduced ? 0 : delay, ease: easeOut }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
