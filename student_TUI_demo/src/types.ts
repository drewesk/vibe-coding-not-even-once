export type AgentConfig = {
  initialized: boolean
  name: string | null
  task: string | null
  memory: boolean
  built: boolean
}

export type ChatMessage = {
  role: 'user' | 'agent'
  content: string
}

export type StoredState = {
  agentConfig: AgentConfig
  storyIndex: number
  runtimeOpen: boolean
  messages: ChatMessage[]
}
