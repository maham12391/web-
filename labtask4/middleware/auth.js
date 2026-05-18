module.exports.isLoggedIn = (req, res, next) => {
    if (!req.session.userId) {
        req.flash('error', 'You must be logged in to view that page.');
        return res.redirect('/login');
    }
    next();
};

module.exports.isAdmin = (req, res, next) => {
    if (req.session.userRole !== 'admin') {
        req.flash('error', 'Access Denied: Admins only.');
        return res.redirect('/');
    }
    next();
};
