const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Stockage temporaire des sessions (à remplacer par Redis en production)
const pairingSessions = new Map();

router.post('/api/connect', async (req, res) => {
    try {
        const { phone } = req.body;
        
        if (!phone) {
            return res.status(400).json({ 
                success: false, 
                message: 'Le numéro de téléphone est requis' 
            });
        }

        // Validation du format du numéro
        const phoneRegex = /^[0-9]{10,15}$/;
        if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
            return res.status(400).json({
                success: false,
                message: 'Format de numéro invalide'
            });
        }

        const userId = uuidv4();
        
        // Générer le pairing code
        try {
            const pairingCode = await global.botManager.requestPairingCode(phone);
            
            // Stocker la session
            pairingSessions.set(userId, {
                phone,
                pairingCode,
                status: 'pending',
                createdAt: new Date()
            });

            // Nettoyer les anciennes sessions après 10 minutes
            setTimeout(() => {
                pairingSessions.delete(userId);
            }, 10 * 60 * 1000);

            res.json({
                success: true,
                userId,
                pairingCode,
                message: 'Code de pairing généré avec succès'
            });

        } catch (error) {
            console.error('Erreur génération pairing code:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la génération du code de pairing'
            });
        }

    } catch (error) {
        console.error('Erreur connexion:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

router.post('/api/confirm-session', async (req, res) => {
    try {
        const { userId } = req.body;
        
        const session = pairingSessions.get(userId);
        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session introuvable ou expirée'
            });
        }

        // Créer le bot avec le numéro de téléphone
        await global.botManager.createBot(userId, session.phone);
        
        // Mettre à jour la session utilisateur
        req.session.userId = userId;
        req.session.phone = session.phone;

        // Nettoyer la session temporaire
        pairingSessions.delete(userId);

        res.json({
            success: true,
            message: 'Session confirmée avec succès',
            redirect: '/dashboard'
        });

    } catch (error) {
        console.error('Erreur confirmation session:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erreur lors de la confirmation de la session'
        });
    }
});

router.get('/api/session-status', (req, res) => {
    if (!req.session.userId) {
        return res.json({ loggedIn: false });
    }
    
    const botStatus = global.botManager.getBotStatus(req.session.userId);
    res.json({
        loggedIn: true,
        userId: req.session.userId,
        phone: req.session.phone,
        botStatus
    });
});

router.post('/api/logout', (req, res) => {
    const userId = req.session.userId;
    
    if (userId) {
        // Déconnecter le bot
        const botData = global.botManager.activeBots.get(userId);
        if (botData && botData.socket) {
            botData.socket.end(null);
        }
        global.botManager.activeBots.delete(userId);
    }

    req.session.destroy((err) => {
        if (err) {
            console.error('Erreur déconnexion:', err);
            return res.status(500).json({ success: false });
        }
        res.json({ success: true });
    });
});

module.exports = router;
