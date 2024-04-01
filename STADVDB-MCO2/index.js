const express = require('express');
const path = require('path');
const app = express();
const mysql = require('mysql');
const routes = require('./routes/route1.js')

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);
app.use('/', routes)

app.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});