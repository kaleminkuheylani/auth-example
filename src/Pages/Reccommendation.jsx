import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Sidebar from "../Components/Sidebar";

// Message limit constant
const MESSAGE_START_LIMIT = 20;

// Calculate seriousness score based on profile completeness, verification and engagement
function calculateSeriousnessScore(profile) {
  let score = 0;
  score += 10;
  if (profile.like_count) {
    score += Math.min(profile.like_count * 20, 20);
  }
  if (profile.login_count) {
    if (profile.login_count >= 50) score += 15;
    else if (profile.login_count >= 20) score += 10;
    else if (profile.login_count >= 5) score += 5;
  }
  if (profile.total_gifts_sent || profile.total_gifts_received) {
    const totalGiftActivity = (profile.total_gifts_sent || 0) + (profile.total_gifts_received || 0);
    if (totalGiftActivity >= 20) score += 15;
    else if (totalGiftActivity >= 10) score += 10;
    else if (totalGiftActivity >= 3) score += 5;
  }
  return Math.min(score, 100);
}

// Message limit hook
export function useMessageLimit(userId) {
  const [messagesStarted, setMessagesStarted] = useState(0);
  const [canStartMessage, setCanStartMessage] = useState(true);

  useEffect(() => {
    if (!userId) return;
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
    limit: MESSAGE_START_LIMIT,
  };
}

// Report Modal
function ReportModal({ targetUser, onClose, reporterId }) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const reasons = [
    { value: 'harassment', label: 'Taciz / Rahatsız edici davranış' },
    { value: 'fake_profile', label: 'Sahte profil' },
    { value: 'inappropriate', label: 'Uygunsuz içerik' },
    { value: 'spam', label: 'Spam' },
    { value: 'other', label: 'Diğer' },
  ];

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await supabase.from('reports').insert({
        reporter_id: reporterId,
        reported_id: targetUser.id,
        reason,
        description: description.trim() || null,
      });
      setDone(true);
    } catch (err) {
      alert("Rapor gönderilemedi: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        {done ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Rapor Gönderildi</h3>
            <p className="text-gray-600 text-sm mb-4">Raporunuz incelemeye alındı. Güvenliğiniz bizim önceliğimiz.</p>
            <button onClick={onClose} className="px-6 py-2 bg-red-500 text-white rounded-xl font-medium">Kapat</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">@{targetUser.username} Bildir</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 mb-4">
              {reasons.map(r => (
                <label key={r.value} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${reason === r.value ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="text-red-500" />
                  <span className="text-sm font-medium text-gray-700">{r.label}</span>
                </label>
              ))}
            </div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ek açıklama (isteğe bağlı)..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 resize-none text-sm mb-4"
              rows={3}
            />
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50">İptal</button>
              <button
                onClick={handleSubmit}
                disabled={!reason || submitting}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 disabled:opacity-50"
              >
                {submitting ? 'Gönderiliyor...' : 'Bildir'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// User card component
function UserCard({ user, onStartChat, canStartMessage, currentUser, onBlock, isWoman }) {
  const navigate = useNavigate();
  const seriousnessScore = calculateSeriousnessScore(user);
  const [showReport, setShowReport] = useState(false);

  const getScoreColor = (score) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-blue-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-gray-400";
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return "Yüksek";
    if (score >= 60) return "İyi";
    if (score >= 40) return "Orta";
    return "Düşük";
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden">
        {/* Card header with gradient */}
        <div className="h-2 bg-gradient-to-r from-red-500 to-pink-500" />

        <div className="p-4">
          {/* User identity row */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-14 h-14 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {user.username?.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-800">@{user.username}</h3>
              <p className="text-sm text-gray-500">{user.real_name}</p>
              {/* Verification badges */}
              <div className="flex flex-wrap gap-1 mt-1">
                {user.verified && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Yüz Doğrulandı
                  </span>
                )}
                {user.linkedin_verified && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    LinkedIn
                  </span>
                )}
              </div>
            </div>
            {/* Seriousness Score */}
            <div className="flex flex-col items-center">
              <div className={`${getScoreColor(seriousnessScore)} text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm`}>
                {seriousnessScore}
              </div>
              <span className="text-xs text-gray-400 mt-0.5">{getScoreLabel(seriousnessScore)}</span>
            </div>
          </div>

          {/* Interests */}
          {user.interests?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {user.interests.slice(0, 3).map((interest, idx) => (
                <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {interest}
                </span>
              ))}
              {user.interests.length > 3 && (
                <span className="text-xs text-gray-400 px-1">+{user.interests.length - 3}</span>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => onStartChat(user.id)}
              disabled={!canStartMessage || user.id === currentUser?.id}
              className="flex-1 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg font-medium text-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Mesaj Başlat
            </button>
            <button
              onClick={() => navigate(`/references/${user.id}`)}
              className="px-3 py-2 border-2 border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-all text-sm"
              title="Referansları Gör"
            >
              Refs
            </button>
            {/* Block & Report — only shown for women or if different user */}
            {isWoman && user.id !== currentUser?.id && (
              <>
                <button
                  onClick={() => onBlock(user.id, user.username)}
                  className="px-3 py-2 border-2 border-orange-200 text-orange-500 rounded-lg hover:bg-orange-50 transition-all text-sm"
                  title="Engelle"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowReport(true)}
                  className="px-3 py-2 border-2 border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-all text-sm"
                  title="Bildir"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showReport && (
        <ReportModal
          targetUser={user}
          onClose={() => setShowReport(false)}
          reporterId={currentUser?.id}
        />
      )}
    </>
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
  const [blockedIds, setBlockedIds] = useState(new Set());
  // Safety mode: women see only verified men by default
  const [safetyMode, setSafetyMode] = useState(false);
  const [showUnverified, setShowUnverified] = useState(false);
  const { messagesStarted, canStartMessage, remainingMessages, incrementMessageCount, limit } = useMessageLimit(currentUser?.id);

  const isWoman = currentUser?.gender === 'female';

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setCurrentUser({ ...user, ...profile });
        setIsPublic(profile?.is_public_in_recommendations ?? true);
        setSafetyMode(profile?.safety_mode ?? false);
      } else {
        setCurrentUser(user);
      }
    };
    getCurrentUser();
  }, []);

  // Load blocked users list
  useEffect(() => {
    if (!currentUser?.id) return;
    const fetchBlocked = async () => {
      const { data } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', currentUser.id);
      if (data) setBlockedIds(new Set(data.map(b => b.blocked_id)));
    };
    fetchBlocked();
  }, [currentUser?.id]);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      let query = supabase
        .from('profiles')
        .select('*')
        .eq('is_public_in_recommendations', true);

      // Gender-based filtering: show opposite gender by default
      if (currentUser?.gender === 'female') {
        query = query.eq('gender', 'male');
        // Safety mode: only verified men
        if (safetyMode && !showUnverified) {
          query = query.eq('verified', true);
        }
      } else if (currentUser?.gender === 'male') {
        query = query.eq('gender', 'female');
      }
      // 'other' sees everyone

      const { data, error } = await query;
      if (!error && data) {
        const usersWithScores = data
          .filter(u => u.id !== currentUser?.id)
          .filter(u => !blockedIds.has(u.id))
          .map(user => ({
            ...user,
            seriousnessScore: calculateSeriousnessScore(user),
          }));

        const sortedUsers = usersWithScores.sort((a, b) =>
          b.seriousnessScore - a.seriousnessScore
        );
        setUsers(sortedUsers);
      }
      setLoading(false);
    };

    if (currentUser !== null) fetchUsers();
  }, [currentUser, blockedIds, safetyMode, showUnverified]);

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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { alert("Oturum bulunamadı"); return; }

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
        navigate(`/messages?room=${data.room.id}`);
      } else {
        alert("Sohbet başlatılırken hata: " + (data.message || "Bilinmeyen hata"));
      }
    } catch (err) {
      alert("Sohbet başlatılırken hata: " + err.message);
    }
  };

  const handleBlock = async (targetId, targetUsername) => {
    if (!window.confirm(`@${targetUsername} kullanıcısını engellemek istediğinize emin misiniz?`)) return;
    try {
      await supabase.from('blocked_users').insert({ blocker_id: currentUser.id, blocked_id: targetId });
      setBlockedIds(prev => new Set([...prev, targetId]));
      setUsers(prev => prev.filter(u => u.id !== targetId));
    } catch (err) {
      alert("Engelleme başarısız: " + err.message);
    }
  };

  const toggleVisibility = async () => {
    if (!currentUser) return;
    setIsToggling(true);
    const newValue = !isPublic;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_public_in_recommendations: newValue })
        .eq('id', currentUser.id);
      if (error) throw error;
      setIsPublic(newValue);
    } catch (err) {
      alert("Ayar güncellenirken hata: " + err.message);
    } finally {
      setIsToggling(false);
    }
  };

  const toggleSafetyMode = async () => {
    const newValue = !safetyMode;
    setSafetyMode(newValue);
    await supabase
      .from('profiles')
      .update({ safety_mode: newValue })
      .eq('id', currentUser.id);
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
      <Sidebar user={currentUser} />

      <main className="flex-1 p-4 overflow-auto">
        <div className="max-w-6xl mx-auto">

          {/* Safety banner for women */}
          {isWoman && (
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-4 mb-4 text-white">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Güvenlik Modu</p>
                  <p className="text-white/80 text-xs mt-0.5">
                    {safetyMode
                      ? "Yalnızca yüz doğrulaması tamamlanmış kullanıcılar gösteriliyor."
                      : "Tüm kullanıcılar gösteriliyor. Güvenlik modunu açarak yalnızca doğrulanmış kişileri görün."}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-white/70">{safetyMode ? "Aktif" : "Kapalı"}</span>
                  <button
                    onClick={toggleSafetyMode}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      safetyMode ? 'bg-green-400' : 'bg-white/30'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${safetyMode ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
              {safetyMode && (
                <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between">
                  <span className="text-xs text-white/70">Doğrulanmamış kullanıcıları da gör</span>
                  <button
                    onClick={() => setShowUnverified(!showUnverified)}
                    className={`text-xs px-3 py-1 rounded-full border border-white/40 transition-all ${showUnverified ? 'bg-white/20' : 'hover:bg-white/10'}`}
                  >
                    {showUnverified ? "Gizle" : "Göster"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Header */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold text-gray-800">Öneriler</h1>
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
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              )}
            </div>
            <p className="text-gray-600 text-sm">
              {isWoman
                ? "Seriyet skoruna göre sıralanan, doğrulanmış erkekler"
                : "Ciddiyet skoruna göre sıralanan kullanıcılar"}
            </p>

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
                currentUser={currentUser}
                onBlock={handleBlock}
                isWoman={isWoman}
              />
            ))}
          </div>

          {users.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl shadow-md">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-gray-500">
                {isWoman && safetyMode
                  ? "Henüz doğrulanmış kullanıcı bulunmuyor. Güvenlik modunu kapatarak daha fazla kullanıcı görebilirsiniz."
                  : "Henüz kullanıcı bulunmuyor."}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
