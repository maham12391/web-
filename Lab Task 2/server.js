const express = require('express');
const path = require('path');
const app = express();

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// This line tells Express to serve everything inside the "public" folder automatically
app.use(express.static(path.join(__dirname, 'public')));

// Main Route
app.get('/', (req, res) => {
    res.render('homepage');
});

// Contact Route
app.get('/contact', (req, res) => {
    res.render('contact');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running smoothly on http://localhost:${PORT}`);
});