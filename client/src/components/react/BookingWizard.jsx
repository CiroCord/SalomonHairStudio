import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, BrowserRouter } from 'react-router-dom';
import BookingCalendar from './BookingCalendar';
import { useUser, UserProvider } from './users/UserContext';
import CustomAlert from './ui/CustomAlert';

// URL del backend (ajustar si usas variables de entorno)
const BACKEND_URL = (import.meta.env.PUBLIC_BACKEND_URL || 'https://salomonhairstudio.onrender.com').replace(/\/$/, '');

// Componente interno con la lógica
export const BookingWizardContent = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [services, setServices] = useState([]);
  const [businessConfig, setBusinessConfig] = useState({});
  const [professionals, setProfessionals] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [monthAvailability, setMonthAvailability] = useState(null); // Estado para disponibilidad mensual (null = loading)
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // Estado para el loader de confirmación
  
  // Estados de la selección
  const [selectedServices, setSelectedServices] = useState([]); // Array para multi-selección
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [expandedServiceId, setExpandedServiceId] = useState(null); // Para ver descripción
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingSlot, setPendingSlot] = useState(null);
  const [lastAppointment, setLastAppointment] = useState(null);
  const [userGoogleEvents, setUserGoogleEvents] = useState([]); // Eventos del cliente
  const [clientEventsMonth, setClientEventsMonth] = useState({}); // Mapa de eventos del mes para puntitos

  // Estado para Alertas Personalizadas
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null, showCancel: false });

  const showAlert = (title, message, type = 'info', onConfirm = null, showCancel = false) => {
      setAlertConfig({ isOpen: true, title, message, type, onConfirm, showCancel });
  };
  const closeAlert = () => {
      setAlertConfig({ ...alertConfig, isOpen: false });
  };

  // Auth y Usuario
  const { user, theme, loading: userLoading } = useUser();

  // Cargar servicios al montar el componente
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/appointments/services`);
        setServices(res.data);
        
        // Cargar config pública (WhatsApp)
        const configRes = await axios.get(`${BACKEND_URL}/api/appointments/config`);
        setBusinessConfig(configRes.data);
      } catch (err) {
        console.error("Error cargando servicios:", err);
      }
    };
    fetchServices();
  }, []);

  // Cargar último turno para "Lo de siempre"
  useEffect(() => {
    if (user) {
        const fetchHistory = async () => {
            try {
                const res = await axios.get(`${BACKEND_URL}/api/appointments/my-appointments`, {
                    params: { userId: user.id || user._id }
                });
                // Filtrar no cancelados y ordenar por fecha descendente
                const history = res.data
                    .filter(app => app.status !== 'cancelled')
                    .sort((a, b) => new Date(b.date) - new Date(a.date));
                
                if (history.length > 0) {
                    setLastAppointment(history[0]);
                }
            } catch (error) {
                console.error("Error cargando historial:", error);
            }
        };
        fetchHistory();
    }
  }, [user]);

  const handleSelectUsual = () => {
      if (!lastAppointment) return;
      
      let serviceIds = [];
      if (lastAppointment.services && lastAppointment.services.length > 0) {
          serviceIds = lastAppointment.services.map(s => s._id);
      } else if (lastAppointment.service) {
          serviceIds = [lastAppointment.service._id];
      }

      const servicesToSelect = services.filter(s => serviceIds.includes(s._id));
      
      if (servicesToSelect.length > 0) {
          setSelectedServices(servicesToSelect);
          showAlert("¡Listo!", "Se han seleccionado tus servicios habituales.", "success");
      } else {
          showAlert("Aviso", "Los servicios de tu última visita ya no están disponibles.", "warning");
      }
  };

  const toggleService = (service) => {
    // Si es a consultar, redirigir a WhatsApp
    if (service.priceType === 'consultation') {
        const phone = businessConfig.whatsappNumber;
        if (phone) {
            const text = encodeURIComponent(`Hola, quisiera consultar por el servicio: ${service.name}`);
            window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${text}`, '_blank');
        } else {
            showAlert("Consultar Precio", "Por favor contáctanos para consultar el precio de este servicio.", "info");
        }
        return;
    }

    setSelectedServices(prev => {
        const exists = prev.find(s => s._id === service._id);
        if (exists) {
            return prev.filter(s => s._id !== service._id);
        }
        return [...prev, service];
    });
  };

  const handleContinueToProfessionals = async () => {
    try {
        const res = await axios.get(`${BACKEND_URL}/api/appointments/professionals`);
        setProfessionals(res.data);
        setStep(2);
    } catch (err) {
        console.error("Error cargando profesionales:", err);
    }
  };

  const handleProfessionalSelect = (prof) => {
    setSelectedProfessional(prof);
    setStep(3);
    setAvailableSlots([]); // Limpiar slots anteriores
  };

  // Función para cargar disponibilidad del mes (para pintar días agotados)
  const handleMonthChange = useCallback(async (year, month) => {
    if (!selectedProfessional || selectedServices.length === 0) return;
    
    // 1. Cargar eventos de Google del CLIENTE para pintar puntitos
    if (user && user.isGoogleCalendarLinked) {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/appointments/google-events`, {
                params: { userId: user.id || user._id, year, month }
            });
            // Convertir array a mapa { "YYYY-MM-DD": true }
            const eventsMap = {};
            res.data.forEach(evt => {
                // Asumimos que evt.start viene como "HH:mm" o fecha ISO si modificamos el backend
                // Pero getUserGoogleEvents devuelve objetos simplificados.
                // Necesitamos la fecha original para mapear.
                // El backend devuelve start/end formateados. Mejor usar la lógica de fecha del evento original si es posible,
                // pero para simplificar, asumiremos que el backend devuelve eventos dentro del rango.
                // NOTA: Para mapear correctamente al día, necesitamos la fecha.
                // Como getUserGoogleEvents simplificado no devuelve la fecha completa en 'start', 
                // vamos a confiar en que el backend filtra bien, pero para pintar el puntito necesitamos saber QUÉ día es.
                // *Corrección*: El backend devuelve 'start' como hora. Necesitamos la fecha completa en la respuesta del backend para esto.
                // *Solución rápida*: El backend devuelve eventos ordenados.
                // Vamos a modificar getUserGoogleEvents para devolver la fecha completa en un campo extra o usar startDateTime.
                // Por ahora, asumiremos que si hay eventos, hay puntitos.
                // *Mejor*: Modificaré el backend para devolver 'date' en la respuesta simplificada.
                // (Ver cambio en appointmentController.js abajo si hiciera falta, pero usaremos startDateTime del objeto original si lo pasamos).
                // Como el backend actual devuelve { summary, start: 'HH:mm', ... }, necesitamos la fecha.
                // *Ajuste en frontend*: Vamos a asumir que el backend devuelve la fecha en 'start' si es ISO, o agregamos un campo 'date'.
                // *Hack*: Usaremos el endpoint tal cual está, pero necesitamos la fecha.
                // *Mejor*: Voy a asumir que el backend devuelve la fecha ISO en un campo 'rawDate' o similar.
                // (Ver nota: He actualizado el backend para devolver start/end formateados, pero para el calendario necesitamos la fecha).
                // *Corrección*: Voy a modificar el backend para devolver 'startDate' (ISO).
            });
            // REVISIÓN: El backend devuelve start/end formateados.
            // Vamos a hacer que el backend devuelva también la fecha ISO para poder mapear.
            // (Ver cambio en appointmentController.js: agregaré 'startDate' al objeto).
        } catch (err) { console.error(err); }
    }

    // Cargar eventos del cliente (versión corregida con fetch real)
    if (user && user.isGoogleCalendarLinked) {
        axios.get(`${BACKEND_URL}/api/appointments/google-events`, {
            params: { userId: user.id || user._id, year, month }
        }).then(res => {
            const map = {};
            res.data.forEach(e => {
                if (e.startDate) {
                    // FIX: Forzar mediodía para evitar desfases de zona horaria (UTC vs Local)
                    let startStr = e.startDate.length === 10 ? e.startDate + 'T12:00:00' : e.startDate;
                    let endStr = e.endDate && e.endDate.length === 10 ? e.endDate + 'T12:00:00' : e.endDate;

                    let current = new Date(startStr);
                    const end = endStr ? new Date(endStr) : new Date(current);
                    
                    while (current < end) {
                        const dateKey = current.toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
                        map[dateKey] = true;
                        current.setDate(current.getDate() + 1);
                    }
                    // Asegurar que se marque el día si es puntual
                    if (!e.endDate || new Date(startStr).getTime() === new Date(endStr).getTime()) {
                         const dateKey = new Date(startStr).toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
                         map[dateKey] = true;
                    }
                }
            });
            setClientEventsMonth(map);
        }).catch(console.error);
    }
    
    setMonthAvailability(null); // Resetear a loading para evitar bugs visuales
    try {
        const res = await axios.get(`${BACKEND_URL}/api/appointments/availability-month`, {
            params: {
                professionalId: selectedProfessional._id,
                serviceIds: selectedServices.map(s => s._id).join(','),
                year, month
            }
        });
        setMonthAvailability(res.data);
    } catch (err) { console.error(err); }
  }, [selectedProfessional, selectedServices]);

  // Renderizado personalizado de celda para BookingCalendar
  const renderDayContent = (day, date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dayStr = String(date.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${dayStr}`;

      if (clientEventsMonth[dateKey]) {
          return <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-sm" title="Tienes eventos este día"></div>;
      }
      return null;
  };

  const handleDateSelect = async (date) => {
    setSelectedDate(date);
    setLoadingSlots(true);
    setAvailableSlots([]);
    setUserGoogleEvents([]);
    
    // Formatear a YYYY-MM-DD manualmente para evitar desfases de zona horaria
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    try {
        // Consultar disponibilidad al backend
        const res = await axios.get(`${BACKEND_URL}/api/appointments/availability`, {
            params: {
                professionalId: selectedProfessional._id,
                serviceIds: selectedServices.map(s => s._id).join(','),
                date: dateString
            }
        });
        setAvailableSlots(res.data.availableSlots);

        // Si el usuario está logueado y vinculado, buscar sus eventos
        if (user && user.isGoogleCalendarLinked) {
            const eventsRes = await axios.get(`${BACKEND_URL}/api/appointments/google-events`, {
                params: { userId: user.id || user._id, date: dateString }
            });
            setUserGoogleEvents(eventsRes.data);
        }

    } catch (err) {
        console.error("Error obteniendo horarios:", err);
    } finally {
        setLoadingSlots(false);
    }
  };

  const handleSlotSelect = async (slot) => {
      // Si todavía está cargando el usuario, esperamos
      if (userLoading) return;

      // Verificar si el usuario está logueado
      if (!user) {
          // Usar navigate para ir al login sin recargar y volver después
          showAlert("Iniciar Sesión", "Necesitas iniciar sesión para reservar un turno.", "info", () => {
              navigate('/login', { state: { from: '/turnos' } });
          });
          return;
      }

      // Verificar datos obligatorios (Teléfono y Fecha de Nacimiento)
      if (!user.telefono || !user.fechaNacimiento) {
          showAlert("Datos Incompletos", "Para confirmar la reserva, necesitamos que completes tu Teléfono y Fecha de Nacimiento en tu perfil.", "warning", () => navigate('/profile'));
          return;
      }

      setPendingSlot(slot);
      setShowConfirmation(true);
  };

  const handleConfirmBooking = async () => {
      const userId = user.id || user._id;
      if (!userId) {
          showAlert("Error", "No se pudo identificar al usuario.", "error");
          return;
      }

      // Verificar si ALGÚN servicio requiere WhatsApp
      const requiresWhatsApp = selectedServices.some(s => s.requiresWhatsApp);

      // Si el servicio requiere WhatsApp, no guardamos en DB, redirigimos con mensaje pre-armado
      if (requiresWhatsApp) {
          const phone = businessConfig.whatsappNumber;
          if (!phone) {
              showAlert("Error de Configuración", "El negocio no ha configurado un número de WhatsApp para recibir reservas.", "error");
              return;
          }

          const dateStr = selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
          const servicesNames = selectedServices.map(s => s.name).join(', ');
          
          const message = `Hola! 👋 Quisiera reservar un turno:\n\n` +
                          `✂️ *Servicios:* ${servicesNames}\n` +
                          `💇‍♂️ *Profesional:* ${selectedProfessional._id === 'any' ? 'A designar' : selectedProfessional.name}\n` +
                          `� *Fecha:* ${dateStr}\n` +
                          `⏰ *Hora:* ${pendingSlot.startTime}\n\n` +
                          `👤 *Cliente:* ${user.username}\n` +
                          `📧 *Email:* ${user.email}`;

          window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`, '_blank');
          setShowConfirmation(false);
          return;
      }

      setIsProcessing(true); // Activar loader

      try {
          // Usamos pendingSlot en lugar de slot pasado por argumento
          const slot = pendingSlot;
              await axios.post(`${BACKEND_URL}/api/appointments`, {
                  date: selectedDate,
                  startTime: slot.startTime,
                  client: userId,
                  professional: selectedProfessional._id, // Puede ser 'any'
                  services: selectedServices.map(s => s._id) // Enviamos array de IDs
              });
              
              setShowConfirmation(false);
              setIsProcessing(false);
              showAlert("¡Reserva Exitosa!", "Tu turno ha sido reservado con éxito. Te esperamos.", "success", () => window.location.reload());
      } catch (error) {
          setIsProcessing(false);
          setShowConfirmation(false);
          showAlert("Error", "Error al reservar: " + (error.response?.data?.message || error.message), "error");
      }
  };

  // Cálculos de totales
  const totalDuration = selectedServices.reduce((acc, s) => acc + Number(s.duration), 0);
  const totalMinPrice = selectedServices.reduce((acc, s) => acc + Number(s.price), 0);
  const totalMaxPrice = selectedServices.reduce((acc, s) => {
      const max = (s.priceType === 'range' && s.priceMax) ? Number(s.priceMax) : Number(s.price);
      return acc + max;
  }, 0);

  // Agrupar servicios por categoría
  const groupedServices = services.reduce((acc, service) => {
      const catName = service.category?.name || 'General';
      if (!acc[catName]) acc[catName] = [];
      acc[catName].push(service);
      return acc;
  }, {});

  // Clases dinámicas según el tema
  const containerClass = theme === 'dark' ? 'bg-zinc-900/95 backdrop-blur-md border border-white/10' : 'bg-white border border-gray-200';
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-zinc-900';
  const textSecondary = theme === 'dark' ? 'text-gray-400' : 'text-gray-500';
  const cardClass = theme === 'dark' ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-gray-50';

  return (
    <>
    <div className={`max-w-4xl mx-auto p-6 rounded-xl shadow-2xl min-h-[500px] transition-colors duration-300 relative overflow-hidden ${containerClass}`}>
        {/* Barra de Progreso */}
        <div className={`flex justify-between mb-5 border-b pb-3 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
            <div className={`font-serif font-bold text-sm md:text-base transition-colors ${step >= 1 ? 'text-yellow-500' : (theme === 'dark' ? 'text-zinc-600' : 'text-gray-300')}`}>1. Servicio</div>
            <div className={`font-serif font-bold text-sm md:text-base transition-colors ${step >= 2 ? 'text-yellow-500' : (theme === 'dark' ? 'text-zinc-600' : 'text-gray-300')}`}>2. Profesional</div>
            <div className={`font-serif font-bold text-sm md:text-base transition-colors ${step >= 3 ? 'text-yellow-500' : (theme === 'dark' ? 'text-zinc-600' : 'text-gray-300')}`}>3. Fecha</div>
        </div>

        {/* PASO 1: SERVICIOS */}
        {step === 1 && (
            <div className="space-y-8 animate-fade-in">
                {/* SECCIÓN LO DE SIEMPRE */}
                {lastAppointment && (
                    <div className="mb-2">
                        <div 
                            onClick={handleSelectUsual}
                            className={`border rounded-xl p-4 cursor-pointer transition-all relative overflow-hidden group flex items-center gap-4 shadow-sm hover:shadow-md ${theme === 'dark' ? 'bg-gradient-to-r from-yellow-900/10 to-transparent border-yellow-500/30 hover:border-yellow-500' : 'bg-gradient-to-r from-yellow-50 to-white border-yellow-200 hover:border-yellow-400'}`}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm ${theme === 'dark' ? 'bg-yellow-600 text-white' : 'bg-yellow-400 text-white'}`}>
                                ↺
                            </div>
                            <div className="flex-1">
                                <h4 className={`font-bold text-base ${textPrimary}`}>Lo de siempre</h4>
                                <p className={`text-xs ${textSecondary} line-clamp-1`}>
                                    Repetir: {lastAppointment.services && lastAppointment.services.length > 0 
                                        ? lastAppointment.services.map(s => s.name).join(' + ') 
                                        : lastAppointment.service?.name}
                                </p>
                            </div>
                            <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${theme === 'dark' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-yellow-100 text-yellow-700'}`}>
                                Seleccionar
                            </span>
                        </div>
                    </div>
                )}

                {services.length === 0 && <p className="text-gray-500 col-span-2 text-center">Cargando servicios...</p>}
                
                {Object.entries(groupedServices).map(([category, categoryServices]) => (
                    <div key={category}>
                        <h3 className={`text-xl font-serif font-bold mb-4 border-l-4 border-yellow-500 pl-3 uppercase tracking-wider ${textPrimary}`}>{category}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {categoryServices.map(srv => (
                                <div 
                                    key={srv._id} 
                                    onClick={() => toggleService(srv)}
                                    className={`border rounded-xl transition-all group overflow-hidden relative cursor-pointer ${
                                        selectedServices.find(s => s._id === srv._id) 
                                            ? 'border-yellow-500 ring-1 ring-yellow-500 bg-yellow-500/10' 
                                            : cardClass
                                    }`}
                                >
                                    <div 
                                        className="p-5"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className={`font-bold text-lg group-hover:text-yellow-500 transition-colors ${theme === 'dark' ? 'text-gray-200' : 'text-zinc-800'}`}>{srv.name}</h3>
                                            {srv.requiresDeposit && (
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide border ${theme === 'dark' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/20' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}`}>
                                                    Requiere Seña
                                                </span>
                                            )}
                                        </div>
                                        
                                        <div className={`flex justify-between items-center text-sm ${textSecondary}`}>
                                            <div className={`font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-zinc-600'}`}>
                                                {srv.priceType === 'consultation' ? (
                                                    <span className="text-blue-400 font-bold flex items-center gap-1">
                                                        Consultar <span className="text-xs">↗</span>
                                                    </span>
                                                ) : srv.priceType === 'range' ? (
                                                    <span>${srv.price.toLocaleString('es-AR')} - ${srv.priceMax.toLocaleString('es-AR')}</span>
                                                ) : (
                                                    <span>{srv.price === 0 ? 'A consultar' : `$${srv.price.toLocaleString('es-AR')}`}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span>⏱ {srv.duration} min</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Botón Ver Más (Descripción) */}
                                    {srv.description && (
                                        <div className="px-5 pb-3">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setExpandedServiceId(expandedServiceId === srv._id ? null : srv._id); }}
                                                className={`text-xs font-medium focus:outline-none transition-colors ${theme === 'dark' ? 'text-gray-500 hover:text-yellow-500' : 'text-gray-400 hover:text-yellow-600'}`}
                                            >
                                                {expandedServiceId === srv._id ? 'Ocultar info' : 'Ver más info'}
                                            </button>
                                            {expandedServiceId === srv._id && (
                                                <p className={`text-xs mt-2 animate-fade-in p-2 rounded border ${theme === 'dark' ? 'text-gray-400 bg-black/20 border-white/5' : 'text-gray-500 bg-gray-50 border-gray-100'}`}>
                                                    {srv.description}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {/* Espaciador para que el footer no tape contenido */}
                {selectedServices.length > 0 && <div className="h-20"></div>}
            </div>
        )}

        {/* PASO 2: PROFESIONALES */}
        {step === 2 && (
            <div className="animate-fade-in">
                <button onClick={() => setStep(1)} className={`mb-6 text-sm hover:text-yellow-500 flex items-center gap-1 transition-colors ${textSecondary}`}>← Volver a servicios</button>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                    {/* Opción CUALQUIER PROFESIONAL */}
                    <button 
                        onClick={() => handleProfessionalSelect({ _id: 'any', name: 'Cualquier Profesional' })}
                        className={`p-4 md:p-6 border rounded-xl hover:border-yellow-500/50 transition-all text-center flex flex-col items-center gap-3 group hover:shadow-lg hover:shadow-yellow-500/5 ${cardClass}`}
                    >
                        <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl md:text-3xl group-hover:bg-yellow-500 group-hover:text-zinc-900 transition-colors ${theme === 'dark' ? 'bg-zinc-800 text-gray-400' : 'bg-zinc-100 text-zinc-600'}`}>🎲</div>
                        <h3 className={`font-bold text-base md:text-lg ${theme === 'dark' ? 'text-gray-200 group-hover:text-white' : 'text-zinc-800 group-hover:text-yellow-500'}`}>Cualquier Profesional</h3>
                    </button>

                    {professionals.map(prof => (
                        <button 
                            key={prof._id} 
                            onClick={() => handleProfessionalSelect(prof)}
                            className={`p-4 md:p-6 border rounded-xl hover:border-yellow-500/50 transition-all text-center flex flex-col items-center gap-3 group hover:shadow-lg hover:shadow-yellow-500/5 ${cardClass}`}
                        >
                            <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl md:text-3xl group-hover:bg-yellow-500 group-hover:text-zinc-900 transition-colors ${theme === 'dark' ? 'bg-zinc-800 text-gray-400' : 'bg-zinc-100 text-zinc-600'}`}>💇‍♂️</div>
                            <h3 className={`font-bold text-base md:text-lg  ${theme === 'dark' ? 'text-gray-200 group-hover:text-white' : 'text-zinc-800 group-hover:text-yellow-500'}`}>{prof.name}</h3>
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* PASO 3: CALENDARIO */}
        {step === 3 && (
            <div className="animate-fade-in">
                <button onClick={() => setStep(2)} className={`mb-6 text-sm hover:text-yellow-500 flex items-center gap-1 transition-colors ${textSecondary}`}>← Volver a profesionales</button>
                
                <div className="flex flex-col gap-8">
                    {/* Calendario */}
                    <div>
                        <h3 className={`font-bold mb-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Selecciona un día</h3>
                        <BookingCalendar 
                            onDateSelect={handleDateSelect} 
                            onMonthChange={handleMonthChange}
                            availability={monthAvailability}
                            renderDayContent={renderDayContent}
                            theme={theme}
                        />
                    </div>

                    {/* Horarios (Ahora abajo) */}
                    <div className={`p-6 rounded-xl w-full border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                        <h3 className={`font-bold mb-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                            {selectedDate ? `Horarios para el ${selectedDate.toLocaleDateString()}` : 'Selecciona una fecha para ver horarios'}
                        </h3>
                        
                        {loadingSlots && <div className="text-yellow-500 font-medium animate-pulse">Buscando huecos disponibles...</div>}
                        
                        {!loadingSlots && selectedDate && availableSlots.length === 0 && (
                            <div className={`p-4 rounded-lg text-center border ${theme === 'dark' ? 'bg-red-900/20 text-red-300 border-red-900/30' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                No hay horarios disponibles para este día.
                            </div>
                        )}

                        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                            {availableSlots.map((slot, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSlotSelect(slot)}
                                    className={`py-2 px-2 md:px-4 border rounded-lg hover:border-yellow-500 hover:text-yellow-500 transition-all font-medium shadow-sm text-xs md:text-sm ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-gray-300 hover:bg-zinc-700' : 'bg-white border-gray-200 text-zinc-700 hover:bg-yellow-50'}`}
                                >
                                    {slot.startTime} - {slot.endTime}
                                </button>
                            ))}
                        </div>

                        {/* VISUALIZACIÓN DE EVENTOS DE GOOGLE DEL CLIENTE */}
                        {userGoogleEvents.length > 0 && (
                            <div className={`mt-6 pt-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                                <h4 className={`text-xs font-bold uppercase mb-2 flex items-center gap-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" className="w-3 h-3" alt="GCal" />
                                    Tu Agenda (Google Calendar)
                                </h4>
                                <div className="space-y-1">
                                    {userGoogleEvents.map((evt, idx) => (
                                        <div key={idx} className={`text-xs px-2 py-1 rounded border ${theme === 'dark' ? 'bg-blue-900/20 border-blue-500/30 text-gray-300' : 'bg-blue-50 border-blue-100 text-gray-600'}`}>
                                            <span className="font-bold">{evt.isAllDay ? 'Todo el día' : `${evt.start} - ${evt.end}`}</span>: {evt.summary}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* MODAL DE CONFIRMACIÓN */}
        {showConfirmation && pendingSlot && (
            <div className={`absolute inset-0 z-[49] flex items-center justify-center backdrop-blur-md p-4 ${theme === 'dark' ? 'bg-black/80' : 'bg-white/80'}`}>
                <div className={`border rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-100'}`}>
                    <h3 className={`text-xl font-bold mb-4 border-b pb-2 ${theme === 'dark' ? 'text-white border-white/10' : 'text-zinc-900 border-gray-100'}`}>Confirmar Reserva</h3>
                    
                    <div className="space-y-4 mb-6">
                        <div className="flex justify-between items-center">
                            <span className={`text-sm ${textSecondary}`}>Servicios</span>
                            <div className="text-right">
                                {selectedServices.map(s => (
                                    <div key={s._id} className={`font-bold text-sm ${textPrimary}`}>{s.name}</div>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className={`text-sm ${textSecondary}`}>Profesional</span>
                            <span className={`font-bold text-right ${textPrimary}`}>{selectedProfessional.name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className={`text-sm ${textSecondary}`}>Fecha y Hora</span>
                            <span className={`font-bold text-right ${textPrimary}`}>
                                {selectedDate.toLocaleDateString()} - {pendingSlot.startTime}
                            </span>
                        </div>
                        <div className={`flex justify-between items-center p-2 rounded border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                            <span className={`text-sm ${textSecondary}`}>Total Estimado</span>
                            <span className="font-bold text-yellow-500 text-lg">
                                ${totalMinPrice.toLocaleString('es-AR')}
                                {totalMinPrice !== totalMaxPrice && ` - $${totalMaxPrice.toLocaleString('es-AR')}`}
                            </span>
                        </div>
                        
                        {selectedServices.some(s => s.requiresDeposit) && (
                            <div className={`border rounded-lg p-3 mt-2 ${theme === 'dark' ? 'bg-yellow-900/20 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'}`}>
                                <p className="text-yellow-500 text-sm font-bold flex items-center gap-2">
                                    ⚠️ Requiere Seña
                                </p>
                                <p className={`text-xs mt-1 leading-relaxed ${theme === 'dark' ? 'text-yellow-200/80' : 'text-yellow-700'}`}>
                                    Para confirmar este turno es necesario abonar una seña. Nos pondremos en contacto contigo o sigue las instrucciones en el local.
                                </p>
                            </div>
                        )}
                        
                        {selectedServices.some(s => s.requiresWhatsApp) && (
                            <div className={`border rounded-lg p-3 mt-2 ${theme === 'dark' ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-200'}`}>
                                <p className="text-green-500 text-sm font-bold flex items-center gap-2">
                                    📱 Reserva vía WhatsApp
                                </p>
                                <p className={`text-xs mt-1 leading-relaxed ${theme === 'dark' ? 'text-green-200/80' : 'text-green-700'}`}>
                                    Este servicio se coordina manualmente. Al confirmar, se abrirá WhatsApp con los datos del turno listos para enviar.
                                </p>
                            </div>
                        )}
                    </div>

                    {isProcessing ? (
                        <div className="flex flex-col items-center justify-center py-4 animate-fade-in">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-yellow-500 mb-3"></div>
                            <p className={`font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-zinc-800'}`}>Confirmando reserva...</p>
                            <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Por favor espera un momento</p>
                        </div>
                    ) : (
                        <div className="flex gap-3">
                        <button onClick={() => setShowConfirmation(false)} className={`flex-1 py-3 font-bold rounded-lg transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'}`}>
                            Cancelar
                        </button>
                        <button onClick={handleConfirmBooking} className={`flex-1 py-3 text-zinc-900 font-bold rounded-lg transition-colors shadow-lg ${selectedServices.some(s => s.requiresWhatsApp) ? 'bg-green-500 hover:bg-green-400' : 'bg-yellow-500 hover:bg-yellow-400'}`}>
                            {selectedServices.some(s => s.requiresWhatsApp) ? 'Ir a WhatsApp' : 'Confirmar'}
                        </button>
                        </div>
                    )}
                    </div>
                </div>
        )}
    </div>

    {/* Footer Resumen de Selección (Fuera del contenedor para evitar conflictos con backdrop-filter) */}
    {step === 1 && selectedServices.length > 0 && (
        <div className={`fixed bottom-0 left-0 right-0 p-4 border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-[60] flex justify-between items-center ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-200'}`}>
            <div className="max-w-4xl mx-auto w-full flex justify-between items-center">
                <div>
                    <p className={`text-xs font-bold uppercase ${textSecondary}`}>{selectedServices.length} Servicios seleccionados</p>
                    <p className={`text-lg font-bold ${textPrimary}`}>
                        Total: ${totalMinPrice.toLocaleString('es-AR')}
                        {totalMinPrice !== totalMaxPrice && ` - $${totalMaxPrice.toLocaleString('es-AR')}`}
                        <span className="text-sm font-normal text-gray-500 ml-2">({totalDuration} min)</span>
                    </p>
                </div>
                <button onClick={handleContinueToProfessionals} className="bg-yellow-500 text-zinc-900 px-6 py-3 rounded-lg font-bold hover:bg-yellow-400 transition-colors shadow-md">
                    Continuar →
                </button>
            </div>
        </div>
    )}

    {/* ALERTA PERSONALIZADA */}
    <CustomAlert 
        isOpen={alertConfig.isOpen}
        onClose={closeAlert}
        {...alertConfig}
    />
    </>
  );
};

// Wrapper por defecto: Incluye Router y Provider para funcionar de forma aislada (ej: turnos.astro)
const BookingWizard = () => (
    <BrowserRouter>
        <UserProvider>
            <BookingWizardContent />
        </UserProvider>
    </BrowserRouter>
);

export default BookingWizard;
