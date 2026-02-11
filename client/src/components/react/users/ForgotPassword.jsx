import React, { useState, useEffect } from "react";
import axios from 'axios';

const BACKEND_URL = (import.meta.env.PUBLIC_BACKEND_URL || 'https://salomonhairstudio.onrender.com').replace(/\/$/, '');

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log("ForgotPassword component mounted");
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await axios.post(`${BACKEND_URL}/api/users/forgot-password`, { email });
      setMessage(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Error al enviar el correo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[600px] w-full flex items-center justify-center overflow-hidden bg-zinc-900 font-sans">
      {/* Fondo */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=1920&auto=format&fit=crop" 
          alt="Background" 
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80"></div>
      </div>

      <div className="relative z-10 w-full max-w-md p-8 mx-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl animate-fade-in">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2 font-serif tracking-wide">Recuperar Contraseña</h2>
          <p className="text-gray-300 text-sm">Ingresa tu email para recibir un enlace de recuperación.</p>
        </div>

        {message && (
          <div className="mb-6 p-3 rounded-lg text-sm text-center font-medium border bg-green-500/20 border-green-500/50 text-green-200">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 p-3 rounded-lg text-sm text-center font-medium border bg-red-500/20 border-red-500/50 text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-yellow-500 uppercase tracking-wider ml-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none transition-all"
              placeholder="ejemplo@correo.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 text-zinc-900 font-bold py-3 rounded-lg hover:from-yellow-500 hover:to-yellow-400 transition-all transform hover:scale-[1.02] shadow-lg shadow-yellow-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Enviando..." : "Enviar Enlace"}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-white/10 pt-6">
          <a href="/login" className="text-sm font-bold text-yellow-500 hover:text-yellow-400 transition-colors">
            Volver al inicio de sesión
          </a>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;