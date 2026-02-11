import React, { useState } from 'react';
import { useUser } from './users/UserContext';

const Header = () => {
  const { user, theme, toggleTheme } = useUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Referencia directa a archivos en carpeta public (sin import)
  const isotipo = '/logo/ISOTIPO.svg';
  const logotipo = '/logo/LOGOTIPO.svg';

  // Avatar por defecto si el usuario no tiene uno
  const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  // Componente de Switch de Tema con Tijera
  const ThemeToggle = () => (
      <button 
          onClick={toggleTheme}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-700/50 transition-colors group"
      >
          <span className="text-sm text-gray-300 group-hover:text-white flex items-center gap-2">
              {theme === 'dark' ? '🌙 Modo Noche' : '☀️ Modo Día'}
          </span>
          
          {/* Switch Personalizado */}
          <div className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${theme === 'dark' ? 'bg-zinc-900 border border-yellow-600' : 'bg-gray-300'}`}>
              <div className={`absolute top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center transition-all duration-300 ${theme === 'dark' ? 'left-5' : '-left-1'}`}>
                  {/* Icono de Tijera como indicador */}
                  <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center shadow-md text-zinc-900 text-[10px]">
                      ✂️
                  </div>
              </div>
          </div>
      </button>
  );

  return (
    <>
      {/* --- DESKTOP HEADER (Visible solo en PC) --- */}
      <header className="hidden md:block bg-zinc-900 text-white shadow-lg border-b border-yellow-600/30 sticky top-0 z-50 font-sans">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          {/* Logo */}
          <a href="/" className="flex items-center gap-3 group text-decoration-none">
             <img src={logotipo} alt="Salomon Hair Studio" className="w-30 h-10 object-contain" />
          </a>

          {/* Navegación de Escritorio */}
          <nav className="flex items-center gap-8">
              <a href="/turnos" className="text-gray-300 hover:text-yellow-500 transition-colors text-sm uppercase tracking-wider font-medium text-decoration-none">Reservar</a>
              <a href="/gallery" className="text-gray-300 hover:text-yellow-500 transition-colors text-sm uppercase tracking-wider font-medium text-decoration-none">Gallery</a>
              <a href="/awards" className="text-gray-300 hover:text-yellow-500 transition-colors text-sm uppercase tracking-wider font-medium text-decoration-none">Capacitaciones</a>
              {user && (user.role === 'admin' || user.role === 'professional') && (
                  <a href="/admin" className="text-yellow-500 hover:text-white transition-colors text-sm uppercase tracking-wider font-bold text-decoration-none border border-yellow-500 px-3 py-1 rounded hover:bg-yellow-500 hover:border-transparent">Panel</a>
              )}
          </nav>

          {/* Sección de Usuario Desktop */}
          <div className="relative">
              {user ? (
                  <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                      <div className="text-right">
                          <span className="block text-xs text-gray-400">Bienvenido</span>
                          <span className="block text-sm text-yellow-500 font-bold leading-none">{user.username}</span>
                      </div>
                      <div className="relative">
                          <img 
                              src={user.avatar || defaultAvatar} 
                              alt="Avatar" 
                              className="w-10 h-10 rounded-full border-2 border-yellow-600 object-cover group-hover:border-white transition-colors"
                          />
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-zinc-900 rounded-full"></div>
                      </div>
                  </div>
              ) : (
                  <a href="/login" className="bg-yellow-600 text-zinc-900 px-6 py-2 rounded-full font-bold text-sm hover:bg-white hover:text-zinc-900 transition-all shadow-lg shadow-yellow-600/20 text-decoration-none">
                      Iniciar Sesión
                  </a>
              )}

              {/* Menú Desplegable Desktop */}
              {user && isMenuOpen && (
                  <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
                      <div className="absolute right-0 mt-4 w-64 bg-zinc-800 rounded-xl shadow-2xl border border-zinc-700 overflow-hidden py-2 z-50 animate-fade-in">
                          <a href="/profile" className="block px-4 py-2 text-sm text-gray-300 hover:bg-zinc-700 hover:text-yellow-500 transition-colors text-decoration-none">✏️ Editar Perfil</a>
                          <a href="/mis-turnos" className="block px-4 py-2 text-sm text-gray-300 hover:bg-zinc-700 hover:text-yellow-500 transition-colors text-decoration-none">📅 Mis Turnos</a>
                          {(user.role === 'admin' || user.role === 'professional') && (
                              <a href="/admin" className="block px-4 py-2 text-sm text-yellow-500 hover:bg-zinc-700 hover:text-white transition-colors text-decoration-none font-bold">🛠 Panel</a>
                          )}
                          
                          <div className="my-2 border-t border-zinc-700"></div>
                          <ThemeToggle />
                          
                          <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-zinc-700 hover:text-red-300 transition-colors border-t border-zinc-700 mt-2">
                              🚪 Cerrar Sesión
                          </button>
                      </div>
                  </>
              )}
          </div>
        </div>
      </header>

      {/* --- MOBILE APP HEADER (Barra Superior Simplificada) --- */}
      <header className="md:hidden bg-zinc-900/95 backdrop-blur-md text-white border-b border-white/5 sticky top-0 z-50 px-4 py-3 flex justify-between items-center shadow-md">
          <a href="/" className="flex items-center gap-2 text-decoration-none">
             <img src={isotipo} alt="Isotipo" className="w-8 h-8 object-contain" />
             <img src={logotipo} alt="Salomon" className="h-6 object-contain" />
          </a>
          {user && (user.role === 'admin' || user.role === 'professional') && (
             <a href="/admin" className="text-[10px] font-bold text-yellow-500 border border-yellow-500 px-2 py-1 rounded uppercase tracking-wider">Admin</a>
          )}
      </header>

      {/* --- MOBILE BOTTOM NAVIGATION (Barra Inferior Tipo App) --- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-white/10 z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)]">
        <div className="flex justify-around items-center h-16">
            <a href="/" className="flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-yellow-500 active:text-yellow-500 transition-colors text-decoration-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="text-[10px] font-medium">Inicio</span>
            </a>
            
            <a href="/turnos" className="flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-yellow-500 active:text-yellow-500 transition-colors text-decoration-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[10px] font-medium">Reservar</span>
            </a>

            <a href="/gallery" className="flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-yellow-500 active:text-yellow-500 transition-colors text-decoration-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[10px] font-medium">Galería</span>
            </a>

            {user ? (
                <div className="relative w-full h-full group">
                    <button 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-yellow-500 active:text-yellow-500 transition-colors focus:outline-none"
                    >
                        <img src={user.avatar || defaultAvatar} className="w-6 h-6 rounded-full border border-gray-500 mb-1 object-cover" />
                        <span className="text-[10px] font-medium">Perfil</span>
                    </button>
                    
                    {/* Menú Flotante (Hacia arriba) */}
                    {isMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-[55] bg-black/20 backdrop-blur-[1px]" onClick={() => setIsMenuOpen(false)}></div>
                            <div className="fixed bottom-20 left-0 right-0 mx-auto w-64 bg-zinc-800 rounded-xl shadow-2xl border border-zinc-700 overflow-hidden py-2 z-[60] animate-fade-in-up">
                                <div className="px-4 py-2 border-b border-zinc-700 mb-1 text-center">
                                    <p className="text-xs text-white font-bold truncate">{user.username}</p>
                                </div>
                                <a href="/mis-turnos" className="block px-4 py-3 text-sm text-gray-300 hover:bg-zinc-700 hover:text-yellow-500 text-decoration-none">📅 Mis Turnos</a>
                                <a href="/profile" className="block px-4 py-3 text-sm text-gray-300 hover:bg-zinc-700 hover:text-yellow-500 text-decoration-none">✏️ Editar Perfil</a>
                                
                                <div className="my-1 border-t border-zinc-700"></div>
                                <ThemeToggle />

                                <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-zinc-700">🚪 Cerrar Sesión</button>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <a href="/login" className="flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-yellow-500 active:text-yellow-500 transition-colors text-decoration-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-[10px] font-medium">Ingresar</span>
                </a>
            )}
        </div>
      </nav>
    </>
  );
};

export default Header;
