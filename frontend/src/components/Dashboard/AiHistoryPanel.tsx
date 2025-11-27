'use client'

import { useEffect, useState } from 'react'
import { History, TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

interface AiHistoryPanelProps {
  symbolId: string
}

export default function AiHistoryPanel({ symbolId }: AiHistoryPanelProps) {
  const [history, setHistory] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null) // null = 로딩 중
  const { token } = useAuthStore()

  useEffect(() => {
    const fetchData = async () => {
      console.log('🔐 토큰 확인:', token ? `있음 (${token.substring(0, 20)}...)` : '없음')
      setIsLoggedIn(!!token)
      
      // 토큰이 없으면 데이터를 가져오지 않음
      if (!token) {
        console.warn('⚠️ 로그인이 필요합니다. 히스토리는 로그인 후 확인 가능합니다.')
        setHistory([])
        setStats(null)
        return
      }

      try {
        // 히스토리 가져오기
        const historyRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/ai/reports/history/${symbolId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        console.log('📡 히스토리 API 응답:', historyRes.status, historyRes.statusText)
        
        if (historyRes.ok) {
          const historyData = await historyRes.json()
          console.log('📜 히스토리 데이터:', historyData)
          setHistory(historyData)
        } else if (historyRes.status === 401) {
          console.warn('⚠️ 401 인증 실패 - 토큰이 유효하지 않음')
          setIsLoggedIn(false)
          setHistory([])
        } else if (historyRes.status === 404) {
          console.warn('⚠️ 404 API 없음 - 백엔드에 엔드포인트가 없음')
          // 404면 API가 없는 것이지 로그인 문제가 아님
          setHistory([])
        } else {
          console.warn('⚠️ 기타 에러:', historyRes.status)
          setHistory([])
        }

        // 통계 가져오기
        const statsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/ai/reports/stats/${symbolId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        console.log('📡 통계 API 응답:', statsRes.status, statsRes.statusText)
        
        if (statsRes.ok) {
          const statsData = await statsRes.json()
          console.log('📊 백테스팅 통계 데이터:', statsData)
          setStats(statsData)
        } else if (statsRes.status === 401) {
          console.warn('⚠️ 401 인증 실패 - 토큰이 유효하지 않음')
          setIsLoggedIn(false)
          setStats(null)
        } else if (statsRes.status === 404) {
          console.warn('⚠️ 404 API 없음 - 백엔드에 엔드포인트가 없음')
          // 404면 API가 없는 것이지 로그인 문제가 아님
          setStats(null)
        } else {
          console.warn('⚠️ 기타 에러:', statsRes.status)
          setStats(null)
        }
      } catch (error) {
        console.error('히스토리 로드 실패:', error)
        setHistory([])
        setStats(null)
      }
    }

    fetchData()
  }, [symbolId, token])

  // action 문자열에서 핵심 액션만 추출 (긴 텍스트 방지)
  const extractAction = (action: string): string => {
    if (!action) return '관망'
    if (action.includes('강력 매수')) return '강력 매수'
    if (action.includes('매수')) return '매수'
    if (action.includes('매도')) return '매도'
    if (action.includes('주의')) return '주의'
    if (action.includes('관망')) return '관망'
    // 너무 긴 경우 첫 단어만 (최대 4글자)
    const firstWord = action.split(' ')[0]
    return firstWord.length <= 4 ? firstWord : '관망'
  }

  const getActionColor = (action: string) => {
    const shortAction = extractAction(action)
    if (shortAction === '강력 매수') return 'text-[#00FFC8] bg-[#00FFC8]/10 border-[#00FFC8]/30'
    if (shortAction === '매수') return 'text-[#00E5A8] bg-[#00E5A8]/10 border-[#00E5A8]/30'
    if (shortAction === '관망') return 'text-gray-400 bg-gray-400/10 border-gray-400/30'
    if (shortAction === '주의') return 'text-orange-400 bg-orange-400/10 border-orange-400/30'
    if (shortAction === '매도') return 'text-red-400 bg-red-400/10 border-red-400/30'
    return 'text-gray-400 bg-gray-400/10 border-gray-400/30'
  }

  const getActionIcon = (action: string) => {
    const shortAction = extractAction(action)
    if (shortAction.includes('매수')) return <TrendingUp className="w-3.5 h-3.5" />
    if (shortAction === '관망') return <Minus className="w-3.5 h-3.5" />
    return <TrendingDown className="w-3.5 h-3.5" />
  }

  return (
    <div className="space-y-4">
      {/* 백테스팅 통계 */}
      <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-purple-400" />
          <h3 className="text-white font-bold text-sm">AI 성과 (최근 30일)</h3>
        </div>

        {stats && stats.totalPredictions > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-black/30 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">총 분석</p>
                <p className="text-2xl font-bold text-white">{stats.totalPredictions}<span className="text-sm text-gray-400 ml-1">회</span></p>
              </div>
              <div className="bg-black/30 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">정확도</p>
                <p className="text-2xl font-bold text-[#00E5A8]">{stats.accuracy}<span className="text-sm text-gray-400 ml-1">%</span></p>
              </div>
              <div className="bg-black/30 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">매수 승률</p>
                <p className="text-2xl font-bold text-[#00D1FF]">{stats.buyAccuracy}<span className="text-sm text-gray-400 ml-1">%</span></p>
              </div>
              <div className="bg-black/30 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">평균 수익</p>
                <p className={`text-2xl font-bold ${stats.avgProfit >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                  {stats.avgProfit >= 0 ? '+' : ''}{stats.avgProfit}<span className="text-sm text-gray-400 ml-1">%</span>
                </p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <p className="text-gray-400 mb-1">강력 매수</p>
                  <p className="text-white font-semibold">
                    {stats.actionBreakdown?.strongBuy?.accuracy || 0}% 
                    <span className="text-[#00E5A8]"> ({stats.actionBreakdown?.strongBuy?.count || 0}회)</span>
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 mb-1">매수</p>
                  <p className="text-white font-semibold">
                    {stats.actionBreakdown?.buy?.accuracy || 0}% 
                    <span className="text-[#00E5A8]"> ({stats.actionBreakdown?.buy?.count || 0}회)</span>
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 mb-1">관망</p>
                  <p className="text-white font-semibold">
                    {stats.actionBreakdown?.hold?.accuracy || 0}% 
                    <span className="text-[#00E5A8]"> ({stats.actionBreakdown?.hold?.count || 0}회)</span>
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            {isLoggedIn === false ? (
              <>
                <p className="text-yellow-400 text-sm mb-2">로그인이 필요합니다</p>
                <p className="text-gray-500 text-xs">백테스팅 통계는 로그인 후 확인할 수 있습니다</p>
              </>
            ) : (
              <>
                <p className="text-gray-400 text-sm mb-2">아직 백테스팅 데이터가 없습니다</p>
                <p className="text-gray-500 text-xs">AI 분석 후 24시간이 지나면 실제 결과가 기록됩니다</p>
              </>
            )}
          </div>
        )}

        {/* 하드코딩 제거 - 이 섹션은 위 actionBreakdown에 이미 포함되어 있음 */}
      </div>

      {/* AI 분석 히스토리 */}
      <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-lg">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-gray-400" />
            <h3 className="text-white font-semibold text-sm">AI 분석 히스토리</h3>
          </div>
        </div>

        <div className="divide-y divide-gray-700">
          {history.length > 0 ? history.map((item, idx) => (
            <div key={idx} className="p-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border flex items-center gap-1.5 ${getActionColor(item.action)}`}>
                      {getActionIcon(item.action)}
                      {extractAction(item.action)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(item.date).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs flex-wrap">
                    <div>
                      <span className="text-gray-400">가격: </span>
                      <span className="text-white font-semibold">{item.price.toLocaleString()}원</span>
                    </div>
                    {item.actualChange !== null ? (
                      <div>
                        <span className="text-gray-400">실제 변화: </span>
                        <span className={`font-semibold ${item.actualChange >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
                          {item.actualChange >= 0 ? '+' : ''}{item.actualChange.toFixed(2)}%
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-gray-400">실제 변화: </span>
                        <span className="text-yellow-400 font-semibold text-[10px]">측정 대기 중...</span>
                      </div>
                    )}
                    {item.confidence && (
                      <div>
                        <span className="text-gray-400">신뢰도: </span>
                        <span className="text-white font-semibold">{item.confidence}%</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {item.correct === null ? (
                    <div className="w-6 h-6 rounded-full bg-yellow-400/20 flex items-center justify-center" title="24시간 후 결과 측정 예정">
                      <svg className="w-3.5 h-3.5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  ) : item.correct ? (
                    <div className="w-6 h-6 rounded-full bg-[#00E5A8]/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#00E5A8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#FF4D4D]/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#FF4D4D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )) : (
            <div className="p-8 text-center">
              {isLoggedIn === false ? (
                <>
                  <p className="text-yellow-400 text-sm mb-2">로그인이 필요합니다</p>
                  <p className="text-gray-500 text-xs">AI 분석 히스토리는 로그인 후 확인할 수 있습니다</p>
                </>
              ) : (
                <>
                  <p className="text-gray-400 text-sm mb-2">아직 분석 히스토리가 없습니다</p>
                  <p className="text-gray-500 text-xs">AI 분석을 시작하면 여기에 기록됩니다</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="p-4 bg-black/20 border-t border-gray-700 text-center">
          <p className="text-xs text-gray-400">
            ℹ 백테스팅 데이터는 과거 AI 분석 결과와 실제 시장 변화를 비교한 것입니다.
          </p>
        </div>
      </div>
    </div>
  )
}

