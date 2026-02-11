// d:\DOCUMENTOS\PROGRAMACION\PROYECTOS\SALOMON HAIR STUDIO\salomon-hair-studio\server\services\googleCalendarService.js

import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuración de rutas para credenciales
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// RUTA AL ARCHIVO QUE DESCARGAS DE GOOGLE CLOUD
// Debes colocar el archivo credentials.json en la carpeta server/config/ o raíz
// const KEYFILEPATH = path.join(__dirname, '../../credentials.json'); // (Reemplazado por lógica dinámica abajo)

// ID del calendario (puede ser el email principal o 'primary' si usas OAuth de usuario, 
// pero con Service Account suele ser el email del calendario compartido)
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary'; 

// ID del calendario público de feriados en Argentina
const HOLIDAYS_CALENDAR_ID = 'es.ar#holiday@group.v.calendar.google.com';

// Log informativo para saber dónde se guardarán los turnos
console.log(`📅 Google Calendar Service activo. Usando ID: ${CALENDAR_ID}`);

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// Cliente OAuth2 para usuarios individuales
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// URL de redirección específica para LOGIN (debe coincidir con la consola de Google)
const BACKEND_URL = (process.env.BACKEND_URL || 'https://salomonhairstudio.onrender.com').replace(/\/$/, '');
const LOGIN_REDIRECT_URI = `https://salomonhairstudio.onrender.com/api/auth/google/login/callback`;

console.log(`🔐 Login Redirect URI configurada: ${LOGIN_REDIRECT_URI}`);


// Configuración de autenticación dinámica (Soporta Render y Local)
let authConfig = { scopes: SCOPES };

if (process.env.GOOGLE_CREDENTIALS_JSON) {
    try {
        // En Producción (Render), leemos el JSON desde la variable de entorno
        authConfig.credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
        console.log('🔐 Usando credenciales de Google desde variable de entorno.');
    } catch (err) {
        console.error('❌ Error parseando GOOGLE_CREDENTIALS_JSON:', err);
    }
} else {
    // En Desarrollo, buscamos el archivo local
    const KEYFILEPATH = path.join(__dirname, '../../credentials.json');
    authConfig.keyFile = KEYFILEPATH;
    console.log(`📂 Usando archivo de credenciales local.`);
}

const auth = new google.auth.GoogleAuth(authConfig);

const calendar = google.calendar({ version: 'v3', auth });

export const getGoogleBusySlots = async (start, end, calendarId = CALENDAR_ID) => {
    try {
        const response = await calendar.events.list({
            calendarId: calendarId,
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = response.data.items;
        if (!events || events.length === 0) return [];

        // Convertir eventos a formato de minutos del día para tu lógica
        return events.map(event => {
            const isAllDay = !!event.start.date; // Si tiene 'date' en vez de 'dateTime' es día completo
            
            const startDateTime = new Date(event.start.dateTime || (event.start.date + 'T00:00:00'));
            const endDateTime = new Date(event.end.dateTime || (event.end.date + 'T23:59:59'));

            // Convertir a minutos desde las 00:00
            const startMinutes = startDateTime.getHours() * 60 + startDateTime.getMinutes();
            const endMinutes = endDateTime.getHours() * 60 + endDateTime.getMinutes();

            return {
                start: isAllDay ? 0 : startMinutes,
                end: isAllDay ? 1440 : endMinutes, // 1440 min = 24hs
                source: 'google',
                isAllDay: isAllDay,
                summary: event.summary
            };
        });

    } catch (error) {
        console.error('Error obteniendo eventos de Google Calendar:', error.message);
        return []; // Retornamos vacío para no romper la app si falla Google
    }
};

export const createGoogleEvent = async (appointmentData, calendarId = CALENDAR_ID) => {
    try {
        const { clientName, serviceName, date, startTime, endTime, professionalName } = appointmentData;

        // Construir fechas ISO
        const [startH, startM] = startTime.split(':');
        const [endH, endM] = endTime.split(':');
        
        // Asumimos que date viene como string YYYY-MM-DD o Date object
        const startDateTime = new Date(date);
        startDateTime.setHours(Number(startH), Number(startM), 0);
        
        const endDateTime = new Date(date);
        endDateTime.setHours(Number(endH), Number(endM), 0);

        const event = {
            summary: `Turno: ${clientName} - `,
            description: `Profesional: \nServicio: `,
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: 'America/Argentina/Buenos_Aires', // Ajustar tu zona horaria
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: 'America/Argentina/Buenos_Aires',
            },
            colorId: '5', // Amarillo en Google Calendar (opcional)
        };

        const res = await calendar.events.insert({
            calendarId: calendarId,
            resource: event,
        });

        console.log('Evento creado en Google Calendar:', res.data.htmlLink);
        return res.data;

    } catch (error) {
        console.error('Error creando evento en Google Calendar:', error.message);
        // No lanzamos error para que el turno se guarde en tu DB aunque falle Google
    }
};

export const deleteGoogleEvent = async (eventId, calendarId = CALENDAR_ID) => {
    try {
        await calendar.events.delete({
            calendarId: calendarId,
            eventId: eventId
        });
        console.log('🗑️ Evento eliminado de Google Calendar (Negocio).');
    } catch (error) {
        console.error('Error eliminando evento de Google Calendar:', error.message);
    }
};

export const updateGoogleEvent = async (eventId, appointmentData, calendarId = CALENDAR_ID) => {
    try {
        const { serviceName, date, startTime, endTime } = appointmentData;

        const [startH, startM] = startTime.split(':');
        const [endH, endM] = endTime.split(':');
        
        const startDateTime = new Date(date);
        startDateTime.setHours(Number(startH), Number(startM), 0);
        
        const endDateTime = new Date(date);
        endDateTime.setHours(Number(endH), Number(endM), 0);

        const eventPatch = {
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: 'America/Argentina/Buenos_Aires',
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: 'America/Argentina/Buenos_Aires',
            },
            // Opcional: Actualizar resumen si cambia el servicio
            // summary: ... 
        };

        await calendar.events.patch({ calendarId, eventId, resource: eventPatch });
        console.log('🔄 Evento actualizado en Google Calendar (Negocio).');
    } catch (error) {
        console.error('Error actualizando evento de Google Calendar:', error.message);
    }
};

export const getPublicHolidays = async (start, end) => {
    try {
        const response = await calendar.events.list({
            calendarId: HOLIDAYS_CALENDAR_ID,
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });
        return response.data.items || [];
    } catch (error) {
        console.error('Error obteniendo feriados:', error.message);
        return [];
    }
};

// --- FUNCIONES PARA LOGIN CON GOOGLE (SSO) ---

export const getLoginAuthUrl = () => {
    // Creamos un cliente específico para login con su propia redirect URI
    const loginClient = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        LOGIN_REDIRECT_URI
    );

    return loginClient.generateAuthUrl({
        access_type: 'online', // No necesitamos refresh token para solo loguear
        scope: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email'
        ]
    });
};

export const getGoogleUser = async (code) => {
    const loginClient = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        LOGIN_REDIRECT_URI
    );

    const { tokens } = await loginClient.getToken(code);
    loginClient.setCredentials(tokens);

    // Obtener info del usuario
    const oauth2 = google.oauth2({ version: 'v2', auth: loginClient });
    const { data } = await oauth2.userinfo.get();
    
    return {
        email: data.email,
        name: data.name,
        picture: data.picture
    };
};

// --- NUEVAS FUNCIONES PARA USUARIOS (OAuth) ---

export const getAuthUrl = (userId) => {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline', // Importante para obtener refresh_token y no pedir login siempre
        scope: SCOPES,
        prompt: 'consent', // <--- AGREGADO: Fuerza nuevo refresh_token siempre
        state: userId // Pasamos el ID del usuario para saber quién es al volver
    });
};

export const getTokens = async (code) => {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
};

export const createEventForUser = async (userTokens, appointmentData) => {
    try {
        // Crear un cliente específico para este usuario con sus tokens
        const userClient = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
        userClient.setCredentials(userTokens);

        const userCalendar = google.calendar({ version: 'v3', auth: userClient });

        const { serviceName, date, startTime, endTime, professionalName } = appointmentData;

        const [startH, startM] = startTime.split(':');
        const [endH, endM] = endTime.split(':');
        
        const startDateTime = new Date(date);
        startDateTime.setHours(Number(startH), Number(startM), 0);
        
        const endDateTime = new Date(date);
        endDateTime.setHours(Number(endH), Number(endM), 0);

        const event = {
            summary: `Turno: ${serviceName} en Salomon Hair Studio`,
            description: `Profesional: ${professionalName}\nServicio: ${serviceName}`,
            start: { dateTime: startDateTime.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
            end: { dateTime: endDateTime.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
        };

        const res = await userCalendar.events.insert({
            calendarId: 'primary', // 'primary' se refiere al calendario principal del usuario logueado
            resource: event,
        });

        console.log('✅ Evento creado en el calendario personal del cliente.');
        return res.data.id; // Retornamos el ID para guardarlo en la DB

    } catch (error) {
        if (error.message === 'No refresh token is set.') {
            console.error('⚠️ Error Google: El usuario necesita re-vincular su cuenta (Falta refresh token).');
        } else {
            console.error('Error creando evento en calendario de usuario:', error.message);
        }
    }
};

export const deleteEventForUser = async (userTokens, eventId) => {
    try {
        const userClient = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
        userClient.setCredentials(userTokens);
        const userCalendar = google.calendar({ version: 'v3', auth: userClient });

        await userCalendar.events.delete({
            calendarId: 'primary',
            eventId: eventId
        });
        console.log('🗑️ Evento eliminado del calendario del usuario.');
    } catch (error) {
        if (error.message === 'No refresh token is set.') {
            console.error('⚠️ Error Google: El usuario necesita re-vincular su cuenta (Falta refresh token).');
        } else {
            console.error('Error eliminando evento de usuario:', error.message);
        }
    }
};

export const updateEventForUser = async (userTokens, eventId, appointmentData) => {
    try {
        const userClient = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
        userClient.setCredentials(userTokens);
        const userCalendar = google.calendar({ version: 'v3', auth: userClient });

        const { date, startTime, endTime } = appointmentData;
        const [startH, startM] = startTime.split(':');
        const [endH, endM] = endTime.split(':');
        
        const startDateTime = new Date(date);
        startDateTime.setHours(Number(startH), Number(startM), 0);
        const endDateTime = new Date(date);
        endDateTime.setHours(Number(endH), Number(endM), 0);

        await userCalendar.events.patch({
            calendarId: 'primary',
            eventId: eventId,
            resource: {
                start: { dateTime: startDateTime.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
                end: { dateTime: endDateTime.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' }
            }
        });
        console.log('🔄 Evento actualizado en calendario de usuario.');
    } catch (error) {
        if (error.message === 'No refresh token is set.') {
            console.error('⚠️ Error Google: El usuario necesita re-vincular su cuenta (Falta refresh token).');
        } else {
            console.error('Error actualizando evento de usuario:', error.message);
        }
    }
};

export const listEventsForUser = async (userTokens, start, end) => {
    try {
        const userClient = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
        userClient.setCredentials(userTokens);
        const userCalendar = google.calendar({ version: 'v3', auth: userClient });

        const response = await userCalendar.events.list({
            calendarId: 'primary',
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });
        return response.data.items || [];
    } catch (error) {
        if (error.message === 'No refresh token is set.') {
            console.error('⚠️ Error Google: El usuario necesita re-vincular su cuenta (Falta refresh token).');
        } else {
            console.error('Error listando eventos de usuario:', error.message);
        }
        return [];
    }
};
