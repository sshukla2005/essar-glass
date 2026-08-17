import os
import sys
from datetime import datetime
from collections import defaultdict

# Setup path to import backend app modules
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.database import SessionLocal
from app.models.workshop import WorkshopOrder
from sqlalchemy.orm.attributes import flag_modified

def reconcile_wo_cutting():
    db = SessionLocal()
    try:
        wos = db.query(WorkshopOrder).filter(WorkshopOrder.status == 'in_progress').all()
        
        company_wo_counts = defaultdict(int)
        company_line_counts = defaultdict(int)
        
        print("Starting Workshop Order cutting backfill for in_progress orders...")
        
        for wo in wos:
            lines = wo.lines or []
            if not lines:
                continue

            wo_updated_at = wo.updated_at or wo.created_at or datetime.utcnow()
            wo_updated_at_iso = wo_updated_at.isoformat() if hasattr(wo_updated_at, 'isoformat') else str(wo_updated_at)
            
            lines_updated_for_wo = 0
            updated_lines = []
            
            for line in lines:
                if not isinstance(line, dict):
                    updated_lines.append(line)
                    continue
                
                if not line.get("cut_started_at"):
                    line_copy = dict(line)
                    line_copy["cut_started_at"] = wo_updated_at_iso
                    updated_lines.append(line_copy)
                    lines_updated_for_wo += 1
                else:
                    updated_lines.append(line)
            
            if lines_updated_for_wo > 0:
                wo.lines = updated_lines
                flag_modified(wo, "lines")
                db.add(wo)
                
                cid = wo.company_id or "default"
                company_wo_counts[cid] += 1
                company_line_counts[cid] += lines_updated_for_wo
                print(f"Updated WO {wo.wo_number} (ID: {wo.id}, Co: {cid}): stamped {lines_updated_for_wo} line(s) with {wo_updated_at_iso}")
        
        db.commit()
        print("\n" + "=" * 60)
        print("WORKSHOP ORDER CUTTING BACKFILL SUMMARY")
        print("=" * 60)
        all_companies = set(list(company_wo_counts.keys()) + list(company_line_counts.keys()))
        if not all_companies:
            print("No in_progress Workshop Orders needed backfilling.")
        else:
            for cid in sorted(all_companies):
                print(f"Company ID {cid}: {company_wo_counts[cid]} WO(s) updated, {company_line_counts[cid]} line(s) stamped with cut_started_at.")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"ERROR backfilling WO cutting: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    reconcile_wo_cutting()
