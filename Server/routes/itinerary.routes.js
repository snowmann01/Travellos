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
router.get('/:id', (req, res) => {
  req.params.shareId = req.params.id;
  return getSharedItinerary(req, res);
});

export default router;
