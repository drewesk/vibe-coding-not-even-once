import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import type { StoredState } from '../types'
import { getStoryStep } from '../engine/story'
import { baseCommands, planCommand } from '../engine/commandEngine'
import { highlightBaseLine } from '../engine/terminalFormat'
import { getNodeAtPath, resolvePath } from '../engine/baseFs'
import { SSHClient } from '../services/sshClient'
import { getVMList, getVMById } from '../config/vmConfig'

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

const vmTheme = {
  background: '#1a1a2e',
  foreground: '#16c79a',
  cursor: '#19d3da',
  selectionBackground: '#0f3460',
  black: '#0f3460',
  red: '#ea5455',
  green: '#16c79a',
  yellow: '#f9ca24',
  blue: '#19d3da',
  magenta: '#c44569',
  cyan: '#16c79a',
  white: '#f8f9fa',
  brightBlack: '#1a1a2e',
  brightRed: '#ff6b81',
  brightGreen: '#19d3da',
  brightYellow: '#ffdd59',
  brightBlue: '#54a0ff',
  brightMagenta: '#ee5a6f',
  brightCyan: '#1dd1a1',
  brightWhite: '#ffffff',
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

const getPrompt = (state: StoredState) => {
  if (state.mode === 'base') {
    return `base:${state.base.cwd}$ `
  }
  if (state.mode === 'vm') {
    return 'vm> '
  }
  return 'story> '
}

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
  const sshClientRef = useRef<SSHClient | null>(null)
  const vmConnectedRef = useRef(false)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const getTheme = () => {
      if (stateRef.current.mode === 'base') return baseTheme
      if (stateRef.current.mode === 'vm') return vmTheme
      return storyTheme
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: '"Share Tech Mono", "Fira Code", monospace',
      fontSize: 15,
      lineHeight: 1.4,
      theme: getTheme(),
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)
    fitAddon.fit()
    terminal.focus()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const handleResize = () => {
      fitAddon.fit()
      // Notify SSH client of terminal size change
      if (sshClientRef.current && vmConnectedRef.current) {
        sshClientRef.current.resize(terminal.rows, terminal.cols)
      }
    }
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
      const isVMMode = stateRef.current.mode === 'vm'
      const isHistoryCommand = isBaseMode && trimmedCommand === 'history'

      // Handle VM mode commands
      if (isVMMode && !vmConnectedRef.current) {
        // Not connected yet - handle "connect vmX" command
        const connectMatch = trimmedCommand.match(/^connect\s+(vm\d+)$/i)
        if (connectMatch) {
          const vmId = connectMatch[1].toLowerCase()
          const vm = getVMById(vmId)
          
          if (!vm) {
            writeLine(`Error: Unknown VM "${vmId}"`)
            writeLine('Available VMs: vm1, vm2, vm3, vm4, vm5, vm6, vm7, vm8')
            writePrompt()
            return
          }

          // Start connection sequence
          writeLine(`Connecting to ${vm.name}...`)
          writeLine(`Establishing SSH connection to ${vm.host}...`)
          
          // Update state to connecting
          setState(prev => ({
            ...prev,
            vmState: {
              connected: false,
              selectedVM: vmId,
              connectionStatus: 'connecting',
              errorMessage: null,
            }
          }))
          
          await sleep(500)
          
          // Create SSH client
          sshClientRef.current = new SSHClient(vmId, {
            onData: (data) => {
              if (typeof data === 'string') {
                terminal.write(data)
              } else {
                terminal.write(data)
              }
            },
            onStatus: (status, message) => {
              if (status === 'connected') {
                vmConnectedRef.current = true
                terminal.clear()
                writeLine(`Connected to ${vm.name}`)
                writeLine(`SSH session established.`)
                writeLine('')
                // Update global state
                setState(prev => ({
                  ...prev,
                  vmState: {
                    connected: true,
                    selectedVM: vmId,
                    connectionStatus: 'connected',
                    errorMessage: null,
                  }
                }))
                // The actual shell prompt will come from the SSH session
              } else if (status === 'error') {
                vmConnectedRef.current = false
                writeLine(`Connection error: ${message || 'Unknown error'}`)
                writePrompt()
                // Update global state
                setState(prev => ({
                  ...prev,
                  vmState: {
                    connected: false,
                    selectedVM: null,
                    connectionStatus: 'error',
                    errorMessage: message || 'Unknown error',
                  }
                }))
              } else if (status === 'disconnected') {
                vmConnectedRef.current = false
                writeLine('')
                writeLine('Disconnected from VM.')
                writePrompt()
                // Update global state
                setState(prev => ({
                  ...prev,
                  vmState: {
                    connected: false,
                    selectedVM: null,
                    connectionStatus: 'disconnected',
                    errorMessage: null,
                  }
                }))
              }
            }
          })
          
          sshClientRef.current.connect()
          return
        }
        
        // Show VM selection menu if not a connect command
        if (trimmedCommand === 'help' || trimmedCommand === 'list' || trimmedCommand === '') {
          const vmList = getVMList()
          writeLine('Available VMs:')
          vmList.forEach(vm => {
            writeLine(`  ${vm.id} - ${vm.name}`)
          })
          writeLine('')
          writeLine('To connect: connect <vm-id>')
          writeLine('Example: connect vm1')
          writePrompt()
          return
        }
        
        // Check if it's a mode switch command before showing error
        if (!trimmedCommand.toLowerCase().startsWith('mode ')) {
          writeLine(`Unknown command: ${trimmedCommand}`)
          writeLine('Type "help" to see available VMs.')
          writePrompt()
          return
        }
        // If it's a mode command, fall through to planCommand below
      }

      // If in VM mode and connected, don't process commands here
      // Input is handled directly in onData handler below
      if (isVMMode && vmConnectedRef.current) {
        return
      }

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
      // If in VM mode and connected to SSH, send all data directly to SSH
      if (stateRef.current.mode === 'vm' && vmConnectedRef.current && sshClientRef.current) {
        // Check for "exit" command to disconnect
        if (data === '\r' && bufferRef.current.trim() === 'exit') {
          bufferRef.current = ''
          terminal.write('\r\n')
          if (sshClientRef.current) {
            sshClientRef.current.disconnect()
            sshClientRef.current = null
          }
          vmConnectedRef.current = false
          return
        }
        
        // Send all input to SSH session
        sshClientRef.current.send(data)
        
        // Update local buffer for exit detection
        if (data === '\r') {
          bufferRef.current = ''
        } else if (data === '\u007F') {
          bufferRef.current = bufferRef.current.slice(0, -1)
        } else if (isPrintable(data)) {
          bufferRef.current += data
        }
        return
      }

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
    } else if (stateRef.current.mode === 'vm') {
      // Show VM selection menu
      const vmList = getVMList()
      writeLine('╔════════════════════════════════════════════╗')
      writeLine('║        VM Terminal Mode                    ║')
      writeLine('║  Connect to a real Linux environment       ║')
      writeLine('╚════════════════════════════════════════════╝')
      writeLine('')
      writeLine('Available VMs:')
      vmList.forEach(vm => {
        writeLine(`  ${vm.id} - ${vm.name}`)
      })
      writeLine('')
      writeLine('Commands:')
      writeLine('  connect <vm-id>  - Connect to a VM')
      writeLine('  help             - Show this menu')
      writeLine('  list             - List available VMs')
      writeLine('  exit             - Disconnect (when connected)')
      writeLine('  mode story       - Return to story mode')
      writeLine('  mode base        - Switch to base mode')
      writeLine('')
      writePrompt()
    } else {
      writePrompt()
    }

    return () => {
      dispose.dispose()
      terminal.dispose()
      window.removeEventListener('resize', handleResize)
      // Cleanup SSH connection if exists
      if (sshClientRef.current) {
        sshClientRef.current.disconnect()
        sshClientRef.current = null
      }
      vmConnectedRef.current = false
    }
  }, [resetState, setState])

  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) {
      return
    }
    
    // Update theme based on mode
    if (state.mode === 'base') {
      terminal.options.theme = baseTheme
    } else if (state.mode === 'vm') {
      terminal.options.theme = vmTheme
    } else {
      terminal.options.theme = storyTheme
    }
    
    // Reset autocomplete when switching modes
    autocompleteRef.current = {
      active: false,
      candidates: [],
      index: -1,
      original: '',
    }
    
    // Disconnect SSH when leaving VM mode
    if (state.mode !== 'vm' && sshClientRef.current) {
      sshClientRef.current.disconnect()
      sshClientRef.current = null
      vmConnectedRef.current = false
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
          {state.mode === 'story' && 'Story mode online'}
          {state.mode === 'base' && 'Base mode online'}
          {state.mode === 'vm' && (state.vmState.connected ? `VM mode - Connected to ${state.vmState.selectedVM}` : 'VM mode online')}
        </div>
      </div>
      <div className="terminal__body">
        <div className="terminal__xterm" ref={containerRef} />
      </div>
    </section>
  )
}

export default TerminalPanel
