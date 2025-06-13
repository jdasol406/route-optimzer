import React, { useState } from 'react';
import styled from 'styled-components';

const InputContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Input = styled.input`
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 5px;
  font-size: 14px;
  transition: border-color 0.3s;

  &:focus {
    outline: none;
    border-color: #007bff;
  }
`;

const Button = styled.button`
  padding: 12px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;

  &:hover {
    background-color: #0056b3;
  }

  &:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: #dc3545;
  font-size: 12px;
  margin-top: 5px;
`;

const SuccessMessage = styled.div`
  color: #28a745;
  font-size: 12px;
  margin-top: 5px;
`;

const AddressInput = ({ onAddAddress }) => {
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
  };

  const searchAddress = async () => {
    if (!address.trim()) {
      showMessage('주소를 입력해주세요.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      // 카카오 지도 API를 사용한 주소 검색
      const geocoder = new window.kakao.maps.services.Geocoder();
      
      geocoder.addressSearch(address, (result, status) => {
        setIsLoading(false);
        
        if (status === window.kakao.maps.services.Status.OK) {
          const coordinate = {
            lat: parseFloat(result[0].y),
            lng: parseFloat(result[0].x)
          };
          
          onAddAddress(result[0].address_name, coordinate);
          setAddress('');
          showMessage('주소가 성공적으로 추가되었습니다!', 'success');
        } else {
          showMessage('주소를 찾을 수 없습니다. 정확한 주소를 입력해주세요.', 'error');
        }
      });
    } catch (error) {
      setIsLoading(false);
      showMessage('주소 검색 중 오류가 발생했습니다.', 'error');
      console.error('Address search error:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      searchAddress();
    }
  };

  return (
    <InputContainer>
      <Input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="예: 서울특별시 중구 세종대로 110 (서울시청)"
        disabled={isLoading}
      />
      <Button
        onClick={searchAddress}
        disabled={isLoading || !address.trim()}
      >
        {isLoading ? '검색 중...' : '📍 주소 추가'}
      </Button>
      
      {message && (
        messageType === 'success' ? 
        <SuccessMessage>{message}</SuccessMessage> : 
        <ErrorMessage>{message}</ErrorMessage>
      )}
      
      <div style={{ 
        fontSize: '12px', 
        color: '#6c757d', 
        marginTop: '5px',
        lineHeight: '1.4'
      }}>
        💡 팁: 도로명주소나 지번주소 모두 사용 가능합니다.<br/>
        예시: "강남역", "서울시청", "롯데타워" 등
      </div>
    </InputContainer>
  );
};

export default AddressInput;
