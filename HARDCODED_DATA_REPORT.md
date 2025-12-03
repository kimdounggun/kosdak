# 하드코딩된 데이터 검토 보고서

## 🔴 심각: 보안 관련 하드코딩

### 1. MongoDB URI 하드코딩 (보안 위험!)
**위치**: 여러 스크립트 파일
- `backend/seed.js:3`
- `backend/set-yahoo-tickers.js:4`
- `backend/update-symbols.js:3`
- `backend/collect-historical-data.js:126`
- `backend/simulate-backtesting.js:217`
- `backend/src/seed-data.ts:3`
- `backend/clean-user-symbols.js:3`
- `backend/clean-alerts.js:3`
- `backend/clean-old-data.js:3`

**문제**: MongoDB 연결 문자열에 사용자명과 비밀번호가 하드코딩되어 있음
```javascript
const MONGODB_URI = 'mongodb+srv://rkadkrk321_db_user:5oNEb6JtTMQ7u8hn@kosdaq-cluster.8dqb3ev.mongodb.net/kosdak_bot?retryWrites=true&w=majority';
```

**해결책**: 환경변수 사용
```javascript
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kosdak-bot';
```

---

## 🟡 비즈니스 로직 하드코딩

### 2. AI 서비스 - 목표가 기본값
**위치**: `backend/src/modules/ai/ai.service.ts`

| 라인 | 하드코딩 값 | 설명 |
|------|------------|------|
| 279 | `entryPrice * 1.05` | 기본 1차 목표가 (+5%) |
| 280 | `entryPrice * 1.08` | 기본 2차 목표가 (+8%) |
| 322 | `6 * 60 * 60 * 1000` | 리포트 유효기간 6시간 |

**권장**: 설정 파일로 분리
```typescript
const DEFAULT_TARGET_PERCENT_1 = 5; // %
const DEFAULT_TARGET_PERCENT_2 = 8; // %
const REPORT_VALID_HOURS = 6;
```

### 3. AI 서비스 - 투자 기간별 목표/손절 비율
**위치**: `backend/src/modules/ai/ai.service.ts:400-425`

```typescript
const periodInfo = {
  swing: { 
    target1Percent: 3,    // 하드코딩
    target2Percent: 5,    // 하드코딩
    stoploss: '-3%'       // 하드코딩
  },
  medium: { 
    target1Percent: 10,   // 하드코딩
    target2Percent: 12,   // 하드코딩
    stoploss: '-5%'       // 하드코딩
  },
  long: { 
    target1Percent: 20,   // 하드코딩
    target2Percent: 30,    // 하드코딩
    stoploss: '-8%'       // 하드코딩
  }
};
```

**권장**: 설정 파일로 분리하여 관리

### 4. AI 서비스 - 신뢰도 계산 가중치
**위치**: `backend/src/modules/ai/ai.service.ts:157-238`

| 라인 | 하드코딩 값 | 설명 |
|------|------------|------|
| 158 | `0.5` | 기본 신뢰도 50% |
| 164 | `0.3` | 과거 정확도 가중치 30% |
| 168 | `0.05` | 샘플 수 >= 20일 때 보너스 |
| 174 | `0.15` | 캔들 100개 이상 가중치 |
| 176 | `0.08` | 캔들 50개 이상 가중치 |
| 188-190 | `70`, `30` | RSI 임계값 |
| 196 | `50` | MACD 차이 임계값 |
| 212 | `0.15` | 지표 일치도 가중치 |
| 220 | `0.1` | 거래량 급증 가중치 |
| 222 | `0.05` | 거래량 증가 가중치 |
| 230 | `0.15` | 변동성 높음 임계값 |
| 232 | `0.1` | 변동성 중간 임계값 |
| 231 | `-0.15` | 변동성 높음 패널티 |
| 233 | `-0.1` | 변동성 중간 패널티 |
| 238 | `0.35`, `0.95` | 신뢰도 최소/최대값 |

**권장**: 설정 객체로 분리
```typescript
const CONFIDENCE_CONFIG = {
  base: 0.5,
  weights: {
    historicalAccuracy: 0.3,
    dataQuality: { high: 0.15, medium: 0.08 },
    indicatorAgreement: 0.15,
    volume: { surge: 0.1, increase: 0.05 },
    volatility: { high: -0.15, medium: -0.1 }
  },
  thresholds: {
    rsi: { overbought: 70, oversold: 30 },
    macd: { significant: 50 },
    volatility: { high: 0.15, medium: 0.1 },
    sampleSize: { bonus: 20 }
  },
  bounds: { min: 0.35, max: 0.95 }
};
```

### 5. AI 서비스 - 프롬프트 내 임계값
**위치**: `backend/src/modules/ai/ai.service.ts:493-550`

| 라인 | 하드코딩 값 | 설명 |
|------|------------|------|
| 493 | `50%` | 성공률 낮음 기준 |
| 494 | `70%` | 성공률 높음 기준 |
| 536-538 | `30%`, `40%`, `30%` | 상승 확률 산출 가중치 |
| 542-544 | `70%`, `50%` | 리스크 레벨 판단 기준 |
| 547-550 | `70%`, `60%`, `50%` | 리스크 레벨 세부 기준 |

### 6. AI 서비스 - 파싱 실패 시 기본값
**위치**: `backend/src/modules/ai/ai.service.ts`

| 라인 | 하드코딩 값 | 설명 |
|------|------------|------|
| 1417 | `30` | 기본 진입비율 30% |
| 1418 | `'현재가 부근에서 분할 진입'` | 기본 진입타이밍 |
| 1489-1493 | Phase2 기본값 객체 | 파싱 실패 시 기본 시나리오 |
| 1555-1558 | Phase3 기본값 객체 | 파싱 실패 시 기본 목표가 |

### 7. AI 서비스 - 과거 패턴 분석 기간
**위치**: `backend/src/modules/ai/ai.service.ts`

| 라인 | 하드코딩 값 | 설명 |
|------|------------|------|
| 1042 | `30 * 24 * 60 * 60 * 1000` | 통계 조회 기간 30일 |
| 1062 | `30 * 24 * 60 * 60 * 1000` | 통계 조회 기간 30일 |
| 1226-1227 | `10` | RSI ±10 범위 |
| 1234 | `90 * 24 * 60 * 60 * 1000` | 과거 패턴 검색 기간 90일 |

### 8. AI 서비스 - OpenAI 설정
**위치**: `backend/src/modules/ai/ai.service.ts`

| 라인 | 하드코딩 값 | 설명 |
|------|------------|------|
| 133 | `'gpt-4o-mini'` | 모델명 |
| 144 | `0.5` | Temperature |
| 145 | `1500` | Max tokens |
| 153 | `'gpt-4o-mini-2024-07-18'` | 모델 버전 |

**권장**: 환경변수 또는 설정 파일로 분리

### 9. 프론트엔드 - Fallback 목표가
**위치**: `frontend/src/app/symbols/[id]/page.tsx`

| 라인 | 하드코딩 값 | 설명 |
|------|------------|------|
| 1230 | `currentPrice * 1.05` | Fallback 1차 목표가 (+5%) |
| 1231 | `currentPrice * 1.12` | Fallback 2차 목표가 (+12%) |
| 1232 | `currentPrice * 0.92` | Fallback 손절가 (-8%) |
| 1233 | `0.97`, `1.03` | 횡보 범위 |
| 1240 | `40%` | 기본 진입비율 |

---

## 🟢 허용 가능한 하드코딩

### 10. 예시 데이터 (UI/문서용)
- 전화번호 예시: `01012345678` (DTO 예시)
- 이는 문서/예시용이므로 문제 없음

### 11. 조건부 문자열 (비즈니스 로직)
- 액션 문자열: `'관망'`, `'매수'`, `'매도'` 등
- 이는 조건부 선택 로직이므로 허용 가능

---

## 📋 권장 개선 사항

### 우선순위 1 (보안): MongoDB URI
- 모든 스크립트에서 환경변수 사용
- `.env` 파일 또는 환경변수로 관리

### 우선순위 2 (유지보수): 비즈니스 로직 상수
- 설정 파일 생성: `backend/src/config/trading.config.ts`
- 투자 기간별 목표/손절 비율
- 신뢰도 계산 가중치
- AI 모델 설정

### 우선순위 3 (유연성): 기본값
- 파싱 실패 시 기본값을 설정 파일로 분리
- 프론트엔드 Fallback 값도 백엔드와 일치하도록

---

## 📝 요약

| 카테고리 | 개수 | 심각도 |
|---------|------|--------|
| 보안 관련 | 9개 파일 | 🔴 심각 |
| 비즈니스 로직 | 30+ 개 | 🟡 중간 |
| 기본값 | 10+ 개 | 🟡 중간 |
| 허용 가능 | 5+ 개 | 🟢 낮음 |

**총 하드코딩 발견**: 50+ 개




