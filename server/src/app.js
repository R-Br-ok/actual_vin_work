import express from 'express';
import cors from 'cors';
import { ENV } from './config/env.js';
import healthRoutes from './routes/healthRoutes.js';
import roomRoutes from './routes/roomRoutes.js';

const app = express();

// Middlewares
app.use(cors({
  origin: ENV.CORS_ORIGIN,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (non-intrusive)
app.use((req, res, next) => {
  if (req.path !== '/health') {
    console.log(`[HTTP] ${req.method} ${req.path}`);
  }
  next();
});

// Mount Routes
app.use(healthRoutes);
app.use('/api', roomRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    service: 'Sync Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      rooms: '/api/rooms',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[HTTP] Server error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

export default app;
