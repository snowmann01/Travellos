import express from 'express';
import {
  generateItinerary,
  saveItinerary,
  getSharedItinerary,
} from '../controllers/itinerary.controller.js';
import optionalAuth from '../middlewares/optionalAuth.js';

const router = express.Router();

router.post('/generate', generateItinerary);
router.post('/save', optionalAuth, saveItinerary);
router.get('/shared/:shareId', getSharedItinerary);

export default router;
