import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  try {
    const uri = process.env.DATABASE_URL;
    if (!uri) throw new Error('DATABASE_URL not set');

    const url = new URL(uri);
    const dbName = url.pathname.replace(/^\//, '');
    url.pathname = '/'; // connect without specific DB

    const connection = await mysql.createConnection({
      uri: url.toString(),
      ssl: { rejectUnauthorized: false },
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`Database ${dbName} ensured.`);
    await connection.end();
  } catch (err) {
    console.error('Failed to create database:', err.message || err);
    process.exit(1);
  }
}

main();

