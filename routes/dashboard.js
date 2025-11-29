const express = require('express');
const router = express.Router();

// Middleware d'authentification
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Non authentifié' });
    }
    next();
};

// Page dashboard
router.get('/', requireAuth, (req, res) => {
    res.json({ success: true, message: 'Bienvenue sur le dashboard' });
});

// Statistiques du bot
router.get('/stats', requireAuth, (req, res) => {
    try {
        const botStatus = global.botManager.getBotStatus(req.session.userId);
        const stats = global.botManager.getStats();
        
        res.json({
            success: true,
            stats: {
                user: {
                    status: botStatus.status,
                    phoneNumber: botStatus.phoneNumber,
                    connected: botStatus.exists && botStatus.status === 'connected'
                },
                global: stats,
                system: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    timestamp: new Date()
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Logs du bot
router.get('/logs', requireAuth, (req, res) => {
    try {
        // Simuler des logs (à remplacer par une vraie source)
        const logs = [
            { timestamp: new Date(), message: 'Bot initialisé', type: 'info' },
            { timestamp: new Date(), message: 'Connexion WhatsApp établie', type: 'success' },
            { timestamp: new Date(), message: 'Message reçu de +336...', type: 'message' }
        ];
        
        res.json({ success: true, logs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Commandes du bot
router.get('/commands', requireAuth, (req, res) => {
    const commands = {
        'ping': { description: 'Teste la connectivité', usage: '!ping' },
        'help': { description: 'Affiche l\'aide', usage: '!help' },
        'status': { description: 'Statut du bot', usage: '!status' },
        'menu': { description: 'Affiche le menu', usage: '!menu' }
    };
    
    res.json({ success: true, commands });
});

module.exports = router;
