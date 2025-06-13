import React, { useState } from 'react';
import styled from 'styled-components';

const OptimizeContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const Button = styled.button`
  padding: 15px;
  background-color: ${props => props.primary ? '#f0fdf4' : '#eff6ff'};
  color: ${props => props.primary ? '#16a34a' : '#2563eb'};
  border: 1px solid ${props => props.primary ? '#16a34a' : '#2563eb'};
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  transition: all 0.3s;

  &:hover {
    background-color: ${props => props.primary ? '#dcfce7' : '#dbeafe'};
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  &:disabled {
    background-color: #f9fafb;
    color: #6b7280;
    border-color: #6b7280;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const AlgorithmSelect = styled.select`
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 5px;
  font-size: 14px;
  background-color: white;

  &:focus {
    outline: none;
    border-color: #007bff;
  }
`;

const StatusMessage = styled.div`
  padding: 10px;
  border-radius: 5px;
  font-size: 14px;
  text-align: center;
  background-color: ${props => 
    props.type === 'loading' ? '#fff3cd' :
    props.type === 'success' ? '#d4edda' :
    props.type === 'error' ? '#f8d7da' : '#e2e3e5'
  };
  color: ${props => 
    props.type === 'loading' ? '#856404' :
    props.type === 'success' ? '#155724' :
    props.type === 'error' ? '#721c24' : '#495057'
  };
`;

const RouteOptimizer = ({ addresses, onRouteOptimized }) => {
  const [algorithm, setAlgorithm] = useState('nearest');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [status, setStatus] = useState('');

  // 두 점 사이의 직선 거리 계산 (Haversine 공식)
  const calculateDistance = (coord1, coord2) => {
    const R = 6371; // 지구 반지름 (km)
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // km
  };

  // 거리 행렬 생성
  const createDistanceMatrix = (addresses) => {
    const matrix = [];
    for (let i = 0; i < addresses.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < addresses.length; j++) {
        if (i === j) {
          matrix[i][j] = 0;
        } else {
          matrix[i][j] = calculateDistance(
            addresses[i].coordinate,
            addresses[j].coordinate
          );
        }
      }
    }
    return matrix;
  };

  // Nearest Neighbor 알고리즘
  const nearestNeighborTSP = (addresses) => {
    if (addresses.length <= 1) return { route: addresses, totalDistance: 0 };

    const n = addresses.length;
    const distanceMatrix = createDistanceMatrix(addresses);
    const visited = new Array(n).fill(false);
    const route = [];
    let currentCity = 0; // 첫 번째 주소부터 시작
    let totalDistance = 0;

    route.push(addresses[currentCity]);
    visited[currentCity] = true;

    for (let i = 1; i < n; i++) {
      let nearestCity = -1;
      let nearestDistance = Infinity;

      for (let j = 0; j < n; j++) {
        if (!visited[j] && distanceMatrix[currentCity][j] < nearestDistance) {
          nearestDistance = distanceMatrix[currentCity][j];
          nearestCity = j;
        }
      }

      visited[nearestCity] = true;
      route.push(addresses[nearestCity]);
      totalDistance += nearestDistance;
      currentCity = nearestCity;
    }

    return { route, totalDistance };
  };

  // 2-opt 알고리즘으로 개선
  const twoOptImprovement = (route, addresses) => {
    const n = route.length;
    const distanceMatrix = createDistanceMatrix(addresses);
    let improved = true;
    let bestRoute = [...route];
    let bestDistance = calculateTotalDistance(bestRoute, distanceMatrix);

    while (improved) {
      improved = false;
      
      for (let i = 1; i < n - 2; i++) {
        for (let j = i + 1; j < n; j++) {
          if (j - i === 1) continue; // 인접한 경우 건너뛰기
          
          // 2-opt swap
          const newRoute = [...bestRoute];
          const segment = newRoute.slice(i, j + 1).reverse();
          newRoute.splice(i, j - i + 1, ...segment);
          
          const newDistance = calculateTotalDistance(newRoute, distanceMatrix);
          
          if (newDistance < bestDistance) {
            bestRoute = newRoute;
            bestDistance = newDistance;
            improved = true;
          }
        }
      }
    }

    return { route: bestRoute, totalDistance: bestDistance };
  };

  const calculateTotalDistance = (route, distanceMatrix) => {
    let total = 0;
    const addressIndexMap = {};
    addresses.forEach((addr, index) => {
      addressIndexMap[addr.id] = index;
    });

    for (let i = 0; i < route.length - 1; i++) {
      const fromIndex = addressIndexMap[route[i].id];
      const toIndex = addressIndexMap[route[i + 1].id];
      total += distanceMatrix[fromIndex][toIndex];
    }
    return total;
  };

  const optimizeRoute = async () => {
    if (addresses.length < 2) {
      setStatus('최소 2개 이상의 주소가 필요합니다.');
      setTimeout(() => setStatus(''), 3000);
      return;
    }

    setIsOptimizing(true);
    setStatus('경로를 최적화하고 있습니다...');

    try {
      // 시뮬레이션된 지연 (실제 계산 시간)
      await new Promise(resolve => setTimeout(resolve, 1000));

      let result;
      
      if (algorithm === 'nearest') {
        result = nearestNeighborTSP(addresses);
      } else if (algorithm === '2opt') {
        const nearestResult = nearestNeighborTSP(addresses);
        result = twoOptImprovement(nearestResult.route, addresses);
      }

      const routeInfo = {
        totalDistance: `${result.totalDistance.toFixed(2)} km`,
        totalTime: `약 ${Math.round(result.totalDistance * 2)} 분`, // 평균 30km/h 가정
        algorithm: algorithm === 'nearest' ? 'Nearest Neighbor' : '2-Opt Optimization'
      };

      onRouteOptimized(result.route, routeInfo);
      setStatus('경로 최적화가 완료되었습니다!');
      setTimeout(() => setStatus(''), 3000);

    } catch (error) {
      console.error('Route optimization error:', error);
      setStatus('최적화 중 오류가 발생했습니다.');
      setTimeout(() => setStatus(''), 3000);
    } finally {
      setIsOptimizing(false);
    }
  };

  const resetRoute = () => {
    onRouteOptimized([], null);
    setStatus('경로가 초기화되었습니다.');
    setTimeout(() => setStatus(''), 2000);
  };

  return (
    <OptimizeContainer>
      <AlgorithmSelect
        value={algorithm}
        onChange={(e) => setAlgorithm(e.target.value)}
        disabled={isOptimizing}
      >
        <option value="nearest">Nearest Neighbor (빠름)</option>
        <option value="2opt">2-Opt Optimization (정확함)</option>
      </AlgorithmSelect>

      <Button
        primary
        onClick={optimizeRoute}
        disabled={isOptimizing || addresses.length < 2}
      >
        {isOptimizing ? '🔄 최적화 중...' : '🚀 경로 최적화 실행'}
      </Button>

      <Button
        onClick={resetRoute}
        disabled={isOptimizing}
      >
        🔄 경로 초기화
      </Button>

      {status && (
        <StatusMessage 
          type={isOptimizing ? 'loading' : status.includes('완료') ? 'success' : status.includes('오류') ? 'error' : 'info'}
        >
          {status}
        </StatusMessage>
      )}

      <div style={{
        fontSize: '12px',
        color: '#6c757d',
        lineHeight: '1.4',
        marginTop: '10px'
      }}>
        <strong>💡 알고리즘 설명:</strong><br/>
        • <strong>Nearest Neighbor:</strong> 가장 가까운 지점부터 방문 (빠른 계산)<br/>
        • <strong>2-Opt:</strong> 경로를 반복적으로 개선 (더 정확한 결과)
      </div>
    </OptimizeContainer>
  );
};

export default RouteOptimizer;
