require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo').default || require('connect-mongo').MongoStore;
const flash = require('connect-flash');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('./models/User');
const Product = require('./models/Product');
const { isLoggedIn, isAdmin } = require('./middleware/auth');
const apiRoutes = require('./routes/api');

const app = express();

async function startServer() {
    // Start In-Memory MongoDB Server
    const mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    console.log(`Started In-Memory MongoDB at ${mongoUri}`);

    // Connect to MongoDB
    await mongoose.connect(mongoUri);
    console.log('Connected to Mongoose');

    // Seed dummy products if empty
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
        await Product.insertMany([
            { name: 'Casual Sneakers', description: 'Comfortable sneakers', price: 1450, imageUrl: '/Shoes.avif' },
            { name: 'Cotton T-Shirt', description: 'Soft cotton t-shirt', price: 750, imageUrl: '/T shirt.avif' },
            { name: 'LOREAL Shampoo', description: 'Hair shampoo', price: 850, imageUrl: '/Shampoo.avif' }
        ]);
        console.log('Seeded database with dummy products');
    }

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session Configuration
app.use(session({
    secret: 'my_super_secret_key_123',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: mongoUri }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// Flash Messages
app.use(flash());

// Global Variables Middleware (for all views)
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currentUser = req.session.user || null;
    next();
});

// --- Routes ---

// Main Route
app.get('/', (req, res) => {
    res.render('homepage');
});

// Contact Route
app.get('/contact', (req, res) => {
    res.render('contact');
});

// Authentication Routes
app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            req.flash('error', 'Email is already registered.');
            return res.redirect('/register');
        }

        const newUser = new User({ name, email, password });
        await newUser.save();
        
        req.flash('success', 'Registration successful! Please login.');
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        req.flash('error', `An error occurred during registration: ${err.message}`);
        res.redirect('/register');
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }

        // Set session
        req.session.userId = user._id;
        req.session.userRole = user.role;
        req.session.user = { id: user._id, name: user.name, role: user.role };

        req.flash('success', `Welcome back, ${user.name}!`);
        res.redirect('/');
    } catch (err) {
        console.error(err);
        req.flash('error', 'An error occurred during login.');
        res.redirect('/login');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
        }
        res.redirect('/');
    });
});

// Protected Routes
app.get('/checkout', isLoggedIn, (req, res) => {
    res.render('checkout');
});

app.get('/admin', isLoggedIn, isAdmin, (req, res) => {
    res.render('admin');
});

// Register API Routes
    app.use('/api/v1', apiRoutes);

// Start the server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running smoothly on http://localhost:${PORT}`);
    });
}

startServer().catch(err => console.error(err));