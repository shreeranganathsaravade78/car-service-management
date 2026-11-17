-- =========================================================
-- 03_NESTED_QUERIES.SQL
-- Demonstrates subqueries in WHERE, FROM and SELECT.
-- =========================================================

USE car_service;

-- 1. Services priced above the average service price.
SELECT Service_ID, Service_Name, Base_Price
FROM SERVICE
WHERE Base_Price > (
    SELECT AVG(Base_Price)
    FROM SERVICE
)
ORDER BY Base_Price DESC;

-- 2. Customers who own at least one vehicle using IN.
SELECT Customer_ID, First_Name, Last_Name
FROM CUSTOMER
WHERE Customer_ID IN (
    SELECT Customer_ID
    FROM VEHICLE
)
ORDER BY Customer_ID;

-- 3. Bookings whose vehicles belong to customer 2.
SELECT Booking_ID, Vehicle_ID, Appointment_Date, Booking_Status
FROM BOOKING
WHERE Vehicle_ID IN (
    SELECT Vehicle_ID
    FROM VEHICLE
    WHERE Customer_ID = 2
)
ORDER BY Appointment_Date;

-- 4. Mechanics who have an assignment using EXISTS.
SELECT Mechanic_ID, First_Name, Last_Name
FROM MECHANIC
WHERE EXISTS (
    SELECT 1
    FROM BOOKING_MECHANIC
    WHERE BOOKING_MECHANIC.Mechanic_ID = MECHANIC.Mechanic_ID
);

-- 5. Derived table: total value of selected services per booking.
SELECT
    booking_totals.Booking_ID,
    booking_totals.Services_Total
FROM (
    SELECT
        Booking_ID,
        SUM(Quantity * Unit_Price) AS Services_Total
    FROM BOOKING_SERVICE
    GROUP BY Booking_ID
) AS booking_totals
WHERE booking_totals.Services_Total > 2000
ORDER BY booking_totals.Services_Total DESC;

-- 6. Invoices whose total is above the average invoice total.
SELECT Invoice_ID, Booking_ID, Total_Amount
FROM Invoice_Total_View
WHERE Total_Amount > (
    SELECT AVG(Total_Amount)
    FROM Invoice_Total_View
)
ORDER BY Total_Amount DESC;

-- 7. Vehicles manufactured in the same year as at least one
-- vehicle made by Hyundai.
SELECT Vehicle_ID, Manufacturer, Model, Manufacturing_Year
FROM VEHICLE
WHERE Manufacturing_Year IN (
    SELECT Manufacturing_Year
    FROM VEHICLE
    WHERE Manufacturer = 'Hyundai'
      AND Manufacturing_Year IS NOT NULL
)
ORDER BY Manufacturing_Year;
