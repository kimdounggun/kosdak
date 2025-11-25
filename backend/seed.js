const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://rkadkrk321_db_user:5oNEb6JtTMQ7u8hn@kosdaq-cluster.8dqb3ev.mongodb.net/kosdak_bot?retryWrites=true&w=majority';

const symbols = [
  { market: 'KOSDAQ', code: '900300', name: '코오롱티슈진', isActive: true, createdAt: new Date() },
  { market: 'KOSPI', code: '326030', name: 'SK바이오팜', isActive: true, createdAt: new Date() },
  { market: 'KOSDAQ', code: '011560', name: '큐로셀', isActive: true, createdAt: new Date() },
  { market: 'KOSDAQ', code: '298380', name: '에이비엘바이오', isActive: true, createdAt: new Date() },
  { market: 'KOSDAQ', code: '377740', name: '바이넥스', isActive: true, createdAt: new Date() },
  { market: 'KOSDAQ', code: '950140', name: '이노션', isActive: true, createdAt: new Date() },
  { market: 'KOSDAQ', code: '226330', name: '올릭스', isActive: true, createdAt: new Date() },
  { market: 'KOSPI', code: '005930', name: '삼성전자', isActive: true, createdAt: new Date() },
  { market: 'KOSPI', code: '000660', name: 'SK하이닉스', isActive: true, createdAt: new Date() },
  { market: 'KOSPI', code: '035420', name: 'NAVER', isActive: true, createdAt: new Date() },
  { market: 'KOSPI', code: '035720', name: '카카오', isActive: true, createdAt: new Date() },
  { market: 'KOSDAQ', code: '293490', name: '카카오게임즈', isActive: true, createdAt: new Date() },
];

async function seedData() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('MongoDB 연결 성공!');

    const db = client.db('kosdak_bot');
    const collection = db.collection('symbols');
    
    const count = await collection.countDocuments();
    console.log(`기존 종목 수: ${count}`);

    if (count === 0) {
      await collection.insertMany(symbols);
      console.log(`✅ ${symbols.length}개 종목 추가 완료!`);
    } else {
      console.log('⚠️  종목이 이미 존재합니다.');
    }
  } catch (error) {
    console.error('❌ 에러:', error);
  } finally {
    await client.close();
  }
}

seedData();


