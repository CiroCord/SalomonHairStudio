import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import Service from './models/Service.js';
import Professional from './models/Professional.js';
import Appointment from './models/Appointment.js';
import User from './models/user.js';

const seedData = async () => {
    try {
        // PROTECCIÓN: Evitar correr el seed en producción accidentalmente
        // Asegúrate de configurar NODE_ENV="production" en tu servidor pago
        if (process.env.NODE_ENV === 'production') {
            console.error('⚠️  ¡PELIGRO! No puedes ejecutar el seed en entorno de producción. Borrarías todos los datos reales.');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('🔌 Conectado a MongoDB');

        // Limpiar DB existente
        await Service.deleteMany({});
        await Professional.deleteMany({});
        await Appointment.deleteMany({}); // Borramos turnos viejos/corruptos

        // Crear Servicios
        const corte = await Service.create({ name: 'Corte Clásico', duration: 30, price: 3500 });
        const barba = await Service.create({ name: 'Perfilado de Barba', duration: 20, price: 2000 });
        const color = await Service.create({ name: 'Coloración', duration: 90, price: 8000 });

        // Crear Profesionales
        await Professional.create({
            name: 'Salomón',
            email: 'salomon@studio.com',
            services: [corte._id, barba._id, color._id],
            active: true
        });

        await Professional.create({
            name: 'Camila Estilista',
            email: 'camila@studio.com',
            services: [corte._id, color._id],
            active: true
        });

        // Crear Usuario Admin por defecto
        const adminEmail = 'admin@salomon.com';
        const existingAdmin = await User.findOne({ email: adminEmail });
        
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({
                username: 'Administrador',
                email: adminEmail,
                password: hashedPassword,
                role: 'admin',
                telefono: '0000000000',
                fechaNacimiento: new Date()
            });
            console.log('👑 Admin creado: admin@salomon.com / admin123');
        }

        console.log('✅ Datos de prueba insertados correctamente');
        process.exit();
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

seedData();