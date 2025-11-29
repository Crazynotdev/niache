// Dashboard Crazy-mini - Gestion du bot

class Dashboard {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.botStatus = null;
        this.logs = [];
        this.statsInterval = null;
        this.init();
    }

    async init() {
        try {
            await this.checkAuthentication();
            await this.initializeSocket();
            this.initializeDashboard();
            this.loadBotData();
            this.setupRealTimeUpdates();
        } catch (error) {
            console.error('Erreur initialisation dashboard:', error);
            this.handleInitializationError(error);
        }
    }

    async checkAuthentication() {
        try {
            const response = await fetch('/api/session-status');
            const data = await response.json();
            
            if (!data.loggedIn) {
                window.location.href = '/';
                return;
            }

            this.userId = data.userId;
            this.botStatus = data.botStatus;
        } catch (error) {
            console.error('Erreur vérification authentification:', error);
            window.location.href = '/';
        }
    }

    async initializeSocket() {
        this.socket = io({
            transports: ['websocket', 'polling'],
            timeout: 10000
        });

        return new Promise((resolve, reject) => {
            this.socket.on('connect', () => {
                console.log('✅ Dashboard connecté au serveur');
                this.socket.emit('join-dashboard', this.userId);
                resolve();
            });

            this.socket.on('connect_error', (error) => {
                console.error('❌ Erreur connexion dashboard:', error);
                reject(error);
            });

            setTimeout(() => {
                reject(new Error('Timeout connexion dashboard'));
            }, 10000);
        });
    }

    initializeDashboard() {
        this.bindEvents();
        this.initializeNavigation();
        this.updateConnectionStatus();
        this.startStatsMonitoring();
    }

    bindEvents() {
        // Déconnexion
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Sauvegarde des paramètres
        const saveSettingsBtn = document.getElementById('save-settings');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        }

        // Effacer les logs
        const clearLogsBtn = document.getElementById('clear-logs');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => this.clearLogs());
        }

        // Gestion des plugins
        this.initializePluginToggles();
    }

    initializeNavigation() {
        const navItems = document.querySelectorAll('.sidebar-nav-item');
        const sections = document.querySelectorAll('.dashboard-section');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Retirer la classe active de tous les items
                navItems.forEach(nav => nav.classList.remove('active'));
                // Ajouter la classe active à l'item cliqué
                item.classList.add('active');

                // Masquer toutes les sections
                sections.forEach(section => section.classList.remove('active'));
                
                // Afficher la section correspondante
                const targetId = item.getAttribute('href').substring(1);
                const targetSection = document.getElementById(targetId);
                if (targetSection) {
                    targetSection.classList.add('active');
                }
            });
        });
    }

    async loadBotData() {
        try {
            const response = await fetch('/api/bot/info');
            const data = await response.json();
            
            if (data.success) {
                this.updateBotInfo(data.botInfo);
            }
        } catch (error) {
            console.error('Erreur chargement données bot:', error);
        }
    }

    updateBotInfo(botInfo) {
        const botStatusElement = document.getElementById('bot-status');
        const userPhoneElement = document.getElementById('user-phone');
        const messagesCountElement = document.getElementById('messages-count');
        const uptimeElement = document.getElementById('uptime');

        if (botStatusElement) {
            botStatusElement.textContent = botInfo.isConnected ? 'Connecté' : 'Déconnecté';
            botStatusElement.className = `text-2xl font-bold ${
                botInfo.isConnected ? 'text-green-600' : 'text-red-600'
            }`;
        }

        if (userPhoneElement) {
            userPhoneElement.textContent = botInfo.phoneNumber || 'Non connecté';
        }

        if (messagesCountElement) {
            messagesCountElement.textContent = botInfo.messagesProcessed || '0';
        }

        if (uptimeElement && botInfo.connectionTime) {
            this.updateUptime(botInfo.connectionTime, uptimeElement);
        }
    }

    updateUptime(connectionTime, element) {
        const update = () => {
            const now = new Date();
            const connection = new Date(connectionTime);
            const uptime = Math.floor((now - connection) / 1000);
            element.textContent = Utils.formatUptime(uptime);
        };

        update();
        setInterval(update, 60000); // Mettre à jour toutes les minutes
    }

    setupRealTimeUpdates() {
        if (!this.socket) return;

        // Statut de connexion
        this.socket.on('connection-status', (data) => {
            this.updateConnectionStatus(data);
            this.addLog(`Statut connexion: ${data.message}`, data.status);
        });

        // Nouveaux messages
        this.socket.on('new-message', (data) => {
            this.handleNewMessage(data);
        });

        // Logs en temps réel
        this.socket.on('bot-log', (log) => {
            this.addLog(log.message, log.type);
        });

        // Mises à jour des stats
        this.socket.on('stats-update', (stats) => {
            this.updateStats(stats);
        });
    }

    updateConnectionStatus(statusData) {
        const statusBadge = document.getElementById('connection-status-badge');
        if (!statusBadge) return;

        const statusConfig = {
            'connected': { class: 'bg-green-100 text-green-800', icon: 'fa-check-circle', text: 'Connecté' },
            'connecting': { class: 'bg-yellow-100 text-yellow-800', icon: 'fa-sync-alt', text: 'Connexion...' },
            'reconnecting': { class: 'bg-yellow-100 text-yellow-800', icon: 'fa-redo-alt', text: 'Reconnexion...' },
            'disconnected': { class: 'bg-red-100 text-red-800', icon: 'fa-times-circle', text: 'Déconnecté' }
        };

        const config = statusConfig[statusData.status] || statusConfig.connecting;

        statusBadge.className = `px-3 py-1 rounded-full text-sm font-medium ${config.class}`;
        statusBadge.innerHTML = `<i class="fas ${config.icon} mr-1"></i> ${config.text}`;

        // Mettre à jour les informations du bot
        if (this.botStatus) {
            this.botStatus.status = statusData.status;
            this.updateBotInfo(this.botStatus);
        }
    }

    handleNewMessage(messageData) {
        this.addLog(`Message de ${messageData.from}: ${messageData.message}`, 'message');
        
        // Mettre à jour le compteur de messages
        const messagesCount = document.getElementById('messages-count');
        if (messagesCount) {
            const current = parseInt(messagesCount.textContent) || 0;
            messagesCount.textContent = current + 1;
        }
    }

    addLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString('fr-FR');
        const logEntry = {
            timestamp,
            message,
            type,
            id: Utils.generateRandomId()
        };

        this.logs.unshift(logEntry);
        
        // Garder seulement les 100 derniers logs
        if (this.logs.length > 100) {
            this.logs = this.logs.slice(0, 100);
        }

        this.updateLogsDisplay();
    }

    updateLogsDisplay() {
        const realtimeLogs = document.getElementById('realtime-logs');
        const detailedLogs = document.getElementById('detailed-logs');

        this.updateLogsContainer(realtimeLogs, 10);
        this.updateLogsContainer(detailedLogs, 100);
    }

    updateLogsContainer(container, maxLines) {
        if (!container) return;

        const logsToShow = this.logs.slice(0, maxLines);
        
        container.innerHTML = logsToShow.map(log => `
            <div class="log-entry mb-1 ${this.getLogColor(log.type)}">
                <span class="text-gray-500 text-xs">[${log.timestamp}]</span>
                <span class="ml-2">${Utils.escapeHtml(log.message)}</span>
            </div>
        `).join('');

        // Auto-scroll vers le bas pour les nouveaux logs
        if (container.scrollTop === 0 || container.scrollHeight - container.clientHeight - container.scrollTop < 100) {
            container.scrollTop = container.scrollHeight;
        }
    }

    getLogColor(type) {
        const colors = {
            'info': 'text-blue-600',
            'success': 'text-green-600',
            'warning': 'text-yellow-600',
            'error': 'text-red-600',
            'message': 'text-purple-600'
        };
        return colors[type] || 'text-gray-600';
    }

    initializePluginToggles() {
        const toggles = document.querySelectorAll('input[type="checkbox"]');
        toggles.forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                this.togglePlugin(e.target);
            });
        });
    }

    async togglePlugin(checkbox) {
        const pluginName = checkbox.closest('.bg-white').querySelector('h4').textContent;
        const isEnabled = checkbox.checked;

        try {
            const response = await fetch('/api/bot/toggle-plugin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    plugin: pluginName,
                    enabled: isEnabled
                })
            });

            const data = await response.json();
            
            if (data.success) {
                Utils.showNotification(
                    `Plugin ${pluginName} ${isEnabled ? 'activé' : 'désactivé'}`,
                    'success'
                );
                this.addLog(`Plugin ${pluginName} ${isEnabled ? 'activé' : 'désactivé'}`, 'info');
            } else {
                checkbox.checked = !isEnabled; // Revert the toggle
                Utils.showNotification('Erreur modification plugin', 'error');
            }
        } catch (error) {
            console.error('Erreur toggle plugin:', error);
            checkbox.checked = !isEnabled; // Revert the toggle
            Utils.showNotification('Erreur de connexion', 'error');
        }
    }

    async saveSettings() {
        const prefix = document.getElementById('command-prefix').value;
        const mode = document.getElementById('bot-mode').value;

        try {
            const response = await fetch('/api/bot/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prefix,
                    mode
                })
            });

            const data = await response.json();
            
            if (data.success) {
                Utils.showNotification('Paramètres sauvegardés avec succès', 'success');
                this.addLog('Paramètres mis à jour', 'success');
            } else {
                Utils.showNotification('Erreur sauvegarde paramètres', 'error');
            }
        } catch (error) {
            console.error('Erreur sauvegarde settings:', error);
            Utils.showNotification('Erreur de connexion', 'error');
        }
    }

    clearLogs() {
        this.logs = [];
        this.updateLogsDisplay();
        Utils.showNotification('Logs effacés', 'success');
    }

    startStatsMonitoring() {
        this.statsInterval = setInterval(() => {
            this.loadBotData();
        }, 30000); // Toutes les 30 secondes
    }

    async handleLogout() {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            
            if (data.success) {
                Utils.showNotification('Déconnexion réussie', 'success');
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            }
        } catch (error) {
            console.error('Erreur déconnexion:', error);
            Utils.showNotification('Erreur lors de la déconnexion', 'error');
        }
    }

    handleInitializationError(error) {
        const errorMessage = `
            <div class="p-6">
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div class="flex items-center">
                        <i class="fas fa-exclamation-triangle text-red-600 mr-3"></i>
                        <div>
                            <h3 class="font-semibold text-red-800">Erreur d'initialisation</h3>
                            <p class="text-red-700 text-sm mt-1">
                                Impossible de charger le dashboard. Veuillez rafraîchir la page.
                            </p>
                            <button onclick="window.location.reload()" class="mt-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm transition duration-200">
                                Rafraîchir la page
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const mainContent = document.querySelector('.flex-1');
        if (mainContent) {
            mainContent.innerHTML = errorMessage;
        }
    }

    // Nettoyage
    destroy() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// Initialiser le dashboard quand la page est chargée
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});

// Gérer la fermeture de la page
window.addEventListener('beforeunload', () => {
    if (window.dashboard) {
        window.dashboard.destroy();
    }
});
