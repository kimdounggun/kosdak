'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import toast from 'react-hot-toast'

export default function SymbolDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { isAuthenticated } = useAuthStore()
  const [symbol, setSymbol] = useState<any>(null)
  const [candles, setCandles] = useState<any[]>([])
  const [indicators, setIndicators] = useState<any>(null)
  const [aiReport, setAiReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [symbolRes, candlesRes, indicatorsRes] = await Promise.all([
        api.get(`/symbols/${params.id}`),
        api.get(`/symbols/${params.id}/candles?timeframe=5m&limit=50`),
        api.get(`/symbols/${params.id}/indicators/latest?timeframe=5m`),
      ])
      
      setSymbol(symbolRes.data)
      setCandles(candlesRes.data)
      setIndicators(indicatorsRes.data)

      // AI 리포트 로드 (있으면)
      try {
        const aiRes = await api.get(`/ai/report/latest?symbolId=${params.id}&timeframe=5m`)
        setAiReport(aiRes.data)
      } catch (err) {
        console.log('No AI report yet')
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('데이터를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }

  const generateAiReport = async () => {
    try {
      toast.loading('AI 분석 중...', { id: 'ai' })
      const response = await api.post('/ai/report', {
        symbolId: params.id,
        timeframe: '5m',
        reportType: 'comprehensive'
      })
      setAiReport(response.data)
      toast.success('AI 분석 완료!', { id: 'ai' })
    } catch (error) {
      toast.error('AI 분석 실패', { id: 'ai' })
    }
  }

  if (!isAuthenticated) return null

  if (loading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-gray-700 rounded w-1/3"></div>
          <div className="h-64 bg-gray-700 rounded"></div>
        </div>
      </DashboardLayout>
    )
  }

  const latestCandle = candles[0]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{symbol?.name}</h1>
            <p className="text-gray-400">{symbol?.code} · {symbol?.market}</p>
          </div>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            뒤로가기
          </button>
        </div>

        {/* 현재 가격 */}
        {latestCandle && (
          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">현재 시세 (지연 20분)</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-gray-400">종가</p>
                <p className="text-2xl font-bold">{latestCandle.close.toLocaleString()}원</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">시가</p>
                <p className="text-lg">{latestCandle.open.toLocaleString()}원</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">고가</p>
                <p className="text-lg text-success">{latestCandle.high.toLocaleString()}원</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">저가</p>
                <p className="text-lg text-danger">{latestCandle.low.toLocaleString()}원</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">거래량</p>
                <p className="text-lg">{latestCandle.volume.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* 기술적 지표 */}
        {indicators && (
          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">기술적 지표</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {indicators.rsi && (
                <div>
                  <p className="text-sm text-gray-400">RSI(14)</p>
                  <p className="text-xl font-bold">{indicators.rsi.toFixed(2)}</p>
                </div>
              )}
              {indicators.macd && (
                <div>
                  <p className="text-sm text-gray-400">MACD</p>
                  <p className="text-xl font-bold">{indicators.macd.toFixed(2)}</p>
                </div>
              )}
              {indicators.ma20 && (
                <div>
                  <p className="text-sm text-gray-400">MA20</p>
                  <p className="text-xl font-bold">{indicators.ma20.toLocaleString()}원</p>
                </div>
              )}
              {indicators.volumeRatio && (
                <div>
                  <p className="text-sm text-gray-400">거래량 비율</p>
                  <p className="text-xl font-bold">{indicators.volumeRatio.toFixed(2)}x</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI 분석 리포트 */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">AI 분석 리포트</h2>
            <button
              onClick={generateAiReport}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition"
            >
              AI 분석 새로고침
            </button>
          </div>
          {aiReport ? (
            <div className="whitespace-pre-wrap text-gray-300">
              {aiReport.content}
            </div>
          ) : (
            <p className="text-gray-400">AI 분석 리포트가 없습니다. 새로고침 버튼을 눌러주세요.</p>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

