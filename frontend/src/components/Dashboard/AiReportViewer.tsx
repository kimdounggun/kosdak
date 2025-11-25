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

    // 텍스트 파싱: 번호 매기기 패턴(1., 2. 등)으로 분리
    const parseReport = (text: string) => {
        const lines = text.split('\n').filter(line => line.trim() !== '')
        const sections: { title: string; content: string; icon: any }[] = []
        let currentSection = { title: '', content: '', icon: Info }

        lines.forEach(line => {
            const match = line.match(/^(\d+)\.\s*(.*?)(?::|：)\s*(.*)/)

            if (match) {
                if (currentSection.title) {
                    sections.push(currentSection)
                }

                const title = match[2].trim()
                const content = match[3].trim()

                // 키워드 기반 아이콘 매핑
                let icon = Info
                if (title.includes('추세') || title.includes('강도')) icon = TrendingUp
                else if (title.includes('변동성')) icon = Activity
                else if (title.includes('수급') || title.includes('거래량')) icon = BarChart2
                else if (title.includes('지지') || title.includes('저항')) icon = Target
                else if (title.includes('전망') || title.includes('요약')) icon = CheckCircle2
                else if (title.includes('리스크') || title.includes('주의')) icon = AlertTriangle

                currentSection = { title, content, icon }
            } else {
                if (currentSection.title) {
                    currentSection.content += ' ' + line.trim()
                } else {
                    if (line.trim().length > 0) {
                        currentSection = { title: '시장 요약', content: line.trim(), icon: Info }
                    }
                }
            }
        })

        if (currentSection.title) {
            sections.push(currentSection)
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
                        <div className="bg-[#0D0D0D] px-8 py-6">
                            <div className="flex items-start gap-6">
                                {/* 아이콘 영역 - 얇은 라인으로 구분 */}
                                <div className="flex-shrink-0 pt-1">
                                    <div className="w-10 h-10 flex items-center justify-center">
                                        <Icon className="w-5 h-5 text-[#00E5A8]" />
                                    </div>
                                </div>
                                
                                {/* 콘텐츠 영역 */}
                                <div className="flex-1 min-w-0">
                                    {/* 타이틀 - Semi-Bold */}
                                    <h3 className="text-lg font-semibold text-white mb-4 tracking-tight">
                                        {institutionalTitle}
                                    </h3>
                                    
                                    {/* 내용 - Thin 폰트, 핵심 숫자 강조 */}
                                    <div className="text-[#CFCFCF] leading-relaxed text-base font-light">
                                        {highlightContent(section.content)}
                                    </div>
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
