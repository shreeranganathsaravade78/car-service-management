-- =========================================================
-- 01_DML_OPERATIONS.SQL
-- Database: car_service
-- Demonstrates INSERT, SELECT, UPDATE and DELETE.
--
-- Safe practice:
-- Uses a dedicated test customer (Customer_ID = 9999).
-- Run this file on the development database, not production.
-- The transaction is committed after the test row is deleted.
-- =========================================================

USE car_service;

START TRANSACTION;

-- 1. INSERT: add a temporary test customer.
INSERT INTO CUSTOMER (
    Customer_ID, First_Name, Last_Name, Phone, Email,
    House_Number, Street, Area, City, State, Postal_Code
)
VALUES (
    9999, 'Test', 'Customer', '9876500000',
    'test.customer@example.com', '1', 'Test Road',
    'Test Area', 'Bengaluru', 'Karnataka', '560001'
);

-- 2. SELECT: retrieve the inserted customer.
SELECT *
FROM CUSTOMER
WHERE Customer_ID = 9999;

-- 3. UPDATE: change the phone number.
UPDATE CUSTOMER
SET Phone = '9123400000'
WHERE Customer_ID = 9999;

-- Verify the update.
SELECT Customer_ID, First_Name, Last_Name, Phone
FROM CUSTOMER
WHERE Customer_ID = 9999;

-- 4. DELETE: remove the temporary customer.
-- This customer has no vehicle or booking, so no FK is violated.
DELETE FROM CUSTOMER
WHERE Customer_ID = 9999;

-- Verify that the temporary row is gone.
SELECT *
FROM CUSTOMER
WHERE Customer_ID = 9999;

COMMIT;

-- Expected final result: the last SELECT returns zero rows.
