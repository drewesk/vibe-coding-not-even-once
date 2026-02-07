import { useEffect, useRef } from 'react'
import type { MatrixMode } from '../types'

type MatrixRainProps = {
  enabled: boolean
  mode: MatrixMode
  speed: number
  density: number
  className?: string
}

const glyphs = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&*+-'

const modeConfig: Record<MatrixMode, { trail: number; speed: number; density: number }> = {
  calm: { trail: 0.08, speed: 0.75, density: 0.7 },
  pulse: { trail: 0.14, speed: 1.15, density: 1.1 },
  storm: { trail: 0.18, speed: 1.35, density: 1.2 },
}

const modeColor: Record<MatrixMode, [number, number, number]> = {
  calm: [96, 255, 168],
  pulse: [79, 241, 255],
  storm: [142, 255, 120],
}

const clampRange = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const MatrixRain = ({ enabled, mode, speed, density, className }: MatrixRainProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dropsRef = useRef<number[]>([])
  const activeRef = useRef<boolean[]>([])
  const dimensionsRef = useRef({ width: 0, height: 0, columns: 0 })
  const settingsRef = useRef({ enabled, mode, speed, density })

  useEffect(() => {
    settingsRef.current = { enabled, mode, speed, density }
  }, [enabled, mode, speed, density])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const fontSize = 30

    const rebuildDrops = (densityValue: number) => {
      const { columns } = dimensionsRef.current
      dropsRef.current = Array.from({ length: columns }, () => Math.random() * -20)
      activeRef.current = Array.from({ length: columns }, () => Math.random() < densityValue)
    }

    const resizeCanvas = () => {
      const parent = canvas.parentElement
      if (!parent) {
        return
      }
      const width = parent.clientWidth
      const scrollHeight = Math.max(
        parent.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      )
      const height = Math.max(parent.clientHeight, scrollHeight)
      if (!width || !height) {
        return
      }
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      dimensionsRef.current = {
        width,
        height,
        columns: Math.floor(width / fontSize),
      }
      const config = modeConfig[settingsRef.current.mode]
      const densityValue = clampRange(
        (settingsRef.current.density / 5) * config.density,
        0.1,
        1,
      )
      rebuildDrops(densityValue)
    }

    resizeCanvas()

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => resizeCanvas())
      resizeObserver.observe(canvas.parentElement as Element)
    } else {
      window.addEventListener('resize', resizeCanvas)
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect()
      } else {
        window.removeEventListener('resize', resizeCanvas)
      }
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const fontSize = 30
    let lastDensity = -1
    let lastMode: MatrixMode = 'calm'
    let wasEnabled = false

    const drawFrame = (time: number) => {
      const { enabled: active, mode: currentMode, speed: currentSpeed, density: currentDensity } =
        settingsRef.current
      const { width, height, columns } = dimensionsRef.current

      if (!width || !height || !columns) {
        requestAnimationFrame(drawFrame)
        return
      }

      const config = modeConfig[currentMode]
      const densityValue = clampRange((currentDensity / 5) * config.density, 0.1, 1)

      if (densityValue !== lastDensity || currentMode !== lastMode) {
        dropsRef.current = Array.from({ length: columns }, () => Math.random() * -20)
        activeRef.current = Array.from({ length: columns }, () => Math.random() < densityValue)
        lastDensity = densityValue
        lastMode = currentMode
      }

      if (!active) {
        if (wasEnabled) {
          ctx.clearRect(0, 0, width, height)
        }
        wasEnabled = false
        requestAnimationFrame(drawFrame)
        return
      }

      wasEnabled = true
      const speedValue = clampRange(currentSpeed, 1, 5)
      const speedScale = (0.35 + speedValue * 0.18) * config.speed
      const [r, g, b] = modeColor[currentMode]
      const pulse = currentMode === 'pulse' ? 0.6 + 0.4 * Math.sin(time / 420) : 1

      ctx.fillStyle = `rgba(5, 11, 19, ${config.trail})`
      ctx.fillRect(0, 0, width, height)
      ctx.font = `${fontSize}px "Share Tech Mono", monospace`
      ctx.textBaseline = 'top'

      for (let column = 0; column < columns; column += 1) {
        const wave = currentMode === 'pulse' ? (Math.sin(time / 360 + column * 0.25) + 1) / 2 : 0
        const waveBoost = currentMode === 'pulse' && wave > 0.55
        if (!activeRef.current[column] && !waveBoost) {
          continue
        }
        const drop = dropsRef.current[column]
        const x = column * fontSize
        const y = drop * fontSize
        const glyph = glyphs[Math.floor(Math.random() * glyphs.length)]
        const alpha = (0.55 + Math.random() * 0.4) * pulse * (currentMode === 'pulse' ? 0.85 + wave * 0.4 : 1)
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
        ctx.fillText(glyph, x, y)

        if (currentMode === 'pulse') {
          const extraLines = wave > 0.8 ? 2 : wave > 0.65 ? 1 : 0
          for (let i = 1; i <= extraLines; i += 1) {
            const offset = i * fontSize * 2
            const extraGlyph = glyphs[Math.floor(Math.random() * glyphs.length)]
            const extraAlpha = alpha * (0.7 - i * 0.15)
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${extraAlpha})`
            ctx.fillText(extraGlyph, x, y - offset)
          }
        }

        if (y > height && Math.random() > 0.975) {
          dropsRef.current[column] = Math.random() * -20
        } else {
          dropsRef.current[column] = drop + speedScale
        }
      }

      requestAnimationFrame(drawFrame)
    }

    const frameId = requestAnimationFrame(drawFrame)

    return () => cancelAnimationFrame(frameId)
  }, [])

  return <canvas ref={canvasRef} className={className ?? 'terminal__matrix'} />
}

export default MatrixRain
