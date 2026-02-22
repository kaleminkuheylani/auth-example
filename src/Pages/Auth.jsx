import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
     
const API_URL = 'localhost:5000'; // Empty string to use Vite proxy for /api routes

// Email verification functions
async function sendVerificationCode(email) {
  const response = await fetch(`${API_URL}/api/email/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  if (!response.ok) throw new Error('Failed to send code');
  return response.json();
}

async function verifyEmailCode(email, code) {
  const response = await fetch(`${API_URL}/api/email/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code })
  });
  if (!response.ok) throw new Error('Invalid code');
  return response.json();
}

// Registration function
async function registerUser(userData) {
  try {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error('Register error:', error);
    throw error;
  }
}

// Interest options
const interestOptions = [
  "Technology", "Sports", "Music", "Movies", "Travel", 
  "Food", "Art", "Reading", "Gaming", "Fitness",
  "Photography", "Cooking", "Dancing", "Hiking", "Yoga",
  "Fashion", "Politics", "Science", "History", "Nature"
];

// Progress bar component
function ProgressBar({ currentStep, totalSteps }) {
  return (
    <div className="w-full mb-8">
      <div className="flex justify-between mb-2">
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <div
            key={idx}
            className={`flex-1 h-2 mx-1 rounded-full transition-all duration-300 ${
              idx + 1 <= currentStep ? "bg-red-500" : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      <p className="text-center text-sm text-gray-500">
        Step {currentStep} of {totalSteps}
      </p>
    </div>
  );
}

// Step 1: Personal Interests & Expectations
function StepOne({ data, onChange, onNext }) {
  const [selectedInterests, setSelectedInterests] = useState(data.interests || []);
  const [errors, setErrors] = useState({});
  const max_interestCount=3;
  const toggleInterest = (interest) => {
    if(max_interestCount && selectedInterests.length >= max_interestCount)
      return;
    
    const newInterests = selectedInterests.includes(interest)
      ? selectedInterests.filter(i => i !== interest)
      : [...selectedInterests, interest];
    setSelectedInterests(newInterests);
    onChange({ interests: newInterests });
  };

  const validate = () => {
    const newErrors = {};
    if (selectedInterests.length > max_interestCount || selectedInterests.length < 0) newErrors.interests = "Hata ,maks 3  tane sec";
    if (!data.lifeExpectations?.trim()) newErrors.lifeExpectations = "This field is required";
    if (!data.whatBroughtYouHere?.trim()) newErrors.whatBroughtYouHere = "This field is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) onNext();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800">Tell Us About Yourself</h2>
        <p className="text-gray-500 mt-2">Help us understand you better</p>
      </div>

      {/* Interests */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          What are your interests? <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {interestOptions.map((interest) => (
            <button
              key={interest}
              type="button"
              onClick={() => toggleInterest(interest)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedInterests.includes(interest)
                  ? "bg-red-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {interest}
            </button>
          ))}
        </div>
      </div>

      {/* Life Expectations */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          What do you expect from life? <span className="text-red-500">*</span>
        </label>
        <textarea
          value={data.lifeExpectations || ""}
          onChange={(e) => onChange({ lifeExpectations: e.target.value })}
          placeholder="Share your dreams, goals, and what you're looking for..."
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all resize-none"
          rows={3}
        />
        {errors.lifeExpectations && <p className="text-red-500 text-sm mt-1">{errors.lifeExpectations}</p>}
      </div>

      {/* What Brought You Here */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          What brought you here? <span className="text-red-500">*</span>
        </label>
        <textarea
          value={data.whatBroughtYouHere || ""}
          onChange={(e) => onChange({ whatBroughtYouHere: e.target.value })}
          placeholder="Tell us why you joined our community..."
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all resize-none"
          rows={3}
        />
        {errors.whatBroughtYouHere && <p className="text-red-500 text-sm mt-1">{errors.whatBroughtYouHere}</p>}
      </div>

      <button
        onClick={handleNext}
        className="w-full py-4 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-semibold text-lg hover:shadow-lg transition-all transform hover:scale-[1.02]"
      >
        Continue
      </button>
    </div>
  );
}

// Step 2: Account Details with Email Verification
function StepTwo({ data, onChange, onNext, onBack }) {
  const [errors, setErrors] = useState({});
  const [verificationCode, setVerificationCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validateUsername = (username) => {
    const re = /^[a-zA-Z0-9_]{3,20}$/;
    return re.test(username);
  };

  const handleSendVerificationCode = async () => {
    if (!validateEmail(data.email)) {
      setErrors({ email: "Please enter a valid email address" });
      return;
    }

    setIsVerifying(true);
    setErrors({});
    setSuccessMessage("");
    
    try {
      const result = await sendVerificationCode(data.email);
      
      if (result.success) {
        setIsCodeSent(true);
        setCountdown(60);
        setSuccessMessage(`Verification code sent to ${data.email}`);
        // Show code in alert for demo
        if (result.code) {
          alert(`Your verification code is: ${result.code}`);
        }
      } else {
        setErrors({ 
          email: result.message || "Failed to send verification code",
          general: "Unable to send code. Please check your email address and try again."
        });
      }
    } catch (err) {
      console.error("Send code error:", err);
      let errorMsg = "Failed to send verification code. Please try again.";
      if (err.message?.includes("NetworkError") || err.message?.includes("Failed to fetch")) {
        errorMsg = "Cannot connect to server. Please check your internet connection.";
      } else if (err.message?.includes("404")) {
        errorMsg = "Service temporarily unavailable. Please try again later.";
      }
      setErrors({ 
        email: errorMsg,
        general: errorMsg
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setErrors({ code: "Please enter a valid 6-digit code" });
      return;
    }
    
    setIsVerifying(true);
    setErrors({});
    
    try {
      const result = await verifyEmailCode(data.email, verificationCode);
      
      if (result.success) {
        setIsEmailVerified(true);
        setErrors({});
        setSuccessMessage("Email verified successfully!");
      } else {
        setErrors({ 
          code: result.message || "Invalid verification code",
          general: "The code you entered is incorrect or has expired."
        });
      }
    } catch (err) {
      console.error("Verify code error:", err);
      let errorMsg = "Verification failed. Please try again.";
      if (err.message?.includes("NetworkError") || err.message?.includes("Failed to fetch")) {
        errorMsg = "Cannot connect to server. Please check your connection.";
      }
      setErrors({ 
        code: errorMsg,
        general: errorMsg
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const validatePassword = (password) => {
    return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
  };

  const validate = () => {
    const newErrors = {};
    if (!data.realName?.trim()) newErrors.realName = "Real name is required";
    if (!data.username?.trim()) newErrors.username = "Username is required";
    else if (!validateUsername(data.username)) newErrors.username = "Username must be 3-20 characters (letters, numbers, underscores)";
    if (!data.email?.trim()) newErrors.email = "Email is required";
    else if (!validateEmail(data.email)) newErrors.email = "Please enter a valid email";
    if (!isEmailVerified) newErrors.email = "Please verify your email";
    if (!data.password) newErrors.password = "Password is required";
    else if (!validatePassword(data.password)) newErrors.password = "Password must be at least 8 characters with uppercase, lowercase, and number";
    if (data.password !== data.confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    console.log("Continue clicked, validating...");
    const isValid = validate();
    console.log("Validation result:", isValid);
    if (isValid) {
      console.log("Validation passed, going to next step");
      onNext();
    } else {
      console.log("Validation failed, errors:", errors);
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800">Create Your Account</h2>
        <p className="text-gray-500 mt-2">Secure your profile</p>
      </div>

      {/* General Error/Success Messages */}
      {errors.general && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-red-700 font-medium">Error</p>
              <p className="text-red-600 text-sm">{errors.general}</p>
            </div>
          </div>
        </div>
      )}
      
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-green-700 font-medium">Success</p>
              <p className="text-green-600 text-sm">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Real Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Real Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.realName || ""}
          onChange={(e) => onChange({ realName: e.target.value })}
          placeholder="Your full name"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all"
        />
        {errors.realName && <p className="text-red-500 text-sm mt-1">{errors.realName}</p>}
      </div>

      {/* Username */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Username <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.username || ""}
          onChange={(e) => onChange({ username: e.target.value })}
          placeholder="Choose a unique username"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all"
        />
        <p className="text-xs text-gray-500 mt-1">3-20 characters, letters, numbers, and underscores only</p>
        {errors.username && <p className="text-red-500 text-sm mt-1">{errors.username}</p>}
      </div>

      {/* Email with Verification */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            value={data.email || ""}
            onChange={(e) => {
              onChange({ email: e.target.value });
              setIsEmailVerified(false);
              setIsCodeSent(false);
            }}
            placeholder="your@email.com"
            disabled={isEmailVerified}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all disabled:bg-gray-100"
          />
          {!isEmailVerified && (
            <button
              type="button"
              onClick={handleSendVerificationCode}
              disabled={isVerifying || countdown > 0 || !data.email}
              className="px-4 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
            >
              {countdown > 0 ? `Resend (${countdown})` : isCodeSent ? "Resend" : "Send Code"}
            </button>
          )}
        </div>
        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
        
        {/* Verification Code Input */}
        {isCodeSent && !isEmailVerified && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit code"
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all text-center tracking-widest"
              maxLength={6}
            />
            <button
              type="button"
              onClick={handleVerifyCode}
              className="px-6 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-all"
            >
              Verify
            </button>
          </div>
        )}
        {errors.code && <p className="text-red-500 text-sm mt-1">{errors.code}</p>}
        {isEmailVerified && (
          <p className="text-green-600 text-sm mt-1 flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Email verified successfully
          </p>
        )}
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Password <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={data.password || ""}
          onChange={(e) => onChange({ password: e.target.value })}
          placeholder="Create a strong password"
          disabled={!isEmailVerified}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all disabled:bg-gray-100"
        />
        <p className="text-xs text-gray-500 mt-1">Min 8 characters, uppercase, lowercase, number</p>
        {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
      </div>

      {/* Confirm Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Confirm Password <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={data.confirmPassword || ""}
          onChange={(e) => onChange({ confirmPassword: e.target.value })}
          placeholder="Confirm your password"
          disabled={!isEmailVerified}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all disabled:bg-gray-100"
        />
        {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
      </div>

      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          className="flex-1 py-4 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          className="flex-1 py-4 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all transform hover:scale-[1.02]"
        >
          Continue
        </button>
      </div>
    </div>
  );
}


// Step 3: Personal Links & Review
function StepThree({ data, onChange, onSubmit, onBack, isLoading }) {
  const [linkErrors, setLinkErrors] = useState({});
  const [oauthLoading, setOauthLoading] = useState(null);

  // LinkedIn OAuth ile bağla
  const connectLinkedIn = async () => {
    setOauthLoading('linkedin');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'linkedin_oidc',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?platform=linkedin`,
          scopes: 'r_liteprofile r_emailaddress',
        }
      });
      if (error) throw error;
    } catch (err) {
      alert('LinkedIn bağlantısı başarısız: ' + err.message);
    } finally {
      setOauthLoading(null);
    }
  };


  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Son Adım!</h2>
        <p className="text-gray-500 mt-2">Profilinizi tamamlayın</p>
      </div>

      {/* Personal Links Section - Sadece LinkedIn OAuth */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 space-y-4">
        <div className="text-center">
          <h3 className="font-semibold text-gray-800">LinkedIn Profili</h3>
          <p className="text-xs text-gray-500 mt-1">LinkedIn hesabınızı bağlayın (Opsiyonel)</p>
        </div>
        
        <div className="space-y-4">
          {/* LinkedIn - OAuth ile bağla */}
          <div>
            {data.linkedinVerified ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <div className="text-green-600 font-medium flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  ✓ LinkedIn Doğrulandı
                </div>
                <p className="text-sm text-gray-600 mt-1">{data.linkedinLink}</p>
              </div>
            ) : (
              <button
                onClick={connectLinkedIn}
                disabled={oauthLoading === 'linkedin'}
                className="w-full py-3 px-4 bg-[#0077b5] text-white rounded-xl font-medium hover:bg-[#006396] transition-all flex items-center justify-center gap-2"
              >
                {oauthLoading === 'linkedin' ? (
                  <span>Bağlanıyor...</span>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    LinkedIn ile Bağlan
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        
        <p className="text-xs text-gray-400 text-center">
          * LinkedIn bağlantısı tamamen opsiyoneldir
        </p>
      </div>

      {/* Profile Summary */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Profile Summary
        </h3>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Real Name:</span>
            <span className="font-medium">{data.realName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Username:</span>
            <span className="font-medium">@{data.username}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Email:</span>
            <span className="font-medium">{data.email}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-500">Interests:</span>
            <div className="flex flex-wrap gap-1 justify-end">
              {data.interests?.slice(0, 3).map((interest, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs">
                  {interest}
                </span>
              ))}
              {data.interests?.length > 3 && (
                <span className="text-xs text-gray-500">+{data.interests.length - 3}</span>
              )}
            </div>
          </div>

          {data.linkedinVerified && (
            <div className="flex justify-between">
              <span className="text-gray-500">LinkedIn:</span>
              <span className="font-medium text-green-600">✓ Doğrulandı</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          disabled={isLoading}
          className="flex-1 py-4 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={onSubmit}
          disabled={isLoading}
          className="flex-1 py-4 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all transform hover:scale-[1.02] disabled:opacity-50"
        >
          {isLoading ? 'Setting up...' : 'Go to Dashboard'}
        </button>
      </div>
    </div>
  );
}

// Main Auth Component
export default function Auth() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    // Step 1
    interests: [],
    lifeExpectations: "",
    whatBroughtYouHere: "",
    // Step 2
    realName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    // Step 3 - LinkedIn OAuth
    linkedinLink: "",
    linkedinVerified: false,
  });

  const updateFormData = (newData) => {
    setFormData(prev => ({ ...prev, ...newData }));
  };

  const addUserSupabase = async () => {
    setIsLoading(true);
    setError(null);
    console.log("Starting signup process...");
    
    try {
      // Step 1: Sign up with Supabase Auth
      console.log("Signing up with email:", formData.email);
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        console.error("Auth error:", authError);
        // Handle "User already registered" error
        if (authError.message?.includes('already registered')) {
          throw new Error('Bu email zaten kayıtlı. Lütfen giriş yapın veya farklı email kullanın.');
        }
        throw authError;
      }
      if (!authData.user) {
        console.error("No user returned from auth");
        throw new Error("User creation failed");
      }
      
      console.log("Auth successful, user ID:", authData.user.id);

      // Step 2: Insert profile with the new user's ID
      const profileData = {
        id: authData.user.id,
        username: formData.username,
        real_name: formData.realName,
        email: formData.email,
        email_verified: true,
        interests: formData.interests,
        life_expectations: formData.lifeExpectations,
        what_brought_you_here: formData.whatBroughtYouHere,
        // LinkedIn OAuth
        linkedin_link: formData.linkedinLink || null,
        linkedin_verified: formData.linkedinVerified,
        // Visibility settings
        is_public_in_recommendations: true,
  
      };

      console.log("Inserting profile...");
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(profileData, { onConflict: 'id' });

      if (profileError) {
        console.error("Profile insert error:", profileError);
        throw profileError;
      }

      console.log("Profile created, navigating to login...");
      navigate('/login');
    } catch (err) {
      console.error("Signup error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8">
        <ProgressBar currentStep={step} totalSteps={3} />
        
        {step === 1 && (
          <StepOne
            data={formData}
            onChange={updateFormData}
            onNext={() => setStep(2)}
          />
        )}
        
        {step === 2 && (
          <StepTwo
            data={formData}
            onChange={updateFormData}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        
        {step === 3 && (
          <StepThree
            data={formData}
            onChange={updateFormData}
            onSubmit={addUserSupabase}
            onBack={() => setStep(2)}
            isLoading={isLoading}
            error={error}
          />
        )}
      </div>
    </div>
  );
}
