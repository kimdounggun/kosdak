const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://rkadkrk321_db_user:5oNEb6JtTMQ7u8hn@kosdaq-cluster.8dqb3ev.mongodb.net/kosdak_bot?retryWrites=true&w=majority';

async function cleanOldData() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('MongoDB 연결 성공!');

        const db = client.db('kosdak_bot');

        // 캔들 데이터 삭제
        const candlesResult = await db.collection('candles').deleteMany({});
        console.log(`${candlesResult.deletedCount}개 캔들 데이터 삭제됨`);

        // 지표 데이터 삭제
        const indicatorsResult = await db.collection('indicators').deleteMany({});
        console.log(`${indicatorsResult.deletedCount}개 지표 데이터 삭제됨`);

        console.log('\n✅ 기존 데이터 정리 완료!');
        console.log('이제 백엔드가 자동으로 새로운 데이터를 수집합니다.');

    } catch (error) {
        console.error('에러:', error);
    } finally {
        await client.close();
    }
}

cleanOldData();
