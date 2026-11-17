
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const rl = createInterface({ input: stdin, output: stdout });

let connection;

try {
  const username = (await rl.question("Admin username: ")).trim();
  const email = (await rl.question("Admin email: ")).trim();
  const password = await rl.question("Choose admin password: ");

  if (!username || !email || password.length < 8 || password.length > 72) {
    throw new Error("Enter a username, valid email and password of 8-72 characters.");
  }

  connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  const [existing] = await connection.execute(
    "SELECT User_ID FROM APP_USER WHERE Username = ? OR Email = ?",
    [username, email]
  );

  if (existing.length > 0) {
    throw new Error("This username or email already exists. Choose another.");
  }

  const [roles] = await connection.execute(
    "SELECT Role_ID FROM ROLE WHERE Role_Name = 'Admin'"
  );

  if (roles.length === 0) {
    throw new Error("Admin role does not exist in the ROLE table.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await connection.beginTransaction();

  try {
    const [result] = await connection.execute(
      `INSERT INTO APP_USER (Username, Email, Password_Hash)
       VALUES (?, ?, ?)`,
      [username, email, passwordHash]
    );

    await connection.execute(
      `INSERT INTO USER_ROLE (User_ID, Role_ID)
       VALUES (?, ?)`,
      [result.insertId, roles[0].Role_ID]
    );

    await connection.commit();

    console.log("\nAdmin account created successfully!");
    console.log("User ID:", result.insertId);
    console.log("Username:", username);
    console.log("Email:", email);
    console.log("Role: Admin");
  } catch (error) {
    await connection.rollback();
    throw error;
  }
} catch (error) {
  console.error("\nAdmin setup failed:", error.message);
  process.exitCode = 1;
} finally {
  if (connection) await connection.end();
  rl.close();
}
