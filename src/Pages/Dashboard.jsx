import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";

function calculateSeriousnessScore(profile) {
  let score = 0;
  score += 10;
  if (profile.like_count) score += Math.min(profile.like_count * 20, 20);
  if (profile.login_count) {
    if (profile.login_count >= 50) score += 15;
    else if (profile.login_count >= 20) score += 10;
    else if (profile.login_count >= 5) score += 5;
  }
  if (profile.total_gifts_sent || profile.total_gifts_received) {
    const total = (profile.total_gifts_sent || 0) + (profile.total_gifts_received || 0);
    if (total >= 20) score += 15;
    else if (total >= 10) score += 10;
    else if (total >= 3) score += 5;
  }
  return Math.min(score, 100);
}

// Checklist item for profile completeness
function CheckItem({ done, label, action, actionLabel }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl ${done ? 'opacity-60' : 'bg-yellow-50 border border-yellow-100'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-green-500' : 'bg-yellow-300'}`}>
        {done ? (
          <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        )}
      </div>
      <span className={`flex-1 text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-700 font-medium'}`}>{label}</span>
      {!done && action && (
        <button onClick={action} className="text-xs px-3 py-1 bg-yellow-400 text-yellow-900 rounded-lg font-medium hover:bg-yellow-500 transition-all">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// Safety tip card for women
function SafetyTip({ icon, title, desc }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-xl border border-purple-100">
      <span className="text-xl flex-shrink-0">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-purple-800">{title}</p>
        <p className="text-xs text-purple-600 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // Count unread messages
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)
        .neq('sender_id', user.id);

      setProfile({ ...prof, id: user.id });
      setUnreadCount(count || 0);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  const isMan = profile?.gender === 'male';
  const isWoman = profile?.gender === 'female';
  const score = calculateSeriousnessScore(profile);

  // Profile completion checklist for men
  const manChecklist = [
    { done: !!profile?.verified, label: "Yüz doğrulaması tamamla", action: () => navigate('/verification'), actionLabel: "Doğrula" },
    { done: !!profile?.linkedin_verified, label: "LinkedIn hesabını bağla", action: () => navigate('/profile'), actionLabel: "Bağla" },
    { done: !!profile?.bio, label: "Bio ekle (profilini öne çıkar)", action: () => navigate('/profile'), actionLabel: "Ekle" },
    { done: (profile?.interests?.length || 0) > 0, label: "İlgi alanlarını belirt", action: null, actionLabel: "" },
    { done: !!profile?.is_public_in_recommendations, label: "Keşfette görünür ol", action: () => navigate('/profile'), actionLabel: "Aç" },
  ];
  const completedSteps = manChecklist.filter(c => c.done).length;
  const completionPct = Math.round((completedSteps / manChecklist.length) * 100);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar user={profile} />

      <main className="flex-1 p-4 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-5">

          {/* ── Welcome header ── */}
          <div className={`rounded-2xl p-6 text-white shadow-md ${
            isMan
              ? 'bg-gradient-to-r from-slate-700 to-gray-900'
              : isWoman
              ? 'bg-gradient-to-r from-purple-600 to-pink-500'
              : 'bg-gradient-to-r from-red-500 to-pink-500'
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/70 text-sm font-medium mb-1">
                  {isMan ? "Merhaba," : isWoman ? "Hoş geldiniz," : "Merhaba,"}
                </p>
                <h1 className="text-2xl font-bold">{profile?.real_name || profile?.username}</h1>
                <p className="text-white/70 text-sm mt-1">@{profile?.username}</p>
              </div>

              {/* Score circle */}
              <div className="text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center border-2 border-white/40">
                  <span className="text-xl font-bold">{score}</span>
                </div>
                <p className="text-xs text-white/60 mt-1">Seriyet Skoru</p>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3 mt-5">
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-xl font-bold">{profile?.like_count || 0}</p>
                <p className="text-xs text-white/60">Beğeni</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center relative">
                <p className="text-xl font-bold">{unreadCount}</p>
                <p className="text-xs text-white/60">Yeni Mesaj</p>
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-yellow-400 rounded-full" />
                )}
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-xl font-bold">{profile?.login_count || 0}</p>
                <p className="text-xs text-white/60">Giriş</p>
              </div>
            </div>
          </div>

          {/* ── Quick actions ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => navigate('/recommendations')}
              className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-center"
            >
              <div className="text-2xl mb-1">👥</div>
              <p className="text-sm font-medium text-gray-700">Öneriler</p>
              <p className="text-xs text-gray-400">{isWoman ? "Erkekleri keşfet" : "Kadınları keşfet"}</p>
            </button>
            <button
              onClick={() => navigate('/messages')}
              className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-center relative"
            >
              <div className="text-2xl mb-1">💬</div>
              <p className="text-sm font-medium text-gray-700">Mesajlar</p>
              <p className="text-xs text-gray-400">{unreadCount > 0 ? `${unreadCount} okunmamış` : "Konuşmalar"}</p>
              {unreadCount > 0 && (
                <span className="absolute top-3 right-3 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-center"
            >
              <div className="text-2xl mb-1">👤</div>
              <p className="text-sm font-medium text-gray-700">Profil</p>
              <p className="text-xs text-gray-400">{isMan ? "Vitrinini düzenle" : "Ayarlar"}</p>
            </button>
            <button
              onClick={() => navigate('/wallet')}
              className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-center"
            >
              <div className="text-2xl mb-1">💰</div>
              <p className="text-sm font-medium text-gray-700">Cüzdan</p>
              <p className="text-xs text-gray-400">Bakiye & hediyeler</p>
            </button>
          </div>

          {/* ── MAN: Profile completeness checklist ── */}
          {isMan && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-gray-800">Profil Tamamlanma</h2>
                <span className="text-sm font-bold text-red-500">{completionPct}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-pink-500 rounded-full transition-all"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Profiliniz ne kadar eksiksiz olursa, kadınların güveni o kadar artar.
              </p>
              <div className="space-y-2">
                {manChecklist.map((item, idx) => (
                  <CheckItem key={idx} {...item} />
                ))}
              </div>
            </div>
          )}

          {/* ── WOMAN: Safety tips & controls ── */}
          {isWoman && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Güvenlik İpuçları
              </h2>
              <div className="space-y-3">
                <SafetyTip
                  icon="✅"
                  title="Yüz doğrulamalı erkekleri tercih edin"
                  desc="Öneriler sayfasında 'Güvenlik Modu'nu açarak yalnızca kimliği doğrulanmış kişileri görebilirsiniz."
                />
                <SafetyTip
                  icon="📝"
                  title="Referansları kontrol edin"
                  desc="Her kullanıcı kartında 'Refs' butonuyla o kişi hakkında önceki kullanıcıların yorumlarını okuyun."
                />
                <SafetyTip
                  icon="🚫"
                  title="Rahatsız edenleri engelleyin"
                  desc="Öneriler sayfasındaki 'engelle' butonuyla istemediğiniz kişileri listeden kaldırabilirsiniz."
                />
                <SafetyTip
                  icon="🔔"
                  title="Bildirin"
                  desc="Uygunsuz davranan biri varsa kart üzerindeki 'bildir' butonunu kullanın. Raporlar incelenir."
                />
              </div>
              <button
                onClick={() => navigate('/recommendations')}
                className="w-full mt-4 py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl font-semibold hover:shadow-md transition-all"
              >
                Önerileri Görüntüle
              </button>
            </div>
          )}

          {/* ── Verification CTA ── */}
          {!profile?.verified && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.869V15.13a1 1 0 01-1.447.894L15 14M3 8.5h12a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1v-7a1 1 0 011-1z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-800">Yüz Doğrulaması Bekliyor</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    {isMan
                      ? "Doğrulama tamamlandığında profiliniz öne çıkar ve daha fazla güven kazanırsınız."
                      : "Doğrulanmış profillerle buluşmak için yüz doğrulamasını tamamlayın."}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/verification')}
                  className="flex-shrink-0 px-4 py-2 bg-amber-500 text-white rounded-lg font-medium text-sm hover:bg-amber-600 transition-all"
                >
                  Başla
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
