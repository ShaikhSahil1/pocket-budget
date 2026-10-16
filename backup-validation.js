function validatePocketBackup(d){
    if(!d||!['INR','USD','GBP','EUR'].includes(d.currency)||!d.balances||Array.isArray(d.balances)||typeof d.balances!=='object'||!Array.isArray(d.expenses))throw Error('Invalid Pocket backup.');
    for(const [m,n] of Object.entries(d.balances))if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)||!Number.isFinite(n)||n<0)throw Error('Invalid monthly balance.');
    const ids=new Set();for(const e of d.expenses){if(!e||typeof e.id!=='string'||ids.has(e.id)||typeof e.name!=='string'||typeof e.details!=='string'||!cats.includes(e.category)||!Number.isFinite(e.amount)||e.amount<=0||!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(e.date)||Number.isNaN(Date.parse(e.date))||typeof e.refundable!=='boolean'||typeof e.received!=='boolean')throw Error('Invalid expense in backup.');ids.add(e.id);}
    validateLeaves(d.leaves);
    return d;
  }
