-- =========================================================
-- 05_CTE_QUERIES.SQL
-- Requires MySQL 8.0+.
-- Demonstrates ordinary CTEs and a recursive CTE.
-- =========================================================

USE car_service;

-- 1. CTE: calculate service totals for each booking.
WITH BookingServiceTotals AS (
    SELECT
        Booking_ID,
        SUM(Quantity * Unit_Price) AS Services_Total
    FROM BOOKING_SERVICE
    GROUP BY Booking_ID
)
SELECT
    b.Booking_ID,
    b.Booking_Status,
    COALESCE(t.Services_Total, 0.00) AS Services_Total
FROM BOOKING AS b
LEFT JOIN BookingServiceTotals AS t
    ON t.Booking_ID = b.Booking_ID
ORDER BY b.Booking_ID;

-- 2. CTE: calculate invoice totals and show invoices
-- above Rs. 5000.
WITH InvoiceAmounts AS (
    SELECT
        Invoice_ID,
        Booking_ID,
        Total_Amount,
        Invoice_Status
    FROM Invoice_Total_View
)
SELECT *
FROM InvoiceAmounts
WHERE Total_Amount > 5000
ORDER BY Total_Amount DESC;

-- 3. Multiple CTEs: monthly booking count and invoice revenue.
WITH MonthlyBookings AS (
    SELECT
        DATE_FORMAT(Appointment_Date, '%Y-%m') AS Month_Key,
        COUNT(*) AS Booking_Count
    FROM BOOKING
    GROUP BY DATE_FORMAT(Appointment_Date, '%Y-%m')
),
MonthlyRevenue AS (
    SELECT
        DATE_FORMAT(Invoice_Date, '%Y-%m') AS Month_Key,
        SUM(Total_Amount) AS Invoice_Total
    FROM Invoice_Total_View
    GROUP BY DATE_FORMAT(Invoice_Date, '%Y-%m')
)
SELECT
    mb.Month_Key,
    mb.Booking_Count,
    COALESCE(mr.Invoice_Total, 0.00) AS Invoice_Total
FROM MonthlyBookings AS mb
LEFT JOIN MonthlyRevenue AS mr
    ON mr.Month_Key = mb.Month_Key
ORDER BY mb.Month_Key;

-- 4. RECURSIVE CTE: generate a seven-day calendar.
-- This demonstrates recursion because each row generates
-- the next date until the end date is reached.
WITH RECURSIVE DateCalendar AS (
    SELECT DATE('2026-09-01') AS Calendar_Date

    UNION ALL

    SELECT DATE_ADD(Calendar_Date, INTERVAL 1 DAY)
    FROM DateCalendar
    WHERE Calendar_Date < DATE('2026-09-07')
)
SELECT Calendar_Date
FROM DateCalendar
ORDER BY Calendar_Date;

-- 5. Recursive CTE with booking counts for each generated day.
WITH RECURSIVE DateCalendar AS (
    SELECT DATE('2026-09-01') AS Calendar_Date

    UNION ALL

    SELECT DATE_ADD(Calendar_Date, INTERVAL 1 DAY)
    FROM DateCalendar
    WHERE Calendar_Date < DATE('2026-09-07')
)
SELECT
    d.Calendar_Date,
    COUNT(b.Booking_ID) AS Booking_Count
FROM DateCalendar AS d
LEFT JOIN BOOKING AS b
    ON b.Appointment_Date = d.Calendar_Date
GROUP BY d.Calendar_Date
ORDER BY d.Calendar_Date;
