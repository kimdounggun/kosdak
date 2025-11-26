'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { TrendingUp, TrendingDown, Minus, X } from 'lucide-react'
import clsx from 'clsx'

interface SymbolCardProps {
  symbol: any
  onClick: () => void
  onDelete?: (userSymbolId: string) => void
  userSymbolId?: string
}

export default function SymbolCard({ symbol, onClick, onDelete, userSymbolId }: SymbolCardProps) {
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

  // symbol에서 직접 가격 정보 가져오기 (우선순위: symbol.priceChangePercent > latestCandle 계산)
  const priceChange = symbol?.priceChangePercent !== undefined 
    ? symbol.priceChangePercent 
    : (latestCandle
        ? ((latestCandle.close - latestCandle.open) / latestCandle.open) * 100
        : 0)
  
  const currentPrice = symbol?.currentPrice || (latestCandle ? latestCandle.close : 0)

  const isUp = priceChange > 0
  const isDown = priceChange < 0

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDelete && userSymbolId) {
      if (confirm(`${symbol?.name || symbol?.symbolId?.name}을(를) 관심종목에서 제거하시겠습니까?`)) {
        onDelete(userSymbolId)
      }
    }
  }

  return (
    <div
      onClick={onClick}
      className="glass rounded-lg p-2.5 sm:p-3 card-hover cursor-pointer relative"
    >
      {onDelete && userSymbolId && (
        <button
          onClick={handleDelete}
          className="absolute top-1.5 right-1.5 p-0.5 hover:bg-red-500/20 rounded transition text-gray-400 hover:text-red-400 z-10"
          title="제거"
        >
          <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </button>
      )}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 pr-1">
          <h3 className="text-sm font-bold truncate leading-tight">{symbol.name}</h3>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
            {symbol.code}
          </p>
        </div>
        {!onDelete && (
          <div className="flex-shrink-0">
            {isUp && <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success" />}
            {isDown && <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-danger" />}
            {!isUp && !isDown && <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500" />}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-1.5">
          <div className="h-5 bg-gray-700 rounded animate-pulse"></div>
          <div className="h-3 bg-gray-700 rounded w-1/2 animate-pulse"></div>
        </div>
      ) : currentPrice > 0 ? (
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-base sm:text-lg font-bold leading-tight">
              {currentPrice.toLocaleString()}
            </span>
            <span className="text-[10px] text-gray-400">원</span>
          </div>
          {priceChange !== 0 && (
            <div
              className={clsx('text-xs sm:text-sm font-semibold mt-0.5', {
                'text-success': isUp,
                'text-danger': isDown,
                'text-gray-400': !isUp && !isDown,
              })}
            >
              {isUp && '+'}
              {priceChange.toFixed(2)}%
            </div>
          )}
        </div>
      ) : (
        <div className="text-gray-400 text-[10px] sm:text-xs">데이터 없음</div>
      )}
    </div>
  )
}


