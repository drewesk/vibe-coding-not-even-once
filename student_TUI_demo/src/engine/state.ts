import type { AgentConfig, StoredState } from '../types'
import { createDefaultBaseFs, DEFAULT_HOME } from './baseFs'

export const defaultAgentConfig: AgentConfig = {
  initialized: false,
  name: null,
  task: null,
  memory: false,
  built: false,
}

export const defaultState: StoredState = {
  agentConfig: defaultAgentConfig,
  storyIndex: 0,
  runtimeOpen: false,
  messages: [],
  matrix: {
    enabled: false,
    mode: 'calm',
    speed: 2,
    density: 2,
  },
  mode: 'story',
  base: {
    cwd: DEFAULT_HOME,
    fs: createDefaultBaseFs(),
  },
}
