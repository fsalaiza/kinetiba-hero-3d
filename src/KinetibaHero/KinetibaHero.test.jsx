import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Mock Three.js — import real module but patch WebGL-dependent parts
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual }
})
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }) => <div data-testid="r3f-canvas">{children}</div>,
  useFrame: vi.fn(),
  useThree: () => ({ viewport: { width: 10, height: 10 }, camera: {} }),
}))
vi.mock('@react-three/drei', () => {
  const useGLTF = vi.fn(() => ({ nodes: {}, materials: {} }))
  useGLTF.preload = vi.fn()
  return {
    Environment: () => null,
    ContactShadows: () => null,
    useGLTF,
    Decal: () => null,
  }
})
vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: ({ children }) => children,
  Bloom: () => null,
  Vignette: () => null,
  N8AO: () => null,
  SMAA: () => null,
}))
vi.mock('gsap', () => {
  const gsap = {
    to: vi.fn(),
    set: vi.fn(),
    from: vi.fn(),
    fromTo: vi.fn(),
    registerPlugin: vi.fn(),
    timeline: vi.fn(() => ({ to: vi.fn(), from: vi.fn(), kill: vi.fn() })),
    killTweensOf: vi.fn(),
    context: vi.fn(() => ({ revert: vi.fn(), kill: vi.fn() })),
  }
  return { default: gsap, gsap }
})
vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: { create: vi.fn(), getAll: vi.fn(() => []), kill: vi.fn(), refresh: vi.fn() },
}))

import KinetibaHero from './index'

describe('KinetibaHero', () => {
  it('renders without crashing', () => {
    const { container } = render(<KinetibaHero />)
    expect(container).toBeTruthy()
  })

  it('overlay shows the hero title', () => {
    render(<KinetibaHero />)
    expect(screen.getByText(/Tus datos/i)).toBeInTheDocument()
  })

  it('CTA button exists and has aria-label', () => {
    render(<KinetibaHero />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-label')
  })

  it('calls onCtaClick when CTA button is clicked', () => {
    const handler = vi.fn()
    render(<KinetibaHero onCtaClick={handler} />)
    screen.getByRole('button').click()
    expect(handler).toHaveBeenCalledOnce()
  })
})
