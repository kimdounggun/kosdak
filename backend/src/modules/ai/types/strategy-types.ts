/**
 * 투자 전략 생성 관련 타입 정의
 * Phase 1 리팩터링: 명확한 타입으로 결과값 추적
 */

/**
 * 전략 생성 출처
 */
export type StrategySource = 
  | 'ai'           // OpenAI로 생성된 프리미엄 전략
  | 'rule-based'   // 기술적 지표 기반 규칙 전략
  | 'fallback';    // 최소한의 기본 전략

/**
 * 전략 생성 결과
 */
export interface StrategyResult {
  success: boolean;
  strategy?: InvestmentStrategy;
  source: StrategySource;
  confidence: number; // 0-1 사이 (0.9: AI 성공, 0.6: 규칙 기반, 0.3: Fallback)
  metadata: StrategyMetadata;
  errors?: string[];
}

/**
 * 전략 메타데이터
 */
export interface StrategyMetadata {
  generationTime: number;      // 생성 소요 시간 (ms)
  aiModel?: string;             // 사용한 AI 모델 (예: gpt-4o-mini)
  tokensUsed?: number;          // 사용한 토큰 수
  ruleVersion?: string;         // 규칙 기반 전략 버전
  validationPassed: boolean;    // 검증 통과 여부
  validationErrors?: string[];  // 검증 실패 시 에러 목록
  attemptedSources: StrategySource[]; // 시도한 생성 방법들
}

/**
 * 투자 전략 구조 (Phase 1-3)
 */
export interface InvestmentStrategy {
  phase1: Phase1Strategy;
  phase2: Phase2Strategy;
  phase3: Phase3Strategy;
  // riskPlans 제거 (미사용 데이터)
}

/**
 * Phase 1: 초기 진입 전략
 */
export interface Phase1Strategy {
  entryRatio: number;          // 진입 비율 (25-40%)
  entryTiming: string;         // 진입 타이밍 설명
  reasoning: string;           // 4가지 근거 (기술적/추세/지지저항/거래량)
  stopLoss: StopLossInfo;
}

export interface StopLossInfo {
  price: number;
  percent: number;
  timing: string;
  reason: string;
}

/**
 * Phase 2: 시장 상황별 대응 전략
 */
export interface Phase2Strategy {
  bullish: ScenarioAction;     // 상승 시나리오
  sideways: ScenarioAction;    // 횡보 시나리오
  bearish: ScenarioAction;     // 하락 시나리오
}

export interface ScenarioAction {
  condition: string;           // 발동 조건
  action: string;              // 구체적 액션
  actionRatio?: number;        // 진입/청산 비율 (bullish/bearish만)
  exitRatio?: number;          // 청산 비율 (bearish만)
  reason: string;              // 근거
}

/**
 * Phase 3: 목표가 도달 시 전략
 */
export interface Phase3Strategy {
  target1: TargetAction;       // 1차 목표가
  target2: TargetAction;       // 2차 목표가
  additional?: string;         // 추가 전략 (선택)
}

export interface TargetAction {
  price: string;               // 목표가 (예: "50,000원")
  action: string;              // 구체적 액션
  exitRatio: number;           // 익절 비율 (30-100%)
  reason: string;              // 근거
}

/**
 * 리스크 플랜 (보수형/기본형/공격형)
 */
export interface RiskPlans {
  conservative: RiskPlan;
  basic: RiskPlan;
  aggressive: RiskPlan;
}

export interface RiskPlan {
  name: string;
  entryRatio: number;
  addRatio: number;
  stopLossPercent: number;
  expectedReturnMin: number;
  expectedReturnMax: number;
  comment: string;
}

/**
 * 전략 생성 컨텍스트 (입력 데이터)
 */
export interface StrategyGenerationContext {
  // 종목 정보
  symbol: {
    code: string;
    name: string;
    market: string;
  };
  
  // 가격 정보
  entryPrice: number;
  targetPrice1: number;
  targetPrice2: number;
  stopLossPrice: number;
  
  // 기술적 지표
  latestCandle: any;
  latestIndicator: any;
  candles: any[];
  
  // 투자 설정
  investmentPeriod: 'swing' | 'medium' | 'long';
  volatilityLevel: 'high' | 'medium' | 'low';
  
  // 과거 패턴 (선택)
  historicalContext?: any;
}

/**
 * 전략 검증 옵션
 */
export interface ValidationOptions {
  strictMode: boolean;         // 엄격 모드 (모든 필드 필수)
  autoFix: boolean;            // 자동 수정 시도
  logErrors: boolean;          // 에러 로깅
}

