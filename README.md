# DATA DOCTORS
STADVDB MCO2 Group 24

This repository contains a robust implementation for processing Electronic Medical Records (EMR) data using a master-slave node system. The system leverages try-catch blocks for efficient error handling and includes a log-based recovery mechanism to ensure data integrity and system resilience.

The core of the system lies in its master-slave architecture, which efficiently distributes tasks between a master node and multiple slave nodes, optimizing the data processing workflow. The master node manages task distribution and coordination, while the slave nodes handle the assigned tasks and report their status back to the master.

Error handling is meticulously managed through the use of try-catch blocks, which help gracefully manage exceptions and prevent system crashes. In addition to this, a comprehensive logging system records all operations and errors, facilitating a log-based recovery process that restores the system's state in case of failures.

The system is designed to be both scalable and resilient, capable of handling large datasets and ensuring high availability and reliability.

![image](https://github.com/kennymkl/Data-Doctors/assets/64532697/f1741e90-7482-483a-b9d3-04b6af42438f)


![image](https://github.com/kennymkl/Data-Doctors/assets/64532697/c2ffa7fe-7b7e-4bb5-ae6c-b291b6f35286)


![image](https://github.com/kennymkl/Data-Doctors/assets/64532697/8bd202f9-1a19-401f-8e91-fce99d01d1a7)

