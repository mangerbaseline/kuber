import express from 'express';
import TokenController from '../controllers/tokenController.js';

const router = express.Router();

router.get('/refresh', TokenController.refreshToken);

export default router;