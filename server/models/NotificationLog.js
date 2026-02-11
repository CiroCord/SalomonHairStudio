import mongoose from 'mongoose';

const notificationLogSchema = new mongoose.Schema({
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
    type: { type: String, enum: ['confirmation', 'reminder_3days', 'reminder_1day'], required: true },
    sentAt: { type: Date, default: Date.now }
});

// Índice para búsquedas rápidas
notificationLogSchema.index({ appointment: 1, type: 1 }, { unique: true });

export default mongoose.model('NotificationLog', notificationLogSchema);
