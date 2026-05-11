const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getDb } = require('../config/firebase');

const router = express.Router();

// Get spending predictions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type, db } = getDb();

    let expenses = [];

    if (type === 'firestore') {
      const expensesRef = db.collection('expenses').where('userId', '==', userId);
      const snapshot = await expensesRef.get();
      expenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    } else {
      // In-memory storage
      expenses = Array.from(db.expenses.values())
        .filter(e => e.userId === userId);
    }

    // Filter expenses only
    const expenseData = expenses
      .filter(e => e.type === 'expense')
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (expenseData.length < 3) {
      return res.json({
        prediction: null,
        message: 'Insufficient data for predictions. Need at least 3 expense records.',
      });
    }

    // Simple trend analysis (can be enhanced with AI API)
    const monthlyTotals = {};
    expenseData.forEach(e => {
      const monthKey = new Date(e.date).toISOString().substring(0, 7);
      monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + e.amount;
    });

    const months = Object.keys(monthlyTotals).sort();
    const amounts = months.map(m => monthlyTotals[m]);

    // Calculate average monthly spending
    const avgMonthly = amounts.reduce((a, b) => a + b, 0) / amounts.length;

    // Simple linear trend (can be replaced with AI API call)
    let trend = 'stable';
    if (amounts.length >= 2) {
      const recent = amounts.slice(-3);
      const earlier = amounts.slice(0, -3);
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const earlierAvg = earlier.length > 0 
        ? earlier.reduce((a, b) => a + b, 0) / earlier.length 
        : recentAvg;

      if (recentAvg > earlierAvg * 1.1) {
        trend = 'increasing';
      } else if (recentAvg < earlierAvg * 0.9) {
        trend = 'decreasing';
      }
    }

    // Predict next month (simple average, can be enhanced with AI)
    const nextMonthPrediction = avgMonthly;

    // If OpenAI API key is available, use it for better predictions
    if (process.env.OPENAI_API_KEY && expenseData.length >= 10) {
      try {
        let fetch;
        try {
          fetch = (await import('node-fetch')).default;
        } catch {
          // Fallback to global fetch if available (Node 18+)
          fetch = global.fetch || require('node-fetch');
        }
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: 'You are a financial analyst. Analyze spending patterns and provide predictions.',
              },
              {
                role: 'user',
                content: `Given monthly spending data: ${months.map((m, i) => `${m}: $${amounts[i].toFixed(2)}`).join(', ')}, predict the next month's spending and identify trends. Respond with JSON: {"prediction": number, "trend": "increasing|decreasing|stable", "insight": "string"}`,
              },
            ],
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = JSON.parse(data.choices[0].message.content);
          return res.json({
            prediction: content.prediction || nextMonthPrediction,
            trend: content.trend || trend,
            insight: content.insight || 'Based on historical data analysis',
            avgMonthly,
            monthlyData: months.map((m, i) => ({ month: m, amount: amounts[i] })),
          });
        }
      } catch (error) {
        console.log('AI prediction failed, using simple analysis:', error.message);
      }
    }

    res.json({
      prediction: nextMonthPrediction,
      trend,
      insight: `Based on ${months.length} months of data, average monthly spending is $${avgMonthly.toFixed(2)}`,
      avgMonthly,
      monthlyData: months.map((m, i) => ({ month: m, amount: amounts[i] })),
    });
  } catch (error) {
    console.error('Error generating predictions:', error);
    res.status(500).json({ error: 'Failed to generate predictions' });
  }
});

module.exports = router;

