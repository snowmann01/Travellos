import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes.js';
import InfoRoutes from './routes/user.routes.js';
import questRoutes from './routes/quests.routes.js';
import './config/dotenv.js';

const app = express();

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

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

app.use(express.json());
app.use(cookieParser());


mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('Connected to Database Successfully ! '))
    .catch((err) => console.error(err));

app.use('/api/auth', authRoutes);
app.use('/api/user', InfoRoutes);
app.use('/api/quests', questRoutes);

app.get("/",(req,res)=>{
    res.send("Testing")
})

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));