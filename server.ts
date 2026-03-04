import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import nodemailer from "nodemailer";

const db = new Database("tracker.db");

// Email Transporter Setup
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendMail({ to, subject, text, html }: { to: string, subject: string, text: string, html: string }) {
  if (!process.env.SMTP_HOST) {
    console.warn("SMTP_HOST not configured. Email not sent to " + to + ". Check console for links.");
    console.log(`[SIMULATED EMAIL] To: ${to}\nSubject: ${subject}\nText: ${text}`);
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@example.com',
      to,
      subject,
      text,
      html
    });
    console.log(`[EMAIL SENT] To: ${to}`);
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send to ${to}:`, error);
  }
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT CHECK(role IN ('admin', 'user')) DEFAULT 'user',
    name TEXT,
    status TEXT DEFAULT 'active',
    invitation_token TEXT,
    reset_token TEXT,
    reset_token_expiry DATETIME
  );

  CREATE TABLE IF NOT EXISTS visit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    client_name TEXT,
    date_from TEXT,
    date_to TEXT,
    purpose TEXT CHECK(purpose IN ('Installation', 'Exam Support')),
    systems_installed INTEGER,
    students_enrolled INTEGER,
    students_attended INTEGER,
    remarks TEXT,
    travel_cost REAL DEFAULT 0,
    lodging_cost REAL DEFAULT 0,
    misc_expense REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Simple Migration: Ensure columns exist if table was created before
const columnsToAdd = [
  { name: 'status', type: 'TEXT DEFAULT "active"' },
  { name: 'invitation_token', type: 'TEXT' },
  { name: 'reset_token', type: 'TEXT' },
  { name: 'reset_token_expiry', type: 'DATETIME' }
];

for (const col of columnsToAdd) {
  try {
    db.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
  } catch (e) {
    // Column might already exist, ignore error
  }
}

// Seed Admin if not exists
const adminEmail = "shuvansathieshvt@gmail.com";
const adminExists = db.prepare("SELECT * FROM users WHERE username = ?").get(adminEmail);
if (!adminExists) {
  // Check if old 'admin' exists and update it, or insert new
  const oldAdmin = db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
  if (oldAdmin) {
    db.prepare("UPDATE users SET username = ? WHERE username = 'admin'").run(adminEmail);
  } else {
    db.prepare("INSERT INTO users (username, password, role, name, status) VALUES (?, ?, ?, ?, ?)").run(adminEmail, "admin123", "admin", "System Administrator", "active");
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // Auth
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT id, username, role, name, status FROM users WHERE username = ? AND password = ?").get(username, password);
    if (user) {
      if (user.status === 'pending') {
        return res.status(403).json({ error: "Account not activated. Please check your email." });
      }
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.post("/api/auth/forgot-password", (req, res) => {
    const { username } = req.body;
    const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (!user) return res.status(404).json({ error: "User not found" });

    const token = crypto.randomBytes(20).toString('hex');
    const expiry = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 mins

    db.prepare("UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?").run(token, expiry, user.id);
    
    const appUrl = process.env.APP_URL || `http://localhost:3000`;
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    sendMail({
      to: username,
      subject: "Password Reset Request",
      text: `You requested a password reset. Click here to reset: ${resetLink}. This link is valid for 5 minutes.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #4f46e5;">Password Reset</h2>
          <p>You requested a password reset for your Client Visit Tracker account.</p>
          <p>Click the button below to set a new password. This link is valid for <strong>5 minutes</strong>.</p>
          <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">Reset Password</a>
          <p style="color: #666; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `
    });

    res.json({ success: true, message: "Reset link sent to your email (valid for 5 mins)" });
  });

  app.post("/api/auth/reset-password", (req, res) => {
    const { token, password } = req.body;
    const user = db.prepare("SELECT id FROM users WHERE reset_token = ? AND reset_token_expiry > ?").get(token, new Date().toISOString());
    
    if (!user) return res.status(400).json({ error: "Invalid or expired reset token" });

    db.prepare("UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?").run(password, user.id);
    res.json({ success: true });
  });

  // User Management
  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT id, username, role, name, status FROM users").all();
    res.json(users);
  });

  app.post("/api/users/invite", (req, res) => {
    const { username, role } = req.body;
    const token = crypto.randomBytes(20).toString('hex');
    try {
      db.prepare("INSERT INTO users (username, role, status, invitation_token) VALUES (?, ?, ?, ?)").run(username, role, 'pending', token);
      
      const appUrl = process.env.APP_URL || `http://localhost:3000`;
      const inviteLink = `${appUrl}/activate?token=${token}`;

      sendMail({
        to: username,
        subject: "Invitation to Client Visit Tracker",
        text: `You have been invited to Client Visit Tracker. Click here to activate your account: ${inviteLink}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #4f46e5;">Welcome to Visit Tracker</h2>
            <p>You have been invited to join the Client Visit Tracker system.</p>
            <p>Click the button below to activate your account and set your password.</p>
            <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">Activate Account</a>
            <p style="color: #666; font-size: 12px;">If you were not expecting this invitation, please contact your administrator.</p>
          </div>
        `
      });

      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "User already exists" });
    }
  });

  app.post("/api/users/activate", (req, res) => {
    const { token, name, password } = req.body;
    const user = db.prepare("SELECT id FROM users WHERE invitation_token = ?").get(token);
    if (!user) return res.status(400).json({ error: "Invalid invitation token" });

    db.prepare("UPDATE users SET name = ?, password = ?, status = 'active', invitation_token = NULL WHERE id = ?").run(name, password, user.id);
    res.json({ success: true });
  });

  app.put("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const { username, role } = req.body;
    try {
      db.prepare("UPDATE users SET username = ?, role = ? WHERE id = ?").run(username, role, id);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Username already exists" });
    }
  });

  app.delete("/api/users/:id", (req, res) => {
    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Visit Logs
  app.get("/api/logs", (req, res) => {
    const { userId, role, employeeId } = req.query;
    let logs;
    let query = `
      SELECT visit_logs.*, users.name as user_name 
      FROM visit_logs 
      JOIN users ON visit_logs.user_id = users.id
    `;
    let params: any[] = [];

    if (role === 'admin') {
      if (employeeId && employeeId !== 'All') {
        query += " WHERE visit_logs.user_id = ?";
        params.push(employeeId);
      }
    } else {
      query += " WHERE visit_logs.user_id = ?";
      params.push(userId);
    }

    query += " ORDER BY date_from DESC";
    logs = db.prepare(query).all(...params);
    res.json(logs);
  });

  app.post("/api/logs", (req, res) => {
    const { 
      user_id, client_name, date_from, date_to, purpose, 
      systems_installed, students_enrolled, students_attended, 
      remarks, travel_cost, lodging_cost, misc_expense 
    } = req.body;
    
    const result = db.prepare(`
      INSERT INTO visit_logs (
        user_id, client_name, date_from, date_to, purpose, 
        systems_installed, students_enrolled, students_attended, 
        remarks, travel_cost, lodging_cost, misc_expense
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user_id, client_name, date_from, date_to, purpose, 
      systems_installed || null, students_enrolled || null, students_attended || null, 
      remarks, travel_cost || 0, lodging_cost || 0, misc_expense || 0
    );
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/logs/:id", (req, res) => {
    const { id } = req.params;
    const { 
      client_name, date_from, date_to, purpose, 
      systems_installed, students_enrolled, students_attended, 
      remarks, travel_cost, lodging_cost, misc_expense 
    } = req.body;

    db.prepare(`
      UPDATE visit_logs SET 
        client_name = ?, date_from = ?, date_to = ?, purpose = ?, 
        systems_installed = ?, students_enrolled = ?, students_attended = ?, 
        remarks = ?, travel_cost = ?, lodging_cost = ?, misc_expense = ?
      WHERE id = ?
    `).run(
      client_name, date_from, date_to, purpose, 
      systems_installed || null, students_enrolled || null, students_attended || null, 
      remarks, travel_cost || 0, lodging_cost || 0, misc_expense || 0, id
    );
    res.json({ success: true });
  });

  app.delete("/api/logs/:id", (req, res) => {
    db.prepare("DELETE FROM visit_logs WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Dashboard Stats
  app.get("/api/stats", (req, res) => {
    const { userId, role } = req.query;
    let stats;
    const query = `
      SELECT 
        COUNT(*) as total_visits,
        COUNT(DISTINCT client_name) as total_clients,
        SUM(julianday(date_to) - julianday(date_from) + 1) as total_days,
        SUM(systems_installed) as total_installations,
        SUM(students_enrolled) as total_enrolled,
        SUM(students_attended) as total_attended
      FROM visit_logs
    `;
    
    if (role === 'admin') {
      stats = db.prepare(query).get();
    } else {
      stats = db.prepare(`${query} WHERE user_id = ?`).get(userId);
    }

    const totalEnrolled = stats.total_enrolled || 0;
    const totalAttended = stats.total_attended || 0;
    const successRate = totalEnrolled > 0 ? (totalAttended / totalEnrolled) * 100 : 0;

    res.json({
      total_visits: stats.total_visits || 0,
      total_clients: stats.total_clients || 0,
      total_days: Math.round(stats.total_days || 0),
      total_installations: stats.total_installations || 0,
      success_rate: parseFloat(successRate.toFixed(2))
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
