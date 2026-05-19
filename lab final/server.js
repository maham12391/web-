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
const Order = require('./models/Order');
const { isLoggedIn, isAdmin } = require('./middleware/auth');
const apiRoutes = require('./routes/api');
const expressLayouts = require('express-ejs-layouts');

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

    // Seed default Admin User if no users exist
    const userCount = await User.countDocuments();
    let adminUser;
    if (userCount === 0) {
        adminUser = new User({
            name: 'Daraz Admin',
            email: 'admin@daraz.com',
            password: 'admin123',
            role: 'admin'
        });
        await adminUser.save();
        console.log('Seeded database with default Admin User (admin@daraz.com / admin123)');
    } else {
        adminUser = await User.findOne({ email: 'admin@daraz.com' });
    }

    if (!adminUser) {
        adminUser = await User.findOne({ role: 'admin' }) || await User.findOne();
    }

    // Seed dummy orders if empty
    const orderCount = await Order.countDocuments();
    if (orderCount === 0 && adminUser) {
        const products = await Product.find({});
        if (products.length >= 3) {
            const ordersToSeed = [
                {
                    user: adminUser._id,
                    products: [
                        { product: products[0]._id, quantity: 2 },
                        { product: products[1]._id, quantity: 1 }
                    ],
                    totalAmount: (products[0].price * 2) + products[1].price,
                    status: 'delivered'
                },
                {
                    user: adminUser._id,
                    products: [
                        { product: products[1]._id, quantity: 3 },
                        { product: products[2]._id, quantity: 2 }
                    ],
                    totalAmount: (products[1].price * 3) + (products[2].price * 2),
                    status: 'processing'
                },
                {
                    user: adminUser._id,
                    products: [
                        { product: products[2]._id, quantity: 1 }
                    ],
                    totalAmount: products[2].price,
                    status: 'pending'
                },
                {
                    user: adminUser._id,
                    products: [
                        { product: products[0]._id, quantity: 1 }
                    ],
                    totalAmount: products[0].price,
                    status: 'processing'
                },
                {
                    user: adminUser._id,
                    products: [
                        { product: products[1]._id, quantity: 2 }
                    ],
                    totalAmount: products[1].price * 2,
                    status: 'delivered'
                }
            ];
            await Order.insertMany(ordersToSeed);
            console.log('Seeded database with dummy orders');
        }
    }

// Set EJS as the view engine and configure Layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', false); // Disable by default to preserve existing standalone views

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

app.get('/admin', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const stats = await getSalesStats();
        res.render('admin', Object.assign({ title: 'Admin Dashboard' }, stats));
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading admin dashboard.');
        res.redirect('/');
    }
});

// --- Sales Dashboard and Stats ---

async function getSalesStats() {
    // 1. Calculate Total Revenue
    const revenueResult = await Order.aggregate([
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // 2. Count Total Orders
    const totalOrders = await Order.countDocuments();

    // 2.1 Count Total Users
    const totalUsers = await User.countDocuments();

    // 3. Find Top-Selling Product
    const topSellingResult = await Order.aggregate([
        { $unwind: "$products" },
        { $group: { _id: "$products.product", totalQuantity: { $sum: "$products.quantity" } } },
        { $sort: { totalQuantity: -1 } },
        { $limit: 1 },
        { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "productDetails" } },
        { $unwind: "$productDetails" }
    ]);

    const topProduct = topSellingResult.length > 0 ? {
        name: topSellingResult[0].productDetails.name,
        quantity: topSellingResult[0].totalQuantity,
        price: topSellingResult[0].productDetails.price
    } : null;

    // 4. Get 5 recent orders
    const recentOrders = await Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'name email')
        .populate('products.product', 'name price');

    return {
        totalRevenue,
        totalOrders,
        totalUsers,
        topProduct,
        recentOrders
    };
}

// GET /sales - Render Sales Dashboard using layout
app.get('/sales', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const stats = await getSalesStats();
        res.render('sales', {
            layout: 'layout',
            title: 'Sales Dashboard',
            ...stats
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error rendering sales dashboard.');
        res.redirect('/');
    }
});

// GET /api/sales-data - JSON endpoint for sales dashboard statistics
app.get('/api/sales-data', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const stats = await getSalesStats();
        res.json({
            success: true,
            ...stats
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
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