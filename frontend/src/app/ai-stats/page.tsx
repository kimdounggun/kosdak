'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAuthenticated } from '@/stores/authStore'
import { api } from '@/lib/api'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { BarChart3, TrendingUp, Target, Award, Users } from 'lucide-react'

export default function AiStatsPage() {
  const router = useRouter()
  const { isAuthenticated, isHydrated } = useIsAuthenticated()
  const [platformStats, setPlatformStats] = useState<any>(null)
  const [myStats, setMyStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isHydrated) return

    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadStats()
  }, [isHydrated, isAuthenticated])

  const loadStats = async () => {
    try {
      const [platformRes, myRes] = await Promise.all([
        api.get('/ai/stats/platform'),
        api.get('/ai/stats/me'),
      ])
      setPlatformStats(platformRes.data)
      setMyStats(myRes.data)
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isHydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-100">
        <LoadingSpinner message="통계 로딩 중..." size="md" />
      </div>
    )
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner message="AI 통계 분석 중..." size="lg" />
        </div>
      </DashboardLayout>
    )
  }

  const hasData = myStats?.totalAnalysis > 0
  const hasPlatformData = platformStats?.totalAnalysis > 0

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 헤더 */}
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">AI 투자 성과 분석</h1>
          <p className="text-gray-400 text-sm">최근 30일간의 AI 분석 결과를 평가합니다</p>
        </div>

        {!hasData ? (
          <div className="glass-panel rounded-lg p-12 text-center">
            <BarChart3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">아직 분석 데이터가 없습니다</p>
            <p className="text-gray-500 text-sm mb-6">AI 분석을 시작하고 24시간이 지나면 성과가 집계됩니다</p>
            <button
              onClick={() => router.push('/symbols')}
              className="px-6 py-3 bg-[#00E5A8] hover:bg-[#00cc96] text-black rounded-lg font-semibold transition"
            >
              AI 분석 시작하기
            </button>
          </div>
        ) : (
          <>
            {/* Section 1: 전체 통계 대시보드 */}
            <div className="space-y-4">
              {/* 플랫폼 전체 */}
              {hasPlatformData && (
                <div className="glass-panel rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">플랫폼 전체 통계</h2>
                      <p className="text-xs text-gray-400">모든 사용자 데이터 통합 (최근 30일)</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <StatCard
                      label="총 분석"
                      value={platformStats.totalAnalysis}
                      suffix="회"
                      icon={<BarChart3 className="w-4 h-4" />}
                    />
                    <StatCard
                      label="방향 정확도"
                      value={platformStats.directionAccuracy}
                      suffix="%"
                      icon={<TrendingUp className="w-4 h-4" />}
                      color="#00D1FF"
                    />
                    <StatCard
                      label="목표 달성률"
                      value={platformStats.target1AchievementRate}
                      suffix="%"
                      icon={<Target className="w-4 h-4" />}
                      color="#00E5A8"
                      tooltip="1차 목표가 달성률"
                    />
                    <StatCard
                      label="평균 수익률"
                      value={platformStats.avgProfit >= 0 ? `+${platformStats.avgProfit}` : platformStats.avgProfit}
                      suffix="%"
                      icon={<Award className="w-4 h-4" />}
                      color={platformStats.avgProfit >= 0 ? '#00E5A8' : '#FF4D4D'}
                    />
                  </div>
                </div>
              )}

              {/* 나의 통계 */}
              <div className="glass-panel rounded-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00E5A8] to-[#00D1FF] flex items-center justify-center">
                    <Award className="w-5 h-5 text-black" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-white">나의 통계</h2>
                    <p className="text-xs text-gray-400">내가 분석한 모든 종목 통합</p>
                  </div>
                  {hasPlatformData && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">vs 플랫폼 평균</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard
                    label="총 분석"
                    value={myStats.totalAnalysis}
                    suffix="회"
                    icon={<BarChart3 className="w-4 h-4" />}
                    comparison={hasPlatformData ? {
                      value: myStats.totalAnalysis,
                      total: platformStats.totalAnalysis
                    } : undefined}
                  />
                  <StatCard
                    label="방향 정확도"
                    value={myStats.directionAccuracy}
                    suffix="%"
                    icon={<TrendingUp className="w-4 h-4" />}
                    color="#00D1FF"
                    comparison={hasPlatformData ? {
                      value: myStats.directionAccuracy,
                      total: platformStats.directionAccuracy
                    } : undefined}
                  />
                  <StatCard
                    label="목표 달성률"
                    value={myStats.target1AchievementRate}
                    suffix="%"
                    icon={<Target className="w-4 h-4" />}
                    color="#00E5A8"
                    tooltip="1차 목표가 달성률 (실전 승률)"
                    comparison={hasPlatformData ? {
                      value: myStats.target1AchievementRate,
                      total: platformStats.target1AchievementRate
                    } : undefined}
                  />
                  <StatCard
                    label="평균 수익률"
                    value={myStats.avgProfit >= 0 ? `+${myStats.avgProfit}` : myStats.avgProfit}
                    suffix="%"
                    icon={<Award className="w-4 h-4" />}
                    color={myStats.avgProfit >= 0 ? '#00E5A8' : '#FF4D4D'}
                    comparison={hasPlatformData ? {
                      value: myStats.avgProfit,
                      total: platformStats.avgProfit
                    } : undefined}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: 투자 기간별 성과 */}
            <div className="glass-panel rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4">투자 기간별 성과</h3>
              <div className="space-y-4">
                <PeriodStats
                  title="단기 스윙 (3~7일)"
                  targetGoal="+5% 목표"
                  platform={platformStats?.byPeriod?.swing}
                  my={myStats?.byPeriod?.swing}
                />
                <PeriodStats
                  title="중기 (2~4주)"
                  targetGoal="+10% 목표"
                  platform={platformStats?.byPeriod?.medium}
                  my={myStats?.byPeriod?.medium}
                />
                <PeriodStats
                  title="장기 (1~3개월)"
                  targetGoal="+20% 목표"
                  platform={platformStats?.byPeriod?.long}
                  my={myStats?.byPeriod?.long}
                />
              </div>
            </div>

            {/* Section 3: 액션별 성과 */}
            <div className="glass-panel rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4">AI 추천 액션별 성과</h3>
              <div className="space-y-4">
                <ActionStats
                  title="강력 매수"
                  platform={platformStats?.byAction?.strongBuy}
                  my={myStats?.byAction?.strongBuy}
                  color="#00FFC8"
                />
                <ActionStats
                  title="매수"
                  platform={platformStats?.byAction?.buy}
                  my={myStats?.byAction?.buy}
                  color="#00E5A8"
                />
                <ActionStats
                  title="관망"
                  platform={platformStats?.byAction?.hold}
                  my={myStats?.byAction?.hold}
                  color="#8B95A5"
                />
              </div>
            </div>

            {/* 안내 문구 */}
            <div className="glass-panel rounded-lg p-4 border border-[#00E5A8]/20">
              <p className="text-xs text-gray-400 text-center">
                ℹ️ 통계는 AI 분석 후 24시간이 경과한 데이터를 기준으로 집계됩니다. 
                방향 정확도는 가격 변화 방향을, 목표 달성률은 AI가 제시한 목표가 달성 여부를 의미합니다.
              </p>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

// 통계 카드 컴포넌트
function StatCard({ label, value, suffix, icon, color = '#FFFFFF', tooltip, comparison }: any) {
  const diff = comparison ? value - comparison.total : null
  const isHigher = diff && diff > 0
  
  return (
    <div className="bg-[#1a1f2e] rounded-lg p-4 border border-gray-700/50">
      <div className="flex items-center gap-2 mb-2">
        <div style={{ color }}>{icon}</div>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
      <div className="flex items-baseline gap-1">
        <p className="text-2xl font-bold" style={{ color }}>{value}</p>
        <p className="text-sm text-gray-500">{suffix}</p>
      </div>
      {comparison && diff !== null && (
        <div className="mt-2 pt-2 border-t border-gray-700/50">
          <p className={`text-xs ${isHigher ? 'text-[#00E5A8]' : diff === 0 ? 'text-gray-400' : 'text-[#FF4D4D]'}`}>
            {isHigher ? '↑' : diff === 0 ? '=' : '↓'} {Math.abs(diff).toFixed(1)}{suffix} {isHigher ? '우수' : diff === 0 ? '동일' : '부족'}
          </p>
        </div>
      )}
      {tooltip && (
        <p className="text-[10px] text-gray-500 mt-1">{tooltip}</p>
      )}
    </div>
  )
}

// 기간별 통계 컴포넌트
function PeriodStats({ title, targetGoal, platform, my }: any) {
  if (!my || my.count === 0) return null
  
  return (
    <div className="bg-[#1a1f2e] rounded-lg p-4 border border-gray-700/50">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-white font-semibold">{title}</h4>
          <p className="text-xs text-gray-500">{targetGoal}</p>
        </div>
        <span className="text-xs text-gray-400">{my.count}회 분석</span>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">목표 달성률</p>
          <p className="text-lg font-bold text-[#00E5A8]">{my.target1Rate}%</p>
          {platform && platform.count > 0 && (
            <p className="text-[10px] text-gray-600">평균 {platform.target1Rate}%</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">평균 수익률</p>
          <p className={`text-lg font-bold ${my.avgProfit >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
            {my.avgProfit >= 0 ? '+' : ''}{my.avgProfit}%
          </p>
          {platform && platform.count > 0 && (
            <p className="text-[10px] text-gray-600">평균 {platform.avgProfit >= 0 ? '+' : ''}{platform.avgProfit}%</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">2차 목표</p>
          <p className="text-lg font-bold text-[#00D1FF]">{my.target2Rate}%</p>
          {platform && platform.count > 0 && (
            <p className="text-[10px] text-gray-600">평균 {platform.target2Rate}%</p>
          )}
        </div>
      </div>
    </div>
  )
}

// 액션별 통계 컴포넌트
function ActionStats({ title, platform, my, color }: any) {
  if (!my || my.count === 0) return null
  
  return (
    <div className="bg-[#1a1f2e] rounded-lg p-4 border border-gray-700/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
          <h4 className="text-white font-semibold">{title}</h4>
        </div>
        <span className="text-xs text-gray-400">{my.count}회</span>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">방향 정확도</p>
          <p className="text-base font-bold text-[#00D1FF]">{my.directionAccuracy}%</p>
          {platform && platform.count > 0 && (
            <p className="text-[10px] text-gray-600">평균 {platform.directionAccuracy}%</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">목표 달성률</p>
          <p className="text-base font-bold text-[#00E5A8]">{my.target1Rate}%</p>
          {platform && platform.count > 0 && (
            <p className="text-[10px] text-gray-600">평균 {platform.target1Rate}%</p>
          )}
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-700/50">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">평균 수익률</p>
          <p className={`text-sm font-bold ${my.avgProfit >= 0 ? 'text-[#00E5A8]' : 'text-[#FF4D4D]'}`}>
            {my.avgProfit >= 0 ? '+' : ''}{my.avgProfit}%
          </p>
        </div>
      </div>
    </div>
  )
}



