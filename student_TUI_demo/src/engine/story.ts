export type StoryStep = {
  id: string
  promptLines: string[]
  hint: string
  expects: (command: string) => boolean
}

export const storySteps: StoryStep[] = [
  {
    id: 'init',
    promptLines: [
      'Welcome to AgentCLI v1.0',
      'Story mode engaged. We will forge your first agent.',
      'Type: init agent',
    ],
    hint: 'init agent',
    expects: (command) => command === 'init-agent',
  },
  {
    id: 'name',
    promptLines: ['Name your agent.', 'Try: set name helper'],
    hint: 'set name helper',
    expects: (command) => command === 'set-name',
  },
  {
    id: 'task',
    promptLines: ['Define its mission.', 'Try: set task summarize'],
    hint: 'set task summarize',
    expects: (command) => command === 'set-task',
  },
  {
    id: 'memory',
    promptLines: ['Enable memory module.', 'Try: set memory on'],
    hint: 'set memory on',
    expects: (command) => command === 'set-memory',
  },
  {
    id: 'build',
    promptLines: ['Time to compile.', 'Run: build'],
    hint: 'build',
    expects: (command) => command === 'build',
  },
  {
    id: 'run',
    promptLines: ['Binary ready. Launch it.', 'Run: run'],
    hint: 'run',
    expects: (command) => command === 'run',
  },
  {
    id: 'complete',
    promptLines: ['Agent online. Interact in the preview bay.'],
    hint: 'run',
    expects: () => false,
  },
]

export const getStoryStep = (index: number) =>
  storySteps[Math.min(index, storySteps.length - 1)]
