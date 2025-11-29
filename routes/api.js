const express = require('express');
const router = express.Router();

// Statistiques globales
router.get('/stats', (req, res) => {
    try {
        const stats = global.botManager ? global.botManager.getStats() : { totalBots: 0, connectedBots: 0, maxBots: 100 };
        
        res.json({
            totalBots: stats.totalBots,
            connectedBots: stats.connectedBots,
            maxBots: stats.maxBots,
            uptime: '99.9%',
            availability: '100%',
            serverTime: new Date(),
            systemStatus: 'operational'
        });
    } catch (error) {
        res.status(500).json({ 
            totalBots: 0,
            connectedBots: 0,
            maxBots: 100,
            uptime: '0%',
            availability: '0%',
            serverTime: new Date(),
            systemStatus: 'error'
        });
    }
});

// Health check
router.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0'
    });
});

// Maintenance mode
router.get('/maintenance', (req, res) => {
    res.json({
        maintenance: false,
        message: 'Système opérationnel',
        schedule: null
    });
});

module.exports = router;
