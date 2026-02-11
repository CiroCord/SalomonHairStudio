import express from 'express';
import {
    getServices,
    getProfessionals,
    getAvailability,
    createAppointment,
    getMonthAvailability,
    getMyAppointments,
    getProfessionalSchedule,
    getDayException,
    setDayException,
    deleteDayException,
    getPublicConfig,
    cancelAppointment,
    rescheduleAppointment
} from '../controllers/appointmentController.js';

const router = express.Router();

// Rutas para el flujo de reserva
router.get('/services', getServices);
router.get('/professionals', getProfessionals);
router.get('/config', getPublicConfig);
router.get('/availability', getAvailability);
router.get('/availability-month', getMonthAvailability);
router.get('/my-appointments', getMyAppointments);
router.post('/', createAppointment);
router.put('/:id/cancel', cancelAppointment);
router.put('/:id/reschedule', rescheduleAppointment);

// Gestión de disponibilidad (Profesionales)
router.get('/schedule', getProfessionalSchedule);
router.get('/exception', getDayException);
router.post('/exception', setDayException);
router.delete('/exception', deleteDayException);

export default router;