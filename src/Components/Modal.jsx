import React, { useState } from "react";

export default function Modal() {
  const categories = [
    "learning language",
    "making friend",
    "sexting",
    "movie",
    "flirty",
    "general"
  ];

  const [selectedCtaegories, setSelectedCategories] = useState([]);
  const [roomInfo, setRoomInfo] = useState({
    ...selectedCtaegories,
    description: "",
    roomRules: []
  });

  // Yeni rule yazılacak input için geçici state
  const [currentRule, setCurrentRule] = useState("");
  const chooseCategories=(category)=>{
    if(selectedCtaegories.includes(category)){
      // varsa çıkar
      setSelectedCategories(selectedCtaegories.filter(cat=>cat!==category))
    }
    else{
      //yoksa ekle
      setSelectedCategories([...selectedCtaegories,category])
    }

  }
  // ✔ Room Rules'a yeni kural ekleme fonksiyonu
  const addRule = (e) => {
    e.preventDefault();

    if (!currentRule.trim()) return;

    if (roomInfo.roomRules.length >= 10) return;

    setRoomInfo((prev) => ({
      ...prev,
      roomRules: [...prev.roomRules, currentRule.trim()]
    }));

    setCurrentRule("");
  };

  // ✔ description gibi alanları kontrol eden fonksiyon
  const setText = (e) => {
    const { name, value } = e.target;
    setRoomInfo((prev) =>([...prev.description,roomInfo.description]));
  };

  return (
    <form className="w-[450px] flex flex-col h-screen space-y-5 rounded-md shadow-md h-auto py-10  mx-auto items-center">
    <h1 className="text-3xl etxt-red-500">Create Room </h1>
    <p>You can inform your audience what to talk in the room: </p>
      {/* description */}
    <div className="grid grid-cols-6 gap-3 w-full">
  {categories.map((cat, index) => (
    <div
      key={index}
      onClick={() => chooseCategories(cat)}
      className={`
        cursor-pointer flex items-center justify-center
        px-3 py-2 rounded-md text-center
        ${selectedCtaegories.includes(cat)
          ? "bg-red-500 text-white"
          : "bg-gray-200 text-black"
        }
      `}
    >
      {cat}
      </div>
    
  ))}
  </div>
      <textarea
        onChange={setText}
        placeholder="Please fill your description"
        className="w-full placeholder:text-red-700 rounded-md h-15 mx-4"
        value={roomInfo.description}
        name="description"
       
      />

      {/* EXISTING RULES */}
      {roomInfo.roomRules.map((rule, index) => (
        <input
          key={index}
          className="w-full placeholder:text-red-700 rounded-md h-15 mx-4"
          value={rule}
          disabled
        />
      ))}

      {/* ONLY SHOW NEW INPUT IF LESS THAN 10 */}
      {roomInfo.roomRules.length < 10 && (
        <form onSubmit={addRule} className="mx-4 w-full">
       
          <input
            className="w-full placeholder:text-red-700 rounded-md h-15"
            placeholder="Enter your rule"
            value={currentRule}
            onChange={(e) => setCurrentRule(e.target.value)}
          />

          <button
            type="submit"
            className="bg-blue-500 text-white rounded-md px-3 py-1 mt-2"
          >
            Add Rule
          </button>
        </form>
      )}
      <button className="bg-red-500 text-white w-full py-3 rounded-md"type="submit">Submit</button>
    </form>
  );
}
