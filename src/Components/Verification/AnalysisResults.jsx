import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function AnalysisResults({ 
  userProfile, 
  genderAnalysis, 
  faceUniqueness 
}) {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-800">Verification Analysis</h2>
        <p className="text-gray-500 text-sm">Your profile has been analyzed</p>
      </div>

      {/* Profile Summary */}
      {userProfile && (
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Profile Information
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Username:</span>
              <span className="font-medium">@{userProfile.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Real Name:</span>
              <span className="font-medium">{userProfile.real_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Email:</span>
              <span className="font-medium">{userProfile.email}</span>
            </div>
            {userProfile.interests && (
              <div className="flex flex-wrap gap-1 mt-2">
                {userProfile.interests.slice(0, 5).map((interest, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs">
                    {interest}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gender Analysis Result */}
      {genderAnalysis?.success && (
        <div className={`rounded-xl p-4 mb-4 ${
          genderAnalysis.gender === 'female' 
            ? 'bg-pink-50 border border-pink-200' 
            : 'bg-blue-50 border border-blue-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              genderAnalysis.gender === 'female' ? 'bg-pink-500' : 'bg-blue-500'
            }`}>
              <span className="text-2xl text-white">
                {genderAnalysis.gender === 'female' ? '♀' : '♂'}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">AI Gender Detection</h3>
              <p className="text-sm text-gray-600">
                Detected: <span className="font-bold capitalize">{genderAnalysis.gender}</span>
              </p>
              <p className="text-xs text-gray-500">
                Confidence: {(genderAnalysis.confidence * 100).toFixed(1)}%
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Gender is automatically assigned by AI for security
          </p>
        </div>
      )}

      {/* Face Uniqueness Result */}
      {faceUniqueness && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Face Uniqueness Verified</h3>
              <p className="text-sm text-gray-600">{faceUniqueness.message}</p>
              <p className="text-xs text-gray-500">
                Registered users in database: {faceUniqueness.registeredUsers}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Verification Status */}
      <div className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Verification Complete</h3>
            <p className="text-sm text-gray-600">Your identity has been verified</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate('/dashboard')}
        className="w-full py-4 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all transform hover:scale-[1.02]"
      >
        Go to Dashboard
      </button>
    </div>
  );
}
