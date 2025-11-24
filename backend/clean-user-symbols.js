const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://rkadkrk321_db_user:5oNEb6JtTMQ7u8hn@kosdaq-cluster.8dqb3ev.mongodb.net/kosdak_bot?retryWrites=true&w=majority';

async function cleanUserSymbols() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('MongoDB 연결 성공!');

        const db = client.db('kosdak_bot');

        // 모든 유효한 종목 ID 가져오기
        const symbols = await db.collection('symbols').find({}).toArray();
        const validSymbolIds = symbols.map(s => s._id);

        console.log(`유효한 종목 수: ${validSymbolIds.length}`);

        // 유효하지 않은 symbolId를 가진 user_symbols 삭제
        const result = await db.collection('usersymbols').deleteMany({
            symbolId: { $nin: validSymbolIds }
        });

        console.log(`${result.deletedCount}개 잘못된 사용자 종목 삭제됨`);

        // 남은 사용자 종목 확인
        const remainingUserSymbols = await db.collection('usersymbols').countDocuments();
        console.log(`남은 사용자 종목 수: ${remainingUserSymbols}`);

        console.log('\n✅ 사용자 종목 데이터 정리 완료!');

    } catch (error) {
        console.error('에러:', error);
    } finally {
        await client.close();
    }
}

cleanUserSymbols();
