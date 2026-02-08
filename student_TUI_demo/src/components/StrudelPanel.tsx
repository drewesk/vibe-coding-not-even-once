const StrudelPanel = () => {
  return (
    <section className="strudel-panel">
      <header className="strudel-panel__header">
        <div>
          <span className="strudel-panel__title">Strudel Sandbox</span>
          <span className="strudel-panel__subtitle">Full REPL</span>
        </div>
        <div className="strudel-panel__badge">Live Music</div>
      </header>
      <div className="strudel-panel__body">
        <iframe
          className="strudel-panel__frame"
          src="https://strudel.cc/"
          title="Strudel REPL"
          loading="lazy"
          allow="autoplay; clipboard-read; clipboard-write; midi"
        />
      </div>
    </section>
  )
}

export default StrudelPanel
