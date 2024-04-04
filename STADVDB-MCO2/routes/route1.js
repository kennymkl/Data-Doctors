// Serve the main page on the root route
const express = require('express');
const path = require('path');
const app = express();
const mysql = require('mysql2');

const masterConfig = {
    host: 'localhost',
    user: 'root',
    password: 'melgeoffrey', //change password to specific credentials
    database: 'mco2',
  };
  
const slave1Config = { ...masterConfig, database: 'mco2slave1'}; //database names
const slave2Config = { ...masterConfig, database: 'mco2slave2'}; //database names

var db = createConnection(masterConfig,'master');
var db_slave1 = createConnection(slave1Config,'slave1');
var db_slave2 = createConnection(slave2Config,'slave2');

function createConnection(config,label) {
    let connection = mysql.createConnection(config);
  
    connection.connect((err) => {
      if (err) {
        console.error(`${label} - Error connecting to the MySQL server`);
        setTimeout(() => createConnection(config), 2000); // Try to reconnect every 2 seconds
      } else {
        console.log(`${label} - Connected to the MySQL server.`);
      }
    });
  
    connection.on('error', (err) => {
      console.error(`${label} - MySQL error:`, err);
      if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        createConnection(config); // Reconnect if the connection is lost
      } else {
        throw err;
      }
    });
  
    return connection;
  }

function checkConnection(connection, config, label) {
    connection.query('SELECT 1', (err) => {
      if (err) {
        console.error(`${label} - Lost connection...`);
        // The connection is destroyed, attempt to reconnect
        //createConnection(config, label); 
        //^--Commented this out muna para macontrol
      } else {
        console.log(`${label} - Connection is healthy.`);
      }
    });
  }

  function checkConnections(){
    checkConnection(db,masterConfig,'master')
    checkConnection(db_slave1,slave1Config,'slave1')
    checkConnection(db_slave2,slave1Config,'slave2')
  }

//---------------End of Database Part----------------------------

app.get('/', (req, res) => {
    checkConnections() //Placed checking all connections here
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
    // console.log("Formatting date:", dateString);
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const formattedDate = date.toISOString().slice(0, 10);
        // console.log("Formatted date:", formattedDate); 
        return formattedDate;
      } else {
        // console.log("Date is invalid");
        return 'Invalid date';
      }
    } catch (error) {
    //   console.error("Error formatting date:", error);
      return 'Error formatting date';
    }
}

app.get('/reports', async(req, res) => {

    //all mysql queries for report
    const appointmentsPerYearSql = 'SELECT YEAR(QueueDate) AS AppointmentYear, COUNT(ApptCode) AS NumberOfAppointments FROM appointments GROUP BY YEAR(QueueDate) ORDER BY AppointmentYear;';
    const averageAgeSql = 'SELECT YEAR(a.QueueDate) AS AppointmentYear, AVG(p.Age) AS AverageAge FROM appointments a JOIN px p ON a.pxid = p.pxid GROUP BY YEAR(a.QueueDate) ORDER BY AppointmentYear;';
    const statusSql = 'SELECT Status, COUNT(ApptCode) AS NumberOfAppointments FROM appointments GROUP BY Status ORDER BY NumberOfAppointments DESC;';
    
    db.query(appointmentsPerYearSql, (err, appointmentsPerYearResults) => {
        if (err) throw err;
          
        db.query(averageAgeSql, (err, averageAgeResults) => {
            if (err) throw err;

            db.query(statusSql,(err,statusResults) => {
            if (err) throw err;
              
            // Pass the formatDate function and query results to the template
            res.render('generateReport', { 
                yearlyAppointments: appointmentsPerYearResults, 
                averageAgeAppointments: averageAgeResults,
                statusAppointments: statusResults,
                formatDate: formatDate // Pass the function for use in EJS
            });
            });
        });
    });
});

app.get('/viewSearch', (req, res) => {
    let sql = 'SELECT * FROM appointments LIMIT 500';
    const searchTerm = req.query.searchTerm;
    const searchColumn = req.query.searchColumn || 'apptcode';

    if (searchTerm) {
        sql = `SELECT * FROM appointments WHERE ${db.escapeId(searchColumn)} LIKE ? LIMIT 500`;
        db.query(sql, [`%${searchTerm}%`], (err, results) => {
            if (err) throw err;
            res.render('viewSearch', { appointments: results, formatDate: formatDate, searchColumn: searchColumn });
        });
    } else {
        db.query(sql, (err, results) => {
            if (err) throw err;
            res.render('viewSearch', { appointments: results, formatDate: formatDate, searchColumn: searchColumn });
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
                // console.error('Invalid date for appointment', appointmentData.apptcode);
                // Handle invalid date, perhaps by setting a default value or leaving it empty
                appointmentData.queuedate = ''; // or set a default/fallback value
            }
            const sql2 = 'SELECT RegionName FROM clinics WHERE ClinicID = ?';
            db.query(sql2, [appointmentData.clinicid], (err2, results2) => {
                if (err2) throw err2;
                if (results2.length > 0) {
                    // Add the RegionName to the appointment data
                    appointmentData.regionName = results2[0].RegionName;
                } else {
                    console.error('Clinic not found for ClinicID', appointmentData.clinicid);
                    appointmentData.regionName = 'Unknown Region';
                }
                res.render('updateAppointments', { ...appointmentData });
            });
        } else {
            // Handle case where no appointment is found
            res.send('Appointment not found');
        }
    });
});

app.post('/submitUpdate', (req, res) => {
    // Extract updated values from req.body
    const { apptcode, status} = req.body;

    // SQL to update appointment in database
    const sql = 'UPDATE appointments SET status = ? WHERE apptcode = ?';

    db.query(sql, [status, apptcode], (err, result) => {
        if (err) throw err;
        // Redirect back to the appointments list, or show a success message
        // res.redirect('/viewSearch');
    })
    // Function to Update/Delete the corresponding row in Slave 1 or 2 - for synchronizing
    synchronizeUpdateDeleteDBs(sql, [status, apptcode])

    return res.redirect('/viewSearch');
});

app.post('/deleteAppointment', (req, res) => {
    const { apptcode } = req.body;
    const sql = 'DELETE FROM appointments WHERE apptcode = ?';
    db.query(sql, [apptcode], (err, result) => {
        if (err) {
            console.error('Error deleting appointment:', err);
            // Consider sending a more descriptive error to the client
            return res.status(500).send('Error deleting appointment. Please try again.');
        }
        console.log('Appointment deleted successfully');
    });
    // Function to Update/Delete the corresponding row in Slave 1 or 2
    synchronizeUpdateDeleteDBs(sql, [apptcode]);

    res.redirect('/viewSearch');
});

app.post('/insertAppointment', (req, res) => {
    let { apptid, clinicid, doctorid, pxid, status, queuedate, type, virtualind } = req.body;
    type = type === '' ? null : type;
    virtualind = virtualind === '' ? null : virtualind;
    queuedate = queuedate === ''? null:queuedate;

    // Find the highest appointment code 
    const findMaxApptCodeSql = 'SELECT MAX(apptcode) AS maxApptCode FROM appointments';
    db.query(findMaxApptCodeSql, (err, result) => {
        if (err) {
            console.error('Error finding max appointment code:', err);
            return res.status(500).send('Error processing request');
        }
        const maxApptCode = result[0].maxApptCode ? parseInt(result[0].maxApptCode) + 1 : 1; // Increment or start at 1
        
        
        // Insert new appointment with auto-generated apptcode
        const insertSql = 'INSERT INTO appointments (apptcode,apptid, clinicid, doctorid, pxid, status, queuedate, type, virtualind) VALUES (?,?,?, ?, ?, ?, ?, ?, ?)';
        db.query(insertSql, [maxApptCode, apptid, clinicid, doctorid, pxid, status, queuedate, type, virtualind || 'NULL'], (err, result) => {
            if (err) {
                console.error('Error inserting new appointment:', err);
                return res.status(500).send('Error processing request');
            }
            console.log(maxApptCode);
            console.log('New appointment added successfully');
            // res.redirect('/addAppointments'); // Adjust redirect as necessary

            synchronizeAddDBs(insertSql, clinicid, [maxApptCode, apptid, clinicid, doctorid, pxid, status, queuedate, type, virtualind || 'NULL'])
        });        
    });

    res.redirect('/addAppointments');
});

// SYNCHRONIZE WITH SLAVE 1 AND 2 FOR UPDATING AND DELETING ROWS
// sql = the actual query | query_params = list parameters for the query
// example use: synchronizeDBs(sql, [status, last_updated])
function synchronizeUpdateDeleteDBs(sql, query_params){
    // Slave 1
    db_slave1.query(sql, query_params, (err, result) => {
        if (err) throw err;
    });
    // Slave 2
    db_slave2.query(sql, query_params, (err, result) => {
        if (err) throw err;
    });
}

// SYNCHRONIZE WITH SLAVE 1 AND 2 FOR UPDATING AND DELETING ROWS
// sql_insert = the actual insert query | clinicid = for checking if it exists in slave 1 or 2 | query_params = list parameters for the query 
// example use: synchronizeAddDBs(insertSql, clinicid, [maxApptCode, apptid, clinicid, doctorid, pxid, status, queuedate, type, virtualind || 'NULL'])
function synchronizeAddDBs(sql_insert, clinicid, query_params){

    let clinic_list1, clinic_list2;

    const sql_select1 = `SELECT clinicid 
                        FROM clinics 
                        WHERE RegionName IN ( 'National Capital Region (NCR)', 
                                            'CALABARZON (IV-A)', 
                                            'Central Luzon (III)', 
                                            'Ilocos Region (I)', 
                                            'Cordillera Administrative Region (CAR)', 
                                            'Cagayan Valley (II)', 
                                            'MIMAROPA (IV-B)', 
                                            'Bicol Region (V)')`

    db_slave1.query(sql_select1, query_params, (err, result) => {
        if (err) throw err

        clinic_list1 = JSON.parse(JSON.stringify(result)).map((item) => item.clinicid)

        console.log('Checking Slave 1')
        if (clinic_list1.includes(clinicid)) {
            db_slave1.query(sql_insert, query_params, (err, result) => {
                if (err) throw err

                console.log('INSERT success -> Slave 1')
            })
        }
    });

    const sql_select2 = `SELECT clinicid
                        FROM clinics
                        WHERE RegionName IN ( 'Central Visayas (VII)',
                                            'Western Visayas (VI)',
                                            'Eastern Visayas (VIII)',
                                            'Davao Region (XI)',
                                            'Northern Mindanao (X)',
                                            'Zamboanga Peninsula (IX)',
                                            'SOCCSKSARGEN (Cotabato Region) (XII)',
                                            'Caraga (XIII)',
                                            'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)'
                                            );`

    db_slave2.query(sql_select2, query_params, (err, result) => {
        if (err) throw err

        clinic_list2 = JSON.parse(JSON.stringify(result)).map((item) => item.clinicid)
        
        console.log('Checking Slave 2')
        if (clinic_list2.includes(clinicid)) {
            db_slave2.query(sql_insert, query_params, (err, result) => {
                if (err) throw err

                console.log('INSERT success -> Slave 2')
            })
        }
    });

}

module.exports = app;