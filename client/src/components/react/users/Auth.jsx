import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUser } from "./UserContext";
import axios from 'axios';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'https://salomonhairstudio.onrender.com').replace(/\/$/, '');

const Auth = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "", 
    fechaNacimiento: "",
  });

  const location = useLocation();
  // Estado para alternar entre Login (true) y Registro (false)
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(""); // Mensajes de éxito o error
  const [messageType, setMessageType] = useState(""); // success, error
  const { refreshUser } = useUser() || {}; // Manejo seguro si no está el provider aún

  // Inicializar estado basado en navegación
  useEffect(() => {
    if (location.state?.isSignUp !== undefined) {
      setIsLogin(!location.state.isSignUp);
    }
    if (location.state?.alert) {
      setMessage(location.state.alert.text);
      setMessageType(location.state.alert.type === "danger" ? "error" : "success");
    }
  }, [location.state]);

  // Manejo de Login con Google (Callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (token) {
        const processGoogleLogin = async () => {
            setLoading(true);
            try {
                localStorage.setItem('token', token);
                
                // Decodificar token para obtener ID (Payload es la segunda parte del JWT)
                const payload = JSON.parse(atob(token.split('.')[1]));
                const userId = payload.id;

                // Obtener datos completos del usuario
                const res = await axios.get(`${BACKEND_URL}/api/users/${userId}`);
                const user = res.data;

                localStorage.setItem("user", JSON.stringify({
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    isSpectator: user.isSpectator,
                    avatar: user.avatar,
                    role: user.role
                }));

                setMessageType("success");
                setMessage("¡Bienvenido! Sesión iniciada con Google.");
                
                if (refreshUser) refreshUser();

                // Limpiar URL
                window.history.replaceState({}, document.title, window.location.pathname);

                if (onSuccess) {
                    setTimeout(() => onSuccess(user), 1000);
                } else {
                    setTimeout(() => window.location.href = "/", 1500);
                }
            } catch (err) {
                console.error("Google Login Error:", err);
                setMessageType("error");
                setMessage("Error al procesar el inicio de sesión con Google.");
                setLoading(false);
            }
        };
        processGoogleLogin();
    } else if (error) {
        setMessageType("error");
        setMessage("Error en la autenticación con Google.");
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // Limpiar mensajes al escribir
    if (message) setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
  
    try {
      let response;
      
      if (isLogin) {
        // --- LOGIN ---
        response = await axios.post(`${BACKEND_URL}/api/users/login`, {
          identifier: formData.email.trim(),
          password: formData.password,
        });
      } else {
        // --- REGISTRO ---
        if (formData.password !== formData.confirmPassword) {
          throw new Error("Las contraseñas no coinciden.");
        }
        if (formData.password.length < 6) {
            throw new Error("La contraseña debe tener al menos 6 caracteres.");
        }

        // Quitamos 'const' para usar la variable 'response' declarada arriba
        response = await axios.post(`${BACKEND_URL}/api/users/register`, {
          username: formData.username,
          email: formData.email.trim(),
          password: formData.password,
          fechaNacimiento: formData.fechaNacimiento,
        });
      }

      // --- ÉXITO ---
      const result = response?.data;
      
      if (result && result.user && result.user._id) {
        // Guardar sesión
        localStorage.setItem("user", JSON.stringify({
          id: result.user._id,
          username: result.user.username,
          email: result.user.email,
          isSpectator: result.user.isSpectator,
          avatar: result.user.avatar
        }));
        if (result.token) localStorage.setItem("token", result.token);

        setMessageType("success");
        setMessage(isLogin ? "¡Bienvenido de nuevo!" : "¡Cuenta creada con éxito!");
        
        if (refreshUser) refreshUser();

        // Redirección
        if (onSuccess) {
          setTimeout(() => onSuccess(result.user), 1000);
        } else {
          setTimeout(() => window.location.href = "/", 1500);
        }
      } else {
        throw new Error("Respuesta del servidor inválida.");
      }

    } catch (error) {
      console.error("Auth Error:", error);
      setMessageType("error");
      setMessage(error.response?.data?.message || error.message || "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[600px] w-full flex items-center justify-center overflow-hidden bg-zinc-900 font-sans">
      {/* Fondo con imagen y overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=1920&auto=format&fit=crop" 
          alt="Salon Background" 
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80"></div>
      </div>

      {/* Tarjeta Glassmorphism */}
      <div className="relative z-10 w-full max-w-md p-8 mx-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl animate-fade-in">
        
        {/* Encabezado */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2 font-serif tracking-wide">
            {isLogin ? "Bienvenido" : "Únete a Nosotros"}
          </h2>
          <p className="text-gray-300 text-sm">
            {isLogin ? "Accede a tu cuenta para gestionar tus turnos" : "Regístrate para reservar tu próximo estilo"}
          </p>
        </div>

        {/* Mensajes de Alerta */}
        {message && (
          <div className={`mb-6 p-3 rounded-lg text-sm text-center font-medium border ${
            messageType === 'error' 
              ? 'bg-red-500/20 border-red-500/50 text-red-200' 
              : 'bg-green-500/20 border-green-500/50 text-green-200'
          }`}>
            {message}
          </div>
        )}

        {/* Botón Google */}
        <a
          href={`${BACKEND_URL}/api/auth/google/login`}
          className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-50 transition-colors mb-6 text-decoration-none shadow-sm"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
          Continuar con Google
        </a>

        <div className="relative flex py-2 items-center mb-6">
            <div className="flex-grow border-t border-gray-600"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase">O con email</span>
            <div className="flex-grow border-t border-gray-600"></div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-yellow-500 uppercase tracking-wider ml-1">Nombre</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none transition-all"
                placeholder="Tu nombre completo"
                required
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-yellow-500 uppercase tracking-wider ml-1">
              {isLogin ? "Usuario, Email o Teléfono" : "Email"}
            </label>
            <input
              type={isLogin ? "text" : "email"}
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none transition-all"
              placeholder={isLogin ? "Usuario, email o teléfono" : "ejemplo@correo.com"}
              required
            />
          </div>

          {!isLogin && (
             <div className="space-y-1">
               <label className="text-xs font-bold text-yellow-500 uppercase tracking-wider ml-1">Fecha de Nacimiento</label>
               <input
                 type="date"
                 name="fechaNacimiento"
                 value={formData.fechaNacimiento}
                 onChange={handleInputChange}
                 className="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none transition-all"
                 required
               />
             </div>
          )}

          <div className="space-y-1 relative">
            <label className="text-xs font-bold text-yellow-500 uppercase tracking-wider ml-1">Contraseña</label>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none transition-all"
              placeholder="••••••••"
              required
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-8 text-gray-400 hover:text-white text-xs"
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          {!isLogin && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-yellow-500 uppercase tracking-wider ml-1">Confirmar Contraseña</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          )}

          {isLogin && (
            <div className="text-right">
              <a href="/forgot-password" className="text-xs text-gray-400 hover:text-yellow-500 transition-colors">
                ¿Olvidaste tu contraseña?
              </a>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 text-zinc-900 font-bold py-3 rounded-lg hover:from-yellow-500 hover:to-yellow-400 transition-all transform hover:scale-[1.02] shadow-lg shadow-yellow-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-zinc-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Procesando...
              </span>
            ) : (
              isLogin ? "Iniciar Sesión" : "Crear Cuenta"
            )}
          </button>
        </form>

        {/* Footer / Toggle */}
        <div className="mt-8 text-center border-t border-white/10 pt-6">
          <p className="text-gray-300 text-sm">
            {isLogin ? "¿No tienes una cuenta?" : "¿Ya tienes una cuenta?"}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setMessage("");
                setFormData({ ...formData, password: "", confirmPassword: "" });
              }}
              className="ml-2 font-bold text-yellow-500 hover:text-yellow-400 transition-colors underline decoration-transparent hover:decoration-yellow-400"
            >
              {isLogin ? "Regístrate aquí" : "Inicia sesión"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
