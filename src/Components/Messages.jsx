import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Sidebar from "./Sidebar";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Chat Room List Component
function ChatRoomList({ rooms, selectedRoom, onSelectRoom, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <p className="text-gray-500">Henuz sohbet yok.</p>
        <p className="text-sm text-gray-400 mt-2">Oneriler sayfasindan mesaj baslatin.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {rooms.map((room) => (
        <div
          key={room.id}
          onClick={() => onSelectRoom(room)}
          className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
            selectedRoom?.id === room.id ? "bg-red-50 border-l-4 border-red-500" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
              {room.other_user?.username?.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-800 truncate">
                @{room.other_user?.username || "Kullanici"}
              </h4>
              <p className="text-sm text-gray-500 truncate">
                {room.other_user?.real_name || ""}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Chat Messages Component
function ChatMessages({ room, currentUser, token }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!room || !token) return;
    fetchMessages();
    
    // Subscribe to realtime messages
    const channel = supabase
      .channel(`room-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${room.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, token]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/chat/messages/${room.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      const response = await fetch(`${API_URL}/chat/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversation_id: room.id,
          content: newMessage.trim(),
        }),
      });
      const data = await response.json();
      if (data.success) {
        setNewMessage("");
      } else {
        alert("Mesaj gonderilemedi: " + data.error);
      }
    } catch (err) {
      alert("Mesaj gonderilirken hata: " + err.message);
    } finally {
      setSending(false);
    }
  };

  if (!room) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Bir sohbet secin</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
            {room.other_user?.username?.charAt(0).toUpperCase() || "?"}
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">
              @{room.other_user?.username || "Kullanici"}
            </h3>
            <p className="text-sm text-gray-500">{room.other_user?.real_name || ""}</p>
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Henuz mesaj yok. Ilk mesaji gonderin!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === currentUser?.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs md:max-w-md px-4 py-2 rounded-2xl ${
                    isOwn
                      ? "bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-br-sm"
                      : "bg-white text-gray-800 shadow-sm rounded-bl-sm"
                  }`}
                >
                  <p className="break-words">{msg.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      isOwn ? "text-white/70" : "text-gray-400"
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Mesajinizi yazin..."
            className="flex-1 px-4 py-2 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="px-6 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-full font-medium hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? "..." : "Gonder"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Main Messages Component
export default function Messages() {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      setToken(session.access_token);
      setCurrentUser(session.user);
      await fetchRooms(session.access_token);
    };
    init();
  }, []);

  useEffect(() => {
    // Auto-select room from URL param
    const roomId = searchParams.get("room");
    if (roomId && rooms.length > 0) {
      const room = rooms.find((r) => r.id === roomId);
      if (room) setSelectedRoom(room);
    }
  }, [searchParams, rooms]);

  const fetchRooms = async (accessToken) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/chat/rooms`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      if (data.success) {
        setRooms(data.rooms);
      }
    } catch (err) {
      console.error("Error fetching rooms:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar user={currentUser} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row">
        {/* Room List */}
        <div className="w-full md:w-80 bg-white border-r flex-shrink-0">
          <div className="p-4 border-b">
            <h2 className="text-xl font-bold text-gray-800">Mesajlar</h2>
          </div>
          <ChatRoomList
            rooms={rooms}
            selectedRoom={selectedRoom}
            onSelectRoom={setSelectedRoom}
            loading={loading}
          />
        </div>

        {/* Chat Area */}
        <ChatMessages
          room={selectedRoom}
          currentUser={currentUser}
          token={token}
        />
      </main>
    </div>
  );
}
