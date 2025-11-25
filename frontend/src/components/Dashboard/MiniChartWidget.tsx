'use client'

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts'
import { ArrowUpRight, ArrowDownRight, MoreHorizontal } from 'lucide-react'

interface MiniChartWidgetProps {
    title: string
    type: 'area' | 'bar'
    data: any[]
    dataKey: string
    color: string
    trend?: number
    value?: string
    height?: number
}

export default function MiniChartWidget({
    title,
    type,
    data,
    dataKey,
    color,
    trend,
    value,
    height = 120
}: MiniChartWidgetProps) {

    const isUp = trend ? trend >= 0 : true

    return (
        <div className="bg-[#15171A]/80 backdrop-blur-sm border border-white/5 rounded-xl p-5 flex flex-col h-full relative overflow-hidden group hover:border-white/10 transition-colors">
            <div className="flex justify-between items-start mb-4 z-10">
                <div>
                    <h3 className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-1">{title}</h3>
                    {value && (
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-white tracking-tight">{value}</span>
                            {trend !== undefined && (
                                <div className={`flex items-center text-xs font-mono ${isUp ? 'text-[#00F0A8]' : 'text-[#FF4D4D]'}`}>
                                    {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                    {Math.abs(trend)}%
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <button className="text-gray-600 hover:text-white transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 w-full min-h-[100px] z-10">
                <ResponsiveContainer width="100%" height="100%">
                    {type === 'area' ? (
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey={dataKey}
                                stroke={color}
                                strokeWidth={2}
                                fill={`url(#gradient-${title})`}
                                isAnimationActive={true}
                            />
                        </AreaChart>
                    ) : (
                        <BarChart data={data}>
                            <Bar
                                dataKey={dataKey}
                                fill={color}
                                radius={[2, 2, 0, 0]}
                                isAnimationActive={true}
                            />
                        </BarChart>
                    )}
                </ResponsiveContainer>
            </div>

            {/* Background Grid Effect */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
        </div>
    )
}
