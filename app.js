/* ===== البيانات ===== */
const $=s=>document.querySelector(s);
const KEY='cafe_v1';
let S;try{S=JSON.parse(localStorage.getItem(KEY))}catch(e){}
S=Object.assign({items:[],products:[],purchases:[],sales:[],waste:[]},S||{});
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){toast('تعذر الحفظ في المتصفح')}};
const uid=()=>Math.random().toString(36).slice(2,9);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pad=x=>String(x).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today=()=>ymd(new Date());
const n=(v,d=2)=>(+v||0).toLocaleString('en-US',{maximumFractionDigits:d});
const val=id=>$('#'+id).value;
const item=id=>S.items.find(i=>i.id==id);
const prod=id=>S.products.find(p=>p.id==id);
const KINDS={g:{unit:'جرام',label:'وزن (بالجرام) — بن، سكر، نسكافيه',buy:[['جرام',1],['كيلو',1000]]},
  ml:{unit:'مللي',label:'سائل (بالمللي) — لبن، مياه، سيروب',buy:[['مللي',1],['لتر',1000]]},
  pc:{unit:'قطعة',label:'عدد (بالقطعة) — أكواب، أغطية، مصاصات',buy:[['قطعة',1],['دستة (12)',12]]}};
const buyUnits=it=>{const k=Object.values(KINDS).find(k=>k.unit==it.unit);return k?k.buy:[[it.unit,1]]};
const costOf=p=>p.recipe.reduce((a,r)=>a+r.q*(item(r.iid)?.avg||0),0);

let tab='sales',month=today().slice(0,7),cart={},saleDate=today(),showAll=false;

/* ===== واجهة عامة ===== */
const ICONS={
 sales:'<path d="M3 4h2l2.4 11h10.2L20 7H6.2"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h10"/>',
 stock:'<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
 report:'<path d="M5 20V10M12 20V4M19 20v-7"/>'};
const TABS=[['sales','البيع'],['menu','المنتجات'],['stock','المخزون'],['report','التقرير']];
function go(t){tab=t;render();window.scrollTo(0,0)}
function render(){
  $('#nav').innerHTML=TABS.map(([k,l])=>`<button class="${k==tab?'on':''}" onclick="go('${k}')"><svg viewBox="0 0 24 24">${ICONS[k]}</svg>${l}</button>`).join('');
  $('#app').innerHTML={sales:vSales,menu:vMenu,stock:vStock,report:vReport}[tab]();
}
function openModal(h){$('#modal').innerHTML=`<div class="sheet"><button class="ic cl" onclick="closeModal()" aria-label="إغلاق">✕</button>${h}</div>`;$('#modal').hidden=false}
function closeModal(){$('#modal').hidden=true;$('#modal').innerHTML=''}
$('#modal').addEventListener('click',e=>{if(e.target.id=='modal')closeModal()});
document.addEventListener('keydown',e=>{if(e.key=='Escape')closeModal()});
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),2200)}
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type+';charset=utf-8'}));a.download=name;a.click()}
const itemOpts=sel=>S.items.map(i=>`<option value="${i.id}" data-u="${esc(i.unit)}" ${i.id==sel?'selected':''}>${esc(i.name)}</option>`).join('');
const emptyCard=(t,d,b,fn)=>`<div class="card" style="text-align:center;padding:26px 16px"><h3>${t}</h3><p class="mu">${d}</p><button class="btn" onclick="${fn}">${b}</button></div>`;

/* ===== البيع ===== */
function recordSale(p,q,date){
  const uses=[];let cost=0;
  p.recipe.forEach(r=>{const it=item(r.iid);if(!it)return;const u=r.q*q,c=u*it.avg;it.stock-=u;cost+=c;uses.push({iid:it.id,q:u,c})});
  S.sales.push({id:uid(),date,pid:p.id,name:p.name,emoji:p.emoji||'☕',qty:q,revenue:p.price*q,cost,uses});
}
function vWelcome(){
  const hasI=S.items.length>0,hasP=S.purchases.length>0,hasPr=S.products.length>0;
  const st=(done,no,t,d,b,fn,ok)=>`<div class="card step ${done?'done':''}"><div class="no">${done?'✓':no}</div><div class="fx"><b>${t}</b><span class="mu">${d}</span></div>${done?'':`<button class="btn sm ${ok?'':'off'}" onclick="${fn}">${b}</button>`}</div>`;
  return `<div class="bar"><h2>خلّينا نجهّز الكافيه</h2></div>
  ${st(hasI,1,'ضيف الخامات','بن، سكر، لبن، أكواب...','ضيف خامة','openItem()',true)}
  ${st(hasP,2,'سجّل أول شراء','الكمية وإجمالي اللي دفعته','سجّل شراء','openBuy()',hasI)}
  ${st(hasPr,3,'اعمل أول منتج','سعره والخامات اللي بتدخل فيه','منتج جديد','openProduct()',hasI)}
  <p class="mu" style="text-align:center;margin-top:18px">عايز تجرب الأول؟ <a href="#" onclick="loadDemo();return false" style="color:var(--ok)">حمّل بيانات تجريبية</a></p>`;
}
function vSales(){
  if(!S.items.length||!S.products.length||!S.purchases.length)return vWelcome();
  const td=today(),ts=S.sales.filter(s=>s.date==td);
  const rev=ts.reduce((a,s)=>a+s.revenue,0),cnt=ts.reduce((a,s)=>a+s.qty,0);
  const low=S.items.filter(i=>i.stock<=0);
  const ent=Object.entries(cart).filter(([id])=>prod(id));
  const total=ent.reduce((a,[id,q])=>a+q*prod(id).price,0),count=ent.reduce((a,[,q])=>a+q,0);
  const list=(showAll?S.sales:ts).slice().reverse().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,40);
  return `<div class="today"><div><small>مبيعات النهاردة</small><span class="big">${n(rev)} ج</span></div><div><small>عدد القطع</small><span class="big">${n(cnt,0)}</span></div></div>
  ${low.length?`<div class="warn">خلصت أو سالبة: ${low.map(i=>esc(i.name)).join('، ')} — سجّل شراء أو اعمل جرد من المخزون.</div>`:''}
  <div class="grid">${S.products.map(p=>{const q=cart[p.id]||0;return `<div class="tile ${q?'sel':''}" onclick="cartAdd('${p.id}',1)">${q?`<span class="bdg">${q}</span><button class="mn" aria-label="إنقاص" onclick="event.stopPropagation();cartAdd('${p.id}',-1)">−</button>`:''}<div class="em">${esc(p.emoji||'☕')}</div><b>${esc(p.name)}</b><small>${n(p.price)} ج</small></div>`}).join('')}</div>
  <div class="card"><div class="bar" style="margin:0 0 6px"><h3 style="margin:0">${showAll?'كل العمليات':'عمليات النهاردة'}</h3><button class="btn s sm" onclick="showAll=!showAll;render()">${showAll?'النهاردة بس':'عرض الكل'}</button></div>
  ${list.map(s=>`<div class="row"><span class="em">${esc(s.emoji||'☕')}</span><div class="fx"><b>${esc(s.name)}</b> × ${s.qty}<div class="mu">${s.date}</div></div><b>${n(s.revenue)} ج</b><button class="x" aria-label="حذف" onclick="delSale('${s.id}')">✕</button></div>`).join('')||'<p class="mu">لسه مفيش عمليات النهاردة. اضغط على أي منتج فوق عشان تبدأ.</p>'}</div>
  <div class="card"><label style="margin-top:0">تسجيل على تاريخ تاني (لو نسيت تسجّل امبارح)</label><input type="date" value="${saleDate}" onchange="saleDate=this.value||today()"></div>
  ${count?`<div class="cartbar"><div class="sm"><b>${n(total)} ج</b><span>${ent.map(([id,q])=>esc(prod(id).name)+' × '+q).join('، ')}</span></div><button class="btn s" onclick="cart={};render()">إلغاء</button><button class="btn sun" onclick="confirmSale()">تأكيد البيع</button></div>`:''}`;
}
function cartAdd(pid,d){cart[pid]=Math.max(0,(cart[pid]||0)+d);if(!cart[pid])delete cart[pid];render()}
function confirmSale(){
  let k=0;
  Object.entries(cart).forEach(([pid,q])=>{const p=prod(pid);if(p){recordSale(p,q,saleDate||today());k+=q}});
  cart={};save();render();toast(`تم تسجيل ${k} قطعة`);
}
function delSale(id){
  const s=S.sales.find(x=>x.id==id);if(!s||!confirm('حذف العملية وإرجاع الكميات للمخزون؟'))return;
  s.uses.forEach(u=>{const it=item(u.iid);if(it)it.stock+=u.q});
  S.sales=S.sales.filter(x=>x.id!=id);save();render();toast('تم الحذف');
}

/* ===== المنتجات ===== */
function vMenu(){
  if(!S.items.length)return emptyCard('ضيف الخامات الأول','المنتج بيتعمل من خامات، فلازم تضيفها الأول.','ضيف خامة','openItem()');
  return `<div class="bar"><h2>المنتجات</h2><button class="btn" onclick="openProduct()">+ منتج جديد</button></div>
  ${S.products.map(p=>{const c=costOf(p),pr=p.price-c;return `<div class="card"><div class="ph"><span class="em">${esc(p.emoji||'☕')}</span><div class="fx"><b>${esc(p.name)}</b><div class="chips">${p.recipe.map(r=>`<span>${esc(item(r.iid)?.name||'؟')} ${n(r.q)} ${esc(item(r.iid)?.unit||'')}</span>`).join('')}</div></div><span class="pr">${n(p.price)} ج</span></div>
  <div class="stats"><span>التكلفة <b>${n(c)}</b></span><span>الربح <b class="${pr>=0?'ok':'bad'}">${n(pr)}</b></span><span>الهامش <b>${p.price?n(pr/p.price*100,0):0}%</b></span></div>
  <div class="acts"><button class="btn s sm" onclick="openProduct('${p.id}')">تعديل</button><button class="btn s sm bad" onclick="delProduct('${p.id}')">حذف</button></div></div>`}).join('')||emptyCard('لسه مفيش منتجات','اعمل أول منتج وحدد الخامات اللي بتدخل في الكوب الواحد.','منتج جديد','openProduct()')}`;
}
function lineHtml(iid,q){
  const it=item(iid)||S.items[0];
  return `<div class="rl"><select onchange="lineUnit(this);prodPrev()">${itemOpts(it.id)}</select><div class="qwrap"><input type="number" inputmode="decimal" min="0" step="any" value="${q??''}" oninput="prodPrev()" aria-label="الكمية"><span class="u">${esc(it.unit)}</span></div><button class="ic" title="احسبها" onclick="calc(this)">🧮</button><button class="x" aria-label="حذف المكوّن" onclick="this.parentNode.remove();prodPrev()">✕</button></div>`;
}
function lineUnit(sel){sel.parentNode.querySelector('.u').textContent=sel.selectedOptions[0].dataset.u}
function addLine(iid,q){$('#rls').insertAdjacentHTML('beforeend',lineHtml(iid,q))}
function calc(btn){
  const row=btn.parentNode,u=row.querySelector('select').selectedOptions[0].dataset.u;
  if(u!='جرام'&&u!='مللي')return alert('الحاسبة للجرام والمللي بس. للقطع اكتب العدد مباشرة.');
  const c=+prompt(`الـ${u=='جرام'?'كيلو':'لتر'} الواحد بيعمل كام كوب؟`);
  if(c>0){row.querySelector('input').value=+(1000/c).toFixed(2);prodPrev()}
}
function prodPrev(){
  const rows=[...document.querySelectorAll('#rls .rl')];let c=0,miss=false;
  rows.forEach(r=>{const it=item(r.querySelector('select').value),q=+r.querySelector('input').value||0;if(it){c+=q*it.avg;if(q>0&&!it.avg)miss=true}});
  const p=+val('pp')||0;
  $('#ppv').textContent=(c>0||p>0)?`التكلفة ${n(c)} ج • الربح ${n(p-c)} ج${p?` (${n((p-c)/p*100,0)}%)`:''}${miss?' — فيه خامة لسه ماسجلتلهاش شراء، فتكلفتها صفر':''}`:'';
}
function openProduct(id){
  if(!S.items.length)return toast('ضيف خامة الأول');
  const p=id?prod(id):null;
  openModal(`<h3>${p?'تعديل المنتج':'منتج جديد'}</h3>
  <div class="g2" style="grid-template-columns:1fr 80px"><div><label style="margin-top:0">الاسم</label><input id="pn" value="${p?esc(p.name):''}" placeholder="قهوة تركي"></div><div><label style="margin-top:0">أيقونة</label><input id="pe" maxlength="2" value="${p?esc(p.emoji||'☕'):'☕'}" style="text-align:center"></div></div>
  <label>سعر البيع (ج)</label><input id="pp" type="number" inputmode="decimal" min="0" step="any" value="${p?p.price:''}" oninput="prodPrev()">
  <label style="margin-top:16px">الوصفة: اللي بيدخل في وحدة واحدة من المنتج</label><div id="rls"></div>
  <button class="btn s sm" onclick="addLine()">+ مكوّن</button>
  <div id="ppv" class="hint"></div>
  <button class="btn wide" onclick="saveProduct('${id||''}')">حفظ المنتج</button>`);
  (p?p.recipe:[{}]).forEach(r=>addLine(r.iid,r.q));prodPrev();
}
function saveProduct(id){
  const name=val('pn').trim(),price=+val('pp'),emoji=val('pe').trim()||'☕';
  const recipe=[...document.querySelectorAll('#rls .rl')].map(r=>({iid:r.querySelector('select').value,q:+r.querySelector('input').value})).filter(r=>r.q>0);
  if(!name)return toast('اكتب اسم المنتج');
  if(!(price>0))return toast('اكتب سعر البيع');
  if(!recipe.length)return toast('ضيف مكوّن واحد على الأقل بكمية');
  if(id)Object.assign(prod(id),{name,price,emoji,recipe});else S.products.push({id:uid(),name,price,emoji,recipe});
  save();closeModal();render();toast('تم حفظ المنتج');
}
function delProduct(id){if(confirm('حذف المنتج؟ المبيعات القديمة هتفضل في التقارير.')){S.products=S.products.filter(p=>p.id!=id);delete cart[id];save();render()}}

/* ===== المخزون ===== */
function vStock(){
  const val_=S.items.reduce((a,i)=>a+Math.max(i.stock,0)*i.avg,0);
  const pur=[...S.purchases].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
  return `<div class="bar"><h2>المخزون</h2><div class="acts" style="margin:0"><button class="btn s" onclick="openItem()">+ خامة</button><button class="btn" onclick="openBuy()">+ شراء</button></div></div>
  ${S.items.length?`<p class="mu" style="margin:0 0 10px">قيمة المخزون الحالي: <b style="color:var(--tx)">${n(val_)} ج</b></p>`:''}
  ${S.items.map(i=>`<div class="card"><div class="ih"><b>${esc(i.name)}</b><span class="st ${i.stock<=0?'bad':''}">${n(i.stock,2)} <small>${esc(i.unit)}</small></span></div>
  <div class="mu">متوسط التكلفة ${n(i.avg,3)} ج لكل ${esc(i.unit)} — قيمة ${n(Math.max(i.stock,0)*i.avg)} ج</div>
  <div class="acts"><button class="btn sm" onclick="openBuy('${i.id}')">شراء</button><button class="btn s sm" onclick="adjust('${i.id}')">جرد / هالك</button><button class="btn s sm" onclick="renameItem('${i.id}')">تعديل الاسم</button><button class="btn s sm bad" onclick="delItem('${i.id}')">حذف</button></div></div>`).join('')||emptyCard('لسه مفيش خامات','ابدأ بإضافة الخامات اللي بتشتريها: بن، سكر، لبن، أكواب...','ضيف خامة','openItem()')}
  ${pur.length?`<div class="card"><h3>آخر المشتريات</h3>${pur.map(p=>`<div class="row"><div class="fx"><b>${esc(item(p.iid)?.name||'؟')}</b> — ${n(p.q)} ${esc(item(p.iid)?.unit||'')}<div class="mu">${p.date}</div></div><b>${n(p.total)} ج</b><button class="x" aria-label="حذف" onclick="delPurchase('${p.id}')">✕</button></div>`).join('')}</div>`:''}`;
}
function openItem(){
  openModal(`<h3>خامة جديدة</h3><label style="margin-top:0">الاسم</label><input id="in" placeholder="بن تركي"><label>نوعها</label><select id="ik">${Object.entries(KINDS).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}</select>
  <p class="mu">بنخزّن الخامة بوحدة صغيرة (جرام/مللي/قطعة) عشان الوصفات تبقى أسهل. وقت الشراء تقدر تكتب بالكيلو أو اللتر.</p><button class="btn wide" onclick="saveItem()">إضافة الخامة</button>`);
}
function saveItem(){
  const name=val('in').trim();if(!name)return toast('اكتب اسم الخامة');
  S.items.push({id:uid(),name,unit:KINDS[val('ik')].unit,stock:0,avg:0});save();closeModal();render();toast('تمت إضافة الخامة');
}
function renameItem(id){const it=item(id),v=prompt('الاسم الجديد',it.name);if(v&&v.trim()){it.name=v.trim();save();render()}}
function delItem(id){
  if(S.products.some(p=>p.recipe.some(r=>r.iid==id))||S.sales.some(x=>x.uses.some(u=>u.iid==id)))return alert('الخامة مستخدمة في وصفة منتج أو في مبيعات سابقة، مينفعش تتحذف.');
  if(!confirm('حذف الخامة وكل مشترياتها المسجلة؟'))return;
  S.items=S.items.filter(i=>i.id!=id);S.purchases=S.purchases.filter(p=>p.iid!=id);S.waste=S.waste.filter(w=>w.iid!=id);save();render();
}
function adjust(id){
  const it=item(id),v=prompt(`الكمية الفعلية الموجودة دلوقتي من "${it.name}" بالـ${it.unit}؟\n(المسجل في السيستم: ${n(it.stock,2)})`);
  if(v===null||v.trim()===''||isNaN(+v))return;
  const diff=+v-it.stock;
  if(diff<0)S.waste.push({id:uid(),date:today(),iid:id,q:-diff,c:-diff*it.avg});
  it.stock=+v;save();render();toast(diff<0?'اتسجل الفرق كهالك':'تم تعديل الكمية');
}
function applyBuy(it,q,t,d){const old=Math.max(it.stock,0);it.avg=(old*it.avg+t)/(old+q);it.stock+=q;S.purchases.push({id:uid(),date:d,iid:it.id,q,total:t})}
function delPurchase(id){
  const p=S.purchases.find(x=>x.id==id),it=item(p.iid);if(!p||!confirm('حذف عملية الشراء دي؟ هتتخصم كميتها من المخزون.'))return;
  if(it){const before=it.stock,after=before-p.q;if(after>0&&before>0){const a=(before*it.avg-p.total)/after;if(a>0)it.avg=a}it.stock=after}
  S.purchases=S.purchases.filter(x=>x.id!=id);save();render();
}
const buyOpts=it=>[...buyUnits(it),['عبوة',0]];
function openBuy(iid){
  if(!S.items.length)return toast('ضيف خامة الأول');
  openModal(`<h3>تسجيل شراء</h3><label style="margin-top:0">الخامة</label><select id="bi" onchange="fillBuy()">${itemOpts(iid)}</select>
  <div class="g2"><div><label>الكمية</label><input id="bq" type="number" inputmode="decimal" min="0" step="any" oninput="buyPrev()"></div><div><label>الوحدة</label><select id="bu" onchange="buyPrev()"></select></div></div>
  <div id="bpk" hidden><label id="bpl"></label><input id="bs" type="number" inputmode="decimal" min="0" step="any" oninput="buyPrev()"></div>
  <label>إجمالي اللي دفعته (ج)</label><input id="bt" type="number" inputmode="decimal" min="0" step="any" oninput="buyPrev()">
  <label>التاريخ</label><input id="bd" type="date" value="${today()}">
  <div id="bpv" class="hint"></div><button class="btn wide" onclick="doBuy()">حفظ الشراء</button>`);
  fillBuy();
}
function fillBuy(){const it=item(val('bi'));$('#bu').innerHTML=buyOpts(it).map((o,i)=>`<option value="${i}">${esc(o[0])}</option>`).join('');$('#bpl').textContent='كام '+it.unit+' في العبوة الواحدة؟';buyPrev()}
function buyCalc(){const it=item(val('bi')),o=buyOpts(it)[+val('bu')];$('#bpk').hidden=o[1]!==0;const f=o[1]||+val('bs')||0;return{it,base:(+val('bq')||0)*f,t:+val('bt')||0}}
function buyPrev(){const{it,base,t}=buyCalc();$('#bpv').textContent=base>0?'هيتضاف '+n(base)+' '+it.unit+(t>0?' — سعر الواحد '+n(t/base,3)+' ج':''):''}
function doBuy(){
  const{it,base,t}=buyCalc(),d=val('bd');
  if(!(base>0))return toast('اكتب الكمية');if(!(t>0))return toast('اكتب السعر اللي دفعته');if(!d)return toast('اختار التاريخ');
  applyBuy(it,base,t,d);save();closeModal();render();toast('تم تسجيل الشراء');
}

/* ===== التقرير ===== */
function repData(m){
  const ss=S.sales.filter(s=>s.date.startsWith(m)),pp=S.purchases.filter(p=>p.date.startsWith(m)),ww=S.waste.filter(w=>w.date.startsWith(m));
  const rev=ss.reduce((a,s)=>a+s.revenue,0),cogs=ss.reduce((a,s)=>a+s.cost,0),waste=ww.reduce((a,w)=>a+w.c,0),bought=pp.reduce((a,p)=>a+p.total,0);
  const cons={},pr={};
  ss.forEach(s=>{s.uses.forEach(u=>{const c=cons[u.iid]=cons[u.iid]||{q:0,c:0};c.q+=u.q;c.c+=u.c});
    const p=pr[s.name]=pr[s.name]||{q:0,r:0,c:0};p.q+=s.qty;p.r+=s.revenue;p.c+=s.cost});
  const profit=rev-cogs-waste;
  return{ss,rev,cogs,waste,bought,cons,pr,profit,margin:rev?profit/rev*100:0};
}
function shiftMonth(d){const[Y,M]=month.split('-').map(Number);month=ymd(new Date(Y,M-1+d,1)).slice(0,7);render()}
function vReport(){
  const R=repData(month),[Y,M]=month.split('-').map(Number),dim=new Date(Y,M,0).getDate();
  const label=new Date(Y,M-1,1).toLocaleDateString('ar-EG-u-nu-latn',{month:'long',year:'numeric'});
  const daily=Array(dim).fill(0);R.ss.forEach(s=>{daily[+s.date.slice(8,10)-1]+=s.revenue});
  const mx=Math.max(...daily,1);
  const cons=Object.entries(R.cons).sort((a,b)=>b[1].c-a[1].c),pr=Object.entries(R.pr).sort((a,b)=>b[1].r-a[1].r);
  return `<div class="mnav"><button class="btn s sm" onclick="shiftMonth(-1)">‹ السابق</button><h2>${label}</h2><button class="btn s sm" onclick="shiftMonth(1)">التالي ›</button></div>
  <div class="kpis"><div class="main"><small>صافي الربح</small><span class="big">${n(R.profit)} ج</span><small>هامش ${n(R.margin,0)}% من الإيراد</small></div>
  <div><small>إجمالي الإيراد</small><span class="big">${n(R.rev)}</span></div>
  <div><small>تكلفة الخامات المستهلكة</small><span class="big">${n(R.cogs)}</span></div>
  <div><small>هالك وجرد</small><span class="big">${n(R.waste)}</span></div>
  <div><small>مشتريات الشهر (مدفوع)</small><span class="big">${n(R.bought)}</span></div></div>
  <div class="card"><h3>مبيعات كل يوم</h3><div class="chart">${daily.map((v,i)=>`<div class="b" title="يوم ${i+1}: ${n(v)} ج"><i style="height:${v/mx*100}%"></i><span>${i+1}</span></div>`).join('')}</div></div>
  <div class="card"><h3>المستهلك من الخامات</h3><div class="tw"><table><tr><th>الخامة</th><th class="n">الكمية</th><th class="n">التكلفة</th></tr>
  ${cons.map(([id,v])=>`<tr><td>${esc(item(id)?.name||'؟')}</td><td class="n">${n(v.q,1)} ${esc(item(id)?.unit||'')}</td><td class="n">${n(v.c)} ج</td></tr>`).join('')||'<tr><td colspan="3" class="mu">مفيش مبيعات في الشهر ده</td></tr>'}</table></div></div>
  <div class="card"><h3>المبيعات حسب المنتج</h3><div class="tw"><table><tr><th>المنتج</th><th class="n">الكمية</th><th class="n">الإيراد</th><th class="n">الربح</th></tr>
  ${pr.map(([k,v])=>`<tr><td>${esc(k)}</td><td class="n">${v.q}</td><td class="n">${n(v.r)} ج</td><td class="n ${v.r-v.c>=0?'ok':'bad'}">${n(v.r-v.c)} ج</td></tr>`).join('')||'<tr><td colspan="4" class="mu">مفيش مبيعات في الشهر ده</td></tr>'}</table></div></div>
  <button class="btn s wide" onclick="exportCSV()">تصدير تقرير الشهر (Excel / CSV)</button>`;
}
function exportCSV(){
  const R=repData(month),rows=[['مبيعات الشهر'],['التاريخ','المنتج','الكمية','الإيراد','التكلفة','الربح']];
  [...R.ss].sort((a,b)=>a.date.localeCompare(b.date)).forEach(s=>rows.push([s.date,s.name,s.qty,s.revenue,s.cost.toFixed(2),(s.revenue-s.cost).toFixed(2)]));
  rows.push([],['استهلاك الخامات'],['الخامة','الكمية','الوحدة','التكلفة']);
  Object.entries(R.cons).forEach(([id,v])=>rows.push([item(id)?.name||'؟',+v.q.toFixed(2),item(id)?.unit||'',v.c.toFixed(2)]));
  rows.push([],['الملخص'],['الإيراد',R.rev],['تكلفة الخامات',R.cogs.toFixed(2)],['الهالك',R.waste.toFixed(2)],['صافي الربح',R.profit.toFixed(2)],['مشتريات الشهر',R.bought]);
  const csv=rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\r\n');
  download('cafe-report-'+month+'.csv','\ufeff'+csv,'text/csv');
}

/* ===== الإعدادات والنسخ الاحتياطي ===== */
function openSettings(){
  openModal(`<h3>الإعدادات</h3><div class="acts" style="flex-direction:column;align-items:stretch">
  <button class="btn s" onclick="exportData()">تصدير نسخة احتياطية (JSON)</button>
  <div><label style="margin-top:0">استيراد نسخة احتياطية (بتستبدل البيانات الحالية)</label><input type="file" accept=".json" onchange="importData(this.files[0])"></div>
  <button class="btn s" onclick="loadDemo()">تحميل بيانات تجريبية</button>
  <button class="btn s bad" onclick="resetAll()">مسح كل البيانات</button></div>
  <p class="mu">البيانات محفوظة في المتصفح على الجهاز ده بس. اعمل نسخة احتياطية كل فترة.</p>`);
}
function exportData(){download('cafe-backup-'+today()+'.json',JSON.stringify(S,null,1),'application/json')}
function importData(f){
  if(!f)return;const r=new FileReader();
  r.onload=()=>{try{const d=JSON.parse(r.result);if(!['items','products','purchases','sales'].every(k=>Array.isArray(d[k])))throw 0;
    if(!confirm('هيتم استبدال كل البيانات الحالية. متأكد؟'))return;
    S=Object.assign({waste:[]},d);save();closeModal();render();toast('تم الاستيراد')}catch(e){alert('الملف غير صالح')}};
  r.readAsText(f);
}
function resetAll(){
  if(!confirm('هيتم مسح كل البيانات (خامات ومنتجات ومبيعات). متأكد؟'))return;
  S={items:[],products:[],purchases:[],sales:[],waste:[]};cart={};save();closeModal();render();toast('تم المسح');
}
function loadDemo(){
  if(S.items.length&&!confirm('هيتم استبدال البيانات الحالية ببيانات تجريبية. متأكد؟'))return;
  S={items:[],products:[],purchases:[],sales:[],waste:[]};cart={};
  const mk=(name,u)=>{const it={id:uid(),name,unit:KINDS[u].unit,stock:0,avg:0};S.items.push(it);return it};
  const bun=mk('بن تركي','g'),sug=mk('سكر','g'),mlk=mk('لبن','ml'),nes=mk('نسكافيه','g'),cup=mk('كوب ورق','pc');
  const d0=ymd(new Date(Date.now()-7*864e5));
  [[bun,10000,4000],[sug,20000,1000],[mlk,20000,800],[nes,1000,900],[cup,500,250]].forEach(([it,q,t])=>applyBuy(it,q,t,d0));
  const p1={id:uid(),name:'قهوة تركي',emoji:'☕',price:30,recipe:[{iid:bun.id,q:10},{iid:sug.id,q:8},{iid:cup.id,q:1}]};
  const p2={id:uid(),name:'نسكافيه بلبن',emoji:'🥛',price:40,recipe:[{iid:nes.id,q:2},{iid:mlk.id,q:150},{iid:sug.id,q:8},{iid:cup.id,q:1}]};
  S.products.push(p1,p2);
  for(let i=6;i>=0;i--){const d=ymd(new Date(Date.now()-i*864e5));recordSale(p1,20+(i*7)%15,d);recordSale(p2,10+(i*5)%12,d)}
  save();closeModal();render();toast('تم تحميل البيانات التجريبية');
}
render();
