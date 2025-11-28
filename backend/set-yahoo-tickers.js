const mongoose = require('mongoose');

// MongoDB 연결
const MONGODB_URI = 'mongodb+srv://rkadkrk321_db_user:5oNEb6JtTMQ7u8hn@kosdaq-cluster.8dqb3ev.mongodb.net/kosdak_bot?retryWrites=true&w=majority';

// 한국 주식 코드 -> Yahoo Finance 티커 매핑
const YAHOO_TICKER_MAP = {
  // 기존 종목 (11개)
  '950160': '950160.KQ',  // 코오롱티슈진
  '326030': '326030.KS',  // SK바이오팜 (KOSPI로 수정)
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
  
  // 추가 종목 - 대형주 (10개)
  '207940': '207940.KS',  // 삼성바이오로직스
  '068270': '068270.KS',  // LG전자
  '051910': '051910.KS',  // LG화학
  '006400': '006400.KS',  // 삼성SDI
  '028260': '028260.KS',  // 삼성물산
  '012330': '012330.KS',  // 현대모비스
  '003550': '003550.KS',  // LG
  '017670': '017670.KS',  // SK텔레콤
  '096770': '096770.KS',  // SK이노베이션
  '105560': '105560.KS',  // KB금융
  
  // 추가 종목 - 인기 중소형주 (10개)
  '247540': '247540.KQ',  // 에코프로비엠
  '086520': '086520.KQ',  // 에코프로
  '091990': '091990.KQ',  // 셀트리온헬스케어
  '068760': '068760.KQ',  // 셀트리온제약
  '196170': '196170.KQ',  // 알테오젠
  '145020': '145020.KQ',  // 휴젤
  '112040': '112040.KQ',  // 위메이드
  '263750': '263750.KQ',  // 펄어비스
  '357780': '357780.KQ',  // 솔브레인
  '039030': '039030.KQ',  // 이오테크닉스
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

