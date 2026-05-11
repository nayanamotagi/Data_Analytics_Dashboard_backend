const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getDb } = require('../config/firebase');

const router = express.Router();

// Get analytics data
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user.userId;
    const { type, db } = getDb();

    let expenses = [];

    if (type === 'firestore') {
      let expensesRef = db.collection('expenses').where('userId', '==', userId);
      
      if (startDate) {
        expensesRef = expensesRef.where('date', '>=', new Date(startDate));
      }
      if (endDate) {
        expensesRef = expensesRef.where('date', '<=', new Date(endDate));
      }

      const snapshot = await expensesRef.get();
      expenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    } else {
      // In-memory storage
      expenses = Array.from(db.expenses.values())
        .filter(e => e.userId === userId)
        .filter(e => {
          if (startDate && new Date(e.date) < new Date(startDate)) return false;
          if (endDate && new Date(e.date) > new Date(endDate)) return false;
          return true;
        });
    }

    // Calculate statistics
    const totalIncome = expenses
      .filter(e => e.type === 'income')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalExpense = expenses
      .filter(e => e.type === 'expense')
      .reduce((sum, e) => sum + e.amount, 0);

    const balance = totalIncome - totalExpense;

    // Category breakdown for expenses
    const categoryBreakdown = {};
    expenses
      .filter(e => e.type === 'expense')
      .forEach(e => {
        categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount;
      });

    // Monthly trend data
    const monthlyData = {};
    expenses.forEach(e => {
      const monthKey = new Date(e.date).toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expense: 0 };
      }
      monthlyData[monthKey][e.type] += e.amount;
    });

    const monthlyTrend = Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        income: data.income,
        expense: data.expense,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      totalIncome,
      totalExpense,
      balance,
      categoryBreakdown,
      monthlyTrend,
      totalTransactions: expenses.length,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;

