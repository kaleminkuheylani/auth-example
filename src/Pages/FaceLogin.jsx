import { useState, useEffect } from 'react';
import { useFaceAuth } from '../hooks/useFaceAuth';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function FaceLogin() {
  const navigate = useNavigate();
  const { 
    videoRef, 
    isLoading, 
    error, 
    faceDetected,
    startCamera, 
    stopCamera, 
    recognizeFace 
  } = useFaceAuth();
  
  const [step, setStep] = useState('camera'); // camera -> recognizing -> result
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const handleRecognize = async () => {
    if (!faceDetected) return;
    
    setIsProcessing(true);
    setStep('recognizing');
    
    try {
      const result = await recognizeFace();
      setRecognitionResult(result);
      
      if (result.recognized) {
        // Auto-login with recognized user
        // In real app, you'd verify with backend and create session
        setStep('success');
        
        // Store recognition in Supabase for audit
        await supabase.from('face_login_attempts').insert({
          user_id: result.user_id,
          confidence: result.confidence,
          success: true,
          created_at: new Date().toISOString()
        });
        
        setTimeout(() => navigate('/dashboard'), 2000);
      } else {
        setStep('not-found');
      }
    } catch (err) {
      setRecognitionResult({ success: false, message: err.message });
      setStep('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetry = () => {
    setRecognitionResult(null);
    setStep('camera');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading face recognition...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-6 bg-white rounded-lg shadow-md">
          <p className="text-red-500">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-red-500 p-4 text-white text-center">
          <h1 className="text-xl font-bold">Face Login</h1>
          <p className="text-sm opacity-90">Look at the camera to login</p>
        </div>

        {/* Camera View */}
        {step === 'camera' && (
          <div className="p-6">
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {faceDetected && (
                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded animate-pulse">
                  Face Detected
                </div>
              )}
              {!faceDetected && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <p className="text-white text-sm">Position your face in the frame</p>
                </div>
              )}
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h3 className="font-semibold text-blue-800 mb-2">How it works</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Look directly at the camera</li>
                <li>• DeepFace will find who you are</li>
                <li>• Automatic login on match</li>
              </ul>
            </div>

            <button
              onClick={handleRecognize}
              disabled={!faceDetected || isProcessing}
              className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                faceDetected && !isProcessing
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isProcessing ? 'Processing...' : 'Login with Face'}
            </button>

            <div className="mt-4 text-center">
              <button 
                onClick={() => navigate('/api/auth')}
                className="text-sm text-gray-500 hover:text-red-500"
              >
                Use email/password instead
              </button>
            </div>
          </div>
        )}

        {/* Recognizing */}
        {step === 'recognizing' && (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-500 mx-auto mb-4"></div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Recognizing...</h2>
            <p className="text-gray-600">DeepFace is comparing your face with registered users</p>
          </div>
        )}

        {/* Success */}
        {step === 'success' && recognitionResult && (
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Welcome Back!</h2>
            <p className="text-gray-600">User ID: {recognitionResult.user_id?.slice(0, 8)}...</p>
            <p className="text-sm text-green-600 mt-2">
              Confidence: {(recognitionResult.confidence * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-gray-500 mt-4">Redirecting...</p>
          </div>
        )}

        {/* Not Found */}
        {step === 'not-found' && (
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Face Not Recognized</h2>
            <p className="text-gray-600 mb-4">Your face doesn't match any registered user</p>
            
            <div className="space-y-2">
              <button
                onClick={handleRetry}
                className="w-full py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate('/api/auth')}
                className="w-full py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50"
              >
                Register New Account
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{recognitionResult?.message || 'Something went wrong'}</p>
            
            <button
              onClick={handleRetry}
              className="w-full py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
