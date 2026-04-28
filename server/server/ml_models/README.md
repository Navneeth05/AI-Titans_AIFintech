# ML Models Directory

Place your serialised model files here:

| File | Expected Interface |
|------|--------------------|
| `fraud_model.pkl` | sklearn estimator with `.predict_proba(X)` → `[[p_normal, p_fraud], ...]` |
| `credit_model.pkl` | sklearn estimator with `.predict(X)` → `[score, ...]` (int 300–850) |

## Feature Vector Order

### fraud_model.pkl
```
[amount, balance, is_debit (0/1), description_length, hour_of_day]
```

### credit_model.pkl
```
[total_income, total_expenses, avg_balance, num_overdrafts, num_suspicious, months]
```

## Loading
The service (`app/services/ml_model.py`) auto-loads both files on first request.
If a file is missing, a heuristic rule-based fallback is used automatically.
