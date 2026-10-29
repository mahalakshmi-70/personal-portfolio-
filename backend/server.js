require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const SITE = process.env.SITE || 'official';
if (!['official', 'personal'].includes(SITE)) {
  throw new Error('SITE must be either "official" or "personal".');
}
const PORT = process.env.PORT || 3000;
const OFFICIAL_DIR = path.resolve(__dirname, '..', 'official');
const PERSONAL_DIR = path.resolve(__dirname, '..', 'personal');
const PRACTICE_DIR = path.resolve(__dirname, '..', 'practice');
const SITE_DIR = SITE === 'personal' ? PERSONAL_DIR : OFFICIAL_DIR;
const DATA_DIR = process.env.DATA_DIR || (
  SITE === 'personal' ? path.join(__dirname, 'data-personal') : path.join(__dirname, 'data')
);

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  messages: path.join(DATA_DIR, 'messages.json'),
};

function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hash, 'hex'));
}


// Email transporter (optional; works only if SMTP env vars are set)
const MAIL_TO = process.env.MAIL_TO || 'mahalakshmi.golamari1@gmail.com';
let transporter = null;
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  transporter.verify().then(() => {
    console.log('Email transporter ready.');
  }).catch((err) => {
    console.warn('Email transporter not ready:', err.message);
    transporter = null;
  });
} else {
  console.warn('SMTP credentials not set. Emails will be skipped (messages still saved).');
}

async function sendMail(options) {
  if (!transporter) return false;
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      ...options,
    });
    return true;
  } catch (err) {
    console.error('Failed to send email:', err.message);
    return false;
  }
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(SITE_DIR));
app.use('/official', express.static(OFFICIAL_DIR));
app.use('/personal', express.static(PERSONAL_DIR));
app.use('/practice', express.static(PRACTICE_DIR));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', site: SITE, time: new Date().toISOString(), emailEnabled: !!transporter });
});

app.post('/api/contact', async (req, res) => {
  const { name, email, phone, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ success: false, error: 'Name, email and message are required.' });
  }
  const messages = readJSON(FILES.messages);
  const entry = {
    id: Date.now(),
    name: String(name).trim(),
    email: String(email).trim(),
    phone: phone ? String(phone).trim() : '',
    message: String(message).trim(),
    createdAt: new Date().toISOString(),
  };
  messages.push(entry);
  writeJSON(FILES.messages, messages);

  await sendMail({
    to: MAIL_TO,
    subject: `[${SITE}] New contact message from ${entry.name}`,
    text: `From: ${entry.name} (${entry.email})
Phone: ${entry.phone || 'Not provided'}

Message:
${entry.message}

---
Received: ${entry.createdAt}
SITE: ${SITE}`,
    replyTo: entry.email,
  });
  await sendMail({
    to: entry.email,
    subject: 'Thanks for reaching out!',
    text: `Hi ${entry.name},\n\nThanks for your message. I have received it and will get back to you soon.\n\nBest regards,\nMahalakshmi`,
  });

  res.json({ success: true, message: `Thanks, ${entry.name}! Your message has been received.` });
});

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: 'Name, email and password are required.' });
  }
  if (!String(email).includes('@') || !String(email).includes('.')) {
    return res.status(400).json({ success: false, error: 'Invalid email format.' });
  }
  if (String(password).length < 7) {
    return res.status(400).json({ success: false, error: 'Password must be at least 7 characters.' });
  }
  const users = readJSON(FILES.users);
  if (users.some((u) => u.email === String(email).trim().toLowerCase())) {
    return res.status(409).json({ success: false, error: 'User already exists.' });
  }
  const { salt, hash } = hashPassword(String(password));
  const user = {
    id: Date.now(),
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    passwordHash: hash,
    salt: salt,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeJSON(FILES.users, users);

  await sendMail({
    to: user.email,
    subject: 'Welcome! Your registration is complete',
    text: `Hi ${user.name},\n\nYour registration was successful. Welcome aboard!\n\nBest regards,\nMahalakshmi`,
  });

  res.json({ success: true, message: 'Registration successful!' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required.' });
  }
  const users = readJSON(FILES.users);
  const user = users.find(
    (u) => u.name === String(username).trim() || u.email === String(username).trim().toLowerCase()
  );
  if (!user) {
    return res.status(401).json({ success: false, error: 'Incorrect username.' });
  }
  let ok = false;
  if (user.passwordHash && user.salt) {
    try { ok = verifyPassword(String(password), user.salt, user.passwordHash); } catch (e) { ok = false; }
  } else if (user.password) {
    ok = user.password === String(password);
    if (ok) {
      const { salt, hash } = hashPassword(String(password));
      user.passwordHash = hash;
      user.salt = salt;
      delete user.password;
      writeJSON(FILES.users, users);
    }
  }
  if (!ok) {
    return res.status(401).json({ success: false, error: 'Incorrect password.' });
  }
  res.json({ success: true, message: `Successfully logged in! Welcome, ${user.name}.` });
});

app.get('/api/messages', (req, res) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token || req.headers['x-admin-token'] !== token) {
    return res.status(404).json({ success: false, error: 'Not found.' });
  }
  res.json(readJSON(FILES.messages));
});

app.listen(PORT, () => {
  console.log(`${SITE} backend server running at http://localhost:${PORT}`);
});





