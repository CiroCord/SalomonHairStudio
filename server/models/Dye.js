// server/models/Dye.js
import mongoose from 'mongoose';

const dyeSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Antes 'number', ahora genérico
    brand: { type: String, required: true },
    image: { type: String, required: true }, // URL de Cloudinary
    stock: { type: Number, default: 0 },
    category: { type: String, required: true, default: 'Tintes' }
}, { timestamps: true });

export default mongoose.model('Dye', dyeSchema);
