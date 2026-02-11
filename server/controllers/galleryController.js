import GalleryItem from '../models/GalleryItem.js';
import User from '../models/user.js';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

export const getGalleryItems = async (req, res) => {
    try {
        // Solo mostrar aprobados en la galería pública
        const items = await GalleryItem.find({ status: 'approved' })
            .populate('user', 'username avatar role') // Traer datos del usuario
            .sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createGalleryItem = async (req, res) => {
    try {
        const { title, description, mainMedia, hoverMedia, mediaType, userId } = req.body;
        
        // Determinar estado inicial según el rol del usuario
        const user = await User.findById(userId);
        // Si es admin o profesional se aprueba directo, si es cliente queda pendiente
        const status = (user && (user.role === 'admin' || user.role === 'professional')) ? 'approved' : 'pending';
        
        let mainMediaUrl = '';
        let hoverMediaUrl = '';

        // Subir imagen principal
        if (mainMedia) {
            const uploadRes = await cloudinary.uploader.upload(mainMedia, {
                folder: 'salomon_gallery'
            });
            mainMediaUrl = uploadRes.secure_url;
        }

        // Subir medio hover (si existe)
        if (hoverMedia) {
            const uploadRes = await cloudinary.uploader.upload(hoverMedia, {
                folder: 'salomon_gallery',
                resource_type: "auto" // Detecta si es video o imagen
            });
            hoverMediaUrl = uploadRes.secure_url;
        }

        const newItem = new GalleryItem({
            title,
            description,
            mainMedia: mainMediaUrl,
            hoverMedia: hoverMediaUrl,
            mediaType,
            user: userId,
            status
        });

        await newItem.save();
        res.status(201).json(newItem);
    } catch (error) {
        console.error("Error subiendo galería:", error);
        res.status(400).json({ message: error.message });
    }
};

export const deleteGalleryItem = async (req, res) => {
    try {
        await GalleryItem.findByIdAndDelete(req.params.id);
        res.json({ message: 'Item eliminado' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- MODERACIÓN ---

export const getPendingItems = async (req, res) => {
    try {
        const items = await GalleryItem.find({ status: 'pending' }).populate('user', 'username avatar role');
        res.json(items);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

export const getRejectedItems = async (req, res) => {
    try {
        const items = await GalleryItem.find({ status: 'rejected' }).populate('user', 'username avatar role');
        res.json(items);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

export const updateItemStatus = async (req, res) => {
    try {
        const { status } = req.body; // 'approved' o 'rejected'
        const item = await GalleryItem.findByIdAndUpdate(req.params.id, { status }, { new: true });
        res.json(item);
    } catch (error) { res.status(400).json({ message: error.message }); }
};
