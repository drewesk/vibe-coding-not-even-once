import { AgentConfig, StoredState } from '../types'

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
}
