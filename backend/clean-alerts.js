const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://rkadkrk321_db_user:5oNEb6JtTMQ7u8hn@kosdaq-cluster.8dqb3ev.mongodb.net/kosdak_bot?retryWrites=true&w=majority';

async function cleanAlerts() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('MongoDB 연결 성공!');

        const db = client.db('kosdak_bot');

        // 알림 데이터 삭제
        const alertsResult = await db.collection('alerts').deleteMany({});
        console.log(`${alertsResult.deletedCount}개 알림 삭제됨`);

        // 알림 로그 삭제
        const alertLogsResult = await db.collection('alertlogs').deleteMany({});
        console.log(`${alertLogsResult.deletedCount}개 알림 로그 삭제됨`);

        console.log('\n✅ 기존 알림 데이터 정리 완료!');

    } catch (error) {
        console.error('에러:', error);
    } finally {
        await client.close();
    }
}

cleanAlerts();
