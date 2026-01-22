import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { StoredState } from '../types'
import { getStoryStep } from '../engine/story'
import { planCommand } from '../engine/commandEngine'

const PROMPT = '> '

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type TerminalPanelProps = {
  state: StoredState
  setState: React.Dispatch<React.SetStateAction<StoredState>>
  resetState: () => void
}

const isPrintable = (data: string) => {
  const code = data.charCodeAt(0)
  return code >= 32 && code <= 126
}

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
        background: '#050b13',
        foreground: '#5dffb6',
        cursor: '#7afcff',
        selectionBackground: '#0f2b45',
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

    const writeLine = (line: string) => terminal.writeln(line)

    const typeLine = async (line: string, charDelay: number) => {
      for (const char of line) {
        terminal.write(char)
        await sleep(charDelay)
      }
      terminal.write('\r\n')
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

    const writePrompt = () => terminal.write(PROMPT)

    const renderStoryPrompt = async (storyIndex: number) => {
      const step = getStoryStep(storyIndex)
      if (step.promptLines.length > 0) {
        await streamLines(step.promptLines, 12, 220)
      }
      writePrompt()
    }

    const handleCommand = async (command: string) => {
      const plan = planCommand(command, stateRef.current)

      if (plan.resetTerminal) {
        terminal.reset()
        resetState()
        stateRef.current = plan.nextState
      }

      for (const output of plan.outputs) {
        if (output.delay) {
          await sleep(output.delay)
        }
        if (output.stream) {
          await streamLines(
            output.lines,
            output.charDelay ?? 16,
            output.lineDelay ?? 200,
          )
        } else {
          output.lines.forEach((line) => writeLine(line))
        }
      }

      if (!plan.resetTerminal) {
        setState(plan.nextState)
        stateRef.current = plan.nextState
      }

      if (plan.showStoryPrompt) {
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

    renderStoryPrompt(stateRef.current.storyIndex)

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
        <div className="terminal__status">Story mode online</div>
      </div>
      <div className="terminal__body" ref={containerRef} />
    </section>
  )
}

export default TerminalPanel
