import { connect } from 'mongoose';

const MONGODB_URI = 'mongodb+srv://rkadkrk321_db_user:5oNEb6JtTMQ7u8hn@kosdaq-cluster.8dqb3ev.mongodb.net/kosdak_bot?retryWrites=true&w=majority';

const symbols = [
  { market: 'KOSDAQ', code: '950160', name: '코오롱티슈진', isActive: true },
  { market: 'KOSPI', code: '326030', name: 'SK바이오팜', isActive: true },
  { market: 'KOSDAQ', code: '372320', name: '큐로셀', isActive: true },
  { market: 'KOSDAQ', code: '298380', name: '에이비엘바이오', isActive: true },
  { market: 'KOSDAQ', code: '053030', name: '바이넥스', isActive: true },
  { market: 'KOSDAQ', code: '214320', name: '이노션', isActive: true },
  { market: 'KOSDAQ', code: '226950', name: '올릭스', isActive: true },
  { market: 'KOSPI', code: '005930', name: '삼성전자', isActive: true },
  { market: 'KOSPI', code: '000660', name: 'SK하이닉스', isActive: true },
  { market: 'KOSPI', code: '035420', name: 'NAVER', isActive: true },
  { market: 'KOSPI', code: '035720', name: '카카오', isActive: true },
  { market: 'KOSDAQ', code: '293490', name: '카카오게임즈', isActive: true },
];

async function seedData() {
  try {
    await connect(MONGODB_URI);
    console.log('MongoDB 연결 성공!');

    const db = (await import('mongoose')).connection.db;

    // 기존 데이터 확인
    const existingSymbols = await db.collection('symbols').countDocuments();
    console.log(`기존 종목 수: ${existingSymbols}`);

    if (existingSymbols === 0) {
      await db.collection('symbols').insertMany(symbols);
      console.log(`${symbols.length}개 종목 추가 완료!`);
    } else {
      console.log('종목이 이미 존재합니다.');
    }

    process.exit(0);
  } catch (error) {
    console.error('에러:', error);
    process.exit(1);
  }
}

seedData();



