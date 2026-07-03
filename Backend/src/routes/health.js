import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/', (req, res) => {
    const states = ["connected", "connecting", "disconnected", "disconnecting"];
    
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        db: states[mongoose.connection.readyState] || "unknown",
        timestamp: new Date().toISOString(),
    })
})

export default router;