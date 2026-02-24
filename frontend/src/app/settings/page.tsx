'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAuthenticated } from '@/stores/authStore'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import LoadingSpinner from '@/components/common/LoadingSpinner'

export default function SettingsPage() {
  const router = useRouter()
  const { isHydrated, user } = useIsAuthenticated()

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-100">
        <LoadingSpinner message="설정 로딩 중..." size="md" />
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-3 sm:space-y-4">
        <h1 className="text-lg sm:text-xl font-bold">설정</h1>

        {/* 프로필 정보 */}
        <div className="glass rounded-lg p-3 sm:p-4">
          <h2 className="text-base sm:text-lg font-semibold mb-3">프로필 정보</h2>
          {user ? (
            <div className="space-y-2.5">
              <div>
                <p className="text-xs sm:text-sm text-gray-400">이름</p>
                <p className="text-sm sm:text-base">{user.name}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-400">이메일</p>
                <p className="text-sm sm:text-base break-all">{user.email}</p>
              </div>
              {user.phoneNumber && (
                <div>
                  <p className="text-xs sm:text-sm text-gray-400">전화번호</p>
                  <p className="text-sm sm:text-base">{user.phoneNumber}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-sm mb-3">로그인하면 프로필을 볼 수 있어요</p>
          )}
          {!user && (
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition text-sm"
            >
              로그인
            </button>
          )}
        </div>

        {/* 알림 설정 */}
        <div className="glass rounded-lg p-3 sm:p-4">
          <h2 className="text-base sm:text-lg font-semibold mb-2">알림 설정</h2>
          <p className="text-gray-400 text-xs sm:text-sm">알림 채널 관리 기능은 추후 추가 예정입니다.</p>
        </div>
      </div>
    </DashboardLayout>
  )
}

