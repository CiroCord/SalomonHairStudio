import express from 'express';
import {
    getProfessionals, createProfessional, updateProfessional, deleteProfessional,
    getServices, createService, updateService, deleteService,
    getCategories, createCategory, deleteCategory,
    getConfig, updateConfig
} from '../controllers/adminController.js';

const router = express.Router();

// Profesionales
router.get('/professionals', getProfessionals);
router.post('/professionals', createProfessional);
router.put('/professionals/:id', updateProfessional);
router.delete('/professionals/:id', deleteProfessional);

// Servicios
router.get('/services', getServices);
router.post('/services', createService);
router.put('/services/:id', updateService);
router.delete('/services/:id', deleteService);

// Categorías
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.delete('/categories/:id', deleteCategory);

// Configuración
router.get('/config', getConfig);
router.put('/config', updateConfig);

export default router;
