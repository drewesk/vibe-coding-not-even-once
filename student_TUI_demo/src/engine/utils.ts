import { AgentConfig } from '../types'

export const getArtifactName = (config: AgentConfig) => {
  const base = config.name?.trim() || 'agent'
  return `agent-${base}.bin`
}

export const formatAgentName = (config: AgentConfig) =>
  config.name?.trim() || 'Unnamed Agent'
