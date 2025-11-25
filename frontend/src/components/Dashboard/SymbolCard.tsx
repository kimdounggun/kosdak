'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import clsx from 'clsx'

interface SymbolCardProps {
  symbol: any
  onClick: () => void
}

export default function SymbolCard({ symbol, onClick }: SymbolCardProps) {
  const [latestCandle, setLatestCandle] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!symbol || !symbol._id) {
      setLoading(false)
      return
    }
    loadLatestCandle()
  }, [symbol?._id])

  const loadLatestCandle = async () => {
    if (!symbol || !symbol._id) return

    try {
      const response = await api.get(`/symbols/${symbol._id}/candles/latest?timeframe=5m`)
      setLatestCandle(response.data)
    } catch (error) {
      console.error('Failed to load candle:', error)
    } finally {
      setLoading(false)
    }
  }

  // symbol이 없는 경우 처리
  if (!symbol || !symbol._id) {
    return (
      <div className="glass rounded-xl p-6">
        <div className="text-gray-400 text-sm">종목 정보를 불러올 수 없습니다</div>
      </div>
    )
  }

  const priceChange = latestCandle
    ? ((latestCandle.close - latestCandle.open) / latestCandle.open) * 100
    : 0

  const isUp = priceChange > 0
  const isDown = priceChange < 0

  return (
    <div
      onClick={onClick}
      className="glass rounded-xl p-6 card-hover cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold">{symbol.name}</h3>
          <p className="text-sm text-gray-400">
            {symbol.code} · {symbol.market}
          </p>
        </div>
        {isUp && <TrendingUp className="w-5 h-5 text-success" />}
        {isDown && <TrendingDown className="w-5 h-5 text-danger" />}
        {!isUp && !isDown && <Minus className="w-5 h-5 text-gray-500" />}
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-8 bg-gray-700 rounded animate-pulse"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2 animate-pulse"></div>
        </div>
      ) : latestCandle ? (
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold">
              {latestCandle.close.toLocaleString()}
            </span>
            <span className="text-sm text-gray-400">원</span>
          </div>
          <div
            className={clsx('text-sm font-semibold', {
              'text-success': isUp,
              'text-danger': isDown,
              'text-gray-400': !isUp && !isDown,
            })}
          >
            {isUp && '+'}
            {priceChange.toFixed(2)}%
          </div>
          <div className="mt-3 text-xs text-gray-500">
            거래량: {latestCandle.volume.toLocaleString()}
          </div>
        </div>
      ) : (
        <div className="text-gray-400 text-sm">데이터 없음</div>
      )}
    </div>
  )
}


