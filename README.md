# Kosdak Bot

한국 주식 AI 분석 & 알림 플랫폼

## 실행

```bash
# 1. MongoDB 설치 및 실행 (로컬)
# Windows: https://www.mongodb.com/try/download/community
# Mac: brew install mongodb-community && brew services start mongodb-community

# 2. 패키지 설치
npm install

# 3. 환경 변수 설정
cp backend/.env.example backend/.env
# backend/.env 파일에서 MONGODB_URI와 JWT_SECRET 설정

# 4. 실행 (백엔드+프론트엔드 동시)
npm run dev
```

접속: http://localhost:3000

## 기술 스택

- Backend: NestJS + MongoDB
- Frontend: Next.js + TailwindCSS  
- AI: OpenAI GPT-4
