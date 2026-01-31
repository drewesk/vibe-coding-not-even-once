const ANSI_RESET = '\u001b[0m'
const ANSI_RED = '\u001b[31m'
const ANSI_CYAN = '\u001b[36m'
const ANSI_YELLOW = '\u001b[93m'

export const colorize = (value: string, color: string) => `${color}${value}${ANSI_RESET}`
export const formatRun = (command: string) => colorize(`Run: ${command}`, ANSI_RED)
export const formatStory = (text: string) => colorize(text, ANSI_CYAN)
export const formatAlt = (text: string) => colorize(text, ANSI_YELLOW)
export const formatError = (text: string) => colorize(text, ANSI_RED)
