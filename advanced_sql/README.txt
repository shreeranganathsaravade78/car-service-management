# Car Service Management - Advanced SQL Files

Database: `car_service`
Target: MySQL 8.0.16+

## Files

1. `01_dml_operations.sql` - INSERT, SELECT, UPDATE, DELETE using a temporary test customer.
2. `02_join_queries.sql` - INNER, LEFT, RIGHT and multi-table joins.
3. `03_nested_queries.sql` - IN, EXISTS, scalar and derived-table subqueries.
4. `04_correlated_queries.sql` - correlated EXISTS and scalar subqueries.
5. `05_cte_queries.sql` - CTE, multiple CTEs and recursive date calendar.
6. `06_stored_procedures.sql` - booking lookup, mechanic assignment, work status update and customer booking procedures.
7. `07_functions.sql` - service total, invoice total and outstanding balance functions.
8. `08_triggers.sql` - payment limit and booking completion validation triggers.

## Recommended execution order

Run the files in this order:

`01` -> `02` -> `03` -> `04` -> `05` -> `06` -> `07` -> `08`

Run each file in MySQL Workbench after selecting the `car_service` connection.

## Important notes

- The updated base database script already creates the `Refresh_Invoice_Status` procedure and several triggers. The procedure and trigger file names in this pack are different to avoid duplicate object names.
- `01_dml_operations.sql` inserts and deletes a temporary customer with ID 9999. It commits after deleting the test row.
- `06_stored_procedures.sql` creates new procedures. The example assignment calls are commented out.
- `07_functions.sql` creates user-defined functions. Some MySQL configurations with binary logging may require an administrator to configure `log_bin_trust_function_creators`.
- `08_triggers.sql` adds additional validation. Payment-limit triggers are suitable for a classroom demonstration; production payment systems should also use transactions and appropriate locking to prevent concurrent overpayment races.
- The recursive CTE uses a seven-day date sequence because the current schema has no natural employee or category hierarchy.
- Do not run these scripts against a production database. Use your local project database and keep a backup.
