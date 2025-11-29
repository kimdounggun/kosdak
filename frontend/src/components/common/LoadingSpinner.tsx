'use client'

import { TrendingUp, BarChart3, Activity, Sparkles } from 'lucide-react'

interface LoadingSpinnerProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
  showSteps?: boolean
}

export default function LoadingSpinner({ 
  message = '데이터 로딩 중...', 
  size = 'md',
  showSteps = false 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  }

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] py-12">
      {/* 메인 스피너 */}
      <div className="relative">
        {/* 외부 링 */}
        <div className={`${sizeClasses[size]} border-4 border-dark-300 rounded-full animate-pulse`}></div>
        
        {/* 회전 링 */}
        <div className={`absolute inset-0 ${sizeClasses[size]} border-4 border-transparent border-t-[#00E5A8] rounded-full animate-spin`}></div>
        
        {/* 중앙 아이콘 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <TrendingUp className={`${size === 'lg' ? 'w-6 h-6' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4'} text-[#00E5A8]`} />
        </div>
      </div>

      {/* 메시지 */}
      <p className={`mt-4 text-gray-400 ${textSizes[size]} font-medium`}>{message}</p>

      {/* 로딩 단계 표시 (선택적) */}
      {showSteps && (
        <div className="mt-6 flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5 animate-pulse">
            <BarChart3 className="w-3.5 h-3.5 text-[#00E5A8]" />
            <span>시세 수집</span>
          </div>
          <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
          <div className="flex items-center gap-1.5 animate-pulse" style={{ animationDelay: '0.2s' }}>
            <Activity className="w-3.5 h-3.5 text-[#00D1FF]" />
            <span>지표 계산</span>
          </div>
          <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
          <div className="flex items-center gap-1.5 animate-pulse" style={{ animationDelay: '0.4s' }}>
            <Sparkles className="w-3.5 h-3.5 text-[#FFB800]" />
            <span>AI 준비</span>
          </div>
        </div>
      )}

      {/* 하단 로딩 바 */}
      <div className="mt-4 w-48 h-1 bg-dark-300 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-[#00E5A8] via-[#00D1FF] to-[#00E5A8] rounded-full animate-loading-bar"></div>
      </div>
    </div>
  )
}










