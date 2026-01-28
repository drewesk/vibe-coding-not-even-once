import type { StoredState } from '../types'
import { defaultState } from './state'
import { getStoryStep, storySteps } from './story'

const ANSI_RESET = '\u001b[0m'
const ANSI_CYAN = '\u001b[36m'
const ANSI_YELLOW = '\u001b[93m'

const colorize = (value: string, color: string) => `${color}${value}${ANSI_RESET}`
const formatStory = (text: string) => colorize(text, ANSI_CYAN)
const formatAlt = (text: string) => colorize(text, ANSI_YELLOW)

const clampRange = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export type OutputStep = {
  lines: string[]
  delay?: number
  stream?: boolean
  charDelay?: number
  lineDelay?: number
}

export type CommandPlan = {
  nextState: StoredState
  outputs: OutputStep[]
  showStoryPrompt: boolean
  resetTerminal: boolean
}

type CommandMatch = {
  id: string
  raw: string
  value?: string
}

type CommandDefinition = {
  id: string
  usage: string
  match: (raw: string, normalized: string) => CommandMatch | null
}

const commandDefinitions: CommandDefinition[] = [
  {
    id: 'help',
    usage: 'help',
    match: (raw, normalized) =>
      normalized === 'help' ? { id: 'help', raw } : null,
  },
  {
    id: 'init-agent',
    usage: 'init agent',
    match: (raw, normalized) =>
      normalized === 'init agent' ? { id: 'init-agent', raw } : null,
  },
  {
    id: 'set-name',
    usage: 'set name <value>',
    match: (raw, normalized) =>
      normalized.startsWith('set name ')
        ? { id: 'set-name', raw, value: raw.slice('set name '.length).trim() }
        : null,
  },
  {
    id: 'set-task',
    usage: 'set task <value>',
    match: (raw, normalized) =>
      normalized.startsWith('set task ')
        ? { id: 'set-task', raw, value: raw.slice('set task '.length).trim() }
        : null,
  },
  {
    id: 'set-memory',
    usage: 'set memory on/off',
    match: (raw, normalized) => {
      if (normalized === 'set memory on') {
        return { id: 'set-memory', raw, value: 'on' }
      }
      if (normalized === 'set memory off') {
        return { id: 'set-memory', raw, value: 'off' }
      }
      return null
    },
  },
  {
    id: 'build',
    usage: 'build',
    match: (raw, normalized) =>
      normalized === 'build' ? { id: 'build', raw } : null,
  },
  {
    id: 'run',
    usage: 'run',
    match: (raw, normalized) =>
      normalized === 'run' ? { id: 'run', raw } : null,
  },
  {
    id: 'reset',
    usage: 'reset',
    match: (raw, normalized) =>
      normalized === 'reset' ? { id: 'reset', raw } : null,
  },
  {
    id: 'reset-lesson',
    usage: 'reset lesson',
    match: (raw, normalized) =>
      normalized === 'reset lesson' ? { id: 'reset-lesson', raw } : null,
  },
  {
    id: 'bonus',
    usage: 'bonus',
    match: (raw, normalized) =>
      normalized === 'bonus' ? { id: 'bonus', raw } : null,
  },
  {
    id: 'matrix-status',
    usage: 'matrix',
    match: (raw, normalized) =>
      normalized === 'matrix' || normalized === 'matrix status'
        ? { id: 'matrix-status', raw }
        : null,
  },
  {
    id: 'matrix-toggle',
    usage: 'matrix on/off',
    match: (raw, normalized) => {
      if (normalized === 'matrix on') {
        return { id: 'matrix-toggle', raw, value: 'on' }
      }
      if (normalized === 'matrix off') {
        return { id: 'matrix-toggle', raw, value: 'off' }
      }
      return null
    },
  },
  {
    id: 'matrix-mode',
    usage: 'matrix mode calm|pulse|storm',
    match: (raw, normalized) =>
      normalized.startsWith('matrix mode ')
        ? { id: 'matrix-mode', raw, value: normalized.slice('matrix mode '.length).trim() }
        : null,
  },
  {
    id: 'matrix-speed',
    usage: 'matrix speed <1-5>',
    match: (raw, normalized) =>
      normalized.startsWith('matrix speed ')
        ? { id: 'matrix-speed', raw, value: normalized.slice('matrix speed '.length).trim() }
        : null,
  },
  {
    id: 'matrix-density',
    usage: 'matrix density <1-5>',
    match: (raw, normalized) =>
      normalized.startsWith('matrix density ')
        ? { id: 'matrix-density', raw, value: normalized.slice('matrix density '.length).trim() }
        : null,
  },
]

const helpLines = [
  'Available commands:',
  ...commandDefinitions
    .filter((entry) => !entry.id.startsWith('matrix') && entry.id !== 'bonus')
    .map((entry) => entry.usage),
]

const bonusLines = [
  'Bonus menu: Matrix Rain Controls',
  'matrix on/off',
  'matrix mode calm|pulse|storm',
  'matrix speed <1-5>',
  'matrix density <1-5>',
  'matrix status',
]

const matrixStatusLines = (state: StoredState) => [
  `Matrix rain: ${state.matrix.enabled ? 'on' : 'off'}`,
  `Mode: ${state.matrix.mode}`,
  `Speed: ${state.matrix.speed}`,
  `Density: ${state.matrix.density}`,
]

const parseCommand = (raw: string) => {
  const normalized = raw.toLowerCase()
  for (const definition of commandDefinitions) {
    const match = definition.match(raw, normalized)
    if (match) {
      return match
    }
  }
  return null
}

export const planCommand = (command: string, state: StoredState): CommandPlan => {
  const trimmed = command.trim()
  if (!trimmed) {
    return {
      nextState: state,
      outputs: [],
      showStoryPrompt: false,
      resetTerminal: false,
    }
  }

  const parsed = parseCommand(trimmed)
  const step = getStoryStep(state.storyIndex)

  if (!parsed) {
    return {
      nextState: state,
      outputs: [
        {
          lines: [
            formatAlt('Unknown command. Type "help" for the training list.'),
          ],
        },
      ],
      showStoryPrompt: true,
      resetTerminal: false,
    }
  }

  if (parsed.id === 'reset') {
    return {
      nextState: defaultState,
      outputs: [
        {
          lines: [
            formatAlt('System reset.'),
            formatStory('Story mode restarted. Training bay rebooted.'),
          ],
        },
      ],
      showStoryPrompt: true,
      resetTerminal: true,
    }
  }

  if (parsed.id === 'reset-lesson') {
    if (state.storyIndex !== storySteps.length - 1) {
      return {
        nextState: state,
        outputs: [
          { lines: [formatAlt('Reset lesson is available only at final step.')] },
        ],
        showStoryPrompt: true,
        resetTerminal: false,
      }
    }

    return {
      nextState: defaultState,
      outputs: [
        {
          lines: [
            formatAlt('Lesson reset.'),
            formatStory('Story mode restarted. Training bay rebooted.'),
          ],
        },
      ],
      showStoryPrompt: true,
      resetTerminal: true,
    }
  }

  if (parsed.id === 'help') {
    return {
      nextState: state,
      outputs: [
        { lines: helpLines.map((line) => formatAlt(line)) },
        { lines: [formatAlt(`Story hint: ${step.hint}`)] },
        { lines: [formatAlt('Tip: follow the prompts to advance.')] },
      ],
      showStoryPrompt: false,
      resetTerminal: false,
    }
  }

  if (parsed.id === 'bonus') {
    return {
      nextState: state,
      outputs: [
        { lines: bonusLines.map((line) => formatAlt(line)) },
        { lines: matrixStatusLines(state).map((line) => formatAlt(line)) },
      ],
      showStoryPrompt: false,
      resetTerminal: false,
    }
  }

  if (parsed.id.startsWith('matrix')) {
    let nextState = state
    const outputs: OutputStep[] = []
    const modeChoices: Array<StoredState['matrix']['mode']> = ['calm', 'pulse', 'storm']

    if (parsed.id === 'matrix-status') {
      outputs.push({ lines: matrixStatusLines(state).map((line) => formatAlt(line)) })
      return {
        nextState: state,
        outputs,
        showStoryPrompt: false,
        resetTerminal: false,
      }
    }

    if (parsed.id === 'matrix-toggle') {
      const enabled = parsed.value === 'on'
      nextState = { ...state, matrix: { ...state.matrix, enabled } }
      outputs.push({
        lines: [formatStory(`Matrix rain ${enabled ? 'enabled' : 'disabled'}.`)],
      })
    }

    if (parsed.id === 'matrix-mode') {
      const modeValue = (parsed.value ?? '').toLowerCase()
      if (!modeChoices.includes(modeValue as StoredState['matrix']['mode'])) {
        return {
          nextState: state,
          outputs: [
            {
              lines: [
                formatAlt('Matrix mode invalid. Use calm, pulse, or storm.'),
              ],
            },
          ],
          showStoryPrompt: false,
          resetTerminal: false,
        }
      }
      const mode = modeValue as StoredState['matrix']['mode']
      nextState = { ...state, matrix: { ...state.matrix, mode } }
      outputs.push({ lines: [formatStory(`Matrix mode set to ${mode}.`)] })
    }

    if (parsed.id === 'matrix-speed') {
      const value = Number(parsed.value)
      if (Number.isNaN(value)) {
        return {
          nextState: state,
          outputs: [{ lines: [formatAlt('Matrix speed expects a number (1-5).')] }],
          showStoryPrompt: false,
          resetTerminal: false,
        }
      }
      const speedValue = Number(clampRange(value, 1, 5).toFixed(2))
      nextState = { ...state, matrix: { ...state.matrix, speed: speedValue } }
      outputs.push({ lines: [formatStory(`Matrix speed set to ${speedValue}.`)] })
    }

    if (parsed.id === 'matrix-density') {
      const value = Number(parsed.value)
      if (Number.isNaN(value)) {
        return {
          nextState: state,
          outputs: [{ lines: [formatAlt('Matrix density expects a number (1-5).')] }],
          showStoryPrompt: false,
          resetTerminal: false,
        }
      }
      const densityValue = Number(clampRange(value, 1, 5).toFixed(2))
      nextState = { ...state, matrix: { ...state.matrix, density: densityValue } }
      outputs.push({ lines: [formatStory(`Matrix density set to ${densityValue}.`)] })
    }

    return {
      nextState,
      outputs,
      showStoryPrompt: false,
      resetTerminal: false,
    }
  }

  if (!step.expects(parsed.id)) {
    return {
      nextState: state,
      outputs: [
        { lines: [formatStory('Story mode lock: follow the mission order.')] },
        { lines: [formatAlt(`Try: ${step.hint}`)] },
      ],
      showStoryPrompt: true,
      resetTerminal: false,
    }
  }

  let nextState: StoredState = {
    ...state,
    agentConfig: { ...state.agentConfig },
  }
  const outputs: OutputStep[] = []

  if (parsed.id === 'init-agent') {
    nextState.agentConfig.initialized = true
    nextState.agentConfig.built = false
    nextState.runtimeOpen = false
    outputs.push({
      lines: [
        formatStory('Scaffolding workspace...'),
        formatStory('Created: agent.config.json'),
        formatStory('Created: prompts/system.txt'),
        formatStory('Created: runtime/preview.stub'),
        formatStory('Subsystems online.'),
      ],
    })
  }

  if (parsed.id === 'set-name') {
    const name = parsed.value?.trim() ?? ''
    nextState.agentConfig.name = name || null
    outputs.push({
      lines: [
        formatStory(`Name locked: ${name || 'unknown'}.`),
        formatStory(`Bundle id: ${name ? `${name}-agent` : 'unknown-agent'}.`),
      ],
    })
  }

  if (parsed.id === 'set-task') {
    const task = parsed.value?.trim() ?? ''
    nextState.agentConfig.task = task || null
    outputs.push({
      lines: [
        formatStory(`Mission profile: ${task || 'unknown'}.`),
        formatStory('Prompt template updated in prompts/system.txt.'),
      ],
    })
  }

  if (parsed.id === 'set-memory') {
    nextState.agentConfig.memory = parsed.value === 'on'
    outputs.push({
      lines: [
        formatStory(
          `Memory module: ${nextState.agentConfig.memory ? 'online' : 'offline'}.`,
        ),
        formatStory(
          nextState.agentConfig.memory
            ? 'Storage ready: memory/session.log'
            : 'Storage disabled: sessions will be stateless.',
        ),
      ],
    })
  }

  if (parsed.id === 'build') {
    if (
      !nextState.agentConfig.initialized ||
      !nextState.agentConfig.name ||
      !nextState.agentConfig.task
    ) {
      return {
        nextState: state,
        outputs: [
          {
            lines: [
              formatAlt('Build failed: missing config.'),
              formatAlt('Complete init, name, and task first.'),
            ],
          },
        ],
        showStoryPrompt: true,
        resetTerminal: false,
      }
    }

    outputs.push({ lines: [formatStory('Compiling agent core...')], delay: 200 })
    outputs.push({ lines: [formatStory('Linking memory module...')], delay: 400 })
    outputs.push({ lines: [formatStory('Bundling prompt template...')], delay: 400 })
    outputs.push({ lines: [formatStory('Writing build output: dist/agent.bundle')], delay: 500 })
    outputs.push({ lines: [formatStory('Build successful. Artifact created.')], delay: 300 })
    nextState.agentConfig.built = true
  }

  if (parsed.id === 'run') {
    if (!nextState.agentConfig.built) {
      return {
        nextState: state,
        outputs: [{ lines: [formatAlt('Run blocked: build the agent first.')] }],
        showStoryPrompt: true,
        resetTerminal: false,
      }
    }
    outputs.push({
      lines: [
        formatStory('Launching runtime preview...'),
        formatStory('Preview bay online. Awaiting first prompt.'),
      ],
      delay: 200,
    })
    nextState.runtimeOpen = true
  }

  const nextStoryIndex = Math.min(
    state.storyIndex + 1,
    storySteps.length - 1,
  )
  nextState = { ...nextState, storyIndex: nextStoryIndex }

  return {
    nextState,
    outputs,
    showStoryPrompt: true,
    resetTerminal: false,
  }
}
