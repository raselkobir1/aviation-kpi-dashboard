const $=id=>document.getElementById(id),months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const state={section:'Overview',selected:new Set(DATA.airlines.map(a=>a.code)),mode:'compare',kpi:'plf',trend:'plf',from:1,to:12,route:'all',type:'all',distance:'all',page:0,table:'flights',query:''};
const categories=[['Overview','সারসংক্ষেপ'],['Commercial','বাণিজ্যিক'],['Cargo','কার্গো'],['Operations','পরিচালনা'],['Baggage & service','ব্যাগেজ ও সেবা'],['Financial','আর্থিক'],['How it works','হিসাব কীভাবে হয়'],['Glossary','শব্দকোষ'],['Definitions & data','সংজ্ঞা ও ডেটা']];
const KPI_SECTIONS=['Overview','Commercial','Cargo','Operations','Baggage & service','Financial'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,d=1)=>v==null?'Not applicable':Number(v).toLocaleString('en-GB',{maximumFractionDigits:d});
function fmt(v,k){if(v==null)return 'N/A';if(k.unit==='€')return '€'+num(v,0);if(k.unit.startsWith('€/'))return '€'+num(v,4);if(k.unit.startsWith('kg/AS')||k.unit.startsWith('kg/RP'))return num(v,6);return num(v,k.unit==='%'?2:k.d?2:0)+(k.unit==='%'?'%':'');}
const unitTail=k=>k.unit==='%'||k.unit==='€'?'':' '+k.unit;
const routeKey=f=>[f.origin,f.destination].sort().join('–');
const kpi=id=>KPIS.find(k=>k.id===id);

function getSelection(code=null,month=null){
 const accept=r=>(code?r.airline===code:state.selected.has(r.airline))&&r.month>=(month||state.from)&&r.month<=(month||state.to);
 const f=DATA.flights.filter(r=>accept(r)&&(state.type==='all'||r.aircraft_type===state.type)&&(state.route==='all'||routeKey(r)===state.route)&&(state.distance==='all'||(state.distance==='short'?r.distance_km<1000:r.distance_km>=1000)));
 const eligible=DATA.airlines.filter(a=>(code?a.code===code:state.selected.has(a.code))&&(state.type==='all'||a.type===state.type)).map(a=>a.code);
 const af=r=>accept(r)&&eligible.includes(r.airline);
 return {flights:f,aircraftDays:DATA.aircraftDays.filter(af),crewDays:DATA.crewDays.filter(af),finance:DATA.finance.filter(af),scope:state.route==='all'&&state.distance==='all'};
}
function calc(code=null,month=null){const x=getSelection(code,month);return aggregate(x.flights,x.aircraftDays,x.crewDays,x.finance,x.scope);}
function visibleKPIs(){if(state.section==='Overview')return ['passengers','plf','otp','clf','cask','profit'].map(kpi);return KPIS.filter(k=>k.category===state.section);}
function table(headers,rows,opts={}){return '<table><thead><tr>'+headers.map((h,i)=>'<th'+(opts.thClass&&opts.thClass[i]?' class="'+opts.thClass[i]+'"':'')+'>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>{const cls=r.cls?' class="'+r.cls+'"':'';const cells=r.cells||r;return '<tr'+cls+'>'+cells.map((c,i)=>{const tc=typeof c==='object'&&c!==null?c:{h:c};return '<td'+(tc.c?' class="'+tc.c+'"':'')+'>'+tc.h+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table>';}
function options(list,value){return list.map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(t)}</option>`).join('');}

function init(){
 $('from').innerHTML=options(months.map((m,i)=>[i+1,m]),1);$('to').innerHTML=options(months.map((m,i)=>[i+1,m]),12);
 $('route').innerHTML=options([['all','All selected routes'],...[...new Set(DATA.routes.map(routeKey))].sort().map(x=>[x,x])],'all');
 $('type').innerHTML=options([['all','All types'],...[...new Set(DATA.airlines.map(a=>a.type))].map(t=>[t,DATA.airlines.find(a=>a.type===t).model+' ('+t+')'])],'all');
 $('trend').innerHTML=options([['scheduled','Scheduled flights'],...KPIS.map(k=>[k.id,k.name])],state.trend);
 ['from','to','route','type','distance'].forEach(id=>$(id).onchange=()=>{state[id]=['from','to'].includes(id)?Number($(id).value):$(id).value;if(state.from>state.to){if(id==='from')state.to=state.from;else state.from=state.to;$('from').value=state.from;$('to').value=state.to;}state.page=0;render();});
 $('trend').onchange=()=>{state.trend=$('trend').value;drawChart();};
 $('single').onclick=()=>{state.mode='single';state.selected=new Set([state.selected.values().next().value||'TK']);render();};$('compare').onclick=()=>{state.mode='compare';render();};
 $('reset').onclick=()=>{Object.assign(state,{mode:'compare',selected:new Set(DATA.airlines.map(a=>a.code)),from:1,to:12,route:'all',type:'all',distance:'all',page:0});['from','to','route','type','distance'].forEach(id=>$(id).value=state[id]);render();};
 $('viewData').onclick=()=>go('Data');$('viewDefs').onclick=()=>go('Definitions & data');$('viewHow').onclick=()=>go('How it works');$('print').onclick=()=>window.print();
 $('backBtn').onclick=goBack;
 readHash();syncKpiForSection();history.replaceState({page:state.section,kpi:state.kpi,idx:0},'',hashFor());render();
}
/* ---------- Navigation with browser history (Back / Forward buttons work) ---------- */
const SECTION_NAMES=[...categories.map(c=>c[0]),'Explanation','Data'];
let navIdx=0;
const hashFor=()=>'#'+new URLSearchParams({page:state.section,kpi:state.kpi}).toString();
function syncKpiForSection(){const ks=KPI_SECTIONS.includes(state.section)?visibleKPIs():[];if(ks.length&&!ks.some(k=>k.id===state.kpi))state.kpi=ks[0].id;if(ks.length){state.trend=state.kpi;$('trend').value=state.trend;}}
function go(section,kpiId){
 if(kpiId)state.kpi=kpiId;
 if(section===state.section&&!kpiId){render();return;}
 state.section=section;syncKpiForSection();
 navIdx++;history.pushState({page:state.section,kpi:state.kpi,idx:navIdx},'',hashFor());
 render();window.scrollTo({top:0});
}
function openKpi(id){go('Explanation',id);}
function goBack(){if(history.state&&history.state.idx>0)history.back();else go('Overview');}
function readHash(){const p=new URLSearchParams(location.hash.slice(1));const page=p.get('page'),k=p.get('kpi');if(page&&SECTION_NAMES.includes(page))state.section=page;if(k&&KPIS.some(x=>x.id===k))state.kpi=k;}
window.addEventListener('popstate',e=>{const s=e.state;if(s){state.section=s.page;state.kpi=s.kpi;navIdx=s.idx||0;}else readHash();syncKpiForSection();render();window.scrollTo({top:0});});

function render(){
 $('nav').innerHTML=categories.map(([c,b])=>`<button class="${state.section===c?'active':''}" data-section="${esc(c)}" aria-current="${state.section===c?'page':'false'}">${esc(c)}<span class="bn">${b}</span></button>`).join('')+'<p class="small">Real identities.<br>Synthetic measurements.<br>বাস্তব নাম, কৃত্রিম সংখ্যা।<br><br>12 months · 2025</p>';
 document.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>go(b.dataset.section));
 $('backbar').hidden=state.section==='Overview'; $('airlines').innerHTML=DATA.airlines.map(a=>`<button class="chip ${state.selected.has(a.code)?'active':''}" aria-pressed="${state.selected.has(a.code)}" data-airline="${a.code}">${a.name} · ${a.code}</button>`).join('');
 document.querySelectorAll('[data-airline]').forEach(b=>b.onclick=()=>{if(state.mode==='single')state.selected=new Set([b.dataset.airline]);else if(state.selected.has(b.dataset.airline))state.selected.delete(b.dataset.airline);else state.selected.add(b.dataset.airline);state.page=0;render();});
 $('single').classList.toggle('active',state.mode==='single');$('compare').classList.toggle('active',state.mode==='compare');
 const result=calc(),s=result.s;
 $('scope').textContent=`${months[state.from-1]}–${months[state.to-1]} 2025 · ${state.selected.size} airline(s) selected · ${num(s.scheduled,0)} scheduled · ${num(s.operated,0)} operated · ${s.cancelled} cancelled · ${s.diverted} diverted. ${state.route!=='all'||state.distance!=='all'?'Route/distance scope: balance, cash-flow, net-profit and utilisation KPIs are unavailable.':'Balances use the last selected month. Utilisation covers sample flying only.'}`;
 ['dashboard','explanation','definitions','dataView','how','glossary'].forEach(id=>$(id).hidden=true);
 const pages={'Definitions & data':['definitions',renderDefinitions],'Data':['dataView',renderData],'Explanation':['explanation',renderExplanation],'How it works':['how',renderHow],'Glossary':['glossary',renderGlossary]};
 if(pages[state.section]){$(pages[state.section][0]).hidden=false;pages[state.section][1]();return;}
 $('dashboard').hidden=false;
 const ks=visibleKPIs();$('cards').innerHTML=ks.map(k=>`<button class="card ${state.kpi===k.id?'selected':''}" data-kpi="${k.id}"><span class="label">${esc(k.name)}<span class="bn">${BN[k.id].name}</span></span><strong>${fmt(result.m[k.id].value,k)}</strong><small>${esc(k.unit)} · definition & calculation</small></button>`).join('');
 document.querySelectorAll('[data-kpi]').forEach(b=>b.onclick=()=>{state.kpi=b.dataset.kpi;state.trend=state.kpi;$('trend').value=state.trend;history.replaceState({page:state.section,kpi:state.kpi,idx:navIdx},'',hashFor());render();});
 const cols=state.section==='Overview'?['plf','otp','cask']:ks.slice(0,5).map(k=>k.id);if(!cols.includes(state.kpi)){cols[cols.length-1]=state.kpi;}
 const rows=DATA.airlines.filter(a=>state.selected.has(a.code)).map(a=>{const r=calc(a.code);return [`<span style="color:${a.color}">●</span> ${esc(a.name)}`,num(r.s.scheduled,0),...cols.map(id=>fmt(r.m[id].value,kpi(id)))];});
 $('comparison').innerHTML=rows.length?table(['Airline','Scheduled',...cols.map(id=>esc(kpi(id).name))],rows):'<p class="empty">Select at least one airline.</p>';
 const k=kpi(state.kpi),v=result.m[k.id];
 $('compact').innerHTML=`<h2>Understand this KPI</h2><h3>${esc(k.name)}</h3><p>${esc(k.definition)}</p><div class="bn-box"><b>বাংলায়:</b> ${BN[k.id].def}</div><div class="equation">${esc(k.formula)}</div><p class="small">Selected result: <strong>${fmt(v.value,k)}${esc(unitTail(k))}</strong></p><div class="equation small-eq">${esc(worked(k,v,result.s))}</div><button id="openExplanation" class="primary">Step-by-step calculation, sample example & practice</button>`;
 $('openExplanation').onclick=()=>openKpi(k.id);
 $('standards').innerHTML=state.section==='Operations'?`<div class="panel"><h2>Minimum turnaround standards</h2><p class="small">Synthetic planning assumptions, not published airline standards or observed minima. (কৃত্রিম পরিকল্পনা মান — প্রকৃত airline মান নয়।)</p>${table(['Airline','Aircraft','Minimum (min)'],DATA.airlines.filter(a=>state.selected.has(a.code)).map(a=>[esc(a.name),esc(a.model),a.turn]))}</div>`:'';
 drawChart();
}

function drawChart(){
 const id=state.trend,k=kpi(id),codes=DATA.airlines.filter(a=>state.selected.has(a.code)),ms=Array.from({length:state.to-state.from+1},(_,i)=>i+state.from);
 const series=codes.map(a=>({a,values:ms.map(m=>{const r=calc(a.code,m);return id==='scheduled'?r.s.scheduled:r.m[id].value;})}));
 const vals=series.flatMap(s=>s.values.filter(v=>v!=null));if(!vals.length){$('chart').innerHTML='<div class="empty">No applicable observations for this selection.</div>';$('legend').innerHTML='';$('monthly').innerHTML='';return;}
 let lo=Math.min(0,...vals),hi=Math.max(...vals,1);if(k?.unit==='%')hi=Math.max(100,hi);const range=hi-lo||1;
 const x=i=>65+i*(760/Math.max(1,ms.length-1)),y=v=>240-(v-lo)/range*190;
 let svg='<svg viewBox="0 0 860 285" role="img" aria-label="Monthly synthetic '+esc(k?.name||'scheduled flights')+' by airline">';
 for(let j=0;j<=4;j++){const v=lo+range*j/4;svg+=`<line x1="65" y1="${y(v)}" x2="825" y2="${y(v)}" stroke="#e0e7ee"/><text x="56" y="${y(v)+4}" text-anchor="end" font-size="11" fill="#64778a">${esc(Math.abs(v)>99999?num(v/1e6,1)+'m':Math.abs(v)>9999?num(v/1000,0)+'k':num(v,k?.unit.startsWith('€/')?3:1))}</text>`;}
 ms.forEach((m,i)=>svg+=`<text x="${x(i)}" y="265" text-anchor="middle" font-size="12" fill="#63768a">${months[m-1]}</text>`);
 series.forEach(s=>{let path='';let connected=false;s.values.forEach((v,i)=>{if(v==null){connected=false;return;}path+=`${connected?'L':'M'}${x(i)},${y(v)} `;connected=true;});svg+=`<path d="${path}" fill="none" stroke="${s.a.color}" stroke-width="2.5"/>`;s.values.forEach((v,i)=>{if(v!=null)svg+=`<circle tabindex="0" cx="${x(i)}" cy="${y(v)}" r="4" fill="${s.a.color}" aria-label="${esc(s.a.name+' '+months[ms[i]-1]+': '+(k?fmt(v,k):num(v,0)))}"><title>${esc(s.a.name+' · '+months[ms[i]-1]+': '+(k?fmt(v,k):num(v,0)))}</title></circle>`;});});
 $('chart').innerHTML=svg+'</svg>';$('legend').innerHTML=series.map(s=>`<span><i style="background:${s.a.color}"></i>${esc(s.a.name)}</span>`).join('')+`<span>Unit: ${esc(k?.unit||'scheduled sectors')}</span>`;
 $('monthly').innerHTML=table(['Month',...series.map(s=>esc(s.a.name))],ms.map((m,i)=>[months[m-1],...series.map(s=>k?fmt(s.values[i],k):num(s.values[i],0))]));
}

/* ---------- Calculation display helpers ---------- */
function worked(k,v,s){if(v.value==null)return 'Not applicable for this selection. Select matching data with a non-zero denominator; remove route/distance filters for airline-month measures.';if(k.d)return `${num(v.n,3)} ÷ ${num(v.d,3)}${k.mult!==1?' × '+num(k.mult,0):''} = ${fmt(v.value,k)}${unitTail(k)}`;if(k.id==='profit')return `€${num(s.revenue,0)} − €${num(s.cost,0)} = ${fmt(v.value,k)}`;if(k.id==='shortDebt'||k.id==='longDebt')return `Sum of selected airlines’ closing balances for ${months[state.to-1]} 2025 = ${fmt(v.value,k)}. Earlier monthly balances are not added.`;return `Sum of applicable ${k.scope?'monthly':'sector'} observations = ${fmt(v.value,k)}${unitTail(k)}`;}
function rowLabel(r,src){if(src==='flights')return `${r.id} <span class="small">${esc(r.origin)}→${esc(r.destination)} · ${esc(r.status)}</span>`;if(src==='aircraftDays')return `${r.date} <span class="small">${esc(r.aircraft_id)}</span>`;if(src==='crewDays')return `${r.date} <span class="small">${esc(r.airline)}</span>`;return `${esc(r.airline)} · ${months[r.month-1]}`;}
function stepTable(k,rows,s,limit){
 const src=COMP[k.n].src,cn=COMP[k.n],cd=k.d?COMP[k.d]:null,cx=compContext(rows);
 const fields=[...new Set([...cn.fields,...(cd?cd.fields:[])])].filter(f=>f!=='status');
 const head=['Row',...fields.map(esc),'Numerator: '+esc(cn.label)+(cd?'':' (= KPI)'),...(cd?['Denominator: '+esc(cd.label)]:[])];
 const thc=[...head.map(()=>''),];thc[fields.length+1]='num-col';if(cd)thc[fields.length+2]='den-col';
 const cell=(c,r)=>{const x=c.f(r,cx);return x.v===null?{h:esc(x.t),c:'excluded'}:{h:esc(x.t),c:c===cn?'num-col':'den-col'};};
 const shown=limit?rows.slice(0,limit):rows;
 const body=shown.map(r=>[rowLabel(r,src),...fields.map(f=>r[f]===null||r[f]===undefined?'<span class="small">blank</span>':esc(typeof r[f]==='number'?num(r[f],4):r[f])),cell(cn,r),...(cd?[cell(cd,r)]:[])]);
 if(limit&&rows.length>limit)body.push({cells:[`<span class="small">… ${num(rows.length-limit,0)} more rows</span>`,...fields.map(()=>''),'⋮',...(cd?['⋮']:[])]});
 body.push({cls:'total',cells:['Σ Total'+(limit&&rows.length>limit?' (all '+num(rows.length,0)+' rows)':''),...fields.map(()=>''),{h:num(s[k.n],3),c:'num-col'},...(cd?[{h:num(s[k.d],3),c:'den-col'}]:[])]});
 return '<div class="scroll">'+table(head,body,{thClass:thc})+'</div>';
}
function finalLine(k,s,scope=true){const v=aggregateValue(k,s,scope);if(v==null)return 'Not applicable (denominator is zero or out of scope) — N/A';return k.d?`${num(s[k.n],3)} ÷ ${num(s[k.d],3)}${k.mult!==1?' × '+num(k.mult,0):''} = ${fmt(v,k)}${unitTail(k)}`:`${COMP[k.n].label} = ${fmt(v,k)}${unitTail(k)}`;}
function aggregateValue(k,s,scope){if(k.scope&&!scope)return null;const d=k.d?s[k.d]:1;return d?s[k.n]/d*(k.mult||1):null;}
function compBoxes(k){const cn=COMP[k.n],cd=k.d?COMP[k.d]:null;
 return `<div class="comp"><div class="n"><strong>Numerator (লব): ${esc(cn.label)}</strong><p>${esc(cn.rule)}</p><div class="bn-box">${cn.bn} — ${src_bn(cn.src)}</div></div>${cd?`<div class="d"><strong>Denominator (হর): ${esc(cd.label)}</strong><p>${esc(cd.rule)}</p><div class="bn-box">${cd.bn} — ${src_bn(cd.src)}</div></div>`:`<div class="d"><strong>No denominator</strong><p>This KPI is a total (Σ), not a ratio.</p><div class="bn-box">এটা অনুপাত নয়, শুধু যোগফল (total)।</div></div>`}</div>${k.mult!==1?`<p><strong>Multiplier (গুণক): × ${num(k.mult,0)}</strong> — ${k.mult===100?'converts the ratio to a percentage (শতাংশে রূপান্তর)।':'expresses the rate per '+num(k.mult,0)+' passengers (প্রতি '+num(k.mult,0)+' যাত্রীর হিসেবে)।'}</p>`:''}`;}
function src_bn(src){return {flights:'উৎস: flight sectors টেবিল',aircraftDays:'উৎস: aircraft days টেবিল',crewDays:'উৎস: pilot days টেবিল',finance:'উৎস: monthly finance টেবিল'}[src];}

/* ---------- KPI explanation page ---------- */
function renderExplanation(){const k=kpi(state.kpi),r=calc(),v=r.m[k.id],p=PRACTICE[k.id],src=COMP[k.n].src,sel=getSelection();
 const sampleRes=aggregate(SAMPLE.flights,SAMPLE.aircraftDays,SAMPLE.crewDays,SAMPLE.finance,true);
 const liveRows=src==='flights'?sel.flights:sel.scope?sel[src]:[];
 const perAirline=DATA.airlines.filter(a=>state.selected.has(a.code)).map(a=>{const x=calc(a.code),m=x.m[k.id];return [`<span style="color:${a.color}">●</span> ${esc(a.name)}`,num(x.s[k.n],3),...(k.d?[num(x.s[k.d],3)]:[]),fmt(m.value,k)];});
 const sampleNote={flights:'৪টি flight-এর একটি ছোট নমুনা: F1 ও F2 স্বাভাবিক, F3 diverted (অন্য বিমানবন্দরে নেমেছে), F4 cancelled (বাতিল)।',aircraftDays:'একটি বিমানের ৩ দিনের নমুনা — ৩য় দিন বিমানটি ওড়েনি (idle day), কিন্তু হরে (denominator) সেটাও ধরা হয়।',crewDays:'৩ দিনের নমুনা, প্রতিদিন ৪ জন pilot rostered; ৩য় দিন কোনো flight নেই।',finance:'একটি airline-এর ২ মাসের (Jan, Feb) মাসিক আর্থিক নমুনা।'}[src];
 $('explanation').innerHTML=`<div class="panel explainfull"><button id="back">${esc(k.category)} dashboard →</button><h2 style="margin-top:20px">Understand this KPI</h2><label for="chooseKpi">Select an indicator</label><select id="chooseKpi">${options(KPIS.map(k=>[k.id,k.name+' — '+BN[k.id].name]),k.id)}</select><p class="small">Live result uses the current filter selection. All figures are synthetic.</p><div class="result">${fmt(v.value,k)}<span class="small" style="font-size:14px">${esc(unitTail(k))}</span></div>
 <div class="learning-section"><h3>1. Definition (সংজ্ঞা)</h3>${esc(k.definition)}<div class="bn-box"><b>${BN[k.id].name}:</b> ${BN[k.id].def}</div><p class="small">Unit (একক): ${esc(k.unit)}</p></div>
 <div class="learning-section"><h3>2. Formula (সূত্র)</h3><div class="equation">${esc(k.formula)}</div>${compBoxes(k)}</div>
 <div class="learning-section"><h3>3. Sample example — step by step (নমুনা উদাহরণ, ধাপে ধাপে)</h3><div class="bn-box">${sampleNote}</div>
  <ol class="steps"><li><strong>Identify the numerator and denominator.</strong> (লব ও হর চিহ্নিত করুন) — see the boxes above.</li>
  <li><strong>Apply the row rule to every row.</strong> (প্রতিটি row-এ নিয়ম প্রয়োগ করুন) Grey italic cells are excluded (বাদ).</li></ol>
  ${stepTable(k,SAMPLE[src],sampleRes.s)}
  <ol class="steps" start="3" style="counter-reset:step 2"><li><strong>Add each column (Σ).</strong> (প্রতিটি কলাম যোগ করুন) Numerator = ${num(sampleRes.s[k.n],3)}${k.d?', denominator = '+num(sampleRes.s[k.d],3):''}.</li>
  <li><strong>${k.d?'Divide the totals'+(k.mult!==1?' and apply the multiplier':'')+'.':'The total is the KPI.'}</strong> (${k.d?'মোট লবকে মোট হর দিয়ে ভাগ করুন'+(k.mult!==1?', তারপর গুণক দিয়ে গুণ করুন':''):'যোগফলই KPI'})</li></ol>
  <div class="equation">${esc(finalLine(k,sampleRes.s))}</div></div>
 <div class="learning-section"><h3>4. Worked example on the dashboard data (আসল ডেটায় হিসাব)</h3><p class="small">Current filter: ${months[state.from-1]}–${months[state.to-1]} 2025 · ${state.selected.size} airline(s). Same rules, more rows.</p><div class="equation">${esc(worked(k,v,r.s))}</div>
  ${liveRows.length?`<details open><summary>Trace: first 8 rows of the calculation (প্রথম ৮টি row)</summary>${stepTable(k,liveRows,r.s,8)}</details>`:'<p class="empty">No rows in scope for this KPI. Remove route/distance filters for airline-month KPIs.</p>'}
  ${perAirline.length?`<details open><summary>Breakdown by airline (airline অনুযায়ী)</summary><div class="scroll">${table(['Airline','Numerator: '+esc(COMP[k.n].label),...(k.d?['Denominator: '+esc(COMP[k.d].label)]:[]),esc(k.name)],perAirline)}</div><p class="small">Note: the combined result is Σ numerator ÷ Σ denominator — not the average of the airline results. (মোট ফলাফল = মোট লব ÷ মোট হর, airline-গুলোর ফলাফলের গড় নয়।)</p></details>`:''}
  <button id="trace">Inspect underlying data</button></div>
 <div class="learning-section"><h3>5. Interpretation (ব্যাখ্যা)</h3>${esc(k.interpretation)}</div>
 <div class="learning-section"><h3>6. Common mistake (সাধারণ ভুল)</h3><div class="warning">${esc(k.mistake)}</div><div class="bn-box"><b>সতর্কতা:</b> ${BN[k.id].tip}</div></div>
 <div class="practice"><h3>7. Try it yourself (নিজে চেষ্টা করুন)</h3>${p?`<p>${esc(p.q)}</p><label for="answer">Your numerical answer</label><input id="answer" type="number" step="any"><button id="check">Check answer</button><button id="solution">Show explanation</button><div id="feedback" class="feedback" aria-live="polite"></div>`:`<p>Which input could change this KPI, and what would you hold constant to make a fair comparison?</p><details><summary>Show discussion guidance</summary><p>Use the formula to identify the contributing inputs. ${esc(k.interpretation)} ${esc(k.mistake)}</p></details>`}</div></div>`;
 $('back').onclick=()=>go(k.category);$('chooseKpi').onchange=()=>{state.kpi=$('chooseKpi').value;history.replaceState({page:state.section,kpi:state.kpi,idx:navIdx},'',hashFor());renderExplanation();};$('trace').onclick=()=>{state.table=k.scope?src:'flights';go('Data');};
 if(p){$('check').onclick=()=>{$('feedback').textContent=$('answer').value.trim()===''?'Enter an answer first. (আগে উত্তর লিখুন)':Math.abs(Number($('answer').value)-p.answer)<=p.tol?'Correct ✓ (সঠিক) '+p.ex:'Try again. Identify the numerator and denominator, then apply the multiplier. (আবার চেষ্টা করুন — লব, হর ও গুণক ঠিক করুন)';};$('solution').onclick=()=>{$('feedback').textContent=p.ex;};}
}

/* ---------- How it works page ---------- */
function renderHow(){
 const sr=aggregate(SAMPLE.flights,SAMPLE.aircraftDays,SAMPLE.crewDays,SAMPLE.finance,true);
 const f=SAMPLE.finance[1];
 const sampleFlights=table(['ID','Route','Status','km','Seats','Pax','Cargo cap kg','Cargo kg','Bag kg','Delay min','Turn min','Gate chg','Bags D/L/Dm','Compl./Compl.','Revenue €','Cost €'],SAMPLE.flights.map(r=>[r.id,r.origin+'→'+r.destination,r.status,num(r.distance_km,0),r.seats,r.passengers,num(r.cargo_capacity_kg,0),num(r.cargo_kg,0),num(r.baggage_kg,0),r.arrival_delay_min??'blank',r.turnaround_min??'blank',r.gate_change,`${r.delayed_bags}/${r.lost_bags}/${r.damaged_bags}`,`${r.complaints}/${r.compliments}`,num(r.operating_revenue_eur,0),num(r.operating_cost_eur,0)]));
 const allSample=table(['KPI','বাংলা','Calculation on the sample','Result'],KPIS.map(k=>[`<button class="linkbtn" data-open="${k.id}" style="border:0;background:none;color:var(--blue);padding:0;font-size:12px;text-align:left">${esc(k.name)}</button>`,{h:BN[k.id].name,c:'left'},{h:esc(finalLine(k,sr.s)),c:'left'},fmt(aggregateValue(k,sr.s,true),k)]));
 $('how').innerHTML=`<div class="panel"><h2>How every KPI is calculated (প্রতিটি KPI কীভাবে হিসাব হয়)</h2>
 <p>Every number on this dashboard follows the same five-step pipeline:</p>
 <div class="flow"><span>1. Raw data<br><small>৪টি টেবিল</small></span><b>→</b><span>2. Filters<br><small>airline, মাস, route, টাইপ, দূরত্ব</small></span><b>→</b><span>3. Row rules<br><small>operated / cancelled বাছাই</small></span><b>→</b><span>4. Totals Σ<br><small>কলাম যোগ</small></span><b>→</b><span>5. Ratio × multiplier<br><small>ভাগ ও গুণ</small></span></div>
 <div class="bn-box"><b>বাংলায় সংক্ষেপে:</b> প্রথমে কাঁচা ডেটা (raw data) থেকে আপনার বেছে নেওয়া filter অনুযায়ী row নেওয়া হয়। তারপর প্রতিটি row-এ নিয়ম প্রয়োগ হয় (যেমন বাতিল flight-এর যাত্রী/আসন ধরা হয় না)। এরপর লব (numerator) ও হর (denominator) কলামগুলো যোগ করা হয়। শেষে মোট লব ÷ মোট হর × গুণক (multiplier) = KPI।</div>
 <h3>The four data tables (৪টি ডেটা টেবিল)</h3>
 ${table(['Table','Rows','What one row means','বাংলা'],[['Flight sectors',num(DATA.flights.length,0),'One scheduled flight leg','একটি নির্ধারিত flight'],['Aircraft days',num(DATA.aircraftDays.length,0),'One aircraft on one calendar day','একটি বিমানের একটি দিন'],['Pilot days',num(DATA.crewDays.length,0),'One airline\'s pilot roster on one day','একটি airline-এর একদিনের pilot roster'],['Monthly finance',num(DATA.finance.length,0),'One airline in one month','একটি airline-এর এক মাসের হিসাব']].map(r=>[r[0],r[1],{h:r[2],c:'left'},{h:r[3],c:'left'}]))}
 <h3 style="margin-top:18px">Key rules (মূল নিয়ম)</h3>
 <ul><li><strong>Cancelled</strong> flights count in the cancellation rate, revenue and cost, but contribute no passengers, ASK, RPK, cargo or delay. <span class="bn-box" style="display:inline">বাতিল flight-এর খরচ ধরা হয়, কিন্তু যাত্রী/আসন নয়।</span></li>
 <li><strong>Diverted</strong> flights are operated (count in ASK, RPK) but are never on time. <span class="bn-box" style="display:inline">Diverted flight উড়েছে, কিন্তু on-time নয়।</span></li>
 <li><strong>Early arrivals</strong> count as 0 delay, not negative. <span class="bn-box" style="display:inline">আগে পৌঁছালে বিলম্ব = ০।</span></li>
 <li><strong>Blank</strong> turnaround = not observed → excluded, not zero. <span class="bn-box" style="display:inline">ফাঁকা মান = বাদ, ০ নয়।</span></li>
 <li><strong>Zero denominator</strong> → N/A, never 0%. <span class="bn-box" style="display:inline">হর শূন্য হলে উত্তর N/A।</span></li>
 <li><strong>Route/distance filters</strong> disable airline-month KPIs (utilisation, net profit, cash flow, debt) because those tables are not split by route. <span class="bn-box" style="display:inline">এই টেবিলগুলো route অনুযায়ী ভাগ করা নেই।</span></li></ul></div>
 <div class="panel"><h2>The sample used in every worked example (নমুনা ডেটা)</h2><p class="small">"Sample Air" — 4 flights with round numbers. F3 is diverted and F4 is cancelled to show the rules.</p><div class="scroll">${sampleFlights}</div>
 <h3 style="margin-top:18px">All 34 KPIs calculated on this sample (নমুনায় সব KPI)</h3><p class="small">Click a KPI to open its full step-by-step table.</p><div class="scroll">${allSample}</div></div>
 <div class="panel"><h2>Why "sum first, then divide"? (কেন আগে যোগ, পরে ভাগ?)</h2>
 ${table(['Flight','Seats','Pax','km','ASK = seats×km','RPK = pax×km','Flight PLF'],[['A','100','90','500','50,000','45,000','90%'],['B','200','100','2,000','400,000','200,000','50%'],{cls:'total',cells:['Total','','','','450,000','245,000','']}])}
 <div class="warning" style="margin-top:12px">❌ Wrong: average of percentages = (90% + 50%) ÷ 2 = <strong>70%</strong></div>
 <div class="equation">✔ Right: 245,000 ÷ 450,000 × 100 = 54.44%</div>
 <div class="bn-box">Flight B অনেক বড় (বেশি আসন, বেশি দূরত্ব), তাই মোট ফলাফলে তার প্রভাব বেশি হওয়া উচিত। সাধারণ গড় (simple average) দুটো flight-কে সমান গুরুত্ব দেয় — যা ভুল। মোট ÷ মোট করলে স্বয়ংক্রিয়ভাবে weighted average (ভারযুক্ত গড়) পাওয়া যায়।</div></div>
 <div class="panel"><h2>The financial chain (আর্থিক হিসাবের ধারা) — sample February</h2>
 <ol class="steps">
 <li>Operating revenue − operating cost = <strong>operating profit</strong>: ${num(f.operating_revenue_eur,0)} − ${num(f.operating_cost_eur,0)} = <strong>€${num(f.operating_profit_eur,0)}</strong> <span class="small">(পরিচালন মুনাফা)</span></li>
 <li>Operating profit − interest − tax = <strong>net profit</strong>: ${num(f.operating_profit_eur,0)} − ${num(f.interest_eur,0)} − ${num(f.tax_eur,0)} = <strong>€${num(f.net_profit_eur,0)}</strong> <span class="small">(নিট মুনাফা)</span></li>
 <li>Net profit + depreciation − working-capital increase = <strong>operating cash flow</strong>: ${num(f.net_profit_eur,0)} + ${num(f.depreciation_eur,0)} − ${num(f.working_capital_increase_eur,0)} = <strong>€${num(f.operating_cashflow_eur,0)}</strong> <span class="small">(পরিচালন নগদ প্রবাহ — depreciation নগদ খরচ নয় বলে যোগ হয়)</span></li>
 <li>Operating CF − capex + new borrowing − repayment = <strong>net cash flow</strong>: ${num(f.operating_cashflow_eur,0)} − ${num(f.capex_eur,0)} + ${num(f.new_borrowing_eur,0)} − ${num(f.debt_repayment_eur,0)} = <strong>€${num(f.net_cashflow_eur,0)}</strong> <span class="small">(নিট নগদ প্রবাহ)</span></li>
 <li>Opening cash + net cash flow = <strong>closing cash</strong>: ${num(f.opening_cash_eur,0)} + ${num(f.net_cashflow_eur,0)} = <strong>€${num(f.closing_cash_eur,0)}</strong> <span class="small">(মাস শেষের নগদ)</span></li></ol>
 <div class="bn-box"><b>Flow বনাম Stock:</b> মুনাফা ও cash flow হলো <b>flow</b> — মাসগুলো যোগ করা যায় (Jan + Feb)। ঋণ (debt) ও নগদ স্থিতি হলো <b>stock</b> — একটি নির্দিষ্ট দিনের ছবি, তাই শুধু শেষ মাসেরটা নেওয়া হয়, যোগ করা হয় না।</div></div>`;
 document.querySelectorAll('#how [data-open]').forEach(b=>b.onclick=()=>openKpi(b.dataset.open));
}

/* ---------- Glossary page ---------- */
function renderGlossary(){
 $('glossary').innerHTML=`<div class="panel"><h2>Glossary — শব্দকোষ</h2><p>Technical terms stay in English; each has a short Bangla explanation. (প্রযুক্তিগত শব্দ ইংরেজিতে রাখা হয়েছে, সাথে সংক্ষিপ্ত বাংলা ব্যাখ্যা।)</p><label for="searchGloss">Search term (খুঁজুন)</label><input id="searchGloss" placeholder="e.g. ASK, depreciation, ঋণ"><div id="glossTable" class="scroll" style="margin-top:12px"></div></div>
 <div class="panel"><h2>KPI names in Bangla (KPI-এর বাংলা নাম)</h2><div class="scroll">${table(['KPI','বাংলা নাম','Unit','Category'],KPIS.map(k=>[`<button data-open="${k.id}" style="border:0;background:none;color:var(--blue);padding:0;font-size:12px">${esc(k.name)}</button>`,{h:BN[k.id].name,c:'left'},esc(k.unit),esc(k.category)]))}</div></div>`;
 const upd=()=>{const q=$('searchGloss').value.toLowerCase();const rows=GLOSSARY.filter(g=>g.join(' ').toLowerCase().includes(q));$('glossTable').innerHTML=rows.length?table(['Term','English meaning','বাংলা ব্যাখ্যা'],rows.map(g=>[`<strong>${esc(g[0])}</strong>`,{h:esc(g[1]),c:'left'},{h:esc(g[2]),c:'left'}])):'<p class="empty">No match.</p>';};
 $('searchGloss').oninput=upd;upd();document.querySelectorAll('#glossary [data-open]').forEach(b=>b.onclick=()=>openKpi(b.dataset.open));
}

/* ---------- Definitions & data ---------- */
function renderDefinitions(){
 $('definitions').innerHTML=`<div class="panel"><h2>Definitions & data</h2><p>34 calculated indicators, plus minimum turnaround standards by airline. Definitions describe this teaching dataset.</p><label for="searchDef">Find a KPI</label><input id="searchDef" placeholder="e.g. load factor, baggage, debt"><div id="dict"></div></div><div class="panel"><h2>Fleet & airport reference</h2><div class="scroll">${table(['Airline','IATA / ICAO','Model','Type','Seats'],DATA.airlines.map(a=>[esc(a.name),a.code+' / '+a.icao,esc(a.model),a.type,a.seats]))}</div><p class="small">One representative model per airline. Operating carriers are stored separately. Aircraft IDs are synthetic.</p><div class="scroll">${table(['Airport','IATA','ICAO','Country'],DATA.airports.map(a=>[esc(a.name),a.iata,a.icao,esc(a.country)]))}</div><div class="scroll" style="margin-top:12px">${table(['Airline','Route','Distance (km)'],DATA.routes.map(r=>[r.airline,r.origin+' ⇄ '+r.destination,num(r.distance_km,0)]))}</div></div><div class="panel"><h2>Scope, assumptions & AI disclosure</h2><ol>${DATA.notes.map(n=>'<li style="margin-bottom:12px">'+esc(n)+'</li>').join('')}</ol></div><div class="panel"><h2>Sources for aviation identities</h2><p class="small">Fleet and route identity evidence does not verify every historical aircraft assignment. Synthetic data are generated from teaching assumptions, not these airlines’ performance reports.</p><ul class="source-list">${DATA.sources.map(([t,u,n])=>`<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a> — ${esc(n)}</li>`).join('')}</ul></div>`;
 function update(){const q=$('searchDef').value.toLowerCase();$('dict').innerHTML=KPIS.filter(k=>(k.name+' '+k.definition+' '+k.category+' '+BN[k.id].name+' '+BN[k.id].def).toLowerCase().includes(q)).map(k=>`<div class="dict-item"><strong>${esc(k.name)}</strong> <span class="status">${esc(k.category)}</span><p>${esc(k.definition)}</p><div class="bn-box"><b>${BN[k.id].name}:</b> ${BN[k.id].def}</div><p><strong>Formula:</strong> ${esc(k.formula)} · ${esc(k.unit)}</p><button data-open="${k.id}">Step-by-step example & practice</button></div>`).join('');document.querySelectorAll('#dict [data-open]').forEach(b=>b.onclick=()=>openKpi(b.dataset.open));}$('searchDef').oninput=update;update();
}

/* ---------- Data view ---------- */
function dataset(){const sel=getSelection();let rows=state.table==='flights'?sel.flights:sel.scope?sel[state.table]:[];if(state.query){const q=state.query.toLowerCase();rows=rows.filter(r=>Object.values(r).some(v=>String(v??'').toLowerCase().includes(q)));}return rows;}
function renderData(){
 const labels={flights:'Flight sectors',aircraftDays:'Aircraft days',crewDays:'Pilot days',finance:'Monthly finance'};
 $('dataView').innerHTML=`<div class="panel"><h2>Inspect & download data</h2><p class="small">Downloads contain the current filter selection. All measurements are synthetic. Supporting tables require all-route/all-distance scope.</p><div class="tools"><label>Table <select id="dataset">${options(Object.entries(labels),state.table)}</select></label><label>Search rows <input id="dataSearch" value="${esc(state.query)}" placeholder="Code, date or status"></label><button id="csv" class="primary">Download filtered CSV</button><button id="json">Download full dataset (JSON)</button><button id="dictionary">Download data dictionary (CSV)</button></div><div class="scroll" id="dataTable"></div><div class="pagination"><button id="prev">Previous</button><span id="pageLabel"></span><button id="next">Next</button></div></div>`;
 $('dataset').onchange=()=>{state.table=$('dataset').value;state.page=0;updateDataRows();};$('dataSearch').oninput=()=>{state.query=$('dataSearch').value;state.page=0;updateDataRows();};$('prev').onclick=()=>{state.page--;updateDataRows();};$('next').onclick=()=>{state.page++;updateDataRows();};
 $('csv').onclick=()=>downloadCSV(dataset(),`SYNTHETIC_${state.table}_2025.csv`);$('json').onclick=()=>save(JSON.stringify(DATA,null,2),'SYNTHETIC_all_data_2025.json','application/json');$('dictionary').onclick=()=>downloadCSV(DATA.dictionary,'Data_Dictionary.csv');updateDataRows();
}
function updateDataRows(){const rows=dataset(),size=25,pages=Math.max(1,Math.ceil(rows.length/size));state.page=Math.max(0,Math.min(pages-1,state.page));const headers=Object.keys(rows[0]||{});$('dataTable').innerHTML=rows.length?table(headers.map(esc),rows.slice(state.page*size,(state.page+1)*size).map(r=>headers.map(h=>r[h]===null?'<span class="small">N/A</span>':esc(r[h])))):'<p class="empty">No applicable records. Check filters and search.</p>';$('pageLabel').textContent=`Page ${state.page+1} of ${pages} · ${rows.length.toLocaleString()} rows`;$('prev').disabled=state.page===0;$('next').disabled=state.page>=pages-1;$('csv').disabled=!rows.length;}
function save(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function downloadCSV(rows,name){if(!rows.length)return;const headers=Object.keys(rows[0]);const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';save('﻿'+[headers.map(q).join(','),...rows.map(r=>headers.map(h=>q(r[h])).join(','))].join('\r\n'),name,'text/csv;charset=utf-8');}
init();
