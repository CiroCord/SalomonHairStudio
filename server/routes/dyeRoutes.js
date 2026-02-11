// server/routes/dyeRoutes.js
import express from 'express';
import { getDyes, createDye, deleteDye, updateDyeStock, bulkUpdateStock, updateDye } from '../controllers/dyeController.js';

const router = express.Router();

router.get('/', getDyes);
router.post('/', createDye);
router.delete('/:id', deleteDye);
router.put('/:id', updateDye);
router.put('/:id/stock', updateDyeStock);
router.put('/stock/bulk', bulkUpdateStock);

export default router;
