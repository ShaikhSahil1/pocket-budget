function validatePocketTravelPlans(plans) {
  if (plans === undefined) return;
  if (!Array.isArray(plans) || plans.length > 200) throw Error('Invalid travel plans.');
  const ids = new Set();
  for (const plan of plans) {
    if (!plan || typeof plan.id !== 'string' || !plan.id || ids.has(plan.id) || typeof plan.title !== 'string' || !plan.title.trim() || plan.title.length > 120 || typeof plan.notes !== 'string' || plan.notes.length > 10000) throw Error('Invalid travel plan.');
    ids.add(plan.id);
    for (const kind of ['packing', 'tasks']) {
      if (!Array.isArray(plan[kind]) || plan[kind].length > 500) throw Error('Invalid travel checklist.');
      const itemIds = new Set();
      for (const item of plan[kind]) {
        if (!item || typeof item.id !== 'string' || !item.id || itemIds.has(item.id) || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 300 || typeof item.done !== 'boolean') throw Error('Invalid travel checklist item.');
        itemIds.add(item.id);
      }
    }
  }
}
function validatePocketBackup(d){
    if(!d||!isPocketCurrency(d.currency)||!d.balances||Array.isArray(d.balances)||typeof d.balances!=='object'||!Array.isArray(d.expenses))throw Error('Invalid Monthly Pocket backup.');
    for(const [m,n] of Object.entries(d.balances))if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)||!Number.isFinite(n)||n<0)throw Error('Invalid monthly balance.');
    const ids=new Set();for(const e of d.expenses){if(!e||typeof e.id!=='string'||ids.has(e.id)||typeof e.name!=='string'||typeof e.details!=='string'||!cats.includes(e.category)||!Number.isFinite(e.amount)||e.amount<=0||!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(e.date)||Number.isNaN(Date.parse(e.date))||typeof e.refundable!=='boolean'||typeof e.received!=='boolean')throw Error('Invalid expense in backup.');ids.add(e.id);}
    validateLeaves(d.leaves);
    validatePocketTravelPlans(d.travelPlans);
    return d;
  }
