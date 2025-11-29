class BotController {
    static async sendMessage(userId, jid, message) {
        try {
            const botData = global.botManager.activeBots.get(userId);
            if (!botData || !botData.isConnected) {
                throw new Error('Bot non connecté');
            }

            await botData.socket.sendMessage(jid, { text: message });
            return { success: true, message: 'Message envoyé' };
        } catch (error) {
            console.error('Erreur envoi message:', error);
            throw new Error('Erreur lors de l\'envoi du message');
        }
    }

    static async getBotInfo(userId) {
        const botData = global.botManager.activeBots.get(userId);
        if (!botData) {
            throw new Error('Bot non trouvé');
        }

        return {
            phoneNumber: botData.phoneNumber,
            isConnected: botData.isConnected,
            connectionTime: botData.connectionTime,
            messagesProcessed: botData.messagesProcessed || 0
        };
    }

    static async updateBotSettings(userId, settings) {
        const botData = global.botManager.activeBots.get(userId);
        if (!botData) {
            throw new Error('Bot non trouvé');
        }

        // Mettre à jour les settings (à implémenter selon les besoins)
        botData.settings = { ...botData.settings, ...settings };
        return { success: true, message: 'Paramètres mis à jour' };
    }
}

module.exports = BotController;
