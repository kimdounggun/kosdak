'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import toast from 'react-hot-toast'

export default function CreateAlertPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [symbols, setSymbols] = useState<any[]>([])
  const [formData, setFormData] = useState({
    symbolId: '',
    name: '',
    description: '',
    indicator: 'rsi',
    operator: '<',
    value: 30,
  })

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
      console.error('Failed to load symbols')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.symbolId) {
      toast.error('종목을 선택해주세요')
      return
    }

    try {
      await api.post('/alerts', {
        symbolId: formData.symbolId,
        name: formData.name,
        description: formData.description,
        conditionJson: [{
          type: 'indicator',
          operator: formData.operator,
          indicator: formData.indicator,
          value: formData.value,
        }],
        conditionLogic: 'all',
        cooldownMinutes: 60,
        notificationChannels: ['sms'],
      })
      
      toast.success('알림 생성 완료!')
      router.push('/alerts')
    } catch (error: any) {
      toast.error(error.response?.data?.message || '생성 실패')
    }
  }

  if (!isAuthenticated) return null

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">알림 생성</h1>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            취소
          </button>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">종목</label>
            <select
              value={formData.symbolId}
              onChange={(e) => setFormData({...formData, symbolId: e.target.value})}
              className="w-full px-4 py-3 bg-dark-200 border border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              required
            >
              <option value="">종목 선택</option>
              {symbols.map(symbol => (
                <option key={symbol._id} value={symbol._id}>
                  {symbol.name} ({symbol.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">알림 이름</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-3 bg-dark-200 border border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="예: RSI 과매도 알림"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">설명 (선택)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-4 py-3 bg-dark-200 border border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="알림에 대한 설명"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">지표</label>
              <select
                value={formData.indicator}
                onChange={(e) => setFormData({...formData, indicator: e.target.value})}
                className="w-full px-4 py-3 bg-dark-200 border border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="rsi">RSI</option>
                <option value="price">가격</option>
                <option value="volume">거래량</option>
                <option value="macd">MACD</option>
                <option value="ma20">MA20</option>
                <option value="volumeRatio">거래량비율</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">조건</label>
              <select
                value={formData.operator}
                onChange={(e) => setFormData({...formData, operator: e.target.value})}
                className="w-full px-4 py-3 bg-dark-200 border border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="<">{'<'} 미만</option>
                <option value=">">{'>'} 초과</option>
                <option value="<=">{'<='} 이하</option>
                <option value=">=">{'>='} 이상</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">값</label>
              <input
                type="number"
                value={formData.value}
                onChange={(e) => setFormData({...formData, value: parseFloat(e.target.value)})}
                className="w-full px-4 py-3 bg-dark-200 border border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition"
          >
            알림 생성
          </button>
        </form>
      </div>
    </DashboardLayout>
  )
}


