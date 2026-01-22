import { AgentConfig, ChatMessage } from '../types'

const summarizerReply = (input: string) =>
  `Summary: ${input.slice(0, 120)}${input.length > 120 ? '…' : ''}`

const defaultReply = (task: string | null, input: string) =>
  `Agent response for "${task || 'general'}": ${input}`

export const getAgentResponse = async (
  messages: ChatMessage[],
  config: AgentConfig,
): Promise<string> => {
  const latest = messages[messages.length - 1]?.content || ''
  const task = config.task?.toLowerCase() || ''

  await new Promise((resolve) => setTimeout(resolve, 500))

  if (task.includes('summarize')) {
    return summarizerReply(latest)
  }

  if (task.includes('classify')) {
    return `Classification: ${latest.split(' ')[0] || 'unknown'}`
  }

  return defaultReply(config.task, latest)
}
