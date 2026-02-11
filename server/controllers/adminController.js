import Professional from '../models/Professional.js';
import User from '../models/user.js';
import Service from '../models/Service.js';
import Category from '../models/Category.js';
import BusinessConfig from '../models/BusinessConfig.js';

// --- PROFESIONALES ---
export const getProfessionals = async (req, res) => {
    try {
        const pros = await Professional.find().populate('services');
        res.json(pros);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

export const createProfessional = async (req, res) => {
    try {
        const newPro = new Professional(req.body);
        await newPro.save();

        // Si ya existe un usuario con este email, actualizar su rol a 'professional'
        if (newPro.email) {
            const user = await User.findOne({ email: newPro.email });
            if (user && user.role === 'client') {
                user.role = 'professional';
                await user.save();
            }
        }

        res.status(201).json(newPro);
    } catch (error) { res.status(400).json({ message: error.message }); }
};

export const updateProfessional = async (req, res) => {
    try {
        const updatedPro = await Professional.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedPro);
    } catch (error) { res.status(400).json({ message: error.message }); }
};

export const deleteProfessional = async (req, res) => {
    try {
        await Professional.findByIdAndDelete(req.params.id);
        res.json({ message: 'Profesional eliminado' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

// --- SERVICIOS ---
export const getServices = async (req, res) => {
    try {
        const services = await Service.find().populate('category');
        res.json(services);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

export const createService = async (req, res) => {
    try {
        const serviceData = { ...req.body };
        // Si la categoría es un string vacío, la eliminamos para evitar error de Mongoose (CastError)
        if (serviceData.category === '') {
            delete serviceData.category;
        }

        const newService = new Service(serviceData);
        await newService.save();
        res.status(201).json(newService);
    } catch (error) { 
        console.error("Error creando servicio:", error);
        res.status(400).json({ message: error.message }); 
    }
};

export const updateService = async (req, res) => {
    try {
        const serviceData = { ...req.body };
        if (serviceData.category === '') {
            serviceData.category = null;
        }
        const updatedService = await Service.findByIdAndUpdate(req.params.id, serviceData, { new: true });
        res.json(updatedService);
    } catch (error) { 
        console.error("Error actualizando servicio:", error);
        res.status(400).json({ message: error.message }); 
    }
};

export const deleteService = async (req, res) => {
    try {
        await Service.findByIdAndDelete(req.params.id);
        res.json({ message: 'Servicio eliminado' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

// --- CATEGORÍAS ---
export const getCategories = async (req, res) => {
    try {
        const categories = await Category.find();
        res.json(categories);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

export const createCategory = async (req, res) => {
    try {
        const newCategory = new Category(req.body);
        await newCategory.save();
        res.status(201).json(newCategory);
    } catch (error) { res.status(400).json({ message: error.message }); }
};

export const deleteCategory = async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.json({ message: 'Categoría eliminada' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

// --- CONFIGURACIÓN ---
export const getConfig = async (req, res) => {
    try {
        let config = await BusinessConfig.findOne();
        if (!config) {
            config = await BusinessConfig.create({});
        }
        res.json(config);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

export const updateConfig = async (req, res) => {
    try {
        let config = await BusinessConfig.findOne();
        if (!config) {
            config = new BusinessConfig(req.body);
        } else {
            Object.assign(config, req.body);
        }
        await config.save();
        res.json(config);
    } catch (error) { res.status(400).json({ message: error.message }); }
};
