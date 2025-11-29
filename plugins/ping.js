class PingPlugin {
    constructor() {
        this.name = 'Ping';
        this.description = 'Répond pong aux messages !ping';
        this.version = '1.0.0';
        this.author = 'Crazy-mini';
        this.commands = {
            'ping': {
                description: 'Teste la connectivité du bot',
                usage: '!ping',
                handler: this.handlePing.bind(this)
            }
        };
    }

    async handlePing(bot, message) {
        const start = Date.now();
        await bot.socket.sendMessage(message.key.remoteJid, { 
            text: `🏓 Pong! - Latence: ${Date.now() - start}ms` 
        });
        
        return {
            processed: true,
            response: 'pong'
        };
    }
}

module.exports = PingPlugin;
