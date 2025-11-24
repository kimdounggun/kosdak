'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'

export default function Home() {
  const router = useRouter()
  const { isAuthenticated, token } = useAuthStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const timer = setTimeout(() => {
      if (isAuthenticated && token) {
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [isAuthenticated, token, mounted, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Kosdak Bot</h1>
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  )
}

