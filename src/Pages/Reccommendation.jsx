import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Sidebar from "../Components/Sidebar";

// Message limit constant
const MESSAGE_START_LIMIT = 20;

// Calculate seriousness score based on profile completeness, verification and engagement
function calculateSeriousnessScore(profile) {
  let score = 0;
  
  // Base score for having a profile
  score += 10;
  

  
  // Like count (+2 points each, max 20)
  if (profile.like_count) {
    score += Math.min(profile.like_count * 20, 20);
  }
  
  // App engagement - Login frequency (+15 points max)
  if (profile.login_count) {
    if (profile.login_count >= 50) score += 15;
    else if (profile.login_count >= 20) score += 10;
    else if (profile.login_count >= 5) score += 5;
  }
  
  // Gift activity - Shows community engagement (+15 points max)
  if (profile.total_gifts_sent || profile.total_gifts_received) {
    const totalGiftActivity = (profile.total_gifts_sent || 0) + (profile.total_gifts_received || 0);
    if (totalGiftActivity >= 20) score += 15;
    else if (totalGiftActivity >= 10) score += 10;
    else if (totalGiftActivity >= 3) score += 5;
  }
  
  return Math.min(score, 100); // Cap at 100
}

// Message limit hook
export function useMessageLimit(userId) {
  const [messagesStarted, setMessagesStarted] = useState(0);
  const [canStartMessage, setCanStartMessage] = useState(true);

  useEffect(() => {
    if (!userId) return;
    
    // Fetch count of messages started by this user
    const fetchMessageCount = async () => {
      const { count, error } = await supabase
        .from('conversations')
        .select('*', { count: 'exact' })
        .eq('initiator_id', userId);
      
      if (!error && count !== null) {
        setMessagesStarted(count);
        setCanStartMessage(count < MESSAGE_START_LIMIT);
      }
    };
    
    fetchMessageCount();
  }, [userId]);

  const incrementMessageCount = () => {
    setMessagesStarted(prev => {
      const newCount = prev + 1;
      setCanStartMessage(newCount < MESSAGE_START_LIMIT);
      return newCount;
    });
  };

  return {
    messagesStarted,
    canStartMessage,
    remainingMessages: MESSAGE_START_LIMIT - messagesStarted,
    incrementMessageCount,
    limit: MESSAGE_START_LIMIT
  };
}

// User card component
function UserCard({ user, onStartChat, canStartMessage, currentUserId }) {
  const navigate = useNavigate();
  const seriousnessScore = calculateSeriousnessScore(user);
  
  // Determine score badge color
  const getScoreColor = (score) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-blue-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-gray-400";
  };

  const handleStartChat = () => {
    if (!canStartMessage) {
      alert(`Mesaj başlatma limitine ulaştınız. Limit: ${MESSAGE_START_LIMIT}`);
      return;
    }
    onStartChat(user.id);
  };

  const handleViewReferences = () => {
    navigate(`/references/${user.id}`);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
          {user.username?.charAt(0).toUpperCase() || "?"}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800">@{user.username}</h3>
          <p className="text-sm text-gray-500">{user.real_name}</p>
        </div>
        {/* Seriousness Score Badge */}
        <div className={`${getScoreColor(seriousnessScore)} text-white px-3 py-1 rounded-full text-sm font-bold`}>
          {seriousnessScore}
        </div>
      </div>
      
      
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 flex-wrap">
        {user.verified && (
          <span className="flex items-center gap-1 text-green-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Verified
          </span>
        )}
        {user.email_verified && (
          <span className="flex items-center gap-1 text-blue-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            Email
          </span>
        )}
        {/* Personal Links Icons - Only show if visibility is enabled */}
        {user.instagram_link && user.show_instagram !== false && <span title="Instagram">📷</span>}
        {user.twitter_link && user.show_twitter !== false && <span title="Twitter">🐦</span>}
        {user.linkedin_link && user.show_linkedin !== false && <span title="LinkedIn">💼</span>}
        {user.github_link && user.show_github !== false && <span title="GitHub">💻</span>}
        {user.website_link && user.show_website !== false && <span title="Website">🌐</span>}
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={handleStartChat}
          disabled={!canStartMessage || user.id === currentUserId}
          className="flex-1 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg font-medium hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Mesaj Başlat
        </button>
        <button
          onClick={handleViewReferences}
          className="px-3 py-2 border-2 border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
          title="Referansları Gör"
        >
          📝
        </button>
      </div>
    </div>
  );
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Main Recommendation Component
export default function Recommendation() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [isPublic, setIsPublic] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const { messagesStarted, canStartMessage, remainingMessages, incrementMessageCount, limit } = useMessageLimit(currentUser?.id);

  useEffect(() => {
    // Get current user with profile
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch profile data
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setCurrentUser({ ...user, ...profile });
        setIsPublic(profile?.is_public_in_recommendations ?? true);
      } else {
        setCurrentUser(user);
      }
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    // Fetch and sort users by seriousness score
    const fetchUsers = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_public_in_recommendations', true);
      
      if (!error && data) {
        // Calculate scores and sort (highest first)
        const usersWithScores = data.map(user => ({
          ...user,
          seriousnessScore: calculateSeriousnessScore(user)
        }));
        
        const sortedUsers = usersWithScores.sort((a, b) => 
          b.seriousnessScore - a.seriousnessScore
        );
        
        setUsers(sortedUsers);
      }
      setLoading(false);
    };
    
    fetchUsers();
  }, []);

  const handleStartChat = async (targetUserId) => {
    if (!currentUser) {
      alert("Lütfen önce giriş yapın");
      return;
    }
    
    if (!canStartMessage) {
      alert(`Mesaj başlatma limitine ulaştınız. Limit: ${limit}`);
      return;
    }

    try {
      // Get session for API call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("Oturum bulunamadı");
        return;
      }

      // Create or get existing room via API
      const response = await fetch(`${API_URL}/chat/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ recipient_id: targetUserId }),
      });

      const data = await response.json();
      if (data.success && data.room) {
        incrementMessageCount();
        // Navigate to messages with the room selected
        navigate(`/messages?room=${data.room.id}`);
      } else {
        alert("Sohbet başlatılırken hata: " + (data.message || "Bilinmeyen hata"));
      }
    } catch (err) {
      alert("Sohbet başlatılırken hata: " + err.message);
    }
  };

  const toggleVisibility = async () => {
    if (!currentUser) {
      alert("Lütfen önce giriş yapın");
      return;
    }

    setIsToggling(true);
    const newValue = !isPublic;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_public_in_recommendations: newValue })
        .eq('id', currentUser.id);

      if (error) throw error;

      setIsPublic(newValue);
      alert(newValue 
        ? "Profiliniz keşfette görünür hale getirildi." 
        : "Profiliniz keşfette gizlendi."
      );
    } catch (err) {
      alert("Ayar güncellenirken hata: " + err.message);
    } finally {
      setIsToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar user={currentUser} />

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold text-gray-800">Öneriler</h1>
              
              {/* Visibility Toggle */}
              {currentUser && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">
                    {isPublic ? "Keşfette Görünür" : "Keşfette Gizli"}
                  </span>
                  <button
                    onClick={toggleVisibility}
                    disabled={isToggling}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
                      isPublic ? 'bg-green-500' : 'bg-gray-300'
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isPublic ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>
            <p className="text-gray-600">Ciddiyet skoruna göre sıralanan kullanıcılar</p>
            
            {/* Message Limit Indicator */}
            <div className="mt-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Mesaj Başlatma Hakkı</span>
                  <span className={`font-semibold ${remainingMessages <= 5 ? 'text-red-500' : 'text-green-600'}`}>
                    {remainingMessages} / {limit}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${remainingMessages <= 5 ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${(remainingMessages / limit) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            
            {!canStartMessage && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">
                  Mesaj başlatma limitine ulaştınız. Daha fazla mesaj başlatmak için profilinizi tamamlayın veya doğrulama yapın.
                </p>
              </div>
            )}
          </div>

          {/* Users Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map(user => (
              <UserCard
                key={user.id}
                user={user}
                onStartChat={handleStartChat}
                canStartMessage={canStartMessage}
                currentUserId={currentUser?.id}
              />
            ))}
          </div>

          {users.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Henüz kullanıcı bulunmuyor.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
