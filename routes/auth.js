const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../config/firebase');

const router = express.Router();

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name } = req.body;
    const { type, db } = getDb();

    if (type === 'firestore') {
      const userRef = db.collection('users').where('email', '==', email);
      const snapshot = await userRef.get();
      
      if (!snapshot.empty) {
        return res.status(400).json({ error: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userDoc = await db.collection('users').add({
        email,
        password: hashedPassword,
        name,
        createdAt: new Date(),
      });

      const token = jwt.sign(
        { userId: userDoc.id, email },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '7d' }
      );

      res.status(201).json({
        token,
        user: { id: userDoc.id, email, name },
      });
    } else {
      // In-memory storage
      const existingUser = Array.from(db.users.values()).find(u => u.email === email);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = (++db.lastUserId).toString();
      const user = {
        id: userId,
        email,
        password: hashedPassword,
        name,
        createdAt: new Date(),
      };

      db.users.set(userId, user);

      const token = jwt.sign(
        { userId, email },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '7d' }
      );

      res.status(201).json({
        token,
        user: { id: userId, email, name },
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const { type, db } = getDb();

    let user = null;

    if (type === 'firestore') {
      const userRef = db.collection('users').where('email', '==', email);
      const snapshot = await userRef.get();
      
      if (snapshot.empty) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const userDoc = snapshot.docs[0];
      user = { id: userDoc.id, ...userDoc.data() };
    } else {
      // In-memory storage
      user = Array.from(db.users.values()).find(u => u.email === email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router;

