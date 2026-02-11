import mongoose from 'mongoose';

const professionalExceptionSchema = new mongoose.Schema({
    professional: { type: mongoose.Schema.Types.ObjectId, ref: 'Professional', required: true },
    date: { type: Date, required: true },
    type: { type: String, enum: ['off', 'custom'], default: 'off' }, // 'off' = Franco/No trabaja, 'custom' = Horario especial
    startTime: String,
    endTime: String
});

// Índice compuesto para asegurar una configuración por día por profesional
professionalExceptionSchema.index({ professional: 1, date: 1 }, { unique: true });

export default mongoose.model('ProfessionalException', professionalExceptionSchema);