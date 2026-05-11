const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { getDb } = require('../config/firebase');

const router = express.Router();

// Get all expenses/income for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { type, db } = getDb();
    const userId = req.user.userId;

    if (type === 'firestore') {
      const expensesRef = db.collection('expenses').where('userId', '==', userId);
      const snapshot = await expensesRef.get();
      const expenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      res.json(expenses);
    } else {
      // In-memory storage
      const expenses = Array.from(db.expenses.values())
        .filter(e => e.userId === userId);
      res.json(expenses);
    }
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Create expense/income
router.post('/', authenticateToken, [
  body('type').isIn(['income', 'expense']),
  body('amount').isFloat({ min: 0 }),
  body('category').trim().notEmpty(),
  body('description').optional().trim(),
  body('date').isISO8601(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, amount, category, description, date } = req.body;
    const userId = req.user.userId;
    const { type: dbType, db } = getDb();

    const expenseData = {
      userId,
      type,
      amount: parseFloat(amount),
      category,
      description: description || '',
      date: new Date(date),
      createdAt: new Date(),
    };

    if (dbType === 'firestore') {
      const docRef = await db.collection('expenses').add(expenseData);
      res.status(201).json({ id: docRef.id, ...expenseData });
    } else {
      // In-memory storage
      const expenseId = (++db.lastExpenseId).toString();
      const expense = { id: expenseId, ...expenseData };
      db.expenses.set(expenseId, expense);
      res.status(201).json(expense);
    }
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// Update expense/income
router.put('/:id', authenticateToken, [
  body('type').optional().isIn(['income', 'expense']),
  body('amount').optional().isFloat({ min: 0 }),
  body('category').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('date').optional().isISO8601(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const userId = req.user.userId;
    const { type: dbType, db } = getDb();

    const updateData = {};
    if (req.body.type) updateData.type = req.body.type;
    if (req.body.amount !== undefined) updateData.amount = parseFloat(req.body.amount);
    if (req.body.category) updateData.category = req.body.category;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.date) updateData.date = new Date(req.body.date);

    if (dbType === 'firestore') {
      const expenseRef = db.collection('expenses').doc(id);
      const expenseDoc = await expenseRef.get();

      if (!expenseDoc.exists || expenseDoc.data().userId !== userId) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      await expenseRef.update(updateData);
      const updatedDoc = await expenseRef.get();
      res.json({ id: updatedDoc.id, ...updatedDoc.data() });
    } else {
      // In-memory storage
      const expense = db.expenses.get(id);
      if (!expense || expense.userId !== userId) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      Object.assign(expense, updateData);
      res.json(expense);
    }
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// Delete expense/income
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { type: dbType, db } = getDb();

    if (dbType === 'firestore') {
      const expenseRef = db.collection('expenses').doc(id);
      const expenseDoc = await expenseRef.get();

      if (!expenseDoc.exists || expenseDoc.data().userId !== userId) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      await expenseRef.delete();
      res.json({ message: 'Expense deleted successfully' });
    } else {
      // In-memory storage
      const expense = db.expenses.get(id);
      if (!expense || expense.userId !== userId) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      db.expenses.delete(id);
      res.json({ message: 'Expense deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

module.exports = router;

