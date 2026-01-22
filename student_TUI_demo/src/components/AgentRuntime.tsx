import { useEffect, useRef, useState } from 'react'
import { StoredState } from '../types'
import { formatAgentName } from '../engine/utils'
import { getAgentResponse } from '../services/llmAdapter'

type AgentRuntimeProps = {
  state: StoredState
  setState: React.Dispatch<React.SetStateAction<StoredState>>
}

const AgentRuntime = ({ state, setState }: AgentRuntimeProps) => {
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const logRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [state.messages, typing])

  const appendMessage = (message: StoredState['messages'][number]) => {
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
    }))
  }

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || typing) {
      return
    }

    const userMessage = { role: 'user' as const, content: trimmed }
    appendMessage(userMessage)
    setInput('')
    setTyping(true)

    const response = await getAgentResponse(
      [...state.messages, userMessage],
      state.agentConfig,
    )
    appendMessage({ role: 'agent', content: response })
    setTyping(false)
  }

  return (
    <div className="runtime">
      <div className="runtime__header">
        <div>
          <div className="runtime__name">{formatAgentName(state.agentConfig)}</div>
          <div className="runtime__task">
            Task: {state.agentConfig.task ?? 'Unassigned'}
          </div>
        </div>
        <div className="runtime__status">
          <span className="runtime__dot" />
          online
        </div>
      </div>
      <div className="runtime__log" ref={logRef}>
        {state.messages.length === 0 ? (
          <div className="runtime__empty">
            Awaiting input. Tell the agent what to do.
          </div>
        ) : (
          state.messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`runtime__message runtime__message--${message.role}`}
            >
              <span className="runtime__role">
                {message.role === 'user' ? 'You' : 'Agent'}
              </span>
              {message.content}
            </div>
          ))
        )}
        {typing && <div className="runtime__typing">Agent is thinking...</div>}
      </div>
      <div className="runtime__input">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleSend()
            }
          }}
          placeholder="Ask the agent to act..."
        />
        <button type="button" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  )
}

export default AgentRuntime
