# 🚗 최소 루트 최적화 시스템

카카오 지도 API를 활용한 최적 경로 계산 웹 애플리케이션입니다.

## ✨ 주요 기능

- **📍 주소 검색 및 추가**: 카카오 지도 API를 통한 정확한 주소 검색
- **🗺️ 실시간 지도 표시**: 추가된 주소들을 지도에 마커로 표시
- **🚀 경로 최적화**: TSP 알고리즘을 통한 최단 경로 계산
- **📊 결과 시각화**: 최적화된 경로를 지도에 선으로 표시
- **📱 반응형 디자인**: 모바일과 데스크톱 모두 지원

## 🛠️ 기술 스택

- **Frontend**: React 19.1.0
- **Build Tool**: Vite
- **스타일링**: Styled Components
- **지도 API**: 카카오맵 API
- **HTTP 클라이언트**: Axios

## 🔧 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 카카오 지도 API 키 설정
1. [카카오 개발자센터](https://developers.kakao.com/)에서 앱 생성
2. Web 플랫폼 등록 (도메인: `http://localhost:5173`)
3. `index.html`의 `YOUR_APP_KEY`를 발급받은 JavaScript 키로 변경

```html
<script type="text/javascript" src="//dapi.kakao.com/v2/maps/sdk.js?appkey=YOUR_APP_KEY&libraries=services"></script>
```

### 3. 개발 서버 실행
```bash
npm run dev
```

## 📖 사용 방법

1. **주소 입력**: 좌측 사이드바의 입력창에 방문하고 싶은 주소들을 하나씩 추가
2. **지도 확인**: 추가된 주소들이 지도에 마커로 표시되는 것을 확인
3. **알고리즘 선택**: 
   - Nearest Neighbor (빠른 계산)
   - 2-Opt Optimization (더 정확한 결과)
4. **경로 최적화 실행**: 버튼 클릭으로 최적 경로 계산
5. **결과 확인**: 지도에 표시된 최적 경로와 상세 정보 확인

## 🧮 알고리즘 설명

### Nearest Neighbor Algorithm
- 현재 위치에서 가장 가까운 미방문 지점을 선택
- 계산 속도가 빠름
- 시간복잡도: O(n²)

### 2-Opt Optimization
- Nearest Neighbor의 결과를 개선
- 교차하는 경로를 감지하여 개선
- 더 정확한 최적화 결과 제공

## 📁 프로젝트 구조

```
src/
├── components/
│   ├── KakaoMap.jsx        # 지도 컴포넌트
│   ├── AddressInput.jsx    # 주소 입력 컴포넌트
│   └── RouteOptimizer.jsx  # 경로 최적화 컴포넌트
├── App.jsx                 # 메인 앱 컴포넌트
├── main.jsx               # 앱 진입점
├── App.css                # 스타일
└── index.css              # 글로벌 스타일
```

## 🔮 향후 개발 계획

- [ ] 실제 도로 거리 계산 (카카오 길찾기 API)
- [ ] 교통상황 반영
- [ ] 경유지 시간 제한 설정
- [ ] 차량별 최적화 (도보, 자동차, 대중교통)
- [ ] 경로 저장/불러오기 기능
- [ ] 경로 공유 기능

## 📝 라이선스

MIT License

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

Made with ❤️ by DaSol Jeon
