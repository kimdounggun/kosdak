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
  const [logoError, setLogoError] = useState(false)
  const [localLogoError, setLocalLogoError] = useState(false)
  
  // 로고 URL 우선순위: 1) 로컬 파일, 2) DB의 logoUrl, 3) fallback 아이콘
  // symbol.code 또는 symbolId.code 확인
  const symbolCode = symbol?.code || symbol?.symbolId?.code
  const localLogoUrl = symbolCode ? `/logos/${symbolCode}.png` : null
  const dbLogoUrl = symbol?.logoUrl || symbol?.symbolId?.logoUrl
  const logoUrl = localLogoUrl && !localLogoError ? localLogoUrl : (dbLogoUrl && !logoError ? dbLogoUrl : null)

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
      className="glass rounded-xl p-6 card-hover cursor-pointer relative"
    >
      {onDelete && userSymbolId && (
        <button
          onClick={handleDelete}
          className="absolute top-3 right-3 p-1.5 hover:bg-red-500/20 rounded-lg transition text-gray-400 hover:text-red-400 z-10"
          title="관심종목에서 제거"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={symbol.name}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-contain flex-shrink-0 bg-white/5 p-1"
              style={{ 
                imageRendering: '-webkit-optimize-contrast',
                width: 'auto',
                height: 'auto',
                maxWidth: '100%',
                maxHeight: '100%'
              }}
              loading="eager"
              onError={(e) => {
                // 로고 로드 실패 시 다음 우선순위로 시도
                console.error(`Logo load error for ${symbol?.name || symbol?.symbolId?.name}:`, {
                  attemptedUrl: logoUrl,
                  localLogoUrl,
                  dbLogoUrl,
                  symbolCode,
                  symbol: symbol
                })
                if (localLogoUrl && !localLogoError) {
                  console.warn(`Local logo failed, trying DB logo...`)
                  setLocalLogoError(true)
                } else if (dbLogoUrl && !logoError) {
                  console.warn(`DB logo failed, using fallback`)
                  setLogoError(true)
                }
              }}
              onLoad={() => {
                console.log(`✅ Logo loaded: ${symbol?.name || symbol?.symbolId?.name} - ${logoUrl}`)
              }}
            />
          ) : (
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm sm:text-base">
                {symbol.name.charAt(0)}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold truncate">{symbol.name}</h3>
            <p className="text-sm text-gray-400">
              {symbol.code} · {symbol.market}
            </p>
          </div>
        </div>
        {!onDelete && (
          <div className="flex-shrink-0 ml-2">
            {isUp && <TrendingUp className="w-5 h-5 text-success" />}
            {isDown && <TrendingDown className="w-5 h-5 text-danger" />}
            {!isUp && !isDown && <Minus className="w-5 h-5 text-gray-500" />}
          </div>
        )}
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


