import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface VehicleProfile {
  make: string
  model: string
  year: string
  engine: string
  fuel: 'Gasolina' | 'Diésel' | 'Híbrido' | 'Eléctrico'
}

interface VehicleProfileState {
  profile: VehicleProfile
  setProfile: (p: Partial<VehicleProfile>) => void
}

export const useVehicleProfileStore = create<VehicleProfileState>()(
  persist(
    (set) => ({
      profile: { make: '', model: '', year: '', engine: '', fuel: 'Gasolina' },
      setProfile: (p) => set((state) => ({ profile: { ...state.profile, ...p } })),
    }),
    { name: 'obdii-vehicle-profile' }
  )
)
