import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface User {
  id: string
  email: string
  name: string
  phoneNumber?: string
}

interface AuthState {
  user: User | null
  token: string | null
  _hasHydrated: boolean
  setHasHydrated: (state: boolean) => void
  setAuth: (token: string, user: User) => void
  logout: () => void
  login: (email: string, password: string) => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      _hasHydrated: false,

      setHasHydrated: (state) => {
        set({ _hasHydrated: state })
      },

      setAuth: (token, user) => {
        set({ token, user })
      },

      logout: () => {
        set({ token: null, user: null })
      },

      login: async (email, password) => {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })

        if (!response.ok) {
          throw new Error('로그인 실패')
        }

        const data = await response.json()
        set({ token: data.accessToken, user: data.user })
      },
    }),
    {
      name: 'kosdak-auth-storage',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') {
          return localStorage
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)

// Computed getter for isAuthenticated
export const useIsAuthenticated = () => {
  const { token, user, _hasHydrated } = useAuthStore()
  return {
    isAuthenticated: _hasHydrated && !!token && !!user,
    isHydrated: _hasHydrated,
    token,
    user,
  }
}

