export type AgentConfig = {
  initialized: boolean
  name: string | null
  task: string | null
  memory: boolean
  built: boolean
}

export type MatrixMode = 'calm' | 'pulse' | 'storm'

export type MatrixSettings = {
  enabled: boolean
  mode: MatrixMode
  speed: number
  density: number
}

export type Mode = 'story' | 'base' | 'vm'

export type BaseFsNode =
  | {
      type: 'dir'
      name: string
      children: Record<string, BaseFsNode>
    }
  | {
      type: 'file'
      name: string
      content: string
    }

export type BaseState = {
  cwd: string
  fs: BaseFsNode
}

export type ChatMessage = {
  role: 'user' | 'agent'
  content: string
}

export type VMState = {
  connected: boolean
  selectedVM: string | null
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error'
  errorMessage: string | null
}

export type StoredState = {
  agentConfig: AgentConfig
  storyIndex: number
  runtimeOpen: boolean
  messages: ChatMessage[]
  matrix: MatrixSettings
  mode: Mode
  base: BaseState
  vmState: VMState
}
