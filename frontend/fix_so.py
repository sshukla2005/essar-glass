with open('src/pages/sales/SalesOrderForm.jsx', 'r') as f:
    lines = f.readlines()

import_modal_idx = -1
for i, line in enumerate(lines):
    if '<UploadOutlined' in line and 'Excel Import Preview' in lines[i+1]:
        import_modal_idx = i - 3  # Start of <Modal
        break

if import_modal_idx != -1:
    new_lines = lines[:import_modal_idx]
    new_lines.append('    </MasterForm>\n')
    new_lines.append('  )\n')
    new_lines.append('}\n\n')
    new_lines.append('export default SalesOrderForm\n')
    
    with open('src/pages/sales/SalesOrderForm.jsx', 'w') as f:
        f.writelines(new_lines)
    print("Fixed SalesOrderForm.jsx")
else:
    print("Could not find the import modal!")
