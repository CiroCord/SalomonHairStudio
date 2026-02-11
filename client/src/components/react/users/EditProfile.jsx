import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useUser } from "./UserContext";
import CustomAlert from '../ui/CustomAlert';

// Configuración de URL dinámica
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');

export default function EditProfile() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '',
        email: '', 
        fechaNacimiento: '',
        telefono: '',
        password: '',
        confirmPassword: '',
        avatar: ''
    });
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);
    
    // Estados para verificación
    const [originalEmail, setOriginalEmail] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [modalLoading, setModalLoading] = useState(false);
    const [actionType, setActionType] = useState('update'); // 'update' | 'delete'
    const { isSpectator, loading: userLoading, theme } = useUser() || { isSpectator: false, loading: false, theme: 'dark' };

    // Estado para Alertas Personalizadas
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null, showCancel: false });

    const showAlert = (title, message, type = 'info', onConfirm = null, showCancel = false) => {
        setAlertConfig({ isOpen: true, title, message, type, onConfirm, showCancel });
    };
    const closeAlert = () => {
        setAlertConfig({ ...alertConfig, isOpen: false });
    };

    // Avatares predefinidos
    const predefinedAvatars = [
        "https://cdn-icons-png.flaticon.com/512/4140/4140048.png",
        "https://cdn-icons-png.flaticon.com/512/4140/4140037.png",
        "https://cdn-icons-png.flaticon.com/512/4140/4140047.png",
        "https://cdn-icons-png.flaticon.com/512/4140/4140051.png"
    ];

    useEffect(() => {
        const fetchUser = async () => {
            // Obtenemos el ID del usuario logueado desde localStorage
            const storedUser = JSON.parse(localStorage.getItem('user'));
            
            if (!storedUser || !storedUser.id) {
                window.location.href = '/login'; // Si no está logueado, mandar al login
                return;
            }

            try {
                const { data } = await axios.get(`${BACKEND_URL}/api/users/${storedUser.id}`);
                
                // Formatear fecha para que el input type="date" la reconozca (YYYY-MM-DD)
                const fecha = data.fechaNacimiento ? data.fechaNacimiento.split('T')[0] : '';
                
                setOriginalEmail(data.email || '');
                setFormData({
                    username: data.username || '',
                    email: data.email || '',
                    fechaNacimiento: fecha,
                    telefono: data.telefono || '',
                    password: '',
                    confirmPassword: '',
                    avatar: data.avatar || ''
                });
            } catch (error) {
                console.error(error);
                setMessage({ type: 'danger', text: 'Error al cargar los datos del usuario.' });
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, [navigate]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // Manejar subida de archivo (Convertir a Base64)
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, avatar: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(null);

        // Verificación de Modo Espectador
        if (userLoading) {
            showAlert("Cargando", "Cargando permisos... Por favor espera un momento.", "info");
            return;
        }
        if (isSpectator) {
            showAlert("Modo Espectador", "Estás en modo espectador. No puedes modificar el perfil de esta cuenta de demostración.", "warning");
            return;
        }

        // Validación simple de contraseñas
        if (formData.password && formData.password !== formData.confirmPassword) {
            setMessage({ type: 'danger', text: 'Las contraseñas no coinciden.' });
            return;
        }

        // Detectar si hay cambios sensibles (Email o Password)
        const isSensitiveChange = (formData.email !== originalEmail) || (formData.password && formData.password.trim() !== '');

        if (isSensitiveChange) {
            // Si hay cambios sensibles, pedimos el código primero
            setActionType('update'); // Marcamos que la acción es actualizar
            try {
                const storedUser = JSON.parse(localStorage.getItem('user'));
                setModalLoading(true);
                // Solicitamos al backend que envíe el código
                await axios.post(`${BACKEND_URL}/api/users/request-verification/${storedUser.id}`);
                setShowModal(true); // Abrimos el modal
                setMessage(null);
            } catch (error) {
                setMessage({ type: 'danger', text: 'Error al solicitar código de verificación.' });
            } finally {
                setModalLoading(false);
            }
            return; // Detenemos el flujo aquí hasta que verifique
        }

        try {
            const storedUser = JSON.parse(localStorage.getItem('user'));
            
            // Preparamos los datos para enviar
            const updateData = { ...formData };
            
            // Si la contraseña está vacía, la quitamos para no sobreescribirla con vacío
            if (!updateData.password) delete updateData.password;
            delete updateData.confirmPassword;

            await axios.put(`${BACKEND_URL}/api/users/${storedUser.id}`, updateData);
            
            setMessage({ type: 'success', text: 'Perfil actualizado con éxito.' });
            
            // Actualizamos el localStorage por si cambió el nombre o email
            const newUser = { 
                ...storedUser, 
                username: formData.username, 
                email: formData.email, 
                avatar: formData.avatar,
                telefono: formData.telefono,
                fechaNacimiento: formData.fechaNacimiento
            };
            localStorage.setItem('user', JSON.stringify(newUser));

        } catch (error) {
            setMessage({ type: 'danger', text: error.response?.data?.message || 'Error al actualizar.' });
        }
    };

    // Función para cerrar sesión
    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = '/login';
    };

    // Función para solicitar eliminación de cuenta
    const handleRequestDelete = async () => {
        // Verificación de Modo Espectador
        if (userLoading) {
            showAlert("Cargando", "Cargando permisos... Por favor espera un momento.", "info");
            return;
        }
        if (isSpectator) {
            showAlert("Modo Espectador", "Estás en modo espectador. No puedes eliminar esta cuenta.", "warning");
            return;
        }

        showAlert("Eliminar Cuenta", "¿Estás seguro de que quieres eliminar tu cuenta? Esta acción es irreversible.", "error", async () => {
            setActionType('delete'); // Marcamos que la acción es eliminar
            try {
                const storedUser = JSON.parse(localStorage.getItem('user'));
                setModalLoading(true);
                await axios.post(`${BACKEND_URL}/api/users/request-verification/${storedUser.id}`);
                setShowModal(true);
                setMessage(null);
            } catch (error) {
                setMessage({ type: 'danger', text: 'Error al solicitar código de verificación.' });
            } finally {
                setModalLoading(false);
            }
        }, true);
    };

    // Función para confirmar eliminación con código
    const handleVerifyAndDelete = async () => {
        try {
            const storedUser = JSON.parse(localStorage.getItem('user'));
            // En axios.delete, el body va dentro de la propiedad 'data'
            await axios.delete(`${BACKEND_URL}/api/users/${storedUser.id}`, {
                data: { verificationCode }
            });
            
            showAlert("Cuenta Eliminada", "Tu cuenta ha sido eliminada correctamente.", "success", handleLogout);
            handleLogout(); // Limpiamos storage y redirigimos
        } catch (error) {
            showAlert("Error", error.response?.data?.message || 'Código incorrecto', "error");
        }
    };

    // Función que se ejecuta al confirmar el código en el modal
    const handleVerifyAndSave = async () => {
        try {
            const storedUser = JSON.parse(localStorage.getItem('user'));
            const updateData = { ...formData, verificationCode }; // Incluimos el código
            
            if (!updateData.password) delete updateData.password;
            delete updateData.confirmPassword;

            await axios.put(`${BACKEND_URL}/api/users/${storedUser.id}`, updateData);
            
            setMessage({ type: 'success', text: 'Perfil verificado y actualizado con éxito.' });
            setShowModal(false);
            setVerificationCode('');
            
            // Actualizar originalEmail si cambió
            setOriginalEmail(formData.email);

            const newUser = { 
                ...storedUser, 
                username: formData.username, 
                email: formData.email, 
                avatar: formData.avatar,
                telefono: formData.telefono,
                fechaNacimiento: formData.fechaNacimiento
            };
            localStorage.setItem('user', JSON.stringify(newUser));

        } catch (error) {
            // Si falla (código incorrecto), mostramos error pero no cerramos el modal necesariamente, o sí.
            showAlert("Error", error.response?.data?.message || 'Código incorrecto', "error");
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center min-h-[400px]">
             <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-600"></div>
        </div>
    );

    // Estilos dinámicos
    const cardBg = theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-100';
    const labelColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-700';
    const inputBg = theme === 'dark' ? 'bg-black/20 border-zinc-700 text-white placeholder-gray-600' : 'bg-white border-gray-300 text-gray-900';

    return (
        <div className="max-w-4xl mx-auto p-6 pb-24 md:pb-6">
            <div className={`rounded-2xl shadow-xl overflow-hidden border ${cardBg}`}>
                <div className={`py-6 px-8 border-b border-yellow-600/30 ${theme === 'dark' ? 'bg-black/40' : 'bg-zinc-900'}`}>
                    <h3 className="text-2xl font-bold text-white text-center font-serif tracking-wide">Editar Perfil</h3>
                </div>
                
                <div className="p-8">
                    {/* Messages */}
                    {message && (
                        <div className={`mb-6 p-4 rounded-lg text-sm font-medium border ${
                            message.type === 'success' 
                                ? 'bg-green-50 text-green-700 border-green-200' 
                                : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                            <div className="flex justify-between items-center">
                                <span>{message.text}</span>
                                <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Avatar Section */}
                        <div className="flex flex-col items-center mb-8">
                            <div className="relative group">
                                <img 
                                    src={formData.avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} 
                                    alt="Avatar" 
                                    className="w-32 h-32 rounded-full object-cover border-4 border-yellow-500 shadow-lg"
                                />
                                <label htmlFor="avatarUpload" className="absolute bottom-0 right-0 bg-zinc-900 text-white p-2 rounded-full cursor-pointer hover:bg-yellow-600 transition-colors shadow-md">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <input type="file" id="avatarUpload" accept="image/*" className="hidden" onChange={handleFileUpload} />
                                </label>
                            </div>
                            
                            <div className="mt-4 text-center">
                                <p className="text-sm text-gray-500 mb-2">O elige uno predefinido:</p>
                                <div className="flex gap-3 justify-center">
                                    {predefinedAvatars.map((av, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setFormData({...formData, avatar: av})}
                                            className={`rounded-full overflow-hidden border-2 transition-transform hover:scale-110 ${formData.avatar === av ? 'border-yellow-500 ring-2 ring-yellow-200' : 'border-transparent'}`}
                                        >
                                            <img src={av} alt={`Avatar ${idx}`} className="w-10 h-10" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Form Fields Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className={`text-sm font-bold uppercase tracking-wider ${labelColor}`}>Usuario</label>
                                <input 
                                    type="text" 
                                    name="username" 
                                    value={formData.username} 
                                    onChange={handleChange} 
                                    required 
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all ${inputBg}`}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`text-sm font-bold uppercase tracking-wider ${labelColor}`}>Email</label>
                                <input 
                                    type="email" 
                                    name="email" 
                                    value={formData.email} 
                                    onChange={handleChange} 
                                    required 
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all ${inputBg}`}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`text-sm font-bold uppercase tracking-wider ${labelColor}`}>Fecha de Nacimiento</label>
                                <input 
                                    type="date" 
                                    name="fechaNacimiento" 
                                    value={formData.fechaNacimiento} 
                                    onChange={handleChange} 
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all ${inputBg}`}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`text-sm font-bold uppercase tracking-wider ${labelColor}`}>Teléfono</label>
                                <input 
                                    type="text" 
                                    name="telefono" 
                                    value={formData.telefono} 
                                    onChange={handleChange} 
                                    placeholder="Ej: 11 1234 5678"
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all ${inputBg}`}
                                />
                            </div>
                        </div>

                        <div className={`border-t my-6 pt-6 ${theme === 'dark' ? 'border-white/10' : 'border-gray-100'}`}>
                            <h5 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Cambiar Contraseña <span className="text-sm font-normal text-gray-500">(Opcional)</span></h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className={`text-sm font-bold uppercase tracking-wider ${labelColor}`}>Nueva Contraseña</label>
                                    <input 
                                        type="password" 
                                        name="password" 
                                        value={formData.password} 
                                        onChange={handleChange} 
                                        placeholder="******" 
                                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all ${inputBg}`}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={`text-sm font-bold uppercase tracking-wider ${labelColor}`}>Confirmar Contraseña</label>
                                    <input 
                                        type="password" 
                                        name="confirmPassword" 
                                        value={formData.confirmPassword} 
                                        onChange={handleChange} 
                                        placeholder="******" 
                                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all ${inputBg}`}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3 pt-4">
                            <button type="submit" className="w-full bg-yellow-600 text-white font-bold py-3 rounded-lg hover:bg-yellow-700 transition-colors shadow-md">
                                Guardar Cambios
                            </button>
                            <div className="grid grid-cols-2 gap-3">
                                <button type="button" onClick={() => window.location.href = '/'} className={`w-full font-bold py-3 rounded-lg transition-colors ${theme === 'dark' ? 'bg-zinc-800 text-gray-300 hover:bg-zinc-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                    Cancelar
                                </button>
                                <button type="button" onClick={handleLogout} className="w-full bg-zinc-800 text-white font-bold py-3 rounded-lg hover:bg-zinc-900 transition-colors">
                                    Cerrar Sesión
                                </button>
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div className={`mt-8 p-6 rounded-xl border ${theme === 'dark' ? 'bg-red-900/10 border-red-900/30' : 'bg-red-50 border-red-100'}`}>
                            <h5 className="text-red-700 font-bold text-lg mb-2">Zona de Peligro</h5>
                            <p className="text-red-600 text-sm mb-4">Una vez que elimines tu cuenta, no hay vuelta atrás. Por favor, tenlo en cuenta.</p>
                            <button type="button" onClick={handleRequestDelete} className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition-colors text-sm">
                                Eliminar Cuenta
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 ${theme === 'dark' ? 'bg-black/80' : 'bg-black/60'}`}>
                    <div className={`rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in ${theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white'}`}>
                        <div className={`px-6 py-4 border-b border-yellow-600/30 flex justify-between items-center ${theme === 'dark' ? 'bg-black/40' : 'bg-zinc-900'}`}>
                            <h5 className="text-white font-bold">Verificación de Seguridad</h5>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">✕</button>
                        </div>
                        <div className="p-6">
                            <p className={`mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{actionType === 'delete' ? 'Has solicitado ELIMINAR tu cuenta.' : 'Has solicitado cambiar datos sensibles.'}</p>
                            <p className="text-gray-600 text-sm mb-4">Hemos enviado un código a tu correo actual: <strong>{originalEmail}</strong></p>
                            <input 
                                type="text" 
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none text-center text-lg tracking-widest ${inputBg}`}
                                placeholder="Código de 6 dígitos" 
                                value={verificationCode} 
                                onChange={(e) => setVerificationCode(e.target.value)} 
                            />
                        </div>
                        <div className={`px-6 py-4 flex justify-end gap-3 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                            <button onClick={() => setShowModal(false)} className={`px-4 py-2 font-bold rounded-lg transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-200'}`}>Cancelar</button>
                            <button 
                                onClick={actionType === 'delete' ? handleVerifyAndDelete : handleVerifyAndSave} 
                                className={`px-4 py-2 text-white font-bold rounded-lg transition-colors ${actionType === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'}`}
                            >
                                {actionType === 'delete' ? 'Confirmar Eliminación' : 'Verificar y Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ALERTA PERSONALIZADA */}
            <CustomAlert 
                isOpen={alertConfig.isOpen}
                onClose={closeAlert}
                {...alertConfig}
            />
        </div>
    );
}
