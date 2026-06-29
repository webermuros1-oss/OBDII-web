import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface VehicleProfile {
  id: string
  make: string
  model: string
  year: string
  engine: string
  fuel: 'Gasolina' | 'Diésel' | 'Híbrido' | 'Eléctrico'
}

interface VehicleProfileState {
  profiles: VehicleProfile[]
  activeId: string | null
  getActiveProfile: () => VehicleProfile | null
  addProfile: (p: Omit<VehicleProfile, 'id'>) => string
  updateProfile: (id: string, p: Partial<Omit<VehicleProfile, 'id'>>) => void
  deleteProfile: (id: string) => void
  setActive: (id: string) => void
  setProfile: (p: Partial<Omit<VehicleProfile, 'id'>>) => void
}

export const useVehicleProfileStore = create<VehicleProfileState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeId: null,

      getActiveProfile: () => {
        const { profiles, activeId } = get()
        return profiles.find((p) => p.id === activeId) ?? null
      },

      addProfile: (p) => {
        const id = Date.now().toString()
        const newProfile: VehicleProfile = { id, ...p }
        set((state) => {
          const isFirst = state.profiles.length === 0
          return {
            profiles: [...state.profiles, newProfile],
            activeId: isFirst ? id : state.activeId,
          }
        })
        return id
      },

      updateProfile: (id, p) => {
        set((state) => ({
          profiles: state.profiles.map((profile) =>
            profile.id === id ? { ...profile, ...p } : profile
          ),
        }))
      },

      deleteProfile: (id) => {
        set((state) => {
          const filtered = state.profiles.filter((p) => p.id !== id)
          let nextActiveId = state.activeId
          if (state.activeId === id) {
            const deletedIndex = state.profiles.findIndex((p) => p.id === id)
            const next = filtered[deletedIndex] ?? filtered[deletedIndex - 1] ?? null
            nextActiveId = next?.id ?? null
          }
          return { profiles: filtered, activeId: nextActiveId }
        })
      },

      setActive: (id) => {
        set({ activeId: id })
      },

      setProfile: (p) => {
        const { activeId, profiles } = get()
        if (activeId && profiles.find((pr) => pr.id === activeId)) {
          set((state) => ({
            profiles: state.profiles.map((profile) =>
              profile.id === activeId ? { ...profile, ...p } : profile
            ),
          }))
        } else {
          const id = Date.now().toString()
          const newProfile: VehicleProfile = {
            id,
            make: '',
            model: '',
            year: '',
            engine: '',
            fuel: 'Gasolina',
            ...p,
          }
          set((state) => ({
            profiles: [...state.profiles, newProfile],
            activeId: id,
          }))
        }
      },
    }),
    { name: 'obdii-vehicle-profiles' }
  )
)
