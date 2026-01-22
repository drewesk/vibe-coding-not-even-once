import type { StoredState } from '../types'
import { defaultState } from './state'

const STORAGE_KEY = 'agent-cli-state'

export const loadStoredState = (): StoredState => {
  if (typeof window === 'undefined') {
    return defaultState
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return defaultState
    }
    const parsed = JSON.parse(raw) as StoredState
    return {
      ...defaultState,
      ...parsed,
      agentConfig: { ...defaultState.agentConfig, ...parsed.agentConfig },
    }
  } catch (error) {
    console.warn('Failed to load saved state', error)
    return defaultState
  }
}

export const saveStoredState = (state: StoredState) => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('Failed to save state', error)
  }
}
