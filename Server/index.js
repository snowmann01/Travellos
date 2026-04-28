import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.routes.js';
import InfoRoutes from './routes/user.routes.js';
import questRoutes from './routes/quests.routes.js';
import itineraryRoutes from './routes/itinerary.routes.js';
import challengeRoutes from './routes/challengeRoutes.js';
import './config/dotenv.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultOrigins = [
    'https://travello-project.vercel.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
];
const extraOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
const allowedOrigins = [...defaultOrigins, ...extraOrigins];
const isLocalDevOrigin = (origin = '') =>
    /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`Not allowed by CORS: ${origin}`));
        }
    },
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to Database Successfully ! '))
    .catch((err) => console.error(err));

app.use('/api/auth', authRoutes);
app.use('/api/user', InfoRoutes);
app.use('/api/quests', questRoutes);
app.use('/api/itinerary', itineraryRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/hidden-attractions', challengeRoutes);

app.get("/",(req,res)=>{
    res.send("Testing")
})

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));