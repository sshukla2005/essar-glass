with open('src/pages/sales/SalesOrderForm.jsx', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if line.strip() == '<Col span={12}>':
        if '<Col span={12}>' in lines[i+1]:
            lines[i] = ""
            print("Removed extra Col tag")

# now find MasterForm closing and insert </Row></Form>
for i in range(len(lines)-1, -1, -1):
    if '</MasterForm>' in lines[i]:
        lines.insert(i-1, '      </Form>\n')
        lines.insert(i-1, '      </Row>\n')
        print("Added Row and Form closing tags")
        break

with open('src/pages/sales/SalesOrderForm.jsx', 'w') as f:
    f.writelines(lines)
