import { useState, useRef, useCallback, useEffect } from 'react';
import { FaceDetection } from '@mediapipe/face_detection';
import { Camera } from '@mediapipe/camera_utils';

const API_URL = 'http://localhost:5000';

export function useFaceAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [livenessConfidence, setLivenessConfidence] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const videoRef = useRef(null);
  const faceDetectionRef = useRef(null);
  const cameraRef = useRef(null);
  const initPromiseRef = useRef(null);

  const initFaceDetection = useCallback(async () => {
    // Return existing promise if initialization is already in progress
    if (initPromiseRef.current) {
      return initPromiseRef.current;
    }
    
    // Create new initialization promise
    initPromiseRef.current = (async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log('[FaceAuth] Initializing face detection...');
        
        const faceDetection = new FaceDetection({
          locateFile: (file) => {
            const url = `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
            console.log('[FaceAuth] Loading MediaPipe file:', url);
            return url;
          }
        });

        faceDetection.setOptions({
          model: 'short',
          minDetectionConfidence: 0.5
        });

        faceDetection.onResults((results) => {
          if (results.detections && results.detections.length > 0) {
            setFaceDetected(true);
          } else {
            setFaceDetected(false);
          }
        });

        // Initialize the graph - this loads the model files
        console.log('[FaceAuth] Calling initialize()...');
        await faceDetection.initialize();
        console.log('[FaceAuth] initialize() completed');
        
        faceDetectionRef.current = faceDetection;
        setIsInitialized(true);
        console.log('[FaceAuth] Face detection ready');
        setIsLoading(false);
      } catch (err) {
        console.error('[FaceAuth] Initialization error:', err);
        setError('Face detection initialization failed: ' + err.message);
        setIsLoading(false);
        throw err;
      }
    })();
    
    return initPromiseRef.current;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      console.log('[FaceAuth] Starting camera...');
      
      // First ensure face detection is initialized (wait for it)
      console.log('[FaceAuth] Ensuring face detection is initialized...');
      try {
        await initFaceDetection();
      } catch (initErr) {
        console.error('[FaceAuth] Init failed:', initErr);
        setError('Face detection initialization failed: ' + initErr.message);
        return;
      }
      
      console.log('[FaceAuth] Video ref:', videoRef.current ? 'exists' : 'null');
      console.log('[FaceAuth] Face detection ref:', faceDetectionRef.current ? 'exists' : 'null');

      if (!videoRef.current) {
        setError('Camera initialization failed: Video element not found');
        return;
      }
      
      if (!faceDetectionRef.current) {
        setError('Camera initialization failed: Face detection not ready');
        return;
      }

      // Check if camera is available
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(d => d.kind === 'videoinput');
        if (cameras.length === 0) {
          setError('No camera found. Please connect a camera and try again.');
          return;
        }
      } catch (enumErr) {
        console.warn('Could not enumerate devices:', enumErr);
      }

      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (faceDetectionRef.current && videoRef.current) {
            try {
              await faceDetectionRef.current.send({ image: videoRef.current });
            } catch (sendErr) {
              // Ignore send errors during cleanup
            }
          }
        },
        width: 640,
        height: 480
      });

      cameraRef.current = camera;
      await camera.start();
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('Timeout')) {
        setError('Camera timeout: Camera may be in use by another application. Please close other apps using the camera and try again.');
      } else if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Please connect a camera.');
      } else {
        setError('Camera access failed: ' + err.message);
      }
    }
  }, [initFaceDetection]);

  const stopCamera = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.stop();
    }
  }, []);

  const captureImage = useCallback(() => {
    if (!videoRef.current) return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    
    return canvas.toDataURL('image/jpeg', 0.9);
  }, []);

  // Step 1: Check Liveness with directional challenge
  const checkLiveness = useCallback(async (challenge = null) => {
    const imageData = captureImage();
    if (!imageData) return { success: false, message: 'No image captured' };

    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/liveness`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: imageData,
          challenge: challenge
        })
      });

      const result = await response.json();
      
      if (result.live) {
        setIsLive(true);
        setLivenessConfidence(result.confidence);
      }
      
      return result;
    } catch (err) {
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [captureImage]);

  // Step 2: Register Face
  const registerFace = useCallback(async (userId) => {
    const imageData = captureImage();
    if (!imageData) return { success: false, message: 'No image captured' };

    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: imageData,
          user_id: userId 
        })
      });

      const result = await response.json();
      return result;
    } catch (err) {
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [captureImage]);

  // Step 3: Recognize Face (Login)
  const recognizeFace = useCallback(async () => {
    const imageData = captureImage();
    if (!imageData) return { success: false, message: 'No image captured' };

    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/recognize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData })
      });

      const result = await response.json();
      return result;
    } catch (err) {
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [captureImage]);

  useEffect(() => {
    initFaceDetection();
    return () => stopCamera();
  }, [initFaceDetection, stopCamera]);

  return {
    videoRef,
    isLoading,
    error,
    faceDetected,
    isLive,
    livenessConfidence,
    isInitialized,
    startCamera,
    stopCamera,
    captureImage,
    checkLiveness,
    registerFace,
    recognizeFace
  };
}
