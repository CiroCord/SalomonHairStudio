import mongoose from 'mongoose';

const businessConfigSchema = new mongoose.Schema({
    workingDays: [Number], // 0=Domingo, 1=Lunes, etc.
    openingTime: { type: String, default: "09:00" },
    closingTime: { type: String, default: "20:00" },
    timeBlock: { type: Number, default: 30 },// Duración del bloque en minutos
    whatsappNumber: String,
    dyeBrands: { type: [String], default: [] },
    productCategories: { type: [String], default: ['Tintes'] }
});

export default mongoose.model('BusinessConfig', businessConfigSchema);
