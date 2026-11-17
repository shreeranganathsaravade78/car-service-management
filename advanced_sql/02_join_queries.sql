-- =========================================================
-- 02_JOIN_QUERIES.SQL
-- Demonstrates INNER JOIN, LEFT JOIN, RIGHT JOIN and
-- multi-table / many-to-many joins.
-- =========================================================

USE car_service;

-- 1. INNER JOIN: customers and their vehicles.
SELECT
    c.Customer_ID,
    CONCAT(c.First_Name, ' ', c.Last_Name) AS Customer_Name,
    v.Vehicle_ID,
    v.Registration_Number,
    v.Manufacturer,
    v.Model
FROM CUSTOMER AS c
INNER JOIN VEHICLE AS v
    ON v.Customer_ID = c.Customer_ID
ORDER BY c.Customer_ID, v.Vehicle_ID;

-- 2. LEFT JOIN: show every vehicle, including vehicles
-- that do not have a booking yet.
SELECT
    v.Vehicle_ID,
    v.Registration_Number,
    v.Model,
    b.Booking_ID,
    b.Appointment_Date,
    b.Booking_Status
FROM VEHICLE AS v
LEFT JOIN BOOKING AS b
    ON b.Vehicle_ID = v.Vehicle_ID
ORDER BY v.Vehicle_ID, b.Booking_Date;

-- 3. RIGHT JOIN: show every customer, including customers
-- who do not currently have a registered vehicle.
SELECT
    c.Customer_ID,
    CONCAT(c.First_Name, ' ', c.Last_Name) AS Customer_Name,
    v.Vehicle_ID,
    v.Registration_Number
FROM VEHICLE AS v
RIGHT JOIN CUSTOMER AS c
    ON c.Customer_ID = v.Customer_ID
ORDER BY c.Customer_ID;

-- 4. Multi-table JOIN: booking, vehicle and customer details.
SELECT
    b.Booking_ID,
    CONCAT(c.First_Name, ' ', c.Last_Name) AS Customer_Name,
    v.Registration_Number,
    CONCAT(v.Manufacturer, ' ', v.Model) AS Vehicle,
    b.Appointment_Date,
    b.Appointment_Time,
    b.Booking_Status
FROM BOOKING AS b
INNER JOIN VEHICLE AS v
    ON v.Vehicle_ID = b.Vehicle_ID
INNER JOIN CUSTOMER AS c
    ON c.Customer_ID = v.Customer_ID
ORDER BY b.Appointment_Date;

-- 5. Many-to-many JOIN: services selected for each booking.
SELECT
    b.Booking_ID,
    s.Service_Name,
    bs.Quantity,
    bs.Unit_Price,
    (bs.Quantity * bs.Unit_Price) AS Line_Total
FROM BOOKING AS b
INNER JOIN BOOKING_SERVICE AS bs
    ON bs.Booking_ID = b.Booking_ID
INNER JOIN SERVICE AS s
    ON s.Service_ID = bs.Service_ID
ORDER BY b.Booking_ID, s.Service_Name;

-- 6. Many-to-many JOIN: mechanics assigned to each booking.
SELECT
    b.Booking_ID,
    CONCAT(m.First_Name, ' ', m.Last_Name) AS Mechanic_Name,
    bm.Assigned_At,
    bm.Work_Description,
    bm.Work_Status
FROM BOOKING AS b
INNER JOIN BOOKING_MECHANIC AS bm
    ON bm.Booking_ID = b.Booking_ID
INNER JOIN MECHANIC AS m
    ON m.Mechanic_ID = bm.Mechanic_ID
ORDER BY b.Booking_ID, m.Mechanic_ID;

-- 7. LEFT JOIN: list all invoices and any successful payments.
SELECT
    i.Invoice_ID,
    i.Booking_ID,
    i.Invoice_Status,
    p.Payment_ID,
    p.Payment_Date,
    p.Amount,
    p.Payment_Method
FROM INVOICE AS i
LEFT JOIN PAYMENT AS p
    ON p.Invoice_ID = i.Invoice_ID
   AND p.Payment_Status = 'Success'
ORDER BY i.Invoice_ID, p.Payment_ID;
