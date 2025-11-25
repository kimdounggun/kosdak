'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAuthenticated } from '@/stores/authStore'

export default function Home() {
  const router = useRouter()
  const { isAuthenticated, isHydrated } = useIsAuthenticated()

  useEffect(() => {
    if (!isHydrated) return

    if (isAuthenticated) {
      router.push('/dashboard')
    } else {
      router.push('/login')
    }
  }, [isAuthenticated, isHydrated, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Kosdak Bot</h1>
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  )
}

