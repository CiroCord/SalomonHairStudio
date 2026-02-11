import React from 'react';
import { useUser } from '../users/UserContext';

const CustomAlert = ({ isOpen, onClose, title, message, type = 'info', onConfirm, showCancel = false, confirmText = 'Aceptar', cancelText = 'Cancelar' }) => {
    if (!isOpen) return null;
    
    const { theme } = useUser();
    const isDark = theme === 'dark';

    // Configuración de colores e iconos según el tipo
    let icon = 'ℹ️';
    let headerColor = isDark ? 'text-blue-400' : 'text-blue-600';
    let btnColor = isDark ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700';

    if (type === 'success') {
        icon = '✅';
        headerColor = isDark ? 'text-green-400' : 'text-green-600';
        btnColor = isDark ? 'bg-green-600 hover:bg-green-700' : 'bg-green-600 hover:bg-green-700';
    } else if (type === 'error') {
        icon = '❌';
        headerColor = isDark ? 'text-red-400' : 'text-red-600';
        btnColor = isDark ? 'bg-red-600 hover:bg-red-700' : 'bg-red-600 hover:bg-red-700';
    } else if (type === 'warning') {
        icon = '⚠️';
        headerColor = isDark ? 'text-yellow-400' : 'text-yellow-600';
        btnColor = isDark ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-yellow-600 hover:bg-yellow-700';
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-sm rounded-xl shadow-2xl transform transition-all scale-100 border ${isDark ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-100'}`}>
                <div className="p-6 text-center">
                    <div className="text-4xl mb-4">{icon}</div>
                    <h3 className={`text-xl font-bold mb-2 ${headerColor}`}>{title}</h3>
                    <p className={`text-sm mb-6 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{message}</p>
                    
                    <div className="flex gap-3 justify-center">
                        {showCancel && (
                            <button 
                                onClick={onClose}
                                className={`px-4 py-2 rounded-lg font-bold transition-colors ${isDark ? 'bg-zinc-800 text-gray-300 hover:bg-zinc-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                                {cancelText}
                            </button>
                        )}
                        <button 
                            onClick={() => {
                                if (onConfirm) onConfirm();
                                onClose();
                            }}
                            className={`px-6 py-2 text-white rounded-lg font-bold shadow-lg transition-transform active:scale-95 ${btnColor}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomAlert;