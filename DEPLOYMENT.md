# 코스닥 봇 배포 가이드

## 목차
1. [백엔드 Railway 배포](#백엔드-railway-배포)
2. [프론트엔드 Netlify 배포](#프론트엔드-netlify-배포)
3. [환경변수 설정](#환경변수-설정)
4. [배포 후 확인사항](#배포-후-확인사항)

---

## 백엔드 Railway 배포

### 1단계: Railway 프로젝트 생성

1. [Railway](https://railway.app/)에 로그인
2. "New Project" 클릭
3. "Deploy from GitHub repo" 선택
4. 이 저장소 선택

### 2단계: 환경변수 설정

Railway 프로젝트 설정에서 다음 환경변수를 추가:

```env
# 필수 환경변수
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/kosdak-bot
JWT_SECRET=your-super-secret-jwt-key-here
OPENAI_API_KEY=sk-your-openai-api-key-here
FRONTEND_URL=https://your-app.netlify.app
PORT=3001
NODE_ENV=production

# 선택 환경변수 (Redis 사용 시)
REDIS_URL=redis://default:password@redis.railway.internal:6379
```

### 3단계: 빌드 설정

Railway는 자동으로 `railway.json` 파일을 감지합니다.

빌드 명령어:
```bash
cd backend && npm install && npm run build
```

시작 명령어:
```bash
cd backend && npm run start:prod
```

### 4단계: 배포 확인

- Railway 대시보드에서 로그 확인
- `https://your-backend.railway.app/api/docs`에서 Swagger 문서 확인

---

## 프론트엔드 Netlify 배포

### 1단계: Netlify 사이트 생성

1. [Netlify](https://www.netlify.com/)에 로그인
2. "Add new site" > "Import an existing project" 클릭
3. GitHub 저장소 연결

### 2단계: 빌드 설정

Netlify 설정에서 다음을 입력:

- **Base directory**: `frontend`
- **Build command**: `npm install && npm run build`
- **Publish directory**: `frontend/.next`
- **Node version**: `20`

또는 `netlify.toml` 파일이 자동으로 감지됩니다.

### 3단계: 환경변수 설정

Netlify 사이트 설정 > Environment variables에서:

```env
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

### 4단계: 배포 확인

- Netlify 대시보드에서 배포 로그 확인
- `https://your-app.netlify.app`에서 앱 확인

---

## 환경변수 설정

### Backend 환경변수 상세

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `MONGODB_URI` | MongoDB 연결 문자열 | `mongodb+srv://...` |
| `JWT_SECRET` | JWT 토큰 시크릿 키 | `random-secret-string` |
| `OPENAI_API_KEY` | OpenAI API 키 | `sk-...` |
| `FRONTEND_URL` | 프론트엔드 URL (CORS) | `https://app.netlify.app` |
| `PORT` | 서버 포트 | `3001` |
| `REDIS_URL` | Redis 연결 URL (선택) | `redis://...` |
| `NODE_ENV` | 실행 환경 | `production` |

### Frontend 환경변수 상세

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `NEXT_PUBLIC_API_URL` | 백엔드 API URL | `https://backend.railway.app` |

---

## 배포 후 확인사항

### 1. Backend 체크리스트

- [ ] API 문서 접근 가능: `https://backend-url/api/docs`
- [ ] MongoDB 연결 정상
- [ ] OpenAI API 연결 정상
- [ ] CORS 설정 확인 (Frontend URL 허용)
- [ ] 로그인/회원가입 작동 확인

### 2. Frontend 체크리스트

- [ ] 메인 페이지 로딩 확인
- [ ] API 연결 확인 (로그인 테스트)
- [ ] 주식 데이터 로딩 확인
- [ ] AI 분석 생성 확인
- [ ] 반응형 디자인 확인 (모바일/데스크톱)

### 3. 통합 테스트

1. **회원가입/로그인**
   ```bash
   curl -X POST https://backend-url/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.com","password":"test1234","name":"테스트"}'
   ```

2. **종목 조회**
   - Frontend에서 종목 검색
   - 차트 데이터 로딩 확인

3. **AI 분석 생성**
   - 종목 상세 페이지에서 AI 분석 생성
   - 분석 결과 확인

---

## Worker 설정 (Railway)

Railway에서 별도 Worker 프로세스를 실행하려면:

1. Railway 프로젝트에서 "New Service" 클릭
2. 같은 저장소 선택
3. 각 Worker별로 시작 명령어 설정:

**Candles Worker:**
```bash
cd backend && npm run worker:candles
```

**Alerts Worker:**
```bash
cd backend && npm run worker:alerts
```

**AI Report Worker:**
```bash
cd backend && npm run worker:ai
```

---

## 트러블슈팅

### Backend 빌드 오류

```bash
# Railway 콘솔에서
cd backend
npm install
npm run build
npm run start:prod
```

### Frontend 빌드 오류

```bash
# Netlify 콘솔에서
cd frontend
npm install
npm run build
```

### CORS 오류

Backend 환경변수 `FRONTEND_URL`이 올바른지 확인:
```env
FRONTEND_URL=https://your-exact-app.netlify.app
```

### MongoDB 연결 오류

1. MongoDB Atlas에서 IP Whitelist 확인
2. "Allow access from anywhere" (0.0.0.0/0) 설정
3. 연결 문자열 확인

---

## 유용한 명령어

### Railway CLI

```bash
# Railway CLI 설치
npm i -g @railway/cli

# 로그인
railway login

# 프로젝트 연결
railway link

# 로그 확인
railway logs

# 환경변수 설정
railway variables set MONGODB_URI=mongodb+srv://...
```

### Netlify CLI

```bash
# Netlify CLI 설치
npm i -g netlify-cli

# 로그인
netlify login

# 사이트 연결
netlify link

# 로컬 배포 테스트
netlify dev

# 수동 배포
netlify deploy --prod
```

---

## 배포 완료! 🎉

- **Frontend**: https://your-app.netlify.app
- **Backend**: https://your-backend.railway.app
- **API Docs**: https://your-backend.railway.app/api/docs

문제가 있으면 로그를 확인하고 환경변수가 올바르게 설정되었는지 확인하세요.









