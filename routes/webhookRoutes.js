import express from 'express';
import WebhookController from '../controllers/webhookController.js';

const router = express.Router();

router.post('/', WebhookController.handleWebhook);

export default router;