const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://rkadkrk321_db_user:5oNEb6JtTMQ7u8hn@kosdaq-cluster.8dqb3ev.mongodb.net/kosdak_bot?retryWrites=true&w=majority';

const correctSymbols = [
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
];

async function updateSymbols() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('MongoDB 연결 성공!');

        const db = client.db('kosdak_bot');
        const symbolsCollection = db.collection('symbols');

        // 기존 종목 삭제
        const deleteResult = await symbolsCollection.deleteMany({});
        console.log(`${deleteResult.deletedCount}개 기존 종목 삭제됨`);

        // 새로운 종목 추가
        const insertResult = await symbolsCollection.insertMany(correctSymbols);
        console.log(`${insertResult.insertedCount}개 종목 추가 완료!`);

        // 추가된 종목 확인
        const symbols = await symbolsCollection.find({}).toArray();
        console.log('\n=== 업데이트된 종목 목록 ===');
        symbols.forEach(s => {
            console.log(`${s.market} ${s.code} - ${s.name}`);
        });

    } catch (error) {
        console.error('에러:', error);
    } finally {
        await client.close();
    }
}

updateSymbols();
