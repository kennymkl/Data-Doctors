const express = require('express');
const path = require('path');
const app = express();
const mysql = require('mysql');
const routes = require('./routes/route1.js')


app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// const db = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',
//     password: 'melgeoffrey',
//     database: 'mco2'
//   });

//   db.connect((err) => {
//     if (err) {
//       throw err;
//     }
//     console.log('Connected to the MySQL server.');
//   });

app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);

app.use('/', routes)


// // Serve the main page on the root route
// app.get('/', (req, res) => {
//     res.render('index.html');
// });

// // Serve the Add Appointments page
// app.get('/addAppointments', (req, res) => {
//     const sql = 'SELECT * FROM appointments LIMIT 500';
    
//     db.query(sql, (err, results) => {
//         if (err) throw err;
//         res.render('addAppointments.html', { appointments: results });
//     });
// });

// function formatDate(dateString) {
//     try {
//       const date = new Date(dateString);
//       if (!isNaN(date.getTime())) {
//         // Date is valid
//         return date.toISOString().slice(0, 10);
//       } else {
//         // Date is invalid
//         return 'Invalid date';
//       }
//     } catch (error) {
//       // Error parsing date
//       return 'Error formatting date';
//     }
//   }
// app.get('/reports', (req, res) => {
//     const latestAppointmentsSql = 'SELECT YEAR(QueueDate) AS AppointmentYear, COUNT(ApptCode) AS NumberOfAppointments FROM appointments GROUP BY YEAR(QueueDate) ORDER BY AppointmentYear;';
      
//     // Query for the first 10 upcoming appointments
//     const upcomingAppointmentsSql = 'SELECT * FROM appointments WHERE queuedate >= CURDATE() ORDER BY queuedate ASC LIMIT 10';
      
//     db.query(latestAppointmentsSql, (err, latestAppointmentsResults) => {
//         if (err) throw err;
          
//         db.query(upcomingAppointmentsSql, (err, upcomingAppointmentsResults) => {
//             if (err) throw err;
              
//             // Pass the formatDate function and query results to the template
//             res.render('generateReport.html', { 
//                 latestAppointments: latestAppointmentsResults, 
//                 upcomingAppointments: upcomingAppointmentsResults,
//                 formatDate: formatDate // Pass the function for use in EJS
//             });
//         });
//     });
// });

// // Serve the Update Appointment page, dynamically populated based on the appointment code
// app.get('/updateAppointment/:appcode', (req, res) => {
//     // You would normally fetch the appointment data here
//     const appointmentData = {
//         appcode: req.params.appcode,
//         status: 'Scheduled',
//         queuedate: new Date().toISOString().slice(0,16),
//         type: 'Consultation',
//         virtualid: '12345'
//     };
//     res.render('updateAppointment.html', { ...appointmentData });
// });

// app.get('/viewSearch', (req, res) => {
//     let sql = 'SELECT * FROM appointments ORDER BY queuedate DESC LIMIT 500';
//     const searchTerm = req.query.searchTerm;

//     if (searchTerm) {
//         // Adjust this SQL query based on your search criteria and database schema
//         sql = 'SELECT * FROM appointments WHERE doctorid LIKE ? ORDER BY queuedate DESC LIMIT 500';
//         // Use parameterized queries to avoid SQL injection
//         db.query(sql, [`%${searchTerm}%`], (err, results) => {
//             if (err) throw err;
//             // Pass the formatDate function to the EJS template
//             res.render('viewSearch.html', { appointments: results, formatDate: formatDate });
//         });
//     } else {
//         db.query(sql, (err, results) => {
//             if (err) throw err;
//             // Pass the formatDate function to the EJS template
//             res.render('viewSearch.html', { appointments: results, formatDate: formatDate });
//         });
//     }
// });

app.listen(3000,'0.0.0.0', () => {
    console.log('Server started on http://localhost:3000');
});
