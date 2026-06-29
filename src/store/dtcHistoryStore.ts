import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DTCCodeDTO } from '../types/obd'

export interface ClearedDTCEntry {
  clearedAt: string
  codes: DTCCodeDTO[]
}

interface DTCHistoryState {
  history: ClearedDTCEntry[]
  addEntry: (codes: DTCCodeDTO[]) => void
  clearHistory: () => void
}

export const useDTCHistoryStore = create<DTCHistoryState>()(
  persist(
    (set) => ({
      history: [],
      addEntry: (codes) =>
        set((state) => ({
          history: [
            { clearedAt: new Date().toISOString(), codes },
            ...state.history,
          ].slice(0, 20),
        })),
      clearHistory: () => set({ history: [] }),
    }),
    { name: 'obdii-dtc-history' }
  )
)
