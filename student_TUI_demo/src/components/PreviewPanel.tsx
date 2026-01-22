import { StoredState } from '../types'
import { formatAgentName, getArtifactName } from '../engine/utils'
import AgentRuntime from './AgentRuntime'

type PreviewPanelProps = {
  state: StoredState
  setState: React.Dispatch<React.SetStateAction<StoredState>>
}

const PreviewPanel = ({ state, setState }: PreviewPanelProps) => {
  const artifactName = getArtifactName(state.agentConfig)
  const handleLaunch = () => {
    if (!state.agentConfig.built) {
      return
    }
    setState((prev) => ({ ...prev, runtimeOpen: true }))
  }

  return (
    <section className="preview">
      <div className="preview__header">
        <div>
          <span className="preview__title">Preview Bay</span>
          <span className="preview__subtitle">Runtime diagnostics</span>
        </div>
        <div className="preview__badge">
          {state.agentConfig.built ? 'artifact ready' : 'awaiting build'}
        </div>
      </div>
      <div className="preview__artifacts">
        <div
          className={`artifact ${
            state.agentConfig.built ? 'artifact--ready' : 'artifact--locked'
          }`}
          onClick={handleLaunch}
          role="button"
          tabIndex={0}
        >
          <div className="artifact__name">{artifactName}</div>
          <div className="artifact__meta">
            {state.agentConfig.built
              ? 'Click to launch'
              : 'Build to unlock'}
          </div>
        </div>
        <div className="artifact__details">
          <div className="artifact__detail">Agent: {formatAgentName(state.agentConfig)}</div>
          <div className="artifact__detail">
            Task: {state.agentConfig.task ?? 'Unassigned'}
          </div>
        </div>
      </div>
      <div className="preview__runtime">
        {state.runtimeOpen ? (
          <AgentRuntime state={state} setState={setState} />
        ) : (
          <div className="preview__placeholder">
            No runtime active. Launch the binary to continue.
          </div>
        )}
      </div>
    </section>
  )
}

export default PreviewPanel
