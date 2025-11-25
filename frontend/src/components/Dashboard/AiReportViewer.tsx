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
import { motion } from 'framer-motion'

interface AiReportViewerProps {
    report: string
}

export default function AiReportViewer({ report }: AiReportViewerProps) {
    if (!report) return null

    // 1. 텍스트 파싱: 번호 매기기 패턴(1., 2. 등)으로 분리
    const parseReport = (text: string) => {
        // 줄바꿈으로 먼저 분리
        const lines = text.split('\n').filter(line => line.trim() !== '')

        const sections: { title: string; content: string; icon: any }[] = []
        let currentSection = { title: '', content: '', icon: Info }

        lines.forEach(line => {
            // 번호로 시작하는 라인 감지 (예: "1. 현재 추세 및 강도: ...")
            const match = line.match(/^(\d+)\.\s*(.*?)(?::|：)\s*(.*)/)

            if (match) {
                // 이전 섹션 저장
                if (currentSection.title) {
                    sections.push(currentSection)
                }

                // 새 섹션 시작
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
                // 번호가 없는 줄은 현재 섹션의 내용에 추가
                if (currentSection.title) {
                    currentSection.content += ' ' + line.trim()
                } else {
                    // 번호 없이 시작하는 첫 문단 처리 (개요 등)
                    if (line.trim().length > 0) {
                        currentSection = { title: 'AI 요약', content: line.trim(), icon: Info }
                    }
                }
            }
        })

        // 마지막 섹션 저장
        if (currentSection.title) {
            sections.push(currentSection)
        }

        return sections
    }

    const sections = parseReport(report)

    return (
        <div className="space-y-6">
            {sections.map((section, index) => {
                const Icon = section.icon
                return (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        key={index}
                        className="bg-[#0D0D0D] p-6 rounded-xl border border-white/10 hover:border-white/20 transition-colors group shadow-lg"
                    >
                        <div className="flex items-start gap-5">
                            <div className="p-4 rounded-lg bg-[#15171A] group-hover:bg-[#00E5A8]/20 transition-colors">
                                <Icon className="w-7 h-7 text-[#00E5A8] group-hover:text-[#00E5A8]" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#00E5A8] transition-colors">
                                    {section.title}
                                </h3>
                                <p className="text-[#CFCFCF] leading-relaxed text-base md:text-lg font-medium">
                                    {section.content}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )
            })}
        </div>
    )
}
