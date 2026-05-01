import os
import re

src_dir = '/home/saurabh/workspace/essar-glass/frontend/src'

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.jsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                content = f.read()

            if 'message' in content and 'from \'antd\'' in content or 'from "antd"' in content:
                # 1. Check if we need to replace 'message' with 'App'
                # Find the antd import statement
                antd_import_match = re.search(r'import\s+\{([^}]+)\}\s+from\s+[\'"]antd[\'"]', content)
                if antd_import_match:
                    imports_str = antd_import_match.group(1)
                    imports = [i.strip() for i in imports_str.split(',')]
                    
                    if 'message' in imports:
                        imports.remove('message')
                        if 'App' not in imports:
                            imports.append('App')
                        
                        new_imports_str = ', '.join(imports)
                        new_import_statement = f"import {{ {new_imports_str} }} from 'antd'"
                        content = content.replace(antd_import_match.group(0), new_import_statement)

                        # 2. Add const { message } = App.useApp() inside the main component function
                        # Assume the component function is the first function after imports
                        # Find `const <Name> = (` or `const <Name> = () => {` or `const <Name> = ({`
                        func_match = re.search(r'const\s+[A-Z][a-zA-Z0-9_]*\s*=\s*(?:\([^)]*\))?\s*=>\s*\{', content)
                        if func_match:
                            func_start = func_match.end()
                            insertion = "\n  const { message } = App.useApp()"
                            content = content[:func_start] + insertion + content[func_start:]
                            
                            with open(filepath, 'w') as f:
                                f.write(content)
                            print(f"Updated {filepath}")
                        else:
                            # Handle export const or function
                            func_match2 = re.search(r'export\s+const\s+[A-Z][a-zA-Z0-9_]*\s*=\s*(?:\([^)]*\))?\s*=>\s*\{', content)
                            if func_match2:
                                func_start = func_match2.end()
                                insertion = "\n  const { message } = App.useApp()"
                                content = content[:func_start] + insertion + content[func_start:]
                                with open(filepath, 'w') as f:
                                    f.write(content)
                                print(f"Updated {filepath}")
                            else:
                                print(f"Could not find component function in {filepath}")
