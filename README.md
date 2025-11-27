# 🚀 코스닥 봇 - AI 주식 분석 플랫폼

스윙/중장기 투자자를 위한 프리미엄 AI 주식 분석 및 알림 플랫폼

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14.0-black)
![NestJS](https://img.shields.io/badge/NestJS-10.0-red)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)

## 📋 목차

- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [시작하기](#시작하기)
- [배포](#배포)
- [프로젝트 구조](#프로젝트-구조)
- [환경 변수](#환경-변수)
- [라이선스](#라이선스)

## ✨ 주요 기능

### 🤖 AI 분석
- **GPT-4 기반 종합 분석**: 기술적 지표와 시장 흐름을 종합한 AI 분석
- **투자 기간 맞춤 전략**: 단기 스윙(3~7일) / 중기(2~4주) / 장기(1~3개월)
- **시나리오 기반 전략**: 상승/횡보/하락 각 상황별 대응 전략 제시
- **실시간 신호 분석**: RSI, MACD, 이동평균선 등 6개 핵심 지표 추적

### 📊 차트 & 데이터
- **반응형 차트**: 데스크톱/모바일 최적화된 인터랙티브 차트
- **다양한 시간프레임**: 일별/주간/월간 뷰 지원
- **기술적 지표**: RSI, MACD, Stochastic, Bollinger Bands 등
- **거래량 분석**: 실시간 거래량 비교 및 트렌드 분석

### 🔔 알림 시스템
- **맞춤형 알림**: 가격, 거래량, 기술적 지표 기반 알림
- **다중 채널 지원**: 이메일, 웹훅, 텔레그램 (예정)
- **스마트 알림**: 중복 방지 및 우선순위 관리

### 📱 모바일 최적화
- **탭 기반 UI**: 모바일에서 차트/AI분석/지표를 탭으로 분리
- **터치 최적화**: 스와이프, 탭 등 터치 인터랙션 지원
- **반응형 디자인**: 모든 화면 크기에 최적화

## 🛠 기술 스택

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.3
- **Styling**: Tailwind CSS
- **Charts**: Recharts, Lightweight Charts
- **State Management**: Zustand
- **HTTP Client**: Axios
- **UI**: Lucide Icons, Framer Motion

### Backend
- **Framework**: NestJS 10
- **Language**: TypeScript 5.3
- **Database**: MongoDB (Mongoose)
- **Caching**: Redis (선택)
- **Authentication**: JWT, Passport
- **AI**: OpenAI GPT-4
- **Technical Analysis**: technicalindicators
- **API Docs**: Swagger/OpenAPI

### DevOps
- **Frontend Hosting**: Netlify
- **Backend Hosting**: Railway
- **Database**: MongoDB Atlas
- **Version Control**: Git, GitHub

## 🚀 시작하기

### 사전 요구사항

- Node.js 20+
- MongoDB (로컬 또는 MongoDB Atlas)
- OpenAI API 키
- npm 또는 yarn

### 설치

1. **저장소 클론**
```bash
git clone https://github.com/your-username/kosdak-bot.git
cd kosdak-bot
```

2. **Backend 설정**
```bash
cd backend
npm install

# 환경변수 설정
cat > .env << EOF
MONGODB_URI=mongodb://localhost:27017/kosdak-bot
JWT_SECRET=your-secret-key-here
OPENAI_API_KEY=sk-your-openai-key
FRONTEND_URL=http://localhost:3000
PORT=3001
NODE_ENV=development
EOF

# 빌드 및 실행
npm run build
npm run start:dev
```

3. **Frontend 설정**
```bash
cd frontend
npm install

# 환경변수 설정
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:3001
EOF

# 실행
npm run dev
```

4. **브라우저에서 확인**
- Frontend: http://localhost:3000
- Backend API Docs: http://localhost:3001/api/docs

### 초기 데이터 생성

```bash
cd backend
npm run seed
```

## 📦 배포

상세한 배포 가이드는 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참고하세요.

### 빠른 배포

1. **Backend (Railway)**
```bash
# Railway CLI 설치
npm i -g @railway/cli

# 로그인 및 배포
railway login
railway init
railway up
```

2. **Frontend (Netlify)**
```bash
# Netlify CLI 설치
npm i -g netlify-cli

# 로그인 및 배포
netlify login
netlify init
netlify deploy --prod
```

## 📁 프로젝트 구조

```
kosdak-bot/
├── frontend/                 # Next.js Frontend
│   ├── src/
│   │   ├── app/             # App Router 페이지
│   │   ├── components/      # React 컴포넌트
│   │   ├── lib/             # 유틸리티 함수
│   │   └── stores/          # Zustand 스토어
│   ├── public/              # 정적 파일
│   └── package.json
│
├── backend/                  # NestJS Backend
│   ├── src/
│   │   ├── modules/         # NestJS 모듈
│   │   │   ├── ai/          # AI 분석
│   │   │   ├── auth/        # 인증
│   │   │   ├── candles/     # 캔들 데이터
│   │   │   ├── symbols/     # 종목 관리
│   │   │   └── alerts/      # 알림
│   │   ├── schemas/         # MongoDB 스키마
│   │   ├── workers/         # 백그라운드 워커
│   │   └── main.ts
│   └── package.json
│
├── DEPLOYMENT.md            # 배포 가이드
├── README.md                # 이 파일
└── railway.json             # Railway 설정
```

## 🔧 환경 변수

### Backend (.env)
```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
OPENAI_API_KEY=sk-...
FRONTEND_URL=https://your-app.netlify.app
PORT=3001
NODE_ENV=production
REDIS_URL=redis://...  # 선택사항
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

## 📈 주요 기능 상세

### AI 분석 엔진
- **다층 분석**: 기술적 지표 + 추세 분석 + 거래량 분석
- **확률 기반 예측**: 상승/하락 확률을 정량적으로 제시
- **리스크 평가**: 낮음/중간/높음 3단계 리스크 레벨
- **맞춤형 전략**: 투자 기간에 따른 진입/청산 전략

### 실시간 데이터 수집
- **자동 수집**: 5분, 15분, 1시간 단위 자동 수집
- **지연 데이터**: 20분 지연 (법규 준수)
- **Worker 시스템**: 백그라운드에서 안정적 수집

## 🤝 기여

기여는 언제나 환영합니다!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참고하세요.

## 📞 문의

- 이메일: nkodfk321@naver.com
- 이슈: [GitHub Issues](https://github.com/your-username/kosdak-bot/issues)

## 🙏 감사의 말

- OpenAI GPT-4 API
- MongoDB Atlas
- Railway & Netlify
- Next.js & NestJS 커뮤니티

---

**⚠️ 면책 조항**: 본 서비스는 투자 참고용 정보 제공 목적으로, 투자 권유가 아닙니다. 모든 투자 결정과 그에 따른 손익은 투자자 본인의 책임입니다.
