// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";
import { OAuth2Client } from "google-auth-library";
import nodemailer from "nodemailer";
import { products, categories } from "./data/products.js";

// ---------- ENV / CONFIG ----------
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_PATH = path.join(__dirname, "data", "users.json");
const ORDERS_PATH = path.join(__dirname, "data", "orders.json");

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ""; // opcional, recomendado setearlo

// Permite front en local y otros dominios que agregues por coma
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ---------- APP ----------
const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",                 // front local (Vite)
      "http://127.0.0.1:5173",
      "https://adventureworkscycle.netlify.app" // tu sitio en Netlify
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- HELPERS (persistencia JSON) ----------
function readJSON(p) {
  try {
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return [];
  }
}
function writeJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

// ---------- AUTH MIDDLEWARE ----------
function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ---------- ADMIN MIDDLEWARE ----------
function adminAuth(req, res, next) {
  const users = readJSON(USERS_PATH);
  const user = users.find((u) => u.id === req.user.sub);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// ---------- UTILS ----------
function unitPrice(p) {
  // -25% si es deal
  return p.tag === "deal" ? +(p.price * 0.75).toFixed(2) : p.price;
}

// ---------- GOOGLE OAUTH ----------
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ---------- EMAIL CONFIGURATION ----------
const EMAIL_HOST = process.env.EMAIL_HOST || "smtp.gmail.com";
const EMAIL_PORT = process.env.EMAIL_PORT || 587;
const EMAIL_USER = process.env.EMAIL_USER || "";
const EMAIL_PASS = process.env.EMAIL_PASS || "";

const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: false,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

// ================== ROUTES ==================

// Health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// -------- Productos
// GET /api/products?category=...&tag=deal&q=texto
app.get("/api/products", (req, res) => {
  let list = [...products];
  const { category, tag, q } = req.query;

  if (category) list = list.filter((p) => p.category === category);
  if (tag) list = list.filter((p) => p.tag === tag);
  if (q) {
    const t = String(q).toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(t) ||
        p.brand.toLowerCase().includes(t)
    );
  }
  res.json(list);
});

// GET /api/products/:id
app.get("/api/products/:id", (req, res) => {
  const p = products.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "Not found" });
  res.json(p);
});

// GET /api/categories
app.get("/api/categories", (_req, res) => res.json(categories));

// GET /api/deals (solo tag=deal)
app.get("/api/deals", (_req, res) =>
  res.json(products.filter((p) => p.tag === "deal"))
);

// -------- Auth (email/password)
// POST /api/auth/signup  {email, password, name}
app.post("/api/auth/signup", (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "Missing fields" });

  const users = readJSON(USERS_PATH);
  if (users.find((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const hash = bcrypt.hashSync(password, 10);
  const isFirstUser = users.length === 0; // El primer usuario es administrador
  const user = {
    id: nanoid(),
    email,
    name: name || "",
    hash,
    isAdmin: isFirstUser,
    createdAt: Date.now(),
  };
  users.push(user);
  writeJSON(USERS_PATH, users);

  const token = jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({
    token,
    user: { 
      id: user.id, 
      email: user.email, 
      name: user.name,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt
    },
  });
});

// POST /api/auth/signin  {email, password}
app.post("/api/auth/signin", (req, res) => {
  const { email, password } = req.body || {};
  const users = readJSON(USERS_PATH);
  const user = users.find(
    (u) => u.email.toLowerCase() === String(email).toLowerCase()
  );
  if (!user || !user.hash)
    return res.status(401).json({ error: "Invalid credentials" });

  const ok = bcrypt.compareSync(password, user.hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({
    token,
    user: { 
      id: user.id, 
      email: user.email, 
      name: user.name,
      isAdmin: user.isAdmin || false,
      createdAt: user.createdAt
    },
  });
});

// -------- Auth (Google)
// POST /api/auth/google  { idToken }
app.post("/api/auth/google", async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ error: "Missing idToken" });

    // Verificar el ID Token con Google
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID || undefined, // mejor setearlo en .env
    });
    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ error: "Invalid Google token" });

    const email = payload.email;
    const name = payload.name || "";
    if (!email) return res.status(400).json({ error: "Google token missing email" });

    // Buscar o crear usuario
    const users = readJSON(USERS_PATH);
    let user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      user = {
        id: nanoid(),
        email,
        name,
        provider: "google",
        createdAt: Date.now(),
      };
      users.push(user);
      writeJSON(USERS_PATH, users);
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        provider: user.provider || "google",
      },
    });
  } catch (e) {
    console.error(e);
    res.status(401).json({ error: "Google verification failed" });
  }
});

// GET /api/me
app.get("/api/me", auth, (req, res) => {
  const users = readJSON(USERS_PATH);
  const me = users.find((u) => u.id === req.user.sub);
  if (!me) return res.status(404).json({ error: "Not found" });
  res.json({ 
    id: me.id, 
    email: me.email, 
    name: me.name,
    isAdmin: me.isAdmin || false,
    createdAt: me.createdAt
  });
});

// -------- Órdenes
// POST /api/orders  {items:[{productId,qty}], address, discount?, shipping?}
app.post("/api/orders", auth, (req, res) => {
  try {
    const { items, address, discount, shipping = 0 } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Cart items required" });
    }

    // Enriquecer líneas
    const lines = items.map((it) => {
      const p = products.find((x) => x.id === it.productId);
      if (!p) throw new Error("Invalid product");
      const unit = unitPrice(p);
      const qty = Number(it.qty || 1);
      return {
        productId: p.id,
        name: p.name,
        brand: p.brand,
        image: p.image,
        tag: p.tag || null,
        qty,
        unit,
        line: +(unit * qty).toFixed(2),
      };
    });

    // Total
    let total = +lines.reduce((a, b) => a + b.line, 0).toFixed(2);
    const discountAmount = discount?.amount ? Number(discount.amount) : 0;
    total = +(total - discountAmount + Number(shipping)).toFixed(2);
    if (total < 0) total = 0;

    // Persistir
    const orders = readJSON(ORDERS_PATH);
    const order = {
      id: nanoid(),
      userId: req.user.sub,
      items: lines,
      total,
      address: address || null,
      discount: discount || null,
      shipping: Number(shipping) || 0,
      status: "created",
      createdAt: Date.now(),
    };
    orders.push(order);
    writeJSON(ORDERS_PATH, orders);

    res.status(201).json(order);
  } catch (e) {
    res.status(400).json({ error: e.message || "Invalid payload" });
  }
});

// GET /api/orders/:id
app.get("/api/orders/:id", auth, (req, res) => {
  const orders = readJSON(ORDERS_PATH);
  const order = orders.find((o) => o.id === req.params.id && o.userId === req.user.sub);
  if (!order) return res.status(404).json({ error: "Not found" });
  res.json(order);
});

// Helper function to generate El Salvador compliant invoice PDF
function generateInvoicePDF(order) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const buffers = [];
  doc.on('data', buffers.push.bind(buffers));
  
  return new Promise((resolve) => {
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });

    // Company information (El Salvador compliant)
    doc.fontSize(20).text("ADVENTURE WORKS EL SALVADOR", { align: "center" });
    doc.fontSize(12).text("FACTURA ELECTRÓNICA", { align: "center" });
    doc.moveDown(1);
    
    // Company details
    doc.fontSize(10).text("Razón Social: Adventure Works El Salvador S.A. de C.V.", { align: "left" });
    doc.text("NIT: 0614-123456-001-2", { align: "left" });
    doc.text("Dirección: Av. Principal, San Salvador, El Salvador", { align: "left" });
    doc.text("Teléfono: +503 2234-5678", { align: "left" });
    doc.text("Email: ventas@adventureworks.sv", { align: "left" });
    doc.moveDown(1);
    
    // Invoice details
    doc.fontSize(12).text("DETALLES DE LA FACTURA", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Número de Factura: ${order.id}`, { align: "left" });
    doc.text(`Fecha de Emisión: ${new Date(order.createdAt).toLocaleDateString('es-SV')}`, { align: "left" });
    doc.text(`Hora de Emisión: ${new Date(order.createdAt).toLocaleTimeString('es-SV')}`, { align: "left" });
    doc.moveDown(1);
    
    // Customer information
    if (order.address) {
      doc.fontSize(12).text("INFORMACIÓN DEL CLIENTE", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Nombre: ${order.address.name || 'N/A'}`, { align: "left" });
      doc.text(`Email: ${order.address.email || 'N/A'}`, { align: "left" });
      doc.text(`Dirección: ${order.address.line1 || 'N/A'}, ${order.address.city || 'N/A'}, ${order.address.country || 'N/A'}`, { align: "left" });
      doc.moveDown(1);
    }
    
    // Items table header
    doc.fontSize(12).text("DETALLE DE PRODUCTOS", { underline: true });
    doc.moveDown(0.5);
    
    // Table headers
    doc.fontSize(10);
    doc.text("Descripción", 50, doc.y);
    doc.text("Cantidad", 300, doc.y);
    doc.text("Precio Unit.", 380, doc.y);
    doc.text("Total", 480, doc.y);
    doc.moveDown(0.5);
    
    // Draw line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.3);
    
    // Items
    order.items.forEach((item) => {
      const lineY = doc.y;
      doc.text(`${item.name} (${item.brand})`, 50, lineY);
      doc.text(`${item.qty}`, 300, lineY);
      doc.text(`$${item.unit.toFixed(2)}`, 380, lineY);
      doc.text(`$${item.line.toFixed(2)}`, 480, lineY);
      if (item.tag === "deal") {
        doc.fontSize(8).text("(Descuento 25%)", 50, lineY + 12);
        doc.fontSize(10);
      }
      doc.moveDown(0.5);
    });
    
    // Totals section
    doc.moveDown(1);
    const subtotal = order.items.reduce((sum, item) => sum + item.line, 0);
    
    doc.text(`Subtotal: $${subtotal.toFixed(2)}`, { align: "right" });
    
    if (order.discount?.amount) {
      doc.text(`Descuento (${order.discount.code}): -$${Number(order.discount.amount).toFixed(2)}`, { align: "right" });
    }
    
    if (order.shipping) {
      doc.text(`Envío: $${Number(order.shipping).toFixed(2)}`, { align: "right" });
    }
    
    // Tax calculation (13% IVA for El Salvador)
    const taxRate = 0.13;
    const taxableAmount = subtotal - (order.discount?.amount || 0);
    const tax = taxableAmount * taxRate;
    doc.text(`IVA (13%): $${tax.toFixed(2)}`, { align: "right" });
    
    doc.fontSize(14).text(`TOTAL: $${order.total.toFixed(2)}`, { align: "right" });
    
    // Footer
    doc.moveDown(2);
    doc.fontSize(8).text("Esta factura cumple con las normativas de facturación electrónica de El Salvador", { align: "center" });
    doc.text("Ministerio de Hacienda - República de El Salvador", { align: "center" });
    
    doc.end();
  });
}

// GET /api/orders/:id/invoice.pdf  -> Genera PDF
app.get("/api/orders/:id/invoice.pdf", auth, async (req, res) => {
  const orders = readJSON(ORDERS_PATH);
  const order = orders.find((o) => o.id === req.params.id && o.userId === req.user.sub);
  if (!order) return res.status(404).json({ error: "Not found" });

  try {
    const pdfBuffer = await generateInvoicePDF(order);
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="Factura-${order.id}.pdf"`
    );
    
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Error generating invoice" });
  }
});

// POST /api/orders/:id/send-invoice  -> Send invoice via email
app.post("/api/orders/:id/send-invoice", auth, async (req, res) => {
  const orders = readJSON(ORDERS_PATH);
  const order = orders.find((o) => o.id === req.params.id && o.userId === req.user.sub);
  if (!order) return res.status(404).json({ error: "Order not found" });

  if (!order.address?.email) {
    return res.status(400).json({ error: "No email address provided" });
  }

  // Check if email configuration is set up
  if (!EMAIL_USER || !EMAIL_PASS) {
    return res.status(500).json({ 
      error: "Email service not configured. Please contact administrator to set up email credentials." 
    });
  }

  try {
    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(order);
    
    // Send email
    const mailOptions = {
      from: EMAIL_USER,
      to: order.address.email,
      subject: `Factura Electrónica - Adventure WorkCycle - Orden ${order.id}`,
      html: `
        <h2>¡Gracias por su compra!</h2>
        <p>Estimado/a ${order.address.name || 'Cliente'},</p>
        <p>Adjunto encontrará la factura electrónica de su compra en Adventure WorkCycle.</p>
        <p><strong>Número de Orden:</strong> ${order.id}</p>
        <p><strong>Fecha:</strong> ${new Date(order.createdAt).toLocaleDateString('es-SV')}</p>
        <p><strong>Total:</strong> $${order.total.toFixed(2)}</p>
        <p>Esta factura cumple con las normativas de facturación electrónica de El Salvador.</p>
        <br>
        <p>Saludos cordiales,<br>Equipo Adventure WorkCycle</p>
      `,
      attachments: [
        {
          filename: `Factura-${order.id}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: "Invoice sent successfully" });
  } catch (error) {
    console.error("Error sending email:", error);
    
    // Provide more specific error messages
    let errorMessage = "Error sending invoice";
    if (error.code === 'EAUTH') {
      errorMessage = "Email authentication failed. Please check email credentials.";
    } else if (error.code === 'ECONNECTION') {
      errorMessage = "Could not connect to email server. Please try again later.";
    } else if (error.code === 'EENVELOPE') {
      errorMessage = "Invalid email address. Please check the recipient email.";
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// -------- ADMIN ENDPOINTS --------
// GET /api/admin/users - List all users (admin only)
app.get("/api/admin/users", auth, adminAuth, (req, res) => {
  const users = readJSON(USERS_PATH);
  const usersWithoutHash = users.map(({ hash, ...user }) => user); // Remove password hashes
  res.json(usersWithoutHash);
});

// DELETE /api/admin/users/:id - Delete user (admin only)
app.delete("/api/admin/users/:id", auth, adminAuth, (req, res) => {
  const users = readJSON(USERS_PATH);
  const userIndex = users.findIndex((u) => u.id === req.params.id);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }
  
  const user = users[userIndex];
  if (user.isAdmin) {
    return res.status(403).json({ error: "Cannot delete admin user" });
  }
  
  users.splice(userIndex, 1);
  writeJSON(USERS_PATH, users);
  res.json({ message: "User deleted successfully" });
});

// GET /api/admin/orders - List all orders (admin only)
app.get("/api/admin/orders", auth, adminAuth, (req, res) => {
  const orders = readJSON(ORDERS_PATH);
  res.json(orders);
});

// PATCH /api/admin/orders/:id - Update order status (admin only)
app.patch("/api/admin/orders/:id", auth, adminAuth, (req, res) => {
  const orders = readJSON(ORDERS_PATH);
  const orderIndex = orders.findIndex((o) => o.id === req.params.id);
  
  if (orderIndex === -1) {
    return res.status(404).json({ error: "Order not found" });
  }
  
  const { status } = req.body || {};
  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }
  
  orders[orderIndex].status = status;
  writeJSON(ORDERS_PATH, orders);
  res.json({ message: "Order status updated successfully" });
});

// ---------- START ----------
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
