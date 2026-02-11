import express from 'express';
import { 
    getGalleryItems, 
    createGalleryItem, 
    deleteGalleryItem,
    getPendingItems,
    getRejectedItems,
    updateItemStatus
} from '../controllers/galleryController.js';

const router = express.Router();

router.get('/', getGalleryItems);
router.post('/', createGalleryItem);
router.delete('/:id', deleteGalleryItem);
router.get('/pending', getPendingItems);
router.get('/rejected', getRejectedItems);
router.put('/:id/status', updateItemStatus);

export default router;
