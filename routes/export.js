const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getDb } = require('../config/firebase');
const PDFDocument = require('pdfkit');
const createCsvWriter = require('csv-writer').createObjectCsvStringifier;

const router = express.Router();

// Export CSV
router.get('/csv', authenticateToken, async (req, res) => {
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

    const csvWriter = createCsvWriter({
      header: [
        { id: 'date', title: 'Date' },
        { id: 'type', title: 'Type' },
        { id: 'category', title: 'Category' },
        { id: 'description', title: 'Description' },
        { id: 'amount', title: 'Amount' },
      ],
    });

    const csvData = expenses.map(e => ({
      date: new Date(e.date).toISOString().split('T')[0],
      type: e.type,
      category: e.category,
      description: e.description || '',
      amount: e.amount,
    }));

    const csv = csvWriter.getHeaderString() + csvWriter.stringifyRecords(csvData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="expenses-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// Export PDF
router.get('/pdf', authenticateToken, async (req, res) => {
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

    const totalIncome = expenses
      .filter(e => e.type === 'income')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalExpense = expenses
      .filter(e => e.type === 'expense')
      .reduce((sum, e) => sum + e.amount, 0);

    const balance = totalIncome - totalExpense;

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="expenses-${Date.now()}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('Expense Report', { align: 'center' });
    doc.moveDown();

    // Summary
    doc.fontSize(14).text('Summary', { underline: true });
    doc.fontSize(12);
    doc.text(`Total Income: $${totalIncome.toFixed(2)}`);
    doc.text(`Total Expense: $${totalExpense.toFixed(2)}`);
    doc.text(`Balance: $${balance.toFixed(2)}`);
    doc.moveDown();

    // Transactions
    doc.fontSize(14).text('Transactions', { underline: true });
    doc.moveDown(0.5);

    expenses.forEach((expense, index) => {
      if (index > 0 && index % 25 === 0) {
        doc.addPage();
      }
      doc.fontSize(10);
      doc.text(
        `${new Date(expense.date).toLocaleDateString()} - ${expense.type.toUpperCase()} - ${expense.category} - $${expense.amount.toFixed(2)}`
      );
      if (expense.description) {
        doc.text(`  ${expense.description}`, { indent: 20 });
      }
      doc.moveDown(0.3);
    });

    doc.end();
  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;

