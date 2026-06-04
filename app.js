import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import morgan from 'morgan';
import config from './config/config.js';

import kuberRoutes from './routes/kuberRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import tokenRoutes from './routes/tokenRoutes.js';

const app = express();

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/kuber', kuberRoutes);
app.use('/webhook', webhookRoutes);
app.use('/token', tokenRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

export default app;