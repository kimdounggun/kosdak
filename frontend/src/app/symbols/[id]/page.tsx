'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useIsAuthenticated } from '@/stores/authStore'
import { api } from '@/lib/api'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import toast from 'react-hot-toast'
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot } from 'recharts'
import AiReportViewer from '@/components/Dashboard/AiReportViewer'
import AiTrustPanel from '@/components/Dashboard/AiTrustPanel'
import AiHistoryPanel from '@/components/Dashboard/AiHistoryPanel'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { Sparkles, RefreshCw, ArrowUp, ArrowDown } from 'lucide-react'
import { getFallbackTargets } from '@/config/trading-strategy.config'

// 프로덕션 환경 체크
const isDev = process.env.NODE_ENV === 'development'
const devLog = (...args: any[]) => isDev && console.log(...args)

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
  const [cachedReports, setCachedReports] = useState<Map<string, {data: any, timestamp: number}>>(new Map())

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

      // AI 리포트 불러오기 (선택사항)
      try {
        const aiRes = await api.get(`/ai/report/latest?symbolId=${params.id}&investmentPeriod=${investmentPeriod}`)
        setAiReport(aiRes.data)
      } catch (err) {
        // AI 리포트 없음 - 정상 (사용자가 생성해야 함)
      }
    } catch (error: any) {
      console.error('Failed to load data:', error)
      
      const status = error.response?.status
      const message = error.response?.data?.message || error.message
      
      if (status === 404) {
        toast.error('❌ 종목을 찾을 수 없습니다.', { duration: 4000 })
        setTimeout(() => router.push('/symbols'), 2000)
      } else if (status === 401 || status === 403) {
        toast.error('🔒 로그인이 필요합니다.', { duration: 3000 })
        setTimeout(() => router.push('/login'), 1500)
      } else if (status === 500) {
        toast.error(`🚨 서버 오류: ${message}`, { duration: 5000 })
      } else if (!status) {
        toast.error('🌐 네트워크 연결을 확인하세요.', { duration: 4000 })
      } else {
        toast.error(`데이터 로딩 실패: ${message || '알 수 없는 오류'}`, { duration: 4000 })
      }
    } finally {
      setLoading(false)
    }
  }

  const generateAiReport = async () => {
    if (generatingReport) return
    
    // 캐시 확인 (5분 이내 캐시 사용)
    const cacheKey = `${params.id}-${investmentPeriod}`
    const cached = cachedReports.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      devLog('✅ 캐시된 AI 리포트 사용:', cacheKey)
      setAiReport(cached.data)
      toast.success('캐시된 분석 불러오기 완료!', { id: 'ai', duration: 2000 })
      return
    }
    
    try {
      setGeneratingReport(true)
      toast.loading('AI 분석 중...', { id: 'ai' })
      
      const response = await api.post('/ai/report', {
        symbolId: params.id,
        reportType: 'comprehensive',
        investmentPeriod: investmentPeriod
      })
      
      setAiReport(response.data)
      
      // 캐시에 저장
      const newCache = new Map(cachedReports)
      newCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      })
      setCachedReports(newCache)
      devLog('💾 AI 리포트 캐시 저장:', cacheKey)
      
      toast.success('AI 분석 완료!', { id: 'ai' })
    } catch (error: any) {
      console.error('AI 분석 에러:', error)
      
      // 상세한 에러 메시지
      const status = error.response?.status
      const message = error.response?.data?.message || error.message
      
      if (status === 429) {
        toast.error('⏱️ 요청이 너무 많습니다. 1분 후 다시 시도하세요.', { id: 'ai', duration: 5000 })
      } else if (status === 402 || status === 403) {
        toast.error('💰 API 크레딧이 부족합니다. 관리자에게 문의하세요.', { id: 'ai', duration: 5000 })
      } else if (status === 500) {
        toast.error(`🚨 서버 오류: ${message}`, { id: 'ai', duration: 5000 })
      } else if (status === 404) {
        toast.error('❌ 종목 데이터를 찾을 수 없습니다.', { id: 'ai', duration: 4000 })
      } else if (!status) {
        toast.error('🌐 네트워크 연결을 확인하세요.', { id: 'ai', duration: 4000 })
      } else {
        toast.error(`❌ AI 분석 실패: ${message || '알 수 없는 오류'}`, { id: 'ai', duration: 4000 })
      }
    } finally {
      setGeneratingReport(false)
    }
  }

  if (!isHydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-100">
        <LoadingSpinner message="인증 확인 중..." size="md" />
      </div>
    )
  }
  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner message="종목 데이터 로딩 중..." size="lg" showSteps />
      </div>
    </DashboardLayout>
  )

  // Yahoo Finance API가 최신 캔들(진행 중)의 OHLC를 null로 반환하므로
  // 완성된 마지막 캔들(index 1)을 사용
  const latestCandle = candles && candles.length > 1 ? candles[1] : (candles && candles.length > 0 ? candles[0] : null)
  const trendData = candles && candles.length > 0 
    ? candles.map((c, idx) => ({ value: c.close, index: idx })).reverse().slice(0, 30)
    : []
  const volumeData = candles && candles.length > 0
    ? candles.map((c, idx) => ({ value: c.volume, index: idx })).reverse().slice(0, 30)
    : []

  // 디버깅: 데이터 확인 (개발 환경에서만)
  if (isDev && candles && candles.length > 0) {
    devLog('캔들 데이터 개수:', candles.length)
    devLog('첫 5개 캔들 상세:', candles.slice(0, 5).map(c => ({ 
      close: c.close, 
      open: c.open,
      high: c.high,
      low: c.low,
      volume: c.volume,
      timestamp: c.timestamp,
      isDelayed: c.isDelayed
    })))
    devLog('latestCandle:', latestCandle)
    const latestTimestamp = candles[0]?.timestamp
    const now = new Date()
    const timeDiff = latestTimestamp ? (now.getTime() - new Date(latestTimestamp).getTime()) / (1000 * 60) : null
    devLog('최신 데이터 타임스탬프:', latestTimestamp, timeDiff ? `(${Math.round(timeDiff)}분 전)` : '없음')
  }

  // ===== 데이터 유효성 검증 함수들 =====

  // 한국 주식 시장 상태 확인
  const getMarketStatus = () => {
    const now = new Date()
    const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    const hours = koreaTime.getHours()
    const minutes = koreaTime.getMinutes()
    const day = koreaTime.getDay() // 0: 일요일, 6: 토요일
    const currentTime = hours * 60 + minutes // 분 단위로 변환
    
    // 주말 체크
    if (day === 0 || day === 6) {
      return { isOpen: false, status: '주말', message: '주말에는 거래가 없습니다', icon: '📅' }
    }
    
    // 시간대별 상태
    const preMarketStart = 8 * 60 + 30  // 08:30
    const marketOpen = 9 * 60           // 09:00
    const marketClose = 15 * 60 + 30    // 15:30
    const afterHoursEnd = 18 * 60       // 18:00
    
    if (currentTime < preMarketStart) {
      return { isOpen: false, status: '장 시작 전', message: '정규장 09:00 시작', icon: '🌅' }
    } else if (currentTime < marketOpen) {
      return { isOpen: false, status: '프리마켓', message: '정규장 09:00 시작', icon: '⏳' }
    } else if (currentTime < marketClose) {
      return { isOpen: true, status: '장중', message: '실시간 거래 중', icon: '🟢' }
    } else if (currentTime < afterHoursEnd) {
      return { isOpen: false, status: '시간외 거래', message: '정규장 마감, 시간외 거래 중', icon: '🌙' }
    } else {
      return { isOpen: false, status: '장 마감', message: '내일 09:00에 거래 재개', icon: '🔴' }
    }
  }

  // 데이터 신선도 체크
  const checkDataFreshness = () => {
    if (!candles || candles.length === 0) return { isFresh: false, age: null, isStale: false, isCritical: false }
    
    const latestTimestamp = new Date(candles[0].timestamp)
    const now = new Date()
    const ageInMinutes = (now.getTime() - latestTimestamp.getTime()) / (1000 * 60)
    
    const marketStatus = getMarketStatus()
    
    return {
      isFresh: ageInMinutes <= 30,     // 30분 이내면 신선
      age: Math.round(ageInMinutes),
      isStale: ageInMinutes > 60 && marketStatus.isOpen,  // 장중인데 1시간 넘으면 오래됨
      isCritical: ageInMinutes > 180 && marketStatus.isOpen,  // 장중인데 3시간 넘으면 심각
      marketStatus
    }
  }

  // 지표 값 범위 검증
  const validateIndicators = () => {
    if (!indicators || !candles || candles.length === 0) {
      return { isValid: false, errors: ['데이터를 불러올 수 없습니다'] }
    }

    const errors: string[] = []
    
    // RSI는 0~100 범위여야 함
    if (indicators.rsi !== undefined && (indicators.rsi < 0 || indicators.rsi > 100)) {
      errors.push(`RSI 값 이상: ${indicators.rsi.toFixed(2)} (정상 범위: 0~100)`)
    }
    
    // 가격은 양수여야 함
    if (candles[0]?.close && candles[0].close <= 0) {
      errors.push(`가격 값 이상: ${candles[0].close}원 (양수여야 함)`)
    }
    
    // 거래량은 양수여야 함
    if (candles[0]?.volume !== undefined && candles[0].volume < 0) {
      errors.push(`거래량 값 이상: ${candles[0].volume}`)
    }
    
    // 이동평균선은 양수여야 함
    if (indicators.ma5 !== undefined && indicators.ma5 <= 0) {
      errors.push(`MA5 값 이상: ${indicators.ma5}`)
    }
    if (indicators.ma20 !== undefined && indicators.ma20 <= 0) {
      errors.push(`MA20 값 이상: ${indicators.ma20}`)
    }
    
    // MACD 값이 너무 극단적이면 이상
    if (indicators.macd !== undefined && Math.abs(indicators.macd) > 10000) {
      errors.push(`MACD 값 이상: ${indicators.macd} (너무 극단적)`)
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // 최소 데이터 요구사항 체크
  const checkMinimumData = () => {
    const minCandles = 10  // 최소 10개 캔들 필요
    const hasEnoughCandles = candles && candles.length >= minCandles
    const hasIndicators = indicators !== null && indicators !== undefined
    
    return {
      isValid: hasEnoughCandles && hasIndicators,
      candleCount: candles?.length || 0,
      minRequired: minCandles,
      hasIndicators
    }
  }

  // 전체 데이터 유효성 검증
  const dataValidation = validateIndicators()
  const dataFreshness = checkDataFreshness()
  const minimumData = checkMinimumData()

  // ===== 데이터 계산 함수들 =====

  // Widget 1: 시장 시세 분석 - 실제 기간별 가격 변화 계산
  const calculateHistoricalChanges = () => {
    if (!candles || candles.length < 2) {
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

  // Widget 3: 기술적 분석 점수 / AI 신뢰도 (조건부)
  const calculateConfidenceMetrics = () => {
    if (!indicators) {
      return { confidence: null, accuracy: null, consistency: null }
    }

    // AI 리포트가 있으면 AI 신뢰도 우선 사용
    if (aiReport?.metadata?.confidence) {
      const aiConfidence = Math.round(aiReport.metadata.confidence * 100)
      
      // 정확도: 신호 일치도
      const regime = calculateSignalRegime()
      const accuracy = regime.bullishPercentage !== null 
        ? Math.max(regime.bullishPercentage, 100 - regime.bullishPercentage)
        : null

      // 일관성: 최근 캔들 방향성
      let consistency = null
      if (candles && candles.length >= 10) {
        const recentCandles = candles.slice(0, 10)
        const upCandles = recentCandles.filter(c => c.close > c.open).length
        const downCandles = recentCandles.filter(c => c.close < c.open).length
        consistency = Math.max(upCandles, downCandles) * 10
      }

      return {
        confidence: aiConfidence,
        accuracy: accuracy !== null ? Math.round(accuracy) : null,
        consistency: consistency !== null ? Math.round(consistency) : null
      }
    }

    // AI 리포트 없으면 기술적 분석 점수 계산
    let technicalScore = null
    const signals: number[] = []

    // RSI 신호 강도 (0~20점)
    if (indicators.rsi) {
      const rsiStrength = Math.abs(indicators.rsi - 50) / 50 * 20
      signals.push(rsiStrength)
    }

    // MACD 신호 강도 (0~20점)
    if (indicators.macd !== undefined && indicators.macdSignal !== undefined) {
      const macdDiff = Math.abs(indicators.macd - indicators.macdSignal)
      const macdStrength = Math.min(20, macdDiff / 100 * 20)
      signals.push(macdStrength)
    }

    // 이동평균선 정배열/역배열 강도 (0~20점)
    if (indicators.ma5 && indicators.ma20 && indicators.ma60) {
      const isStrongUptrend = indicators.ma5 > indicators.ma20 && indicators.ma20 > indicators.ma60
      const isStrongDowntrend = indicators.ma5 < indicators.ma20 && indicators.ma20 < indicators.ma60
      signals.push((isStrongUptrend || isStrongDowntrend) ? 20 : 10)
    }

    // 거래량 확인 (0~15점)
    if (indicators.volumeRatio) {
      const volumeStrength = Math.min(15, (indicators.volumeRatio - 1) * 15)
      signals.push(Math.max(0, volumeStrength))
    }

    // 신호 일치도 (0~25점)
    const regime = calculateSignalRegime()
    const agreement = Math.max(regime.bullishPercentage || 0, 100 - (regime.bullishPercentage || 0))
    signals.push(agreement / 100 * 25)

    // 추세 지속성 (0~15점)
    if (candles && candles.length >= 10) {
      const recentCandles = candles.slice(0, 10)
      const upCandles = recentCandles.filter(c => c.close > c.open).length
      const trendStrength = Math.abs(upCandles - 5) / 5 * 15
      signals.push(trendStrength)
    }

    // 신호들의 평균으로 기술적 점수 계산
    if (signals.length > 0) {
      const avgSignal = signals.reduce((a, b) => a + b, 0) / signals.length
      technicalScore = Math.min(95, Math.max(30, 50 + avgSignal))
    }

    // 변동성 패널티
    if (technicalScore && indicators.bollingerUpper && indicators.bollingerLower && candles && candles.length > 0) {
      const currentPrice = candles[0].close
      const bbWidth = (indicators.bollingerUpper - indicators.bollingerLower) / currentPrice
      if (bbWidth > 0.1) {
        technicalScore *= 0.9
      }
    }

    // 정확도: 신호 일치도
    const accuracy = regime.bullishPercentage !== null 
      ? Math.max(regime.bullishPercentage, 100 - regime.bullishPercentage)
      : null

    // 일관성: 최근 캔들 방향성
    let consistency = null
    if (candles && candles.length >= 10) {
      const recentCandles = candles.slice(0, 10)
      const upCandles = recentCandles.filter(c => c.close > c.open).length
      const downCandles = recentCandles.filter(c => c.close < c.open).length
      consistency = Math.max(upCandles, downCandles) * 10
    }

    return {
      confidence: technicalScore !== null ? Math.round(technicalScore) : null,
      accuracy: accuracy !== null ? Math.round(accuracy) : null,
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

  // AI 리포트에서 전략 정보 파싱
  const parseAiStrategy = () => {
    if (!aiReport?.content) return null
    
    const content = aiReport.content
    const currentPrice = candles?.[0]?.close || 0
    
    // AI 리포트에서 진입가, 손절가, 목표가 파싱
    const entryMatch = content.match(/진입가:\s*([\d,]+)원/)
    const stopLossMatch = content.match(/손절가:\s*\[?현재가[^\]]*\]?\s*([\d,]+)원/)
    const target1Match = content.match(/1차 목표가:\s*\[?현재가[^\]]*\]?\s*([\d,]+)원/)
    const target2Match = content.match(/2차 목표가:\s*\[?현재가[^\]]*\]?\s*([\d,]+)원/)
    
    const entryPrice = entryMatch ? parseInt(entryMatch[1].replace(/,/g, '')) : currentPrice
    const stopLoss = stopLossMatch ? parseInt(stopLossMatch[1].replace(/,/g, '')) : currentPrice * 0.97
    const target1 = target1Match ? parseInt(target1Match[1].replace(/,/g, '')) : currentPrice * 1.03
    const target2 = target2Match ? parseInt(target2Match[1].replace(/,/g, '')) : currentPrice * 1.05
    
    return {
      entryPrice,
      stopLoss,
      target1,
      target2
    }
  }

  // 투자 기간별 스윙 전략 생성 (AI 리포트 기반)
  const generateSwingStrategy = () => {
    if (!indicators || !candles || candles.length === 0) return null
    
    const currentPrice = candles[0].close
    const regime = calculateSignalRegime()
    const bullishStrength = regime.bullishPercentage
    
    // 🆕 AI 리포트에서 가격 정보 가져오기
    const aiStrategy = parseAiStrategy()
    const targetPrice1 = aiStrategy?.target1 || currentPrice * 1.03
    const targetPrice2 = aiStrategy?.target2 || currentPrice * 1.05
    const stopLoss = aiStrategy?.stopLoss || currentPrice * 0.97
    const sidewaysRange = { low: currentPrice * 0.98, high: currentPrice * 1.02 }
    
    if (investmentPeriod === 'swing') {
      // 3~7일 단기 스윙 전략 (AI 리포트 기반)
      const aiStrategyData = aiReport?.metadata?.strategy
      
      // 디버깅: AI 전략 데이터 확인
      if (!aiStrategyData) {
        console.warn('⚠️ AI 전략 데이터 없음 - Fallback 사용', {
          hasAiReport: !!aiReport,
          hasMetadata: !!aiReport?.metadata,
          metadataKeys: aiReport?.metadata ? Object.keys(aiReport.metadata) : [],
          aiReportId: aiReport?.id,
          fullMetadata: aiReport?.metadata
        })
      } else if (!aiStrategyData.phase1 || !aiStrategyData.phase2 || !aiStrategyData.phase3) {
        console.warn('⚠️ AI 전략 데이터 불완전 - Fallback 사용', {
          phase1: !!aiStrategyData.phase1,
          phase2: !!aiStrategyData.phase2,
          phase3: !!aiStrategyData.phase3,
          phase1Keys: aiStrategyData.phase1 ? Object.keys(aiStrategyData.phase1) : [],
          phase2Keys: aiStrategyData.phase2 ? Object.keys(aiStrategyData.phase2) : [],
          phase3Keys: aiStrategyData.phase3 ? Object.keys(aiStrategyData.phase3) : [],
          phase1Data: JSON.stringify(aiStrategyData.phase1, null, 2),
          phase2Data: JSON.stringify(aiStrategyData.phase2, null, 2),
          phase3Data: JSON.stringify(aiStrategyData.phase3, null, 2),
          fullStrategy: JSON.stringify(aiStrategyData, null, 2)
        })
      } else {
        console.log('✅ AI 전략 데이터 정상:', {
          phase1: !!aiStrategyData.phase1,
          phase2: !!aiStrategyData.phase2,
          phase3: !!aiStrategyData.phase3
        })
      }
      
      // AI 전략이 있으면 사용
      if (aiStrategyData?.phase1 && aiStrategyData?.phase2 && aiStrategyData?.phase3) {
        const phase1 = aiStrategyData.phase1
        const phase2 = aiStrategyData.phase2
        const phase3 = aiStrategyData.phase3
        
        return {
          title: '3~7일 스윙 전략',
          steps: [
            {
              day: '1일차',
              title: `첫 진입 (${phase1.entryRatio}%)`,
              scenarios: [
                {
                  type: 'entry' as const,
                  condition: '진입 시점',
                  action: (() => {
                    // entryTiming 정리
                    let entryTiming = phase1.entryTiming || '';
                    // "근거:" 이후 텍스트 제거
                    if (entryTiming.includes('근거:')) {
                      entryTiming = entryTiming.split('근거:')[0].trim();
                    }
                    
                    // entryTiming이 있으면 사용
                    if (entryTiming) {
                      // entryTiming에 이미 "→"가 있고 비율 정보가 포함되어 있으면 그대로 사용
                      if (entryTiming.includes('→') && (entryTiming.includes('%') || entryTiming.includes('자산의'))) {
                        return entryTiming
                      }
                      // entryTiming에 "→"가 있지만 비율 정보가 없으면 비율만 추가
                      if (entryTiming.includes('→')) {
                        return `${entryTiming}\n→ 총 자산의 ${phase1.entryRatio}% 진입 (예: 100만원 → ${(1000000 * phase1.entryRatio / 100).toLocaleString()}원)`
                      }
                      // entryTiming에 "→"가 없으면 "→" 추가 후 비율 정보 추가
                      return `${entryTiming}\n→ 총 자산의 ${phase1.entryRatio}% 진입 (예: 100만원 → ${(1000000 * phase1.entryRatio / 100).toLocaleString()}원)`
                    }
                    // entryTiming이 없으면 기본 형식
                    return `→ 총 자산의 ${phase1.entryRatio}% 진입 (예: 100만원 → ${(1000000 * phase1.entryRatio / 100).toLocaleString()}원)`
                  })(),
                  reason: (() => {
                    // 근거를 줄바꿈으로 구분 (더 강력한 포맷팅)
                    let formattedReasoning = (phase1.reasoning || '')
                      // "1) ... 2) ..." 형식을 줄바꿈으로 구분
                      .replace(/(\d+\))\s+/g, '\n$1 ')
                      // "1) ...2) ..." (공백 없음) 형식도 처리
                      .replace(/(\d+\))([^\d\n])/g, '\n$1 $2')
                      // 시작 줄바꿈 제거
                      .replace(/^\n+/, '')
                      .trim()
                    
                    // 손절 정보 추가
                    if (phase1.stopLoss) {
                      let stopLossReason = (phase1.stopLoss.reason || '')
                        // 손절 사유도 줄바꿈으로 구분
                        .replace(/(\d+\))\s+/g, '\n$1 ')
                        .replace(/(\d+\))([^\d\n])/g, '\n$1 $2')
                        .replace(/^\n+/, '')
                        .trim()
                      
                      formattedReasoning += `\n\n🛡️ 손절: ${phase1.stopLoss.price?.toLocaleString()}원 (${phase1.stopLoss.percent}%)`
                      if (phase1.stopLoss.timing) {
                        formattedReasoning += `\n손절 타이밍: ${phase1.stopLoss.timing}`
                      }
                      if (stopLossReason) {
                        formattedReasoning += `\n손절 사유:\n${stopLossReason}`
                      }
                    }
                    
                    return formattedReasoning
                  })()
                }
              ]
            },
            {
              day: '2~3일차',
              title: '추세 확인',
              scenarios: [
                ...(phase2.bullish ? [{
                  type: 'bullish' as const,
                  condition: phase2.bullish.condition,
                  action: (() => {
                    // action에서 가격 정보가 중복되면 제거
                    const action = phase2.bullish.action || `시드의 ${phase2.bullish.actionRatio}% 추가`
                    // condition에 이미 가격이 있으면 action에서 가격 부분 제거
                    if (phase2.bullish.condition.includes('원') && action.includes('→')) {
                      return action.split('→').pop()?.trim() || action
                    }
                    return action
                  })(),
                  reason: (phase2.bullish.reason || '')
                    .replace(/(\d+\))\s+/g, '\n$1 ')
                    .replace(/(\d+\))([^\d\n])/g, '\n$1 $2')
                    .replace(/^\n+/, '')
                    .trim()
                }] : []),
                ...(phase2.sideways ? [{
                  type: 'sideways' as const,
                  condition: phase2.sideways.condition,
                  action: (() => {
                    const action = phase2.sideways.action
                    // condition에 이미 가격이 있으면 action에서 가격 부분 제거
                    if (phase2.sideways.condition.includes('원') && action.includes('→')) {
                      return action.split('→').pop()?.trim() || action
                    }
                    return action
                  })(),
                  reason: (phase2.sideways.reason || '')
                    .replace(/(\d+\))\s+/g, '\n$1 ')
                    .replace(/(\d+\))([^\d\n])/g, '\n$1 $2')
                    .replace(/^\n+/, '')
                    .trim()
                }] : []),
                ...(phase2.bearish ? [{
                  type: 'bearish' as const,
                  condition: phase2.bearish.condition,
                  action: (() => {
                    const action = phase2.bearish.action || `${phase2.bearish.exitRatio}% 청산`
                    // condition에 이미 가격이 있으면 action에서 가격 부분 제거
                    if (phase2.bearish.condition.includes('원') && action.includes('→')) {
                      return action.split('→').pop()?.trim() || action
                    }
                    return action
                  })(),
                  reason: (phase2.bearish.reason || '')
                    .replace(/(\d+\))\s+/g, '\n$1 ')
                    .replace(/(\d+\))([^\d\n])/g, '\n$1 $2')
                    .replace(/^\n+/, '')
                    .trim()
                }] : [])
              ]
            },
            {
              day: '5~7일차',
              title: '최종 판단',
              scenarios: [
                ...(phase3.target1 ? [{
                  type: 'target' as const,
                  condition: `목표 달성 (${phase3.target1.price})`,
                  action: (() => {
                    let action = phase3.target1.action || `${phase3.target1.exitRatio}% 익절`
                    // action에서 가격 정보 제거 (condition에 이미 있음)
                    // "60,461원 달성 시 → 포지션의 50% 익절" → "포지션의 50% 익절"
                    if (action.includes('→')) {
                      action = action.split('→').slice(1).join('→').trim()
                    }
                    // 가격 정보가 포함되어 있으면 제거
                    action = action.replace(/[\d,]+원\s*(?:달성\s*시|돌파|하회)?\s*→?\s*/g, '').trim()
                    return action || `${phase3.target1.exitRatio}% 익절`
                  })(),
                  reason: (phase3.target1.reason || '')
                    .replace(/(\d+\))\s+/g, '\n$1 ')
                    .replace(/(\d+\))([^\d\n])/g, '\n$1 $2')
                    .replace(/^\n+/, '')
                    .trim()
                }] : []),
                ...(phase3.target2 ? [{
                  type: 'target' as const,
                  condition: `목표 달성 (${phase3.target2.price})`,
                  action: (() => {
                    let action = phase3.target2.action || `${phase3.target2.exitRatio}% 익절`
                    // action에서 가격 정보 제거 (condition에 이미 있음)
                    if (action.includes('→')) {
                      action = action.split('→').slice(1).join('→').trim()
                    }
                    // 가격 정보가 포함되어 있으면 제거
                    action = action.replace(/[\d,]+원\s*(?:달성\s*시|돌파|하회)?\s*→?\s*/g, '').trim()
                    return action || `${phase3.target2.exitRatio}% 익절`
                  })(),
                  reason: (phase3.target2.reason || '')
                    .replace(/(\d+\))\s+/g, '\n$1 ')
                    .replace(/(\d+\))([^\d\n])/g, '\n$1 $2')
                    .replace(/^\n+/, '')
                    .trim()
                }] : [])
              ]
            }
          ]
        }
      }
      
      // Fallback
      return {
        title: '3~7일 스윙 전략',
        steps: [
          {
            day: '1일차',
            title: '첫 진입 (30%)',
            scenarios: [
              {
                type: 'entry' as const,
                condition: '진입 시점',
                action: `현재가 ${currentPrice.toLocaleString()}원에서 소량 진입 (30%)`,
                reason: bullishStrength >= 100 
                  ? '전 지표 매수 신호 - 진입 조건 최적'
                  : bullishStrength >= 80
                  ? '대부분 지표 매수 신호 - 진입 조건 양호'
                  : bullishStrength >= 60
                  ? '지표 혼조세 - 진입 조건 보통'
                  : '매수 신호 약함 - 신중한 진입 권장'
              }
            ]
          },
          {
            day: '2~3일차',
            title: '추세 확인',
            scenarios: [
              {
                type: 'bullish' as const,
                condition: `상승 시 (${targetPrice1.toLocaleString()}원 돌파)`,
                action: `추가 30% 매수`,
                reason: '추세 강화 확인, 목표가 달성 가능성 증가'
              },
              {
                type: 'sideways' as const,
                condition: `횡보 시 (${sidewaysRange.low.toLocaleString()}~${sidewaysRange.high.toLocaleString()}원)`,
                action: `관망 유지`,
                reason: '방향성 불명확, 돌파/이탈 대기. 3일 이상 횡보 시 청산 검토'
              },
              {
                type: 'bearish' as const,
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
                type: 'target' as const,
                condition: `목표 달성 (${targetPrice2.toLocaleString()}원 이상)`,
                action: `분할 익절 (50%→30%→20%)`,
                reason: `목표가 달성 (${((targetPrice2 - currentPrice) / currentPrice * 100).toFixed(1)}% 상승)`
              },
              {
                type: 'hold' as const,
                condition: `횡보 지속 (${sidewaysRange.low.toLocaleString()}~${targetPrice1.toLocaleString()}원)`,
                action: `7일차 전량 청산`,
                reason: '기회비용 고려, 다음 종목 탐색'
              },
              {
                type: 'stop' as const,
                condition: `손절가 도달 (${stopLoss.toLocaleString()}원 하회)`,
                action: `즉시 전량 청산`,
                reason: '손실 확정 -3%, 재진입 타이밍 재분석'
              }
            ]
          }
        ]
      }
    } else if (investmentPeriod === 'medium') {
      // 2~4주 중기 전략 (AI 리포트 기반)
      const aiStrategyData = aiReport?.metadata?.strategy
      
      // AI 전략이 있으면 사용, 없으면 기본값
      if (aiStrategyData?.phase1 && aiStrategyData?.phase2 && aiStrategyData?.phase3) {
        const phase1 = aiStrategyData.phase1
        const phase2 = aiStrategyData.phase2
        const phase3 = aiStrategyData.phase3
        
        return {
          title: '2~4주 중기 전략',
          steps: [
            {
              day: '1주차',
              title: `초기 진입 (${phase1.entryRatio}%)`,
              scenarios: [
                {
                  type: 'entry' as const,
                  condition: '진입 시점',
                  action: `${phase1.entryTiming ? phase1.entryTiming + '\n' : ''}→ 총 자산의 ${phase1.entryRatio}% 진입 (예: 100만원 기준 → ${(1000000 * phase1.entryRatio / 100).toLocaleString()}원, 1000만원 기준 → ${(10000000 * phase1.entryRatio / 100).toLocaleString()}원)`,
                  reason: (() => {
                    // 근거를 줄바꿈으로 구분
                    let formattedReasoning = phase1.reasoning
                      .replace(/(\d+\))\s+/g, '\n$1 ')
                      .replace(/^\n+/, '')
                      .trim()
                    
                    // 손절 정보 추가
                    if (phase1.stopLoss) {
                      let stopLossReason = phase1.stopLoss.reason || ''
                      if (stopLossReason) {
                        stopLossReason = stopLossReason
                          .replace(/(\d+\))\s+/g, '\n$1 ')
                          .replace(/^\n+/, '')
                          .trim()
                      }
                      
                      formattedReasoning += `\n\n🛡️ 손절가: ${phase1.stopLoss.price?.toLocaleString()}원 (${phase1.stopLoss.percent}%)`
                      if (phase1.stopLoss.timing) {
                        formattedReasoning += `\n손절 타이밍: ${phase1.stopLoss.timing}`
                      }
                      if (stopLossReason) {
                        formattedReasoning += `\n손절 사유:\n${stopLossReason}`
                      }
                    }
                    
                    return formattedReasoning
                  })()
                }
              ]
            },
            {
              day: '2~3주차',
              title: '상황별 대응',
              scenarios: [
                ...(phase2.bullish ? [{
                  type: 'bullish' as const,
                  condition: phase2.bullish.condition,
                  action: (() => {
                    const action = phase2.bullish.action || `시드의 ${phase2.bullish.actionRatio}% 추가 진입`
                    if (phase2.bullish.condition.includes('원') && action.includes('→')) {
                      return action.split('→').pop()?.trim() || action
                    }
                    return action
                  })(),
                  reason: (phase2.bullish.reason || '')
                    .replace(/(\d+\))\s+/g, '\n$1 ')
                    .replace(/(\d+\))([^\d\n])/g, '\n$1 $2')
                    .replace(/^\n+/, '')
                    .trim()
                }] : []),
                ...(phase2.sideways ? [{
                  type: 'sideways' as const,
                  condition: phase2.sideways.condition,
                  action: (() => {
                    const action = phase2.sideways.action
                    if (phase2.sideways.condition.includes('원') && action.includes('→')) {
                      return action.split('→').pop()?.trim() || action
                    }
                    return action
                  })(),
                  reason: (phase2.sideways.reason || '')
                    .replace(/(\d+\))\s+/g, '\n$1 ')
                    .replace(/(\d+\))([^\d\n])/g, '\n$1 $2')
                    .replace(/^\n+/, '')
                    .trim()
                }] : []),
                ...(phase2.bearish ? [{
                  type: 'bearish' as const,
                  condition: phase2.bearish.condition,
                  action: (() => {
                    const action = phase2.bearish.action || `포지션의 ${phase2.bearish.exitRatio}% 청산`
                    if (phase2.bearish.condition.includes('원') && action.includes('→')) {
                      return action.split('→').pop()?.trim() || action
                    }
                    return action
                  })(),
                  reason: (phase2.bearish.reason || '')
                    .replace(/(\d+\))\s+/g, '\n$1 ')
                    .replace(/(\d+\))([^\d\n])/g, '\n$1 $2')
                    .replace(/^\n+/, '')
                    .trim()
                }] : [])
              ]
            },
            {
              day: '4주차',
              title: '수익 실현',
              scenarios: [
                ...(phase3.target1 ? [{
                  type: 'target' as const,
                  condition: `1차 목표 달성 (${phase3.target1.price})`,
                  action: (() => {
                    const action = phase3.target1.action || `포지션의 ${phase3.target1.exitRatio}% 익절`
                    if (action.includes('→') && action.includes('원 달성 시')) {
                      return action.split('→').pop()?.trim() || action
                    }
                    return action
                  })(),
                  reason: (phase3.target1.reason || '')
                    .replace(/(\d+\))\s+/g, '\n$1 ')
                    .replace(/(\d+\))([^\d\n])/g, '\n$1 $2')
                    .replace(/^\n+/, '')
                    .trim()
                }] : []),
                ...(phase3.target2 ? [{
                  type: 'target' as const,
                  condition: `2차 목표 달성 (${phase3.target2.price})`,
                  action: (() => {
                    const action = phase3.target2.action || `포지션의 ${phase3.target2.exitRatio}% 익절`
                    if (action.includes('→') && action.includes('원 달성 시')) {
                      return action.split('→').pop()?.trim() || action
                    }
                    return action
                  })(),
                  reason: (phase3.target2.reason || '')
                    .replace(/(\d+\))\s+/g, '\n$1 ')
                    .replace(/(\d+\))([^\d\n])/g, '\n$1 $2')
                    .replace(/^\n+/, '')
                    .trim()
                }] : []),
                ...(phase3.additional ? [{
                  type: 'hold' as const,
                  condition: '추가 전략',
                  action: phase3.additional,
                  reason: 'AI 맞춤 전략'
                }] : [])
              ]
            }
          ]
        }
      }
      
      // Fallback: AI 전략이 없을 때 (설정 파일 사용, 백엔드와 일치)
      const fallbackTargets = getFallbackTargets('medium', currentPrice)
      const targetPrice1 = aiStrategy?.target1 || fallbackTargets.target1
      const targetPrice2 = aiStrategy?.target2 || fallbackTargets.target2
      const stopLoss = fallbackTargets.stopLoss
      const sidewaysRange = { low: currentPrice * 0.97, high: currentPrice * 1.03 }
      
      return {
        title: '2~4주 중기 전략',
        steps: [
          {
            day: '1주차',
            title: '초기 진입 (40%)',
            scenarios: [
              {
                type: 'entry' as const,
                condition: '진입 시점',
                action: `현재가 ${currentPrice.toLocaleString()}원 부근 40% 진입`,
                reason: bullishStrength >= 100
                  ? '전 지표 매수 신호 - 중기 상승 추세 예상'
                  : bullishStrength >= 80
                  ? '대부분 지표 매수 신호 - 분할 진입 시작'
                  : bullishStrength >= 60
                  ? '지표 혼조세 - 신중한 진입 권장'
                  : '매수 신호 약함 - 추세 전환 대기'
              }
            ]
          },
          {
            day: '2~3주차',
            title: '추가 진입 및 모니터링',
            scenarios: [
              {
                type: 'bullish' as const,
                condition: `상승 시 (${targetPrice1.toLocaleString()}원 돌파)`,
                action: `추가 40% 매수`,
                reason: '추세 강화, 5일/20일 이평선 정배열 확인'
              },
              {
                type: 'sideways' as const,
                condition: `횡보 시 (${sidewaysRange.low.toLocaleString()}~${sidewaysRange.high.toLocaleString()}원)`,
                action: `추가 매수 보류`,
                reason: '방향성 불명확, 2주 이상 횡보 시 일부 청산 검토'
              },
              {
                type: 'bearish' as const,
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
                type: 'target' as const,
                condition: `목표 달성 (${targetPrice2.toLocaleString()}원 이상)`,
                action: `분할 익절 (60%→30%→10%)`,
                reason: `목표가 달성 (${((targetPrice2 - currentPrice) / currentPrice * 100).toFixed(1)}% 상승)`
              },
              {
                type: 'hold' as const,
                condition: `추세 유지 (${targetPrice1.toLocaleString()}원 이상)`,
                action: `홀딩 또는 부분 익절`,
                reason: '중기 추세 지속, 목표가 재상향 검토'
              },
              {
                type: 'stop' as const,
                condition: `손절가 도달 (${stopLoss.toLocaleString()}원 하회)`,
                action: `전량 청산`,
                reason: '손실 확정 -8%, 재진입 전략 수립'
              }
            ]
          }
        ]
      }
    } else if (investmentPeriod === 'long') {
      // 1~3개월 장기 전략 (AI 리포트 기반)
      const aiStrategyData = aiReport?.metadata?.strategy
      
      // 디버깅: AI 전략 데이터 확인
      if (!aiStrategyData) {
        console.warn('⚠️ 장기 전략: AI 전략 데이터 없음 - Fallback 사용', {
          hasAiReport: !!aiReport,
          hasMetadata: !!aiReport?.metadata,
          metadataKeys: aiReport?.metadata ? Object.keys(aiReport.metadata) : []
        })
      } else if (!aiStrategyData.phase1 || !aiStrategyData.phase2 || !aiStrategyData.phase3) {
        console.warn('⚠️ 장기 전략: AI 전략 데이터 불완전 - Fallback 사용', {
          phase1: !!aiStrategyData.phase1,
          phase2: !!aiStrategyData.phase2,
          phase3: !!aiStrategyData.phase3
        })
      }
      
      // AI 전략이 있으면 사용
      if (aiStrategyData?.phase1 && aiStrategyData?.phase2 && aiStrategyData?.phase3) {
        const phase1 = aiStrategyData.phase1
        const phase2 = aiStrategyData.phase2
        const phase3 = aiStrategyData.phase3
        
        return {
          title: '1~3개월 장기 전략',
          steps: [
            {
              day: '1개월차',
              title: `초기 진입 (${phase1.entryRatio}%)`,
              scenarios: [
                {
                  type: 'entry' as const,
                  condition: '진입 시점',
                  action: (() => {
                    let entryTiming = phase1.entryTiming || '';
                    if (entryTiming.includes('근거:')) {
                      entryTiming = entryTiming.split('근거:')[0].trim();
                    }
                    if (entryTiming) {
                      if (entryTiming.includes('→') && (entryTiming.includes('%') || entryTiming.includes('자산의'))) {
                        return entryTiming
                      }
                      if (entryTiming.includes('→')) {
                        return `${entryTiming}\n→ 총 자산의 ${phase1.entryRatio}% 진입 (예: 100만원 기준 → ${(1000000 * phase1.entryRatio / 100).toLocaleString()}원, 1000만원 기준 → ${(10000000 * phase1.entryRatio / 100).toLocaleString()}원)`
                      }
                      return `${entryTiming}\n→ 총 자산의 ${phase1.entryRatio}% 진입 (예: 100만원 기준 → ${(1000000 * phase1.entryRatio / 100).toLocaleString()}원, 1000만원 기준 → ${(10000000 * phase1.entryRatio / 100).toLocaleString()}원)`
                    }
                    return `→ 총 자산의 ${phase1.entryRatio}% 진입 (예: 100만원 기준 → ${(1000000 * phase1.entryRatio / 100).toLocaleString()}원, 1000만원 기준 → ${(10000000 * phase1.entryRatio / 100).toLocaleString()}원)`
                  })(),
                  reason: (() => {
                    let formattedReasoning = (phase1.reasoning || '')
                      .replace(/(\d+\))\s+/g, '\n$1 ')
                      .replace(/(\d+\))([^\d\n])/g, '\n$1 $2')
                      .replace(/^\n+/, '')
                      .trim()
                    
                    if (phase1.stopLoss) {
                      let stopLossReason = (phase1.stopLoss.reason || '')
                        .replace(/(\d+\))\s+/g, '\n$1 ')
                        .replace(/(\d+\))([^\d\n])/g, '\n$1 $2')
                        .replace(/^\n+/, '')
                        .trim()
                      
                      formattedReasoning += `\n\n🛡️ 손절가: ${phase1.stopLoss.price?.toLocaleString()}원 (${phase1.stopLoss.percent}%)`
                      if (phase1.stopLoss.timing) {
                        formattedReasoning += `\n손절 타이밍: ${phase1.stopLoss.timing}`
                      }
                      if (stopLossReason) {
                        formattedReasoning += `\n손절 사유:\n${stopLossReason}`
                      }
                    }
                    
                    return formattedReasoning
                  })()
                }
              ]
            },
            {
              day: '2개월차',
              title: '상황별 대응',
              scenarios: [
                ...(phase2.bullish ? [{
                  type: 'bullish' as const,
                  condition: phase2.bullish.condition,
                  action: (() => {
                    let action = phase2.bullish.action || `시드의 ${phase2.bullish.actionRatio}% 추가`
                    if (phase2.bullish.condition.includes('원') && action.includes('→')) {
                      return action.split('→').pop()?.trim() || action
                    }
                    return action
                  })(),
                  reason: (phase2.bullish.reason || '')
                    .replace(/(\d+\))\s+/g, '\n$1 ')
                    .replace(/(\d+\))([^\d\n])/g, '\n$1 $2')
                    .replace(/^\n+/, '')
                    .trim()
                }] : []),
                ...(phase2.sideways ? [{
                  type: 'sideways' as const,
                  condition: phase2.sideways.condition,
                  action: (() => {
                    let action = phase2.sideways.action
                    if (phase2.sideways.condition.includes('원') && action.includes('→')) {
                      return action.split('→').pop()?.trim() || action
                    }
                    return action
                  })(),
                  reason: (phase2.sideways.reason || '')
                    .replace(/(\d+\))\s+/g, '\n$1 ')
                    .replace(/(\d+\))([^\d\n])/g, '\n$1 $2')
                    .replace(/^\n+/, '')
                    .trim()
                }] : []),
                ...(phase2.bearish ? [{
                  type: 'bearish' as const,
                  condition: phase2.bearish.condition,
                  action: (() => {
                    const action = phase2.bearish.action || `${phase2.bearish.exitRatio}% 청산`
                    if (phase2.bearish.condition.includes('원') && action.includes('→')) {
                      return action.split('→').pop()?.trim() || action
                    }
                    return action
                  })(),
                  reason: (phase2.bearish.reason || '')
                    .replace(/(\d+\))\s+/g, '\n$1 ')
                    .replace(/(\d+\))([^\d\n])/g, '\n$1 $2')
                    .replace(/^\n+/, '')
                    .trim()
                }] : [])
              ]
            },
            {
              day: '3개월차',
              title: '수익 실현',
              scenarios: [
                ...(phase3.target1 ? [{
                  type: 'target' as const,
                  condition: `목표 달성 (${phase3.target1.price})`,
                  action: (() => {
                    let action = phase3.target1.action || `${phase3.target1.exitRatio}% 익절`
                    if (action.includes('→')) {
                      action = action.split('→').slice(1).join('→').trim()
                    }
                    action = action.replace(/[\d,]+원\s*(?:달성\s*시|돌파|하회)?\s*→?\s*/g, '').trim()
                    return action || `${phase3.target1.exitRatio}% 익절`
                  })(),
                  reason: (phase3.target1.reason || '')
                    .replace(/(\d+\))\s+/g, '\n$1 ')
                    .replace(/(\d+\))([^\d\n])/g, '\n$1 $2')
                    .replace(/^\n+/, '')
                    .trim()
                }] : []),
                ...(phase3.target2 ? [{
                  type: 'target' as const,
                  condition: `목표 달성 (${phase3.target2.price})`,
                  action: (() => {
                    let action = phase3.target2.action || `${phase3.target2.exitRatio}% 익절`
                    if (action.includes('→')) {
                      action = action.split('→').slice(1).join('→').trim()
                    }
                    action = action.replace(/[\d,]+원\s*(?:달성\s*시|돌파|하회)?\s*→?\s*/g, '').trim()
                    return action || `${phase3.target2.exitRatio}% 익절`
                  })(),
                  reason: (phase3.target2.reason || '')
                    .replace(/(\d+\))\s+/g, '\n$1 ')
                    .replace(/(\d+\))([^\d\n])/g, '\n$1 $2')
                    .replace(/^\n+/, '')
                    .trim()
                }] : [])
              ]
            }
          ]
        }
      }
      
      // Fallback: AI 전략이 없을 때
      const targetPrice1 = currentPrice * 0.95
      const targetPrice2 = aiStrategy?.target2 || currentPrice * 1.20
      const stopLoss = aiStrategy?.stopLoss || currentPrice * 0.85
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
                type: 'sideways' as const,
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
                type: 'bullish' as const,
                condition: `20일선 돌파 (${ma20.toLocaleString()}원 이상)`,
                action: `추세 확인, 홀딩 유지`,
                reason: '중장기 상승 전환, 목표가 상향 조정'
              },
              {
                type: 'sideways' as const,
                condition: `박스권 횡보 (${(currentPrice * 0.95).toLocaleString()}~${(currentPrice * 1.05).toLocaleString()}원)`,
                action: `관망 유지`,
                reason: '기업 실적/뉴스 모니터링, 돌파 대기'
              },
              {
                type: 'bearish' as const,
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
                type: 'target' as const,
                condition: `목표 달성 (${targetPrice2.toLocaleString()}원, +${((targetPrice2 - currentPrice) / currentPrice * 100).toFixed(0)}%)`,
                action: `단계적 청산 (50%→30%→20%)`,
                reason: '장기 목표 달성, 수익 확정'
              },
              {
                type: 'hold' as const,
                condition: `목표 미달 (+5~10%)`,
                action: `추가 1개월 홀딩 검토`,
                reason: '장기 추세 유지, 목표가 재설정'
              },
              {
                type: 'stop' as const,
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

  // AI 리포트 파싱 함수
  const parseAiReport = (report: any) => {
    if (!report?.content) {
      devLog('❌ parseAiReport: report.content 없음', report)
      return null
    }

    const content = report.content
    devLog('🔍 parseAiReport: content 길이', content.length)
    
    // 권장 포지션 파싱
    const actionMatch = content.match(/권장 포지션:\s*\[?([^\]\n]+)\]?/)
    const action = actionMatch ? actionMatch[1].trim() : null
    devLog('🔍 parseAiReport: action =', action, actionMatch ? '✅' : '❌')
    
    // 상승 확률 파싱
    const probabilityMatch = content.match(/상승 확률:\s*(\d+)%/)
    const probability = probabilityMatch ? parseInt(probabilityMatch[1]) : null
    devLog('🔍 parseAiReport: probability =', probability, probabilityMatch ? '✅' : '❌')
    
    // 리스크 레벨 파싱
    const riskMatch = content.match(/리스크\s*(?:레벨|요인)?:\s*(낮음|중간|높음)/)
    const risk = riskMatch ? riskMatch[1] : null
    devLog('🔍 parseAiReport: risk =', risk, riskMatch ? '✅' : '❌')
    
    // 근거 파싱
    const reasonMatch = content.match(/\(근거:\s*([^)]+)\)/)
    const reasonText = reasonMatch ? reasonMatch[1] : ''
    const reasons = reasonText.split('+').map((r: string) => r.trim()).filter((r: string) => r)
    devLog('🔍 parseAiReport: reasons =', reasons)
    
    const result = {
      action,
      probability,
      risk,
      reasons
    }
    devLog('✅ parseAiReport 최종 결과:', result)
    
    return result
  }

  // AI 결론 요약 계산 (AI 리포트 우선)
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
        reasons: [],
        source: 'fallback'
      }
    }

    // 🆕 AI 리포트가 있으면 우선 사용
    const parsedAi = parseAiReport(aiReport)
    
    // AI 리포트 없으면 분석 필요 메시지
    if (!aiReport) {
      return {
        action: 'AI 분석 필요',
        actionColor: '#8b95a5',
        shortTerm: 'AI 분석을 생성해주세요',
        risk: '알 수 없음',
        riskLevel: 'medium',
        recommendation: ' "AI 분석" 버튼을 클릭하여 분석을 생성하세요',
        period: '분석 필요',
        reasons: [],
        source: 'no-ai-report'
      }
    }
    
    if (parsedAi && parsedAi.action && parsedAi.probability !== null) {
      devLog('✅ AI 리포트 사용:', parsedAi)
      
      const { action: aiAction, probability, risk: aiRisk, reasons: aiReasons } = parsedAi
      
      // AI 액션을 기반으로 색상 및 세부 정보 결정
      let actionColor = '#CFCFCF'
      let shortTerm = ''
      let recommendation = ''
      let riskLevel = 'medium'
      let period = investmentPeriod === 'swing' ? '단기 스윙 (3~7일)' : 
                   investmentPeriod === 'medium' ? '중기 (2~4주)' : '장기 (1~3개월)'
      
      // 리스크 레벨 매핑
      if (aiRisk === '낮음') {
        riskLevel = 'low'
      } else if (aiRisk === '높음') {
        riskLevel = 'high'
      } else {
        riskLevel = 'medium'
      }
      
      // AI 리포트에서 동적 목표 수익률 가져오기
      const targetPercent1 = aiReport?.metadata?.targetPercent1
      const targetPercent2 = aiReport?.metadata?.targetPercent2
      const hasTargets = targetPercent1 && targetPercent2
      
      // 액션별 설정
      if (aiAction.includes('강력 매수')) {
        actionColor = '#00E5A8'
        shortTerm = `상승 가능성 ${probability}%`
        
        if (investmentPeriod === 'swing') {
          recommendation = hasTargets 
            ? `${period} 기간 내 1일차 진입 전략 고려 (목표: +${targetPercent1}%)`
            : `${period} 기간 내 1일차 진입 전략 고려 (현재가 ${candles[0].close.toLocaleString()}원)`
        } else if (investmentPeriod === 'medium') {
          recommendation = hasTargets
            ? `이번 주 내 첫 진입 후 2~3주차 추가 매수 (목표: +${targetPercent1}%)`
            : `이번 주 내 첫 진입 후 2~3주차 추가 매수`
        } else {
          recommendation = hasTargets
            ? `1개월간 3~4회 분할 매수로 평균 단가 낮추기 (목표: +${targetPercent1}%)`
            : `1개월간 3~4회 분할 매수로 평균 단가 낮추기`
        }
      } else if (aiAction.includes('매수')) {
        actionColor = '#00D1FF'
        shortTerm = `상승 가능성 ${probability}%`
        
        if (investmentPeriod === 'swing') {
          recommendation = hasTargets
            ? `${period} 기간 내 소량 진입 후 추세 확인 (목표: +${targetPercent1}%)`
            : `${period} 기간 내 소량 진입 후 추세 확인`
        } else if (investmentPeriod === 'medium') {
          recommendation = hasTargets
            ? `1주차 소량 진입 후 2주차 추가 검토 (목표: +${targetPercent1}%)`
            : `1주차 소량 진입 후 2주차 추가 검토`
        } else {
          recommendation = hasTargets
            ? `첫 달 저점 매수 기회 포착, 2개월차 추세 확인 (목표: +${targetPercent1}%)`
            : `첫 달 저점 매수 기회 포착, 2개월차 추세 확인`
        }
      } else if (aiAction.includes('관망')) {
        actionColor = '#CFCFCF'
        shortTerm = `방향성 불명확 (상승 ${probability}%)`
        recommendation = investmentPeriod === 'swing'
          ? `${period} 내 명확한 추세 확인 후 진입`
          : investmentPeriod === 'medium'
          ? '1주일 추세 확인 후 재평가'
          : '월간 추세 전환 시점 대기'
      } else if (aiAction.includes('주의')) {
        actionColor = '#FFA500'
        shortTerm = `하락 가능성 ${100 - probability}%`
        recommendation = '신규 진입 자제, 시장 상황 모니터링'
        period = investmentPeriod === 'swing' ? '단기 조정 예상' : '중기 조정 예상'
      } else if (aiAction.includes('매도')) {
        actionColor = '#FF4D4D'
        shortTerm = `하락 추세 (상승 ${probability}%)`
        recommendation = '보유 시 청산 검토 권장'
        riskLevel = 'very-high'
        period = '청산 검토 필요'
      }
      
      return {
        action: aiAction,
        actionColor,
        shortTerm,
        risk: aiRisk || '중간',
        riskLevel,
        recommendation,
        period,
        reasons: aiReasons.slice(0, 4),
        source: 'ai',
        probability
      }
    }
    
    // 🔄 AI 리포트 없으면 Fallback: 지표 기반 계산
    devLog('⚠️ AI 리포트 없음, 지표 기반 계산 사용')
    
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
    
    // 투자 기간별 기본 임계값
    const baseThresholds = investmentPeriod === 'swing' 
      ? { strong: 70, buy: 55, neutral: 45, caution: 30 }
      : investmentPeriod === 'medium'
      ? { strong: 65, buy: 50, neutral: 40, caution: 25 }
      : { strong: 60, buy: 45, neutral: 35, caution: 20 }
    
    // 변동성 기반 동적 임계값 조정
    const volatility = strength.volatility
    const volatilityAdjustment = volatility === '높음' ? 5 : volatility === '낮음' ? -5 : 0
    
    // 신호 일치도 기반 조정
    const signalAgreement = regime.bullishPercentage || 50
    const signalAdjustment = signalAgreement < 40 || signalAgreement > 60 ? 0 : 3
    
    // 최종 임계값 계산
    const thresholds = {
      strong: Math.min(90, baseThresholds.strong + volatilityAdjustment + signalAdjustment),
      buy: Math.min(85, baseThresholds.buy + volatilityAdjustment + signalAdjustment),
      neutral: baseThresholds.neutral + Math.floor(signalAdjustment / 2),
      caution: baseThresholds.caution
    }
    
    if (totalScore >= thresholds.strong) {
      action = '강력 매수'
      actionColor = '#00E5A8'
      shortTerm = '상승 가능성 높음'
      
      if (investmentPeriod === 'swing') {
        recommendation = `${period} 기간 내 1일차 진입 전략 고려 (현재가 ${candles[0].close.toLocaleString()}원)`
      } else if (investmentPeriod === 'medium') {
        recommendation = `이번 주 내 첫 진입 후 2~3주차 추가 매수 (예상 목표: +10% 내외)`
      } else {
        recommendation = `1개월간 3~4회 분할 매수로 평균 단가 낮추기 (예상 목표: +20% 내외)`
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
        recommendation = `1주차 소량 진입 후 2주차 추가 검토 (예상 목표: +7% 내외)`
      } else {
        recommendation = `첫 달 저점 매수 기회 포착, 2개월차 추세 확인 (예상 목표: +15% 내외)`
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
      reasons: reasons.slice(0, 4),
      source: 'calculated',
      totalScore
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
  
  // 당일 변화율 계산 (시가 대비)
  const priceChange = (() => {
    // 1순위: symbol 데이터의 공식 변화율
    if (symbol?.priceChangePercent !== undefined) {
      return symbol.priceChangePercent
    }
    
    // 2순위: 당일 시가 대비 계산
    if (latestCandle && symbol?.dayOpen) {
      return ((latestCandle.close - symbol.dayOpen) / symbol.dayOpen * 100)
    }
    
    // 3순위: 최신 캔들의 시가 대비
    if (latestCandle) {
      return ((latestCandle.close - latestCandle.open) / latestCandle.open * 100)
    }
    
    return 0
  })()

  // ===== 차트 시각적 신호 계산 =====

  // 1. 상한가/하한가 계산
  const calculatePriceLimits = () => {
    if (!symbol && !latestCandle) return null
    
    const previousClose = symbol?.previousClose || latestCandle?.open || 0
    if (previousClose === 0) return null
    
    // KOSDAQ: ±30%, KOSPI: ±15%
    const isKosdaq = symbol?.market === 'KOSDAQ'
    const limitPercent = isKosdaq ? 0.30 : 0.15
    
    return {
      upper: previousClose * (1 + limitPercent),
      lower: previousClose * (1 - limitPercent),
      previousClose,
      market: isKosdaq ? 'KOSDAQ' : 'KOSPI'
    }
  }

  // 2. 골든크로스/데드크로스 감지
  const detectMACrossover = () => {
    if (!candles || candles.length < 2) return []
    
    const signals: Array<{type: 'golden' | 'dead', timestamp: string, price: number, index: number}> = []
    
    // 최근 20개 캔들만 체크 (너무 많으면 차트가 복잡)
    const recentCandles = candles.slice(0, Math.min(20, candles.length))
    
    for (let i = 1; i < recentCandles.length; i++) {
      const current = recentCandles[i - 1]  // 최신
      const previous = recentCandles[i]      // 이전
      
      if (!current.ma5 || !current.ma20 || !previous.ma5 || !previous.ma20) continue
      
      // 골든크로스: MA5가 MA20을 하향→상향 돌파
      if (previous.ma5 <= previous.ma20 && current.ma5 > current.ma20) {
        signals.push({
          type: 'golden',
          timestamp: current.timestamp,
          price: current.close,
          index: i - 1
        })
      }
      
      // 데드크로스: MA5가 MA20을 상향→하향 돌파
      if (previous.ma5 >= previous.ma20 && current.ma5 < current.ma20) {
        signals.push({
          type: 'dead',
          timestamp: current.timestamp,
          price: current.close,
          index: i - 1
        })
      }
    }
    
    return signals
  }

  // 3. AI 매수/매도 신호 추출
  const getAISignal = () => {
    if (!aiConclusion || !latestCandle) return null
    
    const action = aiConclusion.action
    const currentPrice = latestCandle.close
    
    if (action === '강력 매수' || action === '매수') {
      return {
        type: 'buy' as const,
        strength: action === '강력 매수' ? 'strong' : 'normal',
        price: currentPrice,
        timestamp: new Date().toISOString()
      }
    } else if (action === '매도' || action === '주의') {
      return {
        type: 'sell' as const,
        strength: action === '매도' ? 'strong' : 'caution',
        price: currentPrice,
        timestamp: new Date().toISOString()
      }
    }
    
    return null
  }

  const priceLimits = calculatePriceLimits()
  const maCrossovers = detectMACrossover()
  const aiSignal = getAISignal()

  // 디버그 정보 (개발 모드에서만)
  if (isDev) {
    devLog('📊 차트 시각적 신호 디버그:')
    devLog('- 상한가/하한가:', priceLimits)
    devLog('- 골든/데드크로스:', maCrossovers)
    devLog('- AI 신호:', aiSignal)
    devLog('- AI Conclusion:', aiConclusion)
    devLog('💰 가격 데이터 확인:')
    devLog('- symbol 데이터:', {
      currentPrice: symbol?.currentPrice,
      dayOpen: symbol?.dayOpen,
      priceChangePercent: symbol?.priceChangePercent,
      previousClose: symbol?.previousClose
    })
    devLog('- latestCandle:', latestCandle ? {
      open: latestCandle.open,
      close: latestCandle.close,
      timestamp: latestCandle.timestamp
    } : null)
    devLog('- 계산된 priceChange:', priceChange.toFixed(2) + '%')
  }

  return (
    <DashboardLayout>
      {/* AI 분석 생성 중 오버레이 */}
      {generatingReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-dark-100 to-dark-200 p-8 rounded-xl shadow-2xl border border-primary-500/30 flex flex-col items-center max-w-lg mx-4">
            <div className="relative mb-6">
              <div className="animate-spin w-20 h-20 border-4 border-primary-500 border-t-transparent rounded-full"></div>
              <Sparkles className="w-10 h-10 text-primary-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            
            <h3 className="text-white font-bold text-2xl mb-3">GPT-4o-mini 분석 중</h3>
            <p className="text-gray-300 text-center mb-4">
              {symbol?.name || '종목'}의 실시간 데이터를 AI가 분석하고 있습니다
            </p>

            {/* 분석 단계 */}
            <div className="w-full space-y-2.5 mb-5">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-5 h-5 rounded-full bg-[#00E5A8] flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-300">기술적 지표 수집 완료</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-5 h-5 rounded-full bg-[#00E5A8] flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-300">패턴 분석 중...</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-5 h-5 rounded-full border-2 border-gray-600 animate-pulse flex-shrink-0"></div>
                <span className="text-gray-500">GPT-4 응답 대기 중...</span>
              </div>
            </div>

            <div className="text-xs text-gray-400 bg-black/30 rounded-lg px-4 py-2 mb-4">
              <p className="mb-1">🔹 사용 모델: GPT-4o-mini (gpt-4o-mini-2024-07-18)</p>
              <p>🔹 예상 소요 시간: 3~5초</p>
            </div>

            <div className="flex gap-2">
              <div className="w-2.5 h-2.5 bg-[#00E5A8] rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-2.5 h-2.5 bg-[#00D1FF] rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
              <div className="w-2.5 h-2.5 bg-[#FFB800] rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3 sm:space-y-4">

        {/* 데이터 유효성 경고 메시지 */}
        {!dataValidation.isValid && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🚨</span>
              <div className="flex-1">
                <h3 className="text-red-400 font-bold mb-2">데이터 오류 감지</h3>
                <ul className="list-disc pl-5 text-red-300 text-sm space-y-1">
                  {dataValidation.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
                <p className="mt-3 text-red-400 text-sm">
                  분석 결과를 신뢰하지 마세요. 관리자에게 문의하세요.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 최소 데이터 부족 경고 */}
        {!minimumData.isValid && (
          <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <h3 className="text-yellow-400 font-bold mb-2">데이터 부족</h3>
                <p className="text-yellow-300 text-sm">
                  정확한 분석을 위해 최소 {minimumData.minRequired}개의 캔들 데이터가 필요합니다.
                </p>
                <p className="text-yellow-200 text-sm mt-1">
                  현재: <span className="font-bold">{minimumData.candleCount}개</span>
                  {!minimumData.hasIndicators && ' | 기술적 지표 없음'}
                </p>
                <p className="mt-2 text-yellow-400 text-xs">
                  신규 상장 종목이거나 데이터 수집 중일 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 장 상태 표시 */}
        {dataFreshness.marketStatus && !dataFreshness.marketStatus.isOpen && (
          <div className="bg-[rgba(100,100,255,0.1)] border border-[rgba(100,100,255,0.3)] rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{dataFreshness.marketStatus.icon}</span>
                <div>
                  <p className="text-blue-300 text-sm font-semibold">
                    {dataFreshness.marketStatus.status}
                  </p>
                  <p className="text-blue-400/70 text-xs">
                    {dataFreshness.marketStatus.message}
                  </p>
                </div>
              </div>
              {dataFreshness.age !== null && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">마지막 데이터</p>
                  <p className="text-sm text-gray-300 font-mono">
                    {dataFreshness.age >= 60 
                      ? `${Math.floor(dataFreshness.age / 60)}시간 ${dataFreshness.age % 60}분 전`
                      : `${dataFreshness.age}분 전`
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 장중 데이터 신선도 경고 */}
        {dataFreshness.isStale && !dataFreshness.isCritical && (
          <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <p className="text-yellow-300 text-sm">
                장중인데 데이터가 <span className="font-bold">{dataFreshness.age}분</span> 전 것입니다. 
                데이터 수집에 문제가 있을 수 있습니다.
              </p>
            </div>
          </div>
        )}

        {dataFreshness.isCritical && dataFreshness.age !== null && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🚨</span>
              <p className="text-red-300 text-sm">
                장중인데 데이터가 매우 오래되었습니다 
                (<span className="font-bold">{Math.floor(dataFreshness.age / 60)}시간 {dataFreshness.age % 60}분</span> 전).
                데이터 수집 오류를 확인하세요!
              </p>
            </div>
          </div>
        )}

        {/* 상단 헤더 - 가격 정보 (유리 패널) */}
        <div className="glass-panel rounded-lg p-3 sm:p-4 lg:p-6 relative">
          {/* 20분 지연 워터마크 */}
          
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
                  {latestCandle ? latestCandle.close.toLocaleString() : (symbol?.currentPrice ? symbol.currentPrice.toLocaleString() : '0')}
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

        {/* AI 종합 판단 - AI 리포트 있을 때만 표시 */}
        {aiReport ? (
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
                  <span className="text-[#CFCFCF]">AI 신뢰도</span>
                  {aiReport.metadata?.confidence ? (
                    <>
                      <span className="text-white font-semibold">{Math.round(aiReport.metadata.confidence * 100)}%</span>
                      <span className="text-[#CFCFCF]">
                        {aiReport.metadata.confidence >= 0.8 ? '높음' : 
                         aiReport.metadata.confidence >= 0.6 ? '보통' : '낮음'}
                      </span>
                    </>
                  ) : (
                    <span className="text-[#CFCFCF]">분석 완료</span>
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
                  {aiConclusion.reasons.map((reason: string, idx: number) => (
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
        ) : (
          /* AI 분석 필요 안내 */
          <div className="glass-panel rounded-lg p-4 sm:p-6 border-l-4 border-[#8b95a5]">
            <div className="flex flex-col items-center justify-center text-center py-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00E5A8]/20 to-[#00D1FF]/20 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#00E5A8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">AI 종합 분석 필요</h3>
              <p className="text-sm text-[#CFCFCF] mb-4 max-w-md">
                GPT-4 기반 AI 분석을 생성하면 종합 판단, 신뢰도, 투자 전략을 확인할 수 있습니다.
              </p>
              <button
                onClick={generateAiReport}
                disabled={generatingReport}
                className="px-6 py-2.5 bg-gradient-to-r from-[#00E5A8] to-[#00D1FF] hover:from-[#00cc96] hover:to-[#00b8e6] text-dark-100 font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {generatingReport ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    분석 중...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI 분석 생성
                  </>
                )}
              </button>
            </div>
          </div>
        )}

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
              {/* 차트 상단 실시간 데이터 라벨 */}
              {latestCandle && indicators && (
                <div className="mb-2 bg-gradient-to-r from-[rgba(0,229,168,0.1)] to-[rgba(0,209,255,0.1)] border border-[rgba(0,229,168,0.3)] rounded-lg p-2.5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400">현재가</span>
                      <p className={`font-bold text-sm ${priceChange >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                        {latestCandle.close.toLocaleString()}원
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-400">변화</span>
                      <p className={`font-bold text-sm ${priceChange >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                        {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                      </p>
                    </div>
                    {indicators.ma5 && (
                      <div>
                        <span className="text-gray-400">MA5</span>
                        <p className="font-bold text-sm text-[#FFB800]">
                          {indicators.ma5 > 0 ? indicators.ma5.toLocaleString() : '계산중'}
                        </p>
                      </div>
                    )}
                    {indicators.ma20 && (
                      <div>
                        <span className="text-gray-400">MA20</span>
                        <p className="font-bold text-sm text-[#00D1FF]">
                          {indicators.ma20 > 0 ? indicators.ma20.toLocaleString() : '계산중'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="h-48 sm:h-64">
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: typeof window !== 'undefined' && window.innerWidth >= 640 ? 5 : 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={trendColor} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={trendColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="index" hide />
                      <YAxis 
                        hide={typeof window !== 'undefined' && window.innerWidth < 640} 
                        domain={['dataMin - 100', 'dataMax + 100']}
                        allowDataOverflow={false}
                        orientation="left"
                        tick={{ fill: '#CFCFCF', fontSize: 11 }}
                        tickFormatter={(value) => {
                          if (value >= 1000000) {
                            return `${(value / 1000000).toFixed(1)}M`
                          } else if (value >= 1000) {
                            return `${(value / 1000).toFixed(0)}K`
                          }
                          return value.toLocaleString()
                        }}
                        width={60}
                      />
                      
                      {/* 커스텀 툴팁 */}
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload[0]) return null
                          
                          const dataIndex = payload[0].payload.index
                          const candle = candles[dataIndex]
                          
                          if (!candle) return null
                          
                          const candleChange = candles[dataIndex + 1] 
                            ? ((candle.close - candles[dataIndex + 1].close) / candles[dataIndex + 1].close * 100)
                            : 0
                          
                          return (
                            <div className="bg-[#1a1a1a]/95 border border-[#00E5A8]/50 rounded-md p-2 shadow-xl text-[10px] sm:text-xs max-w-[160px] sm:max-w-none">
                              {/* 시간 - 모바일에서는 짧게 */}
                              <p className="text-[9px] sm:text-xs text-gray-400 mb-1.5 pb-1 border-b border-gray-700/50">
                                {new Date(candle.timestamp).toLocaleString('ko-KR', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                              {/* 가격 정보 - 2열 그리드로 컴팩트하게 */}
                              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">시</span>
                                  <span className="font-semibold text-white">{(candle.open/1000).toFixed(1)}K</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">고</span>
                                  <span className="font-semibold text-[#00E5A8]">{(candle.high/1000).toFixed(1)}K</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">저</span>
                                  <span className="font-semibold text-[#FF4D4D]">{(candle.low/1000).toFixed(1)}K</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">종</span>
                                  <span className="font-semibold text-white">{(candle.close/1000).toFixed(1)}K</span>
                                </div>
                              </div>
                              {/* 변화율 */}
                              <div className="mt-1 pt-1 border-t border-gray-700/50 flex justify-between">
                                <span className="text-gray-500">변화</span>
                                <span className={`font-bold ${candleChange >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                                  {candleChange >= 0 ? '+' : ''}{candleChange.toFixed(2)}%
                                </span>
                              </div>
                            </div>
                          )
                        }}
                        cursor={{ stroke: '#00E5A8', strokeWidth: 1, strokeDasharray: '5 5' }}
                      />
                      
                      {/* 상한가/하한가 선 */}
                      {priceLimits && (
                        <>
                          <ReferenceLine 
                            y={priceLimits.upper} 
                            stroke="#FF4D4D" 
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            label={{ 
                              value: '상한가', 
                              position: 'right', 
                              fill: '#FF4D4D',
                              fontSize: 10,
                              fontWeight: 'bold'
                            }}
                          />
                          <ReferenceLine 
                            y={priceLimits.lower} 
                            stroke="#0099FF" 
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            label={{ 
                              value: '하한가', 
                              position: 'right', 
                              fill: '#0099FF',
                              fontSize: 10,
                              fontWeight: 'bold'
                            }}
                          />
                        </>
                      )}

                      {/* 골든크로스/데드크로스 표시 */}
                      {maCrossovers.map((signal, idx) => (
                        <ReferenceDot
                          key={`cross-${idx}`}
                          x={signal.index}
                          y={signal.price}
                          r={6}
                          fill={signal.type === 'golden' ? '#FFD700' : '#8B0000'}
                          stroke={signal.type === 'golden' ? '#FFA500' : '#FF4D4D'}
                          strokeWidth={2}
                          label={{
                            value: signal.type === 'golden' ? '⚡' : '⚠',
                            position: 'top',
                            fontSize: 12
                          }}
                        />
                      ))}

                      {/* AI 매수/매도 신호 (현재가 위치) */}
                      {aiSignal && latestCandle && (
                        <ReferenceDot
                          x={0}  // 최신 데이터는 index 0
                          y={aiSignal.price}
                          r={8}
                          fill={aiSignal.type === 'buy' ? '#00E5A8' : '#FF4D4D'}
                          stroke={aiSignal.type === 'buy' ? '#00FFC8' : '#FF0000'}
                          strokeWidth={3}
                          label={{
                            value: aiSignal.type === 'buy' 
                              ? (aiSignal.strength === 'strong' ? '🚀 AI 강력매수' : '📈 AI 매수') 
                              : (aiSignal.strength === 'strong' ? '📉 AI 매도' : '⚠️ AI 주의'),
                            position: 'top',
                            fill: aiSignal.type === 'buy' ? '#00E5A8' : '#FF4D4D',
                            fontSize: 11,
                            fontWeight: 'bold'
                          }}
                        />
                      )}

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
              
              {/* 신호 범례 - 항상 표시 */}
              <div className="mt-3 bg-[rgba(255,255,255,0.03)] rounded-lg p-3 border border-[rgba(255,255,255,0.08)]">
                <h4 className="text-xs font-semibold text-white mb-2.5">차트 신호 범례</h4>
                <div className="flex flex-wrap gap-3 text-xs">
                  {/* 상한가/하한가 */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 bg-[#FF4D4D]" style={{backgroundImage: 'repeating-linear-gradient(to right, #FF4D4D 0px, #FF4D4D 5px, transparent 5px, transparent 10px)'}}></div>
                    <span className="text-[#CFCFCF]">
                      상한가 {priceLimits ? `(${priceLimits.upper.toLocaleString()}원)` : '(계산 중)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 bg-[#0099FF]" style={{backgroundImage: 'repeating-linear-gradient(to right, #0099FF 0px, #0099FF 5px, transparent 5px, transparent 10px)'}}></div>
                    <span className="text-[#CFCFCF]">
                      하한가 {priceLimits ? `(${priceLimits.lower.toLocaleString()}원)` : '(계산 중)'}
                    </span>
            </div>
                  
                  {/* 골든크로스/데드크로스 */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#FFD700] border-2 border-[#FFA500]"></div>
                    <span className="text-[#CFCFCF]">
                      골든크로스 {maCrossovers.length > 0 ? `(${maCrossovers.filter(s => s.type === 'golden').length}개)` : '(감지안됨)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#8B0000] border-2 border-[#FF4D4D]"></div>
                    <span className="text-[#CFCFCF]">
                      데드크로스 {maCrossovers.length > 0 ? `(${maCrossovers.filter(s => s.type === 'dead').length}개)` : '(감지안됨)'}
                    </span>
                  </div>
                  
                  {/* AI 신호 */}
                  <div className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-full ${aiSignal?.type === 'buy' ? 'bg-[#00E5A8] border-2 border-[#00FFC8]' : aiSignal?.type === 'sell' ? 'bg-[#FF4D4D] border-2 border-[#FF0000]' : 'bg-gray-600 border-2 border-gray-500'}`}></div>
                    <span className="text-[#CFCFCF]">
                      AI 신호: {aiSignal ? (
                        aiSignal.type === 'buy' 
                          ? (aiSignal.strength === 'strong' ? '강력매수' : '매수')
                          : (aiSignal.strength === 'strong' ? '매도' : '주의')
                      ) : '관망'}
                    </span>
                  </div>
                </div>
                
                {/* 추가 설명 */}
                {(!priceLimits || maCrossovers.length === 0 || !aiSignal) && (
                  <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                     일부 신호가 감지되지 않았습니다. 
                    {!priceLimits && ' 전일 종가 데이터가 필요합니다.'}
                    {maCrossovers.length === 0 && ' 최근 MA 크로스오버가 없습니다.'}
                    {!aiSignal && ' AI가 명확한 매수/매도 신호를 감지하지 못했습니다.'}
                  </p>
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

                {/* 현재 추천 전략 요약 박스 - 깔끔한 다크 디자인 */}
                <div className="bg-[#1a1f2e] rounded-xl p-5 border border-[#2a3142]">
                  {/* 헤더 */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-white">현재 추천 전략 요약</h3>
                      <p className="text-xs text-[#00E5A8]">
                        AI가 분석한 최적 투자 전략 • {investmentPeriod === 'swing' ? '단기 스윙 (일봉)' : investmentPeriod === 'medium' ? '중기 (일봉)' : '장기 (주봉)'} 기준
                      </p>
                    </div>
                    {aiReport && (
                      <div className="text-right">
                        <span className="text-xs text-gray-400">
                          {(() => {
                            const now = new Date();
                            const created = new Date(aiReport.createdAt);
                            const diffMs = now.getTime() - created.getTime();
                            const diffMins = Math.floor(diffMs / (1000 * 60));
                            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                            
                            if (diffMins < 1) return '방금 전 분석';
                            if (diffMins < 60) return `${diffMins}분 전 분석`;
                            return `${diffHours}시간 전 분석`;
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* 전략 & 위험도 카드 */}
                  <div className="space-y-3 mb-4">
                    {/* 전략 */}
                    <div className="bg-[#141821] rounded-lg p-4 border border-[#2a3142]">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00E5A8]"></div>
                        <p className="text-xs text-[#8b95a5]">전략</p>
                      </div>
                      <p className="text-lg font-bold text-white mb-1.5">{aiConclusion.action}</p>
                      <p className="text-xs text-[#00E5A8]">
                        {aiConclusion.reasons.slice(0, 2).join(' • ')}
                      </p>
                    </div>
                    
                    {/* 위험도 */}
                    <div className="bg-[#141821] rounded-lg p-4 border border-[#2a3142]">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ 
                          backgroundColor: aiConclusion.riskLevel === 'low' ? '#00E5A8' : 
                                           aiConclusion.riskLevel === 'medium' ? '#f59e0b' : '#ef4444' 
                        }}></div>
                        <p className="text-xs text-[#8b95a5]">현재 포지션 위험도</p>
                      </div>
                      <p className="text-lg font-bold mb-1" style={{ 
                        color: aiConclusion.riskLevel === 'low' ? '#00E5A8' : 
                               aiConclusion.riskLevel === 'medium' ? '#f59e0b' : '#ef4444' 
                      }}>
                        {aiConclusion.risk}
                      </p>
                      <p className="text-xs" style={{
                        color: aiConclusion.riskLevel === 'low' ? '#00E5A8' : 
                               aiConclusion.riskLevel === 'medium' ? '#f59e0b' : '#ef4444'
                      }}>
                        {aiConclusion.riskLevel === 'low' ? '✓ 안전한 진입 구간' : 
                         aiConclusion.riskLevel === 'medium' ? '⚠ 신중한 접근 필요' : 
                         '⚠ 고위험 주의'}
                      </p>
                    </div>
                  </div>

                  {/* 핵심 수치 3개 메트릭 */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {/* 신뢰도 */}
                    <div className="text-center bg-[#141821] border border-[#2a3142] rounded-lg py-4 px-2">
                      <p className="text-[10px] text-[#8b95a5] mb-1.5">신뢰도</p>
                      {confidenceMetrics.confidence !== null ? (
                        <>
                          <p className="text-xl font-bold text-[#00E5A8]">{confidenceMetrics.confidence}%</p>
                          <p className="text-[10px] text-[#8b95a5] mt-1">
                            {confidenceMetrics.confidence >= 70 ? '높음' : confidenceMetrics.confidence >= 50 ? '보통' : '낮음'}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-[#8b95a5]">-</p>
                      )}
                    </div>
                    
                    {/* 리스크 */}
                    <div className="text-center bg-[#141821] border border-[#2a3142] rounded-lg py-4 px-2">
                      <p className="text-[10px] text-[#8b95a5] mb-1.5">리스크</p>
                      <div className="flex justify-center mb-1">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{
                            backgroundColor: aiConclusion.riskLevel === 'low' ? 'rgba(0,229,168,0.15)' : 
                                             aiConclusion.riskLevel === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                            border: `2px solid ${aiConclusion.riskLevel === 'low' ? '#00E5A8' : aiConclusion.riskLevel === 'medium' ? '#f59e0b' : '#ef4444'}`
                          }}
                        >
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: aiConclusion.riskLevel === 'low' ? '#00E5A8' : 
                                               aiConclusion.riskLevel === 'medium' ? '#f59e0b' : '#ef4444'
                            }}
                          ></div>
                        </div>
                      </div>
                      <p className="text-xs font-medium" style={{
                        color: aiConclusion.riskLevel === 'low' ? '#00E5A8' : 
                               aiConclusion.riskLevel === 'medium' ? '#f59e0b' : '#ef4444'
                      }}>
                        {aiConclusion.risk}
                      </p>
                    </div>
                    
                    {/* 추세 강도 */}
                    <div className="text-center bg-[#141821] border border-[#2a3142] rounded-lg py-4 px-2">
                      <p className="text-[10px] text-[#8b95a5] mb-1.5">추세 강도</p>
                      <p className="text-xl font-bold text-[#00D1FF]">{marketStrength.score}</p>
                      <p className="text-[10px] text-[#8b95a5] mt-1">
                        {Number(marketStrength.score) >= 70 ? '강세' : Number(marketStrength.score) >= 50 ? '중립' : '약세'}
                      </p>
                    </div>
                  </div>

                  {/* 적정 행동 */}
                  <div className="bg-[#141821] border border-[#2a3142] rounded-lg p-4">
                    <p className="text-sm font-medium text-white mb-2">적정 행동</p>
                    <p className="text-sm text-[#a0aec0] mb-3">{aiConclusion.recommendation}</p>
                    <div className="pt-3 border-t border-[#2a3142]">
                      <p className="text-xs text-[#00E5A8]">
                        데이터 기반 예상 기간: <span className="font-medium">{aiConclusion.period}</span>
                      </p>
                    </div>
                  </div>

                  {/* AI 기반 스윙 전략 템플릿 */}
                  {(aiConclusion.action === '강력 매수' || aiConclusion.action === '매수' || aiConclusion.action === '관망') ? (() => {
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
                                    const scenarioStyle = scenarioIcons[scenario.type as keyof typeof scenarioIcons] || scenarioIcons['hold']
                                    
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
                                              <span className="whitespace-pre-line">{scenario.reason}</span>
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
                  })() : (
                    // 주의/매도일 때 안내 메시지
                    <div className="mt-4 pt-4 border-t border-[#2a3142]">
                      <div className="bg-[#141821] border border-[#2a3142] rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#2a3142] flex items-center justify-center">
                            <svg className="w-4 h-4 text-[#ff4d4d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#ff4d4d] mb-1">진입 전략 비권장</p>
                            <p className="text-xs text-[#8b95a5] leading-relaxed">
                              현재 AI 판단이 <span className="text-[#ff4d4d] font-medium">&ldquo;{aiConclusion.action}&rdquo;</span>이므로 
                              신규 진입을 권장하지 않습니다.
                              <br />
                              <span className="text-[#a0aec0]">보유 중이라면 청산 또는 손절 검토를 권장합니다.</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* 상세 AI 분석 리포트 */}
                <div className="glass-panel rounded-xl p-5 sm:p-6 lg:p-8">
                  <div className="flex justify-between items-center mb-3 sm:mb-4">
                    <h2 className="text-xl sm:text-2xl font-bold text-white">AI 분석 리포트</h2>
                    <div className="text-right">
                      <span className="text-sm sm:text-base text-[#CFCFCF] font-medium block">
                        {new Date(aiReport.createdAt).toLocaleString('ko-KR')}
                      </span>
                      <span className="text-xs text-gray-400 mt-1 block">
                        {(() => {
                          const now = new Date();
                          const created = new Date(aiReport.createdAt);
                          const diffMs = now.getTime() - created.getTime();
                          const diffMins = Math.floor(diffMs / (1000 * 60));
                          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                          
                          if (diffMins < 1) return '방금 전 분석';
                          if (diffMins < 60) return `${diffMins}분 전 분석`;
                          if (diffHours < 24) return `${diffHours}시간 전 분석`;
                          return `${diffDays}일 전 분석`;
                        })()}
                      </span>
                    </div>
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

                {/* AI 신뢰도 패널 */}
                <AiTrustPanel aiReport={aiReport} generatingReport={generatingReport} />

                {/* AI 히스토리 & 백테스팅 */}
                <AiHistoryPanel symbolId={Array.isArray(params.id) ? params.id[0] : params.id} />
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

            {/* 3. 기술적 분석 점수 (AI 없을 때) / AI 신뢰도 (AI 있을 때) */}
            <div className="glass-panel rounded-lg p-3 sm:p-4">
              <div className="mb-2">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  {aiReport ? 'AI 신뢰도' : '기술적 분석 점수'}
                </h3>
              </div>
              <div className="text-xs sm:text-sm text-[#CFCFCF] mb-3 font-semibold">
                {aiReport ? 'GPT-4 기반 신뢰도' : 'RSI·MACD·이평선 기반'}
              </div>

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
                    <span className="text-[#CFCFCF] font-light text-left">
                      {aiReport ? 'AI 신뢰도' : '기술 점수'}
                    </span>
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


