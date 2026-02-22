import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Sidebar from "../Components/Sidebar";

// Seriousness score (same as Recommendation page)
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

function ScoreRing({ score }) {
  const color =
    score >= 80 ? "#22c55e" :
    score >= 60 ? "#3b82f6" :
    score >= 40 ? "#eab308" :
    "#9ca3af";

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative w-20 h-20">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={radius}
          fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-gray-800">{score}</span>
      </div>
    </div>
  );
}

// Stat card for men's showcase
function StatCard({ icon, label, value, color = "red" }) {
  const colorMap = {
    red: "from-red-500 to-pink-500",
    blue: "from-blue-500 to-indigo-500",
    green: "from-green-500 to-emerald-500",
    purple: "from-purple-500 to-violet-500",
  };
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
      <div className={`w-10 h-10 bg-gradient-to-r ${colorMap[color]} rounded-full flex items-center justify-center mx-auto mb-2`}>
        <span className="text-white text-lg">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-800">{value ?? 0}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

// Edit bio modal
function EditBioModal({ current, onSave, onClose }) {
  const [bio, setBio] = useState(current || "");
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Bio Düzenle</h3>
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value)}
          placeholder="Kendinizi tanıtın — hobiler, meslek, hayalleriniz..."
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 resize-none"
          rows={5}
          maxLength={400}
        />
        <p className="text-xs text-gray-400 text-right mt-1">{bio.length}/400</p>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50">İptal</button>
          <button onClick={() => onSave(bio)} className="flex-1 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-medium">Kaydet</button>
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [references, setReferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingBio, setEditingBio] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [safetyMode, setSafetyMode] = useState(false);

  const isMan = profile?.gender === 'male';
  const isWoman = profile?.gender === 'female';

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }

      const [{ data: prof }, { data: refs }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('references_data').select('*').eq('to_user_id', user.id).order('created_at', { ascending: false }),
      ]);

      setProfile({ ...prof, id: user.id });
      setReferences(refs || []);
      setIsPublic(prof?.is_public_in_recommendations ?? true);
      setSafetyMode(prof?.safety_mode ?? false);
      setLoading(false);
    };
    load();
  }, []);

  const saveBio = async (bio) => {
    setSavingBio(true);
    try {
      await supabase.from('profiles').update({ bio }).eq('id', profile.id);
      setProfile(prev => ({ ...prev, bio }));
      setEditingBio(false);
    } catch (err) {
      alert("Bio kaydedilemedi: " + err.message);
    } finally {
      setSavingBio(false);
    }
  };

  const toggleVisibility = async () => {
    const newValue = !isPublic;
    setIsPublic(newValue);
    await supabase.from('profiles').update({ is_public_in_recommendations: newValue }).eq('id', profile.id);
  };

  const toggleSafetyMode = async () => {
    const newValue = !safetyMode;
    setSafetyMode(newValue);
    await supabase.from('profiles').update({ safety_mode: newValue }).eq('id', profile.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  const score = calculateSeriousnessScore(profile);
  const avgRating = references.length > 0
    ? (references.reduce((sum, r) => sum + (r.rating || 0), 0) / references.length).toFixed(1)
    : null;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar user={profile} />

      <main className="flex-1 p-4 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* ── SHOWCASE HEADER (erkekler için geniş alan) ── */}
          <div className="bg-white rounded-2xl shadow-md overflow-hidden">
            {/* Cover gradient */}
            <div className={`h-28 ${isMan ? 'bg-gradient-to-r from-slate-700 via-gray-800 to-slate-900' : 'bg-gradient-to-r from-purple-500 via-pink-500 to-rose-400'}`} />

            <div className="px-6 pb-6">
              {/* Avatar + score */}
              <div className="flex items-end justify-between -mt-10 mb-4">
                <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-pink-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white text-3xl font-bold">
                  {profile.username?.charAt(0).toUpperCase() || "?"}
                </div>
                <ScoreRing score={score} />
              </div>

              {/* Name + badges */}
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{profile.real_name || profile.username}</h1>
                {profile.verified && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full font-medium">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Yüz Doğrulandı
                  </span>
                )}
                {profile.linkedin_verified && (
                  <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    LinkedIn
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-sm mb-4">@{profile.username}</p>

              {/* Bio section */}
              <div className="bg-gray-50 rounded-xl p-4 relative group">
                {profile.bio ? (
                  <p className="text-gray-700 text-sm leading-relaxed">{profile.bio}</p>
                ) : (
                  <p className="text-gray-400 text-sm italic">
                    {isMan
                      ? "Kendinizi tanıtın — hobiler, mesleğiniz, hayalleriniz... İyi bir bio daha fazla ilgi çeker."
                      : "Bio ekleyin..."}
                  </p>
                )}
                <button
                  onClick={() => setEditingBio(true)}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
                  title="Bio düzenle"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* ── SHOWCASE STATS (erkekler için) ── */}
          {isMan && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 px-1">Profil İstatistikleri</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon="❤️" label="Beğeni" value={profile.like_count} color="red" />
                <StatCard icon="📝" label="Referans" value={references.length} color="blue" />
                <StatCard icon="⭐" label="Ort. Puan" value={avgRating ?? "—"} color="purple" />
                <StatCard icon="🔐" label="Giriş" value={profile.login_count} color="green" />
              </div>
            </div>
          )}

          {/* ── INTERESTS ── */}
          {profile.interests?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span>Ilgi Alanları</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((interest, idx) => (
                  <span key={idx} className="px-3 py-1.5 bg-gradient-to-r from-red-50 to-pink-50 text-red-600 border border-red-100 rounded-full text-sm font-medium">
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── LIFE EXPECTATIONS (erkek showcase) ── */}
          {isMan && (profile.life_expectations || profile.what_brought_you_here) && (
            <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
              <h2 className="font-semibold text-gray-800">Benim Hakkımda</h2>
              {profile.life_expectations && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Hayattan Beklentilerim</p>
                  <p className="text-gray-700 text-sm leading-relaxed">{profile.life_expectations}</p>
                </div>
              )}
              {profile.what_brought_you_here && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Buradaki Amacım</p>
                  <p className="text-gray-700 text-sm leading-relaxed">{profile.what_brought_you_here}</p>
                </div>
              )}
            </div>
          )}

          {/* ── REFERENCES ── */}
          {references.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-800">
                  Referanslar
                  <span className="ml-2 text-sm font-normal text-gray-400">({references.length})</span>
                </h2>
                {avgRating && (
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-400 text-lg">★</span>
                    <span className="font-bold text-gray-800">{avgRating}</span>
                    <span className="text-gray-400 text-sm">/ 5</span>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {references.slice(0, 3).map(ref => (
                  <div key={ref.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">Anonim kullanıcı</span>
                      <div className="flex text-yellow-400 text-xs">
                        {'★'.repeat(ref.rating || 0)}{'☆'.repeat(5 - (ref.rating || 0))}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">{ref.content}</p>
                  </div>
                ))}
                {references.length > 3 && (
                  <button
                    onClick={() => navigate(`/references/${profile.id}`)}
                    className="w-full text-center text-sm text-red-500 hover:text-red-600 font-medium py-2"
                  >
                    Tüm referansları gör ({references.length})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── VERIFICATION STATUS ── */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Doğrulama Durumu</h2>
            <div className="space-y-3">
              <div className={`flex items-center gap-3 p-3 rounded-xl ${profile.verified ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${profile.verified ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-800">Yüz Doğrulaması</p>
                  <p className="text-xs text-gray-500">{profile.verified ? "Kimliğiniz doğrulandı" : "Henüz tamamlanmadı"}</p>
                </div>
                {!profile.verified && (
                  <button
                    onClick={() => navigate('/verification')}
                    className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600"
                  >
                    Doğrula
                  </button>
                )}
              </div>

              <div className={`flex items-center gap-3 p-3 rounded-xl ${profile.email_verified ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${profile.email_verified ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-800">E-posta Doğrulaması</p>
                  <p className="text-xs text-gray-500">{profile.email_verified ? "E-posta doğrulandı" : "Doğrulanmadı"}</p>
                </div>
              </div>

              <div className={`flex items-center gap-3 p-3 rounded-xl ${profile.linkedin_verified ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${profile.linkedin_verified ? 'bg-blue-500' : 'bg-gray-300'}`}>
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-800">LinkedIn Doğrulaması</p>
                  <p className="text-xs text-gray-500">{profile.linkedin_verified ? "LinkedIn bağlandı" : "Bağlanmadı"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── PRIVACY & SAFETY SETTINGS ── */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Gizlilik ve Güvenlik</h2>
            <div className="space-y-4">
              {/* Visibility toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-sm text-gray-800">Keşfette Görün</p>
                  <p className="text-xs text-gray-500">Profiliniz öneri listesinde görünsün</p>
                </div>
                <button
                  onClick={toggleVisibility}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPublic ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Safety mode (women only) */}
              {isWoman && (
                <div className="flex items-center justify-between py-2 border-t border-gray-100">
                  <div>
                    <p className="font-medium text-sm text-gray-800">Güvenlik Modu</p>
                    <p className="text-xs text-gray-500">Sadece doğrulanmış erkekleri gör</p>
                  </div>
                  <button
                    onClick={toggleSafetyMode}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${safetyMode ? 'bg-purple-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${safetyMode ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {editingBio && (
        <EditBioModal
          current={profile.bio}
          onSave={saveBio}
          onClose={() => setEditingBio(false)}
        />
      )}
    </div>
  );
}
