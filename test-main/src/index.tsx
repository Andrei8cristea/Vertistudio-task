import { serve } from "bun";
import { Database } from "bun:sqlite";
import { seedDatabase } from "./seed";
import { computeBitSlow } from "./bitslow";
import { spawnSync } from "bun";

const db = new Database(":memory:");

// Seed the database
seedDatabase(db, {
  clientCount: 30,
  bitSlowCount: 20,
  transactionCount: 50,
  clearExisting: true,
});

// Creează tabela users dacă nu există
db.query(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL
  );
`).run();

const server = serve({
  fetch: async (req) => {
    const url = new URL(req.url);

    // Servim /register (HTML static)
    if (req.method === "GET" && url.pathname === "/register") {
      return new Response(await Bun.file("./src/register.html"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Form POST la /register (înregistrare user)
    if (req.method === "POST" && url.pathname === "/register") {
      const form = await req.formData();
      const username = String(form.get("username"));
      const password = String(form.get("password"));

      const result = spawnSync(["python3", "./hash.py", password]);
      if (result.exitCode !== 0) {
        return new Response("Hashing failed", { status: 500 });
      }

      const [salt, hashed] = result.stdout.toString().trim().split("$");
      try {
        db.query("INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)")
          .run(username, hashed, salt);
        return new Response("Registered successfully!", { status: 201 });
      } catch (e) {
        return new Response("User already exists or DB error", { status: 400 });
      }
    }

    // API: returnează tranzacțiile
    if (req.method === "GET" && url.pathname === "/api/transactions") {
      try {
        const transactions = db.query(`
          SELECT 
            t.id, t.coin_id, t.amount, t.transaction_date,
            seller.id AS seller_id, seller.name AS seller_name,
            buyer.id AS buyer_id, buyer.name AS buyer_name,
            c.bit1, c.bit2, c.bit3, c.value
          FROM transactions t
          LEFT JOIN clients seller ON t.seller_id = seller.id
          JOIN clients buyer ON t.buyer_id = buyer.id
          JOIN coins c ON t.coin_id = c.coin_id
          ORDER BY t.transaction_date DESC
        `).all();

        const enhanced = transactions.map((t) => ({
          ...t,
          computedBitSlow: computeBitSlow(t.bit1, t.bit2, t.bit3),
        }));

        return Response.json(enhanced);
      } catch (err) {
        return new Response("DB error", { status: 500 });
      }
    }

    // Altfel, fallback: index.html
    if (req.method === "GET") {
      return new Response(await Bun.file("./src/index.html"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
  port: 3000,
});

console.log(`🚀 Server running at http://localhost:3000`);
