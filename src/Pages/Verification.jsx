import React,{ useState, useEffect } from 'react';
import { useFaceAuth } from '../hooks/useFaceAuth';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

// Challenge guides with SVG arrows
const CHALLENGE_GUIDES = {
  center: {
    text: 'Look straight at the camera',
    subtext: 'Keep your face centered'
  },
  left: {
    text: 'Turn your head to the LEFT',
    subtext: 'Look toward your left shoulder'
  },
  right: {
    text: 'Turn your head to the RIGHT',
    subtext: 'Look toward your right shoulder'
  }
};

// SVG Arrow Components
const ArrowLeft = () => (
  <svg className="w-16 h-16 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
  </svg>
);

const ArrowRight = () => (
  <svg className="w-16 h-16 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

export default function Verification() {
  const navigate = useNavigate();
  const { 
    videoRef, 
    isLoading, 
    error, 
    faceDetected, 
    isLive,
    livenessConfidence,
    isInitialized,
    startCamera, 
    stopCamera, 
    checkLiveness,
    registerFace 
  } = useFaceAuth();
  
  const [step, setStep] = useState('challenge-center'); // challenge-center -> challenge-left -> challenge-right -> capture -> processing -> success
  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [livenessResult, setLivenessResult] = useState(null);
  const [userId, setUserId] = useState(null);
  const [challengeProgress, setChallengeProgress] = useState({ center: false, left: false, right: false });
  const [currentChallenge, setCurrentChallenge] = useState('center');

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
    
    return () => stopCamera();
  }, [stopCamera]);
  
  // Start camera only when face detection is initialized, video element is ready, and step is challenge
  useEffect(() => {
    if (step.startsWith('challenge-') && isInitialized && videoRef.current) {
      console.log('[Verification] Starting camera...');
      const timer = setTimeout(() => {
        startCamera();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [step, isInitialized, startCamera]);

  // Get current challenge from step
  useEffect(() => {
    if (step.startsWith('challenge-')) {
      setCurrentChallenge(step.replace('challenge-', ''));
    }
  }, [step]);

  // Auto-capture: Automatically verify when face is detected and stable
  useEffect(() => {
    let timeoutId;
    if (step.startsWith('challenge-') && faceDetected && !isProcessing) {
      // Wait 1.5 seconds for user to stabilize, then auto-verify
      timeoutId = setTimeout(() => {
        handleAutoVerify();
      }, 1500);
    }
    return () => clearTimeout(timeoutId);
  }, [step, faceDetected, isProcessing, currentChallenge]);

  // Auto-verify function
  const handleAutoVerify = async () => {
    if (!faceDetected || isProcessing) return;
    
    setIsProcessing(true);
    const result = await checkLiveness(currentChallenge);
    setLivenessResult(result);
    
    if (result.live) {
      // Update progress
      setChallengeProgress(prev => ({ ...prev, [currentChallenge]: true }));
      
      // Move to next challenge or capture
      if (currentChallenge === 'center') {
        setTimeout(() => setStep('challenge-left'), 300);
      } else if (currentChallenge === 'left') {
        setTimeout(() => setStep('challenge-right'), 300);
      } else if (currentChallenge === 'right') {
        // Auto-capture photo after right challenge
        setTimeout(() => handleAutoCapture(), 500);
      }
    }
    setIsProcessing(false);
  };

  // Auto-capture photo
  const handleAutoCapture = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
    
    // Auto-proceed to registration (skip confirm step)
    handleAutoRegister(imageData);
  };

  // Background processing - register without blocking UI
  const handleAutoRegister = async (imageData) => {
    if (!userId) {
      alert('User not authenticated');
      return;
    }
    
    setStep('processing');
    
    try {
      // Run registration in background
      const registerPromise = registerFace(userId);
      const supabasePromise = supabase
        .from('user_verifications')
        .upsert({
          user_id: userId,
          face_image: imageData,
          verified_at: new Date().toISOString(),
          is_verified: true
        });
      
      // Wait for both operations
      const [result] = await Promise.all([registerPromise, supabasePromise]);
      
      if (result.success) {
        setStep('success');
        setTimeout(() => navigate('/dashboard'), 2000);
      } else {
        // If failed, go to manual capture
        setStep('capture');
      }
    } catch (err) {
      // On error, allow manual retry
      setStep('capture');
    }
  };

  // Manual fallback - kept for edge cases
  const handleCheckChallenge = async () => {
    if (!faceDetected) return;
    await handleAutoVerify();
  };

  // Step 2: Capture Photo
  const handleCapture = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    
    setCapturedImage(canvas.toDataURL('image/jpeg', 0.9));
    setStep('confirm');
  };

  // Step 3: Register Face with DeepFace
  const handleConfirm = async () => {
    if (!userId) {
      alert('User not authenticated');
      return;
    }
    
    setIsProcessing(true);
    setStep('processing');
    
    try {
      // Register face in DeepFace backend
      const result = await registerFace(userId);
      
      if (result.success) {
        // Also save to Supabase and mark profile as verified
        await Promise.all([
          supabase
            .from('user_verifications')
            .upsert({
              user_id: userId,
              face_image: capturedImage,
              verified_at: new Date().toISOString(),
              is_verified: true
            }),
          supabase
            .from('profiles')
            .update({ verified: true })
            .eq('id', userId)
        ]);
        
        setStep('success');
        setTimeout(() => navigate('/dashboard'), 2000);
      } else {
        alert('Registration failed: ' + result.message);
        setStep('capture');
      }
    } catch (err) {
      alert('Error: ' + err.message);
      setStep('capture');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setStep('capture');
  };

  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {!isInitialized ? 'Initializing face detection...' : 'Loading...'}
          </p>
          <p className="mt-2 text-xs text-gray-400">This may take a few seconds</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-6 bg-white rounded-lg shadow-md max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Camera Error</h3>
          <p className="text-red-500 mb-4">{error}</p>
          <div className="space-y-2">
            <button 
              onClick={() => startCamera()}
              className="w-full px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
            >
              Try Again
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Reload Page
            </button>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Tip: Close other apps using your camera (Zoom, Teams, etc.) and ensure camera permissions are allowed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-red-500 p-4 text-white text-center">
          <h1 className="text-xl font-bold">Face Verification</h1>
          <p className="text-sm opacity-90">
            {step === 'liveness' && 'Step 1: Liveness Check'}
            {step === 'capture' && 'Step 2: Capture Photo'}
            {step === 'confirm' && 'Step 3: Confirm & Register'}
            {step === 'processing' && 'Processing...'}
            {step === 'success' && 'Complete!'}
          </p>
        </div>

        {/* Challenge Progress Indicator */}
        {(step.startsWith('challenge-') || step === 'capture') && (
          <div className="px-6 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">Verification Progress</span>
              <span className="text-xs text-red-500">
                {Object.values(challengeProgress).filter(Boolean).length}/3 Complete
              </span>
            </div>
            <div className="flex gap-2">
              {['center', 'left', 'right'].map((dir, idx) => (
                <div key={dir} className="flex-1 flex items-center gap-2">
                  <div className={`flex-1 h-2 rounded-full transition-colors ${
                    challengeProgress[dir] ? 'bg-green-500' : 
                    currentChallenge === dir ? 'bg-red-500 animate-pulse' : 'bg-gray-200'
                  }`} />
                  {idx < 2 && (
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                      challengeProgress[dir] ? 'bg-green-500 text-white' : 'bg-gray-200'
                    }`}>
                      {challengeProgress[dir] ? '✓' : '>'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 1-3: Directional Challenges */}
        {step.startsWith('challenge-') && (
          <div className="p-6">
            {/* Challenge Guide Card */}
            <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white p-4 rounded-xl mb-4 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <UserIcon />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{CHALLENGE_GUIDES[currentChallenge].text}</h3>
                  <p className="text-white/80 text-sm">{CHALLENGE_GUIDES[currentChallenge].subtext}</p>
                </div>
              </div>
            </div>

            {/* Camera View */}
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              
              {/* Face Detection Overlay */}
              {faceDetected && (
                <div className="absolute inset-0 border-4 border-green-400 rounded-lg">
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-3 py-1 rounded-full animate-pulse flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    Face Detected
                  </div>
                </div>
              )}
              
              {/* Direction Arrow Overlay */}
              {faceDetected && currentChallenge !== 'center' && (
                <div className={`absolute top-1/2 ${currentChallenge === 'left' ? 'left-4' : 'right-4'} transform -translate-y-1/2`}>
                  <div className="animate-pulse">
                    {currentChallenge === 'left' ? <ArrowLeft /> : <ArrowRight />}
                  </div>
                </div>
              )}
              
              {/* Auto-verify progress indicator */}
              {faceDetected && !isProcessing && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-black/50 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
                    Auto-capturing in 1.5s...
                  </div>
                </div>
              )}
              
              {!faceDetected && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-2 border-2 border-white/30 rounded-full flex items-center justify-center">
                      <UserIcon />
                    </div>
                    <p className="text-white text-sm">Position your face in the frame</p>
                  </div>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-red-500 text-sm font-bold">{currentChallenge === 'center' ? '1' : currentChallenge === 'left' ? '2' : '3'}</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800">Follow the instruction above</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    This helps us verify you're a real person, not a photo.
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {livenessResult && !livenessResult.live && (
              <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {livenessResult.message}
              </div>
            )}

            {/* Manual Button (fallback) */}
            <button
              onClick={handleCheckChallenge}
              disabled={!faceDetected || isProcessing}
              className={`w-full py-3 rounded-xl font-semibold transition-all ${
                faceDetected && !isProcessing
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-gray-50 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Verifying...
                </span>
              ) : (
                'Or click to verify manually'
              )}
            </button>
          </div>
        )}

        {/* Step 4: Capture (Manual Fallback) */}
        {step === 'capture' && (
          <div className="p-6">
            {/* Success Banner */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-4 rounded-xl mb-4 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold">All Challenges Complete!</h3>
                  <p className="text-white/80 text-sm">Now capture your photo</p>
                </div>
              </div>
            </div>

            {/* Camera View with Guidelines */}
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              
              {/* Face Oval Guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-64 border-2 border-dashed border-white/50 rounded-full"></div>
              </div>
              
              <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                Ready
              </div>
            </div>

            {/* Tips */}
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Photo Tips
              </h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Center your face in the oval</li>
                <li>• Keep neutral expression</li>
                <li>• Ensure good lighting</li>
              </ul>
            </div>

            <button
              onClick={handleCapture}
              className="w-full py-4 bg-red-500 text-white rounded-xl font-bold text-lg hover:bg-red-600 transition-all transform active:scale-95 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Capture Photo
            </button>
          </div>
        )}

        {/* Step 5: Confirm */}
        {step === 'confirm' && capturedImage && (
          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Review Your Photo</h3>
            
            <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden mb-4 shadow-inner">
              <img
                src={capturedImage}
                alt="Captured face"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <div>
                  <h4 className="font-semibold text-yellow-800">This photo will be used for:</h4>
                  <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                    <li>• Face recognition login</li>
                    <li>• Identity verification</li>
                    <li>• Cannot be changed later</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRetake}
                disabled={isProcessing}
                className="flex-1 py-3 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Retake
              </button>
              <button
                onClick={handleConfirm}
                disabled={isProcessing}
                className="flex-1 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    Register Face
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Processing */}
        {step === 'processing' && (
          <div className="p-6 text-center">
            <div className="relative w-20 h-20 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-red-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-red-500 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Securing Your Face...</h2>
            <p className="text-gray-600">DeepFace is creating your unique face signature</p>
            <div className="mt-4 flex justify-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
              <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
            </div>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div className="p-6 text-center">
            <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">You're All Set!</h2>
            <p className="text-gray-600 mb-2">Your face is now registered</p>
            <div className="bg-green-50 p-3 rounded-lg mb-4">
              <p className="text-sm text-green-700">You can now login with just your face at</p>
              <p className="font-mono text-green-600 text-sm">/face-login</p>
            </div>
            <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
          </div>
        )}
      </div>
    </div>
  );
}
