const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// Middlewares de sécurité
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// Configuration des sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'crazy-mini-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Routes
app.use('/', require('./routes/auth'));
app.use('/bot', require('./routes/bot'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/api', require('./routes/api'));

// Route pour servir les pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// Gestion des erreurs 404 - version simplifiée
app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>404 - Crazy-mini</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 min-h-screen flex items-center justify-center">
        <div class="text-center">
            <h1 class="text-6xl font-bold text-gray-800 mb-4">404</h1>
            <p class="text-xl text-gray-600 mb-8">Page non trouvée</p>
            <a href="/" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                Retour à l'accueil
            </a>
        </div>
    </body>
    </html>
  `);
});

module.exports = app;
