import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// 카카오 지도 JavaScript API Geocoder 사용
const searchAddressFromKakao = (query) => {
  return new Promise((resolve, reject) => {
    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
      reject(new Error('카카오 지도 API가 로드되지 않았습니다'));
      return;
    }

    const geocoder = new window.kakao.maps.services.Geocoder();
    
    geocoder.addressSearch(query, (result, status) => {
      if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
        const coords = result[0];
        resolve({
          address: coords.address_name || coords.road_address_name || query,
          lat: parseFloat(coords.y),
          lng: parseFloat(coords.x)
        });
      } else {
        // 키워드 검색도 시도
        const places = new window.kakao.maps.services.Places();
        places.keywordSearch(query, (result, status) => {
          if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
            const place = result[0];
            resolve({
              address: place.address_name || place.road_address_name || place.place_name,
              lat: parseFloat(place.y),
              lng: parseFloat(place.x)
            });
          } else {
            reject(new Error('주소를 찾을 수 없습니다'));
          }
        });
      }
    });
  });
};

// 추정 도로 경로 (직선 거리 + 도로 계수)
const getEstimatedRoute = (startAddr, endAddr) => {
  const R = 6371;
  const dLat = (endAddr.lat - startAddr.lat) * Math.PI / 180;
  const dLng = (endAddr.lng - startAddr.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(startAddr.lat * Math.PI / 180) * Math.cos(endAddr.lat * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const straightDistance = R * c;
  
  const roadDistance = straightDistance * 1.4;
  const estimatedDuration = roadDistance * 2;
  
  const path = [];
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    path.push({
      lat: startAddr.lat + (endAddr.lat - startAddr.lat) * ratio,
      lng: startAddr.lng + (endAddr.lng - startAddr.lng) * ratio
    });
  }
  
  return {
    distance: roadDistance,
    duration: estimatedDuration,
    path: path
  };
};

// 카카오 지도 컴포넌트
const KakaoMap = ({ addresses, startLocation, endLocation, isOptimized, optimizedDistance, routePaths }) => {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (window.kakao && window.kakao.maps) {
      const container = mapContainer.current;
      const options = {
        center: new window.kakao.maps.LatLng(37.5665, 126.9780),
        level: 8,
      };

      const map = new window.kakao.maps.Map(container, options);
      mapRef.current = map;
      setMapLoaded(true);

      const mapTypeControl = new window.kakao.maps.MapTypeControl();
      map.addControl(mapTypeControl, window.kakao.maps.ControlPosition.TOPRIGHT);

      const zoomControl = new window.kakao.maps.ZoomControl();
      map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);
    }
  }, []);

  useEffect(() => {
    if (mapRef.current && mapLoaded) {
      updateMarkers();
      if (isOptimized && addresses.length >= 0) {
        drawRoutes();
      } else {
        clearRoutes();
      }
    }
  }, [addresses, startLocation, endLocation, mapLoaded, isOptimized, routePaths]);

  const updateMarkers = () => {
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    const allPositions = [];
    
    // 출발지 마커
    if (startLocation) {
      const markerPosition = new window.kakao.maps.LatLng(startLocation.lat, startLocation.lng);
      allPositions.push(markerPosition);
      
      const imageSrc = `data:image/svg+xml;base64,${btoa(`
        <svg width="35" height="45" xmlns="http://www.w3.org/2000/svg">
          <circle cx="17.5" cy="17.5" r="15" fill="#28A745" stroke="white" stroke-width="3"/>
          <text x="17.5" y="25" text-anchor="middle" fill="white" font-size="16" font-weight="bold">S</text>
          <polygon points="17.5,30 10,42 25,42" fill="#28A745"/>
        </svg>
      `)}`;

      const imageSize = new window.kakao.maps.Size(35, 45);
      const imageOption = { offset: new window.kakao.maps.Point(17.5, 45) };
      const markerImage = new window.kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);

      const marker = new window.kakao.maps.Marker({
        position: markerPosition,
        image: markerImage,
        map: mapRef.current,
      });

      const infoContent = `
        <div style="padding:10px;font-size:13px;max-width:200px;text-align:center;">
          <strong style="color:#28A745;">🚩 출발지</strong><br/>
          ${startLocation.name || '출발지'}<br/>
          <small style="color:#666;">${startLocation.address}</small>
        </div>
      `;

      const infowindow = new window.kakao.maps.InfoWindow({ content: infoContent });
      window.kakao.maps.event.addListener(marker, 'click', () => {
        infowindow.open(mapRef.current, marker);
      });

      markersRef.current.push(marker);
    }

    // 경유지 마커들
    addresses.forEach((addr, index) => {
      const markerPosition = new window.kakao.maps.LatLng(addr.lat, addr.lng);
      allPositions.push(markerPosition);

      const imageSrc = `data:image/svg+xml;base64,${btoa(`
        <svg width="30" height="40" xmlns="http://www.w3.org/2000/svg">
          <circle cx="15" cy="15" r="12" fill="#FFC107" stroke="white" stroke-width="2"/>
          <text x="15" y="20" text-anchor="middle" fill="black" font-size="12" font-weight="bold">${index + 1}</text>
          <polygon points="15,25 10,35 20,35" fill="#FFC107"/>
        </svg>
      `)}`;

      const imageSize = new window.kakao.maps.Size(30, 40);
      const imageOption = { offset: new window.kakao.maps.Point(15, 40) };
      const markerImage = new window.kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);

      const marker = new window.kakao.maps.Marker({
        position: markerPosition,
        image: markerImage,
        map: mapRef.current,
      });

      const infoContent = `
        <div style="padding:8px;font-size:12px;max-width:200px;text-align:center;">
          <strong style="color:#FFC107;">📍 ${index + 1}번째 경유지</strong><br/>
          ${addr.name}<br/>
          <small style="color:#666;">${addr.address}</small>
        </div>
      `;

      const infowindow = new window.kakao.maps.InfoWindow({ content: infoContent });
      window.kakao.maps.event.addListener(marker, 'click', () => {
        infowindow.open(mapRef.current, marker);
      });

      markersRef.current.push(marker);
    });

    // 도착지 마커
    if (endLocation) {
      const markerPosition = new window.kakao.maps.LatLng(endLocation.lat, endLocation.lng);
      allPositions.push(markerPosition);
      
      const imageSrc = `data:image/svg+xml;base64,${btoa(`
        <svg width="35" height="45" xmlns="http://www.w3.org/2000/svg">
          <circle cx="17.5" cy="17.5" r="15" fill="#DC3545" stroke="white" stroke-width="3"/>
          <text x="17.5" y="25" text-anchor="middle" fill="white" font-size="16" font-weight="bold">E</text>
          <polygon points="17.5,30 10,42 25,42" fill="#DC3545"/>
        </svg>
      `)}`;

      const imageSize = new window.kakao.maps.Size(35, 45);
      const imageOption = { offset: new window.kakao.maps.Point(17.5, 45) };
      const markerImage = new window.kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);

      const marker = new window.kakao.maps.Marker({
        position: markerPosition,
        image: markerImage,
        map: mapRef.current,
      });

      const infoContent = `
        <div style="padding:10px;font-size:13px;max-width:200px;text-align:center;">
          <strong style="color:#DC3545;">🏁 도착지</strong><br/>
          ${endLocation.name || '도착지'}<br/>
          <small style="color:#666;">${endLocation.address}</small>
        </div>
      `;

      const infowindow = new window.kakao.maps.InfoWindow({ content: infoContent });
      window.kakao.maps.event.addListener(marker, 'click', () => {
        infowindow.open(mapRef.current, marker);
      });

      markersRef.current.push(marker);
    }

    // 지도 범위 조정
    if (allPositions.length > 0) {
      const bounds = new window.kakao.maps.LatLngBounds();
      allPositions.forEach(position => bounds.extend(position));
      mapRef.current.setBounds(bounds);
    }
  };

  const drawRoutes = () => {
    clearRoutes();

    const routeOrder = [];
    if (startLocation) routeOrder.push(startLocation);
    routeOrder.push(...addresses);
    if (endLocation) routeOrder.push(endLocation);

    if (routeOrder.length < 2) return;

    for (let i = 0; i < routeOrder.length - 1; i++) {
      const startAddr = routeOrder[i];
      const endAddr = routeOrder[i + 1];
      
      let pathPoints;
      if (routePaths && routePaths[i]) {
        pathPoints = routePaths[i].map(point => 
          new window.kakao.maps.LatLng(point.lat, point.lng)
        );
      } else {
        pathPoints = [
          new window.kakao.maps.LatLng(startAddr.lat, startAddr.lng),
          new window.kakao.maps.LatLng(endAddr.lat, endAddr.lng)
        ];
      }

      const polyline = new window.kakao.maps.Polyline({
        path: pathPoints,
        strokeWeight: 5,
        strokeColor: '#FF6B35',
        strokeOpacity: 0.8,
        strokeStyle: 'solid'
      });

      polyline.setMap(mapRef.current);
      polylinesRef.current.push(polyline);
    }
  };

  const clearRoutes = () => {
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    polylinesRef.current = [];
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '10px',
          overflow: 'hidden'
        }}
      />
      
      {isOptimized && optimizedDistance && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '15px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#333'
        }}>
          🎯 최적화 완료!<br/>
          📏 총 거리: {optimizedDistance}km<br/>
          ⏱️ 예상 시간: {Math.round(parseFloat(optimizedDistance) * 2)}분<br/>
          <small style={{ color: '#666', fontWeight: 'normal' }}>
            * 실제 도로 거리 추정값 (1.4배 적용)
          </small>
        </div>
      )}

      {!mapLoaded && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '10px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', color: '#666', marginBottom: '10px' }}>
              🗺️ 지도 로딩 중...
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  const [addresses, setAddresses] = useState([]);
  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);
  const [message, setMessage] = useState('');
  const [isOptimized, setIsOptimized] = useState(false);
  const [optimizedDistance, setOptimizedDistance] = useState(null);
  const [routePaths, setRoutePaths] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // 즐겨찾기 주소 관리 (빈 상태로 시작)
  const [favoriteAddresses, setFavoriteAddresses] = useState([]);
  const [showFavorites, setShowFavorites] = useState(false);

  const showMessage = (text, duration = 3000) => {
    setMessage(text);
    setTimeout(() => setMessage(''), duration);
  };

  // 즐겨찾기에 주소 추가
  const addToFavorites = async () => {
    if (!addressInput.trim()) {
      showMessage('주소를 입력해주세요.');
      return;
    }

    const favoriteName = nameInput.trim() || addressInput.trim();
    
    // 중복 체크
    if (favoriteAddresses.some(fav => fav.name === favoriteName)) {
      showMessage(`"${favoriteName}"은 이미 즐겨찾기에 있습니다.`);
      return;
    }

    setIsSearching(true);
    try {
      const result = await searchAddressFromKakao(addressInput.trim());
      
      const newFavorite = {
        id: `fav_${Date.now()}`,
        name: favoriteName,
        address: result.address,
        lat: result.lat,
        lng: result.lng
      };
      
      setFavoriteAddresses(prev => [...prev, newFavorite]);
      setAddressInput('');
      setNameInput('');
      showMessage(`"${favoriteName}"이 즐겨찾기에 추가되었습니다! ⭐`);
    } catch (error) {
      console.error('즐겨찾기 추가 에러:', error);
      showMessage(`주소 검색 실패: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  // 즐겨찾기에서 삭제
  const removeFromFavorites = (id) => {
    const favorite = favoriteAddresses.find(fav => fav.id === id);
    setFavoriteAddresses(prev => prev.filter(fav => fav.id !== id));
    showMessage(`"${favorite?.name}"이 즐겨찾기에서 삭제되었습니다.`);
  };

  // 즐겨찾기 주소 사용 (출발지)
  const useFavoriteAsStart = (favorite) => {
    setStartLocation({
      id: Date.now(),
      name: favorite.name,
      address: favorite.address,
      lat: favorite.lat,
      lng: favorite.lng
    });
    setIsOptimized(false);
    setOptimizedDistance(null);
    setRoutePaths([]);
    showMessage(`출발지가 "${favorite.name}"으로 설정되었습니다.`);
  };

  // 즐겨찾기 주소 사용 (경유지)
  const useFavoriteAsWaypoint = (favorite) => {
    if (addresses.some(addr => addr.name === favorite.name)) {
      showMessage(`"${favorite.name}"은 이미 경유지에 추가되었습니다.`);
      return;
    }

    const newAddress = {
      id: Date.now(),
      name: favorite.name,
      address: favorite.address,
      lat: favorite.lat,
      lng: favorite.lng
    };
    
    setAddresses(prev => [...prev, newAddress]);
    setIsOptimized(false);
    setOptimizedDistance(null);
    setRoutePaths([]);
    showMessage(`"${favorite.name}"이 경유지에 추가되었습니다!`);
  };

  // 즐겨찾기 주소 사용 (도착지)
  const useFavoriteAsEnd = (favorite) => {
    setEndLocation({
      id: Date.now(),
      name: favorite.name,
      address: favorite.address,
      lat: favorite.lat,
      lng: favorite.lng
    });
    setIsOptimized(false);
    setOptimizedDistance(null);
    setRoutePaths([]);
    showMessage(`도착지가 "${favorite.name}"으로 설정되었습니다.`);
  };

  // 주소 직접 입력해서 추가
  const addCustomAddress = async () => {
    if (!addressInput.trim()) {
      showMessage('주소를 입력해주세요.');
      return;
    }

    setIsSearching(true);
    console.log('주소 검색 시작:', addressInput.trim());
    
    try {
      const result = await searchAddressFromKakao(addressInput.trim());
      console.log('검색 결과:', result);
      
      const newAddress = {
        id: Date.now(),
        name: nameInput.trim() || addressInput.trim(),
        address: result.address,
        lat: result.lat,
        lng: result.lng
      };
      
      setAddresses(prev => [...prev, newAddress]);
      setAddressInput('');
      setNameInput('');
      setIsOptimized(false);
      setOptimizedDistance(null);
      setRoutePaths([]);
      showMessage(`"${newAddress.name}"이 경유지에 추가되었습니다!`);
    } catch (error) {
      console.error('주소 검색 에러:', error);
      showMessage(`주소 검색 실패: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  // 출발지 설정
  const setAsStartLocation = async () => {
    if (!addressInput.trim()) {
      showMessage('주소를 입력해주세요.');
      return;
    }

    setIsSearching(true);
    console.log('출발지 주소 검색 시작:', addressInput.trim());
    
    try {
      const result = await searchAddressFromKakao(addressInput.trim());
      console.log('출발지 검색 결과:', result);
      
      setStartLocation({
        id: Date.now(),
        name: nameInput.trim() || addressInput.trim(),
        address: result.address,
        lat: result.lat,
        lng: result.lng
      });
      
      setAddressInput('');
      setNameInput('');
      showMessage(`출발지가 설정되었습니다!`);
    } catch (error) {
      console.error('출발지 검색 에러:', error);
      showMessage(`출발지 검색 실패: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
    
    setIsOptimized(false);
    setOptimizedDistance(null);
    setRoutePaths([]);
  };

  // 도착지 설정
  const setAsEndLocation = async () => {
    if (!addressInput.trim()) {
      showMessage('주소를 입력해주세요.');
      return;
    }

    setIsSearching(true);
    console.log('도착지 주소 검색 시작:', addressInput.trim());
    
    try {
      const result = await searchAddressFromKakao(addressInput.trim());
      console.log('도착지 검색 결과:', result);
      
      setEndLocation({
        id: Date.now(),
        name: nameInput.trim() || addressInput.trim(),
        address: result.address,
        lat: result.lat,
        lng: result.lng
      });
      
      setAddressInput('');
      setNameInput('');
      showMessage(`도착지가 설정되었습니다!`);
    } catch (error) {
      console.error('도착지 검색 에러:', error);
      showMessage(`도착지 검색 실패: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
    
    setIsOptimized(false);
    setOptimizedDistance(null);
    setRoutePaths([]);
  };

  const removeAddress = (id) => {
    setAddresses(prev => prev.filter(addr => addr.id !== id));
    setIsOptimized(false);
    setOptimizedDistance(null);
    setRoutePaths([]);
    showMessage('경유지가 삭제되었습니다.');
  };

  const clearStartLocation = () => {
    setStartLocation(null);
    setIsOptimized(false);
    setOptimizedDistance(null);
    setRoutePaths([]);
    showMessage('출발지가 삭제되었습니다.');
  };

  const clearEndLocation = () => {
    setEndLocation(null);
    setIsOptimized(false);
    setOptimizedDistance(null);
    setRoutePaths([]);
    showMessage('도착지가 삭제되었습니다.');
  };

  const clearAllAddresses = () => {
    setAddresses([]);
    setIsOptimized(false);
    setOptimizedDistance(null);
    setRoutePaths([]);
    showMessage('모든 경유지가 삭제되었습니다.');
  };

  const clearAll = () => {
    setAddresses([]);
    setStartLocation(null);
    setEndLocation(null);
    setIsOptimized(false);
    setOptimizedDistance(null);
    setRoutePaths([]);
    showMessage('모든 지점이 삭제되었습니다.');
  };

  // 개선된 최적화 알고리즘
  const optimizeRoute = async () => {
    const totalLocations = (startLocation ? 1 : 0) + addresses.length + (endLocation ? 1 : 0);
    
    if (totalLocations < 2) {
      showMessage('최소 2개 이상의 지점이 필요합니다.');
      return;
    }

    if (addresses.length === 0) {
      showMessage('경유지가 필요합니다.');
      return;
    }

    setIsCalculating(true);
    showMessage('실제 도로 경로를 분석하고 있습니다...', 2000);

    try {
      const calculateRoadDistance = async (addr1, addr2) => {
        const route = await getEstimatedRoute(addr1, addr2);
        return route.distance;
      };

      const visited = new Array(addresses.length).fill(false);
      const optimizedOrder = [];
      let currentIndex = 0;
      let totalDistance = 0;
      const paths = [];

      if (startLocation) {
        let nearestIndex = 0;
        let nearestDistance = Infinity;
        
        for (let i = 0; i < addresses.length; i++) {
          const distance = await calculateRoadDistance(startLocation, addresses[i]);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = i;
          }
        }
        
        currentIndex = nearestIndex;
        visited[currentIndex] = true;
        optimizedOrder.push(addresses[currentIndex]);
        
        const routeInfo = await getEstimatedRoute(startLocation, addresses[currentIndex]);
        paths.push(routeInfo.path);
        totalDistance += nearestDistance;
      } else {
        visited[0] = true;
        optimizedOrder.push(addresses[0]);
        currentIndex = 0;
      }

      for (let i = (startLocation ? 1 : 1); i < addresses.length; i++) {
        let nearestIndex = -1;
        let nearestDistance = Infinity;

        for (let j = 0; j < addresses.length; j++) {
          if (!visited[j]) {
            const distance = await calculateRoadDistance(addresses[currentIndex], addresses[j]);
            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearestIndex = j;
            }
          }
        }

        if (nearestIndex !== -1) {
          visited[nearestIndex] = true;
          optimizedOrder.push(addresses[nearestIndex]);
          
          const routeInfo = await getEstimatedRoute(addresses[currentIndex], addresses[nearestIndex]);
          paths.push(routeInfo.path);
          
          totalDistance += nearestDistance;
          currentIndex = nearestIndex;
        }
      }

      if (endLocation) {
        const lastDistance = await calculateRoadDistance(addresses[currentIndex], endLocation);
        const routeInfo = await getEstimatedRoute(addresses[currentIndex], endLocation);
        paths.push(routeInfo.path);
        totalDistance += lastDistance;
      }

      setAddresses(optimizedOrder);
      setRoutePaths(paths);
      setIsOptimized(true);
      setOptimizedDistance(totalDistance.toFixed(2));
      showMessage(`🎯 경로 최적화 완료! 총 거리: ${totalDistance.toFixed(2)}km`);
    } catch (error) {
      console.error('최적화 오류:', error);
      showMessage('경로 최적화 중 오류가 발생했습니다.');
    } finally {
      setIsCalculating(false);
    }
  };

  const resetOptimization = () => {
    setIsOptimized(false);
    setOptimizedDistance(null);
    setRoutePaths([]);
    showMessage('최적화가 초기화되었습니다.');
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* 사이드바 */}
      <div style={{
        width: '450px',
        backgroundColor: '#ffffff',
        borderRight: '1px solid #e0e0e0',
        padding: '20px',
        overflowY: 'auto',
        boxShadow: '2px 0 10px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ 
          color: '#333', 
          marginBottom: '30px', 
          fontSize: '24px', 
          textAlign: 'center' 
        }}>
          🚗 스마트 루트 최적화
        </h1>
        
        {/* 주소 직접 입력 */}
        <div style={{ marginBottom: '25px' }}>
          <h3 style={{ 
            color: '#555', 
            marginBottom: '15px', 
            fontSize: '16px', 
            borderBottom: '2px solid #007bff', 
            paddingBottom: '5px' 
          }}>
            ✏️ 주소 직접 입력
          </h3>
          
          <div style={{ marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="장소명 (선택사항)"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                marginBottom: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            <input
              type="text"
              placeholder="주소를 입력하세요 (예: 서울시 강남구 테헤란로 123)"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCustomAddress()}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button
              onClick={() => setAsStartLocation()}
              disabled={isSearching || !addressInput.trim()}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (isSearching || !addressInput.trim()) ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                opacity: (isSearching || !addressInput.trim()) ? 0.6 : 1
              }}
            >
              🚩 출발지 설정
            </button>
            
            <button
              onClick={addCustomAddress}
              disabled={isSearching || !addressInput.trim()}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: '#ffc107',
                color: 'black',
                border: 'none',
                borderRadius: '4px',
                cursor: (isSearching || !addressInput.trim()) ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                opacity: (isSearching || !addressInput.trim()) ? 0.6 : 1
              }}
            >
              📍 경유지 추가
            </button>
            
            <button
              onClick={() => setAsEndLocation()}
              disabled={isSearching || !addressInput.trim()}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (isSearching || !addressInput.trim()) ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                opacity: (isSearching || !addressInput.trim()) ? 0.6 : 1
              }}
            >
              🏁 도착지 설정
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button
              onClick={addToFavorites}
              disabled={isSearching || !addressInput.trim()}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: '#6f42c1',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (isSearching || !addressInput.trim()) ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                opacity: (isSearching || !addressInput.trim()) ? 0.6 : 1
              }}
            >
              ⭐ 즐겨찾기 추가
            </button>
            
            <button
              onClick={() => setShowFavorites(!showFavorites)}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: showFavorites ? '#17a2b8' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {showFavorites ? '📝 입력창' : '⭐ 즐겨찾기'}
            </button>
          </div>
          
          {isSearching && (
            <div style={{ textAlign: 'center', color: '#666', fontSize: '12px' }}>
              🔍 주소 검색 중...
            </div>
          )}
        </div>

        {/* 즐겨찾기 목록 */}
        {showFavorites && (
          <div style={{ marginBottom: '25px' }}>
            <h3 style={{ 
              color: '#555', 
              marginBottom: '15px', 
              fontSize: '16px', 
              borderBottom: '2px solid #6f42c1', 
              paddingBottom: '5px' 
            }}>
              ⭐ 즐겨찾기 주소 ({favoriteAddresses.length}개)
            </h3>
            
            {favoriteAddresses.length === 0 ? (
              <p style={{ color: '#666', fontSize: '14px', fontStyle: 'italic', textAlign: 'center' }}>
                즐겨찾기가 없습니다. 자주 가는 주소를 추가해보세요!
              </p>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {favoriteAddresses.map((favorite) => (
                  <div key={favorite.id} style={{
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '10px',
                    backgroundColor: '#f8f9fa'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                          ⭐ {favorite.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {favorite.address}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromFavorites(favorite.id)}
                        style={{
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          marginLeft: '10px'
                        }}
                      >
                        삭제
                      </button>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => useFavoriteAsStart(favorite)}
                        style={{
                          flex: 1,
                          padding: '6px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        🚩 출발지
                      </button>
                      <button
                        onClick={() => useFavoriteAsWaypoint(favorite)}
                        style={{
                          flex: 1,
                          padding: '6px',
                          backgroundColor: '#ffc107',
                          color: 'black',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        📍 경유지
                      </button>
                      <button
                        onClick={() => useFavoriteAsEnd(favorite)}
                        style={{
                          flex: 1,
                          padding: '6px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        🏁 도착지
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 빠른 선택 (즐겨찾기에서만) */}
        {!showFavorites && favoriteAddresses.length > 0 && (
          <div style={{ marginBottom: '25px' }}>
            <h3 style={{ 
              color: '#555', 
              marginBottom: '15px', 
              fontSize: '16px', 
              borderBottom: '2px solid #28a745', 
              paddingBottom: '5px' 
            }}>
              📍 빠른 선택 (즐겨찾기)
            </h3>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: favoriteAddresses.length === 1 ? '1fr' : '1fr 1fr', 
              gap: '8px' 
            }}>
              {favoriteAddresses.map((favorite, index) => (
                <div key={favorite.id} style={{
                  border: '1px solid #dee2e6',
                  borderRadius: '5px',
                  padding: '8px',
                  backgroundColor: '#f8f9fa'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', textAlign: 'center' }}>
                    ⭐ {favorite.name}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => useFavoriteAsStart(favorite)}
                      style={{
                        flex: 1,
                        padding: '4px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '10px'
                      }}
                    >
                      🚩
                    </button>
                    <button
                      onClick={() => useFavoriteAsWaypoint(favorite)}
                      style={{
                        flex: 1,
                        padding: '4px',
                        backgroundColor: '#ffc107',
                        color: 'black',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '10px'
                      }}
                    >
                      📍
                    </button>
                    <button
                      onClick={() => useFavoriteAsEnd(favorite)}
                      style={{
                        flex: 1,
                        padding: '4px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '10px'
                      }}
                    >
                      🏁
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 즐겨찾기가 없고 입력창 모드일 때 안내 메시지 */}
        {!showFavorites && favoriteAddresses.length === 0 && (
          <div style={{ marginBottom: '25px' }}>
            <div style={{
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '2px dashed #dee2e6',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>⭐</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}>
                즐겨찾기가 없습니다
              </div>
              <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.4' }}>
                자주 가는 주소를 즐겨찾기에 추가하면<br/>
                빠른 선택으로 편리하게 사용할 수 있어요!
              </div>
              <button
                onClick={() => setShowFavorites(true)}
                style={{
                  marginTop: '15px',
                  padding: '8px 16px',
                  backgroundColor: '#6f42c1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              >
                ⭐ 즐겨찾기 보기
              </button>
            </div>
          </div>
        )}

        {/* 현재 설정된 지점들 */}
        <div style={{ marginBottom: '25px' }}>
          <h3 style={{ 
            color: '#555', 
            marginBottom: '15px', 
            fontSize: '16px', 
            borderBottom: '2px solid #17a2b8', 
            paddingBottom: '5px' 
          }}>
            🗺️ 설정된 지점들
          </h3>
          
          {/* 출발지 */}
          {startLocation && (
            <div style={{
              padding: '10px',
              margin: '5px 0',
              backgroundColor: '#e8f5e8',
              borderRadius: '5px',
              border: '2px solid #28a745',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '14px', flex: 1 }}>
                🚩 출발지: {startLocation.name}
              </span>
              <button
                onClick={clearStartLocation}
                style={{
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '5px 8px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                삭제
              </button>
            </div>
          )}
          
          {/* 경유지들 */}
          {addresses.length > 0 && (
            <>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>
                📍 경유지 ({addresses.length}개)
              </div>
              {addresses.map((addr, index) => (
                <div key={addr.id} style={{
                  padding: '8px',
                  margin: '3px 0',
                  backgroundColor: isOptimized ? '#fff3cd' : '#f8f9fa',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid #dee2e6'
                }}>
                  <span style={{ fontSize: '13px', flex: 1 }}>
                    {isOptimized ? `${index + 1}번째: ` : `${index + 1}. `}{addr.name}
                  </span>
                  <button
                    onClick={() => removeAddress(addr.id)}
                    style={{
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      padding: '3px 6px',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </>
          )}
          
          {/* 도착지 */}
          {endLocation && (
            <div style={{
              padding: '10px',
              margin: '5px 0',
              backgroundColor: '#ffeaea',
              borderRadius: '5px',
              border: '2px solid #dc3545',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '14px', flex: 1 }}>
                🏁 도착지: {endLocation.name}
              </span>
              <button
                onClick={clearEndLocation}
                style={{
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '5px 8px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                삭제
              </button>
            </div>
          )}
          
          {/* 지점이 없을 때 */}
          {!startLocation && addresses.length === 0 && !endLocation && (
            <p style={{ color: '#666', fontSize: '14px', fontStyle: 'italic', textAlign: 'center' }}>
              지점을 추가해보세요!
            </p>
          )}
          
          {/* 버튼들 */}
          <div style={{ marginTop: '15px', display: 'flex', gap: '8px' }}>
            {(startLocation || addresses.length > 0 || endLocation) && (
              <button
                onClick={clearAll}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                전체 삭제
              </button>
            )}
            
            {addresses.length > 0 && (
              <button
                onClick={clearAllAddresses}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: '#ffc107',
                  color: 'black',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                경유지만 삭제
              </button>
            )}
            
            {((startLocation || endLocation) && addresses.length >= 1) || addresses.length >= 2 ? (
              <button
                onClick={isOptimized ? resetOptimization : optimizeRoute}
                disabled={isCalculating}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: isCalculating ? '#6c757d' : (isOptimized ? '#17a2b8' : '#28a745'),
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isCalculating ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              >
                {isCalculating ? '🔄 계산중...' : (isOptimized ? '🔄 초기화' : '🚀 최적화')}
              </button>
            ) : null}
          </div>
        </div>

        {/* 메시지 */}
        {message && (
          <div style={{
            padding: '10px',
            backgroundColor: message.includes('오류') || message.includes('이미') || message.includes('찾을 수 없습니다') ? '#f8d7da' : 
                           message.includes('완료') || message.includes('추가') || message.includes('설정') || message.includes('삭제') ? '#d4edda' : '#fff3cd',
            color: message.includes('오류') || message.includes('이미') || message.includes('찾을 수 없습니다') ? '#721c24' : 
                   message.includes('완료') || message.includes('추가') || message.includes('설정') || message.includes('삭제') ? '#155724' : '#856404',
            borderRadius: '5px',
            fontSize: '13px',
            textAlign: 'center',
            marginBottom: '15px'
          }}>
            {message}
          </div>
        )}

        {/* 사용법 안내 */}
        <div style={{
          padding: '15px',
          backgroundColor: '#e3f2fd',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#1565c0',
          lineHeight: '1.6'
        }}>
          <strong>📖 사용법:</strong><br/>
          1. 주소 직접 입력 또는 빠른 선택<br/>
          2. ⭐ 즐겨찾기로 자주 가는 곳 저장<br/>
          3. 🚩 출발지 (선택사항)<br/>
          4. 📍 경유지 1개 이상 필수<br/>
          5. 🏁 도착지 (선택사항)<br/>
          6. 🚀 최적화로 경로 계산<br/>
          <small style={{ color: '#666' }}>
            * 도로 계수 1.4배 적용된 실제 거리 추정<br/>
            * 즐겨찾기는 브라우저 세션 동안만 유지됩니다
          </small>
        </div>
      </div>

      {/* 지도 영역 */}
      <div style={{
        flex: 1,
        position: 'relative',
        backgroundColor: '#f8f9fa',
        padding: '20px'
      }}>
        <div style={{
          height: '100%',
          backgroundColor: 'white',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <KakaoMap 
            addresses={addresses} 
            startLocation={startLocation}
            endLocation={endLocation}
            isOptimized={isOptimized}
            optimizedDistance={optimizedDistance}
            routePaths={routePaths}
          />
        </div>
      </div>
    </div>
  );
}

export default App;