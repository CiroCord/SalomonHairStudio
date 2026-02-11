import express from 'express';
import { 
    registerUser, 
    loginUser, 
    obtenerUsuarioxId, 
    updateUser, 
    deleteUser, 
    forgotPassword, 
    resetPassword,
    requestVerificationCode,
    setupWhatsappAccount
} from '../controllers/userController.js';

const router = express.Router();

// Rutas de Autenticación y Usuarios
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/setup-account', setupWhatsappAccount); // Nueva ruta para usuarios de WhatsApp
router.get('/:id', obtenerUsuarioxId);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser); 

// Verificación de seguridad (Código para editar/eliminar)
router.post('/request-verification/:id', requestVerificationCode);

// Recuperación de contraseña
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:id/:token', resetPassword);

export default router;