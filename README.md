# AutoCare – Car Service Management System

AutoCare is a web-based car service management system. It helps a car service centre manage customers, vehicles, service bookings, mechanics, invoices, payments, service reports, vehicle diagnostics, and customer feedback.

The application uses **Next.js** for the web interface and API routes, **MySQL** for structured service-centre data, and **MongoDB** for document-based information such as service reports, vehicle diagnostics, and customer feedback.

> **Important:** This README explains how to run the project on your own Windows computer for development/demo purposes. Each person must use their own local database credentials and create their own login accounts. Do not share `.env.local` or passwords.

---

## 1. Technology stack

| Part | Technology |
|---|---|
| Frontend and backend | Next.js 14, React 18, TypeScript |
| Styling | Tailwind CSS |
| Relational database | MySQL 8.0.16 or later |
| Document database | MongoDB |
| MySQL connection | `mysql2` |
| MongoDB connection | MongoDB Node.js driver |
| Authentication | bcrypt password hashing and JWT session cookie (`jose`) |

---

## 2. Software to install

Install the following before running the project:

### Required

1. **Node.js 20.19 or later** – includes npm. Use a supported current LTS release where possible.
   - Download: <https://nodejs.org/>
2. **Git** – to clone the GitHub repository.
   - Download: <https://git-scm.com/downloads>
3. **MySQL Server 8.0.16 or later** – stores customers, vehicles, bookings, services, mechanics, invoices, payments, and user/role information.
   - Download: <https://dev.mysql.com/downloads/mysql/>
4. **MongoDB Community Server** – stores service reports, vehicle diagnostics, and customer feedback.
   - Download: <https://www.mongodb.com/try/download/community>

### Recommended tools

- **Visual Studio Code** – to open and edit the project: <https://code.visualstudio.com/>
- **MySQL Workbench** – to import and inspect the MySQL database: <https://dev.mysql.com/downloads/workbench/>
- **MongoDB Compass** – to inspect MongoDB databases and collections: <https://www.mongodb.com/products/tools/compass>

After installation, open PowerShell and check the commands below:

```powershell
node --version
npm --version
git --version
mysql --version
mongosh --version
```

If `mysql` or `mongosh` is not recognised, use the installed application/service or add its executable folder to the Windows PATH.

---

## 3. Download the project from GitHub

Open PowerShell and run:

```powershell
git clone https://github.com/shreeranganathsaravade78/car-service-management.git
cd car-service-management
code .
```

If the `code` command is unavailable, open Visual Studio Code manually and select **File → Open Folder**, then choose the `car-service-management` folder.

Install the project dependencies from the project root:

```powershell
npm ci
```

`npm ci` uses the committed `package-lock.json` to install the project's dependencies.

---

## 4. Set up the MySQL database

1. Start the MySQL Server service.
2. Open MySQL Workbench and connect to your local MySQL server.
3. In MySQL Workbench, choose **File → Open SQL Script**.
4. Open this project file:

   `database/car_service.sql`

5. Execute the script.
6. Refresh the Schemas panel and confirm that the `car_service` database has been created.

### Database safety warning

**The SQL setup script is destructive.** It starts with `DROP DATABASE IF EXISTS car_service;` and then recreates the database with its tables, views, triggers, stored procedure, and sample data. Run it only on a fresh/local development database that you are happy to replace. Back up any database you need before executing the script. Do not run it against an existing or important `car_service` database containing data you want to keep.

The SQL file creates the **MySQL** database only. MongoDB is configured separately in the next section.

---

## 5. Set up MongoDB

1. Install MongoDB Community Server.
2. Start the MongoDB service. If it was installed as a Windows service, check the Windows **Services** application and start the MongoDB Server service.
3. The local connection string used for a standard local installation is:

   ```text
   mongodb://127.0.0.1:27017
   ```

4. The application uses the database name `car_service_nosql` by default. The application creates its collections when data is first inserted; you do not need to create the collections manually for a fresh setup.

MongoDB Compass is optional. You can connect it to `mongodb://127.0.0.1:27017` to inspect the data.

---

## 6. Configure environment variables

In the **root of the project**, create a file named exactly:

```text
.env.local
```

The file must be beside `package.json`, not inside the `app` folder.

Add the following configuration and replace the MySQL password with the password created during your MySQL installation:

```env
# MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=YOUR_MYSQL_PASSWORD
MYSQL_DATABASE=car_service

# MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=car_service_nosql

# Session signing secret
SESSION_SECRET=PASTE_YOUR_RANDOM_SECRET_HERE
```

Generate a random session secret in PowerShell from the project folder:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the generated value and replace `PASTE_YOUR_RANDOM_SECRET_HERE` in `.env.local`.

**Keep `.env.local private.** Do not upload it to GitHub, send it to friends, or commit it. Every person running the project should create their own `.env.local` with their own local database password and a newly generated session secret.

---

## 7. Create the Admin account

The database setup creates the role records and sample business data, but it does not create an application Admin login. Create one for your local installation.

From the project root, run:

```powershell
node --env-file=.env.local scripts/create-admin.mjs
```

Follow the prompts to enter the Admin username, email, and password. Use these details later on the login page.

Do not use another person's password. Each person should create their own local Admin account.

---

## 8. Run the application

Make sure both database services are running:

- MySQL Server
- MongoDB Server

Then, from the project root, start Next.js:

```powershell
npm run dev
```

Open the application in your browser:

<http://localhost:3000>

To stop the development server, focus the PowerShell terminal and press `Ctrl + C`.

### Useful commands

```powershell
# Start the development server
npm run dev

# Check ESLint
npm run lint

# Check TypeScript types
npx tsc --noEmit

# Create an optimised production build
npm run build

# Start the production build after building
npm run start
```

---

## 9. Login and registration

### Admin

Use the username/email and password entered when running the Admin creation script. The Admin account can access the staff management dashboard.

### Customer

1. Open the application's Register page.
2. Create a customer account with the requested details.
3. Log in using the new Customer account.

Public registration is for **Customer** accounts. It does not allow a visitor to register as an Admin, Receptionist, or Mechanic.

### Receptionist and Mechanic accounts

The database contains the Receptionist and Mechanic roles, but public self-registration is not provided for these staff roles. They must be provisioned by the project administrator/developer with the correct role assignment (and a linked mechanic profile for a Mechanic account). The Admin creation script creates Admin accounts only. Do not simply change a Customer's role without also checking the required user/profile relationships.

---

## 10. User roles and what they can access

The application uses role-based access control. A user sees the dashboard sections permitted for their role, and the API also checks permissions so that access is not based only on hiding a menu item.

| Role | Main purpose | Access and actions |
|---|---|---|
| **Admin** | Manage the service centre | Broad staff-management access to the main modules, including customer/vehicle and booking operations, services, mechanics, invoices, and payment records. Admin can view, create, update, and delete service reports and vehicle diagnostic records. |
| **Receptionist** | Front-desk operations | Can view service reports and vehicle diagnostics. These two records are read-only for this role. Other staff sections depend on the permissions provided by the application. |
| **Mechanic** | Repair and service work | Can view service reports and vehicle diagnostics and create new service reports and diagnostic records. The role does not have Admin-level update/delete permissions for these records. |
| **Customer** | View and request their own car services | Can view their own profile, vehicles, bookings, invoices, payment history, and vehicle diagnostics; can register vehicles, make bookings for their own vehicles, submit customer feedback, and submit a payment record for their own invoice. Customers cannot view internal service reports or other customers' records. |

### Customer dashboard sections

A Customer can see the following customer-facing sections:

- **My Profile** – view their profile details.
- **My Vehicles** – view and register their vehicles.
- **My Bookings** – view their bookings and create bookings for their own vehicles.
- **My Invoices** – view their own invoices.
- **My Payments** – view their own payment history and submit a payment record for an invoice.
- **Customer Feedback** – submit and manage their own feedback entries.
- **My Vehicle Diagnostics** – view diagnostic information associated with their own vehicles.

### Staff and internal sections

The staff dashboard contains management and operational sections according to the signed-in role. These include service-centre records such as services, mechanics, bookings, invoices, payments, service reports, and vehicle diagnostics. For service reports, Admin and Mechanic can create records, while Admin can also update/delete them; Admin, Receptionist, and Mechanic can view them. For vehicle diagnostics, Admin and Mechanic can create records, while Admin has the management permissions; Admin, Receptionist, and Mechanic can view all diagnostic records. Customers can only view diagnostics associated with their own vehicles.

> **Payment note:** The payment module records payment details/status in the application. It is not a connection to a real bank, UPI app, card processor, or payment gateway. Do not treat a submitted payment record as proof that money was actually transferred.

---

## 11. Databases used by the project

### MySQL – `car_service`

MySQL stores the main relational data, including:

- Customers and vehicles
- Service bookings and booking status
- Services and mechanics
- Service and mechanic assignments to bookings
- Invoices and payment records
- Application users and their roles
- Invoice total and outstanding-balance views

### MongoDB – `car_service_nosql`

MongoDB stores document-oriented records, including collections for:

- `service_reports`
- `vehicle_diagnostics`
- `customer_feedback`

The MongoDB database/collections can be inspected in MongoDB Compass after the application has inserted records.

---

## 12. Project folder structure

```text
car-service-management/
├── advanced_sql/       # Additional SQL practice: DML, joins, subqueries, CTEs, triggers, etc.
├── app/                # Next.js pages, layouts, and API routes
├── database/           # Main MySQL database setup script
├── lib/                # MySQL, MongoDB, and session/authentication helpers
├── scripts/            # Utility scripts, including Admin account creation
├── .env.local          # Local secrets and database configuration (create this yourself)
├── package.json        # Project dependencies and commands
└── package-lock.json   # Locked dependency versions
```

The `advanced_sql` directory contains additional SQL examples for the DBMS coursework. They are separate from the main application startup process and are not required to launch the website.

---

## 13. Troubleshooting

### `ECONNREFUSED` for MySQL

- Make sure MySQL Server is running.
- Check `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, and `MYSQL_PASSWORD` in `.env.local`.
- Confirm the `car_service` database exists.

### `ECONNREFUSED` for MongoDB

- Make sure MongoDB Server is running.
- Check that `MONGODB_URI` is `mongodb://127.0.0.1:27017` for a standard local installation.

### Admin creation script cannot connect

- Confirm `.env.local` is in the project root.
- Confirm the MySQL service and credentials are correct.
- Confirm the `car_service` database has been created by the SQL setup script.

### Login or session problems

- Confirm `SESSION_SECRET` is present in `.env.local`.
- Restart `npm run dev` after changing `.env.local`.
- Make sure the account is Active and has the intended role assignment.

### Port 3000 is already in use

Stop the other development server, or allow Next.js to use another available port if it prompts you.

### Dependencies are missing

From the project root, run:

```powershell
npm ci
```

---

## 14. Quick start checklist

- [ ] Install Node.js, Git, MySQL Server, and MongoDB Server.
- [ ] Clone the GitHub repository.
- [ ] Run `npm ci`.
- [ ] Start MySQL and execute `database/car_service.sql` on a fresh/local database.
- [ ] Start MongoDB Server.
- [ ] Create `.env.local` with the MySQL, MongoDB, and session settings.
- [ ] Create an Admin account using `node --env-file=.env.local scripts/create-admin.mjs`.
- [ ] Run `npm run dev`.
- [ ] Open <http://localhost:3000> and log in as Admin or register as Customer.

---

## Repository

GitHub: <https://github.com/shreeranganathsaravade78/car-service-management>
