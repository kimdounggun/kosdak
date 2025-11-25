'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import toast from 'react-hot-toast'
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'
import { Shield, TrendingUp } from 'lucide-react'
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

  const parseAiReport = (text: string) => {
    const lines = text.split('\n').filter(l => l.trim())
    const sections: any[] = []
    let current = { title: '', content: '' }

    lines.forEach(line => {
      const match = line.match(/^(\d+)\.\s*(.*?)(?::|：)\s*(.*)/)
      if (match) {
        if (current.title) sections.push(current)
        current = { title: match[2].trim(), content: match[3].trim() }
      } else if (current.title) {
        current.content += ' ' + line.trim()
      }
    })
    if (current.title) sections.push(current)
    return sections
  }

  const aiSections = aiReport ? parseAiReport(aiReport.content) : []
  const sentimentScore = 64

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#0D0D0D] p-6 space-y-6">

        {/* 상단 헤더 - 시안과 정확히 동일하게 */}
        <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-6">
          {/* 종목명 */}
          <div className="flex items-baseline gap-4 mb-6">
            <h1 className="text-3xl font-bold text-white">{symbol?.name}</h1>
            <span className="text-sm text-gray-500 font-mono">{symbol?.code} · {symbol?.market}</span>
          </div>

          {/* 가격 바 */}
          <div className="grid grid-cols-5 gap-6 mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">종가</p>
              <p className="text-2xl font-bold text-white">{latestCandle.close.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">시가</p>
              <p className="text-lg text-gray-300">{latestCandle.open.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">고가</p>
              <p className="text-lg text-[#00F0A8]">{latestCandle.high.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">저가</p>
              <p className="text-lg text-[#FF4D4D]">{latestCandle.low.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">거래량</p>
              <p className="text-lg text-gray-300">{latestCandle.volume.toLocaleString()}</p>
            </div>
          </div>

          {/* 차트 2칸 배치 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="h-32 bg-[#0D0D0D]/50 rounded-lg p-4">
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
            </div>
            <div className="h-32 bg-[#0D0D0D]/50 rounded-lg p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeData}>
                  <Area type="monotone" dataKey="value" stroke="#00D1FF" strokeWidth={1} fill="#00D1FF" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 메인 그리드: 좌측 3칸 + 우측 2칸 */}
        <div className="grid grid-cols-5 gap-6">

          {/* 좌측 영역 (col-span-3) */}
          <div className="col-span-3 space-y-6">

            {/* 현재 시세 분석 */}
            <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-white">현재 시세 분석</h2>
                <button onClick={generateAiReport} className="px-4 py-2 bg-[#00D1FF] text-black text-sm font-bold rounded hover:bg-[#00D1FF]/90 transition">
                  AI 분석 새로고침
                </button>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8">
                {/* 반원 게이지 */}
                <div className="flex flex-col items-center justify-center">
                  <div className="relative w-56 h-28 overflow-hidden">
                    <div className="absolute w-56 h-56 rounded-full border-[6px] border-[#1F2228] top-0 left-0"></div>
                    <motion.div
                      initial={{ rotate: 0 }}
                      animate={{ rotate: (sentimentScore / 100) * 180 }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="absolute w-56 h-56 rounded-full border-[6px] border-transparent border-t-[#00F0A8] top-0 left-0"
                      style={{ transformOrigin: '50% 100%' }}
                    />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                      <div className="text-3xl font-bold text-[#00F0A8]">BULLISH</div>
                      <div className="text-xs text-gray-500">{sentimentScore} / 100</div>
                    </div>
                  </div>
                </div>

                {/* Confidence Score */}
                <div className="flex flex-col items-center justify-center">
                  <Shield className="w-10 h-10 text-yellow-500 mb-2" />
                  <div className="text-[10px] text-gray-500 mb-1 font-mono tracking-wider">CONFIDENCE SCORE</div>
                  <div className="text-2xl font-bold text-white">HIGH</div>
                  <div className="text-xs text-gray-500 mt-1">Based on 5 indicators</div>
                </div>
              </div>
            </div>

            {/* AI 분석 항목들 */}
            {aiSections.map((sec, i) => (
              <div key={i} className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-5 flex items-start gap-4">
                <div className="p-2 bg-[#00D1FF]/10 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-[#00D1FF]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-white mb-1">{sec.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{sec.content}</p>
                </div>
                <span className="px-3 py-1 bg-[#00F0A8]/20 text-[#00F0A8] text-xs font-bold rounded-full">BULLISH</span>
              </div>
            ))}
          </div>

          {/* 우측 영역 (col-span-2) - 2열 그리드 */}
          <div className="col-span-2 grid grid-cols-2 gap-4 auto-rows-min">

            {/* 1. 현재 시세 분석 (도넛) */}
            <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-4 h-48 flex flex-col">
              <h3 className="text-xs text-gray-500 font-semibold mb-2">현재 시세 분석</h3>
              <div className="flex-1 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{ value: sentimentScore }, { value: 100 - sentimentScore }]} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55}>
                      <Cell fill="#00F0A8" />
                      <Cell fill="#1F2228" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. 관심 포인트 & 필터 */}
            <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-4 h-48">
              <h3 className="text-xs text-gray-500 font-semibold mb-3">관심 포인트 & 필터</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs"><span className="text-gray-400">Support</span><span className="text-[#00F0A8]">62,000</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-400">Resistance</span><span className="text-[#FF4D4D]">68,500</span></div>
              </div>
            </div>

            {/* 3. 비휘발성 confidence Analysis */}
            <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-4 h-48 flex flex-col">
              <h3 className="text-xs text-gray-500 font-semibold mb-2">비휘발성 confidence Analysis</h3>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData.slice(0, 20)}>
                    <Area type="monotone" dataKey="value" stroke="#00D1FF" fill="#00D1FF" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 4. 포트폴리오/타겟 Score */}
            <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-4 h-48">
              <h3 className="text-xs text-gray-500 font-semibold mb-3">포트폴리오/타겟 Score</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs"><span className="text-gray-400">Win Rate</span><span className="text-[#00F0A8] font-bold">84%</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-400">Sharpe</span><span className="text-gray-300">1.82</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-400">총 거래</span><span className="text-gray-300">1,240</span></div>
              </div>
            </div>

            {/* 5. Market Strength Score */}
            <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-4 h-48 flex flex-col">
              <h3 className="text-xs text-gray-500 font-semibold mb-2">Market Strength Score</h3>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData.slice(0, 20)}>
                    <defs>
                      <linearGradient id="strengthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00F0A8" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#00F0A8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#00F0A8" fill="url(#strengthGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 6. 알림 권고 & 필터 */}
            <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-4 h-48">
              <h3 className="text-xs text-gray-500 font-semibold mb-3">알림 권고 & 필터</h3>
              <p className="text-xs text-gray-500">No active alerts</p>
            </div>

            {/* 7. 리스크 거리 힌트맵 - 2칸 차지 */}
            <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-4 h-48 col-span-2">
              <h3 className="text-xs text-gray-500 font-semibold mb-3">리스크 거리 힌트맵</h3>
              <div className="grid grid-cols-8 gap-1 mt-4">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="h-6 bg-gradient-to-r from-[#00F0A8]/30 to-[#FF4D4D]/30 rounded"></div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}
