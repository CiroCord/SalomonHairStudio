import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    duration: {
        type: Number, // En minutos
        required: true
    },
    price: {
        type: Number,
        required: true 
    },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    priceMax: Number, // Para rango de precios
    priceType: { type: String, enum: ['fixed', 'range', 'consultation'], default: 'fixed' },
    requiresDeposit: { type: Boolean, default: false },
    requiresWhatsApp: { type: Boolean, default: false }, // Reserva por WhatsApp (sin guardar en DB)
    description: String,
});

export default mongoose.model('Service', serviceSchema);