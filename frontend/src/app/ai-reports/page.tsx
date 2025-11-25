'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAuthenticated } from '@/stores/authStore'
import { api } from '@/lib/api'
import DashboardLayout from '@/components/Layout/DashboardLayout'
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">AI 분석 리포트</h1>

        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="glass rounded-xl p-6 animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <BarChart3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">생성된 AI 리포트가 없습니다</p>
            <button
              onClick={() => router.push('/symbols')}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition"
            >
              종목에서 AI 분석 요청하기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map(report => (
              <div key={report._id} className="glass rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold mb-1">
                      {report.symbolId?.name || '알 수 없음'}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {new Date(report.createdAt).toLocaleString()} · {report.timeframe}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-primary-600/20 text-primary-400 rounded-full text-sm">
                    {report.reportType}
                  </span>
                </div>
                <div className="whitespace-pre-wrap text-gray-300">
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

