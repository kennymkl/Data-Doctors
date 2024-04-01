// Serve the main page on the root route
const express = require('express');
const path = require('path');
const app = express();
const mysql = require('mysql');

var db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'pipowasher3', //change password to specific credentials
    database: 'mco2'
  });

  db.connect((err) => {
    if (err) {
      throw err;
    }
    console.log('Connected to the MySQL server.');
  });



app.get('/', (req, res) => {
    res.render('index');
});

app.set('views', path.join(__dirname, '..','views'));
// Serve the Add Appointments page
app.get('/addAppointments', (req, res) => {
    const sql = 'SELECT * FROM appointments LIMIT 500';
    
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.render('addAppointments', { appointments: results });
    });
});

function formatDate(dateString) {
    console.log("Formatting date:", dateString); // Log input
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const formattedDate = date.toISOString().slice(0, 10);
        console.log("Formatted date:", formattedDate); // Log output
        return formattedDate;
      } else {
        console.log("Date is invalid");
        return 'Invalid date';
      }
    } catch (error) {
      console.error("Error formatting date:", error);
      return 'Error formatting date';
    }
}


app.get('/reports', (req, res) => {
    const latestAppointmentsSql = 'SELECT YEAR(QueueDate) AS AppointmentYear, COUNT(ApptCode) AS NumberOfAppointments FROM appointments GROUP BY YEAR(QueueDate) ORDER BY AppointmentYear;';
      
    // Query for the first 10 upcoming appointments
    const upcomingAppointmentsSql = 'SELECT * FROM appointments WHERE queuedate >= CURDATE() ORDER BY queuedate ASC LIMIT 10';
      
    db.query(latestAppointmentsSql, (err, latestAppointmentsResults) => {
        if (err) throw err;
          
        db.query(upcomingAppointmentsSql, (err, upcomingAppointmentsResults) => {
            if (err) throw err;
              
            // Pass the formatDate function and query results to the template
            res.render('generateReport', { 
                latestAppointments: latestAppointmentsResults, 
                upcomingAppointments: upcomingAppointmentsResults,
                formatDate: formatDate // Pass the function for use in EJS
            });
        });
    });
});



app.get('/viewSearch', (req, res) => {
    let sql = 'SELECT * FROM appointments LIMIT 500'; //ORDER BY queuedate DESC
    const searchTerm = req.query.searchTerm;

    if (searchTerm) {
        // Adjust this SQL query based on your search criteria and database schema
        sql = 'SELECT * FROM appointments WHERE apptcode LIKE ? LIMIT 500';
        // Use parameterized queries to avoid SQL injection
        db.query(sql, [`%${searchTerm}%`], (err, results) => {
            if (err) throw err;
            // Pass the formatDate function to the EJS template
            res.render('viewSearch', { appointments: results, formatDate: formatDate });
        });
    } else {
        db.query(sql, (err, results) => {
            if (err) throw err;
            // Pass the formatDate function to the EJS template
            res.render('viewSearch', { appointments: results, formatDate: formatDate });
        });
    }
});

app.get('/updateAppointments/:apptcode', (req, res) => {
    const sql = 'SELECT * FROM appointments WHERE apptcode = ?';
    db.query(sql, [req.params.apptcode], (err, results) => {
        if (err) throw err;
        if (results.length > 0) {
            const appointmentData = results[0];
            const date = new Date(appointmentData.queuedate);

            // Check if the date is valid
            if (!isNaN(date.getTime())) {
                appointmentData.queuedate = date.toISOString().slice(0,16);
            } else {
                console.error('Invalid date for appointment', appointmentData.apptcode);
                // Handle invalid date, perhaps by setting a default value or leaving it empty
                appointmentData.queuedate = ''; // or set a default/fallback value
            }

            res.render('updateAppointments', { ...appointmentData });
        } else {
            // Handle case where no appointment is found
            res.send('Appointment not found');
        }
    });
});

app.post('/submitUpdate', (req, res) => {
    // Extract updated values from req.body
    const { apptcode, status, type } = req.body;

    // SQL to update appointment in database
    const sql = 'UPDATE appointments SET status = ?, type = ? WHERE apptcode = ?';

    db.query(sql, [status, type, apptcode], (err, result) => {
        if (err) throw err;
        // Redirect back to the appointments list, or show a success message
        res.redirect('/viewSearch');
   
    });
});



module.exports = app;