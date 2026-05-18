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
        const seedProducts = [
            // Fashion
            { name: 'Casual Sneakers', description: 'Comfortable sneakers for daily wear', price: 1450, category: 'Fashion', rating: 4.5, stock: 50, imageUrl: '/Shoes.avif' },
            { name: 'Cotton T-Shirt', description: 'Soft cotton t-shirt', price: 750, category: 'Fashion', rating: 4.2, stock: 100, imageUrl: '/T shirt.avif' },
            { name: 'Home Slippers', description: 'Warm and cozy slippers', price: 399, category: 'Fashion', rating: 4.1, stock: 75, imageUrl: '/Slippers.avif' },
            { name: "Men's Perfume", description: 'Premium long-lasting fragrance', price: 3200, category: 'Fashion', rating: 4.7, stock: 30, imageUrl: '/Perfume.avif' },
            { name: 'Golden Star Hair Clips', description: 'Shiny hair clips for styling', price: 150, category: 'Fashion', rating: 4.6, stock: 120, imageUrl: '/Star Clips.jpg_.avif' },
            { name: 'Trending Summer Heels', description: 'Stylish summer heels', price: 2100, category: 'Fashion', rating: 4.4, stock: 40, imageUrl: '/Trending heels.avif' },
            { name: 'Sporty Running Shoes', description: 'Lightweight running shoes', price: 2450, category: 'Fashion', rating: 4.6, stock: 25, imageUrl: '/Shoes.avif' },
            { name: 'Casual V-Neck Tee', description: 'Premium v-neck t-shirt', price: 850, category: 'Fashion', rating: 4.3, stock: 80, imageUrl: '/T shirt.avif' },
            { name: 'Leather Sandals', description: 'Genuine leather sandals', price: 1800, category: 'Fashion', rating: 4.2, stock: 35, imageUrl: '/Slippers.avif' },

            // Electronics
            { name: 'Hair Straightener Pro', description: 'Ceramic hair straightener', price: 1800, category: 'Electronics', rating: 4.3, stock: 60, imageUrl: '/Hair Straightener.avif' },
            { name: 'Wireless Headphones', description: 'Over-ear wireless headphones', price: 4500, category: 'Electronics', rating: 4.8, stock: 20, imageUrl: '/Hair Straightener.avif' },
            { name: 'Smart Fitness Band', description: 'Waterproof fitness tracker', price: 2999, category: 'Electronics', rating: 4.4, stock: 45, imageUrl: '/Hair Straightener.avif' },
            { name: 'Portable Bluetooth Speaker', description: 'Powerful bass speaker', price: 3500, category: 'Electronics', rating: 4.5, stock: 30, imageUrl: '/Hair Straightener.avif' },
            { name: 'LED Desk Lamp', description: 'Dimmable eye-care desk lamp', price: 1200, category: 'Electronics', rating: 4.1, stock: 90, imageUrl: '/Hair Straightener.avif' },
            { name: 'USB-C Fast Charger', description: 'Dual-port fast wall charger', price: 950, category: 'Electronics', rating: 4.6, stock: 150, imageUrl: '/Hair Straightener.avif' },
            { name: 'Ergonomic Wireless Mouse', description: 'Silent click optical mouse', price: 1500, category: 'Electronics', rating: 4.3, stock: 85, imageUrl: '/Hair Straightener.avif' },
            { name: 'Mini Pocket Fan', description: 'Rechargeable handheld fan', price: 650, category: 'Electronics', rating: 4.2, stock: 110, imageUrl: '/Hair Straightener.avif' },
            { name: 'Stylus Touch Pen', description: 'High precision active stylus', price: 1350, category: 'Electronics', rating: 4.0, stock: 70, imageUrl: '/Hair Straightener.avif' },

            // Home
            { name: 'LOREAL Shampoo Pack', description: 'Nourishing shampoo set', price: 850, category: 'Home', rating: 4.0, stock: 95, imageUrl: '/Shampoo.avif' },
            { name: 'Dove Moisturizing Shampoo', description: 'Gentle moisture shampoo', price: 650, category: 'Home', rating: 4.2, stock: 85, imageUrl: '/Shampo2.avif' },
            { name: 'Scented Candle Set', description: 'Lavender and vanilla candles', price: 1100, category: 'Home', rating: 4.5, stock: 50, imageUrl: '/Perfume.avif' },
            { name: 'Decorative Floor Mat', description: 'Soft anti-slip mat', price: 499, category: 'Home', rating: 4.2, stock: 65, imageUrl: '/Slippers.avif' },
            { name: 'Wall Hanging Organizer', description: 'Multi-pocket fabric organizer', price: 899, category: 'Home', rating: 4.3, stock: 40, imageUrl: '/Star Clips.jpg_.avif' },
            { name: 'Premium Hair Serum', description: 'Smooth shine hair serum', price: 1250, category: 'Home', rating: 4.4, stock: 55, imageUrl: '/Shampoo.avif' },
            { name: 'Gentle Care Conditioner', description: 'Deep conditioning formula', price: 700, category: 'Home', rating: 4.1, stock: 70, imageUrl: '/Shampo2.avif' },
            { name: 'Aroma Diffuser', description: 'Ultrasonic cool mist humidifier', price: 2800, category: 'Home', rating: 4.6, stock: 35, imageUrl: '/Perfume.avif' },
            { name: 'Kitchen Organizer Rack', description: 'Stainless steel dish rack', price: 1999, category: 'Home', rating: 4.4, stock: 25, imageUrl: '/Slippers.avif' }
        ];
        await Product.insertMany(seedProducts);
        console.log('Seeded database with 27 highly realistic products using local assets.');
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

// Main Route - Dynamic Product Catalog
const getProductsCatalog = async (req, res) => {
    try {
        const { search, category, minPrice, maxPrice, page = 1 } = req.query;
        
        let query = {};
        
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }
        
        if (category && category !== 'All') {
            query.category = category;
        }
        
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }

        const limit = 8;
        const skip = (Number(page) - 1) * limit;

        const products = await Product.find(query).skip(skip).limit(limit);
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit) || 1;

        res.render('homepage', {
            products,
            currentPage: Number(page),
            totalPages,
            search: search || '',
            category: category || 'All',
            minPrice: minPrice || '',
            maxPrice: maxPrice || ''
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

app.get('/', getProductsCatalog);
app.get('/products', getProductsCatalog);

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

// Start the server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running smoothly on http://localhost:${PORT}`);
    });
}

startServer().catch(err => console.error(err));