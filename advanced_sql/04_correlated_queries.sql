
-- =========================================================
-- 04_CORRELATED_QUERIES.SQL
-- A correlated subquery refers to a column from the outer query.
-- =========================================================

USE car_service;

-- 1. Mechanics who have at least one completed assignment.
SELECT
    m.Mechanic_ID,
    m.First_Name,
    m.Last_Name
FROM MECHANIC AS m
WHERE EXISTS (
    SELECT 1
    FROM BOOKING_MECHANIC AS bm
    WHERE bm.Mechanic_ID = m.Mechanic_ID
      AND bm.Work_Status = 'Completed'
);

-- 2. Vehicles that have at least one booking.
SELECT
    v.Vehicle_ID,
    v.Registration_Number,
    v.Model
FROM VEHICLE AS v
WHERE EXISTS (
    SELECT 1
    FROM BOOKING AS b
    WHERE b.Vehicle_ID = v.Vehicle_ID
);

-- 3. For each service, count how many other services
-- have a lower base price.
SELECT
    s.Service_ID,
    s.Service_Name,
    s.Base_Price,
    (
        SELECT COUNT(*)
        FROM SERVICE AS s2
        WHERE s2.Base_Price < s.Base_Price
    ) AS Cheaper_Service_Count
FROM SERVICE AS s
ORDER BY s.Base_Price DESC;

-- 4. Customers who have more vehicles than the average
-- number of vehicles owned by ALL customers.
-- LEFT JOIN includes customers with zero vehicles.
SELECT
    c.Customer_ID,
    c.First_Name,
    c.Last_Name
FROM CUSTOMER AS c
WHERE (
    SELECT COUNT(*)
    FROM VEHICLE AS v
    WHERE v.Customer_ID = c.Customer_ID
) > (
    SELECT AVG(per_customer.vehicle_count)
    FROM (
        SELECT
            c2.Customer_ID,
            COUNT(v2.Vehicle_ID) AS vehicle_count
        FROM CUSTOMER AS c2
        LEFT JOIN VEHICLE AS v2
            ON v2.Customer_ID = c2.Customer_ID
        GROUP BY c2.Customer_ID
    ) AS per_customer
);

-- 5. For each mechanic, show the number of assignments.
SELECT
    m.Mechanic_ID,
    CONCAT(m.First_Name, ' ', m.Last_Name) AS Mechanic_Name,
    (
        SELECT COUNT(*)
        FROM BOOKING_MECHANIC AS bm
        WHERE bm.Mechanic_ID = m.Mechanic_ID
    ) AS Total_Assignments
FROM MECHANIC AS m
ORDER BY Total_Assignments DESC;
