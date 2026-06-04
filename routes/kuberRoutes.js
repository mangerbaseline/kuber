import express from 'express';
import KuberController from '../controllers/kuberController.js';

const router = express.Router();

router.get('/Pay/:merchantId/:invoiceNo', KuberController.processPayment);

export default router;