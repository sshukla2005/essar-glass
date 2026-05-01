import os
import re

src_dir = '/home/saurabh/workspace/essar-glass/frontend/src'

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.jsx') and file not in ('App.jsx', 'AppLayout.jsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                content = f.read()

            if 'message' in content and 'antd' in content:
                # Remove standalone `import { message } from 'antd'`
                content = re.sub(r"import\s+\{\s*message\s*\}\s+from\s+['\"]antd['\"]\n?", "", content)
                
                # Check for other antd imports that might have message
                def replace_antd_import(m):
                    imports_str = m.group(1)
                    imports = [i.strip() for i in imports_str.split(',')]
                    modified = False
                    if 'message' in imports:
                        imports.remove('message')
                        modified = True
                    if 'App' not in imports:
                        imports.append('App')
                        modified = True
                    if modified:
                        return f"import {{ {', '.join(imports)} }} from 'antd'"
                    return m.group(0)

                content = re.sub(r"import\s+\{([^}]+)\}\s+from\s+['\"]antd['\"]", replace_antd_import, content)

                # Add useApp
                # Only if we don't already have it
                if 'const { message } = App.useApp()' not in content:
                    # Find component start
                    # e.g., const ComponentName = (...) => {
                    # or export const ComponentName = (...) => {
                    func_pattern = re.compile(r"((?:export\s+)?const\s+[A-Z][a-zA-Z0-9_]*\s*=\s*(?:\([^)]*\))?\s*=>\s*\{)")
                    match = func_pattern.search(content)
                    if match:
                        insertion = "\n  const { message } = App.useApp()"
                        content = content[:match.end()] + insertion + content[match.end():]
                        
                        with open(filepath, 'w') as f:
                            f.write(content)
                        print(f"Updated {filepath}")
                    else:
                        print(f"Could not find component function in {filepath}")

