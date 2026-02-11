import Appointment from '../models/Appointment.js';
import Service from '../models/Service.js';
import Professional from '../models/Professional.js';
import ProfessionalException from '../models/ProfessionalException.js';
import NotificationLog from '../models/NotificationLog.js';
import User from '../models/user.js';
import BusinessConfig from '../models/BusinessConfig.js';
import { sendBookingEmail, sendReminderEmail, sendCancellationEmail, sendRescheduleEmail, sendProfessionalCancellationEmail } from '../utils/emailService.js';
import { getGoogleBusySlots, createGoogleEvent, createEventForUser, deleteGoogleEvent, deleteEventForUser, updateGoogleEvent, updateEventForUser, listEventsForUser, getPublicHolidays } from '../services/googleCalendarService.js';

// Obtener todos los servicios (para el paso 1 del wizard)
export const getServices = async (req, res) => {
    try {
        const services = await Service.find().populate('category');
        res.json(services);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener servicios' });
    }
};

// Obtener profesionales (para el paso 2 del wizard)
export const getProfessionals = async (req, res) => {
    try {
        const professionals = await Professional.find({ active: true }).populate('services');
        res.json(professionals);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener profesionales' });
    }
};

// Lógica interna para calcular disponibilidad (Reutilizable para Bot y Web)
export const calculateAvailability = async (professionalId, serviceIdOrIds, date) => {
    try {
        // 1. Obtener duración total (Soporte para múltiples servicios)
        let durationMinutes = 0;
        
        // Detectar si es un array, un string separado por comas, o un ID simple
        const ids = Array.isArray(serviceIdOrIds) ? serviceIdOrIds : (typeof serviceIdOrIds === 'string' && serviceIdOrIds.includes(',') ? serviceIdOrIds.split(',') : [serviceIdOrIds]);
        
        const services = await Service.find({ _id: { $in: ids } });
        if (!services || services.length === 0) throw new Error('Servicios no encontrados');

        // Sumar duraciones
        durationMinutes = services.reduce((total, srv) => total + Number(srv.duration), 0);

        // 2. Definir horario laboral desde Configuración
        let config = await BusinessConfig.findOne();
        if (!config) {
            config = { workingDays: [1, 2, 3, 4, 5, 6], openingTime: "09:00", closingTime: "20:00" };
        }

        // Parsear fecha manualmente para evitar problemas de zona horaria (YYYY-MM-DD)
        let searchDate;
        if (date.includes('T')) {
             // Fallback si todavía envía ISO
             searchDate = new Date(date);
        } else {
             const [year, month, day] = date.split('-').map(Number);
             searchDate = new Date(year, month - 1, day);
        }

        const dayOfWeek = searchDate.getDay();

        // 2.1 Verificar Excepciones del Profesional (Días libres o cambios de horario)
        const startOfDay = new Date(searchDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(searchDate);
        endOfDay.setHours(23, 59, 59, 999);

        const exception = await ProfessionalException.findOne({
            professional: professionalId,
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        // --- NUEVA LÓGICA DE FERIADOS (Calendario Oficial) ---
        // Solo verificamos feriados SI NO HAY una excepción explícita del profesional
        if (!exception) {
            const holidays = await getPublicHolidays(startOfDay, endOfDay);
            if (holidays.length > 0) {
                return []; // Día cerrado por feriado oficial
            }
        }

        let currentOpeningTime = config.openingTime;
        let currentClosingTime = config.closingTime;
        let isWorkingDay = config.workingDays && config.workingDays.includes(dayOfWeek);

        if (exception) {
            if (exception.type === 'off') return []; // Día bloqueado
            if (exception.type === 'custom') {
                currentOpeningTime = exception.startTime;
                currentClosingTime = exception.endTime;
                isWorkingDay = true; // Si puso horario, trabaja aunque sea domingo
            }
            if (exception.type === 'normal') {
                // Forzar horario normal (útil para abrir feriados o domingos)
                currentOpeningTime = config.openingTime;
                currentClosingTime = config.closingTime;
                isWorkingDay = true;
            }
        }

        if (!isWorkingDay) return [];

        const [openH, openM] = currentOpeningTime.split(':').map(Number);
        const [closeH, closeM] = currentClosingTime.split(':').map(Number);

        const WORK_START = openH * 60 + openM;
        const WORK_END = closeH * 60 + closeM;
        const SLOT_SIZE = durationMinutes;

        // 3. Buscar turnos existentes para ese profesional en esa fecha
        // (startOfDay y endOfDay ya definidos arriba)

        const appointments = await Appointment.find({
            professional: professionalId,
            date: { $gte: startOfDay, $lte: endOfDay },
            status: { $ne: 'cancelled' } // Ignorar cancelados
        });

        // Convertir turnos ocupados a rangos de minutos [inicio, fin]
        let busySlots = appointments.map(app => {
            const [startHour, startMin] = app.startTime.split(':').map(Number);
            const [endHour, endMin] = app.endTime.split(':').map(Number);
            return {
                start: startHour * 60 + startMin,
                end: endHour * 60 + endMin
            };
        });

        // --- INTEGRACIÓN GOOGLE CALENDAR (Lectura) ---
        // Consultamos eventos de Google para ese rango de fechas
        // NOTA: Aquí podrías pasar el calendarId específico del profesional si lo tuvieras en la DB
        const googleBusySlots = await getGoogleBusySlots(startOfDay, endOfDay);
        if (googleBusySlots.length > 0) {
            busySlots = [...busySlots, ...googleBusySlots];
        }

        // 4. Generar slots disponibles
        const availableSlots = [];
        
        // Obtener hora actual para filtrar slots pasados si es hoy
        const now = new Date();
        const isToday = searchDate.toDateString() === now.toDateString();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // Iteramos desde la hora de inicio hasta (hora fin - duración servicio)
        // Avanzamos según la duración del servicio (SLOT_SIZE)
        // NOTA: Esto busca si hay 'durationMinutes' libres a partir de 'time'.
        // Si dura 90 min, busca un bloque libre de 90 min.
        for (let time = WORK_START; time <= WORK_END - durationMinutes; time += SLOT_SIZE) {
            // Si es hoy y el horario de inicio ya pasó, lo saltamos
            if (isToday && time < currentMinutes) continue;

            const slotStart = time;
            const slotEnd = time + durationMinutes;

            // Verificar colisión con turnos existentes
            const isBusy = busySlots.some(busy => {
                // Hay colisión si el slot deseado se superpone con un turno ocupado
                // (StartA < EndB) y (EndA > StartB)
                return slotStart < busy.end && slotEnd > busy.start;
            });

            if (!isBusy) {
                // Formatear a HH:mm
                const formatTime = (minutes) => {
                    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
                    const m = (minutes % 60).toString().padStart(2, '0');
                    return `${h}:${m}`;
                };

                availableSlots.push({
                    startTime: formatTime(slotStart),
                    endTime: formatTime(slotEnd)
                });
            }
        }

        return availableSlots;

    } catch (error) {
        console.error(error);
        throw error;
    }
};

// Helper para obtener estado del día (usado por el bot)
export const getDateStatus = async (professionalId, date) => {
    try {
        let config = await BusinessConfig.findOne();
        if (!config) config = { workingDays: [1, 2, 3, 4, 5, 6], openingTime: "09:00", closingTime: "20:00" };

        let searchDate;
        if (date.includes('T')) searchDate = new Date(date);
        else {
             const [year, month, day] = date.split('-').map(Number);
             searchDate = new Date(year, month - 1, day);
        }
        const dayOfWeek = searchDate.getDay();

        const startOfDay = new Date(searchDate); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(searchDate); endOfDay.setHours(23, 59, 59, 999);

        // Si professionalId es 'any', verificamos solo si el negocio abre
        if (professionalId === 'any') {
             const isWorkingDay = config.workingDays && config.workingDays.includes(dayOfWeek);
             if (!isWorkingDay) return { status: 'closed', reason: 'La peluquería está cerrada los ' + ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][dayOfWeek] };
             return { status: 'open', openingTime: config.openingTime, closingTime: config.closingTime };
        }

        const exception = await ProfessionalException.findOne({
            professional: professionalId,
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        let currentOpeningTime = config.openingTime;
        let currentClosingTime = config.closingTime;
        let isWorkingDay = config.workingDays && config.workingDays.includes(dayOfWeek);
        
        if (exception) {
            if (exception.type === 'off') {
                return { status: 'off', reason: 'El profesional tiene franco este día.' };
            }
            if (exception.type === 'custom') {
                currentOpeningTime = exception.startTime;
                currentClosingTime = exception.endTime;
                isWorkingDay = true;
            }
        }

        if (!isWorkingDay) {
            return { status: 'closed', reason: 'La peluquería está cerrada este día.' };
        }

        return { status: 'open', openingTime: currentOpeningTime, closingTime: currentClosingTime };

    } catch (error) {
        return { status: 'error', reason: error.message };
    }
};

// Verificar disponibilidad (Endpoint HTTP)
export const getAvailability = async (req, res) => {
    const { professionalId, serviceId, serviceIds, date } = req.query;
    // Soporte para parámetro 'serviceIds' (nuevo) o 'serviceId' (viejo)
    const servicesToCheck = serviceIds ? serviceIds.split(',') : serviceId;

    try {
        if (professionalId === 'any') {
            // Buscar todos los profesionales que hacen este servicio
            // Nota: Si son múltiples servicios, idealmente buscamos profesionales que hagan TODOS, 
            // pero por simplicidad buscamos activos.
            let professionals = await Professional.find({ active: true });
            
            const allSlotsSet = new Set();

            for (const pro of professionals) {
                const slots = await calculateAvailability(pro._id, servicesToCheck, date);
                slots.forEach(slot => allSlotsSet.add(JSON.stringify(slot)));
            }

            // Convertir de nuevo a objetos, eliminar duplicados y ordenar
            const uniqueSlots = Array.from(allSlotsSet).map(s => JSON.parse(s));
            uniqueSlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

            return res.json({ availableSlots: uniqueSlots });
        }

        const availableSlots = await calculateAvailability(professionalId, servicesToCheck, date);
        res.json({ availableSlots });
    } catch (error) {
        res.status(500).json({ message: 'Error calculando disponibilidad' });
    }
};

// Lógica auxiliar para calcular disponibilidad mensual de UN profesional
const calculateMonthAvailabilityLogic = async (professionalId, serviceIdOrIds, year, month) => {
        const ids = Array.isArray(serviceIdOrIds) ? serviceIdOrIds : (typeof serviceIdOrIds === 'string' && serviceIdOrIds.includes(',') ? serviceIdOrIds.split(',') : [serviceIdOrIds]);
        const services = await Service.find({ _id: { $in: ids } });
        
        const durationMinutes = services.reduce((total, srv) => total + Number(srv.duration), 0);

        // Configuración
        let config = await BusinessConfig.findOne();
        if (!config) {
            config = { workingDays: [1, 2, 3, 4, 5, 6], openingTime: "09:00", closingTime: "20:00" };
        }

        const [openH, openM] = config.openingTime.split(':').map(Number);
        const [closeH, closeM] = config.closingTime.split(':').map(Number);

        const WORK_START = openH * 60 + openM;
        const WORK_END = closeH * 60 + closeM;
        const SLOT_SIZE = durationMinutes;

        // Calcular inicio y fin del mes solicitado
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, Number(month) + 1, 0, 23, 59, 59);

        // Buscar TODOS los turnos del mes en una sola consulta
        const appointments = await Appointment.find({
            professional: professionalId,
            date: { $gte: startDate, $lte: endDate },
            status: { $ne: 'cancelled' }
        });

        // Buscar excepciones del mes
        const exceptions = await ProfessionalException.find({
            professional: professionalId,
            date: { $gte: startDate, $lte: endDate }
        });

        // Buscar Feriados del mes
        const holidays = await getPublicHolidays(startDate, endDate);

        const daysInMonth = endDate.getDate();
        const availability = {}; // Mapa: { "1": "full", "2": "available", ... }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDayDate = new Date(year, month, day);
            
            const dayOfWeek = currentDayDate.getDay();

            // Verificar excepción para este día
            const exception = exceptions.find(e => {
                const eDate = new Date(e.date);
                return eDate.getDate() === day;
            });

            // Verificar Feriado Oficial (Solo si no hay excepción)
            if (!exception) {
                const isHoliday = holidays.some(h => {
                    const hDate = new Date(h.start.date || h.start.dateTime);
                    return hDate.toISOString().split('T')[0] === currentDayDate.toISOString().split('T')[0];
                });
                if (isHoliday) {
                    availability[day] = 'franco';
                    continue;
                }
            }

            if (exception && exception.type === 'off') {
                availability[day] = 'full';
                continue;
            }

            // Verificar día laboral
            // Si hay excepción custom, se considera laboral. Si no, se mira la config general.
            if (!exception || (exception.type !== 'custom' && exception.type !== 'normal')) {
                if (config.workingDays && !config.workingDays.includes(dayOfWeek)) {
                    availability[day] = 'closed';
                    continue;
                }
            }

            // Ignorar días pasados
            if (currentDayDate < startOfToday) {
                availability[day] = 'past';
                continue;
            }

            // Filtrar turnos de este día específico
            const dayAppointments = appointments.filter(app => {
                const appDate = new Date(app.date);
                return appDate.getDate() === day;
            });

            // Calcular huecos ocupados
            const busySlots = dayAppointments.map(app => {
                const [startHour, startMin] = app.startTime.split(':').map(Number);
                const [endHour, endMin] = app.endTime.split(':').map(Number);
                return { start: startHour * 60 + startMin, end: endHour * 60 + endMin };
            });

            let hasSlots = false;
            const isToday = currentDayDate.getTime() === startOfToday.getTime();

            // Buscar si existe AL MENOS UN hueco libre
            // Ajustar horario si es custom
            let dayStart = WORK_START;
            let dayEnd = WORK_END;
            if (exception && exception.type === 'custom') {
                const [sH, sM] = exception.startTime.split(':').map(Number);
                const [eH, eM] = exception.endTime.split(':').map(Number);
                dayStart = sH * 60 + sM;
                dayEnd = eH * 60 + eM;
            }

            for (let time = dayStart; time <= dayEnd - durationMinutes; time += SLOT_SIZE) {
                if (isToday && time < currentMinutes) continue;

                const slotStart = time;
                const slotEnd = time + durationMinutes;
                const isBusy = busySlots.some(busy => slotStart < busy.end && slotEnd > busy.start);

                if (!isBusy) { hasSlots = true; break; } // Encontramos uno, el día no está agotado
            }

            availability[day] = hasSlots ? 'available' : 'full';
        }

        return availability;
};

// Obtener disponibilidad mensual (Endpoint)
export const getMonthAvailability = async (req, res) => {
    const { professionalId, serviceId, serviceIds, year, month } = req.query;
    const servicesToCheck = serviceIds ? serviceIds.split(',') : serviceId;

    try {
        if (professionalId === 'any') {
            let professionals = await Professional.find({ active: true });
            
            // FALLBACK: Si no hay profesionales con el servicio asignado, usar todos los activos
            const combinedAvailability = {};
            
            // Obtener disponibilidad de cada profesional
            const proAvailabilities = [];
            for (const pro of professionals) {
                const avail = await calculateMonthAvailabilityLogic(pro._id, servicesToCheck, year, month);
                proAvailabilities.push(avail);
            }

            // Combinar: Si al menos uno está disponible, el día es disponible.
            const daysInMonth = new Date(year, Number(month) + 1, 0).getDate();
            
            for (let d = 1; d <= daysInMonth; d++) {
                let hasAvailable = false;
                let hasFull = false;
                let isPast = false;

                for (const avail of proAvailabilities) {
                    if (avail[d] === 'available') hasAvailable = true;
                    if (avail[d] === 'full') hasFull = true;
                    if (avail[d] === 'past') isPast = true;
                }

                if (isPast) combinedAvailability[d] = 'past';
                else if (hasAvailable) combinedAvailability[d] = 'available';
                else if (hasFull) combinedAvailability[d] = 'full';
                else combinedAvailability[d] = 'closed';
            }
            
            return res.json(combinedAvailability);
        }

        const availability = await calculateMonthAvailabilityLogic(professionalId, servicesToCheck, year, month);
        res.json(availability);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error calculando disponibilidad mensual' });
    }
};

// Crear turno
export const createAppointment = async (req, res) => {
    try {
        // Recalcular endTime en el backend por seguridad
        // Aceptamos 'services' (array) o 'service' (single legacy)
        let { services: serviceIds, service: serviceId, startTime, client: clientId, professional: professionalId, date } = req.body;
        
        // Normalizar a array
        const finalServiceIds = serviceIds || [serviceId];
        
        const servicesList = await Service.find({ _id: { $in: finalServiceIds } });
        if (servicesList.length === 0) throw new Error('Servicios inválidos');

        const totalDuration = servicesList.reduce((acc, s) => acc + Number(s.duration), 0);
        const serviceNames = servicesList.map(s => s.name).join(' + ');

        // --- LÓGICA DE ASIGNACIÓN AUTOMÁTICA ('Cualquier Profesional') ---
        if (professionalId === 'any') {
            // Buscar entre todos los activos
            let professionals = await Professional.find({ active: true });
            
            // 1. Filtrar profesionales disponibles en ese horario específico
            const availablePros = [];
            for (const pro of professionals) {
                const slots = await calculateAvailability(pro._id, finalServiceIds, date);
                // Verificamos si el horario solicitado está en sus slots libres
                if (slots.some(s => s.startTime === startTime)) {
                    availablePros.push(pro);
                }
            }

            if (availablePros.length === 0) {
                return res.status(400).json({ message: 'El turno seleccionado ya no está disponible.' });
            }

            // 2. Balanceo de carga: Elegir el que tenga MENOS turnos ese día
            const startOfDay = new Date(date); startOfDay.setHours(0,0,0,0);
            const endOfDay = new Date(date); endOfDay.setHours(23,59,59,999);

            const proCounts = [];
            for (const pro of availablePros) {
                const count = await Appointment.countDocuments({
                    professional: pro._id,
                    date: { $gte: startOfDay, $lte: endOfDay },
                    status: { $ne: 'cancelled' }
                });
                proCounts.push({ pro, count });
            }

            // Ordenar por cantidad de turnos (ascendente)
            proCounts.sort((a, b) => a.count - b.count);
            
            // Asignar al ganador
            professionalId = proCounts[0].pro._id;
        } 

        const [hours, minutes] = startTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + totalDuration;
        
        const endH = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
        const endM = (totalMinutes % 60).toString().padStart(2, '0');
        const endTime = `${endH}:${endM}`;

        const newAppointment = new Appointment({
            ...req.body,
            professional: professionalId, // Usar el ID resuelto (por si venía 'any')
            endTime, // Sobreescribimos con el cálculo seguro
            services: finalServiceIds, // Guardamos el array
            service: finalServiceIds[0] // Mantenemos compatibilidad con legacy (primer servicio)
        });

        await newAppointment.save();

        // --- INTEGRACIÓN GOOGLE CALENDAR (Escritura) ---
        // Creamos el evento en Google Calendar
        const businessEvent = await createGoogleEvent({
            clientName: (await User.findById(clientId))?.username || 'Cliente Web',
            serviceName: serviceNames,
            professionalName: (await Professional.findById(professionalId))?.name || 'Profesional',
            date: date,
            startTime: startTime,
            endTime: endTime
        });

        if (businessEvent && businessEvent.id) {
            newAppointment.googleEventId = businessEvent.id;
        }

        // --- INTEGRACIÓN CALENDARIO PERSONAL DEL CLIENTE ---
        const clientUser = await User.findById(clientId);
        if (clientUser && clientUser.googleCalendarTokens) {
            const clientEventId = await createEventForUser(clientUser.googleCalendarTokens, {
                serviceName: serviceNames,
                professionalName: (await Professional.findById(professionalId))?.name || 'Profesional',
                date: date,
                startTime: startTime,
                endTime: endTime
            });
            if (clientEventId) newAppointment.clientGoogleEventId = clientEventId;
        }

        // --- INTEGRACIÓN CALENDARIO DEL PROFESIONAL ---
        const professionalDoc = await Professional.findById(professionalId);
        if (professionalDoc) {
            const professionalUser = await User.findOne({ email: professionalDoc.email });
            if (professionalUser && professionalUser.googleCalendarTokens) {
                const proEventId = await createEventForUser(professionalUser.googleCalendarTokens, {
                    serviceName: serviceNames,
                    professionalName: 'Tú (Salomon Hair Studio)', // Título para el pro
                    date: date,
                    startTime: startTime,
                    endTime: endTime
                });
                if (proEventId) newAppointment.professionalGoogleEventId = proEventId;
            }
        }

        // Guardamos los IDs de Google en el turno
        await newAppointment.save();

        // --- ENVIAR EMAIL DE CONFIRMACIÓN ---
        try {
            const client = await User.findById(clientId);
            const professional = await Professional.findById(professionalId);
            const dateObj = new Date(date);
            const dateStr = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

            if (client && client.email) {
                await sendBookingEmail(client.email, {
                    clientName: client.username,
                    serviceName: serviceNames, // Enviamos nombres combinados
                    professionalName: professional.name,
                    date: dateStr,
                    time: startTime
                });
            }
        } catch (emailError) {
            console.error("Error enviando email de confirmación:", emailError);
            // No fallamos la request si el email falla, pero lo logueamos
        }

        res.status(201).json(newAppointment);
    } catch (error) {
        res.status(400).json({ message: 'Error al crear el turno', error: error.message });
    }
};

// Obtener mis turnos (Cliente o Profesional)
export const getMyAppointments = async (req, res) => {
    const { userId } = req.query;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

        let query = { status: { $ne: 'cancelled' } };

        if (user.role === 'client') {
            query.client = userId;
        } else if (user.role === 'professional' || user.role === 'admin') {
            // Si es profesional, buscamos su perfil de Professional usando el email
            const professional = await Professional.findOne({ email: user.email });
            
            if (!professional) {
                 // Si es admin sin perfil profesional, devolvemos vacío o todos (opcional)
                 // Por ahora devolvemos vacío para no romper la UI
                 return res.json([]);
            }
            query.professional = professional._id;
        }

        const appointments = await Appointment.find(query)
            .populate('client', 'username email avatar telefono fechaNacimiento')
            .populate('professional', 'name email')
            .populate({
                path: 'service',
                select: 'name price duration category',
                populate: { path: 'category', select: 'name' }
            })
            .populate({
                path: 'services',
                select: 'name price duration category',
                populate: { path: 'category', select: 'name' }
            })
            .sort({ date: 1, startTime: 1 });

        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Obtener agenda del profesional (para pintar el calendario en el dashboard)
export const getProfessionalSchedule = async (req, res) => {
    const { userId, year, month } = req.query;
    
    try {
        const user = await User.findById(userId);
        const professional = await Professional.findOne({ email: user.email });
        if (!professional) return res.status(404).json({ message: 'Profesional no encontrado' });

        // Configuración
        let config = await BusinessConfig.findOne();
        if (!config) {
            config = { workingDays: [1, 2, 3, 4, 5, 6], openingTime: "09:00", closingTime: "20:00" };
        }

        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, Number(month) + 1, 0, 23, 59, 59);

        // Buscar excepciones del mes
        const exceptions = await ProfessionalException.find({
            professional: professional._id,
            date: { $gte: startDate, $lte: endDate }
        });

        // Buscar Feriados del mes
        const holidays = await getPublicHolidays(startDate, endDate);

        const daysInMonth = endDate.getDate();
        const availability = {}; 

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDayDate = new Date(year, month, day);
            const dayOfWeek = currentDayDate.getDay();
            
            // Verificar excepción
            const exception = exceptions.find(e => {
                const eDate = new Date(e.date);
                return eDate.getDate() === day;
            });

            // Verificar Feriado (Solo si no hay excepción)
            if (!exception) {
                const isHoliday = holidays.some(h => {
                    const hDate = new Date(h.start.date || h.start.dateTime);
                    return hDate.toISOString().split('T')[0] === currentDayDate.toISOString().split('T')[0];
                });
                if (isHoliday) {
                    availability[day] = 'franco';
                    continue;
                }
            }

            if (exception && exception.type === 'off') {
                availability[day] = 'franco'; // Franco
                continue;
            }

            // Verificar día laboral general
            if (!exception || (exception.type !== 'custom' && exception.type !== 'normal')) {
                if (config.workingDays && !config.workingDays.includes(dayOfWeek)) {
                    availability[day] = 'closed'; // Día no laboral del negocio
                    continue;
                }
            }
            
            availability[day] = 'available';
        }

        res.json(availability);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

// --- GESTIÓN DE DISPONIBILIDAD (EXCEPCIONES) ---

export const getDayException = async (req, res) => {
    const { userId, date } = req.query;
    try {
        const user = await User.findById(userId);
        const professional = await Professional.findOne({ email: user.email });
        if (!professional) return res.status(404).json({ message: 'Profesional no encontrado' });

        const searchDate = new Date(date);
        const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));

        const exception = await ProfessionalException.findOne({
            professional: professional._id,
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        res.json(exception || null);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

export const setDayException = async (req, res) => {
    const { userId, date, type, startTime, endTime } = req.body;
    try {
        const user = await User.findById(userId);
        const professional = await Professional.findOne({ email: user.email });
        if (!professional) return res.status(404).json({ message: 'Profesional no encontrado' });

        // Construir fecha localmente para evitar desfases de zona horaria (UTC vs Local)
        const [year, month, day] = date.split('-').map(Number);
        const targetDate = new Date(year, month - 1, day, 12, 0, 0);

        // Upsert (Actualizar si existe, crear si no)
        const exception = await ProfessionalException.findOneAndUpdate(
            { professional: professional._id, date: { $gte: new Date(targetDate).setHours(0,0,0,0), $lte: new Date(targetDate).setHours(23,59,59,999) } },
            { professional: professional._id, date: targetDate, type, startTime, endTime },
            { new: true, upsert: true }
        );

        // --- NOTIFICAR Y CANCELAR TURNOS AFECTADOS ---
        const startOfDay = new Date(targetDate); startOfDay.setHours(0,0,0,0);
        const endOfDay = new Date(targetDate); endOfDay.setHours(23,59,59,999);

        const conflictingAppointments = await Appointment.find({
            professional: professional._id,
            date: { $gte: startOfDay, $lte: endOfDay },
            status: { $ne: 'cancelled' }
        }).populate('client service services');

        for (const app of conflictingAppointments) {
            let shouldCancel = false;

            if (type === 'off') {
                // Si es franco, se cancelan todos los turnos del día
                shouldCancel = true;
            } else if (type === 'custom') {
                // Si es cambio de horario, verificar si el turno cae fuera del nuevo rango
                const [appStartH, appStartM] = app.startTime.split(':').map(Number);
                const appStartMinutes = appStartH * 60 + appStartM;
                
                const [appEndH, appEndM] = app.endTime.split(':').map(Number);
                const appEndMinutes = appEndH * 60 + appEndM;

                const [newStartH, newStartM] = startTime.split(':').map(Number);
                const newStartMinutes = newStartH * 60 + newStartM;

                const [newEndH, newEndM] = endTime.split(':').map(Number);
                const newEndMinutes = newEndH * 60 + newEndM;

                // Si el turno empieza antes del nuevo inicio O termina después del nuevo fin
                if (appStartMinutes < newStartMinutes || appEndMinutes > newEndMinutes) {
                    shouldCancel = true;
                }
            } else if (type === 'normal') {
                let config = await BusinessConfig.findOne();
                if (!config) config = { openingTime: "09:00", closingTime: "20:00" };
                
                const [newStartH, newStartM] = config.openingTime.split(':').map(Number);
                const newStartMinutes = newStartH * 60 + newStartM;

                const [newEndH, newEndM] = config.closingTime.split(':').map(Number);
                const newEndMinutes = newEndH * 60 + newEndM;

                const [appStartH, appStartM] = app.startTime.split(':').map(Number);
                const appStartMinutes = appStartH * 60 + appStartM;
                
                const [appEndH, appEndM] = app.endTime.split(':').map(Number);
                const appEndMinutes = appEndH * 60 + appEndM;

                if (appStartMinutes < newStartMinutes || appEndMinutes > newEndMinutes) {
                    shouldCancel = true;
                }
            }

            if (shouldCancel) {
                app.status = 'cancelled';
                await app.save();

                // --- ELIMINAR DE GOOGLE CALENDAR ---
                // 1. Calendario del Negocio
                if (app.googleEventId) {
                    await deleteGoogleEvent(app.googleEventId);
                }
                // 2. Calendario del Cliente
                if (app.clientGoogleEventId && app.client && app.client.googleCalendarTokens) {
                    await deleteEventForUser(app.client.googleCalendarTokens, app.clientGoogleEventId);
                }
                // 3. Calendario del Profesional
                if (app.professionalGoogleEventId && user && user.googleCalendarTokens) {
                    await deleteEventForUser(user.googleCalendarTokens, app.professionalGoogleEventId);
                }

                if (app.client && app.client.email) {
                    const dateStr = new Date(app.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                    try {
                        await sendProfessionalCancellationEmail(app.client.email, {
                            clientName: app.client.username,
                            serviceName: app.services && app.services.length > 0 ? app.services.map(s => s.name).join(' + ') : app.service.name,
                            professionalName: professional.name,
                            date: dateStr,
                            time: app.startTime
                        });
                    } catch (err) {
                        console.error("Error enviando email de cancelación por excepción:", err);
                    }
                }
            }
        }

        res.json(exception);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

export const deleteDayException = async (req, res) => {
    const { userId, date } = req.query;
    try {
        const user = await User.findById(userId);
        const professional = await Professional.findOne({ email: user.email });
        if (!professional) return res.status(404).json({ message: 'Profesional no encontrado' });
        
        // Construir fecha localmente para evitar desfases de zona horaria (UTC vs Local)
        const [year, month, day] = date.split('-').map(Number);
        const targetDate = new Date(year, month - 1, day, 12, 0, 0);

        const startOfDay = new Date(targetDate).setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate).setHours(23, 59, 59, 999);

        await ProfessionalException.findOneAndDelete({
            professional: professional._id,
            date: { $gte: startOfDay, $lte: endOfDay }
        });
        res.json({ message: 'Excepción eliminada' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

// --- CONFIGURACIÓN PÚBLICA ---
export const getPublicConfig = async (req, res) => {
    try {
        let config = await BusinessConfig.findOne();
        if (!config) {
            config = { whatsappNumber: '' };
        }
        // Solo devolvemos datos seguros/públicos
        res.json({ whatsappNumber: config.whatsappNumber });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

// --- CRON JOB: RECORDATORIOS ---
export const checkAppointmentReminders = async () => {
    console.log("⏳ Verificando recordatorios de turnos...");
    try {
        const now = new Date();
        
        // Definir rangos para 3 días y 1 día
        const threeDaysFromNow = new Date(now); threeDaysFromNow.setDate(now.getDate() + 3);
        const oneDayFromNow = new Date(now); oneDayFromNow.setDate(now.getDate() + 1);

        // Función auxiliar para procesar recordatorios
        const processReminders = async (targetDate, type) => {
            const start = new Date(targetDate); start.setHours(0,0,0,0);
            const end = new Date(targetDate); end.setHours(23,59,59,999);

            const appointments = await Appointment.find({
                date: { $gte: start, $lte: end },
                status: { $ne: 'cancelled' }
            }).populate('client service services');

            for (const app of appointments) {
                if (!app.client || !app.client.email) continue;

                // Verificar si ya se envió
                const alreadySent = await NotificationLog.findOne({ appointment: app._id, type });
                if (alreadySent) continue;

                // Enviar Email
                const dateStr = new Date(app.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                
                try {
                    await sendReminderEmail(app.client.email, type === 'reminder_3days' ? '3days' : '1day', {
                        clientName: app.client.username,
                        serviceName: app.services && app.services.length > 0 ? app.services.map(s => s.name).join(' + ') : app.service.name,
                        date: dateStr,
                        time: app.startTime
                    });

                    // Registrar envío
                    await NotificationLog.create({ appointment: app._id, type });
                    console.log(`✅ Recordatorio ${type} enviado a ${app.client.email}`);
                } catch (err) {
                    console.error(`❌ Error enviando recordatorio a ${app.client.email}:`, err);
                }
            }
        };

        await processReminders(threeDaysFromNow, 'reminder_3days');
        await processReminders(oneDayFromNow, 'reminder_1day');

    } catch (error) {
        console.error("Error en checkAppointmentReminders:", error);
    }
};

// --- CANCELACIÓN Y REPROGRAMACIÓN ---

export const cancelAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const appointment = await Appointment.findById(id).populate('client service services professional');
        if (!appointment) return res.status(404).json({ message: 'Turno no encontrado' });

        const now = new Date();
        const appDate = new Date(appointment.date);
        const [hours, minutes] = appointment.startTime.split(':').map(Number);
        appDate.setHours(hours, minutes, 0, 0);

        const diffTime = appDate - now;
        const diffHours = diffTime / (1000 * 60 * 60);

        if (diffHours < 48) {
            return res.status(400).json({ message: 'Solo se pueden cancelar turnos con más de 48hs de anticipación.' });
        }

        appointment.status = 'cancelled';
        await appointment.save();

        // --- ELIMINAR DE GOOGLE CALENDAR ---
        // 1. Calendario del Negocio
        if (appointment.googleEventId) {
            await deleteGoogleEvent(appointment.googleEventId);
        }
        // 2. Calendario del Cliente
        if (appointment.clientGoogleEventId && appointment.client && appointment.client.googleCalendarTokens) {
            await deleteEventForUser(appointment.client.googleCalendarTokens, appointment.clientGoogleEventId);
        }
        // 3. Calendario del Profesional
        if (appointment.professionalGoogleEventId && appointment.professional) {
            const professionalUser = await User.findOne({ email: appointment.professional.email });
            if (professionalUser && professionalUser.googleCalendarTokens) {
                await deleteEventForUser(professionalUser.googleCalendarTokens, appointment.professionalGoogleEventId);
            }
        }

        // Enviar Email de Cancelación
        if (appointment.client && appointment.client.email) {
            const dateStr = new Date(appointment.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
            try {
                await sendCancellationEmail(appointment.client.email, {
                    clientName: appointment.client.username,
                    serviceName: appointment.services && appointment.services.length > 0 ? appointment.services.map(s => s.name).join(' + ') : (appointment.service ? appointment.service.name : 'Servicio'),
                    date: dateStr,
                    time: appointment.startTime
                });
            } catch (error) {
                console.error("Error enviando email de cancelación:", error);
            }
        }

        res.json({ message: 'Turno cancelado con éxito' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const rescheduleAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, startTime } = req.body;
        
        const appointment = await Appointment.findById(id).populate('client service services professional');
        if (!appointment) return res.status(404).json({ message: 'Turno no encontrado' });

        // Guardar datos anteriores para el email
        const oldDateStr = new Date(appointment.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        const oldTime = appointment.startTime;

        // Recalcular endTime
        // Usar array de servicios si existe, sino fallback al simple
        const servicesList = (appointment.services && appointment.services.length > 0) ? appointment.services : [appointment.service];
        const totalDuration = servicesList.reduce((acc, s) => acc + Number(s.duration), 0);

        const [newHours, newMinutes] = startTime.split(':').map(Number);
        const totalMinutes = newHours * 60 + newMinutes + totalDuration;
        const endH = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
        const endM = (totalMinutes % 60).toString().padStart(2, '0');
        const endTime = `${endH}:${endM}`;

        appointment.date = date;
        appointment.startTime = startTime;
        appointment.endTime = endTime;
        
        await appointment.save();

        // --- ACTUALIZAR EN GOOGLE CALENDAR ---
        const updateData = {
            date: date,
            startTime: startTime,
            endTime: endTime,
            serviceName: servicesList.map(s => s.name).join(' + ')
        };

        // 1. Calendario del Negocio
        if (appointment.googleEventId) {
            await updateGoogleEvent(appointment.googleEventId, updateData);
        }
        // 2. Calendario del Cliente
        if (appointment.clientGoogleEventId && appointment.client && appointment.client.googleCalendarTokens) {
            await updateEventForUser(appointment.client.googleCalendarTokens, appointment.clientGoogleEventId, updateData);
        }
        // 3. Calendario del Profesional
        if (appointment.professionalGoogleEventId && appointment.professional) {
            const professionalUser = await User.findOne({ email: appointment.professional.email });
            if (professionalUser && professionalUser.googleCalendarTokens) {
                await updateEventForUser(professionalUser.googleCalendarTokens, appointment.professionalGoogleEventId, updateData);
            }
        }

        // IMPORTANTE: Borrar logs de notificaciones anteriores para que se envíen los recordatorios de la nueva fecha
        await NotificationLog.deleteMany({ appointment: id });

        // Enviar Email de Reprogramación
        if (appointment.client && appointment.client.email) {
            const newDateStr = new Date(date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
            try {
                await sendRescheduleEmail(appointment.client.email, {
                    clientName: appointment.client.username,
                    serviceName: servicesList.map(s => s.name).join(' + '),
                    professionalName: appointment.professional.name,
                    oldDate: oldDateStr,
                    oldTime: oldTime,
                    newDate: newDateStr,
                    newTime: startTime
                });
            } catch (error) {
                console.error("Error enviando email de reprogramación:", error);
            }
        }

        res.json({ message: 'Turno reprogramado con éxito', appointment });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- NUEVO ENDPOINT: OBTENER EVENTOS DE GOOGLE DEL USUARIO ---
export const getUserGoogleEvents = async (req, res) => {
    const { userId, date, year, month } = req.query;
    try {
        const user = await User.findById(userId);
        if (!user || !user.googleCalendarTokens) {
            return res.json([]); // Si no está vinculado, devolvemos array vacío
        }

        let start, end;

        // Opción 1: Rango Mensual (para los puntitos del calendario)
        if (year !== undefined && month !== undefined) {
            // CORRECCIÓN: Usamos el mes tal cual viene (0-indexed) para ser consistentes con el resto de la app
            const m = Number(month); 
            
            // Forzar zona horaria Argentina (GMT-3)
            // Inicio: Día 1 a las 00:00 ARG => 03:00 UTC
            start = new Date(Date.UTC(year, m, 1, 3, 0, 0));
            // Fin: Último día a las 23:59:59 ARG => Día siguiente 02:59:59 UTC
            end = new Date(Date.UTC(year, m + 1, 0)); 
            end.setUTCHours(26, 59, 59, 999);
        } 
        // Opción 2: Día específico (para la lista de horarios)
        else if (date) {
            // date viene como "YYYY-MM-DD"
            const [y, m, d] = date.split('-').map(Number);
            
            // Inicio: 00:00 ARG => 03:00 UTC
            start = new Date(Date.UTC(y, m - 1, d, 3, 0, 0));
            // Fin: 23:59 ARG => 02:59 UTC del día siguiente
            end = new Date(Date.UTC(y, m - 1, d));
            end.setUTCHours(26, 59, 59, 999);
        } else {
            // Si faltan parámetros, devolvemos vacío para no romper
            return res.json([]);
        }

        const events = await listEventsForUser(user.googleCalendarTokens, start, end);
        
        // Filtrar eventos creados por la propia app para evitar duplicados visuales
        const filteredEvents = events.filter(e => !e.summary?.includes('Salomon Hair Studio'));
        
        // Simplificar respuesta
        const simpleEvents = filteredEvents.map(e => ({
            summary: e.summary || 'Evento Ocupado',
            start: e.start.dateTime ? new Date(e.start.dateTime).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'}) : 'Todo el día',
            end: e.end.dateTime ? new Date(e.end.dateTime).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'}) : 'Todo el día',
            isAllDay: !e.start.dateTime,
            startDate: e.start.dateTime || e.start.date, // Campo clave para el mapa de puntitos
            endDate: e.end.dateTime || e.end.date        // Necesario para rangos
        }));

        res.json(simpleEvents);
    } catch (error) {
        console.error("Error obteniendo eventos de usuario:", error);
        res.status(500).json({ message: "Error al obtener eventos" });
    }
};