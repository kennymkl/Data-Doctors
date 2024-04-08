// Serve the main page on the root route
const express = require('express');
const path = require('path');
const app = express();
const mysql = require('mysql');

// MASTER
const masterConfig = {
    host: 'localhost',
    user: 'root',
    password: 'pipowasher3', //change password to specific credentials
    database: 'mco2',
  };
                            //when updating in the vms, add a host:  
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
        setTimeout(() => createConnection(config), 2000); // Try to reconnect every 2 seconds (not applicable satin ata)
      } else {
        console.log(`${label} - Connected to the MySQL server.`);
      }
    });
  
    connection.on('error', (err) => {
      console.error(`${label} - MySQL error:`, err);
      if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        createConnection(config,label); // Reconnect if the connection is lost
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
        //connection.createConnection(config, label); 
        //^--Commented this out kasi wala naman effect dun sa original na vars
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

  function reconnectAll(){
    db = createConnection(masterConfig,'master');
    db_slave1 = createConnection(slave1Config,'slave1');
    db_slave2 = createConnection(slave2Config,'slave2');
  }

app.get('/', async (req, res) => {
    //db.destroy();     //Use when simulating database crashes
    checkConnections()   //if you want to see connection states of the vars
    reconnectAll()    // reconnect every connection and still uses the same vars that were established
    res.render('index');
});

app.set('views', path.join(__dirname, '..','views'));
// Serve the Add Appointments page
app.get('/addAppointments', async (req, res) => {
    const sql = 'SELECT * FROM appointments LIMIT 500';

    // Query function that attempts to fetch appointments
    async function queryAppointments(database) {
        return new Promise((resolve, reject) => {
            database.query(sql, (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
    }

    try {
        // First, try fetching appointments from the master database
        const results = await queryAppointments(db);
        res.render('addAppointments', { appointments: results });
    } catch (error) {
        console.error('Error fetching appointments from master db, trying slave databases...', error);

        // Attempt to fetch from the first slave database if master fails
        try {
            const resultsFromSlave1 = await queryAppointments(db_slave1);
            res.render('addAppointments', { appointments: resultsFromSlave1 });
        } catch (errorSlave1) {
            console.error('Error fetching appointments from db_slave1, trying db_slave2...', errorSlave1);

            // If the first slave also fails, attempt to fetch from the second slave database
            try {
                const resultsFromSlave2 = await queryAppointments(db_slave2);
                res.render('addAppointments', { appointments: resultsFromSlave2 });
            } catch (errorSlave2) {
                // If all attempts fail, log the final error and return a failure response
                console.error('Error fetching appointments from db_slave2. Unable to fetch appointments from any database.', errorSlave2);
                res.status(500).send('Unable to fetch appointments.');
            }
        }
    }
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

app.get('/reports', async (req, res) => {
    const appointmentsPerYearSql = 'SELECT YEAR(QueueDate) AS AppointmentYear, COUNT(ApptCode) AS NumberOfAppointments FROM appointments GROUP BY YEAR(QueueDate) ORDER BY AppointmentYear;';
    const averageAgeSql = 'SELECT YEAR(a.QueueDate) AS AppointmentYear, AVG(p.Age) AS AverageAge, COUNT(*) AS Count FROM appointments a JOIN px p ON a.pxid = p.pxid GROUP BY YEAR(a.QueueDate) ORDER BY AppointmentYear;';
    const statusSql = 'SELECT Status, COUNT(ApptCode) AS NumberOfAppointments FROM appointments GROUP BY Status ORDER BY NumberOfAppointments DESC;';

    async function queryDatabase(db, sql) {
        return new Promise((resolve, reject) => {
            db.query(sql, (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
    }

    async function aggregateQueryResults(sql, keyColumn, countColumn) {
        const results1 = await queryDatabase(db_slave1, sql);
        const results2 = await queryDatabase(db_slave2, sql);

        let combinedResults = {};
        [...results1, ...results2].forEach(result => {
            if (!combinedResults[result[keyColumn]]) {
                combinedResults[result[keyColumn]] = 0;
            }
            combinedResults[result[keyColumn]] += result[countColumn];
        });

        return Object.entries(combinedResults).map(([key, count]) => ({
            [keyColumn]: key,
            [countColumn]: count
        }));
    }

    async function combineAverageAgeResults(sql) {
        const results1 = await queryDatabase(db_slave1, sql);
        const results2 = await queryDatabase(db_slave2, sql);

        let combinedResults = {};
        [...results1, ...results2].forEach(result => {
            if (!combinedResults[result.AppointmentYear]) {
                combinedResults[result.AppointmentYear] = { sumAge: 0, count: 0 };
            }
            combinedResults[result.AppointmentYear].sumAge += result.AverageAge * result.Count;
            combinedResults[result.AppointmentYear].count += result.Count;
        });

        return Object.entries(combinedResults).map(([year, data]) => ({
            AppointmentYear: year,
            AverageAge: data.sumAge / data.count
        }));
    }

    try {
        const [appointmentsPerYearResults, averageAgeResults, statusResults] = await Promise.all([
            queryDatabase(db, appointmentsPerYearSql),
            queryDatabase(db, averageAgeSql),
            queryDatabase(db, statusSql)
        ]);

        res.render('generateReport', {
            yearlyAppointments: appointmentsPerYearResults,
            averageAgeAppointments: averageAgeResults,
            statusAppointments: statusResults,
            formatDate: formatDate
        });
    } catch (error) {
        try {
            const yearlyAppointments = await aggregateQueryResults(appointmentsPerYearSql, 'AppointmentYear', 'NumberOfAppointments');
            const averageAgeAppointments = await combineAverageAgeResults(averageAgeSql);
            const statusAppointments = await aggregateQueryResults(statusSql, 'Status', 'NumberOfAppointments');

            res.render('generateReport', {
                yearlyAppointments,
                averageAgeAppointments,
                statusAppointments,
                formatDate: formatDate
            });
        } catch (slaveError) {
            res.status(500).send('Unable to generate report' + slaveError);
        }
    }
});

app.get('/viewSearch', async (req, res) => {
    try {
        let sql = 'SELECT * FROM appointments LIMIT 500';
        const searchTerm = req.query.searchTerm;
        const searchColumn = req.query.searchColumn || 'apptcode';

        // Adjust SQL if there's a search term
        if (searchTerm) {
            sql = `SELECT * FROM appointments WHERE ${db.escapeId(searchColumn)} LIKE ? LIMIT 500`;
        }

        // Function to execute the query on a single database
        async function queryDatabase(db, sql, params) {
            return new Promise((resolve, reject) => {
                db.query(sql, params, (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });
        }

        // Execute query and handle results or errors
        let appointments = [];
        if (searchTerm) {
            const searchParams = [`%${searchTerm}%`];
            const results1 = await queryDatabase(db_slave1, sql, searchParams);
            const results2 = await queryDatabase(db_slave2, sql, searchParams);
            appointments = mergeResults(results1, results2).slice(0, 500);
        } else {
            const results1 = await queryDatabase(db_slave1, sql, []);
            const results2 = await queryDatabase(db_slave2, sql, []);
            appointments = mergeResults(results1, results2).slice(0, 500);
        }

        res.render('viewSearch', { appointments, formatDate: formatDate, searchColumn: searchColumn });
    }
   catch(error){ //Master node is down so since specs say only one db down at a time:
    let sql = 'SELECT * FROM appointments LIMIT 500';
    const searchTerm = req.query.searchTerm;
    const searchColumn = req.query.searchColumn || 'apptcode';

//query a database
function queryDatabase(db, sql, params) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
}

//Function to merge and unique the results from both databases
function mergeResults(results1, results2) {
    const combinedResults = [...results1, ...results2];
    combinedResults.sort((a, b) => a.apptcode - b.apptcode);
    return combinedResults;
}


if (searchTerm) {
    sql = `SELECT * FROM appointments WHERE ${mysql.escapeId(searchColumn)} LIKE ? LIMIT 500`;
    const searchParams = [`%${searchTerm}%`];
    
    Promise.all([
        queryDatabase(db_slave1, sql, searchParams),
        queryDatabase(db_slave2, sql, searchParams)
    ]).then(([results1, results2]) => {
        var combinedResults = mergeResults(results1, results2);
        combinedResults = combinedResults.slice(0, 500);
        res.render('viewSearch', { appointments: combinedResults, formatDate: formatDate, searchColumn: searchColumn });
    }).catch(err => {
        throw err;
    });
} else {
    Promise.all([
        queryDatabase(db_slave1, sql, []),
        queryDatabase(db_slave2, sql, [])
    ]).then(([results1, results2]) => {
        var combinedResults = mergeResults(results1, results2);
        combinedResults = combinedResults.slice(0, 500);
        res.render('viewSearch', { appointments: combinedResults, formatDate: formatDate, searchColumn: searchColumn });
    }).catch(err => {
        throw err;
    });
}
    
   }
});



app.get('/updateAppointments/:apptcode', async (req, res) => {
    const apptcode = req.params.apptcode;
    const sql = 'SELECT * FROM appointments WHERE apptcode = ?';
    const clinicSql = 'SELECT RegionName FROM clinics WHERE ClinicID = ?';

    // Helper function for querying database and fetching data
    async function fetchData(query, params, dbConnection) {
        return new Promise((resolve, reject) => {
            dbConnection.query(query, params, (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
    }

    // Main logic to fetch appointment and clinic details
    async function getAppointmentDetails() {
        try {
            // Attempt to fetch appointment details from the primary database
            const appointmentResults = await fetchData(sql, [apptcode], db);
            if (appointmentResults.length === 0) {
                throw new Error('Appointment not found');
            }
            const appointment = appointmentResults[0];

            // Fetch clinic details for the region name
            const clinicResults = await fetchData(clinicSql, [appointment.clinicid], db);
            const regionName = clinicResults.length > 0 ? clinicResults[0].RegionName : 'Unknown Region';

            // Pass fetched data to the view
            return { ...appointment, regionName };
        } catch (error) {
            console.error(error);
            // Attempt to fetch from slave databases if the primary fails
            for (let slaveDb of [db_slave1, db_slave2]) {
                try {
                    const appointmentResults = await fetchData(sql, [apptcode], slaveDb);
                    if (appointmentResults.length > 0) {
                        const appointment = appointmentResults[0];
                        const clinicResults = await fetchData(clinicSql, [appointment.clinicid], slaveDb);
                        const regionName = clinicResults.length > 0 ? clinicResults[0].RegionName : 'Unknown Region';
                        return { ...appointment, regionName };
                    }
                } catch (slaveError) {
                    console.error(slaveError);
                }
            }
            // If all attempts fail, return null to indicate failure
            return null;
        }
    }

    // Execute the main logic and render the response
    const appointmentDetails = await getAppointmentDetails();
    if (appointmentDetails) {
        res.render('updateAppointments', appointmentDetails);
    } else {
        res.status(404).send('Appointment not found.');
    }
});

app.post('/submitUpdate', async (req, res) => {
    const { apptcode, status } = req.body; // Assuming status or other fields are being updated
    const sql = 'UPDATE appointments SET status = ? WHERE apptcode = ?';

    try {
        // Try to update using the master database first
        await new Promise((resolve, reject) => {
            db.query(sql, [status, apptcode], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
        await synchronizeUpdateDeleteDBs(sql, [status, apptcode])

        console.log(`Appointment ${apptcode} updated successfully on master database.`);
        res.redirect('/viewSearch'); // Or any appropriate response
    } catch (error) {
        console.error('Attempt on master database failed:', error);
        // Fallback to slave databases if master is down
        try {
            // Attempt the update on db_slave1, if it fails, catch the error and try db_slave2
            await new Promise((resolve, reject) => {
                db_slave1.query(sql, [status, apptcode], (err, result) => {
                    if (err) {
                        db_slave2.query(sql, [status, apptcode], (err2, result2) => {
                            if (err2) reject(err2);
                            else resolve(result2);
                        });
                    } else {
                        if (result.affectedRows === 0) {
                            db_slave2.query(sql, [status, apptcode], (err2, result2) => {
                                if (err2) reject(err2);
                                else resolve(result2);
                            });
                        } else {
                            resolve(result);
                        }
                    }
                });  
            });
            console.log(`Appointment ${apptcode} updated successfully on a slave database.`);
            res.redirect('/viewSearch'); // Or any appropriate response
        } catch (slaveError) {
            console.error('Update operation failed on both slave databases:', slaveError);
            res.status(500).send('Unable to update the appointment on any database.');
        }
    }
});

app.post('/deleteAppointment', async (req, res) => {
    const { apptcode } = req.body;
    const sql = 'DELETE FROM appointments WHERE apptcode = ?';

    // First, attempt to delete using the master database
    try {
        await new Promise((resolve, reject) => {
            db.query(sql, [apptcode], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
        console.log('Appointment deleted successfully on master database.');
        res.redirect('/viewSearch');
    } catch (error) {
        // Handle case where master database might be down or operation fails
        console.error('Error deleting appointment on master database, attempting on slave databases:', error);

        // Attempt to delete the appointment on db_slave1
        try {
            await new Promise((resolve, reject) => {
                db_slave1.query(sql, [apptcode], (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
            console.log('Appointment deleted successfully on db_slave1.');
            res.redirect('/viewSearch');
        } catch (slave1Error) {
            console.error('Delete operation failed on db_slave1, attempting on db_slave2...', slave1Error);

            // If the operation fails on db_slave1, try db_slave2
            try {
                await new Promise((resolve, reject) => {
                    db_slave2.query(sql, [apptcode], (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });
                console.log('Appointment deleted successfully on db_slave2.');
                res.redirect('/viewSearch');
            } catch (slave2Error) {
                console.error('Delete operation failed on db_slave2:', slave2Error);
                res.status(500).send('Unable to delete the appointment on any database.');
            }
        }
    }
});

app.post('/insertAppointment', async (req, res) => {
    let { apptid, clinicid, doctorid, pxid, status, queuedate, type, virtualind } = req.body;
    type = type === '' ? null : type;
    virtualind = virtualind === '' ? null : virtualind;
    queuedate = queuedate === '' ? null : queuedate;

    // Initial attempt to parse apptcode or set it to undefined if not provided
    let { apptcode } = req.body;
    apptcode = apptcode ? parseInt(apptcode, 10) : undefined;

    // Define the SQL query for inserting the appointment
    const insertSql = 'INSERT INTO appointments (apptcode, apptid, clinicid, doctorid, pxid, status, queuedate, type, virtualind) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';

    // A reusable function to attempt an insert into the database
    const attemptInsert = async (database, apptCode) => {
        return new Promise((resolve, reject) => {
            database.query(insertSql, [apptCode, apptid, clinicid, doctorid, pxid, status, queuedate, type, virtualind], (err, result) => {
                if (err) reject(err);
                else resolve(apptCode); // Resolve with the apptcode to confirm success
            });
        });
    };

    try {
        // Try to insert using the master database first
        if (apptcode === undefined) {
            // Generate a new apptcode if not provided
            const findMaxApptCodeSql = 'SELECT MAX(apptcode) + 1 AS newApptCode FROM appointments';
            const result = await new Promise((resolve, reject) => {
                db.query(findMaxApptCodeSql, (err, results) => {
                    if (err) reject(err);
                    else resolve(results[0].newApptCode || 1); // Default to 1 if no existing records
                });
            });
            apptcode = result;
        }

        await attemptInsert(db, apptcode);

        // Sync with other DBs
        synchronizeAddDBs(insertSql, clinicid, [apptcode, apptid, clinicid, doctorid, pxid, status, queuedate, type, virtualind])
        console.log('New appointment added successfully with apptcode:', apptcode);
        res.redirect('/addAppointments');
    } catch (error) {
        console.error('Attempt on master database failed:', error);
        // Fallback to slave databases if master is down or apptcode generation failed
        try {
            const newApptCode = apptcode === undefined ? 1 : apptcode; // Use 1 as a fallback apptcode or retry with the same apptcode
            await attemptInsert(db_slave1, newApptCode).catch(async () => {
                // If db_slave1 fails, try db_slave2
                await attemptInsert(db_slave2, newApptCode);
            });
            console.log('New appointment added successfully on slave database with apptcode:', newApptCode);
            res.redirect('/addAppointments');
        } catch (slaveError) {
            console.error('Insert operation failed on slave databases:', slaveError);
            res.status(500).send('Unable to insert new appointment on any database.');
        }
    }
});

// SYNCHRONIZE WITH SLAVE 1 AND 2 FOR UPDATING AND DELETING ROWS
// sql = the actual query | query_params = list parameters for the query
// example use: synchronizeDBs(sql, [status, last_updated])
async function synchronizeUpdateDeleteDBs(sql, query_params){
    // Slave 1
    await new Promise((resolve, reject) => { 
        db_slave1.query(sql, query_params, (err, result) => {
            if (err) reject(err);
            else resolve();
        });
        console.log('Change reflected on Slave 1');
    });
    // Slave 2
    await new Promise((resolve, reject) => { 
        db_slave2.query(sql, query_params, (err, result) => {
            if (err) reject(err);
            else resolve();
        });
        console.log('Change reflected on Slave 2');
    });
}

// SYNCHRONIZE WITH SLAVE 1 AND 2 FOR UPDATING AND DELETING ROWS
// sql_insert = the actual insert query | clinicid = for checking if it exists in slave 1 or 2 | query_params = list parameters for the query 
// example use: synchronizeAddDBs(insertSql, clinicid, [maxApptCode, apptid, clinicid, doctorid, pxid, status, queuedate, type, virtualind || 'NULL'])
async function synchronizeAddDBs(sql_insert, clinicid, query_params){

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

    await new Promise((resolve, reject) => { 
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
             
    await new Promise((resolve, reject) => { 
        db_slave2.query(sql_select2, query_params, (err, result) => {
            if (err) reject(err)

            clinic_list2 = JSON.parse(JSON.stringify(result)).map((item) => item.clinicid)
            console.log('Checking Slave 2')

            if (clinic_list2.includes(clinicid)) {
                db_slave2.query(sql_insert, query_params, (err, result) => {
                    if (err) reject(err)
                    else resolve()

                    console.log('INSERT success -> Slave 2')
                })
            }
        });
    });

}

module.exports = app;