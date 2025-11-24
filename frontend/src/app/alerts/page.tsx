'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import { Bell, BellOff, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AlertsPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadAlerts()
  }, [])

  const loadAlerts = async () => {
    try {
      const response = await api.get('/alerts')
      setAlerts(response.data)
    } catch (error) {
      console.error('Failed to load alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleAlert = async (id: string, active: boolean) => {
    try {
      await api.patch(`/alerts/${id}`, { active: !active })
      toast.success(active ? '알림 비활성화' : '알림 활성화')
      loadAlerts()
    } catch (error) {
      toast.error('변경 실패')
    }
  }

  const deleteAlert = async (id: string) => {
    if (!confirm('알림을 삭제하시겠습니까?')) return
    try {
      await api.delete(`/alerts/${id}`)
      toast.success('알림 삭제 완료')
      loadAlerts()
    } catch (error) {
      toast.error('삭제 실패')
    }
  }

  if (!isAuthenticated) return null

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">알림 관리</h1>
          <button
            onClick={() => router.push('/alerts/create')}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition"
          >
            + 알림 추가
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="glass rounded-xl p-6 animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">설정된 알림이 없습니다</p>
            <button
              onClick={() => router.push('/alerts/create')}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition"
            >
              첫 알림 만들기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map(alert => (
              <div key={alert._id} className="glass rounded-xl p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold">{alert.name}</h3>
                      {alert.active ? (
                        <span className="px-3 py-1 bg-success/20 text-success rounded-full text-sm">
                          활성
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-gray-700 text-gray-400 rounded-full text-sm">
                          비활성
                        </span>
                      )}
                    </div>
                    {alert.description && (
                      <p className="text-gray-400 mb-3">{alert.description}</p>
                    )}
                    <div className="text-sm text-gray-500">
                      <p>종목: {alert.symbolId?.name || '알 수 없음'}</p>
                      <p>발동 횟수: {alert.triggerCount}회</p>
                      {alert.lastTriggeredAt && (
                        <p>마지막 발동: {new Date(alert.lastTriggeredAt).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleAlert(alert._id, alert.active)}
                      className="p-2 hover:bg-dark-200 rounded-lg transition"
                      title={alert.active ? '비활성화' : '활성화'}
                    >
                      {alert.active ? (
                        <Bell className="w-5 h-5 text-success" />
                      ) : (
                        <BellOff className="w-5 h-5 text-gray-500" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteAlert(alert._id)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition"
                      title="삭제"
                    >
                      <Trash2 className="w-5 h-5 text-danger" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

