import React from 'react';

export default function ProgressIndicator({ challengeProgress, currentChallenge }) {
  return (
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
  );
}
