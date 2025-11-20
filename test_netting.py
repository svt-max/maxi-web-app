# CHANGE THIS LINE: Import from 'app', not 'smart_netting'
from app import simplify_debts  

# --- Scenario: Trip to Paris ---
# 1. Liability (The Split - "Who Ate What"):
#    - Dinner (€300): Alice paid. Everyone owes €100.
#    - Drinks (€100): Bob paid. Everyone owes €33.33.
# 
# 2. Net Positions (Calculated by app.py steps 4 & 5):
#    - Alice: Paid €300, Expected €133.33 -> Net: +€166.67 (Owed)
#    - Bob:   Paid €100, Expected €133.33 -> Net: -€33.33 (Owes)
#    - Charlie: Paid €0, Expected €133.33 -> Net: -€133.33 (Owes)

print("--- Testing Smart Netting ---")

# This simulates the input_balances generated in Step 5 of calculate_net_balances
calculated_net_positions = {
    'Alice': 166.67,
    'Bob': -33.33,
    'Charlie': -133.34  # (Rounded for float balance)
}

print(f"Net Positions: {calculated_net_positions}")

# Run the algorithm
plan = simplify_debts(input_balances=calculated_net_positions)

print("\n--- Settlement Plan (How to Pay) ---")
for tx in plan:
    print(f"{tx['from']} pays {tx['to']} €{tx['amount']:.2f}")