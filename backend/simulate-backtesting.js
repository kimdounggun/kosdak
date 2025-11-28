const mongoose = require('mongoose');
const OpenAI = require('openai');
require('dotenv').config();

// MongoDB 스키마
const Symbol = mongoose.model('Symbol', {
  code: String,
  name: String,
  market: String,
});

const Candle = mongoose.model('Candle', {
  symbolId: mongoose.Schema.Types.ObjectId,
  timeframe: String,
  timestamp: Date,
  open: Number,
  high: Number,
  low: Number,
  close: Number,
  volume: Number,
});

const aiReportSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  symbolId: { type: mongoose.Schema.Types.ObjectId, required: true },
  timeframe: String,
  reportType: String,
  content: String,
  metadata: Object,
  analysisProcess: Object,
  explainability: Object,
  rawResponse: String,
  predictedAction: String,
  investmentPeriod: String,
  validUntil: Date,
  actualOutcome: {
    priceAfter24h: Number,
    priceChangePercent: Number,
    recordedAt: Date,
    wasCorrect: Boolean,
    correctnessScore: Number,
  },
}, { timestamps: true });

const AiReport = mongoose.model('AiReport', aiReportSchema);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(prices) {
  if (prices.length < 26) return { macd: 0, signal: 0 };

  const ema12 = prices.slice(-12).reduce((a, b) => a + b) / 12;
  const ema26 = prices.slice(-26).reduce((a, b) => a + b) / 26;
  const macd = ema12 - ema26;
  const signal = macd * 0.9; // 간단한 근사

  return { macd, signal };
}

async function getCandlesAt(symbolId, targetDate, timeframe = '1d') {
  const startDate = new Date(targetDate.getTime() - 60 * 24 * 60 * 60 * 1000); // 60일 전
  
  const candles = await Candle.find({
    symbolId,
    timeframe,
    timestamp: { $gte: startDate, $lte: targetDate }
  }).sort({ timestamp: 1 }).lean();

  return candles;
}

async function generateAIAnalysis(symbol, candles, targetDate) {
  if (candles.length < 20) {
    console.log(`   ⚠️  데이터 부족 (${candles.length}개)`);
    return null;
  }

  const prices = candles.map(c => c.close);
  const latestCandle = candles[candles.length - 1];
  
  const rsi = calculateRSI(prices);
  const { macd, signal } = calculateMACD(prices);
  const ma20 = prices.slice(-20).reduce((a, b) => a + b) / 20;

  const prompt = `당신은 금융 트레이딩 분석 모델입니다.

[종목 정보]
• 종목명: ${symbol.name} (${symbol.code})
• 현재가: ${latestCandle.close.toLocaleString()}원
• 거래량: ${latestCandle.volume.toLocaleString()}주

[기술적 지표]
• RSI(14): ${rsi.toFixed(2)}
• MACD: ${macd.toFixed(2)}
• Signal: ${signal.toFixed(2)}
• MA20: ${ma20.toFixed(0)}원

아래 형식으로 간단히 출력하세요:

1. 시장 포지션
[1-2문장]

2. 핵심 매매 시그널
- RSI: [판단]
- MACD: [판단]

3. 실전 투자 전략
권장 포지션: [강력 매수/매수/관망/주의/매도]
상승 확률: [X]% (근거: [간단히])
리스크 레벨: [낮음/중간/높음]

4. 정량적 전망 요약
[한 문장]`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '당신은 금융 트레이딩 분석 모델입니다.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 800,
    });

    const content = completion.choices[0].message.content || '';
    
    // 예측 액션 추출
    let predictedAction = '관망';
    const actionMatch = content.match(/권장 포지션:\s*\[?([^\]]+)\]?/);
    if (actionMatch) {
      predictedAction = actionMatch[1].trim();
    }

    return {
      content,
      predictedAction,
      metadata: {
        priceAtGeneration: latestCandle.close,
        rsiAtGeneration: rsi,
        macd,
        macdSignal: signal,
        candlesAnalyzed: candles.length,
        model: 'gpt-4o-mini',
      },
      createdAt: targetDate,
    };
  } catch (error) {
    console.error(`   ❌ OpenAI 오류:`, error.message);
    return null;
  }
}

async function checkOutcome(symbolId, targetDate, originalPrice, predictedAction) {
  const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
  
  const futureCandle = await Candle.findOne({
    symbolId,
    timeframe: '1d',
    timestamp: { $gte: nextDay, $lte: new Date(nextDay.getTime() + 24 * 60 * 60 * 1000) }
  }).sort({ timestamp: 1 }).lean();

  if (!futureCandle) {
    return null;
  }

  const priceChangePercent = ((futureCandle.close - originalPrice) / originalPrice) * 100;
  let wasCorrect = false;

  if (predictedAction.includes('매수')) {
    wasCorrect = priceChangePercent > 0;
  } else if (predictedAction.includes('매도') || predictedAction.includes('주의')) {
    wasCorrect = priceChangePercent <= 0;
  } else {
    wasCorrect = Math.abs(priceChangePercent) < 2;
  }

  return {
    priceAfter24h: futureCandle.close,
    priceChangePercent: parseFloat(priceChangePercent.toFixed(2)),
    recordedAt: new Date(),
    wasCorrect,
    correctnessScore: wasCorrect ? 100 : 0,
  };
}

async function simulateBacktesting() {
  try {
    console.log('🚀 백테스팅 시뮬레이션 시작...\n');
    
    await mongoose.connect('mongodb+srv://rkadkrk321_db_user:5oNEb6JtTMQ7u8hn@kosdaq-cluster.8dqb3ev.mongodb.net/kosdak_bot?retryWrites=true&w=majority');
    console.log('✅ MongoDB 연결 성공\n');

    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY가 설정되지 않았습니다!');
      process.exit(1);
    }

    // 모든 종목 처리
    const symbols = await Symbol.find({
      yahooTicker: { $exists: true, $ne: null }
    });
    
    console.log(`📊 전체 종목: ${symbols.length}개\n`);

    let totalGenerated = 0;
    let totalSuccess = 0;
    let totalCorrect = 0;

    // 과거 30일 시뮬레이션
    for (let daysAgo = 30; daysAgo >= 2; daysAgo--) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - daysAgo);
      targetDate.setHours(15, 0, 0, 0); // 오후 3시

      console.log(`\n📅 ${targetDate.toLocaleDateString('ko-KR')} (${daysAgo}일 전)`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      for (const symbol of symbols) {
        // 1. 그 시점의 캔들 데이터 가져오기
        const candles = await getCandlesAt(symbol._id, targetDate, '1d');
        
        if (candles.length < 20) {
          console.log(`   ${symbol.name}: 데이터 부족 스킵`);
          continue;
        }

        // 2. AI 분석 생성
        const analysis = await generateAIAnalysis(symbol, candles, targetDate);
        
        if (!analysis) {
          continue;
        }

        // 3. 24시간 후 결과 확인
        const outcome = await checkOutcome(
          symbol._id,
          targetDate,
          analysis.metadata.priceAtGeneration,
          analysis.predictedAction
        );

        if (!outcome) {
          console.log(`   ${symbol.name}: ${analysis.predictedAction} (결과 없음)`);
          continue;
        }

        // 4. 저장
        await AiReport.create({
          symbolId: symbol._id,
          timeframe: '1d',
          reportType: 'comprehensive',
          content: analysis.content,
          metadata: analysis.metadata,
          predictedAction: analysis.predictedAction,
          investmentPeriod: 'swing',
          validUntil: new Date(targetDate.getTime() + 6 * 60 * 60 * 1000),
          actualOutcome: outcome,
          createdAt: targetDate,
          updatedAt: targetDate,
        });

        totalGenerated++;
        totalSuccess++;
        if (outcome.wasCorrect) totalCorrect++;

        const icon = outcome.wasCorrect ? '✅' : '❌';
        console.log(`   ${icon} ${symbol.name}: ${analysis.predictedAction} → ${outcome.priceChangePercent >= 0 ? '+' : ''}${outcome.priceChangePercent}%`);

        await sleep(500); // API 제한 회피
      }

      // 진행 상황
      if (totalGenerated > 0) {
        const accuracy = (totalCorrect / totalGenerated * 100).toFixed(1);
        console.log(`\n   📊 현재까지: ${totalGenerated}개 생성, 정확도 ${accuracy}%`);
      }
    }

    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 백테스팅 시뮬레이션 완료!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ 총 생성: ${totalGenerated}개`);
    console.log(`✅ 백테스팅 완료: ${totalSuccess}개`);
    console.log(`✅ 정확한 예측: ${totalCorrect}개`);
    console.log(`📊 최종 정확도: ${totalSuccess > 0 ? (totalCorrect / totalSuccess * 100).toFixed(1) : 0}%`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.disconnect();
    console.log('✅ MongoDB 연결 종료');
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

// 실행
simulateBacktesting();

