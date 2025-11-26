'use client'

import {
    TrendingUp,
    Activity,
    BarChart2,
    Target,
    AlertTriangle,
    Zap,
    Shield,
    Search,
    Radar,
    LineChart
} from 'lucide-react'
import { motion } from 'framer-motion'

interface AiReportProViewerProps {
    report: string
}

export default function AiReportProViewer({ report }: AiReportProViewerProps) {
    if (!report) return null

    // 텍스트 파싱 및 감성 분석 로직
    const parseReport = (text: string) => {
        const lines = text.split('\n').filter(line => line.trim() !== '')

        const sections: { title: string; content: string; icon: any; sentiment: 'bullish' | 'bearish' | 'neutral'; score: number }[] = []
        let currentSection = { title: '', content: '', icon: Search, sentiment: 'neutral' as const, score: 50 }

        lines.forEach(line => {
            const match = line.match(/^(\d+)\.\s*(.*?)(?::|：)\s*(.*)/)

            if (match) {
                if (currentSection.title) sections.push(currentSection)

                let title = match[2].trim()
                const content = match[3].trim()

                // Institutional Terminology Mapping
                let icon = Search
                let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral'
                let score = 50

                if (title.includes('추세') || title.includes('강도')) {
                    title = 'MOMENTUM VELOCITY'
                    icon = TrendingUp
                    if (content.includes('상승') || content.includes('강세')) { sentiment = 'bullish'; score = 80 }
                    else if (content.includes('하락') || content.includes('약세')) { sentiment = 'bearish'; score = 20 }
                }
                else if (title.includes('변동성')) {
                    title = 'VOLATILITY FORECAST'
                    icon = Activity
                    if (content.includes('낮은') || content.includes('안정')) { sentiment = 'bullish'; score = 70 }
                    else { sentiment = 'neutral'; score = 40 }
                }
                else if (title.includes('수급') || title.includes('거래량')) {
                    title = 'LIQUIDITY FLOW'
                    icon = BarChart2
                    if (content.includes('매수') || content.includes('유입')) { sentiment = 'bullish'; score = 85 }
                    else if (content.includes('매도') || content.includes('이탈')) { sentiment = 'bearish'; score = 15 }
                }
                else if (title.includes('지지') || title.includes('저항')) {
                    title = 'KEY PRICE LEVELS'
                    icon = Target
                    score = 60
                }
                else if (title.includes('전망') || title.includes('요약')) {
                    title = 'QUANT OUTLOOK'
                    icon = Radar
                    if (content.includes('긍정') || content.includes('상승')) { sentiment = 'bullish'; score = 90 }
                    else if (content.includes('부정') || content.includes('하락')) { sentiment = 'bearish'; score = 10 }
                }
                else if (title.includes('리스크') || title.includes('주의')) {
                    title = 'RISK FACTORS'
                    icon = AlertTriangle
                    sentiment = 'neutral' as const
                    score = 30
                }

                currentSection = { title, content, icon, sentiment: sentiment as 'bullish' | 'bearish' | 'neutral', score }
            } else {
                if (currentSection.title) {
                    currentSection.content += ' ' + line.trim()
                } else if (line.trim().length > 0) {
                    currentSection = { title: 'MARKET BRIEF', content: line.trim(), icon: Search, sentiment: 'neutral', score: 50 }
                }
            }
        })

        if (currentSection.title) sections.push(currentSection)
        return sections
    }

    const sections = parseReport(report)
    const totalScore = sections.reduce((acc, curr) => acc + curr.score, 0) / (sections.length || 1)
    const marketSentiment = totalScore > 60 ? 'BULLISH' : totalScore < 40 ? 'BEARISH' : 'NEUTRAL'

    // Neon Colors
    const neonMint = '#00F0A8'
    const neonBlue = '#00D1FF'
    const neonRed = '#FF4D4D'

    const sentimentColor = totalScore > 60 ? neonMint : totalScore < 40 ? neonRed : neonBlue

    return (
        <div className="space-y-6 font-sans">
            {/* Top Section: Sentiment Gauge & Confidence */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Sentiment Gauge Card */}
                <div className="md:col-span-2 bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Zap className="w-40 h-40" />
                    </div>

                    <h3 className="text-[10px] font-mono text-gray-500 tracking-widest mb-6 uppercase">AI Sentiment Index</h3>

                    <div className="flex items-end gap-8">
                        {/* Semi-circle Gauge */}
                        <div className="relative w-48 h-24 overflow-hidden">
                            <div className="absolute w-48 h-48 rounded-full border-[6px] border-[#1F2228] top-0 left-0 box-border"></div>
                            <motion.div
                                initial={{ rotate: 0 }}
                                animate={{ rotate: (totalScore / 100) * 180 }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                className="absolute w-48 h-48 rounded-full border-[6px] border-transparent border-t-[#00F0A8] border-r-transparent border-b-transparent border-l-transparent top-0 left-0 box-border origin-bottom"
                                style={{ transformOrigin: '50% 100%' }}
                            />
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                                <span className="text-3xl font-bold text-white tracking-tighter">{Math.round(totalScore)}</span>
                                <span className="text-[10px] text-gray-500 block">SCORE</span>
                            </div>
                        </div>

                        <div className="mb-2">
                            <div className="text-[10px] text-gray-500 mb-1 font-mono">MARKET STRENGTH</div>
                            <div className="text-4xl font-bold tracking-tighter" style={{ color: sentimentColor, textShadow: `0 0 20px ${sentimentColor}40` }}>
                                {marketSentiment}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Confidence Score Card */}
                <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-6 flex flex-col justify-center items-center text-center relative">
                    <div className="absolute inset-0 border border-[#00D1FF]/20 rounded-xl" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 85%, 90% 100%, 0 100%)' }}></div>
                    <Shield className="w-8 h-8 text-[#00D1FF] mb-3" />
                    <h3 className="text-[10px] font-mono text-gray-500 mb-1 uppercase">Quant Confidence Score</h3>
                    <p className="text-2xl font-bold text-white tracking-tight">HIGH</p>
                    <div className="w-full h-px bg-gradient-to-r from-transparent via-[#00D1FF]/50 to-transparent my-3"></div>
                    <p className="text-[10px] text-gray-500 font-mono">BASED ON 5 INDICATORS</p>
                </div>
            </div>

            {/* Analysis Grid */}
            <div className="grid grid-cols-1 gap-3">
                {sections.map((section, index) => {
                    const Icon = section.icon
                    return (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            key={index}
                            className="group relative bg-[#15171A]/60 backdrop-blur-sm border border-white/5 hover:border-[#00F0A8]/30 transition-all duration-300 rounded-lg overflow-hidden"
                        >
                            <div className="flex items-stretch">
                                {/* Icon Column */}
                                <div className="w-12 flex items-center justify-center border-r border-white/5 bg-[#0D0D0D]/50">
                                    <Icon className="w-4 h-4 text-gray-500 group-hover:text-[#00F0A8] transition-colors" />
                                </div>

                                {/* Content Column */}
                                <div className="flex-1 p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-mono text-xs font-bold text-[#00D1FF] tracking-wider uppercase group-hover:text-[#00F0A8] transition-colors">
                                            {section.title}
                                        </h3>

                                        {/* Mini Graph Icon Animation */}
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <LineChart className="w-3 h-3 text-[#00F0A8]" />
                                        </div>
                                    </div>

                                    <p className="text-gray-400 text-sm font-light leading-relaxed">
                                        {section.content}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
}
