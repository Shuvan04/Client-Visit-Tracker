import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Resend } from "resend";
import * as admin from "firebase-admin";

// Firebase Admin Setup
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "client-visit-tracker-5778e",
      clientEmail: "firebase-adminsdk-fbsvc@client-visit-tracker-5778e.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDG7wphs1s3kSLp\nl6nb79qUfBYjyfDqfNRUueeHN/vButjjGq6vJKnB0Oii1Bd9Jdas8ZPF4zw7LWqD\nYjYrAEzvNMtgLcJauwZdOp14+PXWwLOJt6yCeZPX15GQsRjSzFqGW+74V3KUmJ4w\nzcvI4WCncjvFXr5mRR4M55n6rU2a2SMbzIRMzVhA/5SSpGFTO+RsQl3vkyA7y7RE\ne+bVdK5YKxSYbmVTgvQB4pL66W8GP1oh8sC8qtBziZd87pAugDcZAizL177bK7qO\n7iCSVQ4jZgGDQyTLfy3PkovFhpzULgry6DJJxc+PJUexkXnVSncNfEwHQxoOKaeb\naGtvYsSfAgMBAAECggEAHQz6bKMXDonM2eTygrJHrshiKU7LtkqNbWQKmhYEV1m0\nY5HZca0+dxXNaz3iwj1c2Luck1joSlILDG2ysFvmYEZK7twv1jUarFGrfmeI6xgP\n/+wJLrKXcv1BfipGkD4UeCuDvdNzYZzZ+RGMkWTMSxek/+Eil+e/CC5oL5HQU+zg\nyNCd3DhpsdPo7W4/Pn7Oh+EMzb/JLfge1Rs8f9GpxC9hZOgDoyFNT/qycQifK+3Y\nbxQ1eUFvT8sxSxzL/9x5a6ffBaF6cnQ/k9tVEtQym4APHAADT7Pbkc0skbGhV6AK\nuRvq2gwFrcV3XtrZf0Bb6M8baJoiSTD6w2QZwU50dQKBgQDiW6EZoZprkzW0ALb6\n7r2UztQiYr5bl6WHN3yoaqPeeUFPtbdGYW+UNbp2tQnSxNJFmfONkz8WSzV5RM59\nMvfNkYuIkX0UkXeLcm9hW0Ms0/lYF8VMlro+XhULPmr5VcuKzd+NJuHAlIQkS1hK\nvlD0VsFQ9/mAa+KhNjqWIvS1xQKBgQDg/Ayw4CCrsw4pBgocNiLh92Xy7q0TIQE6\nTHvPeZA2EaAFNX378Nw4Nwt9xDF7r/34FfncrwU8swIJbV3SJwb3iQ+BqxnByeER\nWbLsJh3/wi+eMnkddAMvn3p4MvNhcaRcPl/jNT5zRBrNO42UoC/R4sx3+KgloPWr\nZii09i+bEwKBgQCNDpyt5E7eirYEng1pAi2R9fGsG+yUF0RHpwQ/z3SexuE0UwEL\nEtz9dx3jq52bgpumU/G6X/AIbIW+NGqZCpHxwKk7Sa6wipX8iCtwd/a8kLvpcaa5\nu5QEGYzznMn85sIYlYKh64DzCZnvJCS5LzAzk3yUgHMy3Ag2fhy0QsRMIQKBgEJA\nlvAjIBvPv5S/DY0fOAh41RHDzT2702O6kB8Zuijh6dB+3xmo5QC83OptMvEsc0py\nFkExXQZx5GCoTx+KlJeiSemyXARgEaINWw4Fb4IYSfN5A4dz2VhVyzfIMTl5wJ/V\nUmFTFY/V91qGdfvVbB+PfQy7MbDbBF0z2Tro4D33AoGBALQMPmFozs8rYfB+783d\n9JBZbgrhRctCxmkGdRENdVmZzLxfd5Rv7JpMgG9bbLXYjvcApXE+Z7E2RbP9Gy8M\neBZPU/YYgKMxqc0+Vist4pGgMtKOtp9QSTgfBmW33LU0jxw26aTcqkoiaRlftjjM\nmr5LXSxzmkI0dKNYlKdEN1VM\n-----END PRIVATE KEY-----\n",
    }),
  });
}

const db = admin.firestore();

// Resend Setup
const resend = new Resend('re_NfDLyKq5_FwsNgo2kRqMK7dPXB2hTggVj');

async function sendMail({ to, subject, text, html }: { to: string, subject: string, text: string, html: string }) {
  if (!resend) {
    console.warn("RESEND_API_KEY not configured. Email not sent to " + to + ". Check console for links.");
    console.log(`[SIMULATED EMAIL] To: ${to}\nSubject: ${subject}\nText: ${text}`);
    return;
  }
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.MAIL_FROM || 'onboarding@resend.dev',
      to: [to],
      subject,
      text,
      html
    });
    
    if (error) {
      throw error;
    }
    
    console.log(`[EMAIL SENT] ID: ${data?.id} To: ${to}`);
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send to ${to}:`, error);
  }
}

// Seed Admin if not exists
async function seedAdmin() {
  if (!db) return;
  const adminEmail = "shuvansathieshvt@gmail.com";
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('username', '==', adminEmail).get();
  
  if (snapshot.empty) {
    // Check for old 'admin'
    const oldAdminSnapshot = await usersRef.where('username', '==', 'admin').get();
    if (!oldAdminSnapshot.empty) {
      const oldAdminDoc = oldAdminSnapshot.docs[0];
      await oldAdminDoc.ref.update({ username: adminEmail });
    } else {
      await usersRef.add({
        username: adminEmail,
        password: "admin123",
        role: "admin",
        name: "System Administrator",
        status: "active",
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  if (db) {
    await seedAdmin();
  }

  // --- API Routes ---

  // Auth
  app.post("/api/login", async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const { username, password } = req.body;
    const snapshot = await db.collection('users')
      .where('username', '==', username)
      .where('password', '==', password)
      .get();

    if (!snapshot.empty) {
      const userDoc = snapshot.docs[0];
      const user = { id: userDoc.id, ...userDoc.data() } as any;
      if (user.status === 'pending') {
        return res.status(403).json({ error: "Account not activated. Please check your email." });
      }
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const { username } = req.body;
    const snapshot = await db.collection('users').where('username', '==', username).get();
    
    if (snapshot.empty) return res.status(404).json({ error: "User not found" });
    const userDoc = snapshot.docs[0];

    const token = crypto.randomBytes(20).toString('hex');
    const expiry = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 mins

    await userDoc.ref.update({
      reset_token: token,
      reset_token_expiry: expiry
    });
    
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

  app.post("/api/auth/reset-password", async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const { token, password } = req.body;
    const now = new Date().toISOString();
    
    const snapshot = await db.collection('users')
      .where('reset_token', '==', token)
      .where('reset_token_expiry', '>', now)
      .get();
    
    if (snapshot.empty) return res.status(400).json({ error: "Invalid or expired reset token" });
    const userDoc = snapshot.docs[0];

    await userDoc.ref.update({
      password: password,
      reset_token: admin.firestore.FieldValue.delete(),
      reset_token_expiry: admin.firestore.FieldValue.delete()
    });
    res.json({ success: true });
  });

  // User Management
  app.get("/api/users", async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const snapshot = await db.collection('users').get();
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(users);
  });

  app.post("/api/users/invite", async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const { username, role } = req.body;
    const token = crypto.randomBytes(20).toString('hex');
    
    const existingSnapshot = await db.collection('users').where('username', '==', username).get();
    if (!existingSnapshot.empty) {
      return res.status(400).json({ error: "User already exists" });
    }

    try {
      await db.collection('users').add({
        username,
        role,
        status: 'pending',
        invitation_token: token,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
      
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
      res.status(400).json({ error: "Error creating user" });
    }
  });

  app.post("/api/users/activate", async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const { token, name, password } = req.body;
    const snapshot = await db.collection('users').where('invitation_token', '==', token).get();
    
    if (snapshot.empty) return res.status(400).json({ error: "Invalid invitation token" });
    const userDoc = snapshot.docs[0];

    await userDoc.ref.update({
      name,
      password,
      status: 'active',
      invitation_token: admin.firestore.FieldValue.delete()
    });
    res.json({ success: true });
  });

  app.put("/api/users/:id", async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const { id } = req.params;
    const { username, role } = req.body;
    try {
      await db.collection('users').doc(id).update({ username, role });
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Error updating user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    await db.collection('users').doc(req.params.id).delete();
    res.json({ success: true });
  });

  // Visit Logs
  app.get("/api/logs", async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const { userId, role, employeeId } = req.query;
    
    let query: admin.firestore.Query = db.collection('visit_logs');

    if (role === 'admin') {
      if (employeeId && employeeId !== 'All') {
        query = query.where('user_id', '==', employeeId);
      }
    } else {
      query = query.where('user_id', '==', userId);
    }

    const snapshot = await query.orderBy('date_from', 'desc').get();
    
    // Fetch user names for logs
    const logs = await Promise.all(snapshot.docs.map(async doc => {
      const data = doc.data();
      const userDoc = await db!.collection('users').doc(data.user_id).get();
      return { 
        id: doc.id, 
        ...data, 
        user_name: userDoc.exists ? (userDoc.data() as any).name : 'Unknown' 
      };
    }));
    
    res.json(logs);
  });

  app.post("/api/logs", async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const logData = req.body;
    const docRef = await db.collection('visit_logs').add({
      ...logData,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ id: docRef.id });
  });

  app.put("/api/logs/:id", async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const { id } = req.params;
    const logData = req.body;
    await db.collection('visit_logs').doc(id).update(logData);
    res.json({ success: true });
  });

  app.delete("/api/logs/:id", async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    await db.collection('visit_logs').doc(req.params.id).delete();
    res.json({ success: true });
  });

  // Dashboard Stats
  app.get("/api/stats", async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not connected" });
    const { userId, role } = req.query;
    
    let query: admin.firestore.Query = db.collection('visit_logs');
    if (role !== 'admin') {
      query = query.where('user_id', '==', userId);
    }

    const snapshot = await query.get();
    const logs = snapshot.docs.map(doc => doc.data());

    const total_visits = logs.length;
    const uniqueClients = new Set(logs.map(l => l.client_name));
    const total_clients = uniqueClients.size;
    
    let total_days = 0;
    let total_installations = 0;
    let total_enrolled = 0;
    let total_attended = 0;

    logs.forEach(log => {
      const start = new Date(log.date_from);
      const end = new Date(log.date_to);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      total_days += days;
      total_installations += (log.systems_installed || 0);
      total_enrolled += (log.students_enrolled || 0);
      total_attended += (log.students_attended || 0);
    });

    const successRate = total_enrolled > 0 ? (total_attended / total_enrolled) * 100 : 0;

    res.json({
      total_visits,
      total_clients,
      total_days,
      total_installations,
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
    const __dirname = path.resolve();
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
