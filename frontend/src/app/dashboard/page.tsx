'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAuthenticated } from '@/stores/authStore'
import { api } from '@/lib/api'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import SymbolCard from '@/components/Dashboard/SymbolCard'
import { TrendingUp, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function DashboardPage() {
  const router = useRouter()
  const { isAuthenticated, isHydrated, user, token } = useIsAuthenticated()
  const [symbols, setSymbols] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isHydrated) return

    if (!isAuthenticated || !token) {
      router.push('/login')
      return
    }

    loadUserSymbols()
  }, [isHydrated, isAuthenticated, token])

  const loadUserSymbols = async () => {
    try {
      const response = await api.get('/symbols/user/my-symbols')
      // symbolId가 null이 아닌 것만 필터링
      const validSymbols = response.data.filter((userSymbol: any) => userSymbol.symbolId != null)
      setSymbols(validSymbols)
    } catch (error: any) {
      console.error('Failed to load symbols:', error.response?.data || error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSymbol = async (userSymbolId: string) => {
    try {
      await api.delete(`/symbols/user/symbols/${userSymbolId}`)
      toast.success('관심종목에서 제거되었습니다')
      loadUserSymbols() // 목록 새로고침
    } catch (error: any) {
      console.error('Failed to delete symbol:', error)
      toast.error(error.response?.data?.message || '제거 실패')
    }
  }

  if (!isHydrated || !isAuthenticated || !token) {
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
      <div className="space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs sm:text-sm text-gray-400 truncate">
              {user?.name}님 환영합니다
            </p>
          </div>

          <button
            onClick={() => router.push('/symbols/add')}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
          >
            + 종목 추가
          </button>
        </div>

        {/* Info Banner */}
        <div className="glass rounded-lg p-2.5 sm:p-3 flex items-start gap-2 sm:gap-3">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <p className="text-yellow-500 font-semibold">지연 시세 안내</p>
            <p className="text-gray-400 mt-0.5 leading-relaxed">
              10~20분 지연 데이터 · 스윙/중기 투자용
            </p>
          </div>
        </div>

        {/* Symbols Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass rounded-lg p-2.5 sm:p-3 animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : symbols.length === 0 ? (
          <div className="glass rounded-lg p-6 sm:p-8 text-center">
            <p className="text-gray-400 mb-3 text-sm">등록된 관심종목이 없습니다</p>
            <button
              onClick={() => router.push('/symbols/add')}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition text-sm"
            >
              첫 종목 추가하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {symbols.map((userSymbol) => (
              <SymbolCard
                key={userSymbol._id}
                symbol={userSymbol.symbolId}
                userSymbolId={userSymbol._id}
                onClick={() => router.push(`/symbols/${userSymbol.symbolId._id}`)}
                onDelete={handleDeleteSymbol}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

