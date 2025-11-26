'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useIsAuthenticated } from '@/stores/authStore'
import { api } from '@/lib/api'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import toast from 'react-hot-toast'
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
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

  // Yahoo Finance API가 최신 캔들(진행 중)의 OHLC를 null로 반환하므로
  // 완성된 마지막 캔들(index 1)을 사용
  const latestCandle = candles && candles.length > 1 ? candles[1] : (candles && candles.length > 0 ? candles[0] : null)
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
    console.log('⭐⭐⭐ latestCandle:', latestCandle)
    console.log('⭐⭐⭐ latestCandle?.close:', latestCandle?.close)
    console.log('⭐⭐⭐ latestCandle?.open:', latestCandle?.open)
    console.log('⭐⭐⭐ latestCandle?.high:', latestCandle?.high)
    console.log('⭐⭐⭐ latestCandle?.low:', latestCandle?.low)
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
    if (!indicators || !candles || candles.length === 0) return { 
      bullish: 50, 
      bearish: 50, 
      bullishCount: 0, 
      totalCount: 0,
      signals: []
    }

    let bullishSignals = 0
    let totalSignals = 0
    const signals: Array<{name: string, isBullish: boolean}> = []

    if (indicators.rsi !== undefined) {
      totalSignals++
      const isBullish = indicators.rsi > 50
      if (isBullish) bullishSignals++
      signals.push({ name: 'RSI', isBullish })
    }

    if (indicators.macd !== undefined && indicators.macdSignal !== undefined) {
      totalSignals++
      const isBullish = indicators.macd > indicators.macdSignal
      if (isBullish) bullishSignals++
      signals.push({ name: 'MACD', isBullish })
    }

    if (indicators.ma20 !== undefined && candles[0]) {
      totalSignals++
      const isBullish = candles[0].close > indicators.ma20
      if (isBullish) bullishSignals++
      signals.push({ name: '20일선', isBullish })
    }

    if (indicators.ma5 !== undefined && indicators.ma20 !== undefined) {
      totalSignals++
      const isBullish = indicators.ma5 > indicators.ma20
      if (isBullish) bullishSignals++
      signals.push({ name: '정배열', isBullish })
    }

    if (indicators.stochK !== undefined) {
      totalSignals++
      const isBullish = indicators.stochK > 50
      if (isBullish) bullishSignals++
      signals.push({ name: '스토캐스틱', isBullish })
    }

    const bullishPercent = totalSignals > 0 ? (bullishSignals / totalSignals * 100) : 50
    return {
      bullish: Math.round(bullishPercent),
      bearish: Math.round(100 - bullishPercent),
      bullishCount: bullishSignals,
      totalCount: totalSignals,
      signals
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

  // AI 결론 요약 계산
  const calculateAiConclusion = () => {
    if (!indicators || !candles || candles.length === 0) {
      return {
        action: '관망',
        actionColor: '#CFCFCF',
        shortTerm: '데이터 부족',
        risk: '알 수 없음',
        riskLevel: 'medium',
        recommendation: '데이터 수집 중',
        period: '평가 불가',
        reasons: []
      }
    }

    const regime = calculateSignalRegime()
    const strength = calculateMarketStrength()
    
    let totalScore = 50
    let reasons: string[] = []
    
    // RSI 분석
    if (indicators.rsi) {
      if (indicators.rsi > 70) {
        totalScore -= 15
        reasons.push('RSI 과매수')
      } else if (indicators.rsi < 30) {
        totalScore += 15
        reasons.push('RSI 과매도')
      } else if (indicators.rsi > 50) {
        totalScore += 10
        reasons.push('RSI 상승 모멘텀')
      }
    }
    
    // MACD
    if (indicators.macd !== undefined && indicators.macdSignal !== undefined) {
      if (indicators.macd > indicators.macdSignal) {
        totalScore += 15
        reasons.push('MACD 매수 신호')
      } else {
        totalScore -= 10
        reasons.push('MACD 매도 신호')
      }
    }
    
    // 이동평균
    if (indicators.ma5 && indicators.ma20 && candles[0]) {
      const price = candles[0].close
      if (price > indicators.ma5 && indicators.ma5 > indicators.ma20) {
        totalScore += 20
        reasons.push('정배열 (상승 추세)')
      } else if (price < indicators.ma5 && indicators.ma5 < indicators.ma20) {
        totalScore -= 15
        reasons.push('역배열 (하락 추세)')
      }
    }
    
    totalScore = Math.max(0, Math.min(100, totalScore))
    
    let action = '관망'
    let actionColor = '#CFCFCF'
    let shortTerm = ''
    let recommendation = ''
    let risk = ''
    let riskLevel = 'medium'
    let period = '단기 (1~3일)'
    
    if (totalScore >= 70) {
      action = '강력 매수'
      actionColor = '#00E5A8'
      shortTerm = '상승 가능성 높음'
      recommendation = '적극 매수 추천 - 현재가 기준 진입 가능'
      risk = '낮음'
      riskLevel = 'low'
      period = '단기 (1~3일)'
    } else if (totalScore >= 55) {
      action = '매수'
      actionColor = '#00D1FF'
      shortTerm = '소폭 상승 가능성'
      recommendation = '소량 진입 후 추가 대기 권장'
      risk = '중간'
      riskLevel = 'medium'
      period = '단기~중기 (3~7일)'
    } else if (totalScore >= 45) {
      action = '관망'
      actionColor = '#CFCFCF'
      shortTerm = '방향성 불명확'
      recommendation = '추가 매수는 가격 조정 이후 추천'
      risk = '중간'
      riskLevel = 'medium'
      period = '관망 후 재평가'
    } else if (totalScore >= 30) {
      action = '주의'
      actionColor = '#FFA500'
      shortTerm = '하락 가능성'
      recommendation = '신규 진입 자제, 시장 상황 모니터링'
      risk = '높음'
      riskLevel = 'high'
      period = '단기 조정 예상'
    } else {
      action = '매도'
      actionColor = '#FF4D4D'
      shortTerm = '하락 추세'
      recommendation = '이익 실현 추천 - 단계적 매도 권장'
      risk = '매우 높음'
      riskLevel = 'very-high'
      period = '즉시 청산 검토'
    }

    return {
      action,
      actionColor,
      shortTerm,
      risk,
      riskLevel,
      recommendation,
      period,
      reasons: reasons.slice(0, 4)
    }
  }

  const historicalChanges = calculateHistoricalChanges()
  const signalRegime = calculateSignalRegime()
  const confidenceMetrics = calculateConfidenceMetrics()
  const marketStrength = calculateMarketStrength()
  const entryConditions = calculateEntryConditions()
  const aiConclusion = calculateAiConclusion()

  // 추세 방향 계산 (한글)
  const trendDirection = marketStrength.direction === '상승' ? '상승 추세' : marketStrength.direction === '하락' ? '하락 추세' : '중립'
  const trendColor = marketStrength.direction === '상승' ? '#00E5A8' : marketStrength.direction === '하락' ? '#FF4D4D' : '#CFCFCF'
  const isBullish = marketStrength.direction === '상승'
  const isBearish = marketStrength.direction === '하락'
  const priceChange = candles.length > 1 ? ((latestCandle.close - candles[1].close) / candles[1].close * 100) : 0

  return (
    <DashboardLayout>
      <div className="space-y-3 sm:space-y-4">

        {/* 상단 헤더 - 가격 정보 (유리 패널) */}
        <div className="glass-panel rounded-lg p-3 sm:p-4 lg:p-6 relative">
          {/* 20분 지연 워터마크 */}
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-[rgba(255,77,77,0.1)] border border-[rgba(255,77,77,0.3)] px-2 py-1 rounded">
            <span className="text-[10px] sm:text-xs text-[#FF4D4D] font-semibold">⏱ 지연</span>
          </div>
          <div className="flex flex-col gap-2 mb-3 sm:mb-4">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white leading-tight pr-12">{symbol?.name}</h1>
            <span className="text-xs sm:text-sm text-[#CFCFCF] font-mono">{symbol?.code} · {symbol?.market}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs sm:text-sm text-[#CFCFCF] mb-1.5 font-semibold flex items-center gap-1">
                현재가
              </p>
              <div className="flex items-center gap-1.5 mb-1.5">
                <p className="text-xl sm:text-2xl font-bold text-white">
                  {symbol?.currentPrice ? symbol.currentPrice.toLocaleString() : (latestCandle ? latestCandle.close.toLocaleString() : '0')}
                  <span className="text-xs ml-0.5">원</span>
                </p>
                {candles && candles.length > 0 && (
                  <Sparkline 
                    data={candles.slice(0, 30).map(c => c.close).reverse()} 
                    color={priceChange >= 0 ? '#00E5A8' : '#FF4D4D'}
                    width={40}
                    height={20}
                  />
                )}
              </div>
              <p className={`text-sm sm:text-base font-bold ${
                (symbol?.priceChangePercent ?? priceChange) >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'
              }`}>
                {(symbol?.priceChangePercent ?? priceChange) >= 0 ? '+' : ''}
                {(symbol?.priceChangePercent ?? priceChange).toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-[#CFCFCF] mb-1.5 font-semibold">시가</p>
              <div className="flex items-center gap-1">
                <p className="text-sm sm:text-base font-bold text-white truncate">
                  {symbol?.dayOpen ? symbol.dayOpen.toLocaleString() : (latestCandle ? latestCandle.open.toLocaleString() : '0')}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-[#CFCFCF] mb-1.5 font-semibold">고가</p>
              <div className="flex items-center gap-1">
                <ArrowUp className="w-3 h-3 text-[#00E5A8]" />
                <p className="text-sm sm:text-base font-bold text-[#00E5A8] truncate">
                  {symbol?.dayHigh ? symbol.dayHigh.toLocaleString() : (latestCandle ? latestCandle.high.toLocaleString() : '0')}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-[#CFCFCF] mb-1.5 font-semibold">저가</p>
              <div className="flex items-center gap-1">
                <ArrowDown className="w-3 h-3 text-[#FF4D4D]" />
                <p className="text-sm sm:text-base font-bold text-[#FF4D4D] truncate">
                  {symbol?.dayLow ? symbol.dayLow.toLocaleString() : (latestCandle ? latestCandle.low.toLocaleString() : '0')}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-[#CFCFCF] mb-1.5 font-semibold">거래량</p>
              {(symbol?.volume || latestCandle) && candles && candles.length > 0 ? (
                <VolumeBar 
                  current={symbol?.volume || latestCandle.volume} 
                  max={Math.max(...candles.slice(0, 20).map(c => c.volume), symbol?.volume || latestCandle.volume)} 
                  width={80}
                  height={6}
                />
              ) : (
                <span className="text-xs text-[#CFCFCF]">0</span>
              )}
            </div>
          </div>
        </div>

        {/* AI 종합 판단 */}
        <div 
          className="glass-panel rounded-lg p-3 sm:p-4 lg:p-6 border-l-4"
          style={{ borderLeftColor: aiConclusion.actionColor }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* AI 판단 */}
            <div className="lg:col-span-1">
              <p className="text-xs sm:text-sm text-[#CFCFCF] mb-1">AI 종합 판단</p>
              <p className="text-xl sm:text-2xl font-bold mb-2" style={{ color: aiConclusion.actionColor }}>
                {aiConclusion.action}
              </p>
              <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                <span className="text-[#CFCFCF]">신뢰도</span>
                <span className="text-white font-semibold">{confidenceMetrics.confidence}%</span>
                <span className="text-[#CFCFCF]">
                  {confidenceMetrics.confidence >= 80 ? '높음' : 
                   confidenceMetrics.confidence >= 60 ? '보통' : '낮음'}
                </span>
              </div>
            </div>

            {/* 핵심 정보 */}
            <div className="lg:col-span-2 grid grid-cols-3 gap-2 sm:gap-3">
              <div>
                <p className="text-[10px] sm:text-xs text-[#CFCFCF] mb-1">추세</p>
                <div 
                  className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ 
                    backgroundColor: trendColor === '#00E5A8' ? 'rgba(0, 229, 168, 0.15)' : 
                                     trendColor === '#FF4D4D' ? 'rgba(255, 77, 77, 0.15)' : 'rgba(207, 207, 207, 0.15)',
                    color: trendColor
                  }}
                >
                  {trendDirection === '상승 추세' ? '상승' : trendDirection === '하락 추세' ? '하락' : '중립'}
                </div>
              </div>
              
              <div>
                <p className="text-[10px] sm:text-xs text-[#CFCFCF] mb-1">강도</p>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-lg sm:text-xl font-bold text-white">{marketStrength.score}</span>
                  <span className="text-[10px] text-[#CFCFCF]">/100</span>
                </div>
              </div>
              
              <div>
                <p className="text-[10px] sm:text-xs text-[#CFCFCF] mb-1">리스크</p>
                <p className="text-sm sm:text-base font-semibold" style={{ 
                  color: aiConclusion.riskLevel === 'low' ? '#00E5A8' : 
                         aiConclusion.riskLevel === 'high' || aiConclusion.riskLevel === 'very-high' ? '#FF4D4D' : '#CFCFCF' 
                }}>
                  {aiConclusion.risk}
                </p>
              </div>
            </div>

            {/* 추천 행동 */}
            <div className="lg:col-span-1 bg-[rgba(255,255,255,0.03)] rounded-lg p-2.5 sm:p-3">
              <p className="text-[10px] sm:text-xs text-[#CFCFCF] mb-1">추천</p>
              <p className="text-xs sm:text-sm text-white font-medium leading-relaxed">{aiConclusion.recommendation}</p>
            </div>
          </div>

          {/* 판단 근거 */}
          {aiConclusion.reasons.length > 0 && (
            <div className="mt-3 sm:mt-4 pt-3 border-t border-[rgba(255,255,255,0.05)]">
              <p className="text-[10px] sm:text-xs text-[#CFCFCF] mb-2">판단 근거</p>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {aiConclusion.reasons.map((reason, idx) => (
                  <span 
                    key={idx}
                    className="text-[10px] sm:text-xs bg-[rgba(255,255,255,0.05)] text-[#CFCFCF] px-2 py-1 rounded border border-[rgba(255,255,255,0.05)]"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 지연 시세 안내 문구 */}
        <div className="glass-panel rounded-lg p-2.5 sm:p-3 bg-gradient-to-r from-[rgba(0,229,168,0.05)] to-[rgba(0,209,255,0.05)] border border-[rgba(0,229,168,0.2)]">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#00E5A8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs sm:text-sm text-[#00E5A8] font-semibold mb-0.5">시세 데이터 안내</p>
              <p className="text-[10px] sm:text-xs text-[#CFCFCF] leading-relaxed">
                시세는 <span className="text-white font-semibold">20분 지연</span> 기준입니다.
                <span className="block mt-0.5 text-[#00E5A8]">
                  ✓ AI 분석·추세 판단에는 영향 없음
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* 메인 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4">

          {/* 좌측 차트 영역 */}
          <div className="lg:col-span-2 space-y-3 sm:space-y-4">
            <div className="glass-panel rounded-lg p-3 sm:p-4">
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-bold text-white">현재 시세 분석</h2>
                  <button 
                    onClick={generateAiReport}
                    disabled={generatingReport}
                    className={`flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                      generatingReport ? 'animate-pulse' : ''
                    }`}
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${generatingReport ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{generatingReport ? '분석 중' : 'AI 분석'}</span>
                    <span className="sm:hidden">AI분석</span>
                  </button>
                </div>
                <p className="text-[10px] sm:text-xs text-[#CFCFCF]">AI가 추세·강도·모멘텀 분석</p>
              </div>

              <div className="h-48 sm:h-64">
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
              <>
                {/* 현재 추천 전략 요약 박스 */}
                <div className="glass-panel rounded-xl p-5 sm:p-6 bg-gradient-to-br from-[rgba(0,229,168,0.08)] to-[rgba(0,209,255,0.08)] border-2 border-[rgba(0,229,168,0.3)]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00E5A8] to-[#00D1FF] flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-white">현재 추천 전략 요약</h3>
                      <p className="text-xs sm:text-sm text-[#00E5A8]">AI가 분석한 최적 투자 전략</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                    <div className="bg-[rgba(0,0,0,0.3)] rounded-lg p-4">
                      <p className="text-sm text-[#CFCFCF] mb-1">🔹 전략</p>
                      <p className="text-lg font-bold text-white mb-2">{aiConclusion.action}</p>
                      <p className="text-xs text-[#00E5A8] leading-relaxed">
                        {aiConclusion.reasons.slice(0, 2).join(' • ')}
                      </p>
                    </div>
                    <div className="bg-[rgba(0,0,0,0.3)] rounded-lg p-4">
                      <p className="text-sm text-[#CFCFCF] mb-1">🔹 현재 포지션 위험도</p>
                      <p className="text-lg font-bold mb-1" style={{ 
                        color: aiConclusion.riskLevel === 'low' ? '#00E5A8' : 
                               aiConclusion.riskLevel === 'medium' ? '#FFB800' : '#FF4D4D' 
                      }}>
                        {aiConclusion.risk}
                      </p>
                      <p className="text-xs" style={{
                        color: aiConclusion.riskLevel === 'low' ? '#00E5A8' : 
                               aiConclusion.riskLevel === 'medium' ? '#FFB800' : '#FF4D4D'
                      }}>
                        {aiConclusion.riskLevel === 'low' ? '✓ 안전한 진입 구간' : 
                         aiConclusion.riskLevel === 'medium' ? '⚠ 신중한 접근 필요' : 
                         '⚠️ 고위험 주의'}
                      </p>
                    </div>
                  </div>

                  {/* 핵심 수치 3개 메트릭 - 시각적 강화 */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="text-center bg-[rgba(0,229,168,0.1)] border border-[rgba(0,229,168,0.3)] rounded-lg p-4 relative overflow-hidden">
                      <div 
                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[rgba(0,229,168,0.2)] to-transparent"
                        style={{ height: `${confidenceMetrics.confidence}%` }}
                      ></div>
                      <p className="text-xs text-[#CFCFCF] mb-2 relative z-10">신뢰도</p>
                      <p className="text-2xl font-bold text-[#00E5A8] relative z-10">{confidenceMetrics.confidence}%</p>
                      <p className="text-xs text-[#00E5A8] mt-1 relative z-10">
                        {confidenceMetrics.confidence >= 70 ? '높음' : confidenceMetrics.confidence >= 50 ? '보통' : '낮음'}
                      </p>
                    </div>
                    <div className="text-center bg-[rgba(255,184,0,0.1)] border border-[rgba(255,184,0,0.3)] rounded-lg p-4">
                      <p className="text-xs text-[#CFCFCF] mb-2">리스크</p>
                      <p className="text-3xl font-bold mb-1" style={{
                        color: aiConclusion.riskLevel === 'low' ? '#00E5A8' : 
                               aiConclusion.riskLevel === 'medium' ? '#FFB800' : '#FF4D4D'
                      }}>
                        {aiConclusion.riskLevel === 'low' ? '🟢' : 
                         aiConclusion.riskLevel === 'medium' ? '🟡' : '🔴'}
                      </p>
                      <p className="text-sm font-bold" style={{
                        color: aiConclusion.riskLevel === 'low' ? '#00E5A8' : 
                               aiConclusion.riskLevel === 'medium' ? '#FFB800' : '#FF4D4D'
                      }}>
                        {aiConclusion.risk}
                      </p>
                    </div>
                    <div className="text-center bg-[rgba(0,209,255,0.1)] border border-[rgba(0,209,255,0.3)] rounded-lg p-4 relative overflow-hidden">
                      <div 
                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[rgba(0,209,255,0.2)] to-transparent"
                        style={{ height: `${marketStrength.score}%` }}
                      ></div>
                      <p className="text-xs text-[#CFCFCF] mb-2 relative z-10">추세 강도</p>
                      <p className="text-2xl font-bold text-[#00D1FF] relative z-10">{marketStrength.score}</p>
                      <p className="text-xs text-[#00D1FF] mt-1 relative z-10">
                        {Number(marketStrength.score) >= 70 ? '강세' : Number(marketStrength.score) >= 50 ? '중립' : '약세'}
                      </p>
                    </div>
                  </div>

                  {/* 적정 행동 + 예상 기간 */}
                  <div className="bg-gradient-to-r from-[rgba(0,229,168,0.15)] to-[rgba(0,209,255,0.15)] border border-[rgba(0,229,168,0.4)] rounded-lg p-4">
                    <p className="text-sm font-semibold text-white mb-2">적정 행동</p>
                    <p className="text-sm text-[#CFCFCF] mb-3">{aiConclusion.recommendation}</p>
                    <div className="pt-3 border-t border-[rgba(255,255,255,0.1)]">
                      <p className="text-xs text-[#00E5A8]">
                        데이터 기반 예상 기간: <span className="font-semibold">{aiConclusion.period}</span>
                      </p>
                    </div>
                  </div>

                  {/* 시나리오별 액션 가이드 */}
                  <div className="mt-5 pt-5 border-t border-[rgba(255,255,255,0.1)]">
                    <p className="text-sm font-semibold text-white mb-3">다음 단계 (상황별 추천)</p>
                    
                    {/* 전략에 따른 조건부 시나리오 */}
                    {aiConclusion.action === '강력 매수' || aiConclusion.action === '매수' ? (
                      <div className="space-y-3">
                        <div className="bg-gradient-to-r from-[rgba(0,229,168,0.15)] to-[rgba(0,229,168,0.05)] border border-[rgba(0,229,168,0.4)] rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(0,229,168,0.3)] flex items-center justify-center text-[#00E5A8] font-bold">1</div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-white mb-1">현재 진입 가능</p>
                              <p className="text-xs text-[#CFCFCF]">현재가 기준 분할 매수 시작 (전체 물량의 30~50%)</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-gradient-to-r from-[rgba(0,209,255,0.15)] to-[rgba(0,209,255,0.05)] border border-[rgba(0,209,255,0.4)] rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(0,209,255,0.3)] flex items-center justify-center text-[#00D1FF] font-bold">2</div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-white mb-1">조정 시 추가 매수</p>
                              <p className="text-xs text-[#CFCFCF]">-3~5% 하락 시 알림 설정 → 추가 매수 기회</p>
                              <button className="mt-2 text-xs text-[#00D1FF] underline">알림 설정하기</button>
                            </div>
                          </div>
                        </div>
                        <div className="bg-gradient-to-r from-[rgba(255,184,0,0.15)] to-[rgba(255,184,0,0.05)] border border-[rgba(255,184,0,0.4)] rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(255,184,0,0.3)] flex items-center justify-center text-[#FFB800] font-bold">3</div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-white mb-1">목표가 도달 알림</p>
                              <p className="text-xs text-[#CFCFCF]">1차/2차 목표가 도달 시 자동 알림</p>
                              <button className="mt-2 text-xs text-[#FFB800] underline">알림 설정하기</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : aiConclusion.action === '관망' ? (
                      <div className="space-y-3">
                        <div className="bg-gradient-to-r from-[rgba(207,207,207,0.15)] to-[rgba(207,207,207,0.05)] border border-[rgba(207,207,207,0.4)] rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(207,207,207,0.3)] flex items-center justify-center text-[#CFCFCF] font-bold">1</div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-white mb-1">추세 확인 후 진입</p>
                              <p className="text-xs text-[#CFCFCF]">신호 전환 시 알림 받기</p>
                              <button className="mt-2 text-xs text-[#CFCFCF] underline">알림 설정하기</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-gradient-to-r from-[rgba(255,77,77,0.15)] to-[rgba(255,77,77,0.05)] border border-[rgba(255,77,77,0.4)] rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(255,77,77,0.3)] flex items-center justify-center text-[#FF4D4D] font-bold">!</div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-white mb-1">손절가 모니터링</p>
                              <p className="text-xs text-[#CFCFCF]">손절가 접근 시 즉시 알림</p>
                              <button className="mt-2 text-xs text-[#FF4D4D] underline">알림 설정하기</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 상세 AI 분석 리포트 */}
                <div className="glass-panel rounded-xl p-5 sm:p-6 lg:p-8">
                  <div className="flex justify-between items-center mb-5 sm:mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold text-white">AI 분석 리포트 (상세)</h2>
                    <span className="text-sm sm:text-base text-[#CFCFCF] font-medium">
                      {new Date(aiReport.createdAt).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <AiReportViewer report={aiReport.content || ''} />
                </div>
              </>
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
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 auto-rows-min">

                    {/* 1. 시장 시세 분석 (Area Chart + Data Table) */}
                    <div className="glass-panel rounded-lg p-3 sm:p-4">
              <div className="mb-2">
                <h3 className="text-sm sm:text-base font-bold text-white">시장 시세</h3>
              </div>
              <div className="text-xs sm:text-sm text-[#CFCFCF] mb-3 font-semibold">가격 추이</div>

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
                  <div className="flex items-center justify-center h-[80px] text-[#CFCFCF] text-xs">
                    데이터 없음
                  </div>
                )}
              </div>

              {/* Data Table - 기간별 변화율 */}
              <div className="space-y-1.5 text-xs sm:text-sm">
                <div className="grid grid-cols-3 gap-2 pb-1.5 border-b border-[rgba(255,255,255,0.05)]">
                  <span className="text-[#CFCFCF] font-semibold text-left">기간</span>
                  <span className="text-[#CFCFCF] font-semibold text-right">당시</span>
                  <span className="text-[#CFCFCF] font-semibold text-right">변화</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-0.5 border-b border-[rgba(255,255,255,0.03)]">
                  <span className="text-[#CFCFCF] font-light text-left">15분</span>
                  <span className="text-white font-semibold text-right tabular-nums text-[10px] sm:text-xs">{historicalChanges.min15Price?.toLocaleString() || '-'}</span>
                  <span className={`text-right font-semibold tabular-nums text-[10px] sm:text-xs ${Number(historicalChanges.min15) >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                    {Number(historicalChanges.min15) >= 0 ? '+' : ''}{historicalChanges.min15}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-0.5 border-b border-[rgba(255,255,255,0.03)]">
                  <span className="text-[#CFCFCF] font-light text-left">1시간</span>
                  <span className="text-white font-semibold text-right tabular-nums text-[10px] sm:text-xs">{historicalChanges.hour1Price?.toLocaleString() || '-'}</span>
                  <span className={`text-right font-semibold tabular-nums text-[10px] sm:text-xs ${Number(historicalChanges.hour1) >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                    {Number(historicalChanges.hour1) >= 0 ? '+' : ''}{historicalChanges.hour1}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-0.5">
                  <span className="text-[#CFCFCF] font-light text-left">4시간</span>
                  <span className="text-white font-semibold text-right tabular-nums text-[10px] sm:text-xs">{historicalChanges.hour4Price?.toLocaleString() || '-'}</span>
                  <span className={`text-right font-semibold tabular-nums text-[10px] sm:text-xs ${Number(historicalChanges.hour4) >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                    {Number(historicalChanges.hour4) >= 0 ? '+' : ''}{historicalChanges.hour4}%
                  </span>
                </div>
              </div>
            </div>

            {/* 2. 기술적 신호 분석 */}
            <div className="glass-panel rounded-lg p-3 sm:p-4">
              <div className="mb-3">
                <h3 className="text-sm sm:text-base font-bold text-white">기술적 신호</h3>
              </div>
              
              {/* 메인 결과 */}
              <div className="mb-4 p-3 rounded-lg border" style={{
                backgroundColor: signalRegime.bullishCount >= signalRegime.totalCount * 0.8 
                  ? 'rgba(0, 229, 168, 0.1)' 
                  : signalRegime.bullishCount >= signalRegime.totalCount * 0.6
                  ? 'rgba(0, 209, 255, 0.1)'
                  : signalRegime.bullishCount >= signalRegime.totalCount * 0.4
                  ? 'rgba(207, 207, 207, 0.1)'
                  : 'rgba(255, 77, 77, 0.1)',
                borderColor: signalRegime.bullishCount >= signalRegime.totalCount * 0.8 
                  ? 'rgba(0, 229, 168, 0.3)' 
                  : signalRegime.bullishCount >= signalRegime.totalCount * 0.6
                  ? 'rgba(0, 209, 255, 0.3)'
                  : signalRegime.bullishCount >= signalRegime.totalCount * 0.4
                  ? 'rgba(207, 207, 207, 0.3)'
                  : 'rgba(255, 77, 77, 0.3)'
              }}>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs text-[#CFCFCF]">
                    {signalRegime.totalCount}개 지표 중
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-bold tabular-nums" style={{
                      color: signalRegime.bullishCount >= signalRegime.totalCount * 0.6 
                        ? '#00E5A8' 
                        : signalRegime.bullishCount >= signalRegime.totalCount * 0.4
                        ? '#CFCFCF'
                        : '#FF4D4D'
                    }}>
                      {signalRegime.bullishCount}
                    </span>
                    <span className="text-sm text-[#CFCFCF]">개</span>
                  </div>
                </div>
                <div className="text-xs sm:text-sm font-bold text-right" style={{
                  color: signalRegime.bullishCount >= signalRegime.totalCount * 0.8
                    ? '#00E5A8'
                    : signalRegime.bullishCount >= signalRegime.totalCount * 0.6
                    ? '#00D1FF'
                    : signalRegime.bullishCount >= signalRegime.totalCount * 0.4
                    ? '#CFCFCF'
                    : '#FF4D4D'
                }}>
                  {signalRegime.bullishCount >= signalRegime.totalCount * 0.8 ? '강력 매수 신호' :
                   signalRegime.bullishCount >= signalRegime.totalCount * 0.6 ? '매수 신호 우세' :
                   signalRegime.bullishCount >= signalRegime.totalCount * 0.4 ? '중립 신호' :
                   '매도 신호 우세'}
                </div>
              </div>

              {/* 지표별 상세 */}
              <div className="space-y-2">
                {signalRegime.signals.map((signal, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <span className="text-xs sm:text-sm text-[#CFCFCF]">{signal.name}</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${signal.isBullish ? 'bg-[#00E5A8]' : 'bg-[#FF4D4D]'}`} 
                           style={{ boxShadow: signal.isBullish ? '0 0 6px rgba(0, 229, 168, 0.5)' : '0 0 6px rgba(255, 77, 77, 0.5)' }}></div>
                      <span className={`font-bold text-xs sm:text-sm min-w-[32px] text-right ${signal.isBullish ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                        {signal.isBullish ? '매수' : '매도'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. AI 신뢰도 분석 (Area Chart + Table) */}
            <div className="glass-panel rounded-lg p-3 sm:p-4">
              <div className="mb-2">
                <h3 className="text-sm sm:text-base font-bold text-white">AI 신뢰도</h3>
              </div>
              <div className="text-xs sm:text-sm text-[#CFCFCF] mb-3 font-semibold">신뢰도 분석</div>

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
            <div className="glass-panel rounded-lg p-3 sm:p-4">
              <div className="mb-2">
                <h3 className="text-sm sm:text-base font-bold text-white">시장 강도</h3>
              </div>
              <div className="text-xs sm:text-sm text-[#CFCFCF] mb-3 font-semibold">강도 지표</div>

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
            <div className="glass-panel rounded-lg p-3 sm:p-4 col-span-1 sm:col-span-2">
              <div className="mb-2">
                <h3 className="text-sm sm:text-base font-bold text-white">매수 조건</h3>
              </div>
              <div className="text-xs sm:text-sm text-[#CFCFCF] mb-3 font-semibold">진입 조건</div>

              {/* Status Indicators */}
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-xs sm:text-sm text-[#CFCFCF] font-semibold">모멘텀</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: entryConditions.momentum.color }}></div>
                    <span className="text-xs sm:text-sm font-bold" style={{ color: entryConditions.momentum.color }}>{entryConditions.momentum.status}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-xs sm:text-sm text-[#CFCFCF] font-semibold">변동성</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: entryConditions.volatility.color }}></div>
                    <span className="text-xs sm:text-sm font-bold" style={{ color: entryConditions.volatility.color }}>{entryConditions.volatility.status}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-xs sm:text-sm text-[#CFCFCF] font-semibold">거래량</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: entryConditions.volume.color }}></div>
                    <span className="text-xs sm:text-sm font-bold" style={{ color: entryConditions.volume.color }}>{entryConditions.volume.status}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs sm:text-sm text-[#CFCFCF] font-semibold">패턴</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: entryConditions.pattern.color }}></div>
                    <span className="text-xs sm:text-sm font-bold" style={{ color: entryConditions.pattern.color }}>{entryConditions.pattern.status}</span>
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

