const BG=['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const GIVE={'O-':BG,'O+':['O+','A+','B+','AB+'],'A-':['A-','A+','AB-','AB+'],'A+':['A+','AB+'],'B-':['B-','B+','AB-','AB+'],'B+':['B+','AB+'],'AB-':['AB-','AB+'],'AB+':['AB+']};
const mem={};
const db={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):(mem[k]??d)}catch(e){return mem[k]??d}},
set(k,v){mem[k]=v;try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(t){const e=$('#toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',2800)}
const state={user:null,reqs:[],donors:[],contacts:[]};
const user=()=>state.user;
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const mapUser=u=>({name:(u.user_metadata&&u.user_metadata.name)||u.email,email:u.email});
async function api(path,opt={}){
 const m=opt.method||'GET',b=opt.body||{};
 const ok=r=>{if(r.error)throw new Error(['23514','23502','22P02'].includes(r.error.code)?'Please check your details and try again':r.error.message);return r.data};
 let x;
 if((x=path.match(/^\/contacts\/(\d+)$/))&&m==='DELETE'){ok(await sb.from('contacts').delete().eq('id',+x[1]));return{ok:true}}
 if((x=path.match(/^\/camps\/(\d+)\/book$/))){ok(await sb.from('bookings').insert({camp_id:+x[1]}));return{ok:true}}
 switch(m+' '+path){
  case 'GET /requests':return ok(await sb.from('requests').select('*').order('id',{ascending:false}).limit(200));
  case 'POST /requests':ok(await sb.from('requests').insert(b));return{ok:true};
  case 'GET /donors':return ok(await sb.from('donor_groups').select('bg'));
  case 'POST /donors':ok(await sb.from('donors').insert(b));return{ok:true};
  case 'GET /donor-list':return ok(await sb.from('donor_directory').select('*').order('id',{ascending:false}).limit(500));
  case 'GET /hospitals':return ok(await sb.from('hospitals').select('*, blood_stock(bg,units,updated_at)').order('name'));
  case 'POST /hospitals':ok(await sb.from('hospitals').insert(b));return{ok:true};
  case 'GET /camps':return ok(await sb.from('camps').select('*').order('id'));
  case 'GET /contacts':return ok(await sb.from('contacts').select('id,name,phone').order('id'));
  case 'POST /contacts':ok(await sb.from('contacts').insert(b));return{ok:true};
  case 'POST /auth/register':{const d=ok(await sb.auth.signUp({email:b.email,password:b.password,options:{data:{name:b.name}}}));if(!d.session)throw new Error('Account created. Please confirm your email, then log in.');return{user:mapUser(d.user)}}
  case 'POST /auth/login':{const d=ok(await sb.auth.signInWithPassword({email:b.email,password:b.password}));return{user:mapUser(d.user)}}
  case 'GET /me':{const d=ok(await sb.auth.getUser());return{user:mapUser(d.user)}}
 }
 throw new Error('Unknown request')}
async function loadPublic(){try{[state.reqs,state.donors,state.dlist,state.hosps]=await Promise.all([api('/requests'),api('/donors'),api('/donor-list').catch(()=>[]),api('/hospitals').catch(()=>[])])}catch(e){toast('Cannot reach the server')}render()}
async function loadCamps(){try{CAMPS=(await api('/camps')).map(c=>[c.name,c.date_text,c.time_text,c.venue,c.district,c.id])}catch(e){}renderCamps()}
async function loadUser(){const{data:{session}}=await sb.auth.getSession();if(!session)return;try{state.user=(await api('/me')).user;state.contacts=await api('/contacts')}catch(e){}render()}

/* selects & table */
document.querySelectorAll('select[name=bg]').forEach(s=>BG.forEach(b=>s.add(new Option(b,b))));
$('#compat').innerHTML=BG.map(b=>`<tr><td><span class="tag">${b}</span></td><td>${GIVE[b].map(x=>`<span class="tag">${x}</span>`).join('')}</td><td>${BG.filter(x=>GIVE[x].includes(b)).map(x=>`<span class="tag">${x}</span>`).join('')}</td></tr>`).join('');

/* eligibility questions */
const QS=[['Do you have a fever, cold, cough or any infection today?','no'],['Have you had a tattoo, piercing or acupuncture in the last 6 months?','no'],['Have you had surgery or a blood transfusion in the last 6 months?','no'],['Are you taking antibiotics or other prescribed medicine for an infection?','no'],['Have you ever tested positive for HIV, hepatitis B or C, or syphilis?','no'],['Do you have heart disease, epilepsy, cancer, or diabetes on insulin?','no'],['Are you pregnant, or breastfeeding a baby under 6 months? (skip if not applicable)','no'],['Have you had malaria or dengue in the last 3 months?','no'],['Have you had alcohol in the last 24 hours?','no'],['Have you had a vaccination in the last 4 weeks?','no']];
$('#qs').innerHTML=QS.map((q,i)=>`<div class="q"><span>${q[0]}</span><select name="q${i}"><option>No</option><option>Yes</option></select></div>`).join('');

/* donor form */
$('#donorForm').onsubmit=async e=>{
 e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const why=[];
 if(f.age<18||f.age>65)why.push('Donors must be 18 to 65 years old.');
 if(f.weight<50)why.push('Minimum weight is 50 kg.');
 if(f.hb&&f.hb<12.5)why.push('Hemoglobin should be at least 12.5 g/dL.');
 if(f.last){const d=(Date.now()-new Date(f.last))/864e5,gap=f.gender==='Female'?120:90;if(d<gap)why.push(`Wait at least ${gap} days between donations (${Math.ceil(gap-d)} more days).`)}
 QS.forEach((q,i)=>{if(f['q'+i]==='Yes')why.push('Health answer needs review: '+q[0])});
 const r=$('#donorResult');
 if(why.length){r.className='result no';r.innerHTML='<b>Not eligible right now.</b><ul>'+why.map(w=>`<li>${esc(w)}</li>`).join('')+'</ul>Thank you for checking. You can still help by sharing requests.';return}
 try{await api('/donors',{method:'POST',body:{name:f.name,phone:f.phone,city:f.city,bg:f.bg,age:+f.age,weight:+f.weight,gender:f.gender,consent:true}})}catch(err){toast(err.message);return}
 r.className='result ok';r.innerHTML=`<b>You're eligible, ${esc(f.name)}.</b> You are registered as a ${esc(f.bg)} donor in ${esc(f.city)}.`;
 e.target.reset();loadPublic();
};

/* blood components */
const COMPS=[
['Whole blood','Red cells, plasma and platelets together, as donated.','Major trauma, heavy bleeding during surgery.','Stored up to 35 days.','Donor gap: 90 days (men), 120 days (women).'],
['Red blood cells (RBC)','Red cells only. They carry oxygen around the body.','Anaemia, thalassemia, surgery, childbirth bleeding.','Stored up to 42 days.','Match ABO and Rh group with the patient.'],
['Platelets','Tiny cells that help blood clot.','Dengue, chemotherapy, leukaemia, bone marrow failure.','Stored only 5 days, so they are always in demand.','Apheresis donors can give as often as every 2 weeks.'],
['Plasma (FFP)','The yellow liquid part of blood, rich in clotting proteins.','Burns, liver disease, severe bleeding, clotting disorders.','Frozen for up to 1 year.','Rules are reversed: AB is the universal plasma donor, O can only receive O.'],
['White blood cells (WBC / granulocytes)','Infection-fighting cells, collected by apheresis.','Severe infections in patients with very low white cell counts.','Must be used within 24 hours.','Rare. Needs ABO and Rh matching and a special machine.']];
const CNAMES=COMPS.map(c=>c[0]);
CNAMES.forEach(n=>$('#compSel').add(new Option(n,n)));
$('#compSel').onchange=e=>{if(e.target.value.startsWith('White blood'))$('#urgSel').value='Critical'};
$('#compInfo').innerHTML=COMPS.map(c=>`<div class="card"><h3>${c[0]}</h3><p>${c[1]}</p><p><b>Used for:</b> ${c[2]}</p><p><b>Shelf life:</b> ${c[3]}</p><p class="muted">${c[4]}</p></div>`).join('')+'<p class="muted" style="grid-column:1/-1;margin:0">This is general information. The blood bank doctor decides which component a patient receives.</p>';
const abo=b=>b.replace(/[+-]/,'');
function compat(dbg,rbg,c){
 if(c==='Platelets')return true;
 if(c==='Plasma (FFP)'){const d=abo(dbg),x=abo(rbg);return ['A','B'].every(k=>!(x.includes(k)&&!d.includes(k)))}
 return GIVE[dbg].includes(rbg)}

/* requests */
$('#reqForm').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));f.units=+f.units;try{await api('/requests',{method:'POST',body:f});e.target.reset();await loadPublic();toast('Request posted')}catch(err){toast(err.message)}};
function render(){
 const reqs=state.reqs,donors=state.donors;
 $('#sDon').textContent=donors.length;$('#sReq').textContent=reqs.length;
 $('#reqList').innerHTML=reqs.length?reqs.map((r,i)=>{const c=r.comp||'Whole blood',m=donors.filter(d=>compat(d.bg,r.bg,c)).length;return `<div class="item"><div><span class="tag">${esc(r.bg)}</span> <b>${esc(r.patient)}</b> · ${esc(r.units)} unit(s)<br><span class="muted">Attender: ${esc(r.attender||'—')}</span><br><span class="cmp">${esc(c)}</span><br><span class="muted">${esc(r.hospital)} · ${m} compatible donor(s)</span><br><span class="urg ${esc(r.urgency)}">${esc(r.urgency)}</span></div><a class="btn sm" href="tel:${esc(r.phone)}">Call</a></div>`}).join(''):'<p class="muted">No open requests. Post one using the form.</p>';
 const u=user();
 $('#authArea').innerHTML=u?`<span class="muted" style="font-size:.9rem">Hi, ${esc(u.name)}</span> <button class="btn ghost sm" id="logout">Log out</button>`:'<button class="btn sm" id="loginBtn">Log in</button>';
 const lb=$('#loginBtn');if(lb)lb.onclick=()=>openAuth('login');
 const lo=$('#logout');if(lo)lo.onclick=async()=>{await sb.auth.signOut();state.user=null;state.contacts=[];render();toast('Logged out')};
 const rank={Critical:0,High:1,Moderate:2,Normal:3},fd=$('#fDist').value,fb=$('#fBg').value,fu=$('#fUrg').value,sorted=reqs.filter(q=>(!fd||q.district===fd)&&(!fb||q.bg===fb)&&(!fu||q.urgency===fu)).sort((a,b)=>(rank[a.urgency]??4)-(rank[b.urgency]??4));
 $('#needsBody').innerHTML=sorted.length?sorted.map(q=>`<tr><td><span class="urg ${esc(q.urgency)}">${esc(q.urgency)}</span></td><td><b>${esc(q.patient)}</b><br><span class="muted">Attender: ${esc(q.attender||'—')}</span></td><td><span class="tag">${esc(q.bg)}</span></td><td>${esc(q.comp||'Whole blood')}</td><td>${esc(q.units)}</td><td>${esc(q.hospital)}</td><td>${esc(q.district||'—')}</td><td><a class="btn sm" href="tel:${esc(q.phone)}">Call</a></td></tr>`).join(''):'<tr><td colspan="8" class="muted">No requests match these filters.</td></tr>';
 renderDonors();renderHospitals();
}
window.delC=async i=>{try{await api('/contacts/'+state.contacts[i].id,{method:'DELETE'});state.contacts=await api('/contacts');fillSos()}catch(e){toast(e.message)}};
$('#contactForm').onsubmit=async e=>{e.preventDefault();if(!user()){$('#sosDlg').close();openAuth('login');toast('Log in to save contacts');return}const f=Object.fromEntries(new FormData(e.target));try{await api('/contacts',{method:'POST',body:{name:f.cname,phone:f.cphone}});state.contacts=await api('/contacts');e.target.reset();fillSos();toast('Contact added')}catch(err){toast(err.message)}};

/* camps */
const DISTS=['Anantapur','Anakapalli','Alluri Sitharama Raju','Annamayya','Bapatla','Chittoor','East Godavari','Eluru','Guntur','Kakinada','Konaseema','Krishna','Kurnool','Nandyal','NTR','Palnadu','Parvathipuram Manyam','Prakasam','SPSR Nellore','Sri Sathya Sai','Srikakulam','Tirupati','Visakhapatnam','Vizianagaram','West Godavari','YSR Kadapa'];
let CAMPS=[];
['All districts',...DISTS].forEach((d,i)=>$('#distSel').add(new Option(d,i?d:'')));
$('#distSel').onchange=()=>renderCamps();
DISTS.forEach(d=>$('#reqDist').add(new Option(d,d)));
[['fDist','All districts',DISTS],['fBg','All blood groups',BG],['fUrg','All urgency levels',['Critical','High','Moderate','Normal']]].forEach(([id,all,list])=>{const e=$('#'+id);e.add(new Option(all,''));list.forEach(x=>e.add(new Option(x,x)));e.onchange=render});
function renderCamps(){const b=db.get('booked',[]),d=$('#distSel').value;
 const rows=CAMPS.map(c=>[c,c[5]]).filter(x=>!d||x[0][4]===d);
 $('#campList').innerHTML=rows.length?rows.map(([c,i])=>`<div class="item"><div><b>${c[0]}</b> <span class="cmp">${c[4]}</span><br><span class="muted">${c[1]} · ${c[2]}<br>${c[3]}</span></div><span style="display:flex;flex-direction:column;gap:8px;min-width:132px;text-align:center"><a class="btn sm" href="${mapsDir(c[3]+', '+c[4]+', Andhra Pradesh')}" target="_blank" rel="noopener">📍 Get directions</a><button class="btn ghost sm" onclick="book(${i})">${b.includes(i)?'Reserved ✓':'Reserve slot'}</button></span></div>`).join(''):'<p class="muted">No camps listed in this district yet. Try another district or check back soon.</p>'}
window.book=async i=>{const b=db.get('booked',[]);if(b.includes(i))return;try{await api('/camps/'+i+'/book',{method:'POST'});b.push(i);db.set('booked',b);renderCamps();toast('Slot reserved')}catch(e){toast(e.message)}};

/* auth */
let mode='login';
window.openAuth=m=>{mode=m;$('#authTitle').textContent=m==='login'?'Log in':'Create account';$('#authBtn').textContent=m==='login'?'Log in':'Create account';$('#nmWrap').style.display=m==='login'?'none':'block';$('#aName').required=m!=='login';$('#authSwap').textContent=m==='login'?'New here? Create an account':'Have an account? Log in';$('#authDlg').showModal()};
$('#authSwap').onclick=()=>openAuth(mode==='login'?'signup':'login');
$('#authClose').onclick=()=>$('#authDlg').close();
$('#authForm').onsubmit=async e=>{e.preventDefault();const body={email:$('#aEmail').value.trim().toLowerCase(),password:$('#aPass').value};if(mode==='signup')body.name=$('#aName').value.trim();
 try{const d=await api('/auth/'+(mode==='signup'?'register':'login'),{method:'POST',body});state.user=d.user;state.contacts=await api('/contacts');$('#authDlg').close();e.target.reset();render();toast(mode==='signup'?'Account created':'Logged in')}catch(err){toast(err.message)}};

/* SOS */
function fillSos(){const u=user(),cs=u?state.contacts:[];
 $('#sosContacts').innerHTML=cs.length?cs.map((c,i)=>`<div class="item"><span><b>${esc(c.name)}</b><br><span class="muted">${esc(c.phone)}</span></span><span><a class="btn sm" href="tel:${esc(c.phone)}">Call</a> <a class="btn ghost sm" href="sms:${esc(c.phone)}?body=${encodeURIComponent('Emergency! I need help. Please call me now.')}">SMS</a> <button class="btn ghost sm" onclick="delC(${i})" aria-label="Remove ${esc(c.name)}">✕</button></span></div>`).join(''):`<p class="muted">${u?'No contacts saved yet. Add one below.':'Log in to save emergency contacts.'}</p>`}
$('#sos').onclick=()=>{fillSos();$('#sosDlg').showModal()};
$('#sosClose').onclick=()=>$('#sosDlg').close();

/* BloodBot (English, Telugu, Hindi) */
let lang='en';
const KB=[
[/universal|o negative|o-|యూనివర్సల్|సార్వత్రిక|यूनिवर्सल|सार्वभौमिक/,{
en:'O negative (O−) is the universal red-cell donor. AB positive (AB+) is the universal recipient.',
te:'O నెగటివ్ (O−) అన్ని గ్రూపులకు ఎర్ర రక్తకణాలు ఇవ్వగల సార్వత్రిక దాత. AB పాజిటివ్ (AB+) అన్ని గ్రూపుల నుండి స్వీకరించగల సార్వత్రిక గ్రహీత.',
hi:'O नेगेटिव (O−) सभी को लाल रक्त कोशिकाएँ दे सकता है, इसलिए यह सार्वभौमिक दाता है। AB पॉज़िटिव (AB+) सभी से रक्त ले सकता है, इसलिए यह सार्वभौमिक प्राप्तकर्ता है।'}],
[/eligib|who can donate|criteria|requirement|అర్హ|पात्र|योग्य/,{
en:'You should be 18–65 years old, weigh at least 50 kg, have hemoglobin of 12.5 g/dL or more, and be in good health. Use the Become a donor page to check yourself.',
te:'మీ వయస్సు 18–65 సంవత్సరాలు ఉండాలి, బరువు కనీసం 50 కిలోలు, హిమోగ్లోబిన్ 12.5 g/dL లేదా ఎక్కువ, మరియు ఆరోగ్యంగా ఉండాలి. దాత పేజీలోని ఫారమ్‌తో మీరు చెక్ చేసుకోవచ్చు.',
hi:'आपकी उम्र 18 से 65 वर्ष, वज़न कम से कम 50 किलो, हीमोग्लोबिन 12.5 g/dL या अधिक और सेहत अच्छी होनी चाहिए। दाता पेज के फ़ॉर्म से खुद जाँच करें।'}],
[/how often|gap|again|interval|wait|ఎన్నిసార్లు|ఎంత తరచు|తరచుగా|कितनी बार|कब तक|अंतराल/,{
en:'Men can donate whole blood every 90 days and women every 120 days.',
te:'పురుషులు ప్రతి 90 రోజులకు, మహిళలు ప్రతి 120 రోజులకు ఒకసారి పూర్తి రక్తదానం చేయవచ్చు.',
hi:'पुरुष हर 90 दिन में और महिलाएँ हर 120 दिन में एक बार पूरा रक्त दान कर सकती हैं।'}],
[/before|prepare|eat|food|drink|ముందు|సిద్ధ|पहले|तैयारी|खाना/,{
en:'Before donating: sleep well, eat a healthy meal, drink plenty of water, and avoid alcohol for 24 hours.',
te:'రక్తదానానికి ముందు: బాగా నిద్రపోండి, ఆరోగ్యకరమైన భోజనం చేయండి, ఎక్కువ నీళ్లు తాగండి, 24 గంటల ముందు నుండి మద్యం మానండి.',
hi:'रक्तदान से पहले: अच्छी नींद लें, पौष्टिक भोजन करें, खूब पानी पिएँ और 24 घंटे पहले से शराब न पिएँ।'}],
[/after|recover|side effect|dizzy|తర్వాత|దుష్ప్రభావ|बाद|साइड|चक्कर/,{
en:'After donating: rest 10–15 minutes, drink fluids, avoid heavy exercise for the day, and keep the bandage on for a few hours.',
te:'రక్తదానం తర్వాత: 10–15 నిమిషాలు విశ్రాంతి తీసుకోండి, ద్రవాలు తాగండి, ఆ రోజు భారీ వ్యాయామం చేయవద్దు, కట్టును కొన్ని గంటలు ఉంచండి.',
hi:'रक्तदान के बाद: 10–15 मिनट आराम करें, तरल पदार्थ पिएँ, उस दिन भारी व्यायाम न करें और पट्टी कुछ घंटे लगी रहने दें।'}],
[/hurt|pain|safe|risk|నొప్పి|సురక్షి|दर्द|सुरक्षित/,{
en:'Donation is safe. A new sterile needle is used every time. You feel a brief pinch, and the collection takes about 10 minutes.',
te:'రక్తదానం సురక్షితం. ప్రతిసారి కొత్త స్టెరైల్ సూది వాడతారు. చిన్న చురుక్కుమనే భావన మాత్రమే ఉంటుంది, సుమారు 10 నిమిషాలు పడుతుంది.',
hi:'रक्तदान सुरक्षित है। हर बार नई जीवाणुरहित सुई इस्तेमाल होती है। बस हल्की चुभन होती है और लगभग 10 मिनट लगते हैं।'}],
[/tattoo|piercing|టాటూ|పచ్చబొట్టు|टैटू|पियर्सिंग|पियरसिंग/,{
en:'Wait 6 months after a tattoo or piercing before donating.',
te:'టాటూ లేదా పియర్సింగ్ చేయించుకున్న తర్వాత రక్తదానం చేయడానికి 6 నెలలు వేచి ఉండండి.',
hi:'टैटू या पियर्सिंग के बाद रक्तदान के लिए 6 महीने इंतज़ार करें।'}],
[/diabet|sugar|డయాబెటిస్|షుగర్|మధుమేహ|मधुमेह|डायबिटीज|शुगर/,{
en:'Diabetes controlled with diet or tablets may be acceptable. Insulin-dependent diabetes is not. The blood bank doctor decides on the day.',
te:'ఆహారం లేదా మాత్రలతో నియంత్రణలో ఉన్న షుగర్ ఉంటే అంగీకరించవచ్చు. ఇన్సులిన్ తీసుకునే వారు ఇవ్వలేరు. చివరి నిర్ణయం బ్లడ్ బ్యాంక్ డాక్టర్‌దే.',
hi:'आहार या गोलियों से नियंत्रित मधुमेह में दान संभव हो सकता है। इंसुलिन लेने वाले दान नहीं कर सकते। अंतिम निर्णय ब्लड बैंक के डॉक्टर का होता है।'}],
[/how much|quantity|volume|\bml\b|ఎంత రక్తం|कितना रक्त|कितना खून/,{
en:'A standard donation is about 350–450 ml, roughly 8% of your blood. Your body replaces the fluid in a day and red cells within weeks.',
te:'ఒక రక్తదానంలో సుమారు 350–450 ml తీసుకుంటారు, అంటే మీ రక్తంలో సుమారు 8%. ద్రవం ఒక రోజులో, ఎర్ర కణాలు కొన్ని వారాల్లో తిరిగి తయారవుతాయి.',
hi:'एक बार में लगभग 350–450 ml रक्त लिया जाता है, यानी आपके रक्त का करीब 8%। तरल एक दिन में और लाल कोशिकाएँ कुछ हफ्तों में वापस बन जाती हैं।'}],
[/compat|give to|receive|match|అనుకూల|संगत/,{
en:'See the table at the bottom of the Home page. Type a group like "A+" or "O-" and I will tell you.',
te:'హోమ్ పేజీ చివరన ఉన్న పట్టిక చూడండి. "A+" లేదా "O−" వంటి గ్రూప్ పేరు రాస్తే వివరాలు చెబుతాను.',
hi:'होम पेज के अंत में दी गई तालिका देखें। "A+" या "O−" जैसा ग्रुप लिखें, मैं बता दूँगा।'}],
[/sos|emergency|urgent|అత్యవసర|ఎమర్జెన్సీ|आपात|इमरजेंसी/,{
en:'For an emergency, tap the red SOS button (bottom-left). It shows 112, ambulance 108 and your saved contacts.',
te:'అత్యవసరంలో ఎడమ కింద ఉన్న ఎరుపు SOS బటన్ నొక్కండి. అక్కడ 112, అంబులెన్స్ 108 మరియు మీ సేవ్ చేసిన కాంటాక్ట్‌లు కనిపిస్తాయి.',
hi:'आपात स्थिति में नीचे बाईं ओर लाल SOS बटन दबाएँ। वहाँ 112, एम्बुलेंस 108 और आपके सेव किए संपर्क दिखेंगे।'}],
[/covid|vaccin|టీకా|వ్యాక్సిన్|टीका|वैक्सीन/,{
en:'Wait about 4 weeks after most vaccinations. If you had no fever after a COVID vaccine, many banks accept donors after 14 days. Ask your blood bank.',
te:'చాలా టీకాల తర్వాత సుమారు 4 వారాలు ఆగాలి. కోవిడ్ టీకా తర్వాత జ్వరం లేకపోతే చాలా బ్లడ్ బ్యాంకులు 14 రోజుల తర్వాత అంగీకరిస్తాయి. మీ బ్లడ్ బ్యాంక్‌ను అడగండి.',
hi:'ज़्यादातर टीकों के बाद लगभग 4 सप्ताह रुकें। कोविड टीके के बाद बुखार न आया हो तो कई ब्लड बैंक 14 दिन बाद स्वीकार करते हैं। अपने ब्लड बैंक से पूछें।'}],
[/hello|hi\b|hey|నమస్కారం|హలో|నమస్తే|नमस्ते|हैलो/,{
en:'Hello! Ask me about eligibility, preparation, recovery or blood groups.',
te:'నమస్కారం! అర్హత, సిద్ధత, కోలుకోవడం లేదా రక్త గ్రూపుల గురించి అడగండి.',
hi:'नमस्ते! पात्रता, तैयारी, रिकवरी या ब्लड ग्रुप के बारे में पूछें।'}]];
const T={
ph:{en:'Type your question…',te:'మీ ప్రశ్న రాయండి…',hi:'अपना सवाल लिखें…'},
send:{en:'Send',te:'పంపండి',hi:'भेजें'},
hi:{en:"Hi, I'm BloodBot, your blood donation assistant. What would you like to know?",te:'నమస్కారం, నేను BloodBot, మీ రక్తదాన సహాయకుడిని. మీరు ఏమి తెలుసుకోవాలనుకుంటున్నారు?',hi:'नमस्ते, मैं BloodBot हूँ, आपका रक्तदान सहायक। आप क्या जानना चाहते हैं?'},
fb:{en:'I\'m not sure about that one. Try asking about eligibility, how often to donate, preparing, recovery, or a blood group like "Who can receive A+?". For medical concerns, please talk to your blood bank doctor.',te:'క్షమించండి, ఇది నాకు తెలియదు. అర్హత, ఎంత తరచుగా దానం చేయాలి, సిద్ధత, కోలుకోవడం లేదా "O+ ఎవరికి ఇవ్వగలదు?" వంటి ప్రశ్నలు అడగండి. వైద్య సందేహాలకు బ్లడ్ బ్యాంక్ డాక్టర్‌ను సంప్రదించండి.',hi:'माफ़ कीजिए, मुझे इसका उत्तर नहीं पता। पात्रता, कितनी बार दान करें, तैयारी, रिकवरी या "O+ किसे दे सकता है?" जैसे सवाल पूछें। चिकित्सा संबंधी चिंता हो तो ब्लड बैंक के डॉक्टर से मिलें।'},
chips:{en:['Am I eligible?','How to prepare?','Who can receive O+?','Side effects?'],te:['నేను అర్హుడినా?','ఎలా సిద్ధం కావాలి?','O+ ఎవరి నుండి తీసుకోవచ్చు?','దుష్ప్రభావాలు?'],hi:['क्या मैं पात्र हूँ?','तैयारी कैसे करें?','O+ किससे रक्त ले सकता है?','साइड इफ़ेक्ट?']},
both:{en:(b,x,y)=>`${b} can donate to: ${x}. It can receive from: ${y}.`,te:(b,x,y)=>`${b} గ్రూప్ వీరికి ఇవ్వగలదు: ${x}. వీరి నుండి తీసుకోగలదు: ${y}.`,hi:(b,x,y)=>`${b} ग्रुप इन्हें दे सकता है: ${x}। इनसे ले सकता है: ${y}।`},
recv:{en:(b,y)=>`${b} can receive from: ${y}.`,te:(b,y)=>`${b} గ్రూప్ వీరి నుండి తీసుకోగలదు: ${y}.`,hi:(b,y)=>`${b} ग्रुप इनसे ले सकता है: ${y}।`}};
function add(t,me){const d=document.createElement('div');d.className='m'+(me?' me':'');d.textContent=t;$('#msgs').appendChild(d);$('#msgs').scrollTop=1e5}
function answer(q){q=q.toLowerCase();
 const g=q.match(/\b(ab|a|b|o)\s*(\+|-|−|positive|negative|pos|neg|పాజిటివ్|నెగటివ్|पॉज़िटिव|पॉजिटिव|नेगेटिव)/);
 if(g){const b=g[1].toUpperCase()+(/\+|pos|పాజిటివ్|पॉज़िटिव|पॉजिटिव/.test(g[2])?'+':'-'),y=BG.filter(x=>GIVE[x].includes(b)).join(', ');
  return /receive|get|take|from|స్వీకర|తీసుకో|प्राप्त|ले सकत|लेना/.test(q)?T.recv[lang](b,y):T.both[lang](b,GIVE[b].join(', '),y)}
 for(const [r,a] of KB)if(r.test(q))return a[lang];
 return T.fb[lang]}
function drawChips(){$('#chips').innerHTML=T.chips[lang].map(t=>`<button type="button">${t}</button>`).join('')}
function say(q){add(q,1);setTimeout(()=>add(answer(q)),350)}
$('#chatForm').onsubmit=e=>{e.preventDefault();const q=$('#chatIn').value.trim();if(!q)return;$('#chatIn').value='';say(q)};
$('#chips').onclick=e=>{if(e.target.tagName==='BUTTON')say(e.target.textContent)};
$('#lang').onchange=e=>{lang=e.target.value;$('#chatIn').placeholder=T.ph[lang];$('#chatBtn').textContent=T.send[lang];drawChips();add(T.hi[lang])};
add(T.hi.en);drawChips();

/* donors list & hospitals */
const ago=t=>{const m=Math.max(1,Math.round((Date.now()-new Date(t))/6e4));return m<60?m+' min ago':m<1440?Math.round(m/60)+' hours ago':Math.round(m/1440)+' days ago'};
const mapsDir=q=>'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination='+encodeURIComponent(q);
[['dBg','All blood groups',BG],['hBg','Any blood group',BG],['hDist','All districts',DISTS],['hType','All types',['Government hospital','Private hospital','Blood bank']]].forEach(([id,all,l])=>{const e=$('#'+id);e.add(new Option(all,''));l.forEach(x=>e.add(new Option(x,x)));e.onchange=()=>{renderDonors();renderHospitals()}});
$('#dQ').oninput=()=>renderDonors();
DISTS.forEach(d=>$('#hrDist').add(new Option(d,d)));
function renderDonors(){const all=state.dlist||[],q=$('#dQ').value.trim().toLowerCase(),b=$('#dBg').value,u=user();
 const rows=all.filter(d=>(!b||d.bg===b)&&(!q||(d.city+' '+d.name).toLowerCase().includes(q)));
 $('#dCount').textContent=`Showing ${rows.length} of ${all.length} donors`;
 $('#dBody').innerHTML=rows.length?rows.map(d=>`<tr><td><b>${esc(d.name)}</b></td><td><span class="tag">${esc(d.bg)}</span></td><td>${esc(d.city)}</td><td>${u&&d.phone?`<a class="btn sm" href="tel:${esc(d.phone)}">Call</a>`:`<button class="btn ghost sm" onclick="openAuth('login')">Log in to call</button>`}</td></tr>`).join(''):'<tr><td colspan="4" class="muted">No donors match. Try another blood group or city.</td></tr>'}
function renderHospitals(){const all=state.hosps||[],d=$('#hDist').value,b=$('#hBg').value,t=$('#hType').value;
 const units=h=>Object.fromEntries((h.blood_stock||[]).map(s=>[s.bg,s.units]));
 const rows=all.filter(h=>(!d||h.district===d)&&(!t||h.type===t)&&(!b||(units(h)[b]||0)>0));
 $('#hList').innerHTML=rows.length?rows.map(h=>{const u=units(h),tot=BG.reduce((s,g)=>s+(u[g]||0),0),up=(h.blood_stock||[]).map(s=>s.updated_at).sort().pop();
  return `<div class="card hosp"><div class="hh"><div><h3>${esc(h.name)}</h3><span class="cmp">${esc(h.type)}</span> <span class="cmp">${esc(h.district)}</span>${h.open_24x7?' <span class="cmp open">Open 24×7</span>':''}</div><span class="vbadge">✔ Verified</span></div>
<p class="muted">${esc(h.address)} · Reg. no. ${esc(h.reg_no)}</p>
<div class="stock">${BG.map(g=>{const n=u[g]||0;return `<div class="st ${n===0?'out':n<5?'low':'ok'}${g===b?' sel':''}"><b>${g}</b><span>${n}</span></div>`}).join('')}</div>
<p class="muted" style="margin:.7em 0">${tot} units in stock${up?' · updated '+ago(up):''}</p>
<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn sm" href="tel:${esc(h.phone)}">Call</a><a class="btn ghost sm" href="${mapsDir(h.name+', '+h.address+', '+h.district+', Andhra Pradesh')}" target="_blank" rel="noopener">Directions</a></div></div>`}).join(''):'<p class="muted">No verified hospitals match these filters.</p>'}
$('#hospForm').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{await api('/hospitals',{method:'POST',body:{name:f.name,type:f.type,district:f.district,address:f.address,phone:f.phone,reg_no:f.reg_no,open_24x7:!!f.open}});e.target.reset();toast('Submitted. It will appear after verification.')}catch(err){toast(err.message)}};

function route(){const h=location.hash.slice(1)||'home',el=document.getElementById(h),pg=el&&el.tagName==='SECTION'?h:'home';
 document.querySelectorAll('section').forEach(x=>x.classList.toggle('active',x.id===pg||(pg==='home'&&['needs','components','features','bgchart'].includes(x.id))));
 document.querySelectorAll('nav .links a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+pg));
 window.scrollTo(0,0)}
addEventListener('hashchange',route);
render();renderCamps();route();loadPublic();loadCamps();loadUser();
