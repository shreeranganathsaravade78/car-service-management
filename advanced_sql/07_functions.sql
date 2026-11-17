-- =========================================================
-- 07_FUNCTIONS.SQL
-- User-defined functions for service and invoice calculations.
--
-- MySQL may require:
-- SET GLOBAL log_bin_trust_function_creators = 1;
-- if binary logging is enabled and the account lacks the
-- required privilege. Only an administrator should change it.
-- =========================================================

USE car_service;

DROP FUNCTION IF EXISTS fn_service_total;
DROP FUNCTION IF EXISTS fn_invoice_total;
DROP FUNCTION IF EXISTS fn_outstanding_balance;

DELIMITER $$

-- 1. Calculate the total value of services in a booking.
CREATE FUNCTION fn_service_total(p_booking_id INT)
RETURNS DECIMAL(12,2)
READS SQL DATA
BEGIN
    DECLARE v_total DECIMAL(12,2) DEFAULT 0.00;

    SELECT COALESCE(SUM(Quantity * Unit_Price), 0.00)
    INTO v_total
    FROM BOOKING_SERVICE
    WHERE Booking_ID = p_booking_id;

    RETURN v_total;
END$$

-- 2. Calculate the complete invoice amount.
CREATE FUNCTION fn_invoice_total(p_invoice_id INT)
RETURNS DECIMAL(12,2)
READS SQL DATA
BEGIN
    DECLARE v_total DECIMAL(12,2) DEFAULT 0.00;

    SELECT COALESCE(Total_Amount, 0.00)
    INTO v_total
    FROM Invoice_Total_View
    WHERE Invoice_ID = p_invoice_id;

    RETURN v_total;
END$$

-- 3. Calculate the outstanding amount using successful payments.
CREATE FUNCTION fn_outstanding_balance(p_invoice_id INT)
RETURNS DECIMAL(12,2)
READS SQL DATA
BEGIN
    DECLARE v_balance DECIMAL(12,2) DEFAULT 0.00;

    SELECT COALESCE(Outstanding_Balance, 0.00)
    INTO v_balance
    FROM Invoice_Balance_View
    WHERE Invoice_ID = p_invoice_id;

    RETURN v_balance;
END$$

DELIMITER ;

-- Example function calls:
SELECT fn_service_total(1) AS Booking_1_Service_Total;
SELECT fn_invoice_total(1) AS Invoice_1_Total;
SELECT fn_outstanding_balance(8) AS Invoice_8_Outstanding_Balance;

-- Use a function in a query:
SELECT
    Invoice_ID,
    fn_invoice_total(Invoice_ID) AS Invoice_Total,
    fn_outstanding_balance(Invoice_ID) AS Outstanding_Balance
FROM INVOICE
ORDER BY Invoice_ID;
