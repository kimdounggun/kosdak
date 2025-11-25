'use client'

import { ResponsiveContainer, LineChart, Line } from 'recharts'
import { ArrowUpRight, PieChart } from 'lucide-react'

export default function PortfolioWidget() {
    // Mock data for portfolio performance
    const data = [
        { value: 100 }, { value: 102 }, { value: 101 }, { value: 104 }, { value: 103 },
        { value: 106 }, { value: 108 }, { value: 107 }, { value: 110 }, { value: 112 }
    ]

    return (
        <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-5 h-full flex flex-col relative overflow-hidden group hover:border-white/10 transition-colors">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-1">Portfolio / Backtest Score</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white tracking-tight">84.2%</span>
                        <span className="text-xs font-mono text-[#00F0A8] bg-[#00F0A8]/10 px-1.5 py-0.5 rounded">WIN RATE</span>
                    </div>
                </div>
                <div className="p-2 bg-white/5 rounded-lg">
                    <PieChart className="w-4 h-4 text-gray-400" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <div className="text-[10px] text-gray-500 font-mono mb-1">PROFIT FACTOR</div>
                    <div className="text-lg font-bold text-white">2.45</div>
                </div>
                <div>
                    <div className="text-[10px] text-gray-500 font-mono mb-1">SHARPE RATIO</div>
                    <div className="text-lg font-bold text-white">1.82</div>
                </div>
                <div>
                    <div className="text-[10px] text-gray-500 font-mono mb-1">TOTAL TRADES</div>
                    <div className="text-lg font-bold text-white">1,240</div>
                </div>
                <div>
                    <div className="text-[10px] text-gray-500 font-mono mb-1">AVG RETURN</div>
                    <div className="text-lg font-bold text-[#00F0A8]">+12.4%</div>
                </div>
            </div>

            <div className="flex-1 w-full min-h-[60px] relative">
                <div className="absolute inset-0 bg-gradient-to-t from-[#00F0A8]/5 to-transparent"></div>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#00F0A8"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={true}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
