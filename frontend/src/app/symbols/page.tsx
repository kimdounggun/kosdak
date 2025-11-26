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
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-bold">전체 종목</h1>
          <button
            onClick={() => router.push('/symbols/add')}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition text-xs sm:text-sm whitespace-nowrap"
          >
            + 추가
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition text-xs sm:text-sm flex-1 sm:flex-none ${
              filter === 'ALL' ? 'bg-primary-600' : 'bg-dark-200 hover:bg-dark-100'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setFilter('KOSPI')}
            className={`px-3 py-1.5 rounded-lg transition text-xs sm:text-sm flex-1 sm:flex-none ${
              filter === 'KOSPI' ? 'bg-primary-600' : 'bg-dark-200 hover:bg-dark-100'
            }`}
          >
            코스피
          </button>
          <button
            onClick={() => setFilter('KOSDAQ')}
            className={`px-3 py-1.5 rounded-lg transition text-xs sm:text-sm flex-1 sm:flex-none ${
              filter === 'KOSDAQ' ? 'bg-primary-600' : 'bg-dark-200 hover:bg-dark-100'
            }`}
          >
            코스닥
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="glass rounded-lg p-3 animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-1.5"></div>
                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {filteredSymbols.map(symbol => (
              <div
                key={symbol._id}
                className="glass rounded-lg p-2.5 sm:p-3 card-hover cursor-pointer"
                onClick={() => router.push(`/symbols/${symbol._id}`)}
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold truncate leading-tight">{symbol.name}</h3>
                    <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
                      {symbol.code}
                    </p>
                  </div>
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary-500 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

