import express from 'express';
import auth from '../middlewares/auth.js';
import ChallengeCompletion from '../models/ChallengeCompletion.js';
import { upload } from '../config/cloudinary.js';

const router = express.Router();

const parseLocation = (body) => {
  if (body.location) {
    try {
      const parsed = typeof body.location === 'string' ? JSON.parse(body.location) : body.location;
      const lng = Number(parsed.lng ?? parsed.longitude);
      const lat = Number(parsed.lat ?? parsed.latitude);
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        return [lng, lat];
      }
    } catch (error) {
      return null;
    }
  }

  const lng = Number(body.lng ?? body.longitude);
  const lat = Number(body.lat ?? body.latitude);
  if (Number.isFinite(lng) && Number.isFinite(lat)) {
    return [lng, lat];
  }

  return null;
};

const uploadPhoto = (req, res, next) => {
  upload.single('photo')(req, res, (error) => {
    if (error) {
      console.error('Challenge photo upload error:', error);
      return res.status(500).json({
        message: 'Photo upload failed. Check Cloudinary configuration.',
        error: error.message,
      });
    }
    return next();
  });
};

router.post('/complete', auth, uploadPhoto, async (req, res) => {
  try {
    const { description, challengeId } = req.body;
    const coordinates = parseLocation(req.body);
    const localPath = req.file?.path
      ? `/${req.file.path.replace(/\\/g, '/').split('/uploads/').pop()}`
      : '';
    const imageUrl =
      req.file?.secure_url ||
      req.file?.url ||
      (localPath ? `${req.protocol}://${req.get('host')}/uploads${localPath}` : '');

    if (!req.file) {
      return res.status(400).json({ message: 'Photo is required.' });
    }
    if (!description || !challengeId) {
      return res.status(400).json({ message: 'description and challengeId are required.' });
    }
    if (!coordinates) {
      return res.status(400).json({ message: 'Valid location (lng, lat) is required.' });
    }
    if (!imageUrl) {
      return res.status(500).json({ message: 'Uploaded photo URL is missing.' });
    }

    const completion = await ChallengeCompletion.create({
      user: req.userId,
      challengeId,
      description,
      imageUrl,
      location: {
        type: 'Point',
        coordinates,
      },
    });

    return res.status(201).json(completion);
  } catch (error) {
    console.error('Challenge completion error:', error);
    return res.status(500).json({ message: 'Failed to complete challenge.', error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const completions = await ChallengeCompletion.find()
      .sort({ createdAt: -1 })
      .populate('user', 'firstName lastName');

    const formatted = completions.map((item) => {
      const plain = item.toObject();
      const firstName = plain.user?.firstName || '';
      const lastName = plain.user?.lastName || '';
      const username = `${firstName} ${lastName}`.trim() || 'Anonymous';

      return {
        ...plain,
        user: {
          _id: plain.user?._id ?? null,
          username,
          avatar: null,
        },
      };
    });

    return res.status(200).json(formatted);
  } catch (error) {
    console.error('Hidden attractions fetch error:', error);
    return res.status(500).json({ message: 'Failed to fetch hidden attractions.' });
  }
});

export default router;
