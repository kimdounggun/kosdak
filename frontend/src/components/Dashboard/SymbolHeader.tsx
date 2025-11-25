'use client'

import { ArrowUpRight, ArrowDownRight, Activity, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'

interface SymbolHeaderProps {
    symbol: any
    quote: any
}

export default function SymbolHeader({ symbol, quote }: SymbolHeaderProps) {
    if (!symbol || !quote) return null

    const priceChange = quote.close - quote.open
    const priceChangePercent = (priceChange / quote.open) * 100
    const isUp = priceChange >= 0

    // Mock data for sparkline (replace with real data if available)
    const sparklinePoints = [
        40, 42, 41, 44, 43, 46, 45, 48, 50, 49, 52, 51, 54, 53, 55, 58, 57, 60, 59, 62
    ]
    const min = Math.min(...sparklinePoints)
    const max = Math.max(...sparklinePoints)
    const range = max - min
    const points = sparklinePoints.map((p, i) => {
        const x = (i / (sparklinePoints.length - 1)) * 100
        const y = 100 - ((p - min) / range) * 100
        return `${x},${y}`
    }).join(' ')

    return (
        <div className="w-full bg-[#15171A]/80 backdrop-blur-sm border-b border-white/5 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                {/* Left: Symbol Info & Price */}
                <div>
                    <div className="flex items-baseline gap-3 mb-1">
                        <h1 className="text-3xl font-bold text-white tracking-tight font-sans">
                            {symbol.name}
                        </h1>
                        <span className="text-sm font-mono text-gray-500">{symbol.code} · {symbol.market}</span>
                    </div>

                    <div className="flex items-end gap-4">
                        <span className="text-4xl font-mono font-light text-white tracking-tighter">
                            {quote.close.toLocaleString()}
                        </span>
                        <div className={`flex items-center gap-1 mb-1.5 font-mono text-sm ${isUp ? 'text-[#00F0A8]' : 'text-[#FF4D4D]'}`}>
                            {isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                            <span>{priceChange.toLocaleString()}</span>
                            <span>({priceChangePercent.toFixed(2)}%)</span>
                        </div>
                    </div>
                </div>

                {/* Right: Data Strip */}
                <div className="flex-1 w-full md:w-auto grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border border-white/5 rounded-lg overflow-hidden">
                    {/* High */}
                    <div className="bg-[#15171A] p-3 flex flex-col justify-between group hover:bg-white/[0.02] transition-colors">
                        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">High</span>
                        <div className="flex items-center justify-between mt-1">
                            <span className="font-mono text-sm text-gray-300">{quote.high.toLocaleString()}</span>
                            <ArrowUpRight className="w-3 h-3 text-gray-600 group-hover:text-[#00F0A8] transition-colors" />
                        </div>
                    </div>

                    {/* Low */}
                    <div className="bg-[#15171A] p-3 flex flex-col justify-between group hover:bg-white/[0.02] transition-colors">
                        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Low</span>
                        <div className="flex items-center justify-between mt-1">
                            <span className="font-mono text-sm text-gray-300">{quote.low.toLocaleString()}</span>
                            <ArrowDownRight className="w-3 h-3 text-gray-600 group-hover:text-[#FF4D4D] transition-colors" />
                        </div>
                    </div>

                    {/* Volume */}
                    <div className="bg-[#15171A] p-3 flex flex-col justify-between group hover:bg-white/[0.02] transition-colors relative overflow-hidden">
                        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold z-10 relative">Volume</span>
                        <div className="flex items-center justify-between mt-1 z-10 relative">
                            <span className="font-mono text-sm text-gray-300">{quote.volume.toLocaleString()}</span>
                        </div>
                        {/* Volume Bar Visualization */}
                        <div className="absolute bottom-0 left-0 h-1 bg-[#00D1FF]/20 w-full">
                            <div className="h-full bg-[#00D1FF]" style={{ width: '60%' }}></div>
                        </div>
                    </div>

                    {/* Trend Sparkline */}
                    <div className="bg-[#15171A] p-3 flex flex-col justify-between group hover:bg-white/[0.02] transition-colors relative">
                        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Trend</span>
                        <div className="h-6 w-full mt-1">
                            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                                <polyline
                                    points={points}
                                    fill="none"
                                    stroke={isUp ? '#00F0A8' : '#FF4D4D'}
                                    strokeWidth="2"
                                    vectorEffect="non-scaling-stroke"
                                />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
