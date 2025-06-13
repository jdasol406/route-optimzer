import React, { useEffect, useRef } from 'react';

const KakaoMap = ({ markers = [], optimizedRoute = [] }) => {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);

  useEffect(() => {
    // 카카오 지도 초기화
    if (window.kakao && window.kakao.maps) {
      initializeMap();
    } else {
      // 카카오 지도 API가 로드될 때까지 대기
      window.kakao.maps.load(initializeMap);
    }
  }, []);

  useEffect(() => {
    // 마커 업데이트
    if (mapRef.current) {
      updateMarkers();
    }
  }, [markers]);

  useEffect(() => {
    // 최적화된 루트 표시
    if (mapRef.current && optimizedRoute.length > 0) {
      drawOptimizedRoute();
    } else {
      clearRoute();
    }
  }, [optimizedRoute]);

  const initializeMap = () => {
    const container = mapContainer.current;
    const options = {
      center: new window.kakao.maps.LatLng(37.5665, 126.9780), // 서울 시청
      level: 8,
    };

    const map = new window.kakao.maps.Map(container, options);
    mapRef.current = map;

    // 지도 타입 컨트롤러 추가
    const mapTypeControl = new window.kakao.maps.MapTypeControl();
    map.addControl(mapTypeControl, window.kakao.maps.ControlPosition.TOPRIGHT);

    // 줌 컨트롤러 추가
    const zoomControl = new window.kakao.maps.ZoomControl();
    map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);
  };

  const updateMarkers = () => {
    // 기존 마커들 제거
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // 새 마커들 추가
    markers.forEach((markerData, index) => {
      const markerPosition = new window.kakao.maps.LatLng(
        markerData.position.lat,
        markerData.position.lng
      );

      const marker = new window.kakao.maps.Marker({
        position: markerPosition,
        map: mapRef.current,
      });

      // 마커에 인포윈도우 추가
      const infowindow = new window.kakao.maps.InfoWindow({
        content: `<div style=\"padding:5px;font-size:12px;width:200px;\">${index + 1}. ${markerData.content}</div>`,
      });

      // 마커 클릭시 인포윈도우 표시
      window.kakao.maps.event.addListener(marker, 'click', () => {
        infowindow.open(mapRef.current, marker);
      });

      markersRef.current.push(marker);
    });

    // 모든 마커가 보이도록 지도 범위 조정
    if (markers.length > 0) {
      const bounds = new window.kakao.maps.LatLngBounds();
      markers.forEach(markerData => {
        bounds.extend(new window.kakao.maps.LatLng(
          markerData.position.lat,
          markerData.position.lng
        ));
      });
      mapRef.current.setBounds(bounds);
    }
  };

  const drawOptimizedRoute = () => {
    if (optimizedRoute.length < 2) return;

    // 기존 경로 제거
    clearRoute();

    // 경로 좌표 배열 생성
    const linePath = optimizedRoute.map(addr => 
      new window.kakao.maps.LatLng(addr.coordinate.lat, addr.coordinate.lng)
    );

    // 선 그리기
    const polyline = new window.kakao.maps.Polyline({
      path: linePath,
      strokeWeight: 4,
      strokeColor: '#FF6B35',
      strokeOpacity: 0.8,
      strokeStyle: 'solid'
    });

    polyline.setMap(mapRef.current);
    polylineRef.current = polyline;

    // 마커 색상 업데이트 (최적화된 순서대로)
    updateOptimizedMarkers();
  };

  const updateOptimizedMarkers = () => {
    // 기존 마커 제거
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // 최적화된 순서로 마커 다시 생성
    optimizedRoute.forEach((addr, index) => {
      const markerPosition = new window.kakao.maps.LatLng(
        addr.coordinate.lat,
        addr.coordinate.lng
      );

      // 커스텀 마커 이미지 (순서 표시)
      const imageSrc = `data:image/svg+xml;base64,${btoa(`
        <svg width="40" height="50" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="18" fill="${index === 0 ? '#FF6B35' : index === optimizedRoute.length - 1 ? '#28A745' : '#007BFF'}" stroke="white" stroke-width="2"/>
          <text x="20" y="26" text-anchor="middle" fill="white" font-size="14" font-weight="bold">${index + 1}</text>
          <polygon points="20,35 15,45 25,45" fill="${index === 0 ? '#FF6B35' : index === optimizedRoute.length - 1 ? '#28A745' : '#007BFF'}"/>
        </svg>
      `)}`;

      const imageSize = new window.kakao.maps.Size(40, 50);
      const imageOption = { offset: new window.kakao.maps.Point(20, 50) };
      const markerImage = new window.kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);

      const marker = new window.kakao.maps.Marker({
        position: markerPosition,
        image: markerImage,
        map: mapRef.current,
      });

      // 인포윈도우
      const infowindow = new window.kakao.maps.InfoWindow({
        content: `<div style=\"padding:5px;font-size:12px;width:200px;\">
          <strong>${index + 1}번째 방문지</strong><br/>
          ${addr.address}
        </div>`,
      });

      window.kakao.maps.event.addListener(marker, 'click', () => {
        infowindow.open(mapRef.current, marker);
      });

      markersRef.current.push(marker);
    });
  };

  const clearRoute = () => {
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
  };

  return (
    <div
      ref={mapContainer}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative'
      }}
    >
      {/* 지도 로딩 중 표시 */}
      {!mapRef.current && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '18px',
          color: '#666'
        }}>
          🗺️ 지도를 로딩 중입니다...
        </div>
      )}
    </div>
  );
};

export default KakaoMap;
