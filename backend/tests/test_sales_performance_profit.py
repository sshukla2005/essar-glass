import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from app.utils.helpers import compute_profit_fields

class MockSO:
    def __init__(self, groups=None, hardware_items=None, labor_items=None, wastage_items=None, dc_cost=0, total_amount=10000, tax_amount=0):
        self.groups = groups or []
        self.hardware_items = hardware_items or []
        self.labor_items = labor_items or []
        self.wastage_items = wastage_items or []
        self.dc_cost = dc_cost
        self.total_amount = total_amount
        self.tax_amount = tax_amount

def test_compute_profit_fields_basic():
    # 1 glass line: cost_amount = 500
    # hardware_item: cost_amount = 400
    # labor_item: cost_amount = 150
    # wastage_item: cost_amount = 50
    # dc_cost: 300
    # Total cost = 500 + 400 + 150 + 50 + 300 = 1400
    # Total amount = 10000, Tax = 0 -> assessable = 10000
    # Profit amount = 10000 - 1400 = 8600
    # Profit percent = (8600 / 10000) * 100 = 86%

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
    assert tot_cost == 1400.0
    assert prof_amt == 8600.0
    assert prof_pct == 86.0

def test_compute_profit_fields_empty():
    # No cost rates filled
    so = MockSO(groups=[], dc_cost=0, total_amount=5000, tax_amount=0)
    tot_cost, prof_amt, prof_pct = compute_profit_fields(so)
    assert tot_cost is None
    assert prof_amt is None
    assert prof_pct is None
