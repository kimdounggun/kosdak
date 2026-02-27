'use client'

import { ReactNode, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAuthenticated, useAuthStore } from '@/stores/authStore'
import {
  Home,
  TrendingUp,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  BarChart3,
  BarChart2,
} from 'lucide-react'

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const { user } = useIsAuthenticated()
  const { logout } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navigation = [
    { name: '대시보드', href: '/dashboard', icon: Home, badge: null },
    { name: '종목 목록', href: '/symbols', icon: TrendingUp, badge: null },
    { name: '알림 관리', href: '/alerts', icon: Bell, badge: '준비중' },
    { name: 'AI 분석', href: '/ai-reports', icon: BarChart3, badge: null },
    { name: 'AI 통계', href: '/ai-stats', icon: BarChart2, badge: null },
    { name: '설정', href: '/settings', icon: Settings, badge: null },
  ]

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-[#0D0D0D] border-r border-white/10 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h1 className="text-xl font-bold text-white">Kosdak Bot</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    router.push(item.href)
                    setSidebarOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[#15171A] transition text-white"
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{item.name}</span>
                  {item.badge && (
                    <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-500 rounded">
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* User info / Guest */}
          <div className="p-4 border-t border-white/10">
            {user ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
                    <span className="font-semibold">{user.name?.charAt(0) || 'U'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-white">{user.name}</p>
                    <p className="text-sm text-[#CFCFCF] truncate">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-[#15171A] transition text-red-400"
                >
                  <LogOut className="w-5 h-5" />
                  <span>로그아웃</span>
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-[#CFCFCF]">
                  <p className="font-medium text-white mb-1">게스트로 둘러보는 중</p>
                  <p className="text-[11px] text-gray-400">
                    로그인하면 관심종목과 AI 분석 히스토리를 저장할 수 있어요.
                  </p>
                </div>
                <button
                  onClick={() => router.push('/login')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-primary-500/60 text-primary-200 hover:bg-primary-600/10 hover:border-primary-400 transition text-sm font-medium"
                >
                  <span>로그인하기</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 bg-[#0D0D0D] min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="bg-[#0D0D0D] sticky top-0 z-30 border-b border-white/5">
          <div className="flex items-center justify-between p-3 sm:p-4 lg:p-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-white p-1"
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <div className="flex-1 lg:flex-none"></div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button className="relative p-1.5 sm:p-2 hover:bg-[#15171A] rounded-lg transition text-white">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full"></span>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-3 sm:p-4 lg:p-6 bg-[#0D0D0D] flex-1">{children}</main>
        
        {/* Footer */}
        <footer className="border-t border-white/10 p-3 sm:p-4 lg:p-6 text-center text-xs sm:text-sm text-[#CFCFCF] mt-auto">
          <p className="mb-1.5 sm:mb-2">© 2025 Kosdak Bot</p>
          <div className="flex justify-center gap-2 sm:gap-4 flex-wrap">
            <button
              onClick={() => router.push('/terms')}
              className="hover:text-[#00E5A8] transition text-xs sm:text-sm"
            >
              이용약관
            </button>
            <span className="text-white/20">|</span>
            <button className="hover:text-[#00E5A8] transition text-xs sm:text-sm">
              개인정보처리방침
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}


