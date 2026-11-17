-- =========================================================
-- 08_TRIGGERS.SQL
-- Additional business-rule triggers.
--
-- The updated base database already creates:
--   trg_booking_mechanic_active_insert
--   trg_booking_mechanic_active_update
--   trg_payment_status_after_insert
--   trg_payment_status_after_update
--   trg_payment_status_after_delete
--
-- This file adds:
--   1. Prevent successful payments exceeding invoice balance.
--   2. Prevent completing a booking without services and
--      completed mechanic assignments.
-- =========================================================

USE car_service;

DROP TRIGGER IF EXISTS trg_payment_limit_before_insert;
DROP TRIGGER IF EXISTS trg_payment_limit_before_update;
DROP TRIGGER IF EXISTS trg_booking_completion_before_update;

DELIMITER $$

-- 1. BEFORE INSERT: do not allow a successful payment to
-- exceed the invoice's remaining balance.
CREATE TRIGGER trg_payment_limit_before_insert
BEFORE INSERT ON PAYMENT
FOR EACH ROW
BEGIN
    DECLARE v_invoice_total DECIMAL(12,2) DEFAULT 0.00;
    DECLARE v_existing_paid DECIMAL(12,2) DEFAULT 0.00;

    IF NEW.Payment_Status = 'Success' THEN
        SELECT COALESCE(Total_Amount, 0.00)
        INTO v_invoice_total
        FROM Invoice_Total_View
        WHERE Invoice_ID = NEW.Invoice_ID;

        SELECT COALESCE(SUM(Amount), 0.00)
        INTO v_existing_paid
        FROM PAYMENT
        WHERE Invoice_ID = NEW.Invoice_ID
          AND Payment_Status = 'Success';

        IF v_existing_paid + NEW.Amount > v_invoice_total THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Payment exceeds the outstanding invoice balance';
        END IF;
    END IF;
END$$

-- 2. BEFORE UPDATE: validate the new successful-payment total.
CREATE TRIGGER trg_payment_limit_before_update
BEFORE UPDATE ON PAYMENT
FOR EACH ROW
BEGIN
    DECLARE v_invoice_total DECIMAL(12,2) DEFAULT 0.00;
    DECLARE v_existing_paid DECIMAL(12,2) DEFAULT 0.00;

    IF NEW.Payment_Status = 'Success' THEN
        SELECT COALESCE(Total_Amount, 0.00)
        INTO v_invoice_total
        FROM Invoice_Total_View
        WHERE Invoice_ID = NEW.Invoice_ID;

        SELECT COALESCE(SUM(Amount), 0.00)
        INTO v_existing_paid
        FROM PAYMENT
        WHERE Invoice_ID = NEW.Invoice_ID
          AND Payment_Status = 'Success'
          AND Payment_ID <> OLD.Payment_ID;

        IF v_existing_paid + NEW.Amount > v_invoice_total THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Updated payment exceeds the outstanding invoice balance';
        END IF;
    END IF;
END$$

-- 3. BEFORE UPDATE: a booking can be marked Completed only
-- when it has at least one selected service and at least one
-- assigned mechanic, and every assigned mechanic is completed.
CREATE TRIGGER trg_booking_completion_before_update
BEFORE UPDATE ON BOOKING
FOR EACH ROW
BEGIN
    DECLARE v_service_count INT DEFAULT 0;
    DECLARE v_mechanic_count INT DEFAULT 0;
    DECLARE v_incomplete_count INT DEFAULT 0;

    IF NEW.Booking_Status = 'Completed'
       AND OLD.Booking_Status <> 'Completed' THEN

        SELECT COUNT(*)
        INTO v_service_count
        FROM BOOKING_SERVICE
        WHERE Booking_ID = NEW.Booking_ID;

        SELECT COUNT(*)
        INTO v_mechanic_count
        FROM BOOKING_MECHANIC
        WHERE Booking_ID = NEW.Booking_ID;

        SELECT COUNT(*)
        INTO v_incomplete_count
        FROM BOOKING_MECHANIC
        WHERE Booking_ID = NEW.Booking_ID
          AND Work_Status <> 'Completed';

        IF v_service_count = 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Cannot complete booking without at least one service';
        ELSEIF v_mechanic_count = 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Cannot complete booking without an assigned mechanic';
        ELSEIF v_incomplete_count > 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Cannot complete booking while mechanic work is incomplete';
        END IF;
    END IF;
END$$

DELIMITER ;

-- Inspect triggers:
SHOW TRIGGERS FROM car_service;

-- Safe test idea:
-- Try inserting a successful payment larger than the balance
-- of an invoice. The payment trigger should reject it.
-- Do not use a valid real payment amount for this test.
