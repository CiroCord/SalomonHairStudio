import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { UserProvider, useUser } from './users/UserContext';
import BookingCalendar from './BookingCalendar';
import CustomAlert from './ui/CustomAlert';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');

// Función auxiliar para calcular edad (movida fuera para reutilizar)
const calculateAge = (dob) => {
    if (!dob) return null;
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null; // Validar que sea una fecha real
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : 0;
};

const AppointmentCard = ({ appointment, isProfessional, onCancel, onReschedule, theme, onViewProfile }) => {
    const [expanded, setExpanded] = useState(false);
    const otherParty = isProfessional ? appointment.client : appointment.professional;
    const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

    // Formatear fecha para mostrar
    const dateObj = new Date(appointment.date);
    const dateStr = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    // Calcular si se puede cancelar/modificar (más de 48hs)
    const now = new Date();
    const [hours, minutes] = appointment.startTime.split(':').map(Number);
    const appDateFull = new Date(appointment.date);
    appDateFull.setHours(hours, minutes, 0, 0);
    
    const diffTime = appDateFull - now;
    const diffHours = diffTime / (1000 * 60 * 60);
    const canModify = diffHours > 48 && appointment.status !== 'cancelled';

    // Estilos dinámicos según tema
    const cardClass = theme === 'dark' ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-white border-gray-100 hover:shadow-md';
    const textPrimary = theme === 'dark' ? 'text-white' : 'text-zinc-800';
    const textSecondary = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
    const labelClass = theme === 'dark' ? 'text-gray-300' : 'text-zinc-700';
    const borderClass = theme === 'dark' ? 'border-white/10' : 'border-gray-100';

    // Determinar nombre del servicio (Soporte para múltiples)
    const serviceName = appointment.services && appointment.services.length > 0 
        ? appointment.services.map(s => s.name).join(' + ') 
        : (appointment.service?.name || 'Servicio no disponible');

    // Calcular precio total
    const totalPrice = appointment.services && appointment.services.length > 0
        ? appointment.services.reduce((acc, s) => acc + s.price, 0)
        : appointment.service?.price;

    // Calcular duración total
    const totalDuration = appointment.services && appointment.services.length > 0
        ? appointment.services.reduce((acc, s) => acc + s.duration, 0)
        : appointment.service?.duration;

    return (
        <div className={`rounded-xl shadow-sm border p-4 transition-all mb-3 ${cardClass} ${appointment.status === 'cancelled' ? 'opacity-60 grayscale' : ''}`}>
            <div className="flex items-center gap-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <img 
                    src={otherParty?.avatar || defaultAvatar} 
                    className={`w-12 h-12 rounded-full object-cover border-2 border-yellow-500 ${isProfessional ? 'hover:scale-110 transition-transform z-10' : ''}`} 
                    alt="Avatar"
                    onClick={(e) => {
                        if (isProfessional && onViewProfile) {
                            e.stopPropagation(); // Evitar expandir la tarjeta
                            onViewProfile(otherParty);
                        }
                    }}
                />
                <div className="flex-1 min-w-0">
                    <h4 className={`font-bold truncate ${textPrimary}`}>{otherParty?.username || otherParty?.name || 'Usuario'}</h4>
                    <p className="text-sm text-yellow-600 font-medium truncate">{serviceName}</p>
                    {!isProfessional && <p className="text-xs text-gray-400 capitalize md:hidden">{dateStr}</p>}
                    {appointment.status === 'cancelled' && <span className="text-xs font-bold text-red-500 uppercase">Cancelado</span>}
                </div>
                <div className="text-right">
                    <p className={`text-lg font-bold ${textPrimary}`}>{appointment.startTime}</p>
                    <span className="text-gray-400 text-xs transition-transform duration-300 inline-block" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </div>
            </div>
            
            {expanded && (
                <div className={`mt-4 pt-4 border-t ${borderClass} text-sm ${textSecondary} animate-fade-in`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4">
                        <p><span className={`font-bold ${labelClass}`}>Fecha:</span> {dateStr}</p>
                        <p><span className={`font-bold ${labelClass}`}>Duración:</span> {totalDuration || '-'} min</p>
                        <p><span className={`font-bold ${labelClass}`}>Precio:</span> ${totalPrice ? totalPrice.toLocaleString('es-AR') : '-'}</p>
                    </div>

                    {/* Lista detallada de servicios (Si hay múltiples) */}
                    {appointment.services && appointment.services.length > 0 && (
                        <div className={`mt-3 pt-3 border-t border-dashed ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                            <p className={`font-bold mb-1 text-xs uppercase tracking-wider ${labelClass}`}>Servicios Incluidos:</p>
                            <ul className="space-y-1">
                                {appointment.services.map((srv, idx) => (
                                    <li key={idx} className={`text-xs flex items-center gap-2 ${textSecondary}`}>
                                        <span className="text-yellow-500">•</span> 
                                        <span>{srv.name}</span>
                                        {srv.category && <span className="opacity-50 italic">({srv.category.name})</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Botones de Acción (Solo Cliente y si no está cancelado) */}
                    {!isProfessional && canModify && (
                        <div className={`flex gap-3 mt-4 pt-2 border-t ${borderClass}`}>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onReschedule(appointment); }}
                                className={`flex-1 py-2 rounded-lg font-bold transition-colors text-xs ${theme === 'dark' ? 'bg-blue-900/30 text-blue-300 hover:bg-blue-900/50' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                            >
                                Reprogramar
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onCancel(appointment._id); }}
                                className={`flex-1 py-2 rounded-lg font-bold transition-colors text-xs ${theme === 'dark' ? 'bg-red-900/30 text-red-300 hover:bg-red-900/50' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                            >
                                Cancelar
                            </button>
                        </div>
                    )}
                    {!isProfessional && !canModify && appointment.status !== 'cancelled' && (
                        <p className="text-xs text-gray-400 mt-3 italic text-center">
                            No se puede modificar con menos de 48hs de antelación.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

const MyAppointmentsContent = () => {
    const { user, loading: userLoading, theme } = useUser();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    });
    
    // Estado para gestión de disponibilidad (Profesional)
    const [dayConfig, setDayConfig] = useState({ type: 'normal', startTime: '09:00', endTime: '20:00' });
    const [configLoading, setConfigLoading] = useState(false);
    const [monthAvailability, setMonthAvailability] = useState(null);
    const [proGoogleEvents, setProGoogleEvents] = useState([]); // Eventos personales del profesional
    const [proEventsMonth, setProEventsMonth] = useState({}); // Mapa para puntitos

    // Estado para Reprogramación (Cliente)
    const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
    const [apptToReschedule, setApptToReschedule] = useState(null);
    const [rescheduleDate, setRescheduleDate] = useState(null);
    const [rescheduleSlots, setRescheduleSlots] = useState([]);
    const [rescheduleLoading, setRescheduleLoading] = useState(false);
    const [rescheduleMonthAvailability, setRescheduleMonthAvailability] = useState(null); // Disponibilidad mensual para reprogramar
    const [actionLoading, setActionLoading] = useState(false); // Loader global para acciones (cancelar/reprogramar)

    // Estado para Modal de Perfil de Cliente
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [viewingClient, setViewingClient] = useState(null);
    const [clientNotes, setClientNotes] = useState('');
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [notesExpanded, setNotesExpanded] = useState(false);
    const editorRef = useRef(null);
    const expandedEditorRef = useRef(null);
    const selectionRange = useRef(null);
    
    // Estado para Productos en Notas
    const [allProducts, setAllProducts] = useState([]);
    const [showProductSelector, setShowProductSelector] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [hoveredTag, setHoveredTag] = useState(null); // { product, x, y }

    // Estado para Alertas Personalizadas
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null, showCancel: false });

    const showAlert = (title, message, type = 'info', onConfirm = null, showCancel = false) => {
        setAlertConfig({ isOpen: true, title, message, type, onConfirm, showCancel });
    };
    const closeAlert = () => {
        setAlertConfig({ ...alertConfig, isOpen: false });
    };

    // Sincronizar contenido del editor cuando termina la carga para evitar que aparezca vacío
    useEffect(() => {
        if (profileModalOpen && !loadingNotes && editorRef.current) {
            editorRef.current.innerHTML = clientNotes;
        }
    }, [loadingNotes, profileModalOpen, clientNotes]);

    // Sincronizar contenido del editor expandido al abrirse
    useEffect(() => {
        if (notesExpanded && expandedEditorRef.current && editorRef.current) {
            expandedEditorRef.current.innerHTML = editorRef.current.innerHTML;
        }
    }, [notesExpanded]);

    useEffect(() => {
        if (!userLoading && user) {
            fetchAppointments();
        } else if (!userLoading && !user) {
            window.location.href = '/login';
        }

        // Verificar si volvemos de la vinculación de Google
        const params = new URLSearchParams(window.location.search);
        if (params.get('status') === 'linked') {
            showAlert("¡Conectado!", "Tu Google Calendar se ha vinculado correctamente.", "success");
            window.history.replaceState({}, document.title, window.location.pathname); // Limpiar URL
        } else if (params.get('status') === 'error') {
            showAlert("Error", "No se pudo vincular Google Calendar.", "error");
        }
    }, [user, userLoading]);

    const handleUnlinkGoogle = async () => {
        showAlert("Desvincular", "¿Quieres dejar de sincronizar con Google Calendar?", "warning", async () => {
            try {
                await axios.post(`${BACKEND_URL}/api/auth/google/unlink`, { userId: user.id || user._id });
                showAlert("Desvinculado", "Cuenta desconectada correctamente.", "success", () => {
                    window.location.reload(); // Recargar para actualizar estado del usuario
                });
            } catch (error) {
                showAlert("Error", "No se pudo desvincular.", "error");
            }
        }, true);
    };

    // Cargar configuración del día cuando cambia la fecha (solo profesionales)
    useEffect(() => {
        if (user && (user.role === 'professional' || user.role === 'admin')) {
            fetchDayConfig(selectedDate);
            fetchProGoogleEvents(selectedDate);
        }
    }, [selectedDate, user]);

    const fetchAppointments = async () => {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/appointments/my-appointments`, {
                params: { userId: user.id || user._id }
            });
            setAppointments(res.data);
        } catch (error) {
            console.error("Error cargando turnos:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- ACCIONES CLIENTE ---
    const handleCancelAppointment = async (id) => {
        showAlert("Cancelar Turno", "¿Estás seguro de que quieres cancelar este turno?", "warning", async () => {
            setActionLoading(true);
            try {
                await axios.put(`${BACKEND_URL}/api/appointments/${id}/cancel`);
                await fetchAppointments();
                showAlert("Cancelado", "El turno ha sido cancelado correctamente.", "success");
            } catch (error) {
                showAlert("Error", error.response?.data?.message || 'Error al cancelar', "error");
            } finally {
                setActionLoading(false);
            }
        }, true);
    };

    const openRescheduleModal = (appointment) => {
        setApptToReschedule(appointment);
        setRescheduleModalOpen(true);
        setRescheduleDate(null);
        setRescheduleSlots([]);
    };

    const handleRescheduleDateSelect = async (date) => {
        setRescheduleDate(date);
        setRescheduleLoading(true);
        setRescheduleSlots([]);

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        try {
            const res = await axios.get(`${BACKEND_URL}/api/appointments/availability`, {
                params: {
                    professionalId: apptToReschedule.professional._id,
                    // Enviamos array de IDs si existen, sino el ID simple
                    serviceIds: apptToReschedule.services && apptToReschedule.services.length > 0 
                        ? apptToReschedule.services.map(s => s._id).join(',') 
                        : apptToReschedule.service._id,
                    date: dateString
                }
            });
            setRescheduleSlots(res.data.availableSlots);
        } catch (err) {
            console.error("Error obteniendo horarios:", err);
        } finally {
            setRescheduleLoading(false);
        }
    };

    const confirmReschedule = async (slot) => {
        showAlert("Confirmar Reprogramación", `¿Reprogramar para el ${rescheduleDate.toLocaleDateString()} a las ${slot.startTime}?`, "info", async () => {
            setActionLoading(true);
            try {
                await axios.put(`${BACKEND_URL}/api/appointments/${apptToReschedule._id}/reschedule`, {
                    date: rescheduleDate,
                    startTime: slot.startTime
                });
                await fetchAppointments();
                setRescheduleModalOpen(false);
                showAlert("Éxito", "Turno reprogramado con éxito.", "success");
            } catch (error) {
                showAlert("Error", error.response?.data?.message || 'Error al reprogramar', "error");
            } finally {
                setActionLoading(false);
            }
        }, true);
    };

    // Cargar disponibilidad mensual para el calendario de reprogramación
    const handleRescheduleMonthChange = useCallback(async (year, month) => {
        if (!apptToReschedule) return;
        setRescheduleMonthAvailability(null); // Loading
        try {
            const res = await axios.get(`${BACKEND_URL}/api/appointments/availability-month`, {
                params: {
                    professionalId: apptToReschedule.professional._id,
                    serviceIds: apptToReschedule.services && apptToReschedule.services.length > 0 
                        ? apptToReschedule.services.map(s => s._id).join(',') 
                        : apptToReschedule.service._id,
                    year, month
                }
            });
            setRescheduleMonthAvailability(res.data);
        } catch (err) {
            console.error(err);
            setRescheduleMonthAvailability({}); // Stop loading on error
        }
    }, [apptToReschedule]);

    // --- LÓGICA DE PROFESIONAL ---
    const isProfessional = user?.role === 'professional' || user?.role === 'admin';

    const handleViewProfile = async (client) => {
        setViewingClient(client);
        setProfileModalOpen(true);
        setNotesExpanded(false);
        
        // Cargar notas del cliente
        setClientNotes('');
        setLoadingNotes(true);
        try {
            const [userRes, productsRes] = await Promise.all([
                axios.get(`${BACKEND_URL}/api/users/${client._id}`),
                axios.get(`${BACKEND_URL}/api/admin/dyes`) // Cargar catálogo para el selector
            ]);
            
            let notes = userRes.data.notes || '';
            const tags = userRes.data.taggedProducts || [];
            
            // Detectar si es texto plano (legacy) y convertir saltos de línea a <br>
            // Esto es necesario porque quitamos whiteSpace: 'pre-wrap' para arreglar el flujo de los chips
            if (notes && !notes.includes('<div') && !notes.includes('<br') && !notes.includes('<span') && !notes.includes('<p')) {
                notes = notes.replace(/\n/g, '<br>');
            }

            // Migración: Si hay tags guardados pero no están en el texto (formato viejo), los agregamos al final
            if (tags.length > 0 && !notes.includes('data-product-id')) {
                notes += '&nbsp;'; // Espacio
                tags.forEach(p => {
                    notes += `&nbsp;<span data-product-id="${p._id}" contenteditable="false" style="display: inline-flex; align-items: center; vertical-align: middle; background-color: #fef9c3; border: 1px solid #fde047; border-radius: 9999px; padding: 2px 6px; margin: 0 2px; font-size: 0.75rem; font-weight: 700; color: #27272a; user-select: none; cursor: default; white-space: nowrap;"><img src="${p.image}" style="width: 16px; height: 16px; border-radius: 50%; object-fit: cover; margin-right: 4px; display: block;" /><span style="line-height: 1;">${p.name}</span></span>&nbsp;`;
                });
            }

            setClientNotes(notes);
            setAllProducts(productsRes.data);
        } catch (error) {
            console.error("Error cargando notas:", error);
        } finally {
            setLoadingNotes(false);
        }
    };

    const handleSaveNotes = async (contentOverride = null) => {
        if (!viewingClient) return;
        try {
            const htmlContent = contentOverride || (editorRef.current ? editorRef.current.innerHTML : '');
            
            // Extraer IDs de los productos etiquetados en el HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            const tags = doc.querySelectorAll('[data-product-id]');
            const taggedProductIds = Array.from(tags).map(t => t.getAttribute('data-product-id'));

            // Enviamos notas y el array de IDs de productos
            await axios.put(`${BACKEND_URL}/api/users/${viewingClient._id}`, { 
                notes: htmlContent,
                taggedProducts: taggedProductIds
            });
            showAlert("Notas Guardadas", "La información del cliente ha sido actualizada.", "success");
        } catch (error) {
            showAlert("Error", "No se pudieron guardar las notas.", "error");
        }
    };

    const handleExpand = () => {
        if (window.innerWidth < 768) {
            // El contenido se sincroniza en el useEffect cuando notesExpanded cambia a true
            setNotesExpanded(true);
        }
    };

    const handleEditorBlur = () => {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            selectionRange.current = sel.getRangeAt(0);
        }
    };

    const addProductTag = (product) => {
        // Determinar qué editor está activo (normal o expandido)
        const activeEditor = notesExpanded ? expandedEditorRef.current : editorRef.current;

        if (activeEditor) {
            activeEditor.focus();
            
            const sel = window.getSelection();
            sel.removeAllRanges();
            
            if (selectionRange.current) {
                sel.addRange(selectionRange.current);
            } else {
                const range = document.createRange();
                range.selectNodeContents(activeEditor);
                range.collapse(false);
                sel.addRange(range);
            }

            // Crear elemento DOM para el Chip (Más robusto que insertHTML)
            const span = document.createElement('span');
            span.setAttribute('data-product-id', product._id);
            span.contentEditable = "false";
            
            // Estilos en línea para asegurar comportamiento
            Object.assign(span.style, {
                display: 'inline-flex',
                alignItems: 'center',
                verticalAlign: 'middle',
                backgroundColor: '#fef9c3',
                border: '1px solid #fde047',
                borderRadius: '9999px',
                padding: '2px 6px',
                margin: '0 2px',
                fontSize: '0.75rem',
                fontWeight: '700',
                color: '#27272a',
                userSelect: 'none',
                cursor: 'default',
                whiteSpace: 'nowrap'
            });

            const img = document.createElement('img');
            img.src = product.image;
            Object.assign(img.style, {
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                objectFit: 'cover',
                marginRight: '4px',
                display: 'block'
            });

            const textSpan = document.createElement('span');
            textSpan.textContent = product.name;
            textSpan.style.lineHeight = '1';

            span.appendChild(img);
            span.appendChild(textSpan);

            // Insertar espacios alrededor para facilitar escritura
            const spaceBefore = document.createTextNode('\u00A0');
            const spaceAfter = document.createTextNode('\u00A0');

            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(spaceAfter);
            range.insertNode(span);
            range.insertNode(spaceBefore);

            // Mover cursor al final
            range.setStartAfter(spaceAfter);
            range.setEndAfter(spaceAfter);
            sel.removeAllRanges();
            sel.addRange(range);
            
            // Actualizar referencia de selección
            selectionRange.current = range.cloneRange();
        }
        setShowProductSelector(false);
    };

    const handleEditorMouseOver = (e) => {
        const target = e.target.closest('[data-product-id]');
        if (target) {
            const id = target.getAttribute('data-product-id');
            const product = allProducts.find(p => p._id === id);
            if (product) {
                const rect = target.getBoundingClientRect();
                setHoveredTag({
                    product,
                    x: rect.left + window.scrollX,
                    y: rect.top + window.scrollY
                });
            }
        } else {
            setHoveredTag(null);
        }
    };

    const fetchDayConfig = async (date) => {
        setConfigLoading(true);
        try {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const res = await axios.get(`${BACKEND_URL}/api/appointments/exception`, {
                params: { userId: user.id || user._id, date: dateStr }
            });
            
            if (res.data) {
                setDayConfig({ 
                    type: res.data.type, 
                    startTime: res.data.startTime || '09:00', 
                    endTime: res.data.endTime || '20:00' 
                });
            } else {
                setDayConfig({ type: 'normal', startTime: '09:00', endTime: '20:00' });
            }
        } catch (error) {
            console.error("Error cargando config del día:", error);
        } finally {
            setConfigLoading(false);
        }
    };

    const fetchProGoogleEvents = async (date) => {
        if (!user.isGoogleCalendarLinked) return;
        try {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const res = await axios.get(`${BACKEND_URL}/api/appointments/google-events`, {
                params: { userId: user.id || user._id, date: dateStr }
            });
            setProGoogleEvents(res.data);
        } catch (error) {
            console.error("Error cargando eventos de Google:", error);
        }
    };

    const handleSaveConfig = async () => {
        setActionLoading(true);
        try {
            const year = selectedDate.getFullYear();
            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const day = String(selectedDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            await axios.post(`${BACKEND_URL}/api/appointments/exception`, {
                userId: user.id || user._id,
                date: dateStr,
                type: dayConfig.type,
                startTime: dayConfig.startTime,
                endTime: dayConfig.endTime 
            });
            
            await fetchAppointments();
            await handleMonthChange(selectedDate.getFullYear(), selectedDate.getMonth());
            showAlert("Guardado", "Disponibilidad actualizada correctamente.", "success");
        } catch (error) {
            showAlert("Error", 'Error al guardar: ' + error.message, "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleMonthChange = useCallback(async (year, month) => {
        if (!user || (!isProfessional)) return;
        setMonthAvailability(null); // Resetear a loading
        try {
            const res = await axios.get(`${BACKEND_URL}/api/appointments/schedule`, {
                params: { userId: user.id || user._id, year, month }
            });
            setMonthAvailability(res.data);
            
            // Cargar eventos de Google (Integrado aquí para evitar desincronización)
            if (user.isGoogleCalendarLinked) {
                axios.get(`${BACKEND_URL}/api/appointments/google-events`, {
                    params: { userId: user.id || user._id, year, month }
                }).then(res => {
                    const map = {};
                    res.data.forEach(e => {
                        if (e.startDate) {
                            let startStr = e.startDate.length === 10 ? e.startDate + 'T12:00:00' : e.startDate;
                            let endStr = e.endDate && e.endDate.length === 10 ? e.endDate + 'T12:00:00' : e.endDate;

                            let current = new Date(startStr);
                            const end = endStr ? new Date(endStr) : new Date(current);
                            
                            while (current < end) {
                                const dateKey = current.toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
                                map[dateKey] = true;
                                current.setDate(current.getDate() + 1);
                            }
                            
                            if (!e.endDate || new Date(startStr).getTime() === new Date(endStr).getTime()) {
                                const dateKey = new Date(startStr).toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
                                map[dateKey] = true;
                            }
                        }
                    });
                    setProEventsMonth(map);
                }).catch(console.error);
            }
        } catch (error) {
            console.error("Error cargando agenda:", error);
        }
    }, [user, isProfessional]);

    const getDailyAppointments = (date) => {
        return appointments.filter(app => {
            const appDateObj = new Date(app.date);
            const appYear = appDateObj.getFullYear();
            const appMonth = String(appDateObj.getMonth() + 1).padStart(2, '0');
            const appDay = String(appDateObj.getDate()).padStart(2, '0');
            const appDateStr = `${appYear}-${appMonth}-${appDay}`;
            
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const selectedDateStr = `${year}-${month}-${day}`;

            return appDateStr === selectedDateStr;
        });
    };

    const renderDayContent = (day, date) => {
        const dailyApps = getDailyAppointments(date);
        
        // Verificar si hay evento de Google (Puntito azul)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const dayStr = String(date.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${dayStr}`;
        const hasGoogleEvent = proEventsMonth[dateKey];

        // Si no hay turnos NI eventos de Google, no renderizamos nada
        if (dailyApps.length === 0 && !hasGoogleEvent) return null;

        const counts = {};
        if (dailyApps.length > 0) {
            dailyApps.forEach(app => {
                // Contar servicios individuales dentro de los turnos
                if (app.services && app.services.length > 0) {
                    app.services.forEach(s => {
                        const name = s.category?.name || s.name || 'Varios';
                        counts[name] = (counts[name] || 0) + 1;
                    });
                } else {
                    const name = app.service?.category?.name || app.service?.name || 'Varios';
                    counts[name] = (counts[name] || 0) + 1;
                }
            });
        }

        // Estilo de etiqueta según tema (Para que se lea bien en modo oscuro)
        const tagClass = theme === 'dark' ? 'bg-yellow-200 text-zinc-900' : 'bg-yellow-100/50 text-zinc-600';

        return (
            <div className="flex flex-col gap-0.5 overflow-y-auto max-h-[50px]">
                {hasGoogleEvent && (
                    <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-sm" title="Evento personal"></div>
                )}
                {Object.entries(counts).slice(0, 3).map(([name, count], idx) => (
                    <div key={idx} className={`text-[9px] leading-tight px-1 rounded truncate font-medium ${tagClass}`}>
                        <span className="font-bold">{count}</span> {name}
                    </div>
                ))}
                {Object.keys(counts).length > 3 && <div className="text-[9px] text-gray-400">...</div>}
            </div>
        );
    };

    if (loading || userLoading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-600"></div></div>;

    return (
        <div className={`max-w-6xl mx-auto p-4 md:p-8 ${isProfessional ? 'lg:h-[calc(100vh-66px)] lg:flex lg:flex-col lg:overflow-hidden pb-24 md:pb-8 lg:pb-8' : 'pb-24 md:pb-8'}`}>
            <div className="flex justify-between items-center mb-6 border-b border-yellow-500 pb-2">
                <h1 className={`text-3xl font-serif font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-800'}`}>
                    {isProfessional ? 'Mi Agenda' : 'Mis Turnos'}
                </h1>
                
                {/* Botón Vincular Google Calendar */}
                {user && !user.isGoogleCalendarLinked && (
                    <a 
                        href={`${BACKEND_URL}/api/auth/google?userId=${user.id || user._id}`}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors border ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-200 text-zinc-700 hover:bg-gray-50'}`}
                    >
                        <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" className="w-4 h-4" alt="GCal" />
                        <span className="hidden md:inline">Vincular Calendar</span>
                        <span className="md:hidden">Vincular</span>
                    </a>
                )}

                {/* Indicador de Vinculado (Opcional) */}
                {user && user.isGoogleCalendarLinked && (
                    <button 
                        onClick={handleUnlinkGoogle}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border transition-colors group ${theme === 'dark' ? 'bg-green-900/20 border-green-500/30 text-green-400 hover:bg-red-900/20 hover:text-red-400 hover:border-red-500/30' : 'bg-green-50 border-green-200 text-green-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200'}`}
                        title="Clic para desvincular"
                    >
                        <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" className="w-4 h-4" alt="GCal" />
                        <span className="hidden md:inline group-hover:hidden">Sincronizado</span>
                        <span className="hidden group-hover:inline">Desvincular</span>
                    </button>
                )}
            </div>

            {isProfessional ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:flex-1 lg:min-h-0">
                    {/* Columna Izquierda: Calendario */}
                    <div className="lg:col-span-2 lg:h-full lg:flex lg:flex-col lg:min-h-0">
                        <div className={`rounded-2xl shadow-sm border overflow-hidden lg:max-h-full lg:overflow-y-auto ${theme === 'dark' ? 'bg-zinc-900/50 border-white/5' : 'bg-white border-gray-100'}`}>
                            <BookingCalendar 
                                onDateSelect={setSelectedDate} 
                                onMonthChange={handleMonthChange}
                                availability={monthAvailability}
                                renderDayContent={renderDayContent}
                                enableAllDates={true} 
                                theme={theme}
                            />
                        </div>
                    </div>

                    {/* Columna Derecha: Detalle del Día */}
                    <div className="lg:h-full lg:min-h-0">
                        <div className={`rounded-2xl p-6 border lg:h-full flex flex-col ${theme === 'dark' ? 'bg-zinc-900/50 border-white/5' : 'bg-zinc-50 border-gray-200'}`}>
                            <div className="flex-shrink-0">
                                <h3 className={`text-xl font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-800'}`}>
                                    📅 {selectedDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                                </h3>

                                {/* Panel de Gestión de Disponibilidad */}
                                <div className={`mb-6 p-4 rounded-xl border shadow-sm ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-white border-gray-200'}`}>
                                    <h4 className="font-bold text-sm text-gray-500 uppercase mb-3">Gestionar Disponibilidad</h4>
                                    {configLoading ? <p className="text-xs text-gray-400">Cargando...</p> : (
                                        <div className="space-y-3">
                                            <div className="flex gap-2 text-sm">
                                                <button 
                                                    onClick={() => setDayConfig({...dayConfig, type: 'normal'})}
                                                    className={`flex-1 py-2 rounded-lg border ${dayConfig.type === 'normal' ? (theme === 'dark' ? 'bg-zinc-700 text-white border-zinc-600' : 'bg-zinc-800 text-white border-zinc-800') : (theme === 'dark' ? 'bg-transparent text-gray-400 border-zinc-700' : 'bg-white text-gray-600 border-gray-200')}`}
                                                >Normal</button>
                                                <button 
                                                    onClick={() => setDayConfig({...dayConfig, type: 'off'})}
                                                    className={`flex-1 py-2 rounded-lg border ${dayConfig.type === 'off' ? 'bg-red-500 text-white border-red-500' : (theme === 'dark' ? 'bg-transparent text-gray-400 border-zinc-700' : 'bg-white text-gray-600 border-gray-200')}`}
                                                >Franco</button>
                                                <button 
                                                    onClick={() => setDayConfig({...dayConfig, type: 'custom'})}
                                                    className={`flex-1 py-2 rounded-lg border ${dayConfig.type === 'custom' ? 'bg-blue-500 text-white border-blue-500' : (theme === 'dark' ? 'bg-transparent text-gray-400 border-zinc-700' : 'bg-white text-gray-600 border-gray-200')}`}
                                                >Personalizado</button>
                                            </div>

                                            {dayConfig.type === 'custom' && (
                                                <div className="flex gap-2 items-center animate-fade-in">
                                                    <input type="time" value={dayConfig.startTime} onChange={e => setDayConfig({...dayConfig, startTime: e.target.value})} className={`border p-1 rounded w-full text-sm ${theme === 'dark' ? 'bg-black/20 border-zinc-700 text-white' : ''}`} />
                                                    <span className="text-gray-400">-</span>
                                                    <input type="time" value={dayConfig.endTime} onChange={e => setDayConfig({...dayConfig, endTime: e.target.value})} className={`border p-1 rounded w-full text-sm ${theme === 'dark' ? 'bg-black/20 border-zinc-700 text-white' : ''}`} />
                                                </div>
                                            )}

                                            <button onClick={handleSaveConfig} className="w-full bg-yellow-500 text-zinc-900 font-bold py-2 rounded-lg text-sm hover:bg-yellow-400 transition-colors">
                                                Guardar Cambios
                                            </button>
                                            <p className="text-[10px] text-gray-400 text-center mt-2">Los cambios pueden tardar unos segundos en reflejarse en el calendario.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="space-y-1 lg:overflow-y-auto lg:flex-1 pr-2">
                                {/* EVENTOS DE GOOGLE DEL PROFESIONAL */}
                                {proGoogleEvents.length > 0 && (
                                    <div className="mb-4 space-y-2">
                                        <p className="text-xs font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1">
                                            <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" className="w-3 h-3" alt="GCal" />
                                            Tus Eventos Personales
                                        </p>
                                        {proGoogleEvents.map((evt, idx) => (
                                            <div key={idx} className={`p-3 rounded-lg border text-sm ${theme === 'dark' ? 'bg-blue-900/10 border-blue-500/20 text-gray-300' : 'bg-blue-50 border-blue-100 text-gray-700'}`}>
                                                <span className="font-bold text-blue-500 block">{evt.isAllDay ? 'Todo el día' : `${evt.start} - ${evt.end}`}</span>
                                                {evt.summary}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {getDailyAppointments(selectedDate).length > 0 ? (
                                    getDailyAppointments(selectedDate).map(app => (
                                        <AppointmentCard 
                                            key={app._id} 
                                            appointment={app} 
                                            isProfessional={true} 
                                            theme={theme} 
                                            onViewProfile={handleViewProfile}
                                        />
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-gray-400">
                                        <p>No hay turnos para este día.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                // VISTA CLIENTE (Lista Simple)
                <div className="max-w-2xl mx-auto">
                    {appointments.length > 0 ? (
                        appointments.map(app => (
                            <AppointmentCard 
                                key={app._id} 
                                appointment={app} 
                                isProfessional={false} 
                                onCancel={handleCancelAppointment}
                                onReschedule={openRescheduleModal}
                                theme={theme}
                            />
                        ))
                    ) : (
                        <div className={`text-center py-12 rounded-xl shadow-sm border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-white border-gray-100'}`}>
                            <p className="text-gray-500 text-lg mb-4">Aún no tienes turnos reservados.</p>
                            <a href="/turnos" className="inline-block bg-yellow-600 text-white px-6 py-2 rounded-full font-bold hover:bg-yellow-700 transition-colors">
                                Reservar Ahora
                            </a>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL DE REPROGRAMACIÓN */}
            {rescheduleModalOpen && (
                <div className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 ${theme === 'dark' ? 'bg-black/80' : 'bg-black/60'}`}>
                    <div className={`rounded-xl shadow-2xl max-w-2xl w-full p-6 animate-fade-in max-h-[90vh] overflow-y-auto border ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-100'}`}>
                        <div className={`flex justify-between items-center mb-4 border-b pb-2 ${theme === 'dark' ? 'border-white/10' : 'border-gray-100'}`}>
                            <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-800'}`}>Reprogramar Turno</h3>
                            <button onClick={() => setRescheduleModalOpen(false)} className="text-gray-400 hover:text-black">✕</button>
                        </div>
                        
                        <div className="mb-4">
                            <p className="text-sm text-gray-600">Selecciona una nueva fecha para: <strong>
                                {apptToReschedule?.services && apptToReschedule.services.length > 0 
                                    ? apptToReschedule.services.map(s => s.name).join(' + ') 
                                    : apptToReschedule?.service?.name}
                            </strong></p>
                        </div>

                        <BookingCalendar 
                            onDateSelect={handleRescheduleDateSelect} 
                            onMonthChange={handleRescheduleMonthChange}
                            availability={rescheduleMonthAvailability}
                            theme={theme} 
                        />

                        {rescheduleDate && (
                            <div className="mt-6">
                                <h4 className={`font-bold mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Horarios disponibles para el {rescheduleDate.toLocaleDateString()}</h4>
                                {rescheduleLoading ? (
                                    <p className="text-blue-600 text-sm">Buscando horarios...</p>
                                ) : rescheduleSlots.length > 0 ? (
                                    <div className="grid grid-cols-3 gap-2">
                                        {rescheduleSlots.map((slot, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => confirmReschedule(slot)}
                                                className={`py-2 px-3 border rounded transition-all text-sm ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-gray-300 hover:bg-zinc-700' : 'bg-white border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white'}`}
                                            >
                                                {slot.startTime}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm">No hay horarios disponibles.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL DE PERFIL DE CLIENTE */}
            {profileModalOpen && viewingClient && (
                <div className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 ${theme === 'dark' ? 'bg-black/80' : 'bg-black/60'}`}>
                     <div className={`rounded-xl shadow-2xl max-w-sm w-full p-6 animate-fade-in relative overflow-hidden border ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-100'}`}>
                        <button onClick={() => setProfileModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">✕</button>
                        
                        <div className="flex flex-col items-center mb-6">
                            <img 
                                src={viewingClient.avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} 
                                className="w-24 h-24 rounded-full object-cover border-4 border-yellow-500 shadow-lg mb-4" 
                                alt="Avatar"
                            />
                            <h3 className={`text-xl font-bold text-center break-words w-full ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{viewingClient.username || viewingClient.name}</h3>
                            <p className="text-yellow-600 text-sm font-medium">Cliente</p>
                        </div>

                        <div className="space-y-4">
                            <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                                <p className={`text-xs uppercase font-bold mb-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Contacto</p>
                                <p className={`text-sm mb-1 break-all ${theme === 'dark' ? 'text-gray-300' : 'text-zinc-700'}`}>📧 {viewingClient.email}</p>
                                <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-zinc-700'}`}>📱 {viewingClient.telefono || 'No registrado'}</p>
                            </div>

                            <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                                <p className={`text-xs uppercase font-bold mb-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Información Personal</p>
                                <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-zinc-700'}`}>
                                    🎂 Edad: {calculateAge(viewingClient.fechaNacimiento) !== null ? `${calculateAge(viewingClient.fechaNacimiento)} años` : 'No registrada'}
                                </p>
                            </div>

                            {/* Sección de Notas del Profesional */}
                            <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                                <p className={`text-xs uppercase font-bold mb-2 flex items-center gap-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                                    📝 Notas del Profesional <span className="text-[10px] font-normal opacity-70">(Compartido)</span>
                                </p>
                                {loadingNotes ? (
                                    <p className="text-xs text-gray-500 animate-pulse">Cargando notas...</p>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {/* EDITOR CONTENTEDITABLE */}
                                        <div 
                                            ref={editorRef}
                                            contentEditable
                                            onBlur={handleEditorBlur}
                                            onClick={handleExpand}
                                            onMouseOver={handleEditorMouseOver}
                                            onMouseOut={() => setHoveredTag(null)}
                                            className={`w-full p-3 text-sm rounded border min-h-[120px] max-h-[300px] overflow-y-auto outline-none focus:ring-1 focus:ring-yellow-500 transition-colors leading-relaxed ${theme === 'dark' ? 'bg-black/20 border-zinc-700 text-gray-300' : 'bg-white border-gray-200 text-zinc-700'}`}
                                        ></div>

                                        <div className="flex justify-between items-center mt-1">
                                            <button 
                                                onClick={() => setShowProductSelector(!showProductSelector)}
                                                className={`text-xs px-3 py-1.5 rounded transition-colors font-bold flex items-center gap-1 ${theme === 'dark' ? 'bg-zinc-700 text-white hover:bg-zinc-600' : 'bg-zinc-200 text-zinc-800 hover:bg-zinc-300'}`}
                                            >
                                                <span>+</span> Producto
                                            </button>
                                            <button onClick={() => handleSaveNotes(null)} className="bg-yellow-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-yellow-700 transition-colors shadow-sm">Guardar Nota</button>
                                        </div>

                                        {/* SELECTOR DE PRODUCTOS (INLINE) */}
                                        {showProductSelector && (
                                            <div className={`mt-1 p-2 rounded-lg border shadow-sm animate-fade-in max-h-40 overflow-y-auto ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-200'}`}>
                                                <input 
                                                    type="text" 
                                                    placeholder="Buscar producto..." 
                                                    className={`w-full p-2 text-xs border rounded mb-2 ${theme === 'dark' ? 'bg-black/20 border-zinc-600 text-white' : 'bg-gray-50 border-gray-200'}`}
                                                    value={productSearch}
                                                    onChange={(e) => setProductSearch(e.target.value)}
                                                    autoFocus
                                                />
                                                <div className="space-y-1">
                                                    {allProducts.filter(p => {
                                                        const term = (productSearch || '').toLowerCase();
                                                        const name = p.name ? String(p.name).toLowerCase() : '';
                                                        const brand = p.brand ? String(p.brand).toLowerCase() : '';
                                                        return name.includes(term) || brand.includes(term);
                                                    }).map(prod => (
                                                        <div 
                                                            key={prod._id} 
                                                            onClick={() => addProductTag(prod)}
                                                            className={`flex items-center gap-2 p-1 rounded cursor-pointer hover:bg-yellow-500/20 ${theme === 'dark' ? 'text-gray-300' : 'text-zinc-700'}`}
                                                        >
                                                            <img src={prod.image} className="w-6 h-6 rounded object-cover" alt="" />
                                                            <span className="text-xs truncate">{prod.name} ({prod.brand})</span>
                                                        </div>
                                                    ))}
                                                    {allProducts.length === 0 && <p className="text-center text-gray-500 text-xs">No hay productos.</p>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                     </div>
                </div>
            )}

            {/* HOVER CARD FLOTANTE (Portal o Fixed) */}
            {hoveredTag && (
                <div 
                    className="fixed z-[100] w-48 p-2 rounded-lg shadow-xl bg-zinc-900 text-white border border-yellow-500/30 pointer-events-none animate-fade-in"
                    style={{ 
                        left: hoveredTag.x, 
                        top: hoveredTag.y - 10, 
                        transform: 'translateY(-100%)' 
                    }}
                >
                    <img src={hoveredTag.product.image} className="w-full h-32 object-cover rounded mb-2" alt="" />
                    <p className="font-bold text-sm text-yellow-500">{hoveredTag.product.name}</p>
                    <p className="text-xs text-gray-400">{hoveredTag.product.brand}</p>
                    <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">{hoveredTag.product.category}</p>
                </div>
            )}

            {/* MODAL DE NOTAS EXPANDIDAS (ZOOM) */}
            {notesExpanded && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className={`w-full max-w-sm h-[70vh] flex flex-col rounded-xl shadow-[0_0_25px_rgba(234,179,8,0.5)] border-2 border-yellow-500 overflow-hidden transform transition-all scale-100 ${theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}`}>
                        <div className="p-4 border-b border-yellow-500/30 flex justify-between items-center bg-yellow-500/10">
                            <h3 className={`font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-800'}`}>
                                📝 Editor de Notas
                            </h3>
                            <button onClick={() => setNotesExpanded(false)} className="text-gray-500 hover:text-red-500 transition-colors px-2">✕</button>
                        </div>

                        <div 
                            ref={expandedEditorRef}
                            contentEditable
                            onBlur={handleEditorBlur}
                            className={`flex-1 w-full p-4 text-base outline-none overflow-y-auto leading-relaxed ${theme === 'dark' ? 'bg-zinc-900 text-gray-200' : 'bg-white text-zinc-800'}`}
                            autoFocus
                        ></div>

                        <div className="p-3 border-t border-yellow-500/30 flex justify-end gap-2 bg-yellow-500/5">
                            <button 
                                onClick={() => setShowProductSelector(!showProductSelector)}
                                className="mr-auto text-xs bg-zinc-700 text-white px-3 py-2 rounded hover:bg-zinc-600 transition-colors"
                            >
                                + Producto
                            </button>
                            <button onClick={() => setNotesExpanded(false)} className={`px-4 py-2 rounded-lg text-sm font-bold ${theme === 'dark' ? 'text-gray-400 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'}`}>Minimizar</button>
                            <button onClick={() => { 
                                const content = expandedEditorRef.current ? expandedEditorRef.current.innerHTML : '';
                                if (editorRef.current) editorRef.current.innerHTML = content; // Sincronizar editor principal
                                handleSaveNotes(content); 
                                setNotesExpanded(false); 
                            }} className="bg-yellow-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-yellow-700 shadow-lg shadow-yellow-600/20">Guardar</button>
                        </div>

                        {/* SELECTOR DE PRODUCTOS (EXPANDED) */}
                        {showProductSelector && (
                            <div className={`p-2 border-t ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200'}`}>
                                <input 
                                    type="text" 
                                    placeholder="Buscar producto..." 
                                    className={`w-full p-2 text-sm border rounded mb-2 ${theme === 'dark' ? 'bg-black/20 border-zinc-600 text-white' : 'bg-gray-50 border-gray-200'}`}
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    autoFocus
                                />
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {allProducts.filter(p => {
                                        const term = (productSearch || '').toLowerCase();
                                        const name = p.name ? String(p.name).toLowerCase() : '';
                                        const brand = p.brand ? String(p.brand).toLowerCase() : '';
                                        return name.includes(term) || brand.includes(term);
                                    }).map(prod => (
                                        <div 
                                            key={prod._id} 
                                            onClick={() => addProductTag(prod)}
                                            className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-yellow-500/20 flex-shrink-0 border ${theme === 'dark' ? 'text-gray-300 border-zinc-700' : 'text-zinc-700 border-gray-200'}`}
                                        >
                                            <img src={prod.image} className="w-8 h-8 rounded object-cover" alt="" />
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold truncate max-w-[100px]">{prod.name}</span>
                                                <span className="text-[10px] text-gray-500 truncate">{prod.brand}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
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

            {/* ALERTA PERSONALIZADA */}
            <CustomAlert 
                isOpen={alertConfig.isOpen}
                onClose={closeAlert}
                {...alertConfig}
            />
        </div>
    );
};

const MyAppointments = () => (
    <UserProvider>
        <MyAppointmentsContent />
    </UserProvider>
);

export default MyAppointments;
