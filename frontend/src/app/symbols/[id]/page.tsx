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
  const [activeTab, setActiveTab] = useState<'all' | 'chart' | 'ai' | 'indicators'>('all')
  const [investmentPeriod, setInvestmentPeriod] = useState<'swing' | 'medium' | 'long'>('swing')
  const [chartView, setChartView] = useState<'daily' | 'weekly' | 'monthly'>('daily')

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
        reportType: 'comprehensive',
        investmentPeriod: investmentPeriod  // 투자 기간 파라미터 추가
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
      bullishPercentage: 50,
      signals: [],
      rsiStatus: '데이터 없음',
      macdStatus: '데이터 없음',
      ma5Status: '데이터 없음',
      ma20Status: '데이터 없음',
      stochKStatus: '데이터 없음'
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
    
    // 각 지표별 상태 추가
    const rsiStatus = indicators.rsi > 50 ? 'RSI 상승세' : 'RSI 하락세'
    const macdStatus = indicators.macd && indicators.macdSignal && indicators.macd > indicators.macdSignal 
      ? 'MACD 상승세' : 'MACD 하락세'
    const ma5Status = indicators.ma5 && indicators.ma20 && indicators.ma5 > indicators.ma20 
      ? '5일선 상승세' : '5일선 하락세'
    const ma20Status = indicators.ma20 && candles[0] && candles[0].close > indicators.ma20 
      ? '20일선 상승 돌파' : '20일선 하락'
    const stochKStatus = indicators.stochK && indicators.stochK > 50 
      ? '스토캐스틱 상승세' : '스토캐스틱 하락세'
    
    return {
      bullish: Math.round(bullishPercent),
      bearish: Math.round(100 - bullishPercent),
      bullishCount: bullishSignals,
      totalCount: totalSignals,
      bullishPercentage: Math.round(bullishPercent),
      signals,
      rsiStatus,
      macdStatus,
      ma5Status,
      ma20Status,
      stochKStatus
    }
  }

  // Widget 3: AI 신뢰도 분석 (100% 실제 데이터)
  const calculateConfidenceMetrics = () => {
    if (!aiReport && !indicators) {
      return { confidence: null, accuracy: null, consistency: null }
    }

    // 1. 신뢰도: AI 리포트 메타데이터 또는 RSI 기반 계산
    let confidence = null
    if (aiReport?.metadata?.confidence) {
      confidence = Math.round(aiReport.metadata.confidence * 100)
    } else if (indicators?.rsi) {
      // RSI가 50에서 멀수록 신뢰도 높음 (명확한 방향성)
      const rsiDeviation = Math.abs(indicators.rsi - 50)
      confidence = Math.min(95, 50 + rsiDeviation)
    }

    // 2. 정확도: 신호 일치도 (bullish vs bearish 중 더 큰 값)
    const regime = calculateSignalRegime()
    const accuracy = Math.max(regime.bullish, regime.bearish)

    // 3. 일관성: 최근 캔들 방향성 일치도 (100% 실제 계산)
    let consistency = null
    if (candles && candles.length >= 10) {
      const recentCandles = candles.slice(0, 10)
      const upCandles = recentCandles.filter(c => c.close > c.open).length
      const downCandles = recentCandles.filter(c => c.close < c.open).length
      // 상승 or 하락 캔들 중 더 많은 쪽 비율
      consistency = Math.max(upCandles, downCandles) * 10
    }

    return {
      confidence: confidence !== null ? Math.round(confidence) : null,
      accuracy: Math.round(accuracy),
      consistency: consistency !== null ? Math.round(consistency) : null
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


  // 주간 분석 생성 (AI 기반)
  const generateWeeklyAnalysis = () => {
    if (!candles || candles.length < 5 || !indicators) {
      return {
        weeklyChange: 0,
        trendSignal: '분석 중',
        events: [],
        avgVolume: 0
      }
    }
    
    const recentCandles = candles.slice(0, 5) // 최근 5일
    const weeklyChange = ((recentCandles[0].close - recentCandles[4].close) / recentCandles[4].close * 100).toFixed(2)
    const avgVolume = Math.round(recentCandles.reduce((sum, c) => sum + c.volume, 0) / 5)
    const trendSignal = indicators.rsi > 50 ? '상승세' : '하락세'
    
    // AI가 주간 이벤트 분석
    const events = []
    
    // 월~화: 주간 시작 분석
    const mondayTuesday = recentCandles.slice(3, 5)
    const earlyWeekChange = mondayTuesday.length >= 2 
      ? ((mondayTuesday[0].close - mondayTuesday[1].close) / mondayTuesday[1].close * 100).toFixed(1)
      : '0'
    events.push({
      period: '월~화',
      description: `주간 시작 ${parseFloat(earlyWeekChange) > 0 ? '상승' : '하락'} (${earlyWeekChange}%), 전주 대비 추세 ${parseFloat(weeklyChange) > 0 ? '강화' : '약화'}`
    })
    
    // 수~목: 중반 모멘텀
    const midWeek = recentCandles.slice(1, 3)
    const midVolume = midWeek.length > 0 ? midWeek.reduce((sum, c) => sum + c.volume, 0) / midWeek.length : 0
    const volumeStatus = midVolume > avgVolume * 1.2 ? '급증' : midVolume > avgVolume ? '증가' : '감소'
    events.push({
      period: '수~목',
      description: `거래량 ${volumeStatus}, ${indicators.macd && indicators.macdSignal && indicators.macd > indicators.macdSignal ? 'MACD 매수 유지' : 'MACD 신호 약화'}`
    })
    
    // 금: 주간 마무리
    const friday = recentCandles[0]
    const fridayChange = recentCandles.length >= 2 
      ? ((friday.close - recentCandles[1].close) / recentCandles[1].close * 100).toFixed(1)
      : '0'
    const weekendStrategy = parseFloat(weeklyChange) > 2 
      ? '일부 익절 고려' 
      : parseFloat(weeklyChange) < -2 
      ? '추가 매수 기회 탐색'
      : '포지션 유지 권장'
    events.push({
      period: '금',
      description: `주간 마무리 ${parseFloat(fridayChange) > 0 ? '강세' : '약세'}, ${weekendStrategy}`
    })
    
    return {
      weeklyChange: parseFloat(weeklyChange),
      trendSignal,
      events,
      avgVolume
    }
  }

  // 월간 분석 생성 (AI 기반)
  const generateMonthlyAnalysis = () => {
    if (!candles || candles.length < 20 || !indicators) {
      return {
        monthlyTrend: '분석 중',
        volumePattern: 0,
        technicalStatus: '분석 중',
        recommendation: '데이터 수집 중'
      }
    }
    
    const monthlyCandles = candles.slice(0, 20) // 최근 20일
    const monthlyChange = ((monthlyCandles[0].close - monthlyCandles[19].close) / monthlyCandles[19].close * 100).toFixed(2)
    const monthlyTrend = parseFloat(monthlyChange) > 0 ? '상승 추세' : '하락 추세'
    
    // 거래량 패턴 분석
    const avgVolume = Math.round(monthlyCandles.reduce((sum, c) => sum + c.volume, 0) / 20)
    
    // 기술적 지표 상태
    const technicalStatus = indicators.ma5 && indicators.ma20 && indicators.ma5 > indicators.ma20 
      ? '정배열 (강세)' 
      : '역배열 (약세)'
    
    // AI 기반 권장사항
    let recommendation = ''
    if (indicators.rsi && indicators.rsi > 50 && indicators.ma5 > indicators.ma20) {
      recommendation = `현재 상승 추세가 유지되고 있습니다 (${monthlyChange}% 상승). 장기 보유 관점에서 분할 매수 전략을 고려하세요.`
    } else if (indicators.rsi && indicators.rsi < 50) {
      recommendation = `단기 조정 중입니다 (${monthlyChange}% ${parseFloat(monthlyChange) > 0 ? '상승' : '하락'}). 추가 하락 시 저점 매수 기회를 노려보세요.`
    } else {
      recommendation = '현재 방향성이 불분명합니다. 명확한 신호가 나올 때까지 관망을 권장합니다.'
    }
    
    return {
      monthlyTrend,
      monthlyChange: parseFloat(monthlyChange),
      volumePattern: avgVolume,
      technicalStatus,
      recommendation
    }
  }

  // 투자 기간별 스윙 전략 생성 (AI 기반 - 상황별 시나리오 포함)
  const generateSwingStrategy = () => {
    if (!indicators || !candles || candles.length === 0) return null
    
    const currentPrice = candles[0].close
    const regime = calculateSignalRegime()
    const isBullish = regime.bullishCount > regime.totalCount / 2
    const bullishStrength = regime.bullishPercentage
    
    // AI 기반 목표가/손절가 계산
    const volatility = indicators.bbUpper && indicators.bbLower && indicators.bbMiddle
      ? ((indicators.bbUpper - indicators.bbLower) / indicators.bbMiddle * 100)
      : 3
    
    if (investmentPeriod === 'swing') {
      // 3~7일 단기 스윙 전략
      const targetPrice1 = currentPrice * (isBullish ? 1.03 : 0.97)
      const targetPrice2 = currentPrice * (isBullish ? 1.05 : 0.95)
      const stopLoss = currentPrice * 0.97  // -3% (AI 리포트와 일치)
      const sidewaysRange = { low: currentPrice * 0.98, high: currentPrice * 1.02 }
      
      return {
        title: '3~7일 스윙 전략',
        steps: [
          {
            day: '1일차',
            title: '첫 진입 (30%)',
            scenarios: [
              {
                type: 'entry',
                condition: '진입 시점',
                action: `현재가 ${currentPrice.toLocaleString()}원에서 소량 진입 (30%)`,
                reason: bullishStrength >= 60 
                  ? `매수 신호 ${bullishStrength}% - 진입 적정` 
                  : `신호 강도 ${bullishStrength}% - 신중한 진입`
              }
            ]
          },
          {
            day: '2~3일차',
            title: '추세 확인',
            scenarios: [
              {
                type: 'bullish',
                condition: `상승 시 (${targetPrice1.toLocaleString()}원 돌파)`,
                action: `추가 30% 매수`,
                reason: '추세 강화 확인, 목표가 달성 가능성 증가'
              },
              {
                type: 'sideways',
                condition: `횡보 시 (${sidewaysRange.low.toLocaleString()}~${sidewaysRange.high.toLocaleString()}원)`,
                action: `관망 유지`,
                reason: '방향성 불명확, 돌파/이탈 대기. 3일 이상 횡보 시 청산 검토'
              },
              {
                type: 'bearish',
                condition: `하락 시 (${(currentPrice * 0.97).toLocaleString()}원 하회)`,
                action: `손절 준비`,
                reason: '추세 전환 신호, 추가 하락 시 손절가 도달 주의'
              }
            ]
          },
          {
            day: '5~7일차',
            title: '최종 판단',
            scenarios: [
              {
                type: 'target',
                condition: `목표 달성 (${targetPrice2.toLocaleString()}원 이상)`,
                action: `분할 익절 (50%→30%→20%)`,
                reason: `목표 수익률 ${isBullish ? '+5%' : '-5%'} 달성`
              },
              {
                type: 'hold',
                condition: `횡보 지속 (${sidewaysRange.low.toLocaleString()}~${targetPrice1.toLocaleString()}원)`,
                action: `7일차 전량 청산`,
                reason: '기회비용 고려, 다음 종목 탐색'
              },
              {
                type: 'stop',
                condition: `손절가 도달 (${stopLoss.toLocaleString()}원 하회)`,
                action: `즉시 전량 청산`,
                reason: '손실 확정 -3%, 재진입 타이밍 재분석'
              }
            ]
          }
        ]
      }
    } else if (investmentPeriod === 'medium') {
      // 2~4주 중기 전략
      const targetPrice1 = currentPrice * (isBullish ? 1.05 : 0.95)
      const targetPrice2 = currentPrice * (isBullish ? 1.12 : 0.92)
      const stopLoss = currentPrice * 0.92
      const sidewaysRange = { low: currentPrice * 0.97, high: currentPrice * 1.03 }
      
      return {
        title: '2~4주 중기 전략',
        steps: [
          {
            day: '1주차',
            title: '초기 진입 (40%)',
            scenarios: [
              {
                type: 'entry',
                condition: '진입 시점',
                action: `현재가 ${currentPrice.toLocaleString()}원 부근 40% 진입`,
                reason: bullishStrength >= 60
                  ? '중기 상승 추세 예상, 분할 진입 시작'
                  : '신중한 진입, 추세 전환 대기'
              }
            ]
          },
          {
            day: '2~3주차',
            title: '추가 진입 및 모니터링',
            scenarios: [
              {
                type: 'bullish',
                condition: `상승 시 (${targetPrice1.toLocaleString()}원 돌파)`,
                action: `추가 40% 매수`,
                reason: '추세 강화, 5일/20일 이평선 정배열 확인'
              },
              {
                type: 'sideways',
                condition: `횡보 시 (${sidewaysRange.low.toLocaleString()}~${sidewaysRange.high.toLocaleString()}원)`,
                action: `추가 매수 보류`,
                reason: '방향성 불명확, 2주 이상 횡보 시 일부 청산 검토'
              },
              {
                type: 'bearish',
                condition: `하락 시 (${(currentPrice * 0.93).toLocaleString()}원 하회)`,
                action: `손절 라인 접근`,
                reason: '20일 이평선 이탈, 추세 전환 신호'
              }
            ]
          },
          {
            day: '4주차',
            title: '최종 판단',
            scenarios: [
              {
                type: 'target',
                condition: `목표 달성 (${targetPrice2.toLocaleString()}원 이상)`,
                action: `분할 익절 (60%→30%→10%)`,
                reason: `목표 수익률 ${isBullish ? '+12%' : '-8%'} 달성`
              },
              {
                type: 'hold',
                condition: `추세 유지 (${targetPrice1.toLocaleString()}원 이상)`,
                action: `홀딩 또는 부분 익절`,
                reason: '중기 추세 지속, 목표가 재상향 검토'
              },
              {
                type: 'stop',
                condition: `손절가 도달 (${stopLoss.toLocaleString()}원 하회)`,
                action: `전량 청산`,
                reason: '손실 확정 -8%, 재진입 전략 수립'
              }
            ]
          }
        ]
      }
    } else {
      // 1~3개월 장기 전략
      const targetPrice1 = currentPrice * 0.95
      const targetPrice2 = currentPrice * (isBullish ? 1.20 : 1.10)
      const stopLoss = currentPrice * 0.85
      const ma20 = indicators.ma20 || currentPrice
      
      return {
        title: '1~3개월 장기 전략',
        steps: [
          {
            day: '1개월차',
            title: '저점 분할 매수',
            scenarios: [
              {
                type: 'entry',
                condition: `저점 진입 (${targetPrice1.toLocaleString()}원 이하)`,
                action: `3~4회 분할 매수 (각 25%)`,
                reason: '장기 관점 평균 단가 낮추기, 변동성 분산'
              },
              {
                type: 'sideways',
                condition: `현재가 유지 (${currentPrice.toLocaleString()}원 부근)`,
                action: `2~3회 분할 매수`,
                reason: '횡보 구간 활용, 저점 매수 기회 탐색'
              }
            ]
          },
          {
            day: '2개월차',
            title: '추세 전환 대기',
            scenarios: [
              {
                type: 'bullish',
                condition: `20일선 돌파 (${ma20.toLocaleString()}원 이상)`,
                action: `추세 확인, 홀딩 유지`,
                reason: '중장기 상승 전환, 목표가 상향 조정'
              },
              {
                type: 'sideways',
                condition: `박스권 횡보 (${(currentPrice * 0.95).toLocaleString()}~${(currentPrice * 1.05).toLocaleString()}원)`,
                action: `관망 유지`,
                reason: '기업 실적/뉴스 모니터링, 돌파 대기'
              },
              {
                type: 'bearish',
                condition: `추세 약화 (20일선 하회)`,
                action: `손절 라인 점검`,
                reason: '장기 하락 전환 가능성, 리스크 관리'
              }
            ]
          },
          {
            day: '3개월차',
            title: '수익 실현 전략',
            scenarios: [
              {
                type: 'target',
                condition: `목표 달성 (${targetPrice2.toLocaleString()}원, +${isBullish ? '20' : '10'}%)`,
                action: `단계적 청산 (50%→30%→20%)`,
                reason: '장기 목표 달성, 수익 확정'
              },
              {
                type: 'hold',
                condition: `목표 미달 (+5~10%)`,
                action: `추가 1개월 홀딩 검토`,
                reason: '장기 추세 유지, 목표가 재설정'
              },
              {
                type: 'stop',
                condition: `손절가 도달 (${stopLoss.toLocaleString()}원, -15%)`,
                action: `전량 청산`,
                reason: '장기 하락 추세 확정, 손실 제한'
              }
            ]
          }
        ]
      }
    }
  }

  // AI 결론 요약 계산 (투자 기간 고려)
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
    let period = investmentPeriod === 'swing' ? '단기 스윙 (3~7일)' : 
                 investmentPeriod === 'medium' ? '중기 (2~4주)' : '장기 (1~3개월)'
    
    // 투자 기간별 임계값 조정
    const thresholds = investmentPeriod === 'swing' 
      ? { strong: 70, buy: 55, neutral: 45, caution: 30 }
      : investmentPeriod === 'medium'
      ? { strong: 65, buy: 50, neutral: 40, caution: 25 }
      : { strong: 60, buy: 45, neutral: 35, caution: 20 }
    
    if (totalScore >= thresholds.strong) {
      action = '강력 매수'
      actionColor = '#00E5A8'
      shortTerm = '상승 가능성 높음'
      
      if (investmentPeriod === 'swing') {
        recommendation = `${period} 기간 내 1일차 진입 전략 고려 (현재가 ${candles[0].close.toLocaleString()}원)`
      } else if (investmentPeriod === 'medium') {
        recommendation = `이번 주 내 첫 진입 후 2~3주차 추가 매수 (목표: +10~12%)`
      } else {
        recommendation = `1개월간 3~4회 분할 매수로 평균 단가 낮추기 (목표: +20~30%)`
      }
      risk = '낮음'
      riskLevel = 'low'
    } else if (totalScore >= thresholds.buy) {
      action = '매수'
      actionColor = '#00D1FF'
      shortTerm = '소폭 상승 가능성'
      
      if (investmentPeriod === 'swing') {
        recommendation = `${period} 기간 내 소량 진입 후 추세 확인`
      } else if (investmentPeriod === 'medium') {
        recommendation = `1주차 소량 진입 후 2주차 추가 검토 (목표: +7~10%)`
      } else {
        recommendation = `첫 달 저점 매수 기회 포착, 2개월차 추세 확인 (목표: +15~20%)`
      }
      risk = '중간'
      riskLevel = 'medium'
    } else if (totalScore >= thresholds.neutral) {
      action = '관망'
      actionColor = '#CFCFCF'
      shortTerm = '방향성 불명확'
      recommendation = investmentPeriod === 'swing'
        ? `${period} 내 명확한 추세 확인 후 진입`
        : investmentPeriod === 'medium'
        ? '1주일 추세 확인 후 재평가'
        : '월간 추세 전환 시점 대기'
      risk = '중간'
      riskLevel = 'medium'
    } else if (totalScore >= thresholds.caution) {
      action = '주의'
      actionColor = '#FFA500'
      shortTerm = '하락 가능성'
      recommendation = '신규 진입 자제, 시장 상황 모니터링'
      risk = '높음'
      riskLevel = 'high'
      period = investmentPeriod === 'swing' ? '단기 조정 예상' : '중기 조정 예상'
    } else {
      action = '매도'
      actionColor = '#FF4D4D'
      shortTerm = '하락 추세'
      recommendation = '보유 시 청산 검토 권장'
      risk = '매우 높음'
      riskLevel = 'very-high'
      period = '청산 검토 필요'
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
                {confidenceMetrics.confidence !== null ? (
                  <>
                    <span className="text-white font-semibold">{confidenceMetrics.confidence}%</span>
                    <span className="text-[#CFCFCF]">
                      {confidenceMetrics.confidence >= 80 ? '높음' : 
                       confidenceMetrics.confidence >= 60 ? '보통' : '낮음'}
                    </span>
                  </>
                ) : (
                  <span className="text-[#CFCFCF]">데이터 없음</span>
                )}
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
              <p className="text-xs sm:text-sm text-[#00E5A8] font-semibold mb-0.5">스윙/중장기 투자 분석 서비스</p>
              <p className="text-[10px] sm:text-xs text-[#CFCFCF] leading-relaxed">
                시세는 <span className="text-white font-semibold">20분 지연</span>이나, 일중·주간 투자 전략에는 영향 없습니다.
                <span className="block mt-0.5 text-[#00E5A8]">
                  ✓ 추세 분석 및 기술적 지표 기반 · 스윙/중기 투자용
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* 모바일 탭 네비게이션 */}
        <div className="lg:hidden sticky top-[57px] z-20 bg-[#0D0D0D] -mx-3 px-3 py-2 border-b border-white/10">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-[#15171A] text-[#CFCFCF] hover:bg-[#1a1d21]'
              }`}
            >
              전체 보기
            </button>
            <button
              onClick={() => setActiveTab('chart')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'chart'
                  ? 'bg-primary-600 text-white'
                  : 'bg-[#15171A] text-[#CFCFCF] hover:bg-[#1a1d21]'
              }`}
            >
              차트
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'ai'
                  ? 'bg-primary-600 text-white'
                  : 'bg-[#15171A] text-[#CFCFCF] hover:bg-[#1a1d21]'
              }`}
            >
              AI 분석
            </button>
            <button
              onClick={() => setActiveTab('indicators')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'indicators'
                  ? 'bg-primary-600 text-white'
                  : 'bg-[#15171A] text-[#CFCFCF] hover:bg-[#1a1d21]'
              }`}
            >
              지표
            </button>
          </div>
        </div>

        {/* 메인 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4">

          {/* 좌측 차트/AI 영역 */}
          {(activeTab === 'all' || activeTab === 'chart' || activeTab === 'ai') && (
          <div className={`space-y-3 sm:space-y-4 ${
            activeTab === 'chart' ? 'col-span-full' : 
            activeTab === 'ai' ? 'col-span-full lg:col-span-2' : 
            'lg:col-span-2'
          }`}>
            {(activeTab === 'all' || activeTab === 'chart') && (
            <div className="glass-panel rounded-lg p-3 sm:p-4">
              <div className="flex flex-col gap-3 mb-3">
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
                
                {/* 차트 뷰 선택 버튼 */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setChartView('daily')}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      chartView === 'daily'
                        ? 'bg-gradient-to-r from-[rgba(0,229,168,0.2)] to-[rgba(0,209,255,0.2)] text-[#00E5A8] border border-[rgba(0,229,168,0.4)]'
                        : 'bg-[rgba(255,255,255,0.05)] text-[#CFCFCF] hover:bg-[rgba(255,255,255,0.1)]'
                    }`}
                  >
                    일별
                  </button>
                  <button
                    onClick={() => setChartView('weekly')}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      chartView === 'weekly'
                        ? 'bg-gradient-to-r from-[rgba(0,229,168,0.2)] to-[rgba(0,209,255,0.2)] text-[#00E5A8] border border-[rgba(0,229,168,0.4)]'
                        : 'bg-[rgba(255,255,255,0.05)] text-[#CFCFCF] hover:bg-[rgba(255,255,255,0.1)]'
                    }`}
                  >
                    주간 요약
                  </button>
                  <button
                    onClick={() => setChartView('monthly')}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      chartView === 'monthly'
                        ? 'bg-gradient-to-r from-[rgba(0,229,168,0.2)] to-[rgba(0,209,255,0.2)] text-[#00E5A8] border border-[rgba(0,229,168,0.4)]'
                        : 'bg-[rgba(255,255,255,0.05)] text-[#CFCFCF] hover:bg-[rgba(255,255,255,0.1)]'
                    }`}
                  >
                    월간 전략
                  </button>
                </div>
              </div>

              {/* 차트 뷰별 컨텐츠 */}
              {chartView === 'daily' && (
              <>
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
              </>
              )}
              
              {/* AI 기반 주간 요약 뷰 */}
              {chartView === 'weekly' && (() => {
                const weeklyData = generateWeeklyAnalysis()
                const eventColors = ['#00E5A8', '#00D1FF', '#FFB800']
                
                return (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-[rgba(0,229,168,0.1)] to-[rgba(0,209,255,0.1)] border border-[rgba(0,229,168,0.3)] rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-5 h-5 text-[#00E5A8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <h3 className="text-base sm:text-lg font-bold text-white">이번 주 AI 분석</h3>
                      </div>
                      <div className="space-y-3">
                        {weeklyData.events.map((event, index) => (
                          <div key={index} className="bg-[rgba(0,0,0,0.3)] rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <span 
                                className="text-xs font-semibold"
                                style={{ color: eventColors[index % 3] }}
                              >
                                {event.period}
                              </span>
                              <p className="text-xs text-[#CFCFCF] flex-1">
                                {event.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-lg p-3">
                        <p className="text-xs text-[#CFCFCF] mb-1">주간 변동률</p>
                        <p className={`text-lg font-bold ${weeklyData.weeklyChange > 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                          {weeklyData.weeklyChange > 0 ? '+' : ''}{weeklyData.weeklyChange}%
                        </p>
                      </div>
                      <div className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-lg p-3">
                        <p className="text-xs text-[#CFCFCF] mb-1">추세 신호</p>
                        <p className={`text-lg font-bold ${weeklyData.trendSignal === '상승세' ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                          {weeklyData.trendSignal}
                        </p>
                      </div>
                      <div className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-lg p-3 col-span-2">
                        <p className="text-xs text-[#CFCFCF] mb-1">평균 거래량</p>
                        <p className="text-base font-bold text-white">
                          {weeklyData.avgVolume.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })()}
              
              {/* AI 기반 월간 전략 뷰 */}
              {chartView === 'monthly' && (() => {
                const monthlyData = generateMonthlyAnalysis()
                
                return (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-[rgba(0,209,255,0.1)] to-[rgba(138,43,226,0.1)] border border-[rgba(0,209,255,0.3)] rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-5 h-5 text-[#00D1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <h3 className="text-base sm:text-lg font-bold text-white">AI 장기 추세 분석</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="bg-[rgba(0,0,0,0.3)] rounded-lg p-4">
                          <p className="text-sm font-semibold text-white mb-2">월간 투자 체크리스트</p>
                          <ul className="space-y-2">
                            <li className="flex items-start gap-2">
                              <span className="text-[#00E5A8]">✓</span>
                              <p className="text-xs text-[#CFCFCF]">
                                월간 추세: <span className={(monthlyData.monthlyChange || 0) > 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}>
                                  {monthlyData.monthlyTrend} ({(monthlyData.monthlyChange || 0) > 0 ? '+' : ''}{monthlyData.monthlyChange || 0}%)
                                </span>
                              </p>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-[#00D1FF]">✓</span>
                              <p className="text-xs text-[#CFCFCF]">
                                거래량 패턴: 최근 20일 평균 <span className="text-white font-semibold">{monthlyData.volumePattern.toLocaleString()}</span>
                              </p>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-[#FFB800]">✓</span>
                              <p className="text-xs text-[#CFCFCF]">
                                기술적 지표: <span className={monthlyData.technicalStatus.includes('강세') ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}>
                                  {monthlyData.technicalStatus}
                                </span>
                              </p>
                            </li>
                          </ul>
                        </div>
                        
                        <div className="bg-gradient-to-r from-[rgba(0,229,168,0.15)] to-[rgba(0,209,255,0.15)] border border-[rgba(0,229,168,0.4)] rounded-lg p-4">
                          <p className="text-sm font-semibold text-white mb-2">AI 전략 권장사항</p>
                          <p className="text-xs text-[#CFCFCF] leading-relaxed">
                            {monthlyData.recommendation}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
            )}

            {/* AI 분석 리포트 섹션 */}
            {/* @ts-ignore */}
            {(activeTab === 'all' || activeTab === 'ai') && aiReport && (
              <>
                {/* 투자 기간 선택 옵션 */}
                <div className="glass-panel rounded-xl p-4 sm:p-5 mb-4 bg-gradient-to-r from-[rgba(0,229,168,0.05)] to-[rgba(0,209,255,0.05)] border border-[rgba(0,229,168,0.2)]">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white mb-1">투자 기간 설정</h3>
                      <p className="text-xs text-[#CFCFCF]">선택한 기간에 맞춰 AI 분석과 전략이 조정됩니다</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setInvestmentPeriod('swing')}
                        className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                          investmentPeriod === 'swing'
                            ? 'bg-gradient-to-r from-[rgba(0,229,168,0.2)] to-[rgba(0,209,255,0.2)] text-[#00E5A8] border border-[rgba(0,229,168,0.4)]'
                            : 'bg-[rgba(255,255,255,0.05)] text-[#CFCFCF] hover:bg-[rgba(255,255,255,0.1)]'
                        }`}
                      >
                        단기 스윙<br className="sm:hidden" /><span className="text-[10px] sm:text-xs opacity-80"> (3~7일)</span>
                      </button>
                      <button
                        onClick={() => setInvestmentPeriod('medium')}
                        className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                          investmentPeriod === 'medium'
                            ? 'bg-gradient-to-r from-[rgba(0,229,168,0.2)] to-[rgba(0,209,255,0.2)] text-[#00E5A8] border border-[rgba(0,229,168,0.4)]'
                            : 'bg-[rgba(255,255,255,0.05)] text-[#CFCFCF] hover:bg-[rgba(255,255,255,0.1)]'
                        }`}
                      >
                        중기<br className="sm:hidden" /><span className="text-[10px] sm:text-xs opacity-80"> (2~4주)</span>
                      </button>
                      <button
                        onClick={() => setInvestmentPeriod('long')}
                        className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                          investmentPeriod === 'long'
                            ? 'bg-gradient-to-r from-[rgba(0,229,168,0.2)] to-[rgba(0,209,255,0.2)] text-[#00E5A8] border border-[rgba(0,229,168,0.4)]'
                            : 'bg-[rgba(255,255,255,0.05)] text-[#CFCFCF] hover:bg-[rgba(255,255,255,0.1)]'
                        }`}
                      >
                        장기<br className="sm:hidden" /><span className="text-[10px] sm:text-xs opacity-80"> (1~3개월)</span>
                      </button>
                    </div>
                  </div>
                </div>

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
                      <p className="text-xs sm:text-sm text-[#00E5A8]">AI가 분석한 최적 투자 전략 • {investmentPeriod === 'swing' ? '단기 스윙' : investmentPeriod === 'medium' ? '중기' : '장기'} 기준</p>
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
                      {confidenceMetrics.confidence !== null && (
                        <div 
                          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[rgba(0,229,168,0.2)] to-transparent"
                          style={{ height: `${confidenceMetrics.confidence}%` }}
                        ></div>
                      )}
                      <p className="text-xs text-[#CFCFCF] mb-2 relative z-10">신뢰도</p>
                      {confidenceMetrics.confidence !== null ? (
                        <>
                          <p className="text-2xl font-bold text-[#00E5A8] relative z-10">{confidenceMetrics.confidence}%</p>
                          <p className="text-xs text-[#00E5A8] mt-1 relative z-10">
                            {confidenceMetrics.confidence >= 70 ? '높음' : confidenceMetrics.confidence >= 50 ? '보통' : '낮음'}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-[#CFCFCF] relative z-10">데이터 없음</p>
                      )}
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

                  {/* AI 기반 스윙 전략 템플릿 */}
                  {(aiConclusion.action === '강력 매수' || aiConclusion.action === '매수') && (() => {
                    const strategy = generateSwingStrategy()
                    if (!strategy) return null
                    
                    return (
                      <div className="mt-5 pt-5 border-t border-[rgba(255,255,255,0.1)]">
                        <div className="flex items-center gap-2 mb-4">
                          <svg className="w-5 h-5 text-[#00E5A8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                          <p className="text-sm font-semibold text-white">{strategy.title}</p>
                        </div>
                        
                        <div className="space-y-4">
                          {strategy.steps.map((step, stepIndex) => {
                            const colors = [
                              { bg: 'rgba(0,229,168,0.1)', border: '#00E5A8', circle: '#00E5A8' },
                              { bg: 'rgba(0,209,255,0.1)', border: '#00D1FF', circle: '#00D1FF' },
                              { bg: 'rgba(255,184,0,0.1)', border: '#FFB800', circle: '#FFB800' }
                            ]
                            const color = colors[stepIndex % 3]
                            
                            return (
                              <div key={stepIndex} className="space-y-2">
                                {/* 단계 헤더 */}
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs"
                                    style={{ backgroundColor: color.circle }}
                                  >
                                    {stepIndex + 1}
                                  </div>
                                  <p className="text-sm font-bold text-white">
                                    {step.day}: {step.title}
                                  </p>
                                </div>
                                
                                {/* 시나리오별 대응 */}
                                <div className="ml-9 space-y-2">
                                  {step.scenarios.map((scenario, scenarioIndex) => {
                                    const scenarioIcons = {
                                      'entry': {
                                        svg: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
                                        bg: 'rgba(0,229,168,0.15)',
                                        border: 'rgba(0,229,168,0.3)',
                                        icon: '#00E5A8',
                                        text: '#00E5A8'
                                      },
                                      'bullish': {
                                        svg: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />,
                                        bg: 'rgba(0,229,168,0.15)',
                                        border: 'rgba(0,229,168,0.3)',
                                        icon: '#00E5A8',
                                        text: '#00E5A8'
                                      },
                                      'sideways': {
                                        svg: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />,
                                        bg: 'rgba(255,184,0,0.15)',
                                        border: 'rgba(255,184,0,0.3)',
                                        icon: '#FFB800',
                                        text: '#FFB800'
                                      },
                                      'bearish': {
                                        svg: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />,
                                        bg: 'rgba(255,77,77,0.15)',
                                        border: 'rgba(255,77,77,0.3)',
                                        icon: '#FF4D4D',
                                        text: '#FF4D4D'
                                      },
                                      'target': {
                                        svg: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />,
                                        bg: 'rgba(0,229,168,0.15)',
                                        border: 'rgba(0,229,168,0.3)',
                                        icon: '#00E5A8',
                                        text: '#00E5A8'
                                      },
                                      'hold': {
                                        svg: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
                                        bg: 'rgba(207,207,207,0.15)',
                                        border: 'rgba(207,207,207,0.3)',
                                        icon: '#CFCFCF',
                                        text: '#CFCFCF'
                                      },
                                      'stop': {
                                        svg: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />,
                                        bg: 'rgba(255,77,77,0.15)',
                                        border: 'rgba(255,77,77,0.3)',
                                        icon: '#FF4D4D',
                                        text: '#FF4D4D'
                                      }
                                    }
                                    const scenarioStyle = scenarioIcons[scenario.type] || scenarioIcons['hold']
                                    
                                    return (
                                      <div 
                                        key={scenarioIndex}
                                        className="p-3 rounded-lg transition-all hover:shadow-lg"
                                        style={{
                                          backgroundColor: scenarioStyle.bg,
                                          border: `1px solid ${scenarioStyle.border}`
                                        }}
                                      >
                                        <div className="flex items-start gap-3">
                                          <div 
                                            className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
                                            style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
                                          >
                                            <svg 
                                              className="w-4 h-4" 
                                              fill="none" 
                                              stroke={scenarioStyle.icon} 
                                              viewBox="0 0 24 24"
                                            >
                                              {scenarioStyle.svg}
                                            </svg>
                                          </div>
                                          <div className="flex-1">
                                            <p className="text-xs font-semibold text-[#CFCFCF] mb-1">
                                              {scenario.condition}
                                            </p>
                                            <p className="text-sm font-bold mb-1" style={{ color: scenarioStyle.text }}>
                                              → {scenario.action}
                                            </p>
                                            <p className="text-xs text-[#CFCFCF]/80">
                                              {scenario.reason}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                </div>

                {/* 상세 AI 분석 리포트 */}
                <div className="glass-panel rounded-xl p-5 sm:p-6 lg:p-8">
                  <div className="flex justify-between items-center mb-3 sm:mb-4">
                    <h2 className="text-xl sm:text-2xl font-bold text-white">AI 분석 리포트 (상세)</h2>
                    <span className="text-sm sm:text-base text-[#CFCFCF] font-medium">
                      {new Date(aiReport.createdAt).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  
                  {/* 면책 문구 */}
                  <div className="mb-5 sm:mb-6 p-3 sm:p-4 bg-[rgba(255,184,0,0.1)] border border-[rgba(255,184,0,0.3)] rounded-lg">
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#FFB800] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-xs sm:text-sm text-[#FFB800] font-semibold mb-1">투자 유의사항</p>
                        <p className="text-[10px] sm:text-xs text-[#CFCFCF] leading-relaxed">
                          본 분석은 <span className="text-white font-semibold">스윙/중장기 투자 참고용</span>이며, 투자 권유가 아닙니다. 
                          <span className="block mt-1">모든 투자 결정과 그에 따른 손익은 투자자 본인의 책임입니다.</span>
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <AiReportViewer report={aiReport.content || ''} />
                </div>
              </>
            )}
            {/* @ts-ignore */}
            {(activeTab === 'all' || activeTab === 'ai') && !aiReport && (
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
          )}

          {/* 우측 분석 위젯 패널 - 5개 위젯, 2열 그리드 */}
          {(activeTab === 'all' || activeTab === 'indicators') && (
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 auto-rows-min ${
            activeTab === 'indicators' ? 'col-span-full lg:grid-cols-3' : 'lg:col-span-2'
          }`}>

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

              {/* Data Table - 기간별 변화율 (3컬럼) */}
              <div className="space-y-1.5 text-[10px] sm:text-xs">
                <div className="grid grid-cols-4 gap-1 pb-1.5 border-b border-[rgba(255,255,255,0.05)]">
                  <span className="text-[#CFCFCF] font-semibold text-left">기간</span>
                  <span className="text-[#CFCFCF] font-semibold text-right">당시</span>
                  <span className="text-[#CFCFCF] font-semibold text-right">현재</span>
                  <span className="text-[#CFCFCF] font-semibold text-right">변화</span>
                </div>
                <div className="grid grid-cols-4 gap-1 py-0.5 border-b border-[rgba(255,255,255,0.03)]">
                  <span className="text-[#CFCFCF] font-light text-left text-[9px] sm:text-[10px]">15분</span>
                  <span className="text-white font-semibold text-right tabular-nums">{historicalChanges.min15Price?.toLocaleString() || '-'}</span>
                  <span className="text-[#00E5A8] font-semibold text-right tabular-nums">{historicalChanges.current?.toLocaleString() || '-'}</span>
                  <span className={`text-right font-bold tabular-nums ${Number(historicalChanges.min15) >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                    {Number(historicalChanges.min15) >= 0 ? '+' : ''}{historicalChanges.min15}%
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 py-0.5 border-b border-[rgba(255,255,255,0.03)]">
                  <span className="text-[#CFCFCF] font-light text-left text-[9px] sm:text-[10px]">1시간</span>
                  <span className="text-white font-semibold text-right tabular-nums">{historicalChanges.hour1Price?.toLocaleString() || '-'}</span>
                  <span className="text-[#00E5A8] font-semibold text-right tabular-nums">{historicalChanges.current?.toLocaleString() || '-'}</span>
                  <span className={`text-right font-bold tabular-nums ${Number(historicalChanges.hour1) >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                    {Number(historicalChanges.hour1) >= 0 ? '+' : ''}{historicalChanges.hour1}%
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 py-0.5">
                  <span className="text-[#CFCFCF] font-light text-left text-[9px] sm:text-[10px]">4시간</span>
                  <span className="text-white font-semibold text-right tabular-nums">{historicalChanges.hour4Price?.toLocaleString() || '-'}</span>
                  <span className="text-[#00E5A8] font-semibold text-right tabular-nums">{historicalChanges.current?.toLocaleString() || '-'}</span>
                  <span className={`text-right font-bold tabular-nums ${Number(historicalChanges.hour4) >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
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

              {/* Data Table - 2열 구조 (평균 제거) */}
              {confidenceMetrics.confidence !== null ? (
                <div className="space-y-2 text-base">
                  <div className="grid grid-cols-2 gap-3 pb-2 border-b border-[rgba(255,255,255,0.05)]">
                    <span className="text-[#CFCFCF] font-semibold text-left">지표</span>
                    <span className="text-[#CFCFCF] font-semibold text-right">수치</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 py-1 border-b border-[rgba(255,255,255,0.03)]">
                    <span className="text-[#CFCFCF] font-light text-left">신뢰도</span>
                    <span className="text-[#00E5A8] text-right font-semibold text-lg tabular-nums">
                      {confidenceMetrics.confidence !== null ? `${confidenceMetrics.confidence}%` : '데이터 없음'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 py-1 border-b border-[rgba(255,255,255,0.03)]">
                    <span className="text-[#CFCFCF] font-light text-left">정확도</span>
                    <span className="text-[#00E5A8] text-right font-semibold text-lg tabular-nums">
                      {confidenceMetrics.accuracy !== null ? `${confidenceMetrics.accuracy}%` : '데이터 없음'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 py-1">
                    <span className="text-[#CFCFCF] font-light text-left">일관성</span>
                    <span className="text-[#00E5A8] text-right font-semibold text-lg tabular-nums">
                      {confidenceMetrics.consistency !== null ? `${confidenceMetrics.consistency}%` : '데이터 없음'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[100px] text-[#CFCFCF]">
                  <p className="text-sm">데이터 없음</p>
                </div>
              )}
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


          </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  )
}


