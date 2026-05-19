const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    // Get auth header value
    const authHeader = req.headers['authorization'];
    
    // Check if header exists
    if (!authHeader) {
        return res.status(401).json({ message: 'Access Denied: No Token Provided' });
    }

    // Header convention is 'Bearer <token>'
    const tokenParts = authHeader.split(' ');
    if (tokenParts[0] !== 'Bearer' || !tokenParts[1]) {
        return res.status(401).json({ message: 'Access Denied: Invalid Token Format' });
    }

    const token = tokenParts[1];

    try {
        // Verify the token
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        
        // Add the decoded user payload to the request object
        req.user = verified;
        
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Invalid or Expired Token' });
    }
};

module.exports = { verifyToken };
