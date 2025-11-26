'use client'

import DashboardLayout from '@/components/Layout/DashboardLayout'

export default function TermsPage() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="glass-panel rounded-xl p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">서비스 이용약관</h1>
          <p className="text-sm text-[#CFCFCF]">최종 수정일: 2025년 11월 26일</p>
        </div>

        {/* 면책 조항 */}
        <div className="glass-panel rounded-xl p-6 sm:p-8 border-2 border-[rgba(255,77,77,0.3)]">
          <div className="flex items-start gap-3 mb-4">
            <svg className="w-6 h-6 text-[#FF4D4D] flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h2 className="text-xl font-bold text-[#FF4D4D] mb-2">중요 면책 조항</h2>
              <p className="text-sm text-[#CFCFCF] leading-relaxed">
                본 서비스는 <span className="text-white font-semibold">투자 권유가 아닌 정보 제공 목적</span>으로만 운영됩니다.
              </p>
            </div>
          </div>
          
          <ul className="space-y-2 text-sm text-[#CFCFCF]">
            <li className="flex items-start gap-2">
              <span className="text-[#FF4D4D] mt-1">•</span>
              <span>투자 손실에 대한 책임은 전적으로 사용자에게 있습니다.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FF4D4D] mt-1">•</span>
              <span>AI 분석은 참고용이며 절대적 지표가 아닙니다.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FF4D4D] mt-1">•</span>
              <span>최종 투자 판단은 반드시 본인의 책임 하에 이루어져야 합니다.</span>
            </li>
          </ul>
        </div>

        {/* 데이터 출처 */}
        <div className="glass-panel rounded-xl p-6 sm:p-8">
          <h2 className="text-xl font-bold text-white mb-4">데이터 출처 및 제공 조건</h2>
          
          <div className="space-y-4 text-sm text-[#CFCFCF]">
            <div>
              <h3 className="font-semibold text-white mb-2">1. 시세 데이터</h3>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-[#00E5A8] mt-1">•</span>
                  <span>출처: Yahoo Finance API</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00E5A8] mt-1">•</span>
                  <span className="text-[#FFB800]">
                    <span className="font-semibold">20분 지연 시세</span> - KRX 정책에 따라 실시간 시세가 아닙니다
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00E5A8] mt-1">•</span>
                  <span>업데이트 주기: 5분마다 자동 갱신</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">2. AI 분석</h3>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-[#00E5A8] mt-1">•</span>
                  <span>기반: OpenAI GPT-4 모델</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00E5A8] mt-1">•</span>
                  <span>분석 기준: RSI, MACD, 이동평균선 등 기술적 지표</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00E5A8] mt-1">•</span>
                  <span>유효 기간: 생성 후 6시간</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 투자 위험 고지 */}
        <div className="glass-panel rounded-xl p-6 sm:p-8">
          <h2 className="text-xl font-bold text-white mb-4">투자 위험 고지</h2>
          
          <div className="space-y-3 text-sm text-[#CFCFCF]">
            <p className="leading-relaxed">
              주식 투자는 원금 손실의 위험이 있습니다. 본 서비스에서 제공하는 정보는 다음과 같은 한계가 있습니다:
            </p>
            
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-[#FFB800] mt-1">⚠</span>
                <span><span className="font-semibold">20분 지연 시세</span>로 인해 실시간 거래에 부적합합니다</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFB800] mt-1">⚠</span>
                <span>AI 분석은 과거 데이터 기반이며 미래를 보장하지 않습니다</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFB800] mt-1">⚠</span>
                <span>기술적 분석만으로는 충분하지 않으며 펀더멘털 분석이 필요합니다</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFB800] mt-1">⚠</span>
                <span>갑작스러운 뉴스, 공시, 시장 변동에 대응하지 못할 수 있습니다</span>
              </li>
            </ul>
          </div>
        </div>

        {/* 서비스 이용 조건 */}
        <div className="glass-panel rounded-xl p-6 sm:p-8">
          <h2 className="text-xl font-bold text-white mb-4">서비스 이용 조건</h2>
          
          <div className="space-y-4 text-sm text-[#CFCFCF]">
            <div>
              <h3 className="font-semibold text-white mb-2">1. 사용자 의무</h3>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-[#00E5A8] mt-1">•</span>
                  <span>본인의 투자 판단에 대한 책임은 전적으로 사용자에게 있습니다</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00E5A8] mt-1">•</span>
                  <span>서비스 정보를 상업적으로 재배포하거나 판매할 수 없습니다</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00E5A8] mt-1">•</span>
                  <span>타인의 계정을 무단으로 사용할 수 없습니다</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">2. 서비스 제공자 권리</h3>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-[#00E5A8] mt-1">•</span>
                  <span>서비스는 사전 통지 없이 변경될 수 있습니다</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00E5A8] mt-1">•</span>
                  <span>시스템 점검, API 오류 등으로 일시적 중단이 발생할 수 있습니다</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00E5A8] mt-1">•</span>
                  <span>약관 위반 시 서비스 이용이 제한될 수 있습니다</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 책임 제한 */}
        <div className="glass-panel rounded-xl p-6 sm:p-8 border-2 border-[rgba(255,184,0,0.3)]">
          <h2 className="text-xl font-bold text-[#FFB800] mb-4">책임 제한</h2>
          
          <div className="space-y-3 text-sm text-[#CFCFCF]">
            <p className="leading-relaxed">
              서비스 제공자는 다음 사항에 대해 책임을 지지 않습니다:
            </p>
            
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-[#FFB800] mt-1">•</span>
                <span>사용자의 투자 손실</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFB800] mt-1">•</span>
                <span>데이터 제공업체(Yahoo Finance, OpenAI)의 오류 또는 중단</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFB800] mt-1">•</span>
                <span>시스템 장애, 해킹, 천재지변 등 불가항력적 사유</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFB800] mt-1">•</span>
                <span>사용자의 부주의로 인한 정보 유출</span>
              </li>
            </ul>
          </div>
        </div>

        {/* 문의 */}
        <div className="glass-panel rounded-xl p-6 sm:p-8">
          <h2 className="text-xl font-bold text-white mb-4">문의</h2>
          <p className="text-sm text-[#CFCFCF] leading-relaxed">
            서비스 이용약관에 대한 문의사항이 있으시면 아래로 연락해 주세요.
          </p>
          <p className="text-sm text-[#00E5A8] mt-3">
            이메일: fortis_systems@naver.com
          </p>
        </div>

        {/* 동의 버튼 */}
        <div className="glass-panel rounded-xl p-6 sm:p-8 text-center">
          <p className="text-sm text-[#CFCFCF] mb-4">
            서비스를 계속 이용하시면 위 약관에 동의하는 것으로 간주됩니다.
          </p>
          <button 
            onClick={() => window.history.back()}
            className="px-8 py-3 bg-gradient-to-r from-[#00E5A8] to-[#00D1FF] text-white font-semibold rounded-lg hover:opacity-90 transition-all"
          >
            확인했습니다
          </button>
        </div>
      </div>
    </DashboardLayout>
  )
}

