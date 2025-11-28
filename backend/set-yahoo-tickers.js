const mongoose = require('mongoose');

// MongoDB 연결
const MONGODB_URI = 'mongodb+srv://rkadkrk321_db_user:5oNEb6JtTMQ7u8hn@kosdaq-cluster.8dqb3ev.mongodb.net/kosdak_bot?retryWrites=true&w=majority';

// 한국 주식 코드 -> Yahoo Finance 티커 매핑
const YAHOO_TICKER_MAP = {
  '950160': '950160.KQ',  // 코오롱티슈진
  '326030': '326030.KQ',  // SK바이오팜
  '372320': '372320.KQ',  // 큐로셀
  '298380': '298380.KQ',  // 에이비엘바이오
  '053030': '053030.KQ',  // 바이넥스
  '214320': '214320.KQ',  // 이노션
  '226950': '226950.KQ',  // 올릭스
  '005930': '005930.KS',  // 삼성전자
  '000660': '000660.KS',  // SK하이닉스
  '035420': '035420.KS',  // NAVER
  '035720': '035720.KS',  // 카카오
  '293490': '293490.KQ',  // 카카오게임즈
};

async function setYahooTickers() {
  try {
    console.log('🚀 Yahoo Ticker 설정 시작...\n');
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB 연결 성공\n');
    
    const Symbol = mongoose.connection.collection('symbols');
    
    let updated = 0;
    let skipped = 0;
    
    for (const [code, yahooTicker] of Object.entries(YAHOO_TICKER_MAP)) {
      const symbol = await Symbol.findOne({ code });
      
      if (!symbol) {
        console.log(`❌ ${code} (종목 없음)`);
        skipped++;
        continue;
      }
      
      const result = await Symbol.updateOne(
        { code },
        { $set: { yahooTicker } }
      );
      
      console.log(`✅ ${code} (${symbol.name}) -> ${yahooTicker} (이전: ${symbol.yahooTicker || 'NULL'})`);
      updated++;
    }
    
    console.log(`\n📊 결과:`);
    console.log(`  - 업데이트: ${updated}개`);
    console.log(`  - 스킵: ${skipped}개`);
    
    await mongoose.disconnect();
    console.log('\n✅ 완료!');
    
  } catch (error) {
    console.error('❌ 에러:', error);
    process.exit(1);
  }
}

setYahooTickers();

