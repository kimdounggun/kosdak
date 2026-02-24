'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAuthenticated } from '@/stores/authStore'
import LoadingSpinner from '@/components/common/LoadingSpinner'

export default function Home() {
  const router = useRouter()
  const { isHydrated } = useIsAuthenticated()

  useEffect(() => {
    if (!isHydrated) return
    // 포트폴리오용: 로그인 여부와 관계없이 대시보드로 진입
    router.push('/dashboard')
  }, [isHydrated, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-dark-100">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-[#00E5A8] to-[#00D1FF] bg-clip-text text-transparent">
          KOSDAK
        </h1>
        <p className="text-xs text-gray-500 mb-6">AI 주식 분석 플랫폼</p>
        <LoadingSpinner message="초기화 중..." size="md" />
      </div>
    </div>
  )
}

