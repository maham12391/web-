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
const multer = require('multer');
const fs = require('fs');

// Configure Multer for File Uploads
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp|avif/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images are allowed!'));
        }
    }
});

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
            { name: 'Casual Sneakers', description: 'Comfortable sneakers', price: 1450, category: 'Fashion', stock: 50, rating: 4.5, imageUrl: '/Shoes.avif' },
            { name: 'Cotton T-Shirt', description: 'Soft cotton t-shirt', price: 750, category: 'Fashion', stock: 100, rating: 4.2, imageUrl: '/T shirt.avif' },
            { name: 'LOREAL Shampoo', description: 'Hair shampoo', price: 850, category: 'Home', stock: 80, rating: 4.0, imageUrl: '/Shampoo.avif' }
        ]);
        console.log('Seeded database with dummy products');
    }

    // Seed default Admin User if no users exist
    const userCount = await User.countDocuments();
    if (userCount === 0) {
        const adminUser = new User({
            name: 'Daraz Admin',
            email: 'admin@daraz.com',
            password: 'admin123',
            role: 'admin'
        });
        await adminUser.save();
        console.log('Seeded database with default Admin User (admin@daraz.com / admin123)');
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

        // Make the first registered user an Admin automatically
        const userCount = await User.countDocuments();
        const role = userCount === 0 ? 'admin' : 'customer';

        const newUser = new User({ name, email, password, role });
        await newUser.save();
        
        req.flash('success', `Registration successful as ${role}! Please login.`);
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

// Admin CRUD Routes
app.get('/admin', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const products = await Product.find({});
        res.render('admin', { products });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Unable to fetch products for admin panel.');
        res.redirect('/');
    }
});

// Render Add Product Form
app.get('/admin/products/new', isLoggedIn, isAdmin, (req, res) => {
    res.render('admin_new');
});

// Handle Add Product
app.post('/admin/products', isLoggedIn, isAdmin, upload.single('image'), async (req, res) => {
    try {
        const { name, price, stock, category, description } = req.body;
        
        // Basic Validation
        if (!name || !price || !stock || !category || !description) {
            req.flash('error', 'All fields are required.');
            return res.redirect('/admin/products/new');
        }

        const imageUrl = req.file ? `/uploads/${req.file.filename}` : '/placeholder.jpg';

        const newProduct = new Product({
            name,
            price: Number(price),
            stock: Number(stock),
            category,
            description,
            imageUrl
        });

        await newProduct.save();
        req.flash('success', 'Product added successfully!');
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        req.flash('error', `Error adding product: ${err.message}`);
        res.redirect('/admin/products/new');
    }
});

// Render Edit Product Form
app.get('/admin/products/:id/edit', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            req.flash('error', 'Product not found.');
            return res.redirect('/admin');
        }
        res.render('admin_edit', { product });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading edit form.');
        res.redirect('/admin');
    }
});

// Handle Edit Product
app.post('/admin/products/:id/edit', isLoggedIn, isAdmin, upload.single('image'), async (req, res) => {
    try {
        const { name, price, stock, category, description } = req.body;
        const product = await Product.findById(req.params.id);

        if (!product) {
            req.flash('error', 'Product not found.');
            return res.redirect('/admin');
        }

        // Basic Validation
        if (!name || !price || !stock || !category || !description) {
            req.flash('error', 'All fields are required.');
            return res.redirect(`/admin/products/${req.params.id}/edit`);
        }

        product.name = name;
        product.price = Number(price);
        product.stock = Number(stock);
        product.category = category;
        product.description = description;

        if (req.file) {
            product.imageUrl = `/uploads/${req.file.filename}`;
        }

        await product.save();
        req.flash('success', 'Product updated successfully!');
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        req.flash('error', `Error updating product: ${err.message}`);
        res.redirect(`/admin/products/${req.params.id}/edit`);
    }
});

// Handle Delete Product
app.post('/admin/products/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            req.flash('error', 'Product not found.');
            return res.redirect('/admin');
        }
        req.flash('success', 'Product deleted successfully!');
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error deleting product.');
        res.redirect('/admin');
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