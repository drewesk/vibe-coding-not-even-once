import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import type { StoredState } from '../types'
import { getStoryStep } from '../engine/story'
import { planCommand } from '../engine/commandEngine'
import { highlightBaseLine } from '../engine/terminalFormat'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type TerminalPanelProps = {
  state: StoredState
  setState: Dispatch<SetStateAction<StoredState>>
  resetState: () => void
}

const isPrintable = (data: string) => {
  const code = data.charCodeAt(0)
  return code >= 32 && code <= 126
}

const getPrompt = (state: StoredState) =>
  state.mode === 'base' ? `base:${state.base.cwd}$ ` : 'story> '

const isSystemLine = (line: string) => line.includes('<system-') || line.includes('</system-')

const filterSystemLines = (lines: string[]) => lines.filter((line) => !isSystemLine(line))

const TerminalPanel = ({ state, setState, resetState }: TerminalPanelProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const bufferRef = useRef('')
  const busyRef = useRef(false)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: '"Share Tech Mono", "Fira Code", monospace',
      fontSize: 15,
      lineHeight: 1.4,
      theme: {
        background: 'transparent',
        foreground: '#5dffb6',
        cursor: '#7afcff',
        selectionBackground: '#0f2b45',
        red: '#ff4d6d',
        yellow: '#ffe08a',
        cyan: '#4ff1ff',
        brightRed: '#ff6b86',
        brightYellow: '#fff2b2',
        brightCyan: '#7afcff',
      },
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)
    fitAddon.fit()
    terminal.focus()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const handleResize = () => fitAddon.fit()
    window.addEventListener('resize', handleResize)

    const scrollToBottom = () => {
      try {
        if (!terminal.element) {
          return
        }
        terminal.scrollToBottom()
      } catch (error) {
        console.warn('[Terminal] scroll failed', error)
      }
    }

    const writeLine = (line: string) => {
      if (isSystemLine(line)) {
        return
      }
      if (stateRef.current.mode === 'base') {
        const normalized = highlightBaseLine(line)
        terminal.write(`${normalized}\r\n`)
      } else {
        terminal.writeln(line)
      }
      scrollToBottom()
    }

    const typeLine = async (line: string, charDelay: number) => {
      for (const char of line) {
        terminal.write(char)
        await sleep(charDelay)
      }
      terminal.write('\r\n')
      scrollToBottom()
    }

    const streamLines = async (
      lines: string[],
      charDelay = 16,
      lineDelay = 260,
    ) => {
      for (const line of lines) {
        await typeLine(line, charDelay)
        await sleep(lineDelay)
      }
    }

    const writePrompt = () => {
      terminal.write(getPrompt(stateRef.current))
      scrollToBottom()
    }

    const renderStoryPrompt = async (storyIndex: number) => {
      const step = getStoryStep(storyIndex)
      const promptLines = filterSystemLines(step.promptLines)
      if (promptLines.length > 0) {
        await streamLines(promptLines, 12, 220)
      }
      writePrompt()
    }

    const handleCommand = async (command: string) => {
      const plan = planCommand(command, stateRef.current)
      const nextStep = getStoryStep(plan.nextState.storyIndex)

      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
      }

      const isStoryAdvance =
        plan.showStoryPrompt &&
        plan.nextState.mode === 'story' &&
        plan.nextState.storyIndex !== stateRef.current.storyIndex
      const didModeChange = plan.nextState.mode !== stateRef.current.mode

      if (plan.resetTerminal) {
        terminal.reset()
        resetState()
        stateRef.current = plan.nextState
      } else if (didModeChange) {
        terminal.clear()
      } else if (plan.clearTerminal) {
        terminal.clear()
      } else if (isStoryAdvance) {
        terminal.clear()
      } else if (plan.showStoryPrompt) {
        const promptLines = nextStep.promptLines.length
        const isFullScreen = promptLines >= Math.max(terminal.rows - 2, 0)
        if (nextStep.forceClear || isFullScreen) {
          terminal.clear()
        }
      }

      for (const output of plan.outputs) {
        if (output.delay) {
          await sleep(output.delay)
        }
        const lines = filterSystemLines(output.lines)
        if (lines.length === 0) {
          continue
        }
        if (output.stream) {
          await streamLines(
            lines,
            output.charDelay ?? 16,
            output.lineDelay ?? 200,
          )
        } else {
          lines.forEach((line) => writeLine(line))
        }
      }

      if (!plan.resetTerminal) {
        setState(plan.nextState)
        stateRef.current = plan.nextState
      }

      if (plan.showStoryPrompt && plan.nextState.mode === 'story') {
        await renderStoryPrompt(plan.nextState.storyIndex)
      } else {
        writePrompt()
      }
    }

    const onData = (data: string) => {
      if (busyRef.current) {
        return
      }

      if (data === '\r') {
        const command = bufferRef.current
        bufferRef.current = ''
        terminal.write('\r\n')
        busyRef.current = true
        handleCommand(command)
          .catch((error) => {
            console.error(error)
            writeLine('Terminal error encountered.')
          })
          .finally(() => {
            busyRef.current = false
          })
        return
      }

      if (data === '\u007F') {
        if (bufferRef.current.length > 0) {
          bufferRef.current = bufferRef.current.slice(0, -1)
          terminal.write('\b \b')
        }
        return
      }

      if (isPrintable(data)) {
        bufferRef.current += data
        terminal.write(data)
      }
    }

    const dispose = terminal.onData(onData)

    if (stateRef.current.mode === 'story') {
      renderStoryPrompt(stateRef.current.storyIndex)
    } else {
      writePrompt()
    }

    return () => {
      dispose.dispose()
      terminal.dispose()
      window.removeEventListener('resize', handleResize)
    }
  }, [resetState, setState])

  return (
    <section className="terminal">
      <div className="terminal__header">
        <div>
          <span className="terminal__title">AgentCLI</span>
          <span className="terminal__version">v1.0</span>
        </div>
        <div className="terminal__status">
          {state.mode === 'story' ? 'Story mode online' : 'Base mode online'}
        </div>
      </div>
      <div className="terminal__body">
        <div className="terminal__xterm" ref={containerRef} />
      </div>
    </section>
  )
}

export default TerminalPanel
