const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Middleware pour vérifier l'authentification
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Non authentifié' });
    }
    next();
};

// Générer un ID utilisateur sans uuid
function generateUserId() {
    return `user_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

// Informations du bot
router.get('/info', requireAuth, async (req, res) => {
    try {
        const botStatus = global.botManager.getBotStatus(req.session.userId);
        
        res.json({ 
            success: true, 
            botInfo: {
                phoneNumber: botStatus.phoneNumber,
                isConnected: botStatus.status === 'connected',
                connectionTime: botStatus.connectionTime,
                messagesProcessed: botStatus.messagesProcessed || 0,
                status: botStatus.status
            }
        });
    } catch (error) {
        console.error('Erreur récupération info bot:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la récupération des informations du bot' 
        });
    }
});

// Paramètres du bot
router.post('/settings', requireAuth, async (req, res) => {
    try {
        const { prefix, mode, welcomeMessage, autoReply } = req.body;
        
        // Valider les paramètres
        if (prefix && prefix.length > 3) {
            return res.status(400).json({ 
                success: false, 
                message: 'Le préfixe ne peut pas dépasser 3 caractères' 
            });
        }

        if (mode && !['public', 'private'].includes(mode)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Mode invalide. Utilisez "public" ou "private"' 
            });
        }

        // Sauvegarder les paramètres (simulation)
        const settings = {
            prefix: prefix || '!',
            mode: mode || 'public',
            welcomeMessage: welcomeMessage || 'Bienvenue !',
            autoReply: autoReply !== undefined ? autoReply : true,
            updatedAt: new Date()
        };

        // Ici, vous devriez sauvegarder dans une base de données
        console.log('Paramètres sauvegardés pour', req.session.userId, settings);

        res.json({ 
            success: true, 
            message: 'Paramètres sauvegardés avec succès',
            settings 
        });
    } catch (error) {
        console.error('Erreur sauvegarde paramètres:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la sauvegarde des paramètres' 
        });
    }
});

// Activer/désactiver plugin
router.post('/toggle-plugin', requireAuth, async (req, res) => {
    try {
        const { plugin, enabled } = req.body;

        if (!plugin) {
            return res.status(400).json({ 
                success: false, 
                message: 'Nom du plugin requis' 
            });
        }

        // Liste des plugins disponibles
        const availablePlugins = ['ping', 'help', 'menu', 'status', 'welcome'];
        
        if (!availablePlugins.includes(plugin)) {
            return res.status(400).json({ 
                success: false, 
                message: `Plugin non reconnu. Plugins disponibles: ${availablePlugins.join(', ')}` 
            });
        }

        // Sauvegarder l'état du plugin (simulation)
        console.log(`Plugin ${plugin} ${enabled ? 'activé' : 'désactivé'} pour`, req.session.userId);

        res.json({ 
            success: true, 
            message: `Plugin ${plugin} ${enabled ? 'activé' : 'désactivé'} avec succès`,
            plugin,
            enabled
        });
    } catch (error) {
        console.error('Erreur toggle plugin:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la modification du plugin' 
        });
    }
});

// Envoyer un message via le bot
router.post('/send-message', requireAuth, async (req, res) => {
    try {
        const { jid, message } = req.body;

        if (!jid || !message) {
            return res.status(400).json({ 
                success: false, 
                message: 'JID et message requis' 
            });
        }

        if (message.length > 1000) {
            return res.status(400).json({ 
                success: false, 
                message: 'Le message ne peut pas dépasser 1000 caractères' 
            });
        }

        const botData = global.botManager.activeBots.get(req.session.userId);
        
        if (!botData || !botData.isConnected) {
            return res.status(400).json({ 
                success: false, 
                message: 'Bot non connecté' 
            });
        }

        // Envoyer le message via WhatsApp
        await botData.socket.sendMessage(jid, { text: message });

        // Émettre un événement socket pour le log
        if (global.io) {
            global.io.to(`user-${req.session.userId}`).emit('bot-log', {
                message: `Message envoyé à ${jid}: ${message.substring(0, 50)}...`,
                type: 'info',
                timestamp: new Date()
            });
        }

        res.json({ 
            success: true, 
            message: 'Message envoyé avec succès',
            jid,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Erreur envoi message:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de l\'envoi du message: ' + error.message 
        });
    }
});

// Statut de connexion du bot
router.get('/status', requireAuth, (req, res) => {
    try {
        const botStatus = global.botManager.getBotStatus(req.session.userId);
        
        res.json({ 
            success: true, 
            status: {
                status: botStatus.status,
                exists: botStatus.exists,
                phoneNumber: botStatus.phoneNumber,
                connectionTime: botStatus.connectionTime,
                messagesProcessed: botStatus.messagesProcessed || 0,
                uptime: botStatus.connectionTime ? 
                    Math.floor((new Date() - new Date(botStatus.connectionTime)) / 1000) : 0
            }
        });
    } catch (error) {
        console.error('Erreur statut bot:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la récupération du statut' 
        });
    }
});

// Redémarrer le bot
router.post('/restart', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const botData = global.botManager.activeBots.get(userId);
        
        if (botData && botData.socket) {
            botData.socket.end(null);
            global.botManager.activeBots.delete(userId);
        }
        
        // Émettre un log
        if (global.io) {
            global.io.to(`user-${userId}`).emit('bot-log', {
                message: 'Redémarrage du bot en cours...',
                type: 'warning',
                timestamp: new Date()
            });
        }

        // Recréer le bot après un court délai
        setTimeout(async () => {
            try {
                await global.botManager.createBot(userId, botData?.phoneNumber);
                
                if (global.io) {
                    global.io.to(`user-${userId}`).emit('bot-log', {
                        message: 'Bot redémarré avec succès',
                        type: 'success',
                        timestamp: new Date()
                    });
                }
            } catch (error) {
                console.error('Erreur recréation bot:', error);
                if (global.io) {
                    global.io.to(`user-${userId}`).emit('bot-log', {
                        message: `Erreur redémarrage: ${error.message}`,
                        type: 'error',
                        timestamp: new Date()
                    });
                }
            }
        }, 3000);

        res.json({ 
            success: true, 
            message: 'Redémarrage du bot en cours...' 
        });
    } catch (error) {
        console.error('Erreur redémarrage bot:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors du redémarrage du bot' 
        });
    }
});

// Déconnecter le bot
router.post('/disconnect', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const botData = global.botManager.activeBots.get(userId);
        
        if (botData && botData.socket) {
            botData.socket.end(null);
            global.botManager.activeBots.delete(userId);
            
            // Émettre un log
            if (global.io) {
                global.io.to(`user-${userId}`).emit('bot-log', {
                    message: 'Bot déconnecté',
                    type: 'info',
                    timestamp: new Date()
                });

                global.io.to(`user-${userId}`).emit('connection-status', {
                    status: 'disconnected',
                    message: 'Bot déconnecté manuellement'
                });
            }
        }

        res.json({ 
            success: true, 
            message: 'Bot déconnecté avec succès' 
        });
    } catch (error) {
        console.error('Erreur déconnexion bot:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la déconnexion du bot' 
        });
    }
});

// Liste des commandes disponibles
router.get('/commands', requireAuth, (req, res) => {
    const commands = {
        'ping': { 
            description: 'Teste la connectivité du bot', 
            usage: '!ping',
            category: 'Utilitaire'
        },
        'help': { 
            description: 'Affiche l\'aide des commandes', 
            usage: '!help',
            category: 'Utilitaire'
        },
        'status': { 
            description: 'Affiche le statut du bot', 
            usage: '!status',
            category: 'Utilitaire'
        },
        'menu': { 
            description: 'Affiche le menu principal', 
            usage: '!menu',
            category: 'Principal'
        },
        'info': { 
            description: 'Informations sur le bot', 
            usage: '!info',
            category: 'Informations'
        },
        'time': { 
            description: 'Affiche l\'heure actuelle', 
            usage: '!time',
            category: 'Utilitaire'
        }
    };

    res.json({ 
        success: true, 
        commands,
        count: Object.keys(commands).length
    });
});

// Statistiques du bot
router.get('/stats', requireAuth, (req, res) => {
    try {
        const botStatus = global.botManager.getBotStatus(req.session.userId);
        const globalStats = global.botManager.getStats();
        
        const stats = {
            user: {
                status: botStatus.status,
                phoneNumber: botStatus.phoneNumber,
                messagesProcessed: botStatus.messagesProcessed || 0,
                connectionTime: botStatus.connectionTime,
                uptime: botStatus.connectionTime ? 
                    Math.floor((new Date() - new Date(botStatus.connectionTime)) / 1000) : 0
            },
            global: {
                totalBots: globalStats.totalBots,
                connectedBots: globalStats.connectedBots,
                maxBots: globalStats.maxBots,
                usagePercentage: globalStats.usagePercentage
            },
            system: {
                timestamp: new Date(),
                serverTime: new Date().toISOString()
            }
        };

        res.json({ success: true, stats });
    } catch (error) {
        console.error('Erreur stats bot:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la récupération des statistiques' 
        });
    }
});

module.exports = router;
