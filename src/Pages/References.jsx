import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

// References Page - View and write references for a user
export default function References() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [targetUser, setTargetUser] = useState(null);
  const [references, setReferences] = useState([]);
  const [newReference, setNewReference] = useState("");
  const [rating, setRating] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasWrittenReference, setHasWrittenReference] = useState(false);
  const [canWriteReference, setCanWriteReference] = useState(false);
  const [daysUntilReference, setDaysUntilReference] = useState(null);
  const [conversationStartDate, setConversationStartDate] = useState(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      setLoading(true);
      
      // Fetch target user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        setError("Kullanıcı bulunamadı");
        setLoading(false);
        return;
      }
      setTargetUser(profileData);

      // Fetch references for this user
      const { data: refsData, error: refsError } = await supabase
        .from('references_data')
        .select(`
          *,
          from_user:profiles!references_data_from_user_id_fkey(username, real_name)
        `)
        .eq('to_user_id', userId)
        .order('created_at', { ascending: false });

      if (!refsError && refsData) {
        setReferences(refsData);
        
        // Check if current user has already written a reference
        if (currentUser) {
          const hasWritten = refsData.some(ref => ref.from_user_id === currentUser.id);
          setHasWrittenReference(hasWritten);
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [userId, currentUser]);

  const handleSubmitReference = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      alert("Lütfen önce giriş yapın");
      return;
    }

    if (!newReference.trim() || newReference.length < 10) {
      alert("Referans en az 10 karakter olmalıdır");
      return;
    }

    if (currentUser.id === userId) {
      alert("Kendiniz için referans yazamazsınız");
      return;
    }

    try {
      const { error } = await supabase
        .from('references_data')
        .insert({
          from_user_id: currentUser.id,
          to_user_id: userId,
          content: newReference.trim(),
          rating: rating,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Refresh references
      const { data: newRefs } = await supabase
        .from('references_data')
        .select(`
          *,
          from_user:profiles!references_data_from_user_id_fkey(username, real_name)
        `)
        .eq('to_user_id', userId)
        .order('created_at', { ascending: false });

      setReferences(newRefs || []);
      setNewReference("");
      setHasWrittenReference(true);
      alert("Referansınız başarıyla eklendi! +5 ciddiyet puanı");
    } catch (err) {
      alert("Referans eklenirken hata: " + err.message);
    }
  };

  const handleDeleteReference = async (referenceId) => {
    if (!confirm("Bu referansı silmek istediğinize emin misiniz?")) return;

    try {
      const { error } = await supabase
        .from('references_data')
        .delete()
        .eq('id', referenceId)
        .eq('from_user_id', currentUser.id);

      if (error) throw error;

      setReferences(prev => prev.filter(ref => ref.id !== referenceId));
      setHasWrittenReference(false);
    } catch (err) {
      alert("Referans silinirken hata: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (error || !targetUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">{error || "Kullanıcı bulunamadı"}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg"
          >
            Geri Dön
          </button>
        </div>
      </div>
    );
  }

  const averageRating = references.length > 0
    ? (references.reduce((sum, ref) => sum + ref.rating, 0) / references.length).toFixed(1)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
          >
            ← Geri
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {targetUser.username?.charAt(0).toUpperCase() || "?"}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">@{targetUser.username}</h1>
              <p className="text-gray-500">{targetUser.real_name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-yellow-500">⭐</span>
                <span className="font-semibold">{averageRating}</span>
                <span className="text-gray-400">({references.length} referans)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Write Reference Form */}
        {currentUser && currentUser.id !== userId && !hasWrittenReference && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Referans Yaz</h2>
            <form onSubmit={handleSubmitReference} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Puan
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`text-2xl transition-all ${
                        star <= rating ? 'text-yellow-400' : 'text-gray-300'
                      }`}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Referansınız
                </label>
                <textarea
                  value={newReference}
                  onChange={(e) => setNewReference(e.target.value)}
                  placeholder="Bu kişi hakkında düşüncelerinizi yazın..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all resize-none"
                  rows={4}
                  minLength={10}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  En az 10 karakter. Her referans +5 ciddiyet puanı kazandırır.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                Referans Gönder
              </button>
            </form>
          </div>
        )}

        {hasWrittenReference && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <p className="text-green-700">Bu kullanıcı için zaten bir referans yazdınız.</p>
          </div>
        )}

        {/* References List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Referanslar</h2>
          
          {references.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <p className="text-gray-500">Henüz referans yok. İlk referansı siz yazın!</p>
            </div>
          ) : (
            references.map((ref) => (
              <div key={ref.id} className="bg-white rounded-xl shadow-md p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                      {ref.from_user?.username?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">
                        @{ref.from_user?.username || "Anonim"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(ref.created_at).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-400">⭐</span>
                    <span className="font-semibold">{ref.rating}</span>
                  </div>
                </div>
                
                <p className="text-gray-700 leading-relaxed">{ref.content}</p>
                
                {currentUser && ref.from_user_id === currentUser.id && (
                  <button
                    onClick={() => handleDeleteReference(ref.id)}
                    className="mt-3 text-sm text-red-500 hover:text-red-700"
                  >
                    Referansı Sil
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
