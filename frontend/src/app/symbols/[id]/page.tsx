'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import toast from 'react-hot-toast'
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'
import { Shield, Activity, TrendingUp, BarChart2, Target, AlertTriangle, Zap } from 'lucide-react'
import { motion } from 'framer-motion'

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
  if (loading) return <DashboardLayout><div className="p-8 text-gray-400">Loading...</div></DashboardLayout>

  const latestCandle = candles[0]
  const trendData = candles.map(c => ({ value: c.close })).reverse()
  const volumeData = candles.map(c => ({ value: c.volume })).reverse()

  // AI 분석 파싱
  const parseAiReport = (text: string) => {
    const lines = text.split('\n').filter(l => l.trim())
    const sections: any[] = []
    let current = { title: '', content: '', icon: Activity }

    lines.forEach(line => {
      const match = line.match(/^(\d+)\.\s*(.*?)(?::|：)\s*(.*)/)
      if (match) {
        if (current.title) sections.push(current)
        current = { title: match[2].trim(), content: match[3].trim(), icon: Activity }
      } else if (current.title) {
        current.content += ' ' + line.trim()
      }
    })
    if (current.title) sections.push(current)
    return sections
  }

  const aiSections = aiReport ? parseAiReport(aiReport.content) : []
  const sentimentScore = 64 // Mock

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#0D0D0D] p-6 space-y-6">

        {/* 상단 헤더 */}
        <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-6">
          <div className="flex items-baseline gap-4 mb-4">
            <h1 className="text-3xl font-bold text-white">{symbol?.name}</h1>
            <span className="text-sm text-gray-500">{symbol?.code} · {symbol?.market}</span>
          </div>

          <div className="grid grid-cols-5 gap-6 mb-4">
            <div>
              <p className="text-xs text-gray-500">종가</p>
              <p className="text-2xl font-bold text-white">{latestCandle.close.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">시가</p>
              <p className="text-lg text-gray-300">{latestCandle.open.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">고가</p>
              <p className="text-lg text-[#00F0A8]">{latestCandle.high.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">저가</p>
              <p className="text-lg text-[#FF4D4D]">{latestCandle.low.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">거래량</p>
              <p className="text-lg text-gray-300">{latestCandle.volume.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00F0A8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00F0A8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="#00F0A8" strokeWidth={2} fill="url(#trendGrad)" />
              </AreaChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeData}>
                <Area type="monotone" dataKey="value" stroke="#00D1FF" strokeWidth={1} fill="#00D1FF" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 메인 그리드: 좌측 넓음 + 우측 2열 */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* 좌측 메인 패널 (3 cols) */}
          <div className="lg:col-span-3 space-y-6">

            {/* 현재 시세 분석 */}
            <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-white">현재 시세 분석</h2>
                <button onClick={generateAiReport} className="px-4 py-2 bg-[#00D1FF] text-black text-sm font-bold rounded">
                  AI 분석 새로고침
                </button>
              </div>

              <div className="grid grid-cols-2 gap-8">
                {/* 반원 게이지 */}
                <div className="flex flex-col items-center justify-center">
                  <div className="relative w-64 h-32 overflow-hidden">
                    <div className="absolute w-64 h-64 rounded-full border-8 border-[#1F2228] top-0"></div>
                    <motion.div
                      initial={{ rotate: 0 }}
                      animate={{ rotate: (sentimentScore / 100) * 180 }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="absolute w-64 h-64 rounded-full border-8 border-transparent border-t-[#00F0A8] top-0"
                      style={{ transformOrigin: '50% 100%' }}
                    />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                      <div className="text-4xl font-bold text-[#00F0A8]">BULLISH</div>
                      <div className="text-sm text-gray-500">{sentimentScore} / 100</div>
                    </div>
                  </div>
                </div>

                {/* Confidence Score */}
                <div className="flex flex-col items-center justify-center">
                  <Shield className="w-12 h-12 text-yellow-500 mb-2" />
                  <div className="text-xs text-gray-500 mb-1">CONFIDENCE SCORE</div>
                  <div className="text-3xl font-bold text-white">HIGH</div>
                  <div className="text-xs text-gray-500 mt-1">Based on 5 indicators</div>
                </div>
              </div>
            </div>

            {/* AI 분석 항목들 */}
            <div className="space-y-3">
              {aiSections.map((sec, i) => (
                <div key={i} className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-5 flex items-start gap-4">
                  <div className="p-2 bg-[#00D1FF]/10 rounded">
                    <TrendingUp className="w-5 h-5 text-[#00D1FF]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-white mb-1">{sec.title}</h3>
                    <p className="text-sm text-gray-400">{sec.content}</p>
                  </div>
                  <span className="px-2 py-1 bg-[#00F0A8]/20 text-[#00F0A8] text-xs rounded">BULLISH</span>
                </div>
              ))}
            </div>
          </div>

          {/* 우측 위젯 그리드 (2 cols) */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* 현재 시세 분석 (도넛) */}
            <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-4 h-48">
              <h3 className="text-xs text-gray-500 mb-2">현재 시세 분석</h3>
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie data={[{ value: 64 }, { value: 36 }]} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={60}>
                    <Cell fill="#00F0A8" />
                    <Cell fill="#1F2228" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 관심 포인트 & 필터 */}
            <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-4 h-48">
              <h3 className="text-xs text-gray-500 mb-2">관심 포인트 & 필터</h3>
              <div className="space-y-2 text-xs text-gray-400">
                <div className="flex justify-between"><span>Support</span><span className="text-[#00F0A8]">62,000</span></div>
                <div className="flex justify-between"><span>Resistance</span><span className="text-[#FF4D4D]">68,500</span></div>
              </div>
            </div>

            {/* 비휘발성 신뢰도 분석 */}
            <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-4 h-48">
              <h3 className="text-xs text-gray-500 mb-2">비휘발성 ä confidence Analysis</h3>
              <ResponsiveContainer width="100%" height="80%">
                <AreaChart data={trendData.slice(0, 20)}>
                  <Area type="monotone" dataKey="value" stroke="#00D1FF" fill="#00D1FF" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Portfolio/Target Score */}
            <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-4 h-48">
              <h3 className="text-xs text-gray-500 mb-2">포트폴리오/타겟 Score</h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-gray-400"><span>Win Rate</span><span className="text-[#00F0A8]">84%</span></div>
                <div className="flex justify-between text-gray-400"><span>Sharpe</span><span>1.82</span></div>
              </div>
            </div>

            {/* Market Strength */}
            <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-4 h-48">
              <h3 className="text-xs text-gray-500 mb-2">Market Strength Score</h3>
              <ResponsiveContainer width="100%" height="80%">
                <LineChart data={trendData.slice(0, 20)}>
                  <Line type="monotone" dataKey="value" stroke="#00F0A8" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 알림 권고 */}
            <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-4 h-48">
              <h3 className="text-xs text-gray-500 mb-2">알림 권고 & 필터</h3>
              <p className="text-xs text-gray-500">No active alerts</p>
            </div>

            {/* 리스크 거리 힌트맵 */}
            <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-4 h-48">
              <h3 className="text-xs text-gray-500 mb-2">리스크 거리 힌트맵</h3>
              <div className="grid grid-cols-4 gap-1 mt-4">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className="h-8 bg-gradient-to-r from-[#00F0A8]/20 to-[#FF4D4D]/20 rounded"></div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}
