// Application principale Crazy-mini - Page d'accueil

class CrazyMiniApp {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.connectionInterval = null;
        this.statsInterval = null;
        this.init();
    }

    async init() {
        try {
            await this.initializeSocket();
            this.bindEvents();
            this.loadRealTimeStats();
            this.checkExistingSession();
            this.setupServiceWorker();
        } catch (error) {
            console.error('Erreur initialisation app:', error);
            Utils.showNotification('Erreur de connexion au serveur', 'error');
        }
    }

    async initializeSocket() {
        this.socket = io({
            transports: ['websocket', 'polling'],
            timeout: 10000
        });

        return new Promise((resolve, reject) => {
            this.socket.on('connect', () => {
                console.log('✅ Connecté au serveur Socket.io');
                resolve();
            });

            this.socket.on('connect_error', (error) => {
                console.error('❌ Erreur connexion Socket.io:', error);
                reject(error);
            });

            // Timeout après 10 secondes
            setTimeout(() => {
                reject(new Error('Timeout connexion Socket.io'));
            }, 10000);
        });
    }

    bindEvents() {
        const connectForm = document.getElementById('connect-form');
        const phoneInput = document.getElementById('phone');
        
        if (connectForm) {
            connectForm.addEventListener('submit', (e) => this.handleConnect(e));
        }

        if (phoneInput) {
            // Formatage automatique du numéro
            phoneInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length > 0) {
                    value = value.match(/.{1,2}/g).join(' ');
                }
                e.target.value = value;
            });

            // Validation en temps réel
            phoneInput.addEventListener('blur', (e) => {
                this.validatePhoneNumber(e.target.value);
            });
        }

        // Gestionnaire pour copier le pairing code
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('copy-pairing-code')) {
                this.copyPairingCode();
            }
        });
    }

    validatePhoneNumber(phone) {
        const cleaned = Utils.formatPhoneNumber(phone);
        const isValid = Utils.validatePhone(cleaned);
        const phoneInput = document.getElementById('phone');
        
        if (phoneInput) {
            if (phone && !isValid) {
                phoneInput.classList.add('border-red-500');
                phoneInput.classList.remove('border-green-500');
            } else if (phone && isValid) {
                phoneInput.classList.remove('border-red-500');
                phoneInput.classList.add('border-green-500');
            } else {
                phoneInput.classList.remove('border-red-500', 'border-green-500');
            }
        }
        
        return isValid;
    }

    async handleConnect(e) {
        e.preventDefault();
        
        if (!await Utils.checkOnlineStatus()) {
            return;
        }

        const phoneInput = document.getElementById('phone');
        const connectBtn = document.getElementById('connect-btn');
        const phone = phoneInput.value.trim();

        if (!this.validatePhoneNumber(phone)) {
            Utils.showNotification('Numéro de téléphone invalide', 'error');
            phoneInput.focus();
            return;
        }

        // Afficher le loading
        const originalText = connectBtn.innerHTML;
        connectBtn.innerHTML = '<div class="loading-spinner mr-2"></div> Génération du code...';
        connectBtn.disabled = true;

        try {
            const response = await fetch('/api/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ phone: Utils.formatPhoneNumber(phone) })
            });

            const data = await response.json();

            if (data.success) {
                this.userId = data.userId;
                this.showConnectionStatus(data);
                this.startConnectionMonitoring();
            } else {
                Utils.showNotification(data.message, 'error');
            }
        } catch (error) {
            console.error('Erreur connexion:', error);
            Utils.showNotification('Erreur de connexion au serveur', 'error');
        } finally {
            connectBtn.innerHTML = originalText;
            connectBtn.disabled = false;
        }
    }

    showConnectionStatus(data) {
        const statusDiv = document.getElementById('connection-status');
        const pairingContainer = document.getElementById('pairing-code-container');
        const pairingCode = document.getElementById('pairing-code');
        const statusMessage = document.getElementById('status-message');
        const progressBar = document.getElementById('progress-bar');

        if (!statusDiv) return;

        statusDiv.classList.remove('hidden');
        pairingContainer.classList.remove('hidden');
        
        pairingCode.textContent = data.pairingCode;
        statusMessage.innerHTML = `
            <div class="text-sm text-gray-600 mb-2">
                Utilisez ce code dans WhatsApp > Paramètres > Appareils connectés > Connecter un appareil
            </div>
            <button class="copy-pairing-code bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs transition duration-200">
                <i class="fas fa-copy mr-1"></i>Copier le code
            </button>
        `;
        
        // Animation de progression
        this.animateProgressBar(progressBar);
        
        // Afficher les instructions
        this.showConnectionInstructions();
    }

    animateProgressBar(progressBar) {
        let progress = 0;
        const interval = setInterval(() => {
            progress += 1;
            if (progressBar) {
                progressBar.style.width = `${progress}%`;
            }
            
            if (progress >= 100) {
                clearInterval(interval);
                this.checkSessionConfirmation();
            }
        }, 300);
    }

    showConnectionInstructions() {
        const instructions = `
            <div class="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 class="font-semibold text-blue-800 mb-2">Instructions de connexion:</h4>
                <ol class="list-decimal list-inside text-sm text-blue-700 space-y-1">
                    <li>Ouvrez WhatsApp sur votre téléphone</li>
                    <li>Allez dans Paramètres → Appareils connectés</li>
                    <li>Cliquez sur "Connecter un appareil"</li>
                    <li>Scannez le QR code ou entrez le code de pairing</li>
                    <li>Attendez la confirmation de connexion</li>
                </ol>
            </div>
        `;
        
        const statusMessage = document.getElementById('status-message');
        if (statusMessage) {
            statusMessage.insertAdjacentHTML('beforeend', instructions);
        }
    }

    startConnectionMonitoring() {
        if (this.connectionInterval) {
            clearInterval(this.connectionInterval);
        }

        this.connectionInterval = setInterval(() => {
            this.checkSessionConfirmation();
        }, 5000);
    }

    async checkSessionConfirmation() {
        if (!this.userId) return;

        try {
            const response = await fetch('/api/confirm-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: this.userId })
            });

            const data = await response.json();
            
            if (data.success) {
                if (this.connectionInterval) {
                    clearInterval(this.connectionInterval);
                }
                
                Utils.showNotification('✅ Bot connecté avec succès! Redirection...', 'success');
                
                setTimeout(() => {
                    window.location.href = data.redirect;
                }, 2000);
            }
        } catch (error) {
            console.error('Erreur vérification session:', error);
        }
    }

    async copyPairingCode() {
        const pairingCode = document.getElementById('pairing-code');
        if (pairingCode) {
            try {
                await Utils.copyToClipboard(pairingCode.textContent);
                Utils.showNotification('Code copié dans le presse-papier!', 'success');
            } catch (error) {
                Utils.showNotification('Erreur lors de la copie', 'error');
            }
        }
    }

    loadRealTimeStats() {
        // Charger les stats initiales
        this.updateStats();

        // Mettre à jour les stats toutes les 10 secondes
        this.statsInterval = setInterval(() => {
            this.updateStats();
        }, 10000);

        // Écouter les mises à jour en temps réel via Socket.io
        if (this.socket) {
            this.socket.on('stats-update', (stats) => {
                this.displayStats(stats);
            });
        }
    }

    async updateStats() {
        try {
            const response = await fetch('/api/stats');
            const stats = await response.json();
            this.displayStats(stats);
        } catch (error) {
            console.error('Erreur chargement stats:', error);
        }
    }

    displayStats(stats) {
        const botsCount = document.getElementById('bots-count');
        const uptime = document.getElementById('uptime');
        const availability = document.getElementById('availability');

        if (botsCount) botsCount.textContent = stats.totalBots || '0';
        if (uptime) uptime.textContent = stats.uptime || '100%';
        if (availability) availability.textContent = stats.availability || '100%';
    }

    async checkExistingSession() {
        try {
            const response = await fetch('/api/session-status');
            const data = await response.json();
            
            if (data.loggedIn && data.botStatus.exists) {
                // L'utilisateur a déjà une session active
                this.showExistingSessionAlert(data);
            }
        } catch (error) {
            console.error('Erreur vérification session:', error);
        }
    }

    showExistingSessionAlert(sessionData) {
        const alert = `
            <div class="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div class="flex items-center">
                    <i class="fas fa-info-circle text-yellow-600 mr-3"></i>
                    <div>
                        <h4 class="font-semibold text-yellow-800">Session active détectée</h4>
                        <p class="text-yellow-700 text-sm">
                            Vous avez déjà un bot connecté avec le numéro ${sessionData.phone}
                        </p>
                        <div class="mt-2">
                            <a href="/dashboard" class="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded text-sm transition duration-200">
                                Aller au dashboard
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const form = document.getElementById('connect-form');
        if (form) {
            form.insertAdjacentHTML('beforebegin', alert);
        }
    }

    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker enregistré:', registration);
                })
                .catch(error => {
                    console.log("Échec d'enregistrement du Service Worker:", error);
                });
        }
    }

    setupSocketListeners() {
        if (!this.socket) return;

        this.socket.on('qr-generated', (data) => {
            console.log('QR code généré:', data);
            // Implémenter l'affichage du QR code si nécessaire
        });

        this.socket.on('connection-status', (data) => {
            Utils.showNotification(data.message, 
                data.status === 'connected' ? 'success' : 
                data.status === 'reconnecting' ? 'warning' : 'error'
            );
        });

        this.socket.on('system-alert', (data) => {
            this.showSystemAlert(data);
        });

        this.socket.on('disconnect', () => {
            Utils.showNotification('Déconnecté du serveur', 'warning');
        });

        this.socket.on('reconnect', () => {
            Utils.showNotification('Reconnecté au serveur', 'success');
        });
    }

    showSystemAlert(alert) {
        const alertsContainer = document.getElementById('system-alerts');
        if (!alertsContainer) return;

        const alertElement = document.createElement('div');
        alertElement.className = `alert-${alert.type} mb-2 fade-in`;
        alertElement.innerHTML = `
            <div class="flex justify-between items-center">
                <div class="flex items-center">
                    <i class="fas fa-${this.getAlertIcon(alert.type)} mr-2"></i>
                    <span>${Utils.escapeHtml(alert.message)}</span>
                </div>
                <button class="ml-4 text-gray-500 hover:text-gray-700 close-alert">
                    &times;
                </button>
            </div>
        `;

        alertsContainer.appendChild(alertElement);

        // Gestionnaire de fermeture
        alertElement.querySelector('.close-alert').addEventListener('click', () => {
            alertElement.remove();
        });

        // Auto-suppression après 10 secondes pour les alertes info
        if (alert.type === 'info') {
            setTimeout(() => {
                if (alertElement.parentNode) {
                    alertElement.remove();
                }
            }, 10000);
        }
    }

    getAlertIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // Nettoyage
    destroy() {
        if (this.connectionInterval) {
            clearInterval(this.connectionInterval);
        }
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }
