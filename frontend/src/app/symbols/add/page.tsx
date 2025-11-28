'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAuthenticated } from '@/stores/authStore'
import { api } from '@/lib/api'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import toast from 'react-hot-toast'

export default function AddSymbolPage() {
  const router = useRouter()
  const { isAuthenticated, isHydrated } = useIsAuthenticated()
  const [symbols, setSymbols] = useState<any[]>([])
  const [userSymbols, setUserSymbols] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!isHydrated) return

    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadSymbols()
  }, [isHydrated, isAuthenticated])

  const loadSymbols = async () => {
    try {
      const [symbolsResponse, userSymbolsResponse] = await Promise.all([
        api.get('/symbols'),
        api.get('/symbols/user/my-symbols')
      ])
      
      const allSymbols = symbolsResponse.data
      const userSymbolIds = new Set(
        userSymbolsResponse.data
          .filter((us: any) => us.symbolId)
          .map((us: any) => us.symbolId._id.toString())
      )
      
      // 이미 추가된 종목 제외
      const availableSymbols = allSymbols.filter(
        (symbol: any) => !userSymbolIds.has(symbol._id.toString())
      )
      
      setSymbols(availableSymbols)
      setUserSymbols(userSymbolsResponse.data)
    } catch (error) {
      console.error('Failed to load symbols:', error)
      toast.error('종목 목록을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }

  const addSymbol = async (symbolId: string) => {
    try {
      await api.post('/symbols/user/symbols', { symbolId })
      toast.success('관심종목에 추가되었습니다')
      router.push('/dashboard')
    } catch (error: any) {
      console.error('Failed to add symbol:', error)
      toast.error(error.response?.data?.message || '추가 실패')
    }
  }

  // 검색 필터링
  const filteredSymbols = symbols.filter(symbol => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true
    
    return (
      symbol.name.toLowerCase().includes(query) ||
      symbol.code.toLowerCase().includes(query) ||
      symbol.market.toLowerCase().includes(query)
    )
  })

  if (!isHydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-100">
        <LoadingSpinner message="종목 목록 로딩 중..." size="md" />
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-bold">종목 추가</h1>
          <button
            onClick={() => router.back()}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition text-xs sm:text-sm"
          >
            뒤로가기
          </button>
        </div>

        {/* 검색 바 */}
        <div className="relative">
          <input
            type="text"
            placeholder="종목명, 코드 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 bg-dark-200 border border-dark-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent placeholder-gray-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* 검색 결과 개수 */}
        {!loading && (
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>
              {searchQuery ? (
                <>검색 결과: <span className="text-primary-500 font-semibold">{filteredSymbols.length}</span>개</>
              ) : (
                <>전체: <span className="text-white font-semibold">{symbols.length}</span>개</>
              )}
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-primary-500 hover:text-primary-400 transition"
              >
                전체 보기
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass rounded-lg p-3 animate-pulse">
                <div className="h-5 bg-gray-700 rounded w-1/2 mb-1.5"></div>
                <div className="h-3 bg-gray-700 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        ) : filteredSymbols.length === 0 ? (
          <div className="glass rounded-lg p-8 text-center">
            <p className="text-gray-400 text-sm">
              {searchQuery ? (
                <>
                  <span className="text-white font-semibold">"{searchQuery}"</span>에 대한 검색 결과가 없습니다.
                </>
              ) : (
                '추가 가능한 종목이 없습니다.'
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSymbols.map((symbol) => (
              <div
                key={symbol._id}
                className="glass rounded-lg p-3 hover:bg-dark-200 transition active:scale-[0.98]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-bold truncate">{symbol.name}</h3>
                    <p className="text-xs text-gray-400">
                      {symbol.code} · {symbol.market}
                    </p>
                  </div>
                  <button 
                    onClick={() => addSymbol(symbol._id)}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 rounded-lg font-semibold transition text-xs whitespace-nowrap flex-shrink-0"
                  >
                    추가하기
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

