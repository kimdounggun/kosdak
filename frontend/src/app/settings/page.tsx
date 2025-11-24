'use client'

import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import DashboardLayout from '@/components/Layout/DashboardLayout'

export default function SettingsPage() {
  const router = useRouter()
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    router.push('/login')
    return null
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">설정</h1>

        {/* 프로필 정보 */}
        <div className="glass rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">프로필 정보</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-400">이름</p>
              <p className="text-lg">{user?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">이메일</p>
              <p className="text-lg">{user?.email}</p>
            </div>
            {user?.phoneNumber && (
              <div>
                <p className="text-sm text-gray-400">전화번호</p>
                <p className="text-lg">{user.phoneNumber}</p>
              </div>
            )}
          </div>
        </div>

        {/* 알림 설정 */}
        <div className="glass rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">알림 설정</h2>
          <p className="text-gray-400">알림 채널 관리 기능은 추후 추가 예정입니다.</p>
        </div>
      </div>
    </DashboardLayout>
  )
}

