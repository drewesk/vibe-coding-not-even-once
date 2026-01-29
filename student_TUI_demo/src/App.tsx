import './App.css'
import TerminalPanel from './components/TerminalPanel'
import PreviewPanel from './components/PreviewPanel'
import { useAppState } from './engine/useAppState'
import MatrixRain from './components/MatrixRain'

function App() {
  const { state, setState, resetState } = useAppState()

  return (
    <div className="app">
      <MatrixRain
        enabled={state.matrix.enabled}
        mode={state.matrix.mode}
        speed={state.matrix.speed}
        density={state.matrix.density}
        className={`app__matrix ${state.matrix.enabled ? 'app__matrix--active' : 'app__matrix--off'}`}
      />
      <header className="app__header">
        <div>
          <h1>AgentCLI v1.0</h1>
          <p>Build your first AI agent step by step.</p>
        </div>
        <div className="app__meta">Local persistence: online</div>
      </header>
      <main className="app__main">
        <TerminalPanel state={state} setState={setState} resetState={resetState} />
        <PreviewPanel state={state} setState={setState} />
      </main>
    </div>
  )
}

export default App
