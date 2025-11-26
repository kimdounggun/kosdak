'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useIsAuthenticated } from '@/stores/authStore'
import { api } from '@/lib/api'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import toast from 'react-hot-toast'
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import AiReportViewer from '@/components/Dashboard/AiReportViewer'
import { Sparkles, RefreshCw, ArrowUp, ArrowDown } from 'lucide-react'

// 스파크라인 컴포넌트 - 단순하고 깔끔한 버전
const Sparkline = ({ data, color = '#00E5A8', width = 80, height = 24 }: { data: number[], color?: string, width?: number, height?: number }) => {
  if (!data || data.length === 0) return null
  
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min
  
  // 변동이 거의 없으면 (range가 평균의 0.1% 미만) 평평한 선만 표시
  const avg = (min + max) / 2
  const hasVariation = range > avg * 0.001
  
  const padding = 1
  const chartHeight = height - padding * 2
  const chartWidth = width - padding * 2
  
  // 단순한 선만 그리기 (area fill 제거)
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * chartWidth
    let y
    if (hasVariation) {
      y = padding + chartHeight - ((value - min) / (range || 1)) * chartHeight
    } else {
      // 변동이 없으면 중간에 평평한 선
      y = padding + chartHeight / 2
    }
    return `${x},${y}`
  }).join(' ')
  
  return (
    <svg width={width} height={height} className="overflow-visible" style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
    </svg>
  )
}

// 거래량 바 차트 컴포넌트
const VolumeBar = ({ current, max, width = 120, height = 8 }: { current: number, max: number, width?: number, height?: number }) => {
  const percentage = max > 0 ? (current / max) * 100 : 0
  const avgVolume = max / 2
  const isHigh = current > avgVolume
  
  return (
    <div className="flex items-center gap-2">
      <div className="relative" style={{ width, height }}>
        <div className="absolute inset-0 bg-[rgba(255,255,255,0.05)] rounded-full"></div>
        <div 
          className={`absolute left-0 top-0 h-full rounded-full transition-all ${
            isHigh ? 'bg-[#00E5A8]' : 'bg-[#CFCFCF]'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        ></div>
      </div>
      <span className="text-xs text-[#CFCFCF] font-light tabular-nums">{current.toLocaleString()}</span>
    </div>
  )
}

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
  const [logoError, setLogoError] = useState(false)
  const [localLogoError, setLocalLogoError] = useState(false)

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

  const latestCandle = candles && candles.length > 0 ? candles[0] : null
  const trendData = candles && candles.length > 0 
    ? candles.map((c, idx) => ({ value: c.close, index: idx })).reverse().slice(0, 30)
    : []
  const volumeData = candles && candles.length > 0
    ? candles.map((c, idx) => ({ value: c.volume, index: idx })).reverse().slice(0, 30)
    : []

  // 디버깅: 데이터 확인
  if (candles && candles.length > 0) {
    console.log('캔들 데이터 개수:', candles.length)
    console.log('첫 5개 캔들 상세:', candles.slice(0, 5).map(c => ({ 
      close: c.close, 
      open: c.open,
      high: c.high,
      low: c.low,
      volume: c.volume,
      timestamp: c.timestamp,
      isDelayed: c.isDelayed
    })))
    console.log('trendData:', trendData.slice(0, 5))
    const uniqueValues = new Set(trendData.map(d => d.value))
    console.log('고유한 가격 값 개수:', uniqueValues.size, '값들:', Array.from(uniqueValues).slice(0, 10))
    
    // 실제 데이터인지 확인 (타임스탬프가 최근인지)
    const latestTimestamp = candles[0]?.timestamp
    const now = new Date()
    const timeDiff = latestTimestamp ? (now.getTime() - new Date(latestTimestamp).getTime()) / (1000 * 60) : null
    console.log('최신 데이터 타임스탬프:', latestTimestamp, timeDiff ? `(${Math.round(timeDiff)}분 전)` : '없음')
  } else {
    console.log('캔들 데이터 없음')
  }

  // ===== 데이터 계산 함수들 =====

  // Widget 1: 시장 시세 분석 - 실제 기간별 가격 변화 계산
  const calculateHistoricalChanges = () => {
    if (!candles || candles.length < 2) {
      console.log('시장 시세 분석: 캔들 데이터 부족', candles?.length || 0)
      return { min15: '0', hour1: '0', hour4: '0', min15Price: 0, hour1Price: 0, hour4Price: 0, current: 0 }
    }

    const current = candles[0].close
    // 5분봉 기준: 15분 = 3개, 1시간 = 12개, 4시간 = 48개
    const min15Idx = Math.min(3, candles.length - 1)
    const hour1Idx = Math.min(12, candles.length - 1)
    const hour4Idx = Math.min(48, candles.length - 1)
    
    const min15Price = candles[min15Idx]?.close || current
    const hour1Price = candles[hour1Idx]?.close || current
    const hour4Price = candles[hour4Idx]?.close || current

    console.log('시장 시세 분석 디버그:', {
      캔들수: candles.length,
      현재가: current,
      '15분_인덱스': min15Idx,
      '15분_가격': min15Price,
      '1시간_인덱스': hour1Idx,
      '1시간_가격': hour1Price,
      '4시간_인덱스': hour4Idx,
      '4시간_가격': hour4Price,
    })

    return {
      min15: ((current - min15Price) / min15Price * 100).toFixed(1),
      hour1: ((current - hour1Price) / hour1Price * 100).toFixed(1),
      hour4: ((current - hour4Price) / hour4Price * 100).toFixed(1),
      min15Price,
      hour1Price,
      hour4Price,
      current,
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

  // 추세 방향 계산 (한글)
  const trendDirection = marketStrength.direction === '상승' ? '상승 추세' : marketStrength.direction === '하락' ? '하락 추세' : '중립'
  const trendColor = marketStrength.direction === '상승' ? '#00E5A8' : marketStrength.direction === '하락' ? '#FF4D4D' : '#CFCFCF'
  const isBullish = marketStrength.direction === '상승'
  const isBearish = marketStrength.direction === '하락'
  const priceChange = candles.length > 1 ? ((latestCandle.close - candles[1].close) / candles[1].close * 100) : 0

  return (
    <DashboardLayout>
      <div className="space-y-5 sm:space-y-6">

        {/* 상단 헤더 - 가격 정보 (유리 패널) */}
        <div className="glass-panel rounded-xl p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-4 mb-5 sm:mb-6 lg:mb-8">
            {(() => {
              const localLogoUrl = symbol?.code ? `/logos/${symbol.code}.png` : null
              const dbLogoUrl = symbol?.logoUrl
              const logoUrl = localLogoUrl && !localLogoError 
                ? localLogoUrl 
                : (dbLogoUrl && !logoError ? dbLogoUrl : null)
              
              return logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt={symbol.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-xl object-contain flex-shrink-0 bg-white/5 p-2"
                  style={{ 
                    imageRendering: '-webkit-optimize-contrast',
                    width: 'auto',
                    height: 'auto',
                    maxWidth: '100%',
                    maxHeight: '100%'
                  }}
                  loading="eager"
                  onError={() => {
                    if (localLogoUrl && !localLogoError) {
                      setLocalLogoError(true)
                    } else if (dbLogoUrl && !logoError) {
                      setLogoError(true)
                    }
                  }}
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-2xl sm:text-3xl lg:text-4xl">
                    {symbol?.name?.charAt(0) || '?'}
                  </span>
                </div>
              )
            })()}
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-3 sm:gap-4">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight">{symbol?.name}</h1>
              <span className="text-base sm:text-base lg:text-lg text-[#CFCFCF] font-mono font-medium">{symbol?.code} · {symbol?.market}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 sm:gap-6 lg:gap-8">
            <div>
              <p className="text-base sm:text-base text-[#CFCFCF] mb-3 font-semibold">종가</p>
              <div className="flex items-center gap-2 sm:gap-3 mb-3">
                <p className="text-2xl sm:text-2xl lg:text-3xl font-bold text-white">{latestCandle ? latestCandle.close.toLocaleString() : '0'}원</p>
                {candles && candles.length > 0 && (
                  <Sparkline 
                    data={candles.slice(0, 30).map(c => c.close).reverse()} 
                    color={priceChange >= 0 ? '#00E5A8' : '#FF4D4D'}
                    width={60}
                    height={30}
                  />
                )}
              </div>
              <p className={`text-lg sm:text-lg font-bold ${priceChange >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-base sm:text-base text-[#CFCFCF] mb-3 font-semibold">시가</p>
              <div className="flex items-center gap-2 sm:gap-3">
                <p className="text-xl sm:text-xl lg:text-2xl font-bold text-white">{latestCandle ? latestCandle.open.toLocaleString() : '0'}원</p>
                {candles && candles.length > 0 && (
                  <Sparkline 
                    data={candles.slice(0, 30).map(c => c.open).reverse()} 
                    color="#CFCFCF" 
                    width={50}
                    height={25}
                  />
                )}
              </div>
            </div>
            <div>
              <p className="text-base sm:text-base text-[#CFCFCF] mb-3 font-semibold">고가</p>
              <div className="flex items-center gap-2">
                <ArrowUp className="w-4 h-4 sm:w-4 sm:h-4 text-[#00E5A8]" />
                <p className="text-xl sm:text-xl lg:text-2xl font-bold text-[#00E5A8]">{latestCandle ? latestCandle.high.toLocaleString() : '0'}원</p>
                {candles && candles.length > 0 && (
                  <Sparkline 
                    data={candles.slice(0, 30).map(c => c.high).reverse()} 
                    color="#00E5A8" 
                    width={50}
                    height={25}
                  />
                )}
              </div>
            </div>
            <div>
              <p className="text-base sm:text-base text-[#CFCFCF] mb-3 font-semibold">저가</p>
              <div className="flex items-center gap-2">
                <ArrowDown className="w-4 h-4 sm:w-4 sm:h-4 text-[#FF4D4D]" />
                <p className="text-xl sm:text-xl lg:text-2xl font-bold text-[#FF4D4D]">{latestCandle ? latestCandle.low.toLocaleString() : '0'}원</p>
                {candles && candles.length > 0 && (
                  <Sparkline 
                    data={candles.slice(0, 30).map(c => c.low).reverse()} 
                    color="#FF4D4D" 
                    width={50}
                    height={25}
                  />
                )}
              </div>
            </div>
            <div>
              <p className="text-base text-[#CFCFCF] mb-3 font-semibold">거래량</p>
              {latestCandle && candles && candles.length > 0 ? (
                <VolumeBar 
                  current={latestCandle.volume} 
                  max={Math.max(...candles.slice(0, 20).map(c => c.volume), latestCandle.volume)} 
                  width={140}
                />
              ) : (
                <span className="text-base text-[#CFCFCF]">0</span>
              )}
            </div>
          </div>
        </div>

        {/* 3개 핵심 지표 - 상단 강조 (유리 패널) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
          <div className="glass-panel rounded-xl p-5 sm:p-6 text-center sm:text-left">
            <p className="text-base sm:text-base text-[#CFCFCF] mb-3 sm:mb-3 font-semibold">오늘 추세</p>
            <div className="flex items-center justify-center mb-3 sm:mb-4">
              <div 
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center"
                style={{ 
                  backgroundColor: trendColor === '#00E5A8' ? 'rgba(0, 229, 168, 0.1)' : trendColor === '#FF4D4D' ? 'rgba(255, 77, 77, 0.1)' : 'rgba(207, 207, 207, 0.1)',
                  border: `2px solid ${trendColor}`
                }}
              >
                <p className="text-lg sm:text-xl font-bold" style={{ color: trendColor }}>
                  {trendDirection === '상승 추세' ? '상승' : trendDirection === '하락 추세' ? '하락' : '중립'}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.05)]">
              <p className="text-sm sm:text-sm text-[#CFCFCF] font-light">시장 방향성</p>
            </div>
          </div>
          <div className="glass-panel rounded-xl p-5 sm:p-6 text-center sm:text-left">
            <p className="text-base sm:text-base text-[#CFCFCF] mb-3 sm:mb-3 font-semibold">종합 강도 점수</p>
            <div className="flex items-baseline justify-center sm:justify-start gap-2 mb-2">
              <p className="text-3xl sm:text-4xl font-bold text-white tabular-nums">{marketStrength.score}</p>
              <span className="text-base sm:text-lg text-[#CFCFCF] font-light">/ 100</span>
            </div>
            <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.05)]">
              <p className="text-base font-semibold" style={{ color: trendColor }}>{marketStrength.direction}</p>
              <p className="text-sm text-[#CFCFCF] font-light mt-2">변동성: {marketStrength.volatility}</p>
            </div>
          </div>
          <div className="glass-panel rounded-xl p-5 sm:p-6 text-center sm:text-left">
            <p className="text-base sm:text-base text-[#CFCFCF] mb-4 sm:mb-4 font-semibold">AI 신뢰도</p>
            {/* 반달형 게이지 - 개선된 버전 */}
            <div className="relative w-24 h-12 sm:w-28 sm:h-14 mb-2 sm:mb-3 mx-auto sm:mx-0 flex items-center justify-center">
              <svg width="112" height="56" viewBox="0 0 112 56" className="overflow-visible w-full h-full">
                <defs>
                  <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00E5A8" />
                    <stop offset="100%" stopColor="#00D1FF" />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                {/* 배경 반원 - 얇은 라인 */}
                <path
                  d="M 14 42 A 42 42 0 0 1 98 42"
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="1"
                />
                {/* 채워진 반원 - 네온 효과 */}
                <path
                  d="M 14 42 A 42 42 0 0 1 98 42"
                  fill="none"
                  stroke="url(#gaugeGrad)"
                  strokeWidth="2.5"
                  strokeDasharray={`${(confidenceMetrics.confidence / 100) * 132} 132`}
                  strokeLinecap="round"
                  filter="url(#glow)"
                />
                {/* 숫자 텍스트 - SVG 내부에 정확히 중앙 배치 */}
                <text
                  x="56"
                  y="28"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-lg sm:text-xl font-bold fill-white tabular-nums"
                  style={{ fontSize: '18px' }}
                >
                  {confidenceMetrics.confidence}%
                </text>
              </svg>
            </div>
            <p className="text-sm sm:text-base text-[#CFCFCF] mt-2 font-medium">정확도 {confidenceMetrics.accuracy}%</p>
          </div>
        </div>

        {/* 메인 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 sm:gap-6">

          {/* 좌측 차트 영역 */}
          <div className="lg:col-span-2 space-y-5 sm:space-y-6">
            <div className="glass-panel rounded-xl p-5 sm:p-6 lg:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-5 sm:mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">현재 시세 분석</h2>
                  <p className="text-base sm:text-base text-[#CFCFCF] font-medium">AI가 추세·강도·모멘텀을 실시간 분석합니다</p>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
                  <button 
                    onClick={generateAiReport}
                    disabled={generatingReport}
                    className={`flex items-center justify-center gap-2 sm:gap-2 px-4 sm:px-6 lg:px-8 py-3 sm:py-3 lg:py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm sm:text-sm lg:text-base font-semibold rounded-lg sm:rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-blue-500/50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto min-h-[44px] ${
                      generatingReport ? 'animate-pulse' : ''
                    }`}
                  >
                    <Sparkles className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 ${generatingReport ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{generatingReport ? 'AI 분석 중...' : 'AI 분석 새로고침'}</span>
                    <span className="sm:hidden">{generatingReport ? '분석 중' : '새로고침'}</span>
                    <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 ${generatingReport ? 'animate-spin' : ''}`} />
                  </button>
                  <div className="hidden sm:flex flex-col items-end gap-1">
                    <span className="text-sm text-[#CFCFCF] font-semibold">최근 데이터 기반 재분석</span>
                    <span className="text-xs text-[#CFCFCF] font-medium">AI가 추세·강도·모멘텀을 다시 계산합니다</span>
                  </div>
                </div>
              </div>

              <div className="h-64 sm:h-80 lg:h-96">
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={trendColor} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={trendColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="index" hide />
                      <YAxis 
                        hide 
                        domain={['dataMin - 100', 'dataMax + 100']}
                        allowDataOverflow={false}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={trendColor} 
                        strokeWidth={3} 
                        fill="url(#trendGrad)" 
                        animationDuration={800}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-[#CFCFCF]">
                    데이터가 없습니다
                  </div>
                )}
              </div>
            </div>

            {/* AI 분석 리포트 섹션 */}
            {aiReport ? (
              <div className="glass-panel rounded-xl p-5 sm:p-6 lg:p-8">
                <div className="flex justify-between items-center mb-5 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-white">AI 분석 리포트</h2>
                  <span className="text-sm sm:text-base text-[#CFCFCF] font-medium">
                    {new Date(aiReport.createdAt).toLocaleString('ko-KR')}
                  </span>
                </div>
                <AiReportViewer report={aiReport.content || ''} />
              </div>
            ) : (
              <div className="glass-panel rounded-xl p-6 sm:p-8">
                <div className="text-center py-6 sm:py-8">
                  <Sparkles className="w-12 h-12 sm:w-16 sm:h-16 text-[#CFCFCF] mx-auto mb-5 sm:mb-6" />
                  <p className="text-lg sm:text-xl text-white mb-3 font-bold">AI 분석 리포트가 없습니다</p>
                  <p className="text-base text-[#CFCFCF] mb-6 sm:mb-8 font-medium">최근 데이터를 기반으로 AI가 종합 분석을 수행합니다</p>
                  <button
                    onClick={generateAiReport}
                    disabled={generatingReport}
                    className={`flex items-center justify-center gap-2 sm:gap-3 px-6 sm:px-10 py-3 sm:py-4 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-lg sm:rounded-xl text-sm sm:text-base lg:text-lg font-semibold sm:font-bold transition-all shadow-md hover:shadow-primary-500/50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mx-auto w-full sm:w-auto min-h-[44px] ${
                      generatingReport ? 'animate-pulse' : ''
                    }`}
                  >
                    <Sparkles className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 ${generatingReport ? 'animate-spin' : ''}`} />
                    <span>{generatingReport ? 'AI 분석 생성 중...' : 'AI 분석 생성하기'}</span>
                  </button>
                  <p className="text-base text-[#CFCFCF] mt-4 font-medium">AI가 추세·강도·모멘텀을 분석합니다</p>
                </div>
              </div>
            )}
          </div>

          {/* 우측 분석 위젯 패널 - 5개 위젯, 2열 그리드 */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 auto-rows-min">

                    {/* 1. 시장 시세 분석 (Area Chart + Data Table) */}
                    <div className="glass-panel rounded-xl p-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">시장 시세 분석</h3>
                <span className="text-sm text-[#CFCFCF] glass-panel px-2.5 sm:px-3 py-1 rounded-lg font-medium">업데이트</span>
              </div>
              <div className="text-base text-[#CFCFCF] mb-4 font-semibold">시장 가격 추이</div>

              {/* Area Chart */}
              <div className="mb-4">
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={120}>
                    <AreaChart data={trendData.slice(0, 20)} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="marketAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={trendColor} stopOpacity={0.6} />
                          <stop offset="100%" stopColor={trendColor} stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="index" hide />
                      <YAxis 
                        hide 
                        domain={['dataMin - 50', 'dataMax + 50']}
                        allowDataOverflow={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={trendColor}
                        strokeWidth={3}
                        fill="url(#marketAreaGrad)"
                        animationDuration={800}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[120px] text-[#CFCFCF] text-sm">
                    데이터 없음
                  </div>
                )}
              </div>

              {/* Data Table - 기간별 변화율 */}
              <div className="space-y-2 text-base">
                <div className="grid grid-cols-3 gap-3 pb-2 border-b border-[rgba(255,255,255,0.05)]">
                  <span className="text-[#CFCFCF] font-semibold text-left">기간</span>
                  <span className="text-[#CFCFCF] font-semibold text-right">당시 가격</span>
                  <span className="text-[#CFCFCF] font-semibold text-right">변화율</span>
                </div>
                <div className="grid grid-cols-3 gap-3 py-1 border-b border-[rgba(255,255,255,0.03)]">
                  <span className="text-[#CFCFCF] font-light text-left">15분 전</span>
                  <span className="text-white font-semibold text-right tabular-nums">{historicalChanges.min15Price?.toLocaleString() || '-'}</span>
                  <span className={`text-right font-semibold tabular-nums ${Number(historicalChanges.min15) >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                    {Number(historicalChanges.min15) >= 0 ? '+' : ''}{historicalChanges.min15}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 py-1 border-b border-[rgba(255,255,255,0.03)]">
                  <span className="text-[#CFCFCF] font-light text-left">1시간 전</span>
                  <span className="text-white font-semibold text-right tabular-nums">{historicalChanges.hour1Price?.toLocaleString() || '-'}</span>
                  <span className={`text-right font-semibold tabular-nums ${Number(historicalChanges.hour1) >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                    {Number(historicalChanges.hour1) >= 0 ? '+' : ''}{historicalChanges.hour1}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 py-1">
                  <span className="text-[#CFCFCF] font-light text-left">4시간 전</span>
                  <span className="text-white font-semibold text-right tabular-nums">{historicalChanges.hour4Price?.toLocaleString() || '-'}</span>
                  <span className={`text-right font-semibold tabular-nums ${Number(historicalChanges.hour4) >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                    {Number(historicalChanges.hour4) >= 0 ? '+' : ''}{historicalChanges.hour4}%
                  </span>
                </div>
              </div>
            </div>

            {/* 2. 신뢰 조건 & 트렌드 (Donut Chart + Legend) */}
            <div className="glass-panel rounded-xl p-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">신뢰 조건 & 트렌드</h3>
                <span className="text-sm text-[#CFCFCF] glass-panel px-2.5 sm:px-3 py-1 rounded-lg font-medium">업데이트</span>
              </div>
              <div className="text-base text-[#CFCFCF] mb-4 font-semibold">신호 체제 분석</div>

              {/* Donut Chart - 샤프한 스타일 */}
              <div className="flex items-center justify-center h-36 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <linearGradient id="bullishGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#00E5A8" />
                        <stop offset="100%" stopColor="#00D1FF" />
                      </linearGradient>
                    </defs>
                    <Pie
                      data={[{ value: signalRegime.bullish }, { value: signalRegime.bearish }]}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      startAngle={90}
                      endAngle={450}
                      animationDuration={800}
                    >
                      <Cell 
                        fill={signalRegime.bullish > 50 ? 'url(#bullishGrad)' : 'rgba(207,207,207,0.2)'} 
                        stroke={signalRegime.bullish > 50 ? '#00E5A8' : 'rgba(255,255,255,0.1)'}
                        strokeWidth={1}
                      />
                      <Cell 
                        fill={signalRegime.bearish > 50 ? '#FF4D4D' : 'rgba(207,207,207,0.2)'} 
                        stroke={signalRegime.bearish > 50 ? '#FF4D4D' : 'rgba(255,255,255,0.1)'}
                        strokeWidth={1}
                      />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend - 얇은 라인 구분 */}
              <div className="space-y-2 text-base">
                <div className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.05)]">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-sm bg-[#00E5A8]" style={{ boxShadow: '0 0 6px rgba(0, 229, 168, 0.5)' }}></div>
                    <span className="text-[#CFCFCF] font-light">강세 신호</span>
                  </div>
                  <span className="text-[#00E5A8] font-semibold text-lg tabular-nums">{signalRegime.bullish}%</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-sm bg-[#CFCFCF]"></div>
                    <span className="text-[#CFCFCF] font-light">중립/약세</span>
                  </div>
                  <span className="text-[#CFCFCF] font-semibold text-lg tabular-nums">{signalRegime.bearish}%</span>
                </div>
              </div>
            </div>

            {/* 3. AI 신뢰도 분석 (Area Chart + Table) */}
            <div className="glass-panel rounded-xl p-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">AI 신뢰도 분석</h3>
                <span className="text-sm text-[#CFCFCF] glass-panel px-2.5 sm:px-3 py-1 rounded-lg font-medium">업데이트</span>
              </div>
              <div className="text-base text-[#CFCFCF] mb-4 font-semibold">AI 신뢰도 분석</div>

              {/* Area Chart */}
              <div className="mb-4">
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={120}>
                    <AreaChart data={trendData.slice(0, 20)} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="confidenceAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00E5A8" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="#00E5A8" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="index" hide />
                      <YAxis 
                        hide 
                        domain={['dataMin - 50', 'dataMax + 50']}
                        allowDataOverflow={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#00E5A8"
                        strokeWidth={3}
                        fill="url(#confidenceAreaGrad)"
                        animationDuration={800}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[120px] text-[#CFCFCF] text-sm">
                    데이터 없음
                  </div>
                )}
              </div>

              {/* Data Table - 수학적 정렬 */}
              <div className="space-y-2 text-base">
                <div className="grid grid-cols-3 gap-3 pb-2 border-b border-[rgba(255,255,255,0.05)]">
                  <span className="text-[#CFCFCF] font-semibold text-left">지표</span>
                  <span className="text-[#CFCFCF] font-semibold text-right">현재</span>
                  <span className="text-[#CFCFCF] font-semibold text-right">평균</span>
                </div>
                <div className="grid grid-cols-3 gap-3 py-1 border-b border-[rgba(255,255,255,0.03)]">
                  <span className="text-[#CFCFCF] font-light text-left">신뢰도</span>
                  <span className="text-[#00E5A8] text-right font-semibold text-lg tabular-nums">{confidenceMetrics.confidence}%</span>
                  <span className="text-[#CFCFCF] text-right font-light tabular-nums">65%</span>
                </div>
                <div className="grid grid-cols-3 gap-3 py-1 border-b border-[rgba(255,255,255,0.03)]">
                  <span className="text-[#CFCFCF] font-light text-left">정확도</span>
                  <span className="text-[#00E5A8] text-right font-semibold text-lg tabular-nums">{confidenceMetrics.accuracy}%</span>
                  <span className="text-[#CFCFCF] text-right font-light tabular-nums">70%</span>
                </div>
                <div className="grid grid-cols-3 gap-3 py-1">
                  <span className="text-[#CFCFCF] font-light text-left">일관성</span>
                  <span className="text-[#00E5A8] text-right font-semibold text-lg tabular-nums">{confidenceMetrics.consistency}%</span>
                  <span className="text-[#CFCFCF] text-right font-light tabular-nums">73%</span>
                </div>
              </div>
            </div>

            {/* 4. 시장 강도 지표 (Line Chart + Table) */}
            <div className="glass-panel rounded-xl p-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">시장 강도 지표</h3>
                <span className="text-sm text-[#CFCFCF] glass-panel px-2.5 sm:px-3 py-1 rounded-lg font-medium">업데이트</span>
              </div>
              <div className="text-base text-[#CFCFCF] mb-4 font-semibold">종합 시장 강도</div>

              {/* Line Chart */}
              <div className="mb-4">
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={trendData.slice(0, 20)} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="index" hide />
                      <YAxis 
                        hide 
                        domain={['dataMin - 50', 'dataMax + 50']}
                        allowDataOverflow={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={trendColor}
                        strokeWidth={3}
                        dot={false}
                        animationDuration={800}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[120px] text-[#CFCFCF] text-sm">
                    데이터 없음
                  </div>
                )}
              </div>

              {/* Data Table - 수학적 정렬 */}
              <div className="space-y-2 text-base">
                <div className="grid grid-cols-2 gap-3 pb-2 border-b border-[rgba(255,255,255,0.05)]">
                  <span className="text-[#CFCFCF] font-semibold text-left">항목</span>
                  <span className="text-[#CFCFCF] font-semibold text-right">값</span>
                </div>
                <div className="grid grid-cols-2 gap-3 py-1 border-b border-[rgba(255,255,255,0.03)]">
                  <span className="text-[#CFCFCF] font-light text-left">강도 점수</span>
                  <span className={`text-right font-semibold text-lg tabular-nums ${marketStrength.direction === '상승' ? 'text-[#00E5A8]' : marketStrength.direction === '하락' ? 'text-[#FF4D4D]' : 'text-[#CFCFCF]'}`}>{marketStrength.score}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 py-1 border-b border-[rgba(255,255,255,0.03)]">
                  <span className="text-[#CFCFCF] font-light text-left">추세 방향</span>
                  <span className={`text-right font-semibold text-lg ${marketStrength.direction === '상승' ? 'text-[#00E5A8]' :
                      marketStrength.direction === '하락' ? 'text-[#FF4D4D]' : 'text-[#CFCFCF]'
                    }`}>{marketStrength.direction}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 py-1">
                  <span className="text-[#CFCFCF] font-light text-left">변동성</span>
                  <span className="text-white text-right font-semibold">{marketStrength.volatility}</span>
                </div>
              </div>
            </div>

            {/* 5. 매수 조건 체크 (Status Indicators) */}
            <div className="glass-panel rounded-xl p-5 sm:p-6 col-span-1 sm:col-span-2">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base sm:text-lg font-bold text-white">매수 조건 체크</h3>
                <span className="text-sm text-[#CFCFCF] glass-panel px-2.5 sm:px-3 py-1 rounded-lg font-medium">업데이트</span>
              </div>
              <div className="text-base sm:text-base text-[#CFCFCF] mb-5 sm:mb-6 font-semibold">진입 조건 필터</div>

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

