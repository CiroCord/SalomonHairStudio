import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { startWhatsAppBot } from './services/whatsappService.js';
import userRoutes from './routes/userRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import galleryRoutes from './routes/galleryRoutes.js';
import dyeRoutes from './routes/dyeRoutes.js';
import { checkAppointmentReminders, getUserGoogleEvents } from './controllers/appointmentController.js';
import { googleAuth, googleAuthCallback, unlinkGoogle, googleLogin, googleLoginCallback } from './controllers/googleAuthController.js';

// Inicialización de la App
const app = express();
const PORT = process.env.PORT || 5000;

// --- Verificación de Variables de Entorno ---
if (!process.env.JWT_SECRET) {
    console.error("❌ ERROR FATAL: La variable JWT_SECRET no está definida en el archivo .env");
    process.exit(1); // Detener el servidor para obligar a configurar el .env
}
if (!process.env.MONGO_URI) {
    console.error("❌ ERROR FATAL: La variable MONGO_URI no está definida en el archivo .env");
    process.exit(1);
}

console.log('⏳ Iniciando servidor...'); // Log para confirmar ejecución

// --- Middlewares ---

// Configuración de CORS
// Importante: Permitimos peticiones desde el puerto 4321 (Astro por defecto)
const allowedOrigins = [
  'http://localhost:4321', 
  'http://127.0.0.1:4321',
  process.env.FRONTEND_URL // Agrega tu dominio de producción aquí mediante variables de entorno
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Parseo de JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- Base de Datos ---
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('La variable MONGO_URI no está definida en el archivo .env');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Conectado exitosamente');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    // No cerramos el proceso para que puedas leer el error en la consola
    // process.exit(1); 
  }
};

// --- Rutas (Placeholder) ---
app.get('/', (req, res) => {
  res.send('API de Salomon Hair Studio funcionando 🚀');
});

// --- Rutas de la API ---
app.use('/api/users', userRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/admin/dyes', dyeRoutes);

// Ruta para obtener eventos de Google del usuario (para el frontend)
app.get('/api/appointments/google-events', getUserGoogleEvents);

// --- Rutas de Autenticación Google ---
app.get('/api/auth/google', googleAuth);
app.get('/api/auth/google/callback', googleAuthCallback);
app.post('/api/auth/google/unlink', unlinkGoogle);
// Rutas para Login (SSO)
app.get('/api/auth/google/login', googleLogin);
app.get('/api/auth/google/login/callback', googleLoginCallback);

// --- Tareas Programadas (Cron Simulado) ---
// Ejecutar verificación de recordatorios cada 1 hora (3600000 ms)
setInterval(() => {
    checkAppointmentReminders();
}, 3600000);

// --- Iniciar Servidor ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  // Intentamos conectar a la DB después de que el servidor ya esté escuchando
  connectDB();
  startWhatsAppBot();
});
