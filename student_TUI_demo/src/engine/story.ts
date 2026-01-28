const ANSI_RESET = '\u001b[0m'
const ANSI_RED = '\u001b[31m'
const ANSI_CYAN = '\u001b[36m'
const ANSI_YELLOW = '\u001b[93m'

const colorize = (value: string, color: string) => `${color}${value}${ANSI_RESET}`
const formatRun = (command: string) => colorize(`Run: ${command}`, ANSI_RED)
const formatStory = (text: string) => colorize(text, ANSI_CYAN)
const formatAlt = (text: string) => colorize(text, ANSI_YELLOW)

export type StoryStep = {
  id: string
  promptLines: string[]
  hint: string
  expects: (command: string) => boolean
  forceClear?: boolean
}

export const storySteps: StoryStep[] = [
  {
    id: 'init',
    promptLines: [
      formatStory('Welcome to AppForge Terminal.'),
      formatStory('Lesson 1: scaffold the agent workspace.'),
      formatStory('We will generate a config, prompt template, and runtime shell.'),
      formatStory('Notice how the CLI mirrors real project bootstrapping.'),
      formatRun('init agent'),
      formatAlt('Alt: help | reset | bonus'),
    ],
    hint: 'init agent',
    expects: (command) => command === 'init-agent',
  },
  {
    id: 'name',
    promptLines: [
      formatStory('Lesson 2: name the agent and the app bundle.'),
      formatStory('Names become identifiers in config and build output.'),
      formatRun('set name progress-board'),
      formatAlt('Alt: help | reset'),
    ],
    hint: 'set name progress-board',
    expects: (command) => command === 'set-name',
  },
  {
    id: 'task',
    promptLines: [
      formatStory('Lesson 3: define the mission prompt.'),
      formatStory('This becomes the system instruction for the agent.'),
      formatStory('Short verbs make outcomes predictable.'),
      formatRun('set task summarize'),
      formatAlt('Alt: help | reset'),
    ],
    hint: 'set task summarize',
    expects: (command) => command === 'set-task',
  },
  {
    id: 'memory',
    promptLines: [
      formatStory('Lesson 4: configure memory storage.'),
      formatStory('Memory decides if the agent can learn over time.'),
      formatRun('set memory on'),
      formatAlt('Alt: help | reset'),
    ],
    hint: 'set memory on',
    expects: (command) => command === 'set-memory',
  },
  {
    id: 'build',
    promptLines: [
      formatStory('Lesson 5: build the agent artifact.'),
      formatStory('We will compile configs into a runnable bundle.'),
      formatStory('Students should track how specs become outputs.'),
      formatRun('build'),
      formatAlt('Alt: help | reset'),
    ],
    hint: 'build',
    expects: (command) => command === 'build',
  },
  {
    id: 'run',
    promptLines: [
      formatStory('Lesson 6: run the agent runtime.'),
      formatStory('This opens the preview bay for live testing.'),
      formatStory('Now students can send real prompts to the agent.'),
      formatRun('run'),
      formatAlt('Alt: help | reset'),
    ],
    hint: 'run',
    expects: (command) => command === 'run',
  },
  {
    id: 'complete',
    promptLines: [
      formatStory('App shipped. Demo the flow to your class.'),
      formatStory('Ask the agent to summarize a real lesson.'),
      formatStory(''),
      formatStory('   █████╗  ██████╗ ███████╗███╗   ██╗████████╗'),
      formatStory('  ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝'),
      formatStory('  ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   '),
      formatStory('  ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   '),
      formatStory('  ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   '),
      formatStory('  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   '),
      formatStory(''),
      formatStory('        STUDENT AGENT APP LIVE'),
      formatStory(''),
      formatStory('   ┌─────────────────────────────┐'),
      formatStory('   │  Modules:                   │'),
      formatStory('   │   • prompt template         │'),
      formatStory('   │   • memory store            │'),
      formatStory('   │   • runtime preview         │'),
      formatStory('   └─────────────────────────────┘'),
      formatStory(''),
      formatStory('   Next: Try a real lesson prompt'),
      formatStory(''),
      formatStory('   Example: "Summarize chapter 3"'),
      formatAlt('Alt: reset lesson'),
    ],
    hint: 'run',
    expects: () => false,
    forceClear: true,
  },
]

export const getStoryStep = (index: number) =>
  storySteps[Math.min(index, storySteps.length - 1)]
