import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Sidebar from "../Components/Sidebar";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Gift Package Card
function GiftPackageCard({ pkg, onSelect, selected }) {
  const getGiftEmoji = (name) => {
    switch (name) {
      case "flower": return "🌹";
      case "pink_heart": return "💗";
      case "red_heart": return "❤️";
      case "ring": return "💍";
      default: return "🎁";
    }
  };

  return (
    <div
      onClick={() => onSelect(pkg)}
      className={`p-4 rounded-xl cursor-pointer transition-all ${
        selected?.id === pkg.id
          ? "bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg scale-105"
          : "bg-white shadow-md hover:shadow-lg"
      }`}
    >
      <div className="text-4xl mb-2">{getGiftEmoji(pkg.name)}</div>
      <h4 className={`font-semibold ${selected?.id === pkg.id ? "text-white" : "text-gray-800"}`}>
        {pkg.name}
      </h4>
      <p className={`text-sm ${selected?.id === pkg.id ? "text-white/80" : "text-gray-500"}`}>
        {pkg.description}
      </p>
      <p className={`font-bold mt-2 ${selected?.id === pkg.id ? "text-white" : "text-red-500"}`}>
        {pkg.amount} coin
      </p>
    </div>
  );
}

// Gift History Item
function GiftHistoryItem({ gift, currentUserId }) {
  const isSent = gift.from_user_id === currentUserId;
  
  const getGiftEmoji = (name) => {
    switch (name) {
      case "flower": return "🌹";
      case "pink_heart": return "💗";
      case "red_heart": return "❤️";
      case "ring": return "💍";
      default: return "🎁";
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm">
      <div className="text-3xl">{gift.package ? getGiftEmoji(gift.package.name) : "🎁"}</div>
      <div className="flex-1">
        <p className="font-medium text-gray-800">
          {isSent ? (
            <>Gonderildi: <span className="text-red-500">@{gift.to_user?.username}</span></>
          ) : (
            <>Alindi: <span className="text-green-500">@{gift.from_user?.username}</span></>
          )}
        </p>
        <p className="text-sm text-gray-500">
          {new Date(gift.created_at).toLocaleDateString("tr-TR")}
        </p>
      </div>
      <div className={`font-bold ${isSent ? "text-red-500" : "text-green-500"}`}>
        {isSent ? `-${gift.amount}` : `+${gift.receiver_amount.toFixed(0)}`}
      </div>
    </div>
  );
}

// Main Wallet Component
export default function Wallet() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [balance, setBalance] = useState({ balance: 0, total_received: 0, total_sent: 0 });
  const [packages, setPackages] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [recipientId, setRecipientId] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState("send"); // 'send' | 'history'

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      setToken(session.access_token);
      setCurrentUser(session.user);
      await Promise.all([
        fetchBalance(session.access_token),
        fetchPackages(),
        fetchHistory(session.access_token),
      ]);
      setLoading(false);
    };
    init();
  }, []);

  const fetchBalance = async (accessToken) => {
    try {
      const response = await fetch(`${API_URL}/gifts/balance`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      if (data.success) {
        setBalance(data);
      }
    } catch (err) {
      console.error("Error fetching balance:", err);
    }
  };

  const fetchPackages = async () => {
    try {
      const response = await fetch(`${API_URL}/gifts/packages`);
      const data = await response.json();
      if (data.success) {
        setPackages(data.packages);
      }
    } catch (err) {
      console.error("Error fetching packages:", err);
    }
  };

  const fetchHistory = async (accessToken) => {
    try {
      const response = await fetch(`${API_URL}/gifts/history?limit=20`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      if (data.success) {
        setHistory(data.gifts);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  const handleSendGift = async () => {
    if (!selectedPackage || !recipientId.trim()) {
      alert("Lutfen bir hediye ve alici secin");
      return;
    }

    if (balance.balance < selectedPackage.amount) {
      alert("Yetersiz bakiye");
      return;
    }

    try {
      setSending(true);
      const response = await fetch(`${API_URL}/gifts/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to_user_id: recipientId.trim(),
          package_id: selectedPackage.id,
        }),
      });
      const data = await response.json();
      if (data.success) {
        alert("Hediye basariyla gonderildi!");
        setSelectedPackage(null);
        setRecipientId("");
        await fetchBalance(token);
        await fetchHistory(token);
      } else {
        alert("Hata: " + data.message);
      }
    } catch (err) {
      alert("Hediye gonderilirken hata: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleAddTestBalance = async () => {
    try {
      const response = await fetch(`${API_URL}/gifts/add-balance?amount=1000`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        await fetchBalance(token);
      }
    } catch (err) {
      alert("Bakiye eklenirken hata: " + err.message);
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
        <div className="max-w-4xl mx-auto">
          {/* Balance Card */}
          <div className="bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl shadow-lg p-6 mb-6 text-white">
            <h2 className="text-lg opacity-80 mb-2">Bakiyeniz</h2>
            <p className="text-4xl font-bold mb-4">{balance.balance.toFixed(0)} coin</p>
            <div className="flex gap-8 text-sm">
              <div>
                <p className="opacity-70">Toplam Alinan</p>
                <p className="font-semibold">{balance.total_received.toFixed(0)} coin</p>
              </div>
              <div>
                <p className="opacity-70">Toplam Gonderilen</p>
                <p className="font-semibold">{balance.total_sent.toFixed(0)} coin</p>
              </div>
            </div>
            {/* Test Button - Remove in production */}
            <button
              onClick={handleAddTestBalance}
              className="mt-4 px-4 py-2 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition-colors"
            >
              +1000 Test Coin Ekle
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab("send")}
              className={`px-6 py-2 rounded-full font-medium transition-colors ${
                activeTab === "send"
                  ? "bg-gradient-to-r from-red-500 to-pink-500 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              Hediye Gonder
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-6 py-2 rounded-full font-medium transition-colors ${
                activeTab === "history"
                  ? "bg-gradient-to-r from-red-500 to-pink-500 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              Gecmis
            </button>
          </div>

          {activeTab === "send" ? (
            <>
              {/* Gift Packages */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Hediye Sec</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {packages.map((pkg) => (
                    <GiftPackageCard
                      key={pkg.id}
                      pkg={pkg}
                      onSelect={setSelectedPackage}
                      selected={selectedPackage}
                    />
                  ))}
                </div>
              </div>

              {/* Recipient Input */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Alici</h3>
                <input
                  type="text"
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  placeholder="Alici kullanici ID'si"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4"
                />
                <button
                  onClick={handleSendGift}
                  disabled={!selectedPackage || !recipientId.trim() || sending}
                  className="w-full py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? "Gonderiliyor..." : `Hediye Gonder (${selectedPackage?.amount || 0} coin)`}
                </button>
              </div>
            </>
          ) : (
            /* History Tab */
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Hediye Gecmisi</h3>
              {history.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-xl">
                  <p className="text-gray-500">Henuz hediye islemi yok.</p>
                </div>
              ) : (
                history.map((gift) => (
                  <GiftHistoryItem
                    key={gift.id}
                    gift={gift}
                    currentUserId={currentUser?.id}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
