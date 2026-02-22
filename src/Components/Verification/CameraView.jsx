import React, { forwardRef } from 'react';
import { ArrowLeft, ArrowRight, UserIcon } from './ChallengeGuide';

const CameraView = forwardRef(({ 
  faceDetected, 
  currentChallenge, 
  isProcessing,
  liveFeedback,
  frameProgress = 0,  // Current frame count (0, 1, 2, 3)
  frameThreshold = 3, // Required frames
  showGuide = true 
}, ref) => {
  // Debug: log liveFeedback changes
  console.log('[CameraView] liveFeedback:', liveFeedback);
  return (
    <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
      <video
        ref={ref}
        className="w-full h-full object-cover"
        playsInline
        muted
      />

      {/* Live feedback overlay */}
      {faceDetected && liveFeedback && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-3 py-1 rounded text-xs z-50">
          <div>Direction: {liveFeedback.direction || "-"}</div>
          <div>Confidence: {(liveFeedback.confidence * 100).toFixed(1)}%</div>
        </div>
      )}

      {/* Face Detection Overlay */}
      {faceDetected && (
        <div className="absolute inset-0 border-4 border-green-400 rounded-lg"></div>
      )}

      {/* Direction Arrow Overlay */}
      {showGuide && faceDetected && currentChallenge !== 'center' && (
        <div className={`absolute top-1/2 ${currentChallenge === 'left' ? 'left-4' : 'right-4'} transform -translate-y-1/2`}>
          <div className="animate-pulse">
            {currentChallenge === 'left' ? <ArrowLeft /> : <ArrowRight />}
          </div>
        </div>
      )}

      {/* Frame Progress Indicator */}
      {showGuide && faceDetected && !isProcessing && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-black/60 text-white text-sm px-4 py-2 rounded-full backdrop-blur-sm flex items-center gap-2">
            <span>Frame: {frameProgress}/{frameThreshold}</span>
            <div className="flex gap-1">
              {[...Array(frameThreshold)].map((_, i) => (
                <div 
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all duration-200 ${
                    i < frameProgress 
                      ? 'bg-green-400 scale-110' 
                      : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
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
  );
});

CameraView.displayName = 'CameraView';

export default CameraView;
