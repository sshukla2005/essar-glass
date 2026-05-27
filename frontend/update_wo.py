import re

with open('src/pages/workshop/WorkshopOrderForm.jsx', 'r') as f:
    content = f.read()

# Add processMasterApi to imports
if 'processMasterApi' not in content:
    content = content.replace('tougheningBatchApi } from', 'tougheningBatchApi, processMasterApi } from')

# Add processMasters query
query_inject = """  const { data: tbData } = useQuery({ queryKey: ['tb-wo', id], queryFn: () => tougheningBatchApi.list({ wo_id: id }).then(r => r.data), enabled: isEdit })
  const { data: processMastersData } = useQuery({ queryKey: ['process-masters'], queryFn: () => processMasterApi.dropdown().then(r => r.data) })
  
  const processMasters = Array.isArray(processMastersData) ? processMastersData : (processMastersData?.items || [])
"""
content = re.sub(r'  const { data: tbData }.*?enabled: isEdit }\)', query_inject, content, count=1, flags=re.DOTALL)

build_wo_lines = """  const buildWoLinesFromGroups = (soGroups) =>
    soGroups.flatMap((group, gi) =>
      (group.sizes || []).map((size, si) => {
        const hasProcess = Array.isArray(group.processes) && group.processes.length > 0
        const processLabels = hasProcess
          ? group.processes
              .map(p => p.process_name ||
                processMasters.find(pm => pm.id === p.process_id)?.name ||
                `Process ${p.process_id}`)
              .filter(Boolean)
              .join(', ')
          : ''
        return {
          key: Date.now() + gi + si + Math.random(),
          description: group.description || '',
          act_w_in: size.width_inch ? parseFloat(size.width_inch.toFixed(4)) : null,
          act_h_in: size.height_inch ? parseFloat(size.height_inch.toFixed(4)) : null,
          act_w_mm: size.width_inch ? Math.round(size.width_inch * 25.4) : null,
          act_h_mm: size.height_inch ? Math.round(size.height_inch * 25.4) : null,
          qty: size.quantity || 1,
          is_toughened: group.is_toughened || group.glass_type === 'Toughened',
          has_process: hasProcess,
          process_label: processLabels,
          artwork_file: null,
          remark: '',
        }
      })
    )

  const buildWoLines = (soLines) => soLines.map((l, i) => {
    const w_in = mmToInch(l.width_mm)
    const h_in = mmToInch(l.height_mm)
    const hasProcess = Array.isArray(l.processes) && l.processes.length > 0
    const processLabels = hasProcess
      ? l.processes.map(p => p.process_name || processMasters.find(pm => pm.id === p.process_id)?.name || `Process ${p.process_id}`).join(', ')
      : ''
    return {
      key: Date.now() + i,
      description: l.description || '',
      act_w_in: w_in,
      act_h_in: h_in,
      act_w_mm: l.width_mm || (w_in ? Math.round(w_in * 25.4) : null),
      act_h_mm: l.height_mm || (h_in ? Math.round(h_in * 25.4) : null),
      qty: l.quantity || l.qty || 1,
      is_toughened: l.is_toughened === true || (l.description || '').toLowerCase().includes('toughened'),
      has_process: hasProcess,
      process_label: processLabels,
      artwork_file: null,
      remark: '',
    }
  })

  const handleSOSelect = async (soId) => {
    form.setFieldValue('so_id', soId)
    try {
      const so = (await salesOrderApi.get(soId)).data
      const sanitize = (obj) => Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, v === null ? undefined : v])
      )
      form.setFieldsValue(sanitize({ customer_id: so.customer_id, so_number: so.so_number }))
      const cust = customerList.find(c => c.id === so.customer_id)
      if (cust) form.setFieldValue('customer_name', cust.name)
      
      if (so.groups?.length) {
        setLines(buildWoLinesFromGroups(so.groups))
      } else if (so.lines?.length) {
        setLines(buildWoLines(so.lines))
      }
    } catch (e) { message.error('Failed to load SO') }
  }"""

content = re.sub(r'  const buildWoLines =.*?catch \(e\) { message\.error\(\'Failed to load SO\'\) }\n  }', build_wo_lines, content, flags=re.DOTALL)

with open('src/pages/workshop/WorkshopOrderForm.jsx', 'w') as f:
    f.write(content)

print("WorkshopOrderForm updated.")
