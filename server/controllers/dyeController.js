// server/controllers/dyeController.js
import Dye from '../models/Dye.js';
import { v2 as cloudinary } from 'cloudinary';

// Configuración de Cloudinary (Reutilizamos las variables de entorno existentes)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

export const getDyes = async (req, res) => {
    try {
        // Usamos lean() para obtener objetos planos y poder leer campos viejos como 'number'
        const dyes = await Dye.find().sort({ category: 1, brand: 1, name: 1 }).lean();
        
        // Mapeo de compatibilidad: si no tiene 'name', usamos 'number'
        const sanitizedDyes = dyes.map(d => ({
            ...d,
            name: d.name || d.number || 'Sin Nombre'
        }));
        
        res.json(sanitizedDyes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateDye = async (req, res) => {
    const { id } = req.params;
    const { name, brand, image, category } = req.body;
    try {
        let imageUrl = image;
        
        // Si viene una imagen en base64, la subimos a Cloudinary
        if (image && image.startsWith('data:image')) {
            const uploadResponse = await cloudinary.uploader.upload(image, {
                folder: 'salomon_dyes'
            });
            imageUrl = uploadResponse.secure_url;
        }

        const updatedDye = await Dye.findByIdAndUpdate(id, { name, brand, image: imageUrl, category }, { new: true });
        if (!updatedDye) return res.status(404).json({ message: 'Producto no encontrado' });
        res.json(updatedDye);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const updateDyeStock = async (req, res) => {
    const { id } = req.params;
    const { amount } = req.body;
    try {
        // Usamos findByIdAndUpdate con $inc para evitar validaciones de schema (save())
        // que fallarían si el documento es viejo y le falta el campo 'name'.
        const updatedDye = await Dye.findByIdAndUpdate(
            id,
            { $inc: { stock: Number(amount) } },
            { new: true }
        );
        
        if (!updatedDye) return res.status(404).json({ message: 'Producto no encontrado' });
        
        // Corrección de stock negativo si ocurriera
        if (updatedDye.stock < 0) {
            await Dye.updateOne({ _id: id }, { stock: 0 });
            updatedDye.stock = 0;
        }
        
        res.json(updatedDye);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const bulkUpdateStock = async (req, res) => {
    const { ids, amount } = req.body;
    try {
        if (!ids || ids.length === 0) {
            return res.status(400).json({ message: 'No se seleccionaron tintes.' });
        }

        const dyes = await Dye.find({ _id: { $in: ids } });
        const updates = dyes.map(dye => {
            let newStock = (dye.stock || 0) + Number(amount);
            if (newStock < 0) newStock = 0;
            return {
                updateOne: {
                    filter: { _id: dye._id },
                    update: { stock: newStock }
                }
            };
        });
        
        if (updates.length > 0) {
            await Dye.bulkWrite(updates);
        }

        res.json({ message: 'Stock actualizado correctamente' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createDye = async (req, res) => {
    const { name, brand, image, category } = req.body;
    try {
        let imageUrl = image;
        
        // Si viene una imagen en base64, la subimos a Cloudinary
        if (image && image.startsWith('data:image')) {
            const uploadResponse = await cloudinary.uploader.upload(image, {
                folder: 'salomon_dyes'
            });
            imageUrl = uploadResponse.secure_url;
        }

        const newDye = new Dye({ name, brand, image: imageUrl, category });
        await newDye.save();
        res.status(201).json(newDye);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteDye = async (req, res) => {
    const { id } = req.params;
    try {
        await Dye.findByIdAndDelete(id);
        res.json({ message: 'Tinte eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
