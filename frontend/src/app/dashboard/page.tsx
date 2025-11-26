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
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm sm:text-base text-gray-400">
              {user?.name}님, 환영합니다!
            </p>
          </div>

                  <button
                    onClick={() => router.push('/symbols/add')}
                    className="px-3 sm:px-6 py-2 sm:py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition w-full sm:w-auto text-xs sm:text-base"
                  >
                    + 종목 추가
                  </button>
        </div>

        {/* Info Banner */}
        <div className="glass rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0" />
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
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass rounded-lg p-3 sm:p-4 animate-pulse">
                <div className="h-5 bg-gray-700 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-gray-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : symbols.length === 0 ? (
          <div className="glass rounded-xl p-8 sm:p-12 text-center">
            <p className="text-gray-400 mb-4 text-sm sm:text-base">등록된 관심종목이 없습니다</p>
            <button
              onClick={() => router.push('/symbols/add')}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition text-sm sm:text-base"
            >
              첫 종목 추가하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
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

