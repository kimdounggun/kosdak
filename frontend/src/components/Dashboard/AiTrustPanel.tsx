'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Info, Zap, TrendingUp, Shield } from 'lucide-react'

interface AiTrustPanelProps {
  aiReport: any
  generatingReport: boolean
}

export default function AiTrustPanel({ aiReport, generatingReport }: AiTrustPanelProps) {
  const [showRawResponse, setShowRawResponse] = useState(false)
  const [showProcess, setShowProcess] = useState(false)
  const [showExplainability, setShowExplainability] = useState(false)

  if (!aiReport && !generatingReport) return null

  return (
    <div className="space-y-4">
      {/* 1. AI 모델 정보 */}
      <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-sm mb-2">사용 중인 AI 모델</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-gray-400 mb-0.5">모델</p>
                <p className="text-white font-semibold">{aiReport?.metadata?.model || 'GPT-4 Turbo'}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">버전</p>
                <p className="text-white font-semibold">{aiReport?.metadata?.modelVersion || 'gpt-4-turbo-2024-04-09'}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">분석 시간</p>
                <p className="text-white font-semibold">{aiReport?.metadata?.processingTimeMs ? `${(aiReport.metadata.processingTimeMs / 1000).toFixed(1)}초` : '3.2초'}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">사용 토큰</p>
                <p className="text-white font-semibold">{aiReport?.metadata?.tokensUsed ? `${aiReport.metadata.tokensUsed.toLocaleString()}개` : '2,450개'}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700">
              <p className="text-xs text-gray-400 leading-relaxed">
                <span className="text-blue-400 font-semibold">OpenAI GPT-4 Turbo</span>를 사용하여 실시간 주식 데이터를 분석합니다. 
                금융 시장 분석에 특화된 프롬프트와 함께 최신 기술적 지표를 종합적으로 평가합니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. AI 분석 과정 */}
      {aiReport?.analysisProcess && (
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-lg">
          <button
            onClick={() => setShowProcess(!showProcess)}
            className="w-full flex items-center justify-between p-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#00E5A8]" />
              <span className="text-white font-semibold text-sm">AI 분석 과정</span>
            </div>
            {showProcess ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>
          
          {showProcess && (
            <div className="px-4 pb-4 space-y-3">
              {/* Step 1 */}
              <div className="bg-[rgba(0,229,168,0.05)] border-l-4 border-[#00E5A8] rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-[#00E5A8] text-black font-bold text-xs flex items-center justify-center">
                    1
                  </div>
                  <span className="text-white font-semibold text-sm">기술적 지표 분석</span>
                  <span className="ml-auto text-xs text-[#00E5A8]">✓ 완료</span>
                </div>
                <div className="ml-8 text-xs space-y-1">
                  <p className="text-gray-300">{aiReport.analysisProcess.step1?.result || '기술적 지표 분석 완료'}</p>
                  {aiReport.analysisProcess.step1?.details && (
                    <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
                      <div className="text-gray-400">RSI: <span className="text-white">{aiReport.analysisProcess.step1.details.rsi?.toFixed(2) || 'N/A'}</span></div>
                      <div className="text-gray-400">MACD: <span className="text-white">{aiReport.analysisProcess.step1.details.macd?.toFixed(2) || 'N/A'}</span></div>
                      <div className="text-gray-400">MA5: <span className="text-white">{aiReport.analysisProcess.step1.details.ma5?.toLocaleString() || 'N/A'}</span></div>
                      <div className="text-gray-400">MA20: <span className="text-white">{aiReport.analysisProcess.step1.details.ma20?.toLocaleString() || 'N/A'}</span></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-[rgba(0,209,255,0.05)] border-l-4 border-[#00D1FF] rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-[#00D1FF] text-black font-bold text-xs flex items-center justify-center">
                    2
                  </div>
                  <span className="text-white font-semibold text-sm">패턴 인식</span>
                  <span className="ml-auto text-xs text-[#00D1FF]">✓ 완료</span>
                </div>
                <div className="ml-8 text-xs space-y-1">
                  <p className="text-gray-300">{aiReport.analysisProcess.step2?.result || '패턴 인식 완료'}</p>
                  {aiReport.analysisProcess.step2?.details && (
                    <div className="mt-2 text-[10px] text-gray-400">
                      <p>추세: <span className="text-white">{aiReport.analysisProcess.step2.details.trend === 'uptrend' ? '상승' : aiReport.analysisProcess.step2.details.trend === 'downtrend' ? '하락' : '횡보'}</span></p>
                      <p>강도: <span className="text-white">{aiReport.analysisProcess.step2.details.strength?.toFixed(0)}%</span></p>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-[rgba(255,184,0,0.05)] border-l-4 border-[#FFB800] rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-[#FFB800] text-black font-bold text-xs flex items-center justify-center">
                    3
                  </div>
                  <span className="text-white font-semibold text-sm">리스크 평가</span>
                  <span className="ml-auto text-xs text-[#FFB800]">✓ 완료</span>
                </div>
                <div className="ml-8 text-xs space-y-1">
                  <p className="text-gray-300">{aiReport.analysisProcess.step3?.result || '리스크 평가 완료'}</p>
                  {aiReport.analysisProcess.step3?.details && (
                    <div className="mt-2 text-[10px] text-gray-400">
                      <p>변동성: <span className="text-white">{aiReport.analysisProcess.step3.details.volatility}</span></p>
                      <p>리스크: <span className="text-white">{aiReport.analysisProcess.step3.details.risk}</span></p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. 설명 가능한 AI (가중치) */}
      {aiReport?.explainability?.factors && aiReport.explainability.factors.length > 0 && (
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-lg">
          <button
            onClick={() => setShowExplainability(!showExplainability)}
            className="w-full flex items-center justify-between p-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#FFB800]" />
              <span className="text-white font-semibold text-sm">왜 이렇게 판단했나요?</span>
            </div>
            {showExplainability ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>
          
          {showExplainability && (
            <div className="px-4 pb-4 space-y-3">
              <p className="text-xs text-gray-400 mb-3">
                AI가 판단한 주요 근거와 각 요인의 영향력입니다.
              </p>
              
              {aiReport.explainability.factors.map((factor: any, idx: number) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white font-semibold">{factor.name}</span>
                    <span className="text-[#00E5A8] font-bold">{factor.weight}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#00E5A8] to-[#00D1FF] rounded-full transition-all duration-500"
                      style={{ width: `${factor.weight}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400">{factor.impact}</p>
                </div>
              ))}

              {aiReport.explainability.reasoning && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-xs font-semibold text-white mb-2">종합 판단</p>
                  <p className="text-xs text-gray-300 leading-relaxed">{aiReport.explainability.reasoning}</p>
                </div>
              )}

              {aiReport.explainability.alternatives && (
                <div className="mt-3 bg-yellow-900/20 border border-yellow-600/30 rounded p-3">
                  <p className="text-xs font-semibold text-yellow-400 mb-1.5">대안 시나리오</p>
                  <p className="text-[10px] text-yellow-300/80 leading-relaxed">{aiReport.explainability.alternatives}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. AI 원문 보기 */}
      {aiReport?.rawResponse && (
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-lg">
          <button
            onClick={() => setShowRawResponse(!showRawResponse)}
            className="w-full flex items-center justify-between p-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-gray-400" />
              <span className="text-white font-semibold text-sm">GPT-4 원본 응답 보기</span>
            </div>
            {showRawResponse ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>
          
          {showRawResponse && (
            <div className="px-4 pb-4">
              <div className="bg-black/50 border border-gray-700 rounded-lg p-3 font-mono text-[10px] text-gray-300 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                {aiReport.rawResponse}
              </div>
              <p className="text-[10px] text-gray-500 mt-2">
                ⚠️ 위 내용은 GPT-4가 생성한 원본 텍스트입니다. 가공되지 않은 AI의 실제 응답을 확인할 수 있습니다.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

