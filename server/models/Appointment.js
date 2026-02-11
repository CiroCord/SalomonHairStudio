import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true
    },
    startTime: {
        type: String, // Formato "HH:mm"
        required: true 
    },
    endTime: {
        type: String, // Calculado según duración
        required: true
    },
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    professional: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Professional',
        required: true
    },
    service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true
    },
    services: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
    }],
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed'],
        default: 'pending'
    },
    googleEventId: { type: String },             // ID del evento en el calendario del negocio
    clientGoogleEventId: { type: String },       // ID del evento en el calendario del cliente
    professionalGoogleEventId: { type: String }  // ID del evento en el calendario del profesional
}, { timestamps: true });

export default mongoose.model('Appointment', appointmentSchema);