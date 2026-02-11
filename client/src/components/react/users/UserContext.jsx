import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const UserContext = createContext();

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'https://salomonhairstudio.onrender.com').replace(/\/$/, '');

export const UserProvider = ({ children }) => {
    // Inicializamos el estado leyendo directamente de localStorage para evitar retrasos
    const [user, setUser] = useState(() => {
        if (typeof window === 'undefined') return null;
        const stored = localStorage.getItem('user');
        return stored ? JSON.parse(stored) : null;
    });

    // Estado del Tema (Dark/Light)
    const [theme, setTheme] = useState(() => {
        if (typeof window === 'undefined') return 'dark';
        return localStorage.getItem('theme') || 'dark';
    });

    const [loading, setLoading] = useState(true);
    
    // Determinamos si es espectador desde el inicio (antes de llamar a la API)
    const [isSpectator, setIsSpectator] = useState(() => {
        if (typeof window === 'undefined') return false;
        const stored = localStorage.getItem('user');
        if (stored) {
            const u = JSON.parse(stored);
            return u.isSpectator || (u.username?.toLowerCase() === 'espectador' || u.email === 'espectador@example.com');
        }
        return false;
    });

    const fetchUser = async () => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                const userId = parsedUser.id || parsedUser._id;
                
                if (userId) {
                    // Buscamos los datos frescos del usuario por ID
                    const res = await axios.get(`${BACKEND_URL}/api/users/${userId}`);
                    setUser(res.data);
                    checkSpectator(res.data);
                } else {
                    setUser(parsedUser);
                }
            } catch (error) {
                console.error("Error cargando contexto de usuario:", error);
            }
        }
        setLoading(false);
    };

    const checkSpectator = (userData) => {
        if (userData && (userData.isSpectator || userData.username?.toLowerCase() === 'espectador' || userData.email === 'espectador@example.com')) {
            setIsSpectator(true);
        } else {
            setIsSpectator(false);
        }
    };

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        window.dispatchEvent(new Event('theme-change'));
    };

    // Efecto para aplicar el tema al body globalmente (Fondo de la página)
    useEffect(() => {
        if (theme === 'dark') {
            document.body.style.backgroundColor = '#27272a'; // zinc-800 (Gris oscurito, no negro total)
            document.body.style.color = '#ffffff';
        } else {
            document.body.style.backgroundColor = '#f3f4f6'; // gray-100 (Claro)
            document.body.style.color = '#18181b';
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Sincronizar tema entre islas de Astro (Header y Wizard)
    useEffect(() => {
        const handleThemeChange = () => {
            const storedTheme = localStorage.getItem('theme');
            if (storedTheme && storedTheme !== theme) {
                setTheme(storedTheme);
            }
        };
        window.addEventListener('theme-change', handleThemeChange);
        return () => window.removeEventListener('theme-change', handleThemeChange);
    }, [theme]);

    useEffect(() => {
        fetchUser();
    }, []);

    const refreshUser = () => fetchUser();

    return (
        <UserContext.Provider value={{ user, loading, isSpectator, refreshUser, theme, toggleTheme }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        // Retornar un objeto seguro para evitar que la app explote si falta el Provider
        return { 
            user: null, 
            loading: true, 
            isSpectator: false, 
            refreshUser: () => {}, 
            theme: 'dark', 
            toggleTheme: () => {} 
        };
    }
    return context;
};
