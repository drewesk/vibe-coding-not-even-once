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

export type Mode = 'story' | 'base'

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

export type StoredState = {
  agentConfig: AgentConfig
  storyIndex: number
  runtimeOpen: boolean
  messages: ChatMessage[]
  matrix: MatrixSettings
  mode: Mode
  base: BaseState
}
