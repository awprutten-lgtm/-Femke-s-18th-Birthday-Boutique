(() => {
  'use strict';

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const uid = () => 'g_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
  const wishId = () => 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7);
  const escapeHtml = (str='') => String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  const DEFAULT_SETTINGS = {
    partyDate: '2026-09-04',
    birthday: '2026-09-10',
    adminCode: '1818',
    budgets: [
      { id:'petite', label:'Pretty Little Pick', sub:'Keeping it cute • under €20' },
      { id:'glow', label:'Golden Glow', sub:'A little extra sparkle • €20–€40' },
      { id:'princess', label:'Princess Pick', sub:'Main character gifting • €40–€70' },
      { id:'fairytale', label:'Fairytale Splurge', sub:'Go big for the birthday girl • €70+' }
    ]
  };

  const SAMPLE_GIFTS = [
    {id:'sample_1',name:'Voorbeeld: gouden armband',price:24.99,budget:'glow',category:'Jewellery',link:'',image:'',note:'Vervang dit voorbeeld in het boutique beheer.',mostWanted:true,createdAt:1},
    {id:'sample_2',name:'Voorbeeld: girly beauty set',price:18.50,budget:'petite',category:'Beauty',link:'',image:'',note:'Je kunt onbeperkt cadeaus toevoegen.',mostWanted:false,createdAt:2},
    {id:'sample_3',name:'Voorbeeld: party bag',price:49.95,budget:'princess',category:'Fashion',link:'',image:'',note:'Naam, prijs, link en afbeelding zijn allemaal aanpasbaar.',mostWanted:false,createdAt:3},
    {id:'sample_4',name:'Voorbeeld: droomcadeau',price:85,budget:'fairytale',category:'Girly Stuff',link:'',image:'',note:'Markeer Femke’s favorieten als Most Wanted.',mostWanted:true,createdAt:4}
  ];

  const state = {
    settings: clone(DEFAULT_SETTINGS),
    gifts: clone(SAMPLE_GIFTS),
    reservations: {},
    wishes: {},
    quiz: { step:0, answers:{} },
    isAdmin:false,
    remote:false
  };

  const dbURL = ((window.BOUTIQUE_FIREBASE || {}).databaseURL || '').replace(/\/$/, '');
  const LS = {settings:'femkeBoutiqueSettings',gifts:'femkeBoutiqueGifts',reservations:'femkeBoutiqueReservations',wishes:'femkeBoutiqueWishes'};

  function toast(msg){ const el=$('#toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'),2800); }
  function showDialog(id){ const d=$('#'+id); if(d && !d.open) d.showModal(); }
  function closeDialog(id){ const d=$('#'+id); if(d?.open) d.close(); }
  $$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeDialog(b.dataset.close)));
  $$('dialog').forEach(d=>d.addEventListener('click',e=>{ if(e.target===d) d.close(); }));

  async function remoteGet(path){ const r=await fetch(`${dbURL}/${path}.json`); if(!r.ok) throw new Error('Firebase read failed'); return r.json(); }
  async function remotePut(path,value){ const r=await fetch(`${dbURL}/${path}.json`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)}); if(!r.ok) throw new Error('Firebase write failed'); return r.json(); }
  async function remotePatch(path,value){ const r=await fetch(`${dbURL}/${path}.json`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)}); if(!r.ok) throw new Error('Firebase patch failed'); return r.json(); }
  async function remoteDelete(path){ const r=await fetch(`${dbURL}/${path}.json`,{method:'DELETE'}); if(!r.ok) throw new Error('Firebase delete failed'); }

  function localLoad(){
    try{ state.settings={...clone(DEFAULT_SETTINGS),...(JSON.parse(localStorage.getItem(LS.settings))||{})}; }catch{}
    try{ state.gifts=JSON.parse(localStorage.getItem(LS.gifts))||clone(SAMPLE_GIFTS); }catch{}
    try{ state.reservations=JSON.parse(localStorage.getItem(LS.reservations))||{}; }catch{}
    try{ state.wishes=JSON.parse(localStorage.getItem(LS.wishes))||{}; }catch{}
  }
  function localSave(key,val){ localStorage.setItem(LS[key],JSON.stringify(val)); }

  async function syncInitial(){
    localLoad();
    if(dbURL){
      try{
        const [settings,gifts,reservations,wishes]=await Promise.all([remoteGet('settings'),remoteGet('gifts'),remoteGet('reservations'),remoteGet('wishes')]);
        if(settings) state.settings={...clone(DEFAULT_SETTINGS),...settings}; else await remotePut('settings',state.settings);
        if(gifts) state.gifts=Object.values(gifts); else await remotePut('gifts',Object.fromEntries(state.gifts.map(g=>[g.id,g])));
        state.reservations=reservations||{}; state.wishes=wishes||{}; state.remote=true;
      }catch(err){ console.warn(err); toast('Firebase niet bereikbaar — lokale modus actief.'); }
    }
    renderAll();
    if(state.remote) startPolling();
  }

  let pollTimer;
  function startPolling(){
    clearInterval(pollTimer);
    pollTimer=setInterval(async()=>{
      try{
        const [gifts,reservations,wishes,settings]=await Promise.all([remoteGet('gifts'),remoteGet('reservations'),remoteGet('wishes'),remoteGet('settings')]);
        if(gifts) state.gifts=Object.values(gifts); state.reservations=reservations||{}; state.wishes=wishes||{}; if(settings) state.settings={...state.settings,...settings};
        renderWishlist(); renderStats(); renderWishes(); updateCountdown();
        if(state.isAdmin){ renderAdminGifts(); renderAdminWishes(); }
      }catch{}
    },7000);
  }

  async function saveSettings(){
    if(state.remote) await remotePut('settings',state.settings); else localSave('settings',state.settings);
  }
  async function saveGift(gift){
    const ix=state.gifts.findIndex(g=>g.id===gift.id); if(ix>=0) state.gifts[ix]=gift; else state.gifts.push(gift);
    if(state.remote) await remotePut('gifts/'+gift.id,gift); else localSave('gifts',state.gifts);
  }
  async function deleteGift(id){
    state.gifts=state.gifts.filter(g=>g.id!==id); delete state.reservations[id];
    if(state.remote){ await Promise.all([remoteDelete('gifts/'+id),remoteDelete('reservations/'+id)]); } else { localSave('gifts',state.gifts); localSave('reservations',state.reservations); }
  }
  async function saveReservation(id,data){ state.reservations[id]=data; if(state.remote) await remotePut('reservations/'+id,data); else localSave('reservations',state.reservations); }
  async function deleteReservation(id){ delete state.reservations[id]; if(state.remote) await remoteDelete('reservations/'+id); else localSave('reservations',state.reservations); }
  async function saveWish(w){ state.wishes[w.id]=w; if(state.remote) await remotePut('wishes/'+w.id,w); else localSave('wishes',state.wishes); }
  async function deleteWish(id){ delete state.wishes[id]; if(state.remote) await remoteDelete('wishes/'+id); else localSave('wishes',state.wishes); }

  function navigate(name){
    $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
    window.scrollTo({top:0,behavior:'smooth'});
    if(name==='match') renderQuiz(); if(name==='wishlist') renderWishlist(); if(name==='wishes') renderWishes();
  }
  $$('[data-nav]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.nav)));

  function updateCountdown(){
    const target=new Date(state.settings.partyDate+'T12:00:00'); const now=new Date(); const diff=target-now;
    const el=$('#countdownText');
    if(diff>0){ const d=Math.ceil(diff/86400000); el.textContent=`Nog ${d} ${d===1?'dag':'dagen'} tot de boutique party ✨`; }
    else { const bd=new Date(state.settings.birthday+'T00:00:00'); el.textContent=now<bd?'De celebration was magical ♡':'Femke is officially 18! ♕'; }
  }

  const relationshipOptions=[
    {value:4,label:'Besties forever',sub:'Je weet waarschijnlijk al wat ze wil.'},
    {value:3,label:'Really close',sub:'Jij kent de birthday girl goed.'},
    {value:2,label:'Friends',sub:'Cute, gezellig en helemaal prima.'},
    {value:1,label:'We know each other',sub:'De boutique helpt je wel even.'}
  ];
  const annoyOptions=[
    {value:4,label:'😇 Angel behaviour',sub:'Geen klachten. Impressive.'},
    {value:3,label:'🙂 Pretty good',sub:'Een paar kleine incidenten.'},
    {value:2,label:'🙄 Questionable',sub:'Femke heeft dingen moeten verdragen.'},
    {value:1,label:'💀 You’re lucky you’re invited',sub:'We gaan het er niet over hebben.'}
  ];

  function renderQuiz(){
    $('#matchResults').classList.add('hidden'); $('#quizCard').classList.remove('hidden');
    const step=state.quiz.step; $('#progressBar').style.width=((step+1)/3*100)+'%';
    let title='',opts=[];
    if(step===0){title='How would you describe us?';opts=relationshipOptions;}
    if(step===1){title='How much did you annoy Femke this year?';opts=annoyOptions;}
    if(step===2){title='Choose your boutique budget';opts=state.settings.budgets.map((b,i)=>({value:b.id,label:b.label,sub:b.sub,index:i}));}
    $('#quizContent').innerHTML=`<div class="quiz-question"><span class="step">QUESTION ${step+1} OF 3</span><h3>${escapeHtml(title)}</h3><div class="option-grid">${opts.map(o=>`<button class="quiz-option" data-val="${escapeHtml(o.value)}"><span>${escapeHtml(o.label)}</span><small>${escapeHtml(o.sub)}</small></button>`).join('')}</div></div>`;
    $$('#quizContent .quiz-option').forEach(btn=>btn.addEventListener('click',()=>chooseQuiz(btn.dataset.val)));
  }
  function chooseQuiz(v){
    if(state.quiz.step===0) state.quiz.answers.relationship=Number(v);
    if(state.quiz.step===1) state.quiz.answers.annoy=Number(v);
    if(state.quiz.step===2){state.quiz.answers.budget=v; return showResults();}
    state.quiz.step++; renderQuiz();
  }
  function showResults(){
    $('#quizCard').classList.add('hidden'); $('#matchResults').classList.remove('hidden');
    const a=state.quiz.answers; const score=Math.min(99,82+(a.relationship||1)*3+(a.annoy||1)*1.2|0); $('#matchScore').textContent=score+'%';
    const budget=state.settings.budgets.find(b=>b.id===a.budget) || state.settings.budgets[0];
    $('#resultTitle').textContent=budget.label;
    $('#resultCopy').textContent=a.annoy===1?'Ondanks je gedrag heeft de boutique toch iets moois voor je gevonden. ♡':'De boutique heeft jouw antwoorden gecombineerd met Femke’s wishlist. Très chic.';
    const pool=state.gifts.filter(g=>g.budget===a.budget && !state.reservations[g.id]);
    const picks=[...pool].sort((x,y)=>(y.mostWanted?1:0)-(x.mostWanted?1:0)||Math.random()-.5).slice(0,4);
    $('#resultGiftGrid').innerHTML=picks.length?picks.map(productCard).join(''):`<div class="empty-state" style="grid-column:1/-1"><span>🎀</span><h3>Deze collectie is nog leeg</h3><p>Femke kan in het beheer cadeaus aan dit budget toevoegen.</p></div>`;
    bindProductActions($('#resultGiftGrid')); confetti();
  }
  $('#restartQuiz').addEventListener('click',()=>{state.quiz={step:0,answers:{}};renderQuiz();});

  function productCard(g){
    const r=state.reservations[g.id]; const img=g.image?`<img src="${escapeHtml(g.image)}" alt="${escapeHtml(g.name)}" loading="lazy">`:`<span class="placeholder-product">🎀</span>`;
    return `<article class="product-card" data-id="${g.id}">${g.mostWanted?'<span class="badge most">♕ Most Wanted</span>':''}${r?'<span class="badge reserved">Reserved</span>':''}<div class="product-image">${img}</div><div class="product-info"><span class="category-pill">${escapeHtml(g.category||'Boutique Pick')}</span><div class="product-meta"><h3>${escapeHtml(g.name)}</h3><span class="price">${formatPrice(g.price)}</span></div><p class="product-note">${escapeHtml(g.note||'A pretty little birthday pick ♡')}</p><div class="product-actions">${g.link?`<a class="btn ghost" href="${escapeHtml(g.link)}" target="_blank" rel="noopener">Bekijk</a>`:''}${r?`<button class="btn" data-unreserve="${g.id}">Afgestreept door ${escapeHtml(r.name||'iemand')}</button>`:`<button class="btn primary" data-reserve="${g.id}">Reserveer</button>`}</div></div></article>`;
  }
  function formatPrice(p){ const n=Number(p); return Number.isFinite(n)&&n>0?new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(n):'♡'; }

  function renderWishlist(){
    const search=$('#giftSearch').value.trim().toLowerCase(); const cat=$('#categoryFilter').value; const budget=$('#budgetFilter').value; const sort=$('#sortSelect').value;
    let list=state.gifts.filter(g=>(!search||(g.name+' '+(g.note||'')+' '+(g.category||'')).toLowerCase().includes(search))&&(cat==='all'||g.category===cat)&&(budget==='all'||g.budget===budget));
    if(sort==='price-asc') list.sort((a,b)=>(Number(a.price)||0)-(Number(b.price)||0));
    if(sort==='price-desc') list.sort((a,b)=>(Number(b.price)||0)-(Number(a.price)||0));
    if(sort==='mostwanted') list.sort((a,b)=>(b.mostWanted?1:0)-(a.mostWanted?1:0));
    if(sort==='available') list.sort((a,b)=>(state.reservations[a.id]?1:0)-(state.reservations[b.id]?1:0));
    if(sort==='featured') list.sort((a,b)=>(b.mostWanted?1:0)-(a.mostWanted?1:0)||(a.createdAt||0)-(b.createdAt||0));
    $('#wishlistGrid').innerHTML=list.map(productCard).join(''); $('#emptyWishlist').classList.toggle('hidden',list.length>0); bindProductActions($('#wishlistGrid')); renderStats();
  }
  function renderFilters(){
    const cats=[...new Set(state.gifts.map(g=>g.category).filter(Boolean))].sort(); const cf=$('#categoryFilter'); const current=cf.value; cf.innerHTML='<option value="all">Alle categorieën</option>'+cats.map(c=>`<option>${escapeHtml(c)}</option>`).join(''); if([...cf.options].some(o=>o.value===current)) cf.value=current;
    const bf=$('#budgetFilter'); const cur=bf.value; bf.innerHTML='<option value="all">Alle budgetten</option>'+state.settings.budgets.map(b=>`<option value="${b.id}">${escapeHtml(b.label)}</option>`).join(''); if([...bf.options].some(o=>o.value===cur))bf.value=cur;
  }
  function renderStats(){ const total=state.gifts.length,res=state.gifts.filter(g=>state.reservations[g.id]).length,mw=state.gifts.filter(g=>g.mostWanted).length; $('#availableCount').textContent=total-res;$('#reservedCount').textContent=res;$('#mostWantedCount').textContent=mw; }
  ['giftSearch','categoryFilter','budgetFilter','sortSelect'].forEach(id=>$('#'+id).addEventListener(id==='giftSearch'?'input':'change',renderWishlist));

  function bindProductActions(root){
    $$('[data-reserve]',root).forEach(b=>b.addEventListener('click',()=>openReserve(b.dataset.reserve)));
    $$('[data-unreserve]',root).forEach(b=>b.addEventListener('click',()=>attemptUnreserve(b.dataset.unreserve)));
  }
  function openReserve(id){ const g=state.gifts.find(g=>g.id===id); if(!g)return; $('#reserveGiftId').value=id;$('#reserveGiftName').textContent=g.name;$('#reserveName').value='';$('#reserveEmail').value='';showDialog('reserveDialog'); }
  async function hash(text){ const data=new TextEncoder().encode(text.trim().toLowerCase()); const digest=await crypto.subtle.digest('SHA-256',data); return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
  $('#reserveForm').addEventListener('submit',async e=>{
    e.preventDefault(); const id=$('#reserveGiftId').value; if(state.reservations[id]) return toast('Dit cadeau is nét al gereserveerd.');
    const name=$('#reserveName').value.trim(); const email=$('#reserveEmail').value.trim(); const data={name,reservedAt:Date.now(),token:email?await hash(email):''};
    try{await saveReservation(id,data);closeDialog('reserveDialog');renderWishlist();showResultsIfVisible();toast('Cadeau gereserveerd ♡');confetti();}catch{toast('Reserveren lukte niet. Probeer opnieuw.');}
  });
  async function attemptUnreserve(id){
    const r=state.reservations[id]; if(!r)return;
    if(state.isAdmin){ if(confirm(`Reservering van ${r.name} verwijderen?`)){await deleteReservation(id);renderWishlist();showResultsIfVisible();} return; }
    if(!r.token){toast('Alleen Femke kan deze reservering verwijderen.');return;}
    const email=prompt('Vul hetzelfde e-mailadres in waarmee je reserveerde:'); if(!email)return; if(await hash(email)!==r.token){toast('Dat e-mailadres klopt niet.');return;} await deleteReservation(id);renderWishlist();showResultsIfVisible();toast('Reservering verwijderd.');
  }
  function showResultsIfVisible(){ if(!$('#matchResults').classList.contains('hidden')) showResults(); }

  function surprise(){ const available=state.gifts.filter(g=>!state.reservations[g.id]); if(!available.length)return toast('Alles is al gereserveerd! ♡'); const g=available[Math.floor(Math.random()*available.length)]; $('#giftDialogBody').innerHTML=`<div class="modal-header"><span>🎁</span><div><p class="eyebrow">SURPRISE BOUTIQUE PICK</p><h3>${escapeHtml(g.name)}</h3></div></div><div class="product-image" style="border-radius:20px">${g.image?`<img src="${escapeHtml(g.image)}" alt="">`:'<span class="placeholder-product">🎀</span>'}</div><p>${escapeHtml(g.note||'De boutique koos deze speciaal voor jou.')}</p><div class="actions-row">${g.link?`<a class="btn ghost" href="${escapeHtml(g.link)}" target="_blank" rel="noopener">Bekijk cadeau</a>`:''}<button class="btn primary" id="surpriseReserve">Reserveer deze</button></div>`; showDialog('giftDialog'); setTimeout(()=>$('#surpriseReserve')?.addEventListener('click',()=>{closeDialog('giftDialog');openReserve(g.id)}),0); }
  $('#surpriseBtn').addEventListener('click',surprise);$('#surpriseHome').addEventListener('click',surprise);

  $('#wishForm').addEventListener('submit',async e=>{e.preventDefault(); const name=$('#wishName').value.trim(),message=$('#wishMessage').value.trim(); if(!name||!message)return; const w={id:wishId(),name,message,createdAt:Date.now()}; await saveWish(w);e.target.reset();renderWishes();toast('Birthday note verzonden 💌');});
  function renderWishes(){
    const arr=Object.values(state.wishes).sort((a,b)=>b.createdAt-a.createdAt); $('#wishWall').innerHTML=arr.length?arr.map((w,i)=>`<article class="wish-card" style="--rot:${[-1,1.2,-.4,.7][i%4]}deg"><strong>${escapeHtml(w.name)}</strong><p>${escapeHtml(w.message)}</p><small>${new Date(w.createdAt).toLocaleDateString('nl-NL')}</small></article>`).join(''):`<div class="empty-state"><span>💌</span><h3>Nog geen notes</h3><p>Be the first.</p></div>`;
  }

  function openAdminLogin(){ if(state.isAdmin)return showDialog('adminDialog');$('#adminCodeInput').value='';showDialog('adminLoginDialog'); }
  $('#adminShortcut').addEventListener('click',openAdminLogin);$('#footerAdmin').addEventListener('click',openAdminLogin);
  $('#adminLoginForm').addEventListener('submit',e=>{e.preventDefault();if($('#adminCodeInput').value===state.settings.adminCode){state.isAdmin=true;closeDialog('adminLoginDialog');renderAdmin();showDialog('adminDialog');toast('Welcome, boutique staff ♕');}else toast('Onjuiste beheercode.');});
  $$('.admin-tabs button').forEach(b=>b.addEventListener('click',()=>{ $$('.admin-tabs button').forEach(x=>x.classList.toggle('active',x===b)); $$('.admin-panel').forEach(p=>p.classList.toggle('active',p.id===`admin-${b.dataset.adminTab}`)); }));

  function renderAdmin(){
    $('#syncStatus').textContent=state.remote?'● Firebase live':'● lokaal'; $('#dbUrlPreview').textContent=dbURL||'Nog niet gekoppeld — vul firebase-config.js in.';
    $('#settingPartyDate').value=state.settings.partyDate;$('#settingBirthday').value=state.settings.birthday;$('#settingAdminCode').value=state.settings.adminCode;
    renderAdminGifts();renderBudgetEditor();renderAdminWishes();
  }
  function renderAdminGifts(){
    $('#adminGiftList').innerHTML=state.gifts.length?state.gifts.map(g=>`<div class="admin-row"><div class="admin-thumb">${g.image?`<img src="${escapeHtml(g.image)}" alt="">`:'🎀'}</div><div><h4>${g.mostWanted?'♕ ':''}${escapeHtml(g.name)}</h4><small>${formatPrice(g.price)} • ${escapeHtml((state.settings.budgets.find(b=>b.id===g.budget)||{}).label||g.budget)} • ${escapeHtml(g.category||'')}</small>${g.link?`<small class="admin-link-preview">🔗 ${escapeHtml(g.link)}</small>`:''}</div><div class="row-actions"><button class="edit-gift-btn" data-editgift="${g.id}">✎ Bewerk cadeau</button><button data-deletegift="${g.id}" title="Verwijder cadeau">🗑</button>${state.reservations[g.id]?`<button data-clearres="${g.id}" title="Verwijder reservering">✓</button>`:''}</div></div>`).join(''):`<div class="empty-state"><span>🎀</span><p>Nog geen cadeaus.</p></div>`;
    $$('[data-editgift]').forEach(b=>b.addEventListener('click',()=>openGiftEditor(b.dataset.editgift))); $$('[data-deletegift]').forEach(b=>b.addEventListener('click',async()=>{if(confirm('Cadeau verwijderen?')){await deleteGift(b.dataset.deletegift);renderAll();renderAdminGifts();}})); $$('[data-clearres]').forEach(b=>b.addEventListener('click',async()=>{await deleteReservation(b.dataset.clearres);renderAll();renderAdminGifts();}));
  }
  $('#addGiftBtn').addEventListener('click',()=>openGiftEditor());
  function openGiftEditor(id=''){
    const adminWasOpen=$('#adminDialog').open;
    $('#editGiftDialog').dataset.returnAdmin=adminWasOpen?'1':'0';
    if(adminWasOpen) closeDialog('adminDialog');
    const g=state.gifts.find(g=>g.id===id)||{id:'',name:'',price:'',budget:state.settings.budgets[0].id,category:'',link:'',image:'',note:'',mostWanted:false};
    $('#editGiftHeading').textContent=id?'Cadeau bewerken':'Cadeau toevoegen';$('#editGiftId').value=g.id;$('#editGiftName').value=g.name;$('#editGiftPrice').value=g.price||'';$('#editGiftCategory').value=g.category||'';$('#editGiftLink').value=g.link||'';$('#editGiftNote').value=g.note||'';$('#editGiftImage').value=g.image&&g.image.startsWith('http')?g.image:'';$('#editGiftMostWanted').checked=!!g.mostWanted;$('#editGiftBudget').innerHTML=state.settings.budgets.map(b=>`<option value="${b.id}">${escapeHtml(b.label)}</option>`).join('');$('#editGiftBudget').value=g.budget;$('#editGiftFile').value='';$('#imagePreview').innerHTML=g.image?`<img src="${escapeHtml(g.image)}" alt="preview">`:'Afbeeldingspreview';$('#editGiftDialog').dataset.currentImage=g.image||'';showDialog('editGiftDialog');
  }
  $('#editGiftImage').addEventListener('input',()=>{const u=$('#editGiftImage').value.trim();if(u){$('#editGiftDialog').dataset.currentImage=u;$('#imagePreview').innerHTML=`<img src="${escapeHtml(u)}" alt="preview">`;}});
  $('#editGiftFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;const data=await compressImage(f);$('#editGiftDialog').dataset.currentImage=data;$('#imagePreview').innerHTML=`<img src="${data}" alt="preview">`;});
  function compressImage(file){return new Promise((resolve,reject)=>{const img=new Image(),r=new FileReader();r.onload=()=>img.src=r.result;r.onerror=reject;img.onload=()=>{const max=900,scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.78));};r.readAsDataURL(file);});}
  $('#giftEditForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const old=state.gifts.find(g=>g.id===$('#editGiftId').value);
    const g={
      id:old?.id||uid(),
      name:$('#editGiftName').value.trim(),
      price:Number($('#editGiftPrice').value)||0,
      budget:$('#editGiftBudget').value,
      category:$('#editGiftCategory').value.trim()||'Boutique Pick',
      link:$('#editGiftLink').value.trim(),
      note:$('#editGiftNote').value.trim(),
      image:$('#editGiftDialog').dataset.currentImage||'',
      mostWanted:$('#editGiftMostWanted').checked,
      createdAt:old?.createdAt||Date.now()
    };
    try{
      await saveGift(g);
      closeDialog('editGiftDialog');
      renderAll();
      renderAdminGifts();
      if($('#editGiftDialog').dataset.returnAdmin==='1'){ renderAdmin(); showDialog('adminDialog'); }
      toast('Cadeau opgeslagen ♡');
    }catch(err){
      console.error(err);
      toast('Opslaan lukte niet. Controleer Firebase of probeer opnieuw.');
    }
  });

  $('#editGiftDialog').addEventListener('close',()=>{
    if($('#editGiftDialog').dataset.returnAdmin==='1' && !$('#adminDialog').open){ renderAdmin(); showDialog('adminDialog'); }
    $('#editGiftDialog').dataset.returnAdmin='0';
  });

  function renderBudgetEditor(){ $('#budgetEditor').innerHTML=state.settings.budgets.map((b,i)=>`<div class="budget-row"><label>Naam ${i+1}<input data-budget-label="${i}" value="${escapeHtml(b.label)}"></label><label>Subtekst<input data-budget-sub="${i}" value="${escapeHtml(b.sub)}"></label></div>`).join(''); }
  $('#saveBudgetsBtn').addEventListener('click',async()=>{state.settings.budgets=state.settings.budgets.map((b,i)=>({...b,label:$(`[data-budget-label="${i}"]`).value.trim()||b.label,sub:$(`[data-budget-sub="${i}"]`).value.trim()||b.sub}));await saveSettings();renderAll();renderBudgetEditor();toast('Budgetten opgeslagen.');});
  $('#saveSettingsBtn').addEventListener('click',async()=>{state.settings.partyDate=$('#settingPartyDate').value||state.settings.partyDate;state.settings.birthday=$('#settingBirthday').value||state.settings.birthday;state.settings.adminCode=$('#settingAdminCode').value.trim()||state.settings.adminCode;await saveSettings();updateCountdown();toast('Instellingen opgeslagen.');});
  function renderAdminWishes(){const arr=Object.values(state.wishes).sort((a,b)=>b.createdAt-a.createdAt);$('#adminWishList').innerHTML=arr.length?arr.map(w=>`<div class="admin-row"><div class="admin-thumb">💌</div><div><h4>${escapeHtml(w.name)}</h4><small>${escapeHtml(w.message)}</small></div><div class="row-actions"><button data-delwish="${w.id}">🗑</button></div></div>`).join(''):'<p class="helper">Nog geen verjaardagswensen.</p>';$$('[data-delwish]').forEach(b=>b.addEventListener('click',async()=>{if(confirm('Wens verwijderen?')){await deleteWish(b.dataset.delwish);renderWishes();renderAdminWishes();}}));}

  function renderAll(){renderFilters();renderWishlist();renderStats();renderWishes();updateCountdown();if(state.quiz.step<3)renderQuiz();}

  function confetti(){
    const canvas=$('#confettiCanvas'),ctx=canvas.getContext('2d');canvas.width=innerWidth*devicePixelRatio;canvas.height=innerHeight*devicePixelRatio;ctx.scale(devicePixelRatio,devicePixelRatio);let pieces=Array.from({length:70},()=>({x:innerWidth/2+(Math.random()-.5)*200,y:innerHeight*.24,vx:(Math.random()-.5)*7,vy:Math.random()*-6-2,g:.18+Math.random()*.12,r:2+Math.random()*4,a:1,c:['#e59ab9','#bd8a35','#f6c7da','#fff'][Math.floor(Math.random()*4)]}));let t=0;function frame(){ctx.clearRect(0,0,innerWidth,innerHeight);pieces.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=p.g;p.a-=.009;ctx.globalAlpha=Math.max(0,p.a);ctx.fillStyle=p.c;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(t*.04+p.x);ctx.fillRect(-p.r,-p.r,p.r*2,p.r*.8);ctx.restore();});ctx.globalAlpha=1;t++;if(t<115)requestAnimationFrame(frame);else ctx.clearRect(0,0,innerWidth,innerHeight);}requestAnimationFrame(frame);
  }

  syncInitial();
})();
