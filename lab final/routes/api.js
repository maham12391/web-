const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { verifyToken } = require('../middleware/jwtAuth');

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// POST /api/v1/auth/login
router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate JWT
        const payload = {
            user_id: user._id,
            role: user.role
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({
            message: 'Login successful',
            token: token
        });

    } catch (error) {
        console.error('Login API Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// ==========================================
// PRODUCT ROUTES (PUBLIC)
// ==========================================

// GET /api/v1/products
router.get('/products', async (req, res) => {
    try {
        // Implement basic pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const products = await Product.find()
            .skip(skip)
            .limit(limit);
        
        const total = await Product.countDocuments();

        res.status(200).json({
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            totalProducts: total,
            data: products
        });
    } catch (error) {
        console.error('Get Products Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET /api/v1/products/:id
router.get('/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});


// ==========================================
// PROTECTED ROUTES (REQUIRES JWT)
// ==========================================

// GET /api/v1/user/profile
router.get('/user/profile', verifyToken, async (req, res) => {
    try {
        // req.user comes from the verifyToken middleware
        const user = await User.findById(req.user.user_id).select('-password');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// POST /api/v1/orders
router.post('/orders', verifyToken, async (req, res) => {
    try {
        const { products } = req.body;
        
        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ message: 'Please provide an array of products' });
        }

        // Calculate total amount (simplified for assignment)
        let totalAmount = 0;
        for (let item of products) {
            const productInfo = await Product.findById(item.product);
            if (!productInfo) {
                return res.status(404).json({ message: `Product ${item.product} not found` });
            }
            totalAmount += (productInfo.price * item.quantity);
        }

        const newOrder = new Order({
            user: req.user.user_id,
            products: products,
            totalAmount: totalAmount
        });

        await newOrder.save();

        res.status(201).json({
            message: 'Order placed successfully',
            order: newOrder
        });

    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

module.exports = router;
