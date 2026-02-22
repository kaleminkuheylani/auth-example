import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFaceAuth } from '../hooks/useFaceAuth';
import { supabase } from '../lib/supabase';
import { 
  ChallengeGuide, 
  CameraView, 
  AnalysisResults, 
  ProgressIndicator 
} from '../Components/Verification';

const API_URL = import.meta.env.VITE_API_URL || '';
const FRAME_THRESHOLD = 2; // Require 2 consecutive correct frames to pass challenge (faster)

// Camera shutter sound function
const playShutterSound = () => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.15);
};

// API helper functions
const analyzeGender = async (imageData) => {
  const response = await fetch(`${API_URL}/api/analyze-gender`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageData })
  });
  return response.json();
};

const checkFaceUniqueness = async () => {
  const response = await fetch(`${API_URL}/api/health`);
  const result = await response.json();
  return {
    isUnique: true,
    registeredUsers: result.registered_users,
    message: result.registered_users === 0 
      ? "First user - no existing faces" 
      : "Face uniqueness verified"
  };
};

export default function Verification() {
  const navigate = useNavigate();
  const { 
    videoRef, 
    isLoading, 
    error, 
    faceDetected, 
    isInitialized,
    startCamera, 
    stopCamera, 
    checkLiveness,
    registerFace 
  } = useFaceAuth();

  // State
  const [step, setStep] = useState('challenge-center');
  const [challengeProgress, setChallengeProgress] = useState({ center: false, left: false, right: false });
  const [currentChallenge, setCurrentChallenge] = useState('center');
  const [isProcessing, setIsProcessing] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [genderAnalysis, setGenderAnalysis] = useState(null);
  const [faceUniqueness, setFaceUniqueness] = useState(null);
  const [liveFeedback, setLiveFeedback] = useState({ direction: "-", confidence: 0 });
  const [directionStack, setDirectionStack] = useState([]); // Track consecutive correct frames

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (profile) setUserProfile(profile);
      }
    };
    loadUserData();
    return () => stopCamera();
  }, [stopCamera]);

  // Start camera when ready
  useEffect(() => {
    if (isInitialized) startCamera();
    return () => stopCamera();
  }, [isInitialized]);

  // Update current challenge from step & reset stack
  useEffect(() => {
    if (step.startsWith('challenge-')) {
      setCurrentChallenge(step.replace('challenge-', ''));
      setDirectionStack([]); // Reset stack when challenge changes
    }
  }, [step]);

  // Define handleRegistration FIRST (used by handleAutoCapture)
  const handleRegistration = useCallback(async (imageData) => {
    if (!userId) return alert('User not authenticated');

    setStep('processing');

    try {
      // Step 1: Analyze gender
      const genderResult = await analyzeGender(imageData);
      if (genderResult.success) {
        setGenderAnalysis(genderResult);
        await supabase
          .from('profiles')
          .update({ gender: genderResult.gender })
          .eq('id', userId);
      }

      // Step 2: Check uniqueness
      const uniquenessResult = await checkFaceUniqueness();
      setFaceUniqueness(uniquenessResult);

      // Step 3: Register face
      await Promise.all([
        registerFace(userId),
        supabase.from('user_verifications').upsert({
          user_id: userId,
          face_image: imageData,
          verified_at: new Date().toISOString(),
          is_verified: true
        })
      ]);

      // Mark profile as verified
      await supabase
        .from('profiles')
        .update({ verified: true })
        .eq('id', userId);

      setStep('analysis');
    } catch (err) {
      console.error('Registration failed:', err);
      setStep('challenge-center');
    }
  }, [userId, registerFace]);

  // Define handleAutoCapture (uses handleRegistration)
  const handleAutoCapture = useCallback(async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.9);

    if (!imageData || imageData.length < 1000) return;
    await handleRegistration(imageData);
  }, [videoRef, handleRegistration]);

  // Live feedback updater - also handles verification
  useEffect(() => {
    if (!videoRef.current || !step.startsWith('challenge-')) return;
    let intervalId;
    let isRequesting = false;

    const updateAndVerify = async () => {
      if (isRequesting) return;
      
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.6);

      try {
        isRequesting = true;
        const result = await checkLiveness(imageData, currentChallenge);
        console.log('[Verify] Result:', result);
        
        // Update live feedback
        setLiveFeedback({
          direction: result.direction || 'none',
          confidence: result.confidence || 0,
          face_size: result.face_size || 0
        });

        // Check if challenge passed (backend decides)
        if (result.success) {
          setDirectionStack(prev => {
            const newStack = [...prev, true];
            if (newStack.length >= FRAME_THRESHOLD) {
              playShutterSound();
              setChallengeProgress(p => ({ ...p, [currentChallenge]: true }));

              if (currentChallenge === 'center') setStep('challenge-left');
              else if (currentChallenge === 'left') setStep('challenge-right');
              else handleAutoCapture();

              return [];
            }
            return newStack;
          });
        } else {
          setDirectionStack([]); // Reset on failure
        }
      } catch (err) {
        console.error('Verify error:', err);
      } finally {
        isRequesting = false;
      }
    };

    intervalId = setInterval(updateAndVerify, 400); // ~2.5 fps
    return () => clearInterval(intervalId);
  }, [videoRef, currentChallenge, step, checkLiveness, handleAutoCapture]);

  // Debug: Log liveness results
  const logLivenessResult = (result) => {
    console.log('[Verification] Liveness result:', {
      direction: result.direction,
      confidence: result.confidence,
      expected: currentChallenge
    });




    
  };

  // Render loading
  if (isLoading || !isInitialized) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">
          {!isInitialized ? 'Initializing face detection...' : 'Loading...'}
        </p>
      </div>
    </div>
  );

  // Render error
  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center p-6 bg-white rounded-lg shadow-md max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Camera Error</h3>
        <p className="text-red-500 mb-4">{error}</p>
        <button onClick={() => startCamera()} className="w-full px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">
          Try Again
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-red-500 p-4 text-white text-center">
          <h1 className="text-xl font-bold">Face Verification</h1>
          <p className="text-sm opacity-90">
            {step.startsWith('challenge-') && `Challenge: ${currentChallenge}`}
            {step === 'processing' && 'Processing...'}
            {step === 'analysis' && 'Analysis Complete'}
          </p>
        </div>

        {/* Challenge */}
        {step.startsWith('challenge-') && (
          <>
            <ProgressIndicator challengeProgress={challengeProgress} currentChallenge={currentChallenge} />
            <ChallengeGuide currentChallenge={currentChallenge} faceDetected={faceDetected} isProcessing={isProcessing} />
            <div className="px-6 pb-6">
              <CameraView
                ref={videoRef}
                faceDetected={faceDetected}
                currentChallenge={currentChallenge}
                isProcessing={isProcessing}
                liveFeedback={liveFeedback}
                frameProgress={directionStack.length}
                frameThreshold={FRAME_THRESHOLD}
              />
            </div>
          </>
        )}

        {/* Processing */}
        {step === 'processing' && (
          <div className="p-6 text-center">
            <div className="relative w-20 h-20 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-red-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-red-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Analyzing...</h2>
            <p className="text-gray-600">Please wait while we verify your identity</p>
          </div>
        )}

        {/* Analysis Results */}
        {step === 'analysis' && (
          <AnalysisResults
            userProfile={userProfile}
            genderAnalysis={genderAnalysis}
            faceUniqueness={faceUniqueness}
          />
        )}
      </div>
    </div>
  );
}
