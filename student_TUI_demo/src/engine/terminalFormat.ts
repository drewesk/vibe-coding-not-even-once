const ANSI_RESET = '\u001b[0m'
const ANSI_RED = '\u001b[31m'
const ANSI_CYAN = '\u001b[36m'
const ANSI_YELLOW = '\u001b[93m'
const ANSI_BLUE = '\u001b[34m'
const ANSI_GREEN = '\u001b[32m'
const ANSI_MAGENTA = '\u001b[35m'

export const colorize = (value: string, color: string) => `${color}${value}${ANSI_RESET}`
export const formatRun = (command: string) => colorize(`Run: ${command}`, ANSI_RED)
export const formatStory = (text: string) => colorize(text, ANSI_CYAN)
export const formatAlt = (text: string) => colorize(text, ANSI_YELLOW)
export const formatError = (text: string) => colorize(text, ANSI_RED)
export const formatOutput = (text: string) => colorize(text, ANSI_MAGENTA)

export const stripAnsi = (value: string) => value.replace(/\u001b\[[0-9;]*m/g, '')

export const highlightBaseLine = (input: string) => {
  let value = stripAnsi(input)
  value = value.replace(/^(\s*)([a-z][\w-]*)/, (_, space, cmd) => {
    return `${space}${colorize(cmd, ANSI_GREEN)}`
  })
  value = value.replace(/(\s)(--?[\w-]+)/g, (_, space, flag) => {
    return `${space}${colorize(flag, ANSI_YELLOW)}`
  })
  value = value.replace(/\[[^\]]+\]/g, (match) => colorize(match, ANSI_MAGENTA))
  value = value.replace(/(^|\s)(\/[^\s]*)/g, (_, space, path) => {
    return `${space}${colorize(path, ANSI_CYAN)}`
  })
  value = value.replace(/\b\d+\b/g, (match) => colorize(match, ANSI_BLUE))
  return value
}
