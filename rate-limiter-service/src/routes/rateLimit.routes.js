import express from 'express';
import { checkRateLimit } from '../controllers/rateLimit.controller.js';

const router = express.Router();

router.post('/check', checkRateLimit);

export default router;