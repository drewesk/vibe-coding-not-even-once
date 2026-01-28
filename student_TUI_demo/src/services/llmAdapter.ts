import type { AgentConfig, ChatMessage } from '../types'

const LLAMA_API_URL = 'https://api.llama.com/v1/chat/completions'
const LLAMA_MODEL = 'Llama-4-Scout-17B-16E-Instruct-FP8'

const summarizerReply = (input: string) =>
  `Summary: ${input.slice(0, 120)}${input.length > 120 ? '…' : ''}`

const defaultReply = (task: string | null, input: string) =>
  `Agent response for "${task || 'general'}": ${input}`

const mapRole = (role: ChatMessage['role']) =>
  role === 'agent' ? 'assistant' : 'user'

const buildMessages = (messages: ChatMessage[], config: AgentConfig) => {
  const mapped = messages.map((message) => ({
    role: mapRole(message.role),
    content: message.content,
  }))

  if (config.task) {
    return [
      { role: 'system', content: `You are an assistant. Task: ${config.task}` },
      ...mapped,
    ]
  }

  return mapped
}

const extractReply = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const completion = (payload as { completion_message?: unknown }).completion_message
  if (!completion || typeof completion !== 'object') {
    return null
  }

  const content = (completion as { content?: unknown }).content
  if (!content || typeof content !== 'object') {
    return null
  }

  const text = (content as { text?: unknown }).text
  return typeof text === 'string' ? text : null
}

export const getAgentResponse = async (
  messages: ChatMessage[],
  config: AgentConfig,
): Promise<string> => {
  const latest = messages[messages.length - 1]?.content || ''
  const task = config.task?.toLowerCase() || ''
  const apiKey = import.meta.env.VITE_LLAMA_API_KEY

  if (!apiKey) {
    await new Promise((resolve) => setTimeout(resolve, 500))

    if (task.includes('summarize')) {
      return summarizerReply(latest)
    }

    if (task.includes('classify')) {
      return `Classification: ${latest.split(' ')[0] || 'unknown'}`
    }

    return defaultReply(config.task, latest)
  }

  try {
    const response = await fetch(LLAMA_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: LLAMA_MODEL,
        messages: buildMessages(messages, config),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return `LLM error (${response.status}): ${errorText}`
    }

    const data = (await response.json()) as unknown
    const text = extractReply(data)
    return text ?? 'LLM response missing text.'
  } catch (error) {
    return `LLM request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}
