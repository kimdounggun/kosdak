'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAuthenticated } from '@/stores/authStore'
import { api } from '@/lib/api'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { BarChart3 } from 'lucide-react'

export default function AiReportsPage() {
  const router = useRouter()
  const { isAuthenticated, isHydrated } = useIsAuthenticated()
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isHydrated) return

    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadReports()
  }, [isHydrated, isAuthenticated])

  const loadReports = async () => {
    try {
      const response = await api.get('/ai/reports?limit=20')
      setReports(response.data)
    } catch (error) {
      console.error('Failed to load reports:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isHydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-100">
        <LoadingSpinner message="리포트 로딩 중..." size="md" />
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-3 sm:space-y-4">
        <h1 className="text-lg sm:text-xl font-bold">AI 분석 리포트</h1>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="glass rounded-lg p-3 sm:p-4 animate-pulse">
                <div className="h-5 bg-gray-700 rounded w-1/3 mb-3"></div>
                <div className="h-3 bg-gray-700 rounded w-full mb-1.5"></div>
                <div className="h-3 bg-gray-700 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="glass rounded-lg p-8 sm:p-12 text-center">
            <BarChart3 className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-3 text-sm">생성된 AI 리포트가 없습니다</p>
            <button
              onClick={() => router.push('/symbols')}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition text-sm"
            >
              AI 분석 요청하기
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map(report => (
              <div key={report._id} className="glass rounded-lg p-3 sm:p-4">
                <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold mb-0.5 truncate">
                      {report.symbolId?.name || '알 수 없음'}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-gray-400">
                      {new Date(report.createdAt).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })} · {report.timeframe}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-primary-600/20 text-primary-400 rounded-full text-[10px] sm:text-xs whitespace-nowrap">
                    {report.reportType}
                  </span>
                </div>
                <div className="whitespace-pre-wrap text-gray-300 text-xs sm:text-sm leading-relaxed">
                  {report.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

