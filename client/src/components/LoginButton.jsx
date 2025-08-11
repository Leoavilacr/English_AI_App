import React from "react";

const LoginButton = () => {
  const handleLogin = () => {
    window.location.href = "http://localhost:3001/auth/google";
  };

  return (
    <button
      onClick={handleLogin}
      className="bg-white text-gray-800 font-semibold py-2 px-6 rounded shadow-md hover:shadow-lg hover:bg-gray-100 transition"
    >
      Login with Google
    </button>
  );
};

export default LoginButton;
