import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import type { StoredState } from '../types'
import { getStoryStep } from '../engine/story'
import { baseCommands, planCommand } from '../engine/commandEngine'
import { highlightBaseLine } from '../engine/terminalFormat'
import { getNodeAtPath, resolvePath } from '../engine/baseFs'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const storyTheme = {
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
}

const baseTheme = {
  background: '#002b36',
  foreground: '#839496',
  cursor: '#93a1a1',
  selectionBackground: '#073642',
  black: '#073642',
  red: '#dc322f',
  green: '#859900',
  yellow: '#b58900',
  blue: '#268bd2',
  magenta: '#d33682',
  cyan: '#2aa198',
  white: '#eee8d5',
  brightBlack: '#002b36',
  brightRed: '#cb4b16',
  brightGreen: '#586e75',
  brightYellow: '#657b83',
  brightBlue: '#839496',
  brightMagenta: '#6c71c4',
  brightCyan: '#93a1a1',
  brightWhite: '#fdf6e3',
}

const MAX_HISTORY = 200

const getCommandCandidates = (buffer: string) => {
  const leading = buffer.match(/^\s*/)?.[0] ?? ''
  const fragment = buffer.slice(leading.length)
  if (fragment.includes(' ')) {
    return []
  }
  return baseCommands
    .filter((command) => command.startsWith(fragment))
    .map((command) => `${leading}${command}`)
}

const getPathCandidates = (buffer: string, state: StoredState) => {
  const lastSpace = buffer.lastIndexOf(' ')
  if (lastSpace === -1) {
    return []
  }
  const basePrefix = buffer.slice(0, lastSpace + 1)
  const fragment = buffer.slice(lastSpace + 1)
  if (fragment.startsWith('-')) {
    return []
  }

  let dirInput = '.'
  let partial = fragment
  let prefix = ''
  if (fragment.includes('/')) {
    const lastSlash = fragment.lastIndexOf('/')
    prefix = fragment.slice(0, lastSlash + 1)
    dirInput = fragment.slice(0, lastSlash) || '/'
    partial = fragment.slice(lastSlash + 1)
  }

  const dirPath = resolvePath(state.base.cwd, dirInput)
  const node = getNodeAtPath(state.base.fs, dirPath)
  if (!node || node.type !== 'dir') {
    return []
  }

  return Object.keys(node.children)
    .filter((name) => name.startsWith(partial))
    .sort()
    .map((name) => {
      const child = node.children[name]
      const suffix = child.type === 'dir' ? '/' : ''
      return `${basePrefix}${prefix}${name}${suffix}`
    })
}

const getAutocompleteCandidates = (buffer: string, state: StoredState) => {
  if (buffer.includes(' ')) {
    return getPathCandidates(buffer, state)
  }
  return getCommandCandidates(buffer)
}

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
  const historyRef = useRef<string[]>([])
  const autocompleteRef = useRef({
    active: false,
    candidates: [] as string[],
    index: -1,
    original: '',
  })

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
      theme: stateRef.current.mode === 'base' ? baseTheme : storyTheme,
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
      const trimmedCommand = command.trim()
      const isBaseMode = stateRef.current.mode === 'base'
      const isHistoryCommand = isBaseMode && trimmedCommand === 'history'

      if (isHistoryCommand) {
        if (historyRef.current.length === 0) {
          writeLine('History empty.')
        } else {
          historyRef.current.forEach((entry, index) => {
            writeLine(`${index + 1}  ${entry}`)
          })
        }
        writePrompt()
        return
      }

      if (isBaseMode && trimmedCommand !== '') {
        historyRef.current.push(command)
        if (historyRef.current.length > MAX_HISTORY) {
          historyRef.current.shift()
        }
      }

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
        historyRef.current = []
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
        const shouldStream =
          output.stream ??
          (stateRef.current.mode === 'story' && output.lines.length > 1)
        if (shouldStream) {
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

    const resetAutocomplete = () => {
      autocompleteRef.current = {
        active: false,
        candidates: [],
        index: -1,
        original: '',
      }
    }

    const renderBuffer = (buffer: string) => {
      terminal.write('\u001b[?25l')
      terminal.write('\u001b[2K\r')
      terminal.write(`${getPrompt(stateRef.current)}${buffer}`)
      terminal.write('\u001b[?25h')
      bufferRef.current = buffer
    }

    const handleAutocomplete = (direction: 'next' | 'prev') => {
      if (stateRef.current.mode !== 'base') {
        return false
      }

      const auto = autocompleteRef.current
      if (!auto.active) {
        const candidates = getAutocompleteCandidates(bufferRef.current, stateRef.current)
        if (candidates.length === 0) {
          return true
        }
        auto.active = true
        auto.candidates = candidates
        auto.index = -1
        auto.original = bufferRef.current
      }

      if (auto.candidates.length === 0) {
        return true
      }

      if (direction === 'next') {
        auto.index += 1
        if (auto.index >= auto.candidates.length) {
          auto.index = -1
        }
      } else {
        auto.index -= 1
        if (auto.index < -1) {
          auto.index = auto.candidates.length - 1
        }
      }

      const nextBuffer = auto.index === -1 ? auto.original : auto.candidates[auto.index]
      renderBuffer(nextBuffer)
      return true
    }

    const onData = (data: string) => {
      if (busyRef.current) {
        return
      }

      if (data === '\r') {
        const command = bufferRef.current
        bufferRef.current = ''
        terminal.write('\r\n')
        resetAutocomplete()
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
          resetAutocomplete()
        }
        return
      }

      if (stateRef.current.mode === 'base') {
        if (data === '\t') {
          handleAutocomplete('next')
          return
        }

        if (data === '\u001b[A') {
          if (handleAutocomplete('next')) {
            return
          }
        }

        if (data === '\u001b[B') {
          if (handleAutocomplete('prev')) {
            return
          }
        }
      }

      if (isPrintable(data)) {
        bufferRef.current += data
        terminal.write(data)
        resetAutocomplete()
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

  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) {
      return
    }
    terminal.options.theme = state.mode === 'base' ? baseTheme : storyTheme
    autocompleteRef.current = {
      active: false,
      candidates: [],
      index: -1,
      original: '',
    }
  }, [state.mode])

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
