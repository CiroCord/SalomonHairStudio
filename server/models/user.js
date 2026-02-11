import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    telefono: {
        type: String, 
        default: ''
    },
    role: {
        type: String,
        enum: ['client', 'admin', 'professional'],
        default: 'client'
    },
    notes: { type: String, default: '' },
    avatar: { type: String, default: '' },
    fechaNacimiento: { type: Date },
    verificationCode: { type: String, default: null },
    taggedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Dye' }],
    googleCalendarTokens: { type: Object },
    isWhatsappUser: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('User', userSchema); 