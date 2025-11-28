const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://rkadkrk321_db_user:5oNEb6JtTMQ7u8hn@kosdaq-cluster.8dqb3ev.mongodb.net/kosdak_bot?retryWrites=true&w=majority';

const correctSymbols = [
    // 기존 종목 (11개)
    { market: 'KOSDAQ', code: '950160', name: '코오롱티슈진', isActive: true },
    { market: 'KOSPI', code: '326030', name: 'SK바이오팜', isActive: true },
    { market: 'KOSDAQ', code: '372320', name: '큐로셀', isActive: true },
    { market: 'KOSDAQ', code: '298380', name: '에이비엘바이오', isActive: true },
    { market: 'KOSDAQ', code: '053030', name: '바이넥스', isActive: true },
    // { market: 'KOSDAQ', code: '214320', name: '이노션', isActive: true }, // Yahoo Finance 데이터 부족으로 제외
    { market: 'KOSDAQ', code: '226950', name: '올릭스', isActive: true },
    { market: 'KOSPI', code: '005930', name: '삼성전자', isActive: true },
    { market: 'KOSPI', code: '000660', name: 'SK하이닉스', isActive: true },
    { market: 'KOSPI', code: '035420', name: 'NAVER', isActive: true },
    { market: 'KOSPI', code: '035720', name: '카카오', isActive: true },
    { market: 'KOSDAQ', code: '293490', name: '카카오게임즈', isActive: true },
    
    // 추가 종목 - 대형주 (10개)
    { market: 'KOSPI', code: '207940', name: '삼성바이오로직스', isActive: true },
    { market: 'KOSPI', code: '068270', name: 'LG전자', isActive: true },
    { market: 'KOSPI', code: '051910', name: 'LG화학', isActive: true },
    { market: 'KOSPI', code: '006400', name: '삼성SDI', isActive: true },
    { market: 'KOSPI', code: '028260', name: '삼성물산', isActive: true },
    { market: 'KOSPI', code: '012330', name: '현대모비스', isActive: true },
    { market: 'KOSPI', code: '003550', name: 'LG', isActive: true },
    { market: 'KOSPI', code: '017670', name: 'SK텔레콤', isActive: true },
    { market: 'KOSPI', code: '096770', name: 'SK이노베이션', isActive: true },
    { market: 'KOSPI', code: '105560', name: 'KB금융', isActive: true },
    
    // 추가 종목 - 인기 중소형주 (10개)
    { market: 'KOSDAQ', code: '247540', name: '에코프로비엠', isActive: true },
    { market: 'KOSDAQ', code: '086520', name: '에코프로', isActive: true },
    { market: 'KOSDAQ', code: '091990', name: '셀트리온헬스케어', isActive: true },
    { market: 'KOSDAQ', code: '068760', name: '셀트리온제약', isActive: true },
    { market: 'KOSDAQ', code: '196170', name: '알테오젠', isActive: true },
    { market: 'KOSDAQ', code: '145020', name: '휴젤', isActive: true },
    { market: 'KOSDAQ', code: '112040', name: '위메이드', isActive: true },
    { market: 'KOSDAQ', code: '263750', name: '펄어비스', isActive: true },
    { market: 'KOSDAQ', code: '357780', name: '솔브레인', isActive: true },
    { market: 'KOSDAQ', code: '039030', name: '이오테크닉스', isActive: true },
];

async function updateSymbols() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('MongoDB 연결 성공!');

        const db = client.db('kosdak_bot');
        const symbolsCollection = db.collection('symbols');

        // ✅ 안전한 방법: upsert 사용 (삭제하지 않고 업데이트/추가)
        let updatedCount = 0;
        let insertedCount = 0;

        for (const symbol of correctSymbols) {
            const result = await symbolsCollection.updateOne(
                { code: symbol.code },
                { $set: symbol },
                { upsert: true }
            );
            
            if (result.upsertedCount > 0) {
                insertedCount++;
                console.log(`✅ 추가: ${symbol.name} (${symbol.code})`);
            } else if (result.modifiedCount > 0) {
                updatedCount++;
                console.log(`🔄 업데이트: ${symbol.name} (${symbol.code})`);
            }
        }

        console.log(`\n📊 결과: 추가 ${insertedCount}개, 업데이트 ${updatedCount}개`);

        // 최종 종목 확인
        const symbols = await symbolsCollection.find({}).toArray();
        console.log(`\n=== 전체 종목 수: ${symbols.length}개 ===`);

    } catch (error) {
        console.error('에러:', error);
    } finally {
        await client.close();
    }
}

updateSymbols();
