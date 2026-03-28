import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  try {
    const uri = process.env.DATABASE_URL;
    if (!uri) {
      throw new Error('DATABASE_URL is not defined');
    }

    const connection = await mysql.createConnection({
      uri,
      ssl: {
        rejectUnauthorized: false,
      },
    });
    await connection.query('SELECT 1');
    console.log('Connected successfully!');
    await connection.end();
  } catch (err) {
    console.error('Connection failed:', err.message || err);
    process.exit(1);
  }
}

main();
