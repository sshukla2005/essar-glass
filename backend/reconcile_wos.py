import os
import sys
from datetime import datetime

# Setup path to import backend app modules
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.database import SessionLocal
from app.models.workshop import WorkshopOrder

def reconcile_workshop_orders():
    db = SessionLocal()
    try:
        wos = db.query(WorkshopOrder).all()
        reconciled_completed = 0
        reconciled_fully_cut = 0
        now_iso = datetime.utcnow().isoformat()

        print("Starting Workshop Order reconciliation...")
        for wo in wos:
            lines = wo.lines or []
            if not lines:
                continue

            changed = False
            
            # Case 1: WO is completed, but has uncut lines
            if wo.status == 'completed':
                uncut_found = False
                updated_lines = []
                for line in lines:
                    if not isinstance(line, dict):
                        updated_lines.append(line)
                        continue
                    
                    qty = float(line.get("qty") or line.get("quantity") or 1)
                    qty_cut = float(line.get("qty_cut") if line.get("qty_cut") is not None else 0)
                    
                    if qty > 0 and qty_cut < qty:
                        uncut_found = True
                        line_copy = dict(line)
                        line_copy["qty_cut"] = qty
                        if not line_copy.get("cut_started_at"):
                            line_copy["cut_started_at"] = (wo.created_at or datetime.utcnow()).isoformat() if isinstance(wo.created_at, datetime) else str(wo.created_at or now_iso)
                        if not line_copy.get("cut_completed_at"):
                            line_copy["cut_completed_at"] = (wo.updated_at or datetime.utcnow()).isoformat() if isinstance(wo.updated_at, datetime) else str(wo.updated_at or now_iso)
                        updated_lines.append(line_copy)
                    else:
                        updated_lines.append(line)
                
                if uncut_found:
                    wo.lines = updated_lines
                    changed = True
                    reconciled_completed += 1
                    print(f"Reconciled Completed WO: {wo.wo_number} (ID: {wo.id}, Co: {wo.company_id}) - Marked all lines as cut.")

            # Case 2: WO is not completed/cancelled, but all lines are fully cut
            elif wo.status not in ('completed', 'cancelled'):
                all_complete = True
                any_line = False
                for line in lines:
                    if not isinstance(line, dict):
                        continue
                    any_line = True
                    qty = float(line.get("qty") or line.get("quantity") or 1)
                    qty_cut = float(line.get("qty_cut") if line.get("qty_cut") is not None else 0)
                    if qty > 0 and qty_cut < qty:
                        all_complete = False
                        break
                
                if any_line and all_complete:
                    wo.status = 'completed'
                    changed = True
                    reconciled_fully_cut += 1
                    print(f"Reconciled Status to Completed for WO: {wo.wo_number} (ID: {wo.id}, Co: {wo.company_id}) - All lines were cut.")

            if changed:
                # Force SQLAlchemy to detect changes to JSON column
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(wo, "lines")
                db.add(wo)

        if reconciled_completed > 0 or reconciled_fully_cut > 0:
            db.commit()
            print("Changes committed to database successfully.")
        else:
            print("No mismatched Workshop Orders found. Database is already consistent.")

        print(f"Summary: Reconciled Completed WOs: {reconciled_completed}, Reconciled Fully Cut WOs: {reconciled_fully_cut}")

    finally:
        db.close()

if __name__ == "__main__":
    reconcile_workshop_orders()
