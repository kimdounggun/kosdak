'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAuthenticated } from '@/stores/authStore'
import { api } from '@/lib/api'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import { TrendingUp } from 'lucide-react'

export default function SymbolsPage() {
  const router = useRouter()
  const { isAuthenticated, isHydrated } = useIsAuthenticated()
  const [symbols, setSymbols] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')

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
      const response = await api.get('/symbols')
      setSymbols(response.data)
    } catch (error) {
      console.error('Failed to load symbols:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredSymbols = symbols.filter(s => 
    filter === 'ALL' || s.market === filter
  )

  if (!isAuthenticated) return null

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">전체 종목</h1>
          <button
            onClick={() => router.push('/symbols/add')}
            className="px-3 sm:px-6 py-2 sm:py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition text-xs sm:text-sm"
          >
            + 관심종목 추가
          </button>
        </div>

        <div className="flex gap-2 sm:gap-4">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition text-xs sm:text-sm ${
              filter === 'ALL' ? 'bg-primary-600' : 'bg-dark-200 hover:bg-dark-100'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setFilter('KOSPI')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition text-xs sm:text-sm ${
              filter === 'KOSPI' ? 'bg-primary-600' : 'bg-dark-200 hover:bg-dark-100'
            }`}
          >
            코스피
          </button>
          <button
            onClick={() => setFilter('KOSDAQ')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition text-xs sm:text-sm ${
              filter === 'KOSDAQ' ? 'bg-primary-600' : 'bg-dark-200 hover:bg-dark-100'
            }`}
          >
            코스닥
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="glass rounded-xl p-6 animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredSymbols.map(symbol => (
              <div
                key={symbol._id}
                className="glass rounded-xl p-4 sm:p-6 card-hover cursor-pointer"
                onClick={() => router.push(`/symbols/${symbol._id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold truncate">{symbol.name}</h3>
                    <p className="text-xs sm:text-sm text-gray-400">
                      {symbol.code} · {symbol.market}
                    </p>
                  </div>
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary-500 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

