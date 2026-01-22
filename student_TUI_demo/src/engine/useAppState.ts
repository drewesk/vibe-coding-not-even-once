import { useEffect, useState } from 'react'
import type { StoredState } from '../types'
import { defaultState } from './state'
import { loadStoredState, saveStoredState } from './storage'

export const useAppState = () => {
  const [state, setState] = useState<StoredState>(() => loadStoredState())

  useEffect(() => {
    saveStoredState(state)
  }, [state])

  const resetState = () => {
    setState(defaultState)
    saveStoredState(defaultState)
  }

  return { state, setState, resetState }
}
