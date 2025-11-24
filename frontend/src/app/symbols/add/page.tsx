'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import toast from 'react-hot-toast'

export default function AddSymbolPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [symbols, setSymbols] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadSymbols()
  }, [])

  const loadSymbols = async () => {
    try {
      const response = await api.get('/symbols')
      setSymbols(response.data)
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

  if (!isAuthenticated) {
    return null
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
                className="glass rounded-xl p-6 hover:bg-dark-200 transition cursor-pointer"
                onClick={() => addSymbol(symbol._id)}
              >
                <h3 className="text-lg font-bold mb-2">{symbol.name}</h3>
                <p className="text-sm text-gray-400">
                  {symbol.code} · {symbol.market}
                </p>
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

