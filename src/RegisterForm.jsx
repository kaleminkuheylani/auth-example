import React, { useState } from "react";

function RegisterForm() {
  const [user, setUser] = useState({
    displayName: "",
    userName: "",
    email: "",
    password: "",
  });
  
  const [loggedIn, setLoggedIn] = useState(false);

  const setText = (e) => {
    const { name, value } = e.target;
    setUser((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="flex justify-center min-h-screen items-center">
   
      <div className="flex  flex-col space-y-4 rounded-xl shadow-lg w-[450px] h-[500px] mx-10 py-4 px-4">

      <h1 className="text-xl font-bold text-center text-red-600">
        {loggedIn ? "Giriş Yap" : "Kayıt Ol"}
      </h1>

      <input
        className="w-full rounded-md py-2 px-2 placeholder:text-red-300"
        placeholder="İsim"
        onChange={setText}
        name="displayName"
        value={user.displayName}
      />

      <input
        className="w-full rounded-md py-2 px-2 placeholder:text-red-300"
        placeholder="Kullanıcı Adı"
        onChange={setText}
        name="userName"
        value={user.userName}
      />

      <input
        className="w-full rounded-md py-2 px-2 placeholder:text-red-300"
        placeholder="Email"
        onChange={setText}
        name="email"
        value={user.email}
      />

      <input
        className="w-full rounded-md py-2 px-2 placeholder:text-red-300"
        placeholder="Şifre"
        type="password"
        onChange={setText}
        name="password"
        value={user.password}
      />

      <button className="w-full rounded-md py-2 bg-red-500 hover:bg-red-600 text-white font-semibold">
        {loggedIn ? "Giriş Yap" : "Kayıt Ol"}
      </button>

      <p
        onClick={() => setLoggedIn(!loggedIn)}
        className="text-md text-center text-red-400 cursor-pointer"
      >
        {loggedIn ? "Zaten hesabınız yok mu? Kayıt Ol" : "Zaten hesabın var mı? Giriş Yap"}
      </p>
    </div>
  </div>
  );
}

export default RegisterForm;
