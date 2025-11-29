const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs').promises;

class BotManager {
    constructor(io) {
        this.io = io;
        this.activeBots = new Map();
        this.maxBots = 100;
        this.sessionsDir = path.join(__dirname, '..', 'sessions');
    }

    async initialize() {
        // Créer le dossier sessions s'il n'existe pas
        try {
            await fs.access(this.sessionsDir);
        } catch {
            await fs.mkdir(this.sessionsDir, { recursive: true });
        }
        console.log('🤖 Bot Manager initialisé');
    }

    async createBot(userId, phoneNumber) {
        if (this.activeBots.size >= this.maxBots) {
            throw new Error('Limite de bots connectés atteinte (100 maximum)');
        }

        if (this.activeBots.has(userId)) {
            throw new Error('Un bot est déjà connecté pour cet utilisateur');
        }

        const sessionPath = path.join(this.sessionsDir, userId);
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Chrome'),
            logger: {
                level: 'silent'
            }
        });

        const botData = {
            socket: sock,
            userId,
            phoneNumber,
            isConnected: false,
            saveCreds,
            sessionPath
        };

        this.setupEventHandlers(botData);
        this.activeBots.set(userId, botData);

        return botData;
    }

    setupEventHandlers(botData) {
        const { socket, userId, saveCreds } = botData;

        socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, isNewLogin } = update;

            if (qr) {
                this.io.to(`user-${userId}`).emit('qr-generated', { qr });
            }

            if (connection === 'open') {
                botData.isConnected = true;
                console.log(`✅ Bot connecté pour l'utilisateur ${userId}`);
                
                this.io.to(`user-${userId}`).emit('connection-status', {
                    status: 'connected',
                    message: 'Bot connecté avec succès!'
                });
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    console.log(`🔄 Reconnexion du bot pour ${userId}`);
                    this.io.to(`user-${userId}`).emit('connection-status', {
                        status: 'reconnecting',
                        message: 'Reconnexion en cours...'
                    });
                    
                    // Tentative de reconnexion après 5 secondes
                    setTimeout(() => {
                        this.reconnectBot(userId);
                    }, 5000);
                } else {
                    console.log(`❌ Bot déconnecté pour ${userId}`);
                    this.io.to(`user-${userId}`).emit('connection-status', {
                        status: 'disconnected',
                        message: 'Bot déconnecté'
                    });
                    this.activeBots.delete(userId);
                }
            }
        });

        socket.ev.on('creds.update', saveCreds);
        socket.ev.on('messages.upsert', (m) => {
            this.handleIncomingMessage(m, botData);
        });
    }

    async requestPairingCode(phoneNumber) {
        try {
            const { state, saveCreds } = await useMultiFileAuthState('temp_session');
            
            const sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                browser: Browsers.ubuntu('Chrome')
            });

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout lors de la génération du pairing code'));
                }, 30000);

                sock.ev.on('connection.update', (update) => {
                    const { connection, qr, pairingCode } = update;
                    
                    if (pairingCode) {
                        clearTimeout(timeout);
                        resolve(pairingCode);
                        sock.end(null);
                    }
                    
                    if (connection === 'close') {
                        clearTimeout(timeout);
                        reject(new Error('Connexion fermée'));
                    }
                });
            });
        } catch (error) {
            throw new Error(`Erreur génération pairing code: ${error.message}`);
        }
    }

    async reconnectBot(userId) {
        const botData = this.activeBots.get(userId);
        if (!botData) return;

        try {
            const { state, saveCreds } = await useMultiFileAuthState(botData.sessionPath);
            
            const newSock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                browser: Browsers.ubuntu('Chrome')
            });

            botData.socket = newSock;
            this.setupEventHandlers(botData);
            
        } catch (error) {
            console.error(`❌ Erreur reconnexion bot ${userId}:`, error);
            this.activeBots.delete(userId);
        }
    }

    handleIncomingMessage(m, botData) {
        // Logique de traitement des messages entrants
        const message = m.messages[0];
        if (!message.message || message.key.fromMe) return;

        console.log(`📨 Message reçu de ${message.key.remoteJid} pour l'utilisateur ${botData.userId}`);
        
        // Émettre le message au dashboard de l'utilisateur
        this.io.to(`user-${botData.userId}`).emit('new-message', {
            from: message.key.remoteJid,
            message: message.message.conversation || Object.values(message.message)[0]?.text,
            timestamp: new Date()
        });
    }

    getBotStatus(userId) {
        const botData = this.activeBots.get(userId);
        if (!botData) {
            return { status: 'disconnected', exists: false };
        }
        return {
            status: botData.isConnected ? 'connected' : 'connecting',
            exists: true,
            phoneNumber: botData.phoneNumber
        };
    }

    getStats() {
        return {
            totalBots: this.activeBots.size,
            maxBots: this.maxBots,
            connectedBots: Array.from(this.activeBots.values()).filter(bot => bot.isConnected).length
        };
    }
}

function initializeBotManager(io) {
    const manager = new BotManager(io);
    manager.initialize();
    return manager;
}

module.exports = { BotManager, initializeBotManager };
