import React from 'react';

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

export default function ChallengeGuide({ currentChallenge, faceDetected, isProcessing }) {
  const guide = CHALLENGE_GUIDES[currentChallenge];
  
  return (
    <div className="p-6">
      {/* Challenge Guide Card */}
      <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white p-4 rounded-xl mb-4 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <UserIcon />
          </div>
          <div>
            <h3 className="font-bold text-lg">{guide.text}</h3>
            <p className="text-white/80 text-sm">{guide.subtext}</p>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-gray-50 p-4 rounded-lg mb-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-red-500 text-sm font-bold">
              {currentChallenge === 'center' ? '1' : currentChallenge === 'left' ? '2' : '3'}
            </span>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800">Follow the instruction above</h4>
            <p className="text-sm text-gray-600 mt-1">
              This helps us verify you're a real person, not a photo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export { ArrowLeft, ArrowRight, UserIcon, CHALLENGE_GUIDES };
