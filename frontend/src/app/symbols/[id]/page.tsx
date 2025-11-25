'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useIsAuthenticated } from '@/stores/authStore'
import { api } from '@/lib/api'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import toast from 'react-hot-toast'
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import AiReportViewer from '@/components/Dashboard/AiReportViewer'
import { Sparkles, RefreshCw } from 'lucide-react'

export default function SymbolDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { isAuthenticated, isHydrated } = useIsAuthenticated()
  const [symbol, setSymbol] = useState<any>(null)
  const [candles, setCandles] = useState<any[]>([])
  const [indicators, setIndicators] = useState<any>(null)
  const [aiReport, setAiReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [showFullReport, setShowFullReport] = useState(false)

  useEffect(() => {
    if (!isHydrated) return

    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadData()
  }, [isHydrated, isAuthenticated])

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
    if (generatingReport) return
    try {
      setGeneratingReport(true)
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
    } finally {
      setGeneratingReport(false)
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
  if (loading) return <DashboardLayout><div className="p-8 text-gray-400">Loading...</div></DashboardLayout>

  const latestCandle = candles[0]
  const trendData = candles.map(c => ({ value: c.close })).reverse().slice(0, 30)
  const volumeData = candles.map(c => ({ value: c.volume })).reverse().slice(0, 30)

  // ===== 데이터 계산 함수들 =====

  // Widget 1: 시장 시세 분석 - 실제 기간별 가격 변화 계산
  const calculateHistoricalChanges = () => {
    if (!candles || candles.length < 2) return { min15: '0', hour1: '0', hour4: '0' }

    const current = candles[0].close
    // 5분봉 기준: 15분 = 3개, 1시간 = 12개, 4시간 = 48개
    const min15Price = candles[Math.min(3, candles.length - 1)]?.close || current
    const hour1Price = candles[Math.min(12, candles.length - 1)]?.close || current
    const hour4Price = candles[Math.min(48, candles.length - 1)]?.close || current

    return {
      min15: ((current - min15Price) / min15Price * 100).toFixed(1),
      hour1: ((current - hour1Price) / hour1Price * 100).toFixed(1),
      hour4: ((current - hour4Price) / hour4Price * 100).toFixed(1),
    }
  }

  // Widget 2: 신뢰 조건 & 트렌드 - 인디케이터 기반 신호 체제 계산
  const calculateSignalRegime = () => {
    if (!indicators || !candles || candles.length === 0) return { bullish: 50, bearish: 50 }

    let bullishSignals = 0
    let totalSignals = 0

    if (indicators.rsi !== undefined) {
      totalSignals++
      if (indicators.rsi > 50) bullishSignals++
    }

    if (indicators.macd !== undefined && indicators.macdSignal !== undefined) {
      totalSignals++
      if (indicators.macd > indicators.macdSignal) bullishSignals++
    }

    if (indicators.ma20 !== undefined && candles[0]) {
      totalSignals++
      if (candles[0].close > indicators.ma20) bullishSignals++
    }

    if (indicators.ma5 !== undefined && indicators.ma20 !== undefined) {
      totalSignals++
      if (indicators.ma5 > indicators.ma20) bullishSignals++
    }

    if (indicators.stochK !== undefined) {
      totalSignals++
      if (indicators.stochK > 50) bullishSignals++
    }

    const bullishPercent = totalSignals > 0 ? (bullishSignals / totalSignals * 100) : 50
    return {
      bullish: Math.round(bullishPercent),
      bearish: Math.round(100 - bullishPercent)
    }
  }

  // Widget 3: AI 신뢰도 분석
  const calculateConfidenceMetrics = () => {
    const defaults = { confidence: 65, accuracy: 70, consistency: 73 }

    if (!aiReport && !indicators) return defaults

    let confidence = 65
    if (aiReport?.metadata?.confidence) {
      confidence = Math.round(aiReport.metadata.confidence * 100)
    } else if (indicators?.rsi) {
      const rsiDeviation = Math.abs(indicators.rsi - 50)
      confidence = Math.min(95, 50 + rsiDeviation)
    }

    const regime = calculateSignalRegime()
    const accuracy = Math.max(regime.bullish, regime.bearish)

    let consistency = 73
    if (candles && candles.length >= 10) {
      const recentCandles = candles.slice(0, 10)
      const upCandles = recentCandles.filter(c => c.close > c.open).length
      const downCandles = recentCandles.filter(c => c.close < c.open).length
      consistency = Math.max(upCandles, downCandles) * 10
    }

    return {
      confidence: Math.round(confidence),
      accuracy: Math.round(accuracy),
      consistency: Math.round(consistency)
    }
  }

  // Widget 4: 시장 강도 지표
  const calculateMarketStrength = () => {
    if (!indicators || !candles || candles.length === 0) {
      return { score: '50', direction: '중립', volatility: '중간' }
    }

    let strengthScore = 50

    if (indicators.rsi) {
      strengthScore += (indicators.rsi - 50) * 0.3
    }

    if (indicators.volumeRatio) {
      strengthScore += (indicators.volumeRatio - 1) * 20
    }

    if (indicators.macd && indicators.macdSignal) {
      const macdDiff = indicators.macd - indicators.macdSignal
      strengthScore += macdDiff > 0 ? 10 : -10
    }

    if (indicators.ma5 && indicators.ma20) {
      const maDiff = (indicators.ma5 - indicators.ma20) / indicators.ma20 * 100
      strengthScore += maDiff * 3
    }

    strengthScore = Math.max(0, Math.min(100, strengthScore))

    let direction = '중립'
    if (strengthScore > 60) direction = '상승'
    else if (strengthScore < 40) direction = '하락'

    let volatility = '중간'
    if (indicators.bbUpper && indicators.bbLower && indicators.bbMiddle) {
      const bbWidth = (indicators.bbUpper - indicators.bbLower) / indicators.bbMiddle * 100
      if (bbWidth > 5) volatility = '높음'
      else if (bbWidth < 2) volatility = '낮음'
    }

    return {
      score: strengthScore.toFixed(1),
      direction,
      volatility
    }
  }

  // Widget 5: 매수 조건 체크
  const calculateEntryConditions = () => {
    const defaults = {
      momentum: { status: '미충족', color: '#FF4D4D' },
      volatility: { status: '미충족', color: '#FF4D4D' },
      volume: { status: '미충족', color: '#FF4D4D' },
      pattern: { status: '미충족', color: '#FF4D4D' }
    }

    if (!indicators) return defaults

    const momentum = indicators.rsi && indicators.rsi >= 40 && indicators.rsi <= 70
      ? { status: '충족', color: '#00E5A8' }
      : { status: '미충족', color: '#FF4D4D' }

    let volatility = { status: '미충족', color: '#FF4D4D' }
    if (indicators.bbUpper && indicators.bbLower && candles && candles[0]) {
      const price = candles[0].close
      const inRange = price > indicators.bbLower && price < indicators.bbUpper
      const nearMiddle = indicators.bbMiddle && Math.abs(price - indicators.bbMiddle) / indicators.bbMiddle < 0.02

      if (inRange && nearMiddle) {
        volatility = { status: '충족', color: '#00E5A8' }
      } else if (inRange) {
        volatility = { status: '절반', color: '#CFCFCF' }
      }
    }

    const volume = indicators.volumeRatio && indicators.volumeRatio > 1.0
      ? { status: '충족', color: '#00E5A8' }
      : { status: '미충족', color: '#FF4D4D' }

    const pattern = indicators.macdHistogram && indicators.macdHistogram > 0
      ? { status: '충족', color: '#00E5A8' }
      : { status: '미충족', color: '#FF4D4D' }

    return { momentum, volatility, volume, pattern }
  }

  const historicalChanges = calculateHistoricalChanges()
  const signalRegime = calculateSignalRegime()
  const confidenceMetrics = calculateConfidenceMetrics()
  const marketStrength = calculateMarketStrength()
  const entryConditions = calculateEntryConditions()

  // 추세 방향 계산
  const trendDirection = marketStrength.direction === '상승' ? 'BULLISH' : marketStrength.direction === '하락' ? 'BEARISH' : 'NEUTRAL'
  const priceChange = candles.length > 1 ? ((latestCandle.close - candles[1].close) / candles[1].close * 100) : 0

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* 상단 헤더 - 가격 정보 */}
        <div className="bg-[#15171A] border border-white/10 rounded-xl p-8 shadow-xl">
          <div className="flex items-baseline gap-4 mb-8">
            <h1 className="text-4xl font-bold text-white">{symbol?.name}</h1>
            <span className="text-lg text-[#CFCFCF] font-mono font-medium">{symbol?.code} · {symbol?.market}</span>
          </div>

          <div className="grid grid-cols-5 gap-8">
            <div>
              <p className="text-base text-[#CFCFCF] mb-2 font-semibold">종가</p>
              <p className="text-3xl font-bold text-white">{latestCandle.close.toLocaleString()}원</p>
              <p className={`text-lg font-bold mt-1 ${priceChange >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-base text-[#CFCFCF] mb-2 font-semibold">시가</p>
              <p className="text-2xl font-bold text-white">{latestCandle.open.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-base text-[#CFCFCF] mb-2 font-semibold">고가</p>
              <p className="text-2xl font-bold text-[#00E5A8]">{latestCandle.high.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-base text-[#CFCFCF] mb-2 font-semibold">저가</p>
              <p className="text-2xl font-bold text-[#FF4D4D]">{latestCandle.low.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-base text-[#CFCFCF] mb-2 font-semibold">거래량</p>
              <p className="text-2xl font-bold text-white">{latestCandle.volume.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* 3개 핵심 지표 - 상단 강조 */}
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-[#15171A] border border-white/10 rounded-xl p-6 shadow-xl">
            <p className="text-base text-[#CFCFCF] mb-3 font-semibold">오늘 추세</p>
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${trendDirection === 'BULLISH' ? 'bg-[#00E5A8]' : trendDirection === 'BEARISH' ? 'bg-[#FF4D4D]' : 'bg-[#CFCFCF]'}`}></div>
              <p className={`text-2xl font-bold ${trendDirection === 'BULLISH' ? 'text-[#00E5A8]' : trendDirection === 'BEARISH' ? 'text-[#FF4D4D]' : 'text-[#CFCFCF]'}`}>
                {trendDirection}
              </p>
            </div>
          </div>
          <div className="bg-[#15171A] border border-white/10 rounded-xl p-6 shadow-xl">
            <p className="text-base text-[#CFCFCF] mb-3 font-semibold">종합 강도 점수</p>
            <p className="text-3xl font-bold text-white">{marketStrength.score}</p>
            <p className="text-base text-[#CFCFCF] mt-1 font-medium">{marketStrength.direction}</p>
          </div>
          <div className="bg-[#15171A] border border-white/10 rounded-xl p-6 shadow-xl">
            <p className="text-base text-[#CFCFCF] mb-3 font-semibold">AI 신뢰도</p>
            <p className="text-3xl font-bold text-white">{confidenceMetrics.confidence}%</p>
            <p className="text-base text-[#CFCFCF] mt-1 font-medium">정확도 {confidenceMetrics.accuracy}%</p>
          </div>
        </div>

        {/* 메인 그리드 */}
        <div className="grid grid-cols-4 gap-6">

          {/* 좌측 차트 영역 */}
          <div className="col-span-2 space-y-6">
            <div className="bg-[#15171A] border border-white/10 rounded-xl p-8 shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">현재 시세 분석</h2>
                  <p className="text-base text-[#CFCFCF] font-medium">AI가 추세·강도·모멘텀을 실시간 분석합니다</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button 
                    onClick={generateAiReport}
                    disabled={generatingReport}
                    className={`flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-lg font-bold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-blue-500/50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                      generatingReport ? 'animate-pulse' : ''
                    }`}
                  >
                    <Sparkles className={`w-6 h-6 ${generatingReport ? 'animate-spin' : ''}`} />
                    <span>{generatingReport ? 'AI 분석 중...' : 'AI 분석 새로고침'}</span>
                    <RefreshCw className={`w-5 h-5 ${generatingReport ? 'animate-spin' : ''}`} />
                  </button>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm text-[#CFCFCF] font-semibold">최근 데이터 기반 재분석</span>
                    <span className="text-xs text-[#CFCFCF] font-medium">AI가 추세·강도·모멘텀을 다시 계산합니다</span>
                  </div>
                </div>
              </div>

              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={trendDirection === 'BULLISH' ? '#00E5A8' : trendDirection === 'BEARISH' ? '#FF4D4D' : '#CFCFCF'} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={trendDirection === 'BULLISH' ? '#00E5A8' : trendDirection === 'BEARISH' ? '#FF4D4D' : '#CFCFCF'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke={trendDirection === 'BULLISH' ? '#00E5A8' : trendDirection === 'BEARISH' ? '#FF4D4D' : '#CFCFCF'} 
                      strokeWidth={3} 
                      fill="url(#trendGrad)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AI 분석 리포트 섹션 - 2줄 요약 + 자세히 보기 */}
            {aiReport ? (
              <div className="bg-[#15171A] border border-white/10 rounded-xl p-8 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-white">AI 분석 리포트</h2>
                  <span className="text-base text-[#CFCFCF] font-medium">
                    {new Date(aiReport.createdAt).toLocaleString('ko-KR')}
                  </span>
                </div>
                {/* 2줄 요약 */}
                {!showFullReport && (
                  <div className="bg-[#0D0D0D] rounded-lg p-6 mb-4 border border-white/5">
                    <p className="text-lg text-white font-semibold leading-relaxed mb-3">
                      {aiReport.content?.split('\n').slice(0, 2).join(' ').substring(0, 150)}...
                    </p>
                    <button 
                      onClick={() => setShowFullReport(true)}
                      className="text-lg text-[#00E5A8] font-bold hover:underline"
                    >
                      [자세히 보기]
                    </button>
                  </div>
                )}
                {/* 전체 리포트 */}
                {showFullReport && (
                  <div>
                    <button 
                      onClick={() => setShowFullReport(false)}
                      className="text-lg text-[#CFCFCF] font-semibold hover:text-white mb-4"
                    >
                      [접기]
                    </button>
                    <AiReportViewer report={aiReport.content || ''} />
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#15171A] border border-white/10 rounded-xl p-8 shadow-xl">
                <div className="text-center py-8">
                  <Sparkles className="w-16 h-16 text-[#CFCFCF] mx-auto mb-6" />
                  <p className="text-xl text-white mb-3 font-bold">AI 분석 리포트가 없습니다</p>
                  <p className="text-base text-[#CFCFCF] mb-8 font-medium">최근 데이터를 기반으로 AI가 종합 분석을 수행합니다</p>
                  <button
                    onClick={generateAiReport}
                    disabled={generatingReport}
                    className={`flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl text-lg font-bold transition-all shadow-lg hover:shadow-primary-500/50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mx-auto ${
                      generatingReport ? 'animate-pulse' : ''
                    }`}
                  >
                    <Sparkles className={`w-6 h-6 ${generatingReport ? 'animate-spin' : ''}`} />
                    <span>{generatingReport ? 'AI 분석 생성 중...' : 'AI 분석 생성하기'}</span>
                  </button>
                  <p className="text-base text-[#CFCFCF] mt-4 font-medium">AI가 추세·강도·모멘텀을 분석합니다</p>
                </div>
              </div>
            )}
          </div>

          {/* 우측 분석 위젯 패널 - 5개 위젯, 2열 그리드 */}
          <div className="col-span-2 grid grid-cols-2 gap-6 auto-rows-min">

            {/* 1. 시장 시세 분석 (Area Chart + Data Table) */}
            <div className="bg-[#15171A] border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">시장 시세 분석</h3>
                <span className="text-sm text-[#CFCFCF] bg-[#0D0D0D] px-3 py-1 rounded-lg font-medium">업데이트</span>
              </div>
              <div className="text-base text-[#CFCFCF] mb-4 font-semibold">시장 가격 추이</div>

              {/* Area Chart */}
              <div className="mb-4">
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={trendData.slice(0, 20)}>
                    <defs>
                      <linearGradient id="marketAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={trendDirection === 'BULLISH' ? '#00E5A8' : trendDirection === 'BEARISH' ? '#FF4D4D' : '#CFCFCF'} stopOpacity={0.6} />
                        <stop offset="100%" stopColor={trendDirection === 'BULLISH' ? '#00E5A8' : trendDirection === 'BEARISH' ? '#FF4D4D' : '#CFCFCF'} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={trendDirection === 'BULLISH' ? '#00E5A8' : trendDirection === 'BEARISH' ? '#FF4D4D' : '#CFCFCF'}
                      strokeWidth={3}
                      fill="url(#marketAreaGrad)"
                      animationDuration={800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Data Table */}
              <div className="space-y-3 text-base">
                <div className="grid grid-cols-3 gap-3 pb-3 border-b border-white/10">
                  <span className="text-[#CFCFCF] font-semibold">기간</span>
                  <span className="text-[#CFCFCF] text-right font-semibold">가격</span>
                  <span className="text-[#CFCFCF] text-right font-semibold">변화율</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <span className="text-[#CFCFCF] font-medium">15분</span>
                  <span className="text-white text-right font-bold">{candles[Math.min(3, candles.length - 1)]?.close.toLocaleString()}</span>
                  <span className={`text-right font-bold ${Number(historicalChanges.min15) >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                    {Number(historicalChanges.min15) >= 0 ? '+' : ''}{historicalChanges.min15}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <span className="text-[#CFCFCF] font-medium">1시간</span>
                  <span className="text-white text-right font-bold">{candles[Math.min(12, candles.length - 1)]?.close.toLocaleString()}</span>
                  <span className={`text-right font-bold ${Number(historicalChanges.hour1) >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                    {Number(historicalChanges.hour1) >= 0 ? '+' : ''}{historicalChanges.hour1}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <span className="text-[#CFCFCF] font-medium">4시간</span>
                  <span className="text-white text-right font-bold">{candles[Math.min(48, candles.length - 1)]?.close.toLocaleString()}</span>
                  <span className={`text-right font-bold ${Number(historicalChanges.hour4) >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                    {Number(historicalChanges.hour4) >= 0 ? '+' : ''}{historicalChanges.hour4}%
                  </span>
                </div>
              </div>
            </div>

            {/* 2. 신뢰 조건 & 트렌드 (Donut Chart + Legend) */}
            <div className="bg-[#15171A] border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">신뢰 조건 & 트렌드</h3>
                <span className="text-sm text-[#CFCFCF] bg-[#0D0D0D] px-3 py-1 rounded-lg font-medium">업데이트</span>
              </div>
              <div className="text-base text-[#CFCFCF] mb-4 font-semibold">신호 체제 분석</div>

              {/* Donut Chart */}
              <div className="flex items-center justify-center h-32 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[{ value: signalRegime.bullish }, { value: signalRegime.bearish }]}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      startAngle={90}
                      endAngle={450}
                      animationDuration={800}
                    >
                      <Cell fill={signalRegime.bullish > 50 ? '#00E5A8' : '#CFCFCF'} />
                      <Cell fill={signalRegime.bearish > 50 ? '#FF4D4D' : '#CFCFCF'} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="space-y-3 text-base">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-sm bg-[#00E5A8]"></div>
                    <span className="text-[#CFCFCF] font-semibold">강세 신호</span>
                  </div>
                  <span className="text-[#00E5A8] font-bold text-lg">{signalRegime.bullish}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-sm bg-[#CFCFCF]"></div>
                    <span className="text-[#CFCFCF] font-semibold">중립/약세</span>
                  </div>
                  <span className="text-[#CFCFCF] font-bold text-lg">{signalRegime.bearish}%</span>
                </div>
              </div>
            </div>

            {/* 3. AI 신뢰도 분석 (Area Chart + Table) */}
            <div className="bg-[#15171A] border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">AI 신뢰도 분석</h3>
                <span className="text-sm text-[#CFCFCF] bg-[#0D0D0D] px-3 py-1 rounded-lg font-medium">업데이트</span>
              </div>
              <div className="text-base text-[#CFCFCF] mb-4 font-semibold">AI 신뢰도 분석</div>

              {/* Area Chart */}
              <div className="mb-4">
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={trendData.slice(0, 20)}>
                    <defs>
                      <linearGradient id="confidenceAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00E5A8" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#00E5A8" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#00E5A8"
                      strokeWidth={3}
                      fill="url(#confidenceAreaGrad)"
                      animationDuration={800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Data Table */}
              <div className="space-y-3 text-base">
                <div className="grid grid-cols-3 gap-3 pb-3 border-b border-white/10">
                  <span className="text-[#CFCFCF] font-semibold">지표</span>
                  <span className="text-[#CFCFCF] text-right font-semibold">현재</span>
                  <span className="text-[#CFCFCF] text-right font-semibold">평균</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <span className="text-[#CFCFCF] font-medium">신뢰도</span>
                  <span className="text-[#00E5A8] text-right font-bold text-lg">{confidenceMetrics.confidence}%</span>
                  <span className="text-[#CFCFCF] text-right font-medium">65%</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <span className="text-[#CFCFCF] font-medium">정확도</span>
                  <span className="text-[#00E5A8] text-right font-bold text-lg">{confidenceMetrics.accuracy}%</span>
                  <span className="text-[#CFCFCF] text-right font-medium">70%</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <span className="text-[#CFCFCF] font-medium">일관성</span>
                  <span className="text-[#00E5A8] text-right font-bold text-lg">{confidenceMetrics.consistency}%</span>
                  <span className="text-[#CFCFCF] text-right font-medium">73%</span>
                </div>
              </div>
            </div>

            {/* 4. 시장 강도 지표 (Line Chart + Table) */}
            <div className="bg-[#15171A] border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">시장 강도 지표</h3>
                <span className="text-sm text-[#CFCFCF] bg-[#0D0D0D] px-3 py-1 rounded-lg font-medium">업데이트</span>
              </div>
              <div className="text-base text-[#CFCFCF] mb-4 font-semibold">종합 시장 강도</div>

              {/* Line Chart */}
              <div className="mb-4">
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={trendData.slice(0, 20)}>
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={trendDirection === 'BULLISH' ? '#00E5A8' : trendDirection === 'BEARISH' ? '#FF4D4D' : '#CFCFCF'}
                      strokeWidth={3}
                      dot={false}
                      animationDuration={800}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Data Table */}
              <div className="space-y-3 text-base">
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-white/10">
                  <span className="text-[#CFCFCF] font-semibold">항목</span>
                  <span className="text-[#CFCFCF] text-right font-semibold">값</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <span className="text-[#CFCFCF] font-medium">강도 점수</span>
                  <span className={`text-right font-bold text-lg ${marketStrength.direction === '상승' ? 'text-[#00E5A8]' : marketStrength.direction === '하락' ? 'text-[#FF4D4D]' : 'text-[#CFCFCF]'}`}>{marketStrength.score}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <span className="text-[#CFCFCF] font-medium">추세 방향</span>
                  <span className={`text-right font-bold text-lg ${marketStrength.direction === '상승' ? 'text-[#00E5A8]' :
                      marketStrength.direction === '하락' ? 'text-[#FF4D4D]' : 'text-[#CFCFCF]'
                    }`}>{marketStrength.direction}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <span className="text-[#CFCFCF] font-medium">변동성</span>
                  <span className="text-white text-right font-bold">{marketStrength.volatility}</span>
                </div>
              </div>
            </div>

            {/* 5. 매수 조건 체크 (Status Indicators) */}
            <div className="bg-[#15171A] border border-white/10 rounded-xl p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">매수 조건 체크</h3>
                <span className="text-sm text-[#CFCFCF] bg-[#0D0D0D] px-3 py-1 rounded-lg font-medium">업데이트</span>
              </div>
              <div className="text-base text-[#CFCFCF] mb-6 font-semibold">진입 조건 필터</div>

              {/* Status Indicators */}
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-white/10">
                  <span className="text-base text-[#CFCFCF] font-semibold">모멘텀 조건</span>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: entryConditions.momentum.color, boxShadow: `0 0 12px ${entryConditions.momentum.color}80` }}></div>
                    <span className="text-base font-bold" style={{ color: entryConditions.momentum.color }}>{entryConditions.momentum.status}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/10">
                  <span className="text-base text-[#CFCFCF] font-semibold">변동성 조건</span>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: entryConditions.volatility.color, boxShadow: `0 0 12px ${entryConditions.volatility.color}80` }}></div>
                    <span className="text-base font-bold" style={{ color: entryConditions.volatility.color }}>{entryConditions.volatility.status}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/10">
                  <span className="text-base text-[#CFCFCF] font-semibold">거래량 조건</span>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: entryConditions.volume.color, boxShadow: `0 0 12px ${entryConditions.volume.color}80` }}></div>
                    <span className="text-base font-bold" style={{ color: entryConditions.volume.color }}>{entryConditions.volume.status}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-base text-[#CFCFCF] font-semibold">패턴 조건</span>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: entryConditions.pattern.color, boxShadow: `0 0 12px ${entryConditions.pattern.color}80` }}></div>
                    <span className="text-base font-bold" style={{ color: entryConditions.pattern.color }}>{entryConditions.pattern.status}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}

