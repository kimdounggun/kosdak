'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import SymbolCard from '@/components/Dashboard/SymbolCard'
import { TrendingUp, AlertCircle } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const { isAuthenticated, user, token } = useAuthStore()
  const [symbols, setSymbols] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    // 토큰과 인증 상태 둘 다 확인
    if (!isAuthenticated || !token) {
      router.push('/login')
      return
    }

    loadUserSymbols()
  }, [mounted, isAuthenticated, token])

  const loadUserSymbols = async () => {
    try {
      const response = await api.get('/symbols/user/my-symbols')
      console.log('User symbols response:', response.data)
      // symbolId가 null이 아닌 것만 필터링
      const validSymbols = response.data.filter((userSymbol: any) => userSymbol.symbolId != null)
      setSymbols(validSymbols)
    } catch (error: any) {
      console.error('Failed to load symbols:', error.response?.data || error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!mounted || !isAuthenticated || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-primary-500" />
              관심종목 대시보드
            </h1>
            <p className="text-gray-400 mt-2">
              {user?.name}님, 환영합니다! 지연 시세 기반으로 실시간 분석을 제공합니다.
            </p>
          </div>

          <button
            onClick={() => router.push('/symbols/add')}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition"
          >
            + 종목 추가
          </button>
        </div>

        {/* Info Banner */}
        <div className="glass rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
          <div className="text-sm">
            <p className="text-yellow-500 font-semibold">지연 시세 안내</p>
            <p className="text-gray-400 mt-1">
              현재 제공되는 시세는 10~20분 지연된 데이터입니다.
              스윙/단기/중기 투자용 분석 서비스이며, 실시간 단타 매매용이 아닙니다.
            </p>
          </div>
        </div>

        {/* Symbols Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass rounded-xl p-6 animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : symbols.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <p className="text-gray-400 mb-4">등록된 관심종목이 없습니다</p>
            <button
              onClick={() => router.push('/symbols/add')}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition"
            >
              첫 종목 추가하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {symbols.map((userSymbol) => (
              <SymbolCard
                key={userSymbol._id}
                symbol={userSymbol.symbolId}
                onClick={() => router.push(`/symbols/${userSymbol.symbolId._id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

