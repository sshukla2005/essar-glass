import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from app.utils.helpers import compute_profit_fields

class MockSO:
    def __init__(self, groups=None, hardware_items=None, labor_items=None, wastage_items=None, dc_cost=0, dc_charges=0, total_amount=10000, tax_amount=0):
        self.groups = groups or []
        self.hardware_items = hardware_items or []
        self.labor_items = labor_items or []
        self.wastage_items = wastage_items or []
        self.dc_cost = dc_cost
        self.dc_charges = dc_charges
        self.total_amount = total_amount
        self.tax_amount = tax_amount

def test_compute_profit_fields_basic():
    # 1 glass line: cost_amount = 500
    # hardware_item: cost_amount = 400
    # labor_item: cost_amount = 150
    # wastage_item: cost_amount = 50
    # dc_cost: 300 (EXCLUDED from total_cost)
    # Total cost = 500 + 400 + 150 + 50 = 1100
    # Total amount = 10000, Tax = 0, DC charges = 0 -> sellable_value = 10000
    # Profit amount = 10000 - 1100 = 8900
    # Profit percent = (8900 / 1100) * 100 = 809.09%

    so = MockSO(
        groups=[{
            "sizes": [
                {"cost_amount": 500}
            ]
        }],
        hardware_items=[
            {"cost_amount": 400}
        ],
        labor_items=[
            {"cost_amount": 150}
        ],
        wastage_items=[
            {"cost_amount": 50}
        ],
        dc_cost=300,
        total_amount=10000,
        tax_amount=0
    )

    tot_cost, prof_amt, prof_pct = compute_profit_fields(so)
    assert tot_cost == 1100.0
    assert prof_amt == 8900.0
    assert prof_pct == 809.09

def test_compute_profit_fields_empty():
    # No cost rates filled
    so = MockSO(groups=[], dc_cost=0, total_amount=5000, tax_amount=0)
    tot_cost, prof_amt, prof_pct = compute_profit_fields(so)
    assert tot_cost is None
    assert prof_amt is None
    assert prof_pct is None
