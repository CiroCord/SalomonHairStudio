import User from '../models/user.js';
import Appointment from '../models/Appointment.js';
import Professional from '../models/Professional.js';
import { getAuthUrl, getTokens, createEventForUser, getLoginAuthUrl, getGoogleUser } from '../services/googleCalendarService.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// 1. Iniciar el proceso: Redirige al usuario a Google
export const googleAuth = (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).send('User ID is required');
    
    const url = getAuthUrl(userId);
    res.redirect(url);
};

// 2. Callback: Google vuelve aquí con el código
export const googleAuthCallback = async (req, res) => {
    const { code, state } = req.query; // 'state' contiene el userId que enviamos antes
    
    try {
        const tokens = await getTokens(code);
        
        // Guardamos los tokens en el usuario
        await User.findByIdAndUpdate(state, {
            googleCalendarTokens: tokens
        });

        // --- SINCRONIZACIÓN AUTOMÁTICA DE TURNOS FUTUROS ---
        const user = await User.findById(state);
        const now = new Date();
        
        let query = { date: { $gte: now }, status: { $ne: 'cancelled' } };

        // Determinar si buscamos turnos como cliente o como profesional
        if (user.role === 'client') {
            query.client = user._id;
        } else if (user.role === 'professional') {
            const professionalDoc = await Professional.findOne({ email: user.email });
            if (professionalDoc) {
                query.professional = professionalDoc._id;
            } else {
                query = null; // Si es admin sin perfil profesional, no sincronizamos nada por ahora
            }
        }

        const futureAppointments = query 
            ? await Appointment.find(query).populate('professional service services client') 
            : [];

        for (const app of futureAppointments) {
            const serviceNames = app.services && app.services.length > 0 
                ? app.services.map(s => s.name).join(' + ') 
                : app.service.name;
            
            await createEventForUser(tokens, {
                serviceName: serviceNames,
                professionalName: app.professional?.name || 'Profesional',
                date: app.date,
                startTime: app.startTime,
                endTime: app.endTime
            });
            
            // Opcional: Aquí podrías actualizar el turno con el nuevo ID generado (clientGoogleEventId o professionalGoogleEventId)
            // pero requeriría modificar createEventForUser para devolver el ID y lógica extra aquí.
            // Por simplicidad, la sincronización inicial es "fire and forget".
        }

        // Redirigir al frontend con éxito (Usamos puerto 4321 que es el de Astro por defecto)
        // IMPORTANTE: Configurar FRONTEND_URL en Render apuntando a Vercel
        const frontendUrl = process.env.FRONTEND_URL || 'https://salomon-hair-studio.vercel.app'; 
        res.redirect(`${frontendUrl}/mis-turnos?status=linked`);
    } catch (error) {
        console.error('Error en callback de Google:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'https://salomon-hair-studio.vercel.app';
        res.redirect(`${frontendUrl}/mis-turnos?status=error`);
    }
};

// 3. Desvincular cuenta
export const unlinkGoogle = async (req, res) => {
    const { userId } = req.body;
    try {
        await User.findByIdAndUpdate(userId, {
            $unset: { googleCalendarTokens: 1 } // Elimina el campo de la DB
        });
        res.json({ message: 'Desvinculado correctamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al desvincular', error: error.message });
    }
};

// --- LOGIN CON GOOGLE ---

// 4. Iniciar Login: Redirige a Google (Scopes de perfil)
export const googleLogin = (req, res) => {
    const url = getLoginAuthUrl();
    // Decodificamos para leer fácil la URL en la consola
    console.log("🔗 Enviando a Google redirect_uri:", decodeURIComponent(url.match(/redirect_uri=([^&]*)/)?.[1] || ''));
    res.redirect(url);
};

// 5. Callback Login: Crea/Busca usuario y devuelve JWT
export const googleLoginCallback = async (req, res) => {
    const { code } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'https://salomon-hair-studio.vercel.app';

    try {
        // Obtener datos del usuario desde Google
        const googleUser = await getGoogleUser(code);
        
        // Buscar si ya existe por email
        let user = await User.findOne({ email: googleUser.email });

        if (!user) {
            // Si no existe, lo creamos
            const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            user = new User({
                username: googleUser.name,
                email: googleUser.email,
                password: hashedPassword, // Contraseña aleatoria (no la usará)
                avatar: googleUser.picture,
                role: 'client',
                isWhatsappUser: false
            });
            await user.save();
        }

        // Generar JWT (Igual que en loginUser)
        const secret = process.env.JWT_SECRET;
        const token = jwt.sign({ id: user._id, role: user.role }, secret, {
            expiresIn: '24h'
        });

        // Redirigir al frontend pasando el token en la URL
        // El frontend deberá leer este token, guardarlo y limpiar la URL
        res.redirect(`${frontendUrl}/login?token=${token}`);

    } catch (error) {
        console.error('Error en Login con Google:', error);
        res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }
};