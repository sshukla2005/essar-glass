const fs = require('fs');
const content = fs.readFileSync('src/pages/sales/SalesOrderForm.jsx', 'utf8');
if (content.includes('const handleSave = async (andNew = false) => {') && content.includes('values.groups = groups')) {
  console.log('handleSave looks correct');
} else {
  console.log('handleSave is missing or incorrect');
}
