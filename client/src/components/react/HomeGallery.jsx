import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { UserProvider, useUser } from './users/UserContext';
import CustomAlert from './ui/CustomAlert';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const GalleryItem = ({ item }) => {
    const videoRef = useRef(null);
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseEnter = () => {
        setIsHovered(true);
        if (item.mediaType === 'video' && videoRef.current) {
            videoRef.current.play();
        }
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        if (item.mediaType === 'video' && videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    };

    return (
        <div 
            className="relative mb-4 break-inside-avoid rounded-xl overflow-hidden cursor-pointer group shadow-md hover:shadow-xl transition-all duration-300"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Usuario (Arriba Izquierda) */}
            {item.user && (
                <div className={`absolute top-3 left-3 z-20 flex items-center gap-2 px-2 py-1 rounded-full backdrop-blur-sm shadow-sm ${
                    (item.user.role === 'professional' || item.user.role === 'admin') 
                        ? 'bg-yellow-500/40 text-zinc-900' 
                        : 'bg-black/50 text-white'
                }`}>
                    <img src={item.user.avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} alt="User" className="w-6 h-6 rounded-full object-cover border border-black/10" />
                    <span className="text-xs font-bold">{item.user.username}</span>
                    {(item.user.role === 'professional' || item.user.role === 'admin') && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-blue-700">
                            <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                        </svg>
                    )}
                </div>
            )}

            {/* Imagen Principal */}
            <img 
                src={item.mainMedia} 
                alt={item.title} 
                className="w-full h-auto object-cover"
            />

            {/* Overlay Hover (Video o Imagen 'Antes') */}
            {item.hoverMedia && (
                <div className={`absolute inset-0 transition-opacity duration-500 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                    {item.mediaType === 'video' ? (
                        <video 
                            ref={videoRef}
                            src={item.hoverMedia} 
                            className="w-full h-full object-cover"
                            muted 
                            loop 
                            playsInline
                        />
                    ) : (
                        <img 
                            src={item.hoverMedia} 
                            alt="Before" 
                            className="w-full h-full object-cover"
                        />
                    )}
                </div>
            )}

            {/* Info Overlay (Siempre visible abajo o en hover) */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                <h3 className="text-white font-bold text-lg leading-tight">{item.title}</h3>
                {item.description && <p className="text-gray-300 text-xs mt-1 line-clamp-2">{item.description}</p>}
            </div>
        </div>
    );
};

const HomeGalleryContent = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user, theme } = useUser();
    
    // Estado para el modal de subida
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadForm, setUploadForm] = useState({ title: '', description: '', mainMedia: '', hoverMedia: '', mediaType: 'image' });
    const [uploading, setUploading] = useState(false);

    // Estado para Alertas Personalizadas
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null, showCancel: false });

    const showAlert = (title, message, type = 'info', onConfirm = null, showCancel = false) => {
        setAlertConfig({ isOpen: true, title, message, type, onConfirm, showCancel });
    };
    const closeAlert = () => {
        setAlertConfig({ ...alertConfig, isOpen: false });
    };

    useEffect(() => {
        const fetchGallery = async () => {
            try {
                const res = await axios.get(`${BACKEND_URL}/api/gallery`);
                setItems(res.data);
            } catch (error) {
                console.error("Error cargando galería:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchGallery();
    }, []);

    const handleFileChange = (e, field) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (field === 'hoverMedia') {
                     const isVideo = file.type.startsWith('video');
                     setUploadForm(prev => ({ ...prev, [field]: reader.result, mediaType: isVideo ? 'video' : 'image' }));
                } else {
                     setUploadForm(prev => ({ ...prev, [field]: reader.result }));
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!user) return;
        setUploading(true);
        try {
            await axios.post(`${BACKEND_URL}/api/gallery`, { ...uploadForm, userId: user.id || user._id });
            showAlert("¡Listo!", user.role === 'client' ? '¡Foto subida! Pendiente de aprobación.' : '¡Foto publicada!', "success");
            setShowUploadModal(false);
            setUploadForm({ title: '', description: '', mainMedia: '', hoverMedia: '', mediaType: 'image' });
            // Recargar si es admin/pro, si es cliente no aparecerá aún
            if (user.role !== 'client') window.location.reload();
        } catch (error) {
            showAlert("Error", 'Error al subir: ' + error.message, "error");
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <div className="text-center py-20 text-gray-400">Cargando trabajos...</div>;

    // Efecto para cambiar el fondo del body o contenedor padre si es necesario
    // Como HomeGallery está dentro de un div estático en Astro, podemos usar un portal o simplemente estilizar este contenedor
    // Para simplificar y mantener la consistencia, aplicaremos un fondo al contenedor principal de la galería
    
    const containerClass = theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-100';

    // Clases para inputs del modal
    const inputClass = theme === 'dark' ? 'bg-black/20 border-zinc-700 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-zinc-800 placeholder-gray-400';
    const labelClass = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';

    return (
        <div className={`relative transition-colors duration-500 p-4 rounded-xl ${containerClass}`}>
            <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                {items.map(item => (
                    <GalleryItem key={item._id} item={item} />
                ))}
            </div>

            {/* Botón Flotante de Subida */}
            {user && (
                <button 
                    onClick={() => setShowUploadModal(true)}
                    className="fixed bottom-20 left-1/2 -translate-x-1/2 md:bottom-8 md:right-8 md:left-auto md:translate-x-0 bg-yellow-500 text-zinc-900 p-4 rounded-full shadow-xl hover:bg-yellow-400 hover:scale-110 transition-all z-50 group border-2 border-white/10"
                    title="Subir Foto"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            )}

            {/* Modal de Subida */}
            {showUploadModal && (
                <div className={`fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-md p-4 ${theme === 'dark' ? 'bg-black/80' : 'bg-black/60'}`}>
                    <div className={`rounded-2xl shadow-2xl max-w-lg md:max-w-3xl w-full p-4 md:p-6 relative animate-fade-in max-h-[90vh] overflow-y-auto border ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-100'}`}>
                        <div className="flex justify-between items-center mb-4 md:mb-6">
                            <h3 className={`text-xl md:text-2xl font-serif font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Nueva Publicación</h3>
                            <button onClick={() => setShowUploadModal(false)} className={`p-2 rounded-full hover:bg-gray-500/20 transition-colors ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>✕</button>
                        </div>
                        
                        <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            {/* Columna Izquierda: Textos */}
                            <div className="space-y-3 md:space-y-4 flex flex-col">
                                <div>
                                    <label className={`text-xs font-bold uppercase tracking-wider mb-1 block ${labelClass}`}>Título</label>
                                    <input type="text" placeholder="Ej: Corte Fade + Barba" className={`w-full p-2 md:p-3 rounded-lg border outline-none focus:ring-2 focus:ring-yellow-500 transition-all ${inputClass}`} value={uploadForm.title} onChange={e => setUploadForm({...uploadForm, title: e.target.value})} />
                                </div>
                                
                                <div className="flex-1 flex flex-col">
                                    <label className={`text-xs font-bold uppercase tracking-wider mb-1 block ${labelClass}`}>Descripción</label>
                                    <textarea placeholder="Cuéntanos sobre este trabajo..." rows="3" className={`w-full p-2 md:p-3 rounded-lg border outline-none focus:ring-2 focus:ring-yellow-500 transition-all resize-none flex-1 ${inputClass}`} value={uploadForm.description} onChange={e => setUploadForm({...uploadForm, description: e.target.value})} />
                                </div>
                            </div>
                            
                            {/* Columna Derecha: Fotos */}
                            <div className="space-y-3 md:space-y-4">
                                {/* Foto Principal */}
                                <div>
                                    <label className={`text-xs font-bold uppercase tracking-wider mb-1 block ${labelClass}`}>Foto Principal</label>
                                    <div className={`border-2 border-dashed rounded-xl p-3 md:p-4 text-center relative transition-colors group h-32 md:h-40 flex flex-col justify-center items-center ${theme === 'dark' ? 'border-zinc-700 hover:border-yellow-500 hover:bg-zinc-800' : 'border-gray-300 hover:border-yellow-500 hover:bg-yellow-50'}`}>
                                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'mainMedia')} className="absolute inset-0 opacity-0 cursor-pointer z-10" required />
                                    
                                    {uploadForm.mainMedia ? (
                                        <div className="absolute inset-0 rounded-lg overflow-hidden">
                                            <img src={uploadForm.mainMedia} alt="Preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-white font-bold text-sm">Cambiar Foto</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 mb-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <p className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Toca para subir</p>
                                        </>
                                    )}
                                </div>
                                </div>

                                {/* Efecto Hover */}
                                <div>
                                    <label className={`text-xs font-bold uppercase tracking-wider mb-1 block ${labelClass}`}>Hover (Opcional)</label>
                                    <div className={`border-2 border-dashed rounded-xl p-3 md:p-4 text-center relative transition-colors group h-24 md:h-32 flex flex-col justify-center items-center ${theme === 'dark' ? 'border-zinc-700 hover:border-yellow-500 hover:bg-zinc-800' : 'border-gray-300 hover:border-yellow-500 hover:bg-yellow-50'}`}>
                                    <input type="file" accept="image/*,video/*" onChange={(e) => handleFileChange(e, 'hoverMedia')} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                    
                                    {uploadForm.hoverMedia ? (
                                        <div className="absolute inset-0 rounded-lg overflow-hidden bg-black">
                                            {uploadForm.mediaType === 'video' ? (
                                                <video src={uploadForm.hoverMedia} className="w-full h-full object-cover opacity-60" />
                                            ) : (
                                                <img src={uploadForm.hoverMedia} alt="Preview Hover" className="w-full h-full object-cover opacity-60" />
                                            )}
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-white font-bold text-xs bg-black/50 px-2 py-1 rounded mb-1">{uploadForm.mediaType === 'video' ? 'VIDEO' : 'IMAGEN'}</span>
                                                <span className="text-white font-bold text-sm">Cambiar</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 mb-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                            <p className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Toca para subir</p>
                                        </>
                                    )}
                                </div>
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <button 
                                    type="submit" 
                                    disabled={uploading}
                                    className="w-full bg-yellow-500 text-zinc-900 py-3 md:py-4 rounded-xl font-bold hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all transform active:scale-95 uppercase tracking-wide text-sm md:text-base"
                                >
                                    {uploading ? 'Subiendo...' : 'Publicar'}
                                </button>
                            </div>
                        </form>
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
};

const HomeGallery = () => (
    <UserProvider>
        <HomeGalleryContent />
    </UserProvider>
);

export default HomeGallery;
