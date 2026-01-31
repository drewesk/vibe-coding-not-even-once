import type { StoredState } from '../types'
import { defaultState } from './state'
import { getStoryStep, storySteps } from './story'
import {
  createDefaultBaseFs,
  cloneFs,
  DEFAULT_HOME,
  getNodeAtPath,
  getParentDir,
  resolvePath,
} from './baseFs'
import { formatAlt, formatError, formatOutput, formatStory } from './terminalFormat'

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
  clearTerminal: boolean
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
  'mode story|base',
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

const baseCommandUsages = [
  'help',
  'mode story|base',
  'status',
  'pwd',
  'ls [path]',
  'cd [path]',
  'mkdir <path>',
  'touch <path>',
  'cat <path>',
  'echo <text> [> file]',
  'rm <path>',
  'cp <src> <dest>',
  'mv <src> <dest>',
  'head <file> [n]',
  'tail <file> [n]',
  'wc <file>',
  'grep <pattern> <file>',
  'history',
  'whoami',
  'date',
  'uname',
  'clear',
]

export const baseCommands = Array.from(
  new Set(baseCommandUsages.map((usage) => usage.split(' ')[0])),
)

const baseHelpLines = ['Base mode commands:', ...baseCommandUsages]

const tokenize = (input: string) => {
  const matches = input.match(/"[^"]*"|'[^']*'|\S+/g)
  if (!matches) {
    return []
  }
  return matches.map((token) => token.replace(/^['"]|['"]$/g, ''))
}

const coerceCount = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback
  }
  const parsed = Number(value)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback
  }
  return Math.floor(parsed)
}

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

const parseModeCommand = (raw: string): 'story' | 'base' | 'invalid' | null => {
  const normalized = raw.trim().toLowerCase()
  if (!normalized.startsWith('mode ')) {
    return null
  }
  const value = normalized.slice('mode '.length).trim()
  if (value === 'story' || value === 'base') {
    return value
  }
  return 'invalid'
}

const normalizeBaseState = (state: StoredState) => {
  const hasValidCwd = typeof state.base?.cwd === 'string' && state.base.cwd.trim() !== ''
  const hasValidFs = state.base?.fs && state.base.fs.type === 'dir'
  if (hasValidCwd && hasValidFs) {
    return state
  }
  return {
    ...state,
    base: {
      cwd: hasValidCwd ? state.base.cwd : DEFAULT_HOME,
      fs: hasValidFs ? state.base.fs : createDefaultBaseFs(),
    },
  }
}

const planBaseCommand = (command: string, state: StoredState): CommandPlan => {
  const trimmed = command.trim()
  const hydratedState = normalizeBaseState(state)
  const tokens = tokenize(trimmed)
  if (tokens.length === 0) {
    if (trimmed !== '') {
      return {
        nextState: hydratedState,
        outputs: [{ lines: [formatError('Command parse failed. Try again.')] }],
        showStoryPrompt: false,
        resetTerminal: false,
        clearTerminal: false,
      }
    }
    return {
      nextState: hydratedState,
      outputs: [],
      showStoryPrompt: false,
      resetTerminal: false,
      clearTerminal: false,
    }
  }

  const verb = tokens[0].toLowerCase()
  const args = tokens.slice(1)
  const outputs: OutputStep[] = []
  let nextFs = hydratedState.base.fs
  let nextCwd = hydratedState.base.cwd
  let fsCloned = false

  const ensureClone = () => {
    if (!fsCloned) {
      nextFs = cloneFs(hydratedState.base.fs)
      fsCloned = true
    }
  }

  const finalize = (options?: { clearTerminal?: boolean }) => ({
    nextState: {
      ...hydratedState,
      base: {
        ...hydratedState.base,
        fs: nextFs,
        cwd: nextCwd,
      },
    },
    outputs,
    showStoryPrompt: false,
    resetTerminal: false,
    clearTerminal: options?.clearTerminal ?? false,
  })

  const fail = (message: string) => {
    outputs.push({ lines: [formatError(message)] })
    return finalize()
  }

  if (verb === 'help') {
    outputs.push({ lines: baseHelpLines.map((line) => formatAlt(line)) })
    outputs.push({ lines: [formatAlt('Tip: mode story to return to training.')] })
    return finalize()
  }

  if (verb === 'status') {
    const root = getNodeAtPath(nextFs, '/')
    const rootCount = root && root.type === 'dir' ? Object.keys(root.children).length : 0
    outputs.push({ lines: [formatAlt(`cwd: ${nextCwd || DEFAULT_HOME}`)] })
    outputs.push({ lines: [formatAlt(`root entries: ${rootCount}`)] })
    outputs.push({ lines: [formatAlt('base fs: ready')] })
    return finalize()
  }

  if (verb === 'pwd') {
    outputs.push({ lines: [nextCwd || DEFAULT_HOME] })
    return finalize()
  }

  if (verb === 'ls') {
    const target = resolvePath(nextCwd, args[0] ?? '.')
    const node = getNodeAtPath(nextFs, target)
    if (!node) {
      return fail(`ls: cannot access '${args[0] ?? '.'}': No such file or directory`)
    }
    if (node.type === 'file') {
      outputs.push({ lines: [node.name] })
      return finalize()
    }
    const names = Object.keys(node.children).sort()
    outputs.push({ lines: [names.length > 0 ? names.join('  ') : '(empty)'] })
    return finalize()
  }

  if (verb === 'cd') {
    const target = resolvePath(nextCwd, args[0] ?? DEFAULT_HOME)
    const node = getNodeAtPath(nextFs, target)
    if (!node || node.type !== 'dir') {
      return fail(`cd: no such file or directory: ${args[0] ?? DEFAULT_HOME}`)
    }
    nextCwd = target
    return finalize()
  }

  if (verb === 'mkdir') {
    if (!args[0]) {
      return fail('mkdir: missing operand')
    }
    const target = resolvePath(nextCwd, args[0])
    ensureClone()
    const parentInfo = getParentDir(nextFs, target)
    if (!parentInfo) {
      return fail(`mkdir: cannot create directory '${args[0]}': Invalid path`)
    }
    const { parent, name } = parentInfo
    if (parent.children[name]) {
      return fail(`mkdir: cannot create directory '${args[0]}': File exists`)
    }
    parent.children[name] = { type: 'dir', name, children: {} }
    return finalize()
  }

  if (verb === 'touch') {
    if (!args[0]) {
      return fail('touch: missing file operand')
    }
    const target = resolvePath(nextCwd, args[0])
    ensureClone()
    const parentInfo = getParentDir(nextFs, target)
    if (!parentInfo) {
      return fail(`touch: cannot touch '${args[0]}': Invalid path`)
    }
    const { parent, name } = parentInfo
    const existing = parent.children[name]
    if (existing && existing.type === 'dir') {
      return fail(`touch: cannot touch '${args[0]}': Is a directory`)
    }
    parent.children[name] = existing ?? { type: 'file', name, content: '' }
    return finalize()
  }

  if (verb === 'cat') {
    if (!args[0]) {
      return fail('cat: missing file operand')
    }
    const target = resolvePath(nextCwd, args[0])
    const node = getNodeAtPath(nextFs, target)
    if (!node) {
      return fail(`cat: ${args[0]}: No such file or directory`)
    }
    if (node.type !== 'file') {
      return fail(`cat: ${args[0]}: Is a directory`)
    }
    const lines = node.content === '' ? [] : node.content.split('\n')
    outputs.push({ lines })
    return finalize()
  }

  if (verb === 'echo') {
    const redirectMatch = trimmed.match(/^echo\s+(.+?)\s*(>>|>)\s*(\S.+)$/i)
    if (redirectMatch) {
      const text = redirectMatch[1].replace(/^['"]|['"]$/g, '')
      const targetPath = resolvePath(nextCwd, redirectMatch[3])
      ensureClone()
      const parentInfo = getParentDir(nextFs, targetPath)
      if (!parentInfo) {
        return fail(`echo: cannot write to '${redirectMatch[3]}': Invalid path`)
      }
      const { parent, name } = parentInfo
      const existing = parent.children[name]
      if (existing && existing.type === 'dir') {
        return fail(`echo: ${redirectMatch[3]}: Is a directory`)
      }
      const append = redirectMatch[2] === '>>'
      const content = existing?.type === 'file' ? existing.content : ''
      parent.children[name] = {
        type: 'file',
        name,
        content: append ? `${content}${text}\n` : `${text}\n`,
      }
      return finalize()
    }
    const text = args.join(' ')
    outputs.push({ lines: [text] })
    return finalize()
  }

  if (verb === 'rm') {
    if (!args[0]) {
      return fail('rm: missing operand')
    }
    const target = resolvePath(nextCwd, args[0])
    ensureClone()
    const parentInfo = getParentDir(nextFs, target)
    if (!parentInfo) {
      return fail(`rm: cannot remove '${args[0]}': Invalid path`)
    }
    const { parent, name } = parentInfo
    const existing = parent.children[name]
    if (!existing) {
      return fail(`rm: cannot remove '${args[0]}': No such file or directory`)
    }
    if (existing.type === 'dir' && Object.keys(existing.children).length > 0) {
      return fail(`rm: cannot remove '${args[0]}': Directory not empty`)
    }
    delete parent.children[name]
    return finalize()
  }

  if (verb === 'cp') {
    if (!args[0] || !args[1]) {
      return fail('cp: missing file operand')
    }
    const sourcePath = resolvePath(nextCwd, args[0])
    const sourceNode = getNodeAtPath(nextFs, sourcePath)
    if (!sourceNode) {
      return fail(`cp: cannot stat '${args[0]}': No such file or directory`)
    }
    if (sourceNode.type !== 'file') {
      return fail(`cp: -r not specified; omitting directory '${args[0]}'`)
    }
    const destinationPath = resolvePath(nextCwd, args[1])
    ensureClone()
    const destinationNode = getNodeAtPath(nextFs, destinationPath)
    if (destinationNode && destinationNode.type === 'dir') {
      const targetPath = resolvePath(destinationPath, sourceNode.name)
      const parentInfo = getParentDir(nextFs, targetPath)
      if (!parentInfo) {
        return fail(`cp: cannot copy to '${args[1]}': Invalid path`)
      }
      parentInfo.parent.children[parentInfo.name] = {
        type: 'file',
        name: sourceNode.name,
        content: sourceNode.content,
      }
      return finalize()
    }
    const parentInfo = getParentDir(nextFs, destinationPath)
    if (!parentInfo) {
      return fail(`cp: cannot copy to '${args[1]}': Invalid path`)
    }
    parentInfo.parent.children[parentInfo.name] = {
      type: 'file',
      name: parentInfo.name,
      content: sourceNode.content,
    }
    return finalize()
  }

  if (verb === 'mv') {
    if (!args[0] || !args[1]) {
      return fail('mv: missing file operand')
    }
    const sourcePath = resolvePath(nextCwd, args[0])
    ensureClone()
    const sourceParent = getParentDir(nextFs, sourcePath)
    if (!sourceParent) {
      return fail(`mv: cannot stat '${args[0]}': No such file or directory`)
    }
    const sourceNode = sourceParent.parent.children[sourceParent.name]
    if (!sourceNode) {
      return fail(`mv: cannot stat '${args[0]}': No such file or directory`)
    }
    const destinationPath = resolvePath(nextCwd, args[1])
    const destinationNode = getNodeAtPath(nextFs, destinationPath)
    if (destinationNode && destinationNode.type === 'dir') {
      const targetPath = resolvePath(destinationPath, sourceNode.name)
      const targetParent = getParentDir(nextFs, targetPath)
      if (!targetParent) {
        return fail(`mv: cannot move to '${args[1]}': Invalid path`)
      }
      delete sourceParent.parent.children[sourceParent.name]
      targetParent.parent.children[targetParent.name] = {
        ...sourceNode,
        name: sourceNode.name,
      }
      return finalize()
    }
    if (destinationNode && sourceNode.type === 'dir' && destinationNode.type === 'file') {
      return fail(`mv: cannot overwrite non-directory '${args[1]}' with directory '${args[0]}'`)
    }
    const destinationParent = getParentDir(nextFs, destinationPath)
    if (!destinationParent) {
      return fail(`mv: cannot move to '${args[1]}': Invalid path`)
    }
    delete sourceParent.parent.children[sourceParent.name]
    destinationParent.parent.children[destinationParent.name] = {
      ...sourceNode,
      name: destinationParent.name,
    }
    return finalize()
  }

  if (verb === 'head' || verb === 'tail') {
    if (!args[0]) {
      return fail(`${verb}: missing file operand`)
    }
    const count = coerceCount(args[1], 10)
    const target = resolvePath(nextCwd, args[0])
    const node = getNodeAtPath(nextFs, target)
    if (!node) {
      return fail(`${verb}: cannot open '${args[0]}' for reading: No such file or directory`)
    }
    if (node.type !== 'file') {
      return fail(`${verb}: ${args[0]}: Is a directory`)
    }
    const lines = node.content === '' ? [] : node.content.split('\n')
    const slice = verb === 'head' ? lines.slice(0, count) : lines.slice(-count)
    outputs.push({ lines: slice })
    return finalize()
  }

  if (verb === 'wc') {
    if (!args[0]) {
      return fail('wc: missing file operand')
    }
    const target = resolvePath(nextCwd, args[0])
    const node = getNodeAtPath(nextFs, target)
    if (!node) {
      return fail(`wc: ${args[0]}: No such file or directory`)
    }
    if (node.type !== 'file') {
      return fail(`wc: ${args[0]}: Is a directory`)
    }
    const content = node.content
    const lines = content === '' ? 0 : content.split('\n').length
    const words = content.trim() === '' ? 0 : content.trim().split(/\s+/).length
    const bytes = content.length
    outputs.push({ lines: [`${lines} ${words} ${bytes} ${args[0]}`] })
    return finalize()
  }

  if (verb === 'grep') {
    if (!args[0] || !args[1]) {
      return fail('grep: missing pattern or file operand')
    }
    const target = resolvePath(nextCwd, args[1])
    const node = getNodeAtPath(nextFs, target)
    if (!node) {
      return fail(`grep: ${args[1]}: No such file or directory`)
    }
    if (node.type !== 'file') {
      return fail(`grep: ${args[1]}: Is a directory`)
    }
    let regex: RegExp
    try {
      regex = new RegExp(args[0])
    } catch (error) {
      return fail('grep: invalid pattern')
    }
    const lines = node.content === '' ? [] : node.content.split('\n')
    const matches = lines
      .map((line, index) => ({ line, index: index + 1 }))
      .filter((entry) => regex.test(entry.line))
      .map((entry) => `${entry.index}:${entry.line}`)
    outputs.push({ lines: matches })
    return finalize()
  }

  if (verb === 'whoami') {
    outputs.push({ lines: ['agent'] })
    return finalize()
  }

  if (verb === 'date') {
    outputs.push({ lines: [new Date().toUTCString()] })
    return finalize()
  }

  if (verb === 'uname') {
    outputs.push({ lines: ['AgentCLI 1.0'] })
    return finalize()
  }

  if (verb === 'clear') {
    return finalize({ clearTerminal: true })
  }

  return fail('Unknown command. Type "help" for the base command list.')
}

export const planCommand = (command: string, state: StoredState): CommandPlan => {
  const trimmed = command.trim()
  if (!trimmed) {
    return {
      nextState: state,
      outputs: [],
      showStoryPrompt: false,
      resetTerminal: false,
      clearTerminal: false,
    }
  }

  const modeRequest = parseModeCommand(trimmed)
  if (modeRequest) {
    if (modeRequest === 'invalid') {
      return {
        nextState: state,
        outputs: [{ lines: [formatError('Mode must be "story" or "base".')] }],
        showStoryPrompt: state.mode === 'story',
        resetTerminal: false,
        clearTerminal: false,
      }
    }
    if (state.mode === modeRequest) {
      return {
        nextState: state,
        outputs: [{ lines: [formatAlt(`Mode already set to ${modeRequest}.`)] }],
        showStoryPrompt: modeRequest === 'story',
        resetTerminal: false,
        clearTerminal: false,
      }
    }
    const nextState = { ...state, mode: modeRequest }
    return {
      nextState,
      outputs: [
        { lines: [formatAlt(`Mode switched to ${modeRequest}.`)] },
        {
          lines: [
            formatAlt(
              modeRequest === 'story'
                ? 'Training prompts restored.'
                : 'Base command shell online.',
            ),
          ],
        },
      ],
      showStoryPrompt: modeRequest === 'story',
      resetTerminal: false,
      clearTerminal: false,
    }
  }

  if (state.mode === 'base') {
    return planBaseCommand(trimmed, state)
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
      clearTerminal: false,
    }
  }

  if (parsed.id === 'reset') {
    return {
      nextState: defaultState,
      outputs: [
        {
          lines: [
            formatAlt('System reset.'),
            formatOutput('Story mode restarted. Training bay rebooted.'),
          ],
        },
      ],
      showStoryPrompt: true,
      resetTerminal: true,
      clearTerminal: false,
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
        clearTerminal: false,
      }
    }

    return {
      nextState: defaultState,
      outputs: [
        {
          lines: [
            formatAlt('Lesson reset.'),
            formatOutput('Story mode restarted. Training bay rebooted.'),
          ],
        },
      ],
      showStoryPrompt: true,
      resetTerminal: true,
      clearTerminal: false,
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
      clearTerminal: false,
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
      clearTerminal: false,
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
        clearTerminal: false,
      }
    }

    if (parsed.id === 'matrix-toggle') {
      const enabled = parsed.value === 'on'
      nextState = { ...state, matrix: { ...state.matrix, enabled } }
      outputs.push({
        lines: [formatOutput(`Matrix rain ${enabled ? 'enabled' : 'disabled'}.`)],
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
          clearTerminal: false,
        }
      }
      const mode = modeValue as StoredState['matrix']['mode']
      nextState = { ...state, matrix: { ...state.matrix, mode } }
      outputs.push({ lines: [formatOutput(`Matrix mode set to ${mode}.`)] })
    }

    if (parsed.id === 'matrix-speed') {
      const value = Number(parsed.value)
      if (Number.isNaN(value)) {
        return {
          nextState: state,
          outputs: [{ lines: [formatAlt('Matrix speed expects a number (1-5).')] }],
          showStoryPrompt: false,
          resetTerminal: false,
          clearTerminal: false,
        }
      }
      const speedValue = Number(clampRange(value, 1, 5).toFixed(2))
      nextState = { ...state, matrix: { ...state.matrix, speed: speedValue } }
      outputs.push({ lines: [formatOutput(`Matrix speed set to ${speedValue}.`)] })
    }

    if (parsed.id === 'matrix-density') {
      const value = Number(parsed.value)
      if (Number.isNaN(value)) {
        return {
          nextState: state,
          outputs: [{ lines: [formatAlt('Matrix density expects a number (1-5).')] }],
          showStoryPrompt: false,
          resetTerminal: false,
          clearTerminal: false,
        }
      }
      const densityValue = Number(clampRange(value, 1, 5).toFixed(2))
      nextState = { ...state, matrix: { ...state.matrix, density: densityValue } }
      outputs.push({ lines: [formatOutput(`Matrix density set to ${densityValue}.`)] })
    }

    return {
      nextState,
      outputs,
      showStoryPrompt: false,
      resetTerminal: false,
      clearTerminal: false,
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
      clearTerminal: false,
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
    outputs.push({ lines: [formatOutput('Scaffolding workspace...')], delay: 150 })
    outputs.push({ lines: [formatOutput('Created: agent.config.json')], delay: 300 })
    outputs.push({ lines: [formatOutput('Created: prompts/system.txt')], delay: 300 })
    outputs.push({ lines: [formatOutput('Created: runtime/preview.stub')], delay: 300 })
    outputs.push({ lines: [formatOutput('Subsystems online.')], delay: 250 })
  }

  if (parsed.id === 'set-name') {
    const name = parsed.value?.trim() ?? ''
    nextState.agentConfig.name = name || null
    outputs.push({ lines: [formatOutput(`Name locked: ${name || 'unknown'}.`)], delay: 200 })
    outputs.push({
      lines: [formatOutput(`Bundle id: ${name ? `${name}-agent` : 'unknown-agent'}.`)],
      delay: 250,
    })
  }

  if (parsed.id === 'set-task') {
    const task = parsed.value?.trim() ?? ''
    nextState.agentConfig.task = task || null
    outputs.push({ lines: [formatOutput(`Mission profile: ${task || 'unknown'}.`)], delay: 200 })
    outputs.push({
      lines: [formatOutput('Prompt template updated in prompts/system.txt.')],
      delay: 300,
    })
  }

  if (parsed.id === 'set-memory') {
    nextState.agentConfig.memory = parsed.value === 'on'
    outputs.push({
      lines: [
        formatOutput(`Memory module: ${nextState.agentConfig.memory ? 'online' : 'offline'}.`),
      ],
      delay: 200,
    })
    outputs.push({
      lines: [
        formatOutput(
          nextState.agentConfig.memory
            ? 'Storage ready: memory/session.log'
            : 'Storage disabled: sessions will be stateless.',
        ),
      ],
      delay: 300,
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
        clearTerminal: false,
      }
    }

    outputs.push({ lines: [formatOutput('Compiling agent core...')], delay: 200 })
    outputs.push({ lines: [formatOutput('Linking memory module...')], delay: 400 })
    outputs.push({ lines: [formatOutput('Bundling prompt template...')], delay: 400 })
    outputs.push({ lines: [formatOutput('Writing build output: dist/agent.bundle')], delay: 500 })
    outputs.push({ lines: [formatOutput('Build successful. Artifact created.')], delay: 300 })
    nextState.agentConfig.built = true
  }

  if (parsed.id === 'run') {
    if (!nextState.agentConfig.built) {
      return {
        nextState: state,
        outputs: [{ lines: [formatAlt('Run blocked: build the agent first.')] }],
        showStoryPrompt: true,
        resetTerminal: false,
        clearTerminal: false,
      }
    }
    outputs.push({ lines: [formatOutput('Launching runtime preview...')], delay: 200 })
    outputs.push({ lines: [formatOutput('Preview bay online. Awaiting first prompt.')], delay: 400 })
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
    clearTerminal: false,
  }
}
