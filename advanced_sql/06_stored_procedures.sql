-- =========================================================
-- 06_STORED_PROCEDURES.SQL
-- MySQL stored procedures for common garage operations.
--
-- The updated database already creates:
--   Refresh_Invoice_Status(IN p_invoice_id INT)
-- Do not recreate that procedure here.
-- =========================================================

USE car_service;

DROP PROCEDURE IF EXISTS sp_get_booking_details;
DROP PROCEDURE IF EXISTS sp_assign_mechanic;
DROP PROCEDURE IF EXISTS sp_update_work_status;
DROP PROCEDURE IF EXISTS sp_get_customer_bookings;

DELIMITER $$

-- 1. Retrieve complete details for one booking.
CREATE PROCEDURE sp_get_booking_details(IN p_booking_id INT)
BEGIN
    SELECT
        b.Booking_ID,
        b.Booking_Date,
        b.Appointment_Date,
        b.Appointment_Time,
        b.Booking_Status,
        b.Problem_Description,
        v.Registration_Number,
        v.Manufacturer,
        v.Model,
        CONCAT(c.First_Name, ' ', c.Last_Name) AS Customer_Name,
        c.Phone AS Customer_Phone
    FROM BOOKING AS b
    INNER JOIN VEHICLE AS v
        ON v.Vehicle_ID = b.Vehicle_ID
    INNER JOIN CUSTOMER AS c
        ON c.Customer_ID = v.Customer_ID
    WHERE b.Booking_ID = p_booking_id;
END$$

-- 2. Assign an active mechanic to a booking.
-- The existing BEFORE INSERT trigger also checks active status.
CREATE PROCEDURE sp_assign_mechanic(
    IN p_booking_id INT,
    IN p_mechanic_id INT,
    IN p_work_description VARCHAR(255)
)
BEGIN
    DECLARE v_booking_exists INT DEFAULT 0;
    DECLARE v_mechanic_exists INT DEFAULT 0;

    SELECT COUNT(*) INTO v_booking_exists
    FROM BOOKING
    WHERE Booking_ID = p_booking_id;

    SELECT COUNT(*) INTO v_mechanic_exists
    FROM MECHANIC
    WHERE Mechanic_ID = p_mechanic_id
      AND Employment_Status = 'Active';

    IF v_booking_exists = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Booking does not exist';
    ELSEIF v_mechanic_exists = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Mechanic does not exist or is not active';
    ELSE
        INSERT INTO BOOKING_MECHANIC (
            Booking_ID, Mechanic_ID, Assigned_At,
            Work_Description, Work_Status
        )
        VALUES (
            p_booking_id, p_mechanic_id, CURRENT_TIMESTAMP,
            p_work_description, 'Not Started'
        );
    END IF;
END$$

-- 3. Update the work status of an existing assignment.
CREATE PROCEDURE sp_update_work_status(
    IN p_booking_id INT,
    IN p_mechanic_id INT,
    IN p_new_status VARCHAR(20)
)
BEGIN
    IF p_new_status NOT IN ('Not Started', 'In Progress', 'Completed') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid work status';
    END IF;

    UPDATE BOOKING_MECHANIC
    SET Work_Status = p_new_status
    WHERE Booking_ID = p_booking_id
      AND Mechanic_ID = p_mechanic_id;

    IF ROW_COUNT() = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Booking-mechanic assignment not found or unchanged';
    END IF;
END$$

-- 4. Retrieve all bookings for one customer.
CREATE PROCEDURE sp_get_customer_bookings(IN p_customer_id INT)
BEGIN
    SELECT
        c.Customer_ID,
        CONCAT(c.First_Name, ' ', c.Last_Name) AS Customer_Name,
        v.Registration_Number,
        b.Booking_ID,
        b.Appointment_Date,
        b.Appointment_Time,
        b.Booking_Status
    FROM CUSTOMER AS c
    INNER JOIN VEHICLE AS v
        ON v.Customer_ID = c.Customer_ID
    INNER JOIN BOOKING AS b
        ON b.Vehicle_ID = v.Vehicle_ID
    WHERE c.Customer_ID = p_customer_id
    ORDER BY b.Appointment_Date DESC;
END$$

DELIMITER ;

-- Example calls:
CALL sp_get_booking_details(1);
CALL sp_get_customer_bookings(1);

-- To test assignment, choose an existing booking and an active
-- mechanic who is not already assigned to that booking.
-- Example only; uncomment when ready:
-- CALL sp_assign_mechanic(13, 7, 'Diagnostic inspection');
-- CALL sp_update_work_status(13, 7, 'In Progress');
