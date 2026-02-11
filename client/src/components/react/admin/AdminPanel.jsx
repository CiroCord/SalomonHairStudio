import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserProvider, useUser } from '../users/UserContext';
import CustomAlert from '../ui/CustomAlert';
import MyAppointments from '../MyAppointments';

const BACKEND_URL = import.meta.env.PUBLIC_BACKEND_URL || 'https://salomon-hair-studio.vercel.app';

const AdminPanelContent = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(false);
    const { user, loading: userLoading, theme } = useUser();

    // Datos
    const [professionals, setProfessionals] = useState([]);
    const [services, setServices] = useState([]);
    const [categories, setCategories] = useState([]);
    const [galleryItems, setGalleryItems] = useState([]);
    const [pendingGallery, setPendingGallery] = useState([]); // Pendientes
    const [rejectedGallery, setRejectedGallery] = useState([]); // Rechazados
    const [config, setConfig] = useState({ workingDays: [], openingTime: '', closingTime: '', timeBlock: 30, whatsappNumber: '', dyeBrands: [], productCategories: [] });
    const [products, setProducts] = useState([]);

    // Formularios
    const [proForm, setProForm] = useState({ name: '', email: '', active: true });
    const [serviceForm, setServiceForm] = useState({ name: '', duration: 30, price: 0, priceMax: 0, priceType: 'fixed', requiresDeposit: false, requiresWhatsApp: false, description: '', category: '' });
    const [editingServiceId, setEditingServiceId] = useState(null);
    const [catForm, setCatForm] = useState({ name: '', description: '' });
    const [galleryForm, setGalleryForm] = useState({ title: '', description: '', mainMedia: '', hoverMedia: '', mediaType: 'image' });
    const [productForm, setProductForm] = useState({ name: '', brand: '', image: '', category: '' });
    const [editingProductId, setEditingProductId] = useState(null);
    const [newBrand, setNewBrand] = useState('');
    const [newCategory, setNewCategory] = useState('');
    
    // Estado para Stock
    const [stockSelection, setStockSelection] = useState([]);
    const [stockAmount, setStockAmount] = useState(1);
    const [stockFilterBrand, setStockFilterBrand] = useState('Todas');
    const [flashingDye, setFlashingDye] = useState(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [actionLoading, setActionLoading] = useState(false);

    // Estado para Alertas Personalizadas
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null, showCancel: false });

    const showAlert = (title, message, type = 'info', onConfirm = null, showCancel = false) => {
        setAlertConfig({ isOpen: true, title, message, type, onConfirm, showCancel });
    };
    const closeAlert = () => {
        setAlertConfig({ ...alertConfig, isOpen: false });
    };

    useEffect(() => {
        if (!userLoading) {
            if (!user || (user.role !== 'admin' && user.role !== 'professional')) {
                window.location.href = '/';
                return;
            }
            fetchData();
        }
    }, [user, userLoading]);

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [prosRes, servRes, catRes, confRes, galRes, pendingRes, rejectedRes, dyesRes] = await Promise.all([
                axios.get(`${BACKEND_URL}/api/admin/professionals`),
                axios.get(`${BACKEND_URL}/api/admin/services`),
                axios.get(`${BACKEND_URL}/api/admin/categories`),
                axios.get(`${BACKEND_URL}/api/admin/config`),
                axios.get(`${BACKEND_URL}/api/gallery`),
                axios.get(`${BACKEND_URL}/api/gallery/pending`),
                axios.get(`${BACKEND_URL}/api/gallery/rejected`),
                axios.get(`${BACKEND_URL}/api/admin/dyes`)
            ]);
            setProfessionals(prosRes.data);
            setServices(servRes.data);
            setCategories(catRes.data);
            setConfig(confRes.data);
            setGalleryItems(galRes.data);
            setPendingGallery(pendingRes.data);
            setRejectedGallery(rejectedRes.data);
            setProducts(dyesRes.data);
        } catch (error) {
            console.error("Error cargando datos admin:", error);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    // --- HANDLERS ---
    const handleCreatePro = async (e) => {
        e.preventDefault();
        await axios.post(`${BACKEND_URL}/api/admin/professionals`, proForm);
        fetchData();
        setProForm({ name: '', email: '', active: true });
    };
    const handleDeletePro = async (id) => { 
        showAlert("Eliminar Profesional", "¿Estás seguro de eliminar este profesional?", "warning", async () => {
            await axios.delete(`${BACKEND_URL}/api/admin/professionals/${id}`); 
            fetchData(); 
        }, true);
    };

    const handleSubmitService = async (e) => {
        e.preventDefault();
        if (editingServiceId) {
            await axios.put(`${BACKEND_URL}/api/admin/services/${editingServiceId}`, serviceForm);
        } else {
            await axios.post(`${BACKEND_URL}/api/admin/services`, serviceForm);
        }
        fetchData();
        setEditingServiceId(null);
        setServiceForm({ name: '', duration: 30, price: 0, priceMax: 0, priceType: 'fixed', requiresDeposit: false, requiresWhatsApp: false, description: '', category: '' });
    };

    const handleEditService = (srv) => {
        if (editingServiceId === srv._id) {
            // Cancelar edición (Cruz)
            setEditingServiceId(null);
            setServiceForm({ name: '', duration: 30, price: 0, priceMax: 0, priceType: 'fixed', requiresDeposit: false, requiresWhatsApp: false, description: '', category: '' });
            return;
        }
        // Activar edición (Lápiz)
        setEditingServiceId(srv._id);
        
        // Inferir tipo de precio si no está definido explícitamente pero hay rango
        let inferredPriceType = srv.priceType || 'fixed';
        if (!srv.priceType && srv.priceMax > srv.price) {
            inferredPriceType = 'range';
        }

        setServiceForm({
            name: srv.name,
            duration: srv.duration,
            price: srv.price,
            priceMax: srv.priceMax || 0,
            priceType: inferredPriceType,
            requiresDeposit: srv.requiresDeposit || false,
            requiresWhatsApp: srv.requiresWhatsApp || false,
            description: srv.description || '',
            category: srv.category?._id || ''
        });
    };

    const handleCancelEdit = () => {
        setEditingServiceId(null);
        setServiceForm({ name: '', duration: 30, price: 0, priceMax: 0, priceType: 'fixed', requiresDeposit: false, requiresWhatsApp: false, description: '', category: '' });
    };
    const handleDeleteService = async (id) => { 
        showAlert("Eliminar Servicio", "¿Estás seguro de eliminar este servicio?", "warning", async () => {
            await axios.delete(`${BACKEND_URL}/api/admin/services/${id}`); 
            fetchData(); 
        }, true);
    };

    const handleCreateCategory = async (e) => {
        e.preventDefault();
        await axios.post(`${BACKEND_URL}/api/admin/categories`, catForm);
        fetchData();
        setCatForm({ name: '', description: '' });
    };
    const handleDeleteCategory = async (id) => { 
        showAlert("Eliminar Categoría", "¿Estás seguro de eliminar esta categoría?", "warning", async () => {
            await axios.delete(`${BACKEND_URL}/api/admin/categories/${id}`); 
            fetchData(); 
        }, true);
    };

    const handleUpdateConfig = async (e) => {
        e.preventDefault();
        // Eliminamos _id y __v para evitar error de campo inmutable en MongoDB
        const { _id, __v, ...configToSave } = config;
        try {
            await axios.put(`${BACKEND_URL}/api/admin/config`, configToSave);
            showAlert("Guardado", "Configuración guardada correctamente.", "success");
        } catch (error) {
            console.error("Error guardando configuración:", error);
            showAlert("Error", "No se pudo guardar la configuración.", "error");
        }
    };

    // --- PRODUCT HANDLERS ---
    const handleCreateProduct = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const categoryToSave = selectedCategory === 'Todos' ? productForm.category : selectedCategory;
            if (!categoryToSave) throw new Error("Debes seleccionar una categoría.");

            if (editingProductId) {
                await axios.put(`${BACKEND_URL}/api/admin/dyes/${editingProductId}`, { ...productForm, category: categoryToSave });
                showAlert("Éxito", "Producto actualizado correctamente.", "success");
            } else {
                await axios.post(`${BACKEND_URL}/api/admin/dyes`, { ...productForm, category: categoryToSave });
                showAlert("Éxito", "Producto agregado correctamente.", "success");
            }

            await fetchData(true); // Recarga silenciosa para no parpadear
            setProductForm({ name: '', brand: '', image: '', category: '' });
            setEditingProductId(null);
        } catch (error) {
            showAlert("Error", error.message, "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleEditProduct = (product) => {
        setEditingProductId(product._id);
        setProductForm({
            name: product.name,
            brand: product.brand,
            image: product.image,
            category: product.category
        });
        const mainContainer = document.querySelector('main');
        if(mainContainer) mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEditProduct = () => {
        setEditingProductId(null);
        setProductForm({ name: '', brand: '', image: '', category: '' });
    };

    const handleDeleteProduct = async (id) => {
        showAlert("Eliminar Producto", "¿Estás seguro de eliminar este producto?", "warning", async () => {
            await axios.delete(`${BACKEND_URL}/api/admin/dyes/${id}`);
            fetchData();
        }, true);
    };

    const handleProductFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProductForm(prev => ({ ...prev, image: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const addBrand = () => {
        if (newBrand.trim() && !config.dyeBrands?.includes(newBrand.trim())) {
            setConfig(prev => ({ ...prev, dyeBrands: [...(prev.dyeBrands || []), newBrand.trim()] }));
            setNewBrand('');
        }
    };

    const removeBrand = (brand) => {
        setConfig(prev => ({ ...prev, dyeBrands: prev.dyeBrands.filter(b => b !== brand) }));
    };

    const addCategory = () => {
        if (newCategory.trim() && !config.productCategories?.includes(newCategory.trim())) {
            setConfig(prev => ({ ...prev, productCategories: [...(prev.productCategories || []), newCategory.trim()] }));
            setNewCategory('');
        }
    };

    const removeCategory = (cat) => {
        setConfig(prev => ({ ...prev, productCategories: prev.productCategories.filter(c => c !== cat) }));
    };

    // --- STOCK HANDLERS ---
    const handleDecrementStock = async (dye) => {
        // Efecto visual inmediato
        setFlashingDye(dye._id);
        setTimeout(() => setFlashingDye(null), 300);

        // Actualización optimista local
        setProducts(prev => prev.map(d => d._id === dye._id ? { ...d, stock: Math.max(0, (d.stock || 0) - 1) } : d));

        try {
            await axios.put(`${BACKEND_URL}/api/admin/dyes/${dye._id}/stock`, { amount: -1 });
        } catch (error) {
            console.error("Error actualizando stock:", error);
            fetchData(); // Revertir si falla
        }
    };

    const toggleSelectDye = (id) => {
        setStockSelection(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const handleSelectAllBrand = () => {
        // Filtramos los productos visibles actualmente en la grilla
        const visibleProducts = products.filter(d => 
            (selectedCategory === 'Todos' || d.category === selectedCategory) && 
            (stockFilterBrand === 'Todas' || d.brand === stockFilterBrand)
        ).map(d => d._id);
        
        // Si ya están todos seleccionados, deseleccionar. Si no, seleccionar todos.
        const allSelected = visibleProducts.every(id => stockSelection.includes(id));
        
        if (allSelected) {
            setStockSelection(prev => prev.filter(id => !visibleProducts.includes(id)));
        } else {
            // Agregar los que falten
            const newSelection = [...new Set([...stockSelection, ...visibleProducts])];
            setStockSelection(newSelection);
        }
    };

    const handleBulkUpdate = async (multiplier) => {
        if (stockSelection.length === 0) {
            showAlert("Atención", "Selecciona al menos un producto.", "warning");
            return;
        }
        if (stockAmount <= 0) return;

        const amount = stockAmount * multiplier; // Positivo para agregar, negativo para quitar

        try {
            await axios.put(`${BACKEND_URL}/api/admin/dyes/stock/bulk`, { 
                ids: stockSelection, 
                amount: amount 
            });
            
            showAlert("Stock Actualizado", "El inventario ha sido modificado.", "success");
            setStockSelection([]); // Limpiar selección
            fetchData(); // Recargar datos
        } catch (error) {
            showAlert("Error", error.message, "error");
        }
    };

    // --- GALLERY HANDLERS ---
    const handleFileChange = (e, field) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setGalleryForm(prev => ({ ...prev, [field]: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCreateGalleryItem = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post(`${BACKEND_URL}/api/gallery`, galleryForm);
            fetchData();
            setGalleryForm({ title: '', description: '', mainMedia: '', hoverMedia: '', mediaType: 'image' });
            showAlert("Éxito", "Publicación creada con éxito.", "success");
        } catch (error) {
            showAlert("Error", 'Error al crear publicación: ' + error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteGalleryItem = async (id) => {
        showAlert("Eliminar Publicación", "¿Estás seguro de eliminar esta publicación?", "warning", async () => {
            await axios.delete(`${BACKEND_URL}/api/gallery/${id}`);
            fetchData();
        }, true);
    };

    const toggleDay = (dayIndex) => {
        const currentDays = config.workingDays || [];
        if (currentDays.includes(dayIndex)) {
            setConfig({ ...config, workingDays: currentDays.filter(d => d !== dayIndex) });
        } else {
            setConfig({ ...config, workingDays: [...currentDays, dayIndex].sort() });
        }
    };

    // --- MODERATION LOGIC (SWIPE) ---
    const [swipeDirection, setSwipeDirection] = useState(null); // 'left' | 'right' | null

    const handleModerationDecision = async (id, decision) => { // decision: 'approved' | 'rejected'
        setSwipeDirection(decision === 'approved' ? 'right' : 'left');
        
        // Animación visual antes de la petición
        setTimeout(async () => {
            try {
                await axios.put(`${BACKEND_URL}/api/gallery/${id}/status`, { status: decision });
                // Actualizar listas localmente para rapidez
                const item = pendingGallery.find(i => i._id === id);
                setPendingGallery(prev => prev.filter(i => i._id !== id));
                
                if (decision === 'approved') {
                    setGalleryItems(prev => [item, ...prev]);
                } else {
                    setRejectedGallery(prev => [item, ...prev]);
                }
            } catch (error) {
                console.error("Error moderando:", error);
            } finally {
                setSwipeDirection(null);
            }
        }, 300); // Esperar a que termine la animación CSS
    };

    const handleRestoreRejected = async (id) => {
        showAlert("Restaurar", "¿Restaurar esta publicación a pendientes?", "info", async () => {
            try {
                await axios.put(`${BACKEND_URL}/api/gallery/${id}/status`, { status: 'pending' });
                fetchData();
            } catch (error) { console.error(error); }
        }, true);
    };

    // Estilos dinámicos
    const bgMain = theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-100';
    const bgPanel = theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-100';
    const textPrimary = theme === 'dark' ? 'text-white' : 'text-zinc-800';
    const textSecondary = theme === 'dark' ? 'text-gray-400' : 'text-gray-500';
    const inputClass = theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900';
    const borderClass = theme === 'dark' ? 'border-zinc-700' : 'border-gray-100';
    const headerClass = theme === 'dark' ? 'bg-zinc-900/50 border-zinc-700' : 'bg-gray-50 border-gray-100';
    const hoverClass = theme === 'dark' ? 'hover:bg-zinc-700' : 'hover:bg-gray-50';

    // Componente de Tarjeta Swipeable (Simplificado con botones para desktop/mobile)
    const SwipeCard = ({ item }) => (
        <div className={`rounded-2xl shadow-xl overflow-hidden max-w-sm mx-auto transition-transform duration-300 ${bgPanel} ${swipeDirection === 'right' ? 'translate-x-full opacity-0 rotate-12' : swipeDirection === 'left' ? '-translate-x-full opacity-0 -rotate-12' : ''}`}>
            <div className="relative aspect-[3/4]">
                <img src={item.mainMedia} alt="Post" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                        <img src={item.user?.avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} className="w-8 h-8 rounded-full border border-white" />
                        <span className="font-bold">{item.user?.username || 'Usuario'}</span>
                    </div>
                    <p className="text-sm opacity-90">{item.title}</p>
                </div>
            </div>
            <div className={`flex border-t ${borderClass}`}>
                <button onClick={() => handleModerationDecision(item._id, 'rejected')} className="flex-1 py-4 text-red-500 font-bold hover:bg-red-50 transition-colors flex justify-center items-center gap-2">
                    <span>✕</span> RECHAZAR
                </button>
                <div className={`w-px ${theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-100'}`}></div>
                <button onClick={() => handleModerationDecision(item._id, 'approved')} className="flex-1 py-4 text-green-500 font-bold hover:bg-green-50 transition-colors flex justify-center items-center gap-2">
                    ACEPTAR <span>✓</span>
                </button>
            </div>
        </div>
    );

    if (loading || userLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-900">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-yellow-500"></div>
        </div>
    );

    // Sidebar Item Component
    const SidebarItem = ({ id, label, icon }) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${activeTab === id ? 'bg-yellow-600 text-white shadow-lg' : 'text-gray-400 hover:bg-zinc-800 hover:text-white'}`}
        >
            <span className="text-xl">{icon}</span>
            <span className="font-medium">{label}</span>
        </button>
    );

    const isAdmin = user?.role === 'admin';
    const canManageStock = user?.role === 'admin' || user?.role === 'professional';

    return (
        <div className={`flex font-sans ${bgMain} md:h-[calc(100vh-66px)] overflow-hidden`}>
            {/* Sidebar */}
            <aside className="w-64 bg-zinc-900 text-white flex-shrink-0 hidden md:flex flex-col h-full">
                <div className="p-6 border-b border-zinc-800">
                    <h2 className="text-2xl font-serif font-bold text-yellow-500 tracking-wider">SALOMON</h2>
                    <p className="text-xs text-gray-500 tracking-[0.3em] uppercase">Admin Panel</p>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <SidebarItem id="dashboard" label="Resumen" icon="📊" />
                    <SidebarItem id="appointments" label="Mis Turnos" icon="📅" />
                    <SidebarItem id="gallery" label="Galería" icon="🖼️" />
                    <SidebarItem id="moderation" label="Moderación" icon="🛡️" />
                    {isAdmin && (
                        <>
                            <SidebarItem id="professionals" label="Profesionales" icon="💇‍♂️" />
                            <SidebarItem id="services" label="Servicios" icon="✂️" />
                            <SidebarItem id="categories" label="Categorías" icon="🏷️" />
                            <SidebarItem id="settings" label="Configuración" icon="⚙️" />
                        </>
                    )}
                    {canManageStock && (
                        <>
                            <SidebarItem id="products" label="Productos" icon="🎨" />
                            <SidebarItem id="inventory" label="Inventario" icon="📦" />
                        </>
                    )}
                </nav>
                <div className="p-4 border-t border-zinc-800">
                    <button onClick={() => window.location.href = '/'} className="w-full flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                        <span>←</span> Volver al sitio
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto h-full">
                {/* Mobile Header */}
                <div className="md:hidden bg-zinc-900 text-white p-4 flex justify-between items-center sticky top-0 z-20">
                    <span className="font-bold text-yellow-500">SALOMON ADMIN</span>
                    <select 
                        value={activeTab} 
                        onChange={(e) => setActiveTab(e.target.value)}
                        className="bg-zinc-800 text-white border-none rounded px-2 py-1"
                    >
                        <option value="dashboard">Resumen</option>
                        <option value="appointments">Mis Turnos</option>
                        <option value="gallery">Galería</option>
                        <option value="moderation">Moderación</option>
                        {isAdmin && (
                            <>
                                <option value="professionals">Profesionales</option>
                                <option value="services">Servicios</option>
                                <option value="categories">Categorías</option>
                                <option value="settings">Configuración</option>
                            </>
                        )}
                        {canManageStock && (
                            <>
                                <option value="products">Productos</option>
                                <option value="inventory">Inventario</option>
                            </>
                        )}
                    </select>
                </div>

                {activeTab === 'appointments' ? (
                    <div className="h-full"><MyAppointments /></div>
                ) : (
                <div className="p-8 pb-24 md:pb-8">
                    <h1 className={`text-3xl font-bold mb-2 capitalize ${textPrimary}`}>{activeTab === 'dashboard' ? 'Resumen del Negocio' : activeTab}</h1>
                    <p className={`${textSecondary} mb-8`}>Gestiona tu peluquería desde aquí.</p>

                    {/* DASHBOARD */}
                    {activeTab === 'dashboard' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className={`p-6 rounded-xl shadow-sm border ${bgPanel}`}>
                                <h3 className={`${textSecondary} text-sm font-bold uppercase`}>Profesionales</h3>
                                <p className={`text-4xl font-bold mt-2 ${textPrimary}`}>{professionals.length}</p>
                            </div>
                            <div className={`p-6 rounded-xl shadow-sm border ${bgPanel}`}>
                                <h3 className={`${textSecondary} text-sm font-bold uppercase`}>Servicios Activos</h3>
                                <p className={`text-4xl font-bold mt-2 ${textPrimary}`}>{services.length}</p>
                            </div>
                            <div className={`p-6 rounded-xl shadow-sm border ${bgPanel}`}>
                                <h3 className={`${textSecondary} text-sm font-bold uppercase`}>Publicaciones</h3>
                                <p className={`text-4xl font-bold mt-2 ${textPrimary}`}>{galleryItems.length}</p>
                            </div>
                            <div className={`p-6 rounded-xl shadow-sm border ${bgPanel}`}>
                                <h3 className={`${textSecondary} text-sm font-bold uppercase`}>Pendientes</h3>
                                <p className="text-4xl font-bold text-yellow-600 mt-2">{pendingGallery.length}</p>
                            </div>
                        </div>
                    )}

                    {/* PROFESIONALES */}
                    {activeTab === 'professionals' && (
                        <div className={`rounded-xl shadow-sm border overflow-hidden ${bgPanel}`}>
                            <div className={`p-6 border-b ${headerClass}`}>
                                <h3 className={`font-bold text-lg ${textPrimary}`}>Agregar Nuevo Profesional</h3>
                                <form onSubmit={handleCreatePro} className="flex flex-col md:flex-row gap-4 mt-4 items-end">
                                    <input type="text" placeholder="Nombre" className={`flex-1 p-2 border rounded-lg w-full ${inputClass}`} value={proForm.name} onChange={e => setProForm({...proForm, name: e.target.value})} required />
                                    <input type="email" placeholder="Email" className={`flex-1 p-2 border rounded-lg w-full ${inputClass}`} value={proForm.email} onChange={e => setProForm({...proForm, email: e.target.value})} required />
                                    <button type="submit" className="bg-zinc-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-zinc-700 w-full md:w-auto">Crear</button>
                                </form>
                            </div>
                            <div className={`divide-y ${theme === 'dark' ? 'divide-zinc-700' : 'divide-gray-100'}`}>
                                {professionals.map(pro => (
                                    <div key={pro._id} className={`p-4 flex justify-between items-center transition-colors ${hoverClass}`}>
                                        <div>
                                            <p className={`font-bold ${textPrimary}`}>{pro.name}</p>
                                            <p className="text-sm text-gray-500">{pro.email}</p>
                                        </div>
                                        <button onClick={() => handleDeletePro(pro._id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Eliminar</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SERVICIOS */}
                    {activeTab === 'services' && (
                        <div className={`rounded-xl shadow-sm border overflow-hidden ${bgPanel}`}>
                            <div className={`p-6 border-b ${headerClass}`}>
                                <h3 className={`font-bold text-lg ${textPrimary}`}>{editingServiceId ? 'Actualizar Servicio' : 'Agregar Nuevo Servicio'}</h3>
                                <form onSubmit={handleSubmitService} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                                    <div className="lg:col-span-2"><input type="text" placeholder="Nombre del Servicio" className={`w-full p-2 border rounded-lg ${inputClass}`} value={serviceForm.name} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} required /></div>
                                    
                                    <div>
                                        <select className={`w-full p-2 border rounded-lg ${inputClass}`} value={serviceForm.category} onChange={e => setServiceForm({...serviceForm, category: e.target.value})}>
                                            <option value="">Categoría...</option>
                                            {categories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                                        </select>
                                    </div>
                                    
                                    <div><input type="number" placeholder="Duración (min)" className={`w-full p-2 border rounded-lg ${inputClass}`} value={serviceForm.duration} onChange={e => setServiceForm({...serviceForm, duration: Number(e.target.value)})} required /></div>

                                    <div>
                                        <select className={`w-full p-2 border rounded-lg ${inputClass}`} value={serviceForm.priceType} onChange={e => setServiceForm({...serviceForm, priceType: e.target.value})}>
                                            <option value="fixed">Precio Fijo</option>
                                            <option value="range">Rango de Precio</option>
                                            <option value="consultation">A Consultar</option>
                                        </select>
                                    </div>

                                    {serviceForm.priceType !== 'consultation' && (
                                        <div><input type="number" placeholder={serviceForm.priceType === 'range' ? "Precio Mínimo" : "Precio"} className={`w-full p-2 border rounded-lg ${inputClass}`} value={serviceForm.price} onChange={e => setServiceForm({...serviceForm, price: Number(e.target.value)})} required /></div>
                                    )}

                                    {serviceForm.priceType === 'range' && (
                                        <div><input type="number" placeholder="Precio Máximo" className={`w-full p-2 border rounded-lg ${inputClass}`} value={serviceForm.priceMax} onChange={e => setServiceForm({...serviceForm, priceMax: Number(e.target.value)})} /></div>
                                    )}

                                    <div className="lg:col-span-4">
                                        <textarea placeholder="Descripción del servicio (Opcional)" className={`w-full p-2 border rounded-lg h-20 ${inputClass}`} value={serviceForm.description} onChange={e => setServiceForm({...serviceForm, description: e.target.value})} />
                                    </div>

                                    <div className="lg:col-span-4 flex flex-wrap gap-6">
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="checkbox" 
                                                id="requiresDeposit" 
                                                checked={serviceForm.requiresDeposit} 
                                                onChange={e => setServiceForm({...serviceForm, requiresDeposit: e.target.checked})} 
                                                className="w-4 h-4 text-yellow-600 rounded focus:ring-yellow-500"
                                            />
                                            <label htmlFor="requiresDeposit" className={`text-sm font-bold ${textPrimary}`}>Requiere Seña</label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="checkbox" 
                                                id="requiresWhatsApp" 
                                                checked={serviceForm.requiresWhatsApp} 
                                                onChange={e => setServiceForm({...serviceForm, requiresWhatsApp: e.target.checked})} 
                                                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                                            />
                                            <label htmlFor="requiresWhatsApp" className={`text-sm font-bold ${textPrimary}`}>Reserva por WhatsApp</label>
                                        </div>
                                    </div>

                                    <button type="submit" className={`text-white px-6 py-2 rounded-lg font-bold lg:col-span-4 w-full transition-colors ${editingServiceId ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-zinc-900 hover:bg-zinc-700'}`}>
                                        {editingServiceId ? 'Actualizar Servicio' : 'Guardar Servicio'}
                                    </button>
                                </form>
                            </div>
                            <div className={`divide-y ${theme === 'dark' ? 'divide-zinc-700' : 'divide-gray-100'}`}>
                                {services.map(srv => (
                                    <div key={srv._id} className={`p-4 flex justify-between items-center transition-colors ${hoverClass} ${editingServiceId === srv._id ? 'bg-yellow-50 border-l-4 border-yellow-500' : ''}`}>
                                        <div>
                                            <p className={`font-bold ${textPrimary}`}>{srv.name}</p>
                                            <p className="text-sm text-gray-500">
                                                {srv.priceType === 'consultation' ? 'Consultar' : srv.priceType === 'range' ? `$${srv.price.toLocaleString('es-AR')} - $${srv.priceMax.toLocaleString('es-AR')}` : `$${srv.price.toLocaleString('es-AR')}`} 
                                                {' '}• {srv.duration} min • {srv.category?.name || 'Sin cat.'}
                                                {srv.requiresDeposit && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-bold">Seña</span>}
                                                {srv.requiresWhatsApp && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold">WhatsApp</span>}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => handleEditService(srv)} className="text-blue-600 hover:text-blue-800 text-lg font-bold px-2" title={editingServiceId === srv._id ? "Cancelar edición" : "Editar"}>
                                                {editingServiceId === srv._id ? '✕' : '✎'}
                                            </button>
                                            <button onClick={() => handleDeleteService(srv._id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Eliminar</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CATEGORÍAS */}
                    {activeTab === 'categories' && (
                        <div className={`rounded-xl shadow-sm border overflow-hidden ${bgPanel}`}>
                            <div className={`p-6 border-b ${headerClass}`}>
                                <h3 className={`font-bold text-lg ${textPrimary}`}>Nueva Categoría</h3>
                                <form onSubmit={handleCreateCategory} className="flex flex-col md:flex-row gap-4 mt-4 items-end">
                                    <input type="text" placeholder="Nombre" className={`flex-1 p-2 border rounded-lg w-full ${inputClass}`} value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} required />
                                    <input type="text" placeholder="Descripción (Opcional)" className={`flex-1 p-2 border rounded-lg w-full ${inputClass}`} value={catForm.description} onChange={e => setCatForm({...catForm, description: e.target.value})} />
                                    <button type="submit" className="bg-zinc-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-zinc-700 w-full md:w-auto">Crear</button>
                                </form>
                            </div>
                            <div className={`divide-y ${theme === 'dark' ? 'divide-zinc-700' : 'divide-gray-100'}`}>
                                {categories.map(cat => (
                                    <div key={cat._id} className={`p-4 flex justify-between items-center transition-colors ${hoverClass}`}>
                                        <div>
                                            <p className={`font-bold ${textPrimary}`}>{cat.name}</p>
                                            <p className="text-sm text-gray-500">{cat.description}</p>
                                        </div>
                                        <button onClick={() => handleDeleteCategory(cat._id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Eliminar</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* PRODUCTOS */}
                    {activeTab === 'products' && (
                        <div className={`rounded-xl shadow-sm border overflow-hidden ${bgPanel}`}>
                            {/* Selector de Categoría */}
                            <div className={`px-6 pt-4 border-b flex gap-6 overflow-x-auto ${headerClass}`}>
                                {['Todos', ...(config.productCategories || [])].map((cat, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`pb-3 text-sm font-bold whitespace-nowrap transition-all border-b-2 ${
                                            selectedCategory === cat 
                                                ? 'text-yellow-500 border-yellow-500' 
                                                : (theme === 'dark' ? 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600' : 'text-gray-500 border-transparent hover:text-zinc-800 hover:border-gray-300')
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            <div className={`p-6 border-b ${headerClass}`}>
                                <h3 className={`font-bold text-lg ${textPrimary}`}>{editingProductId ? 'Editar Producto' : `Agregar ${selectedCategory === 'Todos' ? 'Producto' : selectedCategory}`}</h3>
                                <form onSubmit={handleCreateProduct} className="flex flex-col md:flex-row gap-4 mt-4 items-end">
                                    {selectedCategory === 'Todos' && (
                                        <div className="flex-1 w-full">
                                            <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${textSecondary}`}>Categoría</label>
                                            <select className={`w-full p-2 border rounded-lg ${inputClass}`} value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})} required>
                                                <option value="">Seleccionar...</option>
                                                {config.productCategories?.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <div className="flex-1 w-full">
                                        <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${textSecondary}`}>{(selectedCategory === 'Tintes' || productForm.category === 'Tintes') ? 'Número / Tono' : 'Nombre'}</label>
                                        <input type="text" placeholder={(selectedCategory === 'Tintes' || productForm.category === 'Tintes') ? "Ej: 7.1" : "Ej: Shampoo Keratina"} className={`w-full p-2 border rounded-lg ${inputClass}`} value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} required />
                                    </div>
                                    <div className="flex-1 w-full">
                                        <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${textSecondary}`}>Marca</label>
                                        <select className={`w-full p-2 border rounded-lg ${inputClass}`} value={productForm.brand} onChange={e => setProductForm({...productForm, brand: e.target.value})} required>
                                            <option value="">Seleccionar Marca...</option>
                                            {config.dyeBrands?.map((brand, idx) => (
                                                <option key={idx} value={brand}>{brand}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex-1 w-full">
                                        <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${textSecondary}`}>Foto (Color)</label>
                                        <div className={`relative border rounded-lg h-[42px] flex items-center px-2 overflow-hidden ${inputClass}`}>
                                            <input type="file" accept="image/*" onChange={handleProductFileChange} className="absolute inset-0 opacity-0 cursor-pointer w-full" required />
                                            <span className="text-sm truncate">{productForm.image ? 'Imagen seleccionada' : 'Subir foto...'}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full md:w-auto">
                                        <button type="submit" className="bg-zinc-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-zinc-700 flex-1 md:flex-none h-[42px]">
                                            {editingProductId ? 'Guardar' : 'Agregar'}
                                        </button>
                                        {editingProductId && (
                                            <button type="button" onClick={handleCancelEditProduct} className="bg-gray-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-600 h-[42px]">
                                                Cancelar
                                            </button>
                                        )}
                                    </div>
                                </form>
                                {(!config.dyeBrands || config.dyeBrands.length === 0) && (
                                    <p className="text-xs text-red-500 mt-2">* Debes agregar marcas en Configuración primero.</p>
                                )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-6">
                                {products.filter(p => selectedCategory === 'Todos' || p.category === selectedCategory).map(dye => (
                                    <div key={dye._id} onClick={() => handleEditProduct(dye)} className={`rounded-lg border overflow-hidden relative group cursor-pointer ${editingProductId === dye._id ? 'ring-2 ring-yellow-500' : ''} ${(dye.stock || 0) <= 0 ? 'grayscale border-red-500 border-2' : borderClass}`}>
                                        <div className="aspect-square bg-gray-100 relative">
                                            <img src={dye.image} alt={dye.name} className="w-full h-full object-cover" />
                                            <button onClick={() => handleDeleteProduct(dye._id)} className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">✕</button>
                                        </div>
                                        <div className={`p-2 text-center ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
                                            <p className={`font-bold text-lg ${textPrimary}`}>{dye.name}</p>
                                            <p className="text-xs text-gray-500 uppercase">{dye.brand}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* INVENTARIO (STOCK) */}
                    {activeTab === 'inventory' && (
                        <div className={`rounded-xl shadow-sm border overflow-hidden ${bgPanel}`}>
                            {/* Selector de Categoría para Inventario */}
                            <div className={`px-6 pt-4 border-b flex gap-6 overflow-x-auto ${headerClass}`}>
                                {['Todos', ...(config.productCategories || [])].map((cat, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`pb-3 text-sm font-bold whitespace-nowrap transition-all border-b-2 ${
                                            selectedCategory === cat 
                                                ? 'text-yellow-500 border-yellow-500' 
                                                : (theme === 'dark' ? 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600' : 'text-gray-500 border-transparent hover:text-zinc-800 hover:border-gray-300')
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            {/* Panel de Control de Stock */}
                            <div className={`p-6 border-b flex flex-col lg:flex-row gap-6 items-start lg:items-end justify-between ${headerClass}`}>
                                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                                    <div className="w-full sm:w-auto">
                                        <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${textSecondary}`}>Filtrar Marca</label>
                                        <select className={`p-2 border rounded-lg w-full sm:w-48 ${inputClass}`} value={stockFilterBrand} onChange={e => setStockFilterBrand(e.target.value)}>
                                            <option value="Todas">Todas</option>
                                            {config.dyeBrands?.map((brand, idx) => (
                                                <option key={idx} value={brand}>{brand}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {isSelectionMode && (
                                        <div className="flex items-end w-full sm:w-auto">
                                            <button onClick={handleSelectAllBrand} className={`w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-bold border ${theme === 'dark' ? 'border-zinc-600 hover:bg-zinc-700' : 'border-gray-300 hover:bg-gray-50'}`}>
                                                {stockFilterBrand === 'Todas' ? 'Seleccionar Visibles' : `Seleccionar Todo ${stockFilterBrand}`}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0 border-dashed border-gray-300">
                                    <button 
                                        onClick={() => {
                                            setIsSelectionMode(!isSelectionMode);
                                            if (isSelectionMode) setStockSelection([]); // Limpiar al salir
                                        }}
                                        className={`px-4 py-2 rounded-lg font-bold transition-colors w-full sm:w-auto ${isSelectionMode ? 'bg-zinc-700 text-white' : 'bg-yellow-500 text-zinc-900 shadow-md hover:bg-yellow-400'}`}
                                    >
                                        {isSelectionMode ? 'Cancelar' : 'Reponer Stock'}
                                    </button>

                                    {isSelectionMode && (
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <div>
                                                <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${textSecondary}`}>Cant.</label>
                                                <input type="number" min="1" className={`p-2 border rounded-lg w-16 text-center ${inputClass}`} value={stockAmount} onChange={e => setStockAmount(Number(e.target.value))} />
                                            </div>
                                            <button onClick={() => handleBulkUpdate(1)} className="bg-green-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-green-700 flex-1 shadow-sm text-sm">
                                                +Agregar
                                            </button>
                                            <button onClick={() => handleBulkUpdate(-1)} className="bg-red-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-red-700 flex-1 shadow-sm text-sm">
                                                -Quitar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Grilla de Stock */}
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-6">
                                {products.filter(d => (selectedCategory === 'Todos' || d.category === selectedCategory) && (stockFilterBrand === 'Todas' || d.brand === stockFilterBrand)).map(dye => (
                                    <div 
                                        key={dye._id} 
                                        onClick={() => isSelectionMode ? toggleSelectDye(dye._id) : handleDecrementStock(dye)}
                                        className={`rounded-lg border overflow-hidden relative group transition-all duration-200 cursor-pointer ${flashingDye === dye._id ? 'ring-4 ring-red-500 bg-red-100 scale-95' : ''} ${stockSelection.includes(dye._id) ? 'ring-4 ring-yellow-500' : ''} ${(dye.stock || 0) <= 0 ? 'grayscale border-red-500 border-2' : borderClass}`}
                                    >
                                        {/* Filtro Amarillo de Selección */}
                                        {stockSelection.includes(dye._id) && (
                                            <div className="absolute inset-0 bg-yellow-500/30 z-10 pointer-events-none flex items-center justify-center">
                                                <span className="text-4xl font-bold text-white drop-shadow-md">✓</span>
                                            </div>
                                        )}

                                        <div className="aspect-square bg-gray-100 relative">
                                            <img src={dye.image} alt={dye.name} className="w-full h-full object-cover" />
                                            <div className="absolute bottom-0 right-0 bg-black/70 text-white px-2 py-1 text-xs font-bold rounded-tl-lg z-20">
                                                Stock: {dye.stock || 0}
                                            </div>
                                        </div>
                                        <div className={`p-2 text-center ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}>
                                            <p className={`font-bold text-lg ${textPrimary}`}>{dye.name}</p>
                                            <p className="text-xs text-gray-500 uppercase">{dye.brand}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* GALERÍA */}
                    {activeTab === 'gallery' && (
                        <div className={`rounded-xl shadow-sm border overflow-hidden ${bgPanel}`}>
                            <div className={`p-6 border-b ${headerClass}`}>
                                <h3 className={`font-bold text-lg ${textPrimary}`}>Publicar Trabajo</h3>
                                <form onSubmit={handleCreateGalleryItem} className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        {/* Columna Izquierda: Datos */}
                                        <div className="space-y-4 flex flex-col">
                                            <div>
                                                <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${textSecondary}`}>Título</label>
                                                <input type="text" placeholder="Ej: Corte Fade + Barba" className={`w-full p-3 rounded-lg border outline-none focus:ring-2 focus:ring-yellow-500 transition-all ${inputClass}`} value={galleryForm.title} onChange={e => setGalleryForm({...galleryForm, title: e.target.value})} />
                                            </div>
                                            <div className="flex-1 flex flex-col">
                                                <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${textSecondary}`}>Descripción</label>
                                                <textarea placeholder="Descripción del trabajo..." rows="4" className={`w-full p-3 rounded-lg border outline-none focus:ring-2 focus:ring-yellow-500 transition-all resize-none flex-1 ${inputClass}`} value={galleryForm.description} onChange={e => setGalleryForm({...galleryForm, description: e.target.value})} />
                                            </div>
                                        </div>

                                        {/* Columna Derecha: Multimedia */}
                                        <div className="space-y-4">
                                            {/* Foto Principal */}
                                            <div>
                                                <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${textSecondary}`}>Foto Principal</label>
                                                <div className={`border-2 border-dashed rounded-xl relative transition-all group h-40 flex flex-col justify-center items-center overflow-hidden ${theme === 'dark' ? 'border-zinc-600 hover:border-yellow-500 hover:bg-zinc-700' : 'border-gray-300 hover:border-yellow-500 hover:bg-gray-50'}`}>
                                                <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'mainMedia')} className="absolute inset-0 opacity-0 cursor-pointer z-10" required />
                                                
                                                {galleryForm.mainMedia ? (
                                                    <>
                                                        <img src={galleryForm.mainMedia} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <span className="text-white font-bold text-sm">Cambiar</span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="text-2xl mb-2">📷</span>
                                                        <p className={`text-xs font-bold uppercase ${textSecondary}`}>Foto Principal</p>
                                                        <p className="text-[10px] text-gray-500">(Requerido)</p>
                                                    </>
                                                )}
                                            </div>
                                            </div>

                                            {/* Hover Media */}
                                            <div>
                                                <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${textSecondary}`}>Hover (Opcional)</label>
                                                <div className={`border-2 border-dashed rounded-xl relative transition-all group h-32 flex flex-col justify-center items-center overflow-hidden ${theme === 'dark' ? 'border-zinc-600 hover:border-yellow-500 hover:bg-zinc-700' : 'border-gray-300 hover:border-yellow-500 hover:bg-gray-50'}`}>
                                                <input type="file" accept="image/*,video/*" onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const isVideo = file.type.startsWith('video');
                                                        setGalleryForm(prev => ({ ...prev, mediaType: isVideo ? 'video' : 'image' }));
                                                        handleFileChange(e, 'hoverMedia');
                                                    }
                                                }} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                                
                                                {galleryForm.hoverMedia ? (
                                                    <>
                                                        {galleryForm.mediaType === 'video' ? (
                                                            <video src={galleryForm.hoverMedia} className="absolute inset-0 w-full h-full object-cover" />
                                                        ) : (
                                                            <img src={galleryForm.hoverMedia} alt="Preview Hover" className="absolute inset-0 w-full h-full object-cover" />
                                                        )}
                                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <span className="text-white font-bold text-sm">Cambiar</span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="text-2xl mb-2">✨</span>
                                                        <p className={`text-xs font-bold uppercase ${textSecondary}`}>Efecto Hover</p>
                                                        <p className="text-[10px] text-gray-500">(Opcional)</p>
                                                    </>
                                                )}
                                            </div>
                                            </div>
                                        </div>

                                        <div className="lg:col-span-2">
                                            <button type="submit" className="bg-yellow-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-yellow-700 w-full shadow-lg transition-transform active:scale-95">
                                                Publicar en Galería
                                            </button>
                                        </div>
                                </form>
                            </div>
                            
                            <div className="p-6">
                                <h3 className={`font-bold text-lg mb-4 ${textPrimary}`}>Publicaciones Activas ({galleryItems.length})</h3>
                                <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                                {galleryItems.map(item => (
                                    <div key={item._id} className="relative group rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all break-inside-avoid">
                                        <img src={item.mainMedia} alt={item.title} className="w-full h-auto object-cover" />
                                        
                                        {/* Overlay Delete (Red Blur) */}
                                        <div 
                                            onClick={() => handleDeleteGalleryItem(item._id)}
                                            className="absolute inset-0 bg-red-500/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center cursor-pointer z-20"
                                        >
                                            <div className="bg-white text-red-600 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transform scale-50 group-hover:scale-100 transition-transform duration-300">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </div>
                                        </div>

                                        {/* Badge User */}
                                        {item.user && (
                                            <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1 z-10 group-hover:opacity-0 transition-opacity">
                                                <img src={item.user.avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} className="w-4 h-4 rounded-full" />
                                                <span className="text-[10px] text-white font-bold">{item.user.username}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                </div>
                                {galleryItems.length === 0 && (
                                    <div className="text-center py-10 text-gray-500">
                                        No hay publicaciones en la galería.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* MODERACIÓN */}
                    {activeTab === 'moderation' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Columna Izquierda: Swipe Card */}
                            <div>
                                <h2 className={`text-xl font-bold mb-4 text-center ${textPrimary}`}>Pendientes de Aprobación</h2>
                                {pendingGallery.length > 0 ? (
                                    <div className="relative">
                                        {/* Mostramos solo el primero de la lista */}
                                        <SwipeCard item={pendingGallery[0]} />
                                        <p className="text-center text-gray-400 text-sm mt-4">
                                            {pendingGallery.length} publicaciones pendientes
                                        </p>
                                    </div>
                                ) : (
                                    <div className={`p-10 rounded-xl text-center shadow-sm ${bgPanel}`}>
                                        <p className="text-gray-400 text-lg">¡Todo al día! No hay publicaciones pendientes.</p>
                                        <span className="text-4xl block mt-4">🎉</span>
                                    </div>
                                )}
                            </div>

                            {/* Columna Derecha: Historial de Rechazados */}
                            <div className={`rounded-xl shadow-sm border p-6 ${bgPanel}`}>
                                <h3 className="font-bold text-lg mb-4 text-red-600">Historial de Rechazados</h3>
                                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                                    {rejectedGallery.length === 0 && <p className="text-gray-400 text-sm">No hay items rechazados.</p>}
                                    {rejectedGallery.map(item => (
                                        <div key={item._id} className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${borderClass} ${hoverClass}`}>
                                            <img src={item.mainMedia} className="w-12 h-12 rounded object-cover" />
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-bold text-sm truncate ${textPrimary}`}>{item.title || 'Sin título'}</p>
                                                <p className="text-xs text-gray-500">{item.user?.username}</p>
                                            </div>
                                            <button onClick={() => handleRestoreRejected(item._id)} className="text-blue-600 text-xs font-bold hover:underline">Restaurar</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CONFIGURACIÓN */}
                    {activeTab === 'settings' && (
                        <div className={`rounded-xl shadow-sm border p-6 ${bgPanel}`}>
                            <h3 className={`font-bold text-lg mb-4 ${textPrimary}`}>Horarios y Días</h3>
                            <form onSubmit={handleUpdateConfig} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className={`block text-sm font-bold mb-2 ${textPrimary}`}>Apertura</label>
                                        <input type="time" className={`w-full p-2 border rounded-lg ${inputClass}`} value={config.openingTime} onChange={e => setConfig({...config, openingTime: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-bold mb-2 ${textPrimary}`}>Cierre</label>
                                        <input type="time" className={`w-full p-2 border rounded-lg ${inputClass}`} value={config.closingTime} onChange={e => setConfig({...config, closingTime: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-bold mb-2 ${textPrimary}`}>Bloque (min)</label>
                                        <input type="number" className={`w-full p-2 border rounded-lg ${inputClass}`} value={config.timeBlock} onChange={e => setConfig({...config, timeBlock: Number(e.target.value)})} />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className={`block text-sm font-bold mb-2 ${textPrimary}`}>Número de WhatsApp (con código de país, sin +)</label>
                                        <input type="text" placeholder="Ej: 5491112345678" className={`w-full p-2 border rounded-lg ${inputClass}`} value={config.whatsappNumber} onChange={e => setConfig({...config, whatsappNumber: e.target.value})} />
                                    </div>
                                </div>

                                <div>
                                    <label className={`block text-sm font-bold mb-2 ${textPrimary}`}>Días Laborales</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((day, index) => (
                                            <button
                                                key={day}
                                                type="button"
                                                onClick={() => toggleDay(index)}
                                                className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${config.workingDays?.includes(index) ? 'bg-zinc-800 text-white border-zinc-800' : (theme === 'dark' ? 'bg-zinc-700 text-gray-300 border-zinc-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400')}`}
                                            >
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className={`border-t pt-6 ${theme === 'dark' ? 'border-zinc-700' : 'border-gray-100'}`}>
                                    <label className={`block text-sm font-bold mb-2 ${textPrimary}`}>Marcas de Tintes</label>
                                    <div className="flex gap-2 mb-3">
                                        <input type="text" placeholder="Nueva Marca" className={`flex-1 p-2 border rounded-lg ${inputClass}`} value={newBrand} onChange={e => setNewBrand(e.target.value)} />
                                        <button type="button" onClick={addBrand} className="bg-zinc-700 text-white px-4 py-2 rounded-lg font-bold hover:bg-zinc-600">Agregar</button>
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        {config.dyeBrands?.map((brand, idx) => (
                                            <div key={idx} className={`px-3 py-1 rounded-full border text-sm flex items-center gap-2 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-700'}`}>
                                                <span>{brand}</span>
                                                <button type="button" onClick={() => removeBrand(brand)} className="text-red-500 hover:text-red-700 font-bold">×</button>
                                            </div>
                                        ))}
                                        {(!config.dyeBrands || config.dyeBrands.length === 0) && (
                                            <p className="text-sm text-gray-500 italic">No hay marcas configuradas.</p>
                                        )}
                                    </div>
                                </div>

                                <div className={`border-t pt-6 ${theme === 'dark' ? 'border-zinc-700' : 'border-gray-100'}`}>
                                    <label className={`block text-sm font-bold mb-2 ${textPrimary}`}>Tipos de Productos</label>
                                    <div className="flex gap-2 mb-3">
                                        <input type="text" placeholder="Nuevo Tipo (Ej: Shampoos)" className={`flex-1 p-2 border rounded-lg ${inputClass}`} value={newCategory} onChange={e => setNewCategory(e.target.value)} />
                                        <button type="button" onClick={addCategory} className="bg-zinc-700 text-white px-4 py-2 rounded-lg font-bold hover:bg-zinc-600">Agregar</button>
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        {config.productCategories?.map((cat, idx) => (
                                            <div key={idx} className={`px-3 py-1 rounded-full border text-sm flex items-center gap-2 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-700'}`}>
                                                <span>{cat}</span>
                                                <button type="button" onClick={() => removeCategory(cat)} className="text-red-500 hover:text-red-700 font-bold">×</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button type="submit" className="bg-yellow-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-yellow-700">Guardar Cambios</button>
                            </form>
                        </div>
                    )}

                </div>
                )}

                {/* ACTION LOADER OVERLAY */}
                {actionLoading && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                        <div className={`flex flex-col items-center justify-center p-6 rounded-xl shadow-2xl ${theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}`}>
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500 mb-4"></div>
                            <p className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-zinc-800'}`}>Procesando...</p>
                            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Por favor espera un momento</p>
                        </div>
                    </div>
                )}

                {/* ALERTA PERSONALIZADA (Fuera del condicional) */}
                <CustomAlert 
                    isOpen={alertConfig.isOpen}
                    onClose={closeAlert}
                    {...alertConfig}
                />
            </main>
        </div>
    );
};

const AdminPanel = () => (
    <UserProvider>
        <AdminPanelContent />
    </UserProvider>
);

export default AdminPanel;
