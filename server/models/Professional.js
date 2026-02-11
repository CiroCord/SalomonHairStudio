import mongoose from 'mongoose';

const professionalSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: String,
    services: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
    }],
    // Estructura simple de horario: { "Lunes": ["09:00-13:00", "15:00-19:00"] }
    schedule: {
        type: Map,
        of: [String] 
    },
    active: {
        type: Boolean,
        default: true
    }
});

export default mongoose.model('Professional', professionalSchema);