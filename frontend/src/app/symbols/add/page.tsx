'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAuthenticated } from '@/stores/authStore'
import { api } from '@/lib/api'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import toast from 'react-hot-toast'

export default function AddSymbolPage() {
  const router = useRouter()
  const { isAuthenticated, isHydrated } = useIsAuthenticated()
  const [symbols, setSymbols] = useState<any[]>([])
  const [userSymbols, setUserSymbols] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set())
  const [localLogoErrors, setLocalLogoErrors] = useState<Set<string>>(new Set())

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

  if (!isHydrated || !isAuthenticated) {
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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">종목 추가</h1>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            뒤로가기
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass rounded-xl p-6 animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {symbols.map((symbol) => (
              <div
                key={symbol._id}
                className="glass rounded-xl p-4 sm:p-6 hover:bg-dark-200 transition cursor-pointer"
                onClick={() => addSymbol(symbol._id)}
              >
                <div className="flex items-center gap-3 mb-4">
                  {(() => {
                    const localLogoUrl = symbol.code ? `/logos/${symbol.code}.png` : null
                    const dbLogoUrl = symbol.logoUrl
                    const logoUrl = localLogoUrl && !localLogoErrors?.has(symbol._id) 
                      ? localLogoUrl 
                      : (dbLogoUrl && !logoErrors.has(symbol._id) ? dbLogoUrl : null)
                    
                    return logoUrl ? (
                      <img 
                        src={logoUrl} 
                        alt={symbol.name}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-contain flex-shrink-0 bg-white/5 p-1"
                        style={{ 
                          imageRendering: '-webkit-optimize-contrast',
                          width: 'auto',
                          height: 'auto',
                          maxWidth: '100%',
                          maxHeight: '100%'
                        }}
                        loading="eager"
                        onError={() => {
                          if (localLogoUrl && !localLogoErrors?.has(symbol._id)) {
                            setLocalLogoErrors(prev => new Set(prev).add(symbol._id))
                          } else if (dbLogoUrl && !logoErrors.has(symbol._id)) {
                            setLogoErrors(prev => new Set(prev).add(symbol._id))
                          }
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-lg sm:text-xl">
                          {symbol.name.charAt(0)}
                        </span>
                      </div>
                    )
                  })()}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold truncate mb-1">{symbol.name}</h3>
                    <p className="text-xs sm:text-sm text-gray-400">
                      {symbol.code} · {symbol.market}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button className="w-full py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition">
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

