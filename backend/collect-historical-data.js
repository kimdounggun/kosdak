const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

// MongoDB 스키마
const candleSchema = new mongoose.Schema({
  symbolId: { type: mongoose.Schema.Types.ObjectId, ref: 'Symbol', required: true },
  timeframe: { type: String, required: true },
  timestamp: { type: Date, required: true },
  open: { type: Number, required: true },
  high: { type: Number, required: true },
  low: { type: Number, required: true },
  close: { type: Number, required: true },
  volume: { type: Number, default: 0 },
  sourceUpdatedAt: { type: Date, default: Date.now },
  isDelayed: { type: Boolean, default: true },
  delayMinutes: { type: Number, default: 20 },
}, { timestamps: true });

const Candle = mongoose.model('Candle', candleSchema);
const Symbol = mongoose.model('Symbol', {
  code: String,
  name: String,
  market: String,
  yahooTicker: String,
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchYahooData(yahooTicker, interval, range) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=${interval}&range=${range}`;
    console.log(`📡 Fetching ${yahooTicker} (${interval}, ${range})...`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const result = response.data.chart.result[0];
    const timestamps = result.timestamp;
    const quote = result.indicators?.quote?.[0];

    if (!timestamps || !quote) {
      console.log(`⚠️  No data for ${yahooTicker}`);
      return [];
    }

    const candles = [];
    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];
      const volume = quote.volume?.[i];

      if (ts && close !== null && close !== undefined) {
        candles.push({
          timestamp: new Date(ts * 1000),
          open: open !== null && open !== undefined ? open : close,
          high: high !== null && high !== undefined ? high : close,
          low: low !== null && low !== undefined ? low : close,
          close: close,
          volume: volume !== null && volume !== undefined ? volume : 0,
        });
      }
    }

    console.log(`✅ Fetched ${candles.length} candles for ${yahooTicker}`);
    return candles;
  } catch (error) {
    console.error(`❌ Error fetching ${yahooTicker}:`, error.message);
    return [];
  }
}

async function saveCandles(symbolId, timeframe, candles) {
  let savedCount = 0;
  let skippedCount = 0;

  for (const candle of candles) {
    try {
      // 중복 체크 및 저장
      const existing = await Candle.findOne({
        symbolId,
        timeframe,
        timestamp: candle.timestamp
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      await Candle.create({
        symbolId,
        timeframe,
        timestamp: candle.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        sourceUpdatedAt: new Date(),
        isDelayed: true,
        delayMinutes: 20,
      });

      savedCount++;
    } catch (error) {
      console.error(`Error saving candle:`, error.message);
    }
  }

  return { savedCount, skippedCount };
}

async function collectHistoricalData() {
  try {
    console.log('🚀 과거 데이터 수집 시작...\n');
    
    await mongoose.connect('mongodb+srv://rkadkrk321_db_user:5oNEb6JtTMQ7u8hn@kosdaq-cluster.8dqb3ev.mongodb.net/kosdak_bot?retryWrites=true&w=majority');
    console.log('✅ MongoDB 연결 성공\n');

    // 모든 종목 가져오기
    const allSymbols = await Symbol.find({
      yahooTicker: { $exists: true, $ne: null }
    });
    
    console.log(`📊 전체 종목: ${allSymbols.length}개`);
    console.log('\n종목 목록:');
    allSymbols.forEach(s => {
      console.log(`  - ${s.name} (${s.code}): yahooTicker = ${s.yahooTicker}`);
    });
    
    const symbols = allSymbols;
    console.log(`\n✅ 처리할 종목: ${symbols.length}개\n`);
    
    if (symbols.length === 0) {
      console.log('❌ yahooTicker가 설정된 종목이 없습니다!');
      console.log('💡 해결: seed 데이터를 다시 실행하거나 yahooTicker를 수동으로 설정하세요.\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    let totalSaved = 0;
    let totalSkipped = 0;

    for (const symbol of symbols) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📈 ${symbol.name} (${symbol.code})`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // 1. 5분봉 30일치 수집
      console.log('🕐 5분봉 30일치 수집 중...');
      const candles5m = await fetchYahooData(symbol.yahooTicker, '5m', '30d');
      if (candles5m.length > 0) {
        const result5m = await saveCandles(symbol._id, '5m', candles5m);
        console.log(`   저장: ${result5m.savedCount}개, 스킵: ${result5m.skippedCount}개`);
        totalSaved += result5m.savedCount;
        totalSkipped += result5m.skippedCount;
      }

      await sleep(1000); // API 제한 회피

      // 2. 일봉 1년치 수집
      console.log('📅 일봉 1년치 수집 중...');
      const candles1d = await fetchYahooData(symbol.yahooTicker, '1d', '1y');
      if (candles1d.length > 0) {
        const result1d = await saveCandles(symbol._id, '1d', candles1d);
        console.log(`   저장: ${result1d.savedCount}개, 스킵: ${result1d.skippedCount}개`);
        totalSaved += result1d.savedCount;
        totalSkipped += result1d.skippedCount;
      }

      await sleep(1000); // API 제한 회피
    }

    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 과거 데이터 수집 완료!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ 총 저장: ${totalSaved.toLocaleString()}개`);
    console.log(`⏭️  총 스킵: ${totalSkipped.toLocaleString()}개`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.disconnect();
    console.log('✅ MongoDB 연결 종료');
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

// 실행
collectHistoricalData();

