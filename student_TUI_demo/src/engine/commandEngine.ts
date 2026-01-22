import type { StoredState } from '../types'
import { defaultState } from './state'
import { getStoryStep, storySteps } from './story'

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
]

const helpLines = ['Available commands:', ...commandDefinitions.map((entry) => entry.usage)]

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
      outputs: [{ lines: ['Unknown command. Type "help".'] }],
      showStoryPrompt: true,
      resetTerminal: false,
    }
  }

  if (parsed.id === 'reset') {
    return {
      nextState: defaultState,
      outputs: [{ lines: ['System reset.', 'Story mode restarted.'] }],
      showStoryPrompt: true,
      resetTerminal: true,
    }
  }

  if (parsed.id === 'help') {
    return {
      nextState: state,
      outputs: [
        { lines: helpLines },
        { lines: [`Story hint: ${step.hint}`] },
      ],
      showStoryPrompt: false,
      resetTerminal: false,
    }
  }

  if (!step.expects(parsed.id)) {
    return {
      nextState: state,
      outputs: [
        { lines: ['Story mode lock: follow the mission order.'] },
        { lines: [`Try: ${step.hint}`] },
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
    outputs.push({ lines: ['Agent workspace created.', 'Subsystems online.'] })
  }

  if (parsed.id === 'set-name') {
    const name = parsed.value?.trim() ?? ''
    nextState.agentConfig.name = name || null
    outputs.push({ lines: [`Name locked: ${name || 'unknown'}.`] })
  }

  if (parsed.id === 'set-task') {
    const task = parsed.value?.trim() ?? ''
    nextState.agentConfig.task = task || null
    outputs.push({ lines: [`Mission profile: ${task || 'unknown'}.`] })
  }

  if (parsed.id === 'set-memory') {
    nextState.agentConfig.memory = parsed.value === 'on'
    outputs.push({
      lines: [
        `Memory module: ${nextState.agentConfig.memory ? 'online' : 'offline'}.`,
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
              'Build failed: missing config.',
              'Complete init, name, and task first.',
            ],
          },
        ],
        showStoryPrompt: true,
        resetTerminal: false,
      }
    }

    outputs.push({ lines: ['Compiling agent core...'], delay: 200 })
    outputs.push({ lines: ['Linking memory module...'], delay: 500 })
    outputs.push({ lines: ['Packaging binary...'], delay: 600 })
    outputs.push({ lines: ['Build successful. Artifact created.'], delay: 400 })
    nextState.agentConfig.built = true
  }

  if (parsed.id === 'run') {
    if (!nextState.agentConfig.built) {
      return {
        nextState: state,
        outputs: [{ lines: ['Run blocked: build the agent first.'] }],
        showStoryPrompt: true,
        resetTerminal: false,
      }
    }
    outputs.push({ lines: ['Launching runtime preview...'], delay: 200 })
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
