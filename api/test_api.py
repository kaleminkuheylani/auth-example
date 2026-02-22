#!/usr/bin/env python3
"""Test API endpoints without DeepFace dependency"""

import sys
import os

# Mock DeepFace before importing main
class MockDeepFace:
    @staticmethod
    def analyze(*args, **kwargs):
        return [{'face_confidence': 0.95}]
    @staticmethod
    def represent(*args, **kwargs):
        return [{'embedding': [0.1]*128}]
    @staticmethod
    def verify(*args, **kwargs):
        return {'verified': True, 'distance': 0.2}

# Inject mock
import types
mock_deepface = types.ModuleType('deepface')
mock_deepface.DeepFace = MockDeepFace
sys.modules['deepface'] = mock_deepface

from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def run_tests():
    print('=' * 60)
    print('FACE AUTH API - TEST SUITE')
    print('=' * 60)
    
    # Test 1: Health check
    print('\n=== Test 1: Health Check ===')
    r = client.get('/api/health')
    print(f'Status: {r.status_code}')
    print(f'Response: {r.json()}')
    assert r.status_code == 200, "Health check failed"
    
    # Test 2: Root endpoint
    print('\n=== Test 2: Root Endpoint ===')
    r = client.get('/')
    print(f'Status: {r.status_code}')
    print(f'Response: {r.json()}')
    assert r.status_code == 200, "Root endpoint failed"
    
    # Test 3: Liveness check with valid base64 image
    print('\n=== Test 3: Liveness Check ===')
    # Create a simple valid JPEG (1x1 pixel, red)
    mock_image = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCqAAAAAA//2Q=='
    r = client.post('/api/liveness', json={'image': mock_image, 'challenge': 'center'})
    print(f'Status: {r.status_code}')
    print(f'Response: {r.json()}')
    assert r.status_code == 200, "Liveness check failed"
    
    # Test 4: Liveness with direction challenge
    print('\n=== Test 4: Liveness with Direction (left) ===')
    r = client.post('/api/liveness', json={'image': mock_image, 'challenge': 'left'})
    print(f'Status: {r.status_code}')
    print(f'Response: {r.json()}')
    assert r.status_code == 200, "Direction challenge failed"
    
    # Test 5: Register face
    print('\n=== Test 5: Register Face ===')
    r = client.post('/api/register', json={'image': mock_image, 'user_id': 'test_user_123'})
    print(f'Status: {r.status_code}')
    print(f'Response: {r.json()}')
    assert r.status_code == 200, "Face registration failed"
    
    # Test 6: Recognize face
    print('\n=== Test 6: Recognize Face ===')
    r = client.post('/api/recognize', json={'image': mock_image})
    print(f'Status: {r.status_code}')
    print(f'Response: {r.json()}')
    assert r.status_code == 200, "Face recognition failed"
    
    # Test 7: Register without user_id (should fail)
    print('\n=== Test 7: Register without user_id (expect 400) ===')
    r = client.post('/api/register', json={'image': mock_image})
    print(f'Status: {r.status_code}')
    print(f'Response: {r.json()}')
    assert r.status_code == 400, "Should fail without user_id"
    
    print('\n' + '=' * 60)
    print('ALL TESTS PASSED!')
    print('=' * 60)
    print('\nAPI is ready for user registration!')
    print('Endpoints working:')
    print('  - POST /api/liveness   (face liveness check)')
    print('  - POST /api/register   (face registration)')
    print('  - POST /api/recognize  (face recognition/login)')

if __name__ == '__main__':
    run_tests()
