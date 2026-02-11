import mongoose from 'mongoose';

const galleryItemSchema = new mongoose.Schema({
    title: String,
    description: String,
    mainMedia: { type: String, required: true }, // URL de la imagen principal
    hoverMedia: String, // URL del video o imagen del "antes" (opcional)
    mediaType: { type: String, enum: ['image', 'video'], default: 'image' }, // Tipo del hoverMedia
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Quién lo subió
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }, // Estado moderación
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('GalleryItem', galleryItemSchema);
