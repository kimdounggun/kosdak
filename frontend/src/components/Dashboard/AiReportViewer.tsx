'use client'

import {
    TrendingUp,
    TrendingDown,
    Activity,
    BarChart2,
    Target,
    AlertTriangle,
    CheckCircle2,
    Info
} from 'lucide-react'

interface AiReportViewerProps {
    report: string
}

// 전문 용어 매핑 (한글)
const getInstitutionalTitle = (title: string): string => {
    if (title.includes('추세') || title.includes('강도')) return 'RSI 추세 및 강도 분석'
    if (title.includes('변동성')) return '변동성 분석'
    if (title.includes('수급') || title.includes('거래량')) return '수급 및 거래량 분석'
    if (title.includes('지지') || title.includes('저항')) return '주요 지지·저항 구간'
    if (title.includes('전망') || title.includes('요약')) return '정량적 전망 요약'
    if (title.includes('리스크') || title.includes('주의')) return '리스크 요인'
    return title
}

// 핵심 숫자와 키워드 추출 및 강조
const highlightContent = (content: string): JSX.Element => {
    // 숫자 패턴 (가격, 퍼센트, RSI 값 등)
    const numberPattern = /(\d{1,3}(?:,\d{3})*(?:\.\d+)?원?|\d+\.\d+%|\d+%)/g
    // 키워드 패턴 (BULLISH, BEARISH, NEUTRAL, 상승, 하락 등)
    const keywordPattern = /(BULLISH|BEARISH|NEUTRAL|상승|하락|중립|과매수|과매도|강세|약세)/gi
    
    const parts: (string | JSX.Element)[] = []
    let lastIndex = 0
    let key = 0

    // 숫자 강조
    let match
    const allMatches: Array<{ index: number; length: number; type: 'number' | 'keyword'; value: string }> = []
    
    while ((match = numberPattern.exec(content)) !== null) {
        allMatches.push({ index: match.index, length: match[0].length, type: 'number', value: match[0] })
    }
    
    while ((match = keywordPattern.exec(content)) !== null) {
        allMatches.push({ index: match.index, length: match[0].length, type: 'keyword', value: match[0] })
    }
    
    // 인덱스 순으로 정렬
    allMatches.sort((a, b) => a.index - b.index)
    
    // 중복 제거 및 병합
    const processedMatches: Array<{ start: number; end: number; type: 'number' | 'keyword'; value: string }> = []
    allMatches.forEach(match => {
        if (processedMatches.length === 0 || match.index >= processedMatches[processedMatches.length - 1].end) {
            processedMatches.push({
                start: match.index,
                end: match.index + match.length,
                type: match.type,
                value: match.value
            })
        }
    })
    
    processedMatches.forEach(match => {
        // 이전 텍스트 추가
        if (match.start > lastIndex) {
            parts.push(content.substring(lastIndex, match.start))
        }
        
        // 강조된 부분 추가
        const isBullish = /BULLISH|상승|강세/i.test(match.value)
        const isBearish = /BEARISH|하락|약세/i.test(match.value)
        const color = isBullish ? '#00E5A8' : isBearish ? '#FF4D4D' : '#00D1FF'
        
        parts.push(
            <span key={key++} className="font-semibold" style={{ color }}>
                {match.value}
            </span>
        )
        
        lastIndex = match.end
    })
    
    // 마지막 텍스트 추가
    if (lastIndex < content.length) {
        parts.push(content.substring(lastIndex))
    }
    
    return <>{parts.length > 0 ? parts : content}</>
}

export default function AiReportViewer({ report }: AiReportViewerProps) {
    if (!report) return null

    // 텍스트 파싱: 섹션을 순서대로 찾기 (현재는 1~4번 섹션)
    const parseReport = (text: string) => {
        const sections: { title: string; content: string; icon: any }[] = []
        
        // 1. 먼저 전체 텍스트에서 구분선 제거
        const cleanText = text.replace(/[━─=\-]{10,}/g, '').trim()
        
        // 2. 줄 단위로 분할
        const lines = cleanText.split('\n')
        
        // 섹션 번호를 순서대로 찾기 (1번부터 시작, 최대 10번까지)
        for (let i = 1; i <= 10; i++) {
            // "1. ", "2. " 등을 찾되, 앞뒤 공백 무시
            const headerPattern = new RegExp(`^\\s*${i}\\.\\s+(.+)$`)
            
            let startLine = -1
            let title = ''
            
            // 해당 번호의 섹션 찾기
            for (let j = 0; j < lines.length; j++) {
                const match = lines[j].match(headerPattern)
                if (match) {
                    startLine = j
                    // 이모지 및 특수문자 제거하여 제목만 추출
                    title = match[1]
                        .replace(/[\u{1F000}-\u{1FFFF}\u2600-\u27BF\uFE0F]/gu, '') // 이모지 제거
                        .replace(/🎯|📊|⚠️|💡|🔹|✅|❌|📌|📍/g, '') // 추가 이모지 제거
                        .trim()
                    break
                }
            }
            
            if (startLine >= 0) {
                // 다음 섹션까지의 내용 추출
                let endLine = lines.length
                for (let j = startLine + 1; j < lines.length; j++) {
                    // 다음 숫자 섹션 헤더를 찾으면 종료
                    if (/^\s*\d+\.\s+/.test(lines[j])) {
                        endLine = j
                        break
                    }
                }
                
                // 섹션 내용 추출 (빈 줄 제거하지 않고 유지)
                const content = lines.slice(startLine + 1, endLine)
                    .join('\n')
                    .trim()
                
                // 아이콘 매핑
                let icon = Info
                if (title.includes('추세') || title.includes('강도') || title.includes('시장') || title.includes('포지션')) {
                    icon = TrendingUp
                } else if (title.includes('변동성')) {
                    icon = Activity
                } else if (title.includes('수급') || title.includes('거래량') || title.includes('시그널') || title.includes('매매')) {
                    icon = BarChart2
                } else if (title.includes('지지') || title.includes('저항') || title.includes('투자') || title.includes('전략')) {
                    icon = Target
                } else if (title.includes('전망') || title.includes('요약')) {
                    icon = CheckCircle2
                } else if (title.includes('리스크') || title.includes('주의')) {
                    icon = AlertTriangle
                }
                
                if (content) {
                    sections.push({ title, content, icon })
                }
            }
        }
        
        // 섹션이 하나도 없으면 전체 텍스트를 하나의 섹션으로 처리
        if (sections.length === 0 && cleanText.trim()) {
            return [{ title: '시장 요약', content: cleanText.trim(), icon: Info }]
        }
        
        return sections
    }

    const sections = parseReport(report)

    return (
        <div className="space-y-0">
            {sections.map((section, index) => {
                const Icon = section.icon
                const institutionalTitle = getInstitutionalTitle(section.title)
                const isLast = index === sections.length - 1
                
                return (
                    <div key={index}>
                        <div className="glass-panel px-8 py-6">
                                {/* 콘텐츠 영역 */}
                                <div className="flex-1 min-w-0">
                                    {/* 타이틀 - Semi-Bold + 네온 언더라인 */}
                                    <div className="mb-4">
                                        <h3 className="text-lg font-semibold text-white tracking-tight inline-block">
                                            {institutionalTitle}
                                        </h3>
                                        <div className="h-px w-16 bg-[#00E5A8] mt-2"></div>
                                    </div>
                                    
                                    {/* 내용 - Thin 폰트, 핵심 숫자 강조 */}
                                    <div className="text-[#CFCFCF] leading-relaxed text-base font-light">
                                        {highlightContent(section.content)}
                                </div>
                            </div>
                        </div>
                        
                        {/* 얇은 구분선 - 마지막 섹션 제외 */}
                        {!isLast && (
                            <div className="h-px bg-[rgba(255,255,255,0.05)] mx-8"></div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
