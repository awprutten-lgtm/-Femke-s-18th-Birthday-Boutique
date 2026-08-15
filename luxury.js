(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Brand language polish without touching the core application state.
  function renameBrandLanguage(){
    $$('[data-nav="wishlist"]').forEach(el=>{ if(el.textContent.trim()==='Wishlist') el.textContent='The Collection'; });
    const title=$('#view-wishlist .section-head h2'); if(title) title.textContent='The Collection';
    const copy=$('#view-wishlist .section-head p:not(.eyebrow)'); if(copy) copy.textContent='A curated edit of Femke’s favorite things — browse it like your own private birthday boutique.';
    const wishBtn=$('[data-nav="wishes"]'); if(wishBtn && wishBtn.textContent.trim()==='Birthday Wishes') wishBtn.textContent='Birthday Notes';
    const footer=$('footer p'); if(footer) footer.innerHTML='Femke\'s Birthday Boutique · The Eighteenth Edition <span aria-hidden="true">✦</span>';
  }

  // Luxury entrance experience.
  function buildIntro(){
    if($('#boutiqueIntro')) return;
    const intro=document.createElement('div'); intro.id='boutiqueIntro'; intro.className='boutique-intro';
    intro.innerHTML=`<div class="intro-card">
      <span class="intro-spark s1">✦</span><span class="intro-spark s2">✧</span><span class="intro-spark s3">✦</span><span class="intro-spark s4">✧</span>
      <div class="intro-mark">F</div><div class="intro-kicker">THE EIGHTEENTH EDITION</div>
      <div class="intro-title">Femke's <em>Birthday Boutique</em></div>
      <p class="intro-copy">Pretty in pink, polished in gold and made for one very special eighteenth birthday.</p>
      <div class="intro-loading" id="introLoading">Preparing the boutique…</div>
      <button class="btn primary intro-enter" id="enterBoutique">Enter the Boutique ✦</button>
    </div>`;
    document.body.appendChild(intro);
    const lines=['Preparing the boutique…','Polishing the gold details…','Curating Femke’s collection…','Almost ready, gorgeous…'];
    let i=0; const timer=setInterval(()=>{const el=$('#introLoading'); if(el) el.textContent=lines[++i%lines.length];},950);
    $('#enterBoutique').addEventListener('click',()=>{clearInterval(timer);chime('open');intro.classList.add('is-leaving');setTimeout(()=>intro.remove(),900);sessionStorage.setItem('femkeBoutiqueEntered','1');});
    if(sessionStorage.getItem('femkeBoutiqueEntered')){ setTimeout(()=>$('#enterBoutique')?.click(),420); }
  }

  // Ambient floating sparkles/petals.
  function ambient(){
    if(reduced||$('.ambient-lux')) return;
    const wrap=document.createElement('div'); wrap.className='ambient-lux';
    const glyphs=['✦','✧','·','♡','✦','୨୧'];
    for(let i=0;i<18;i++){
      const s=document.createElement('span'); s.textContent=glyphs[i%glyphs.length]; if(i%4===3)s.className='petal';
      s.style.left=(3+Math.random()*94)+'%';s.style.top=(4+Math.random()*91)+'%';s.style.fontSize=(7+Math.random()*11)+'px';s.style.setProperty('--x',(-10+Math.random()*20)+'px');s.style.setProperty('--y',(-8+Math.random()*24)+'px');s.style.setProperty('--dur',(5+Math.random()*8)+'s');s.style.animationDelay=(-Math.random()*8)+'s';wrap.appendChild(s);
    }
    document.body.appendChild(wrap);
  }

  // Time-aware golden-hour variant that remains light.
  const hour=new Date().getHours(); if(hour>=19||hour<7) document.body.classList.add('evening-glow');

  // Optional soft interface chimes. Disabled by default.
  let soundOn=localStorage.getItem('femkeBoutiqueSound')==='on', audioCtx;
  function chime(kind='tap'){
    if(!soundOn) return;
    try{
      audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
      const now=audioCtx.currentTime, osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
      osc.type='sine'; osc.frequency.setValueAtTime(kind==='open'?659:kind==='success'?784:523,now); osc.frequency.exponentialRampToValueAtTime(kind==='open'?988:kind==='success'?1046:659,now+.12);
      gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.035,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+.28);osc.connect(gain);gain.connect(audioCtx.destination);osc.start(now);osc.stop(now+.3);
    }catch{}
  }
  function soundButton(){
    const top=$('.topbar'); if(!top||$('#soundToggle'))return; const b=document.createElement('button');b.id='soundToggle';b.className='icon-btn sound-toggle'+(soundOn?' active':'');b.title='Boutique sound';b.setAttribute('aria-label','Boutique geluid aan of uit');b.textContent=soundOn?'♪':'♩';
    b.addEventListener('click',()=>{soundOn=!soundOn;localStorage.setItem('femkeBoutiqueSound',soundOn?'on':'off');b.classList.toggle('active',soundOn);b.textContent=soundOn?'♪':'♩';if(soundOn)chime('success');});top.appendChild(b);
  }
  document.addEventListener('click',e=>{if(soundOn&&e.target.closest('button,a,.collection-chip'))chime('tap')},true);

  // Page transition on the existing navigation.
  document.addEventListener('click',e=>{if(e.target.closest('[data-nav]')){document.body.classList.add('page-changing');setTimeout(()=>document.body.classList.remove('page-changing'),300)}},true);

  // Collection chips generated from the existing category select.
  function buildCollectionRail(){
    const toolbar=$('#view-wishlist .toolbar'), select=$('#categoryFilter'); if(!toolbar||!select||$('#collectionRail'))return;
    const rail=document.createElement('div'); rail.id='collectionRail';rail.className='collection-rail'; toolbar.parentNode.insertBefore(rail,toolbar);
    const refresh=()=>{const options=[...select.options];rail.innerHTML=options.map(o=>`<button class="collection-chip${select.value===o.value?' active':''}" data-cat="${o.value.replace(/"/g,'&quot;')}">${o.value==='all'?'✦ All Collections':o.textContent}</button>`).join('');$$('.collection-chip',rail).forEach(b=>b.addEventListener('click',()=>{select.value=b.dataset.cat;select.dispatchEvent(new Event('change',{bubbles:true}));$$('.collection-chip',rail).forEach(x=>x.classList.toggle('active',x===b));}));};
    refresh();new MutationObserver(refresh).observe(select,{childList:true});select.addEventListener('change',refresh);
  }

  // Product labels + luxury metadata are layered onto cards whenever core rerenders them.
  function decorateCards(){
    $$('.product-card').forEach((card,index)=>{
      if(card.dataset.luxDecorated)return;card.dataset.luxDecorated='1';
      if(!card.querySelector('.badge.most')){
        const tag=document.createElement('span');tag.className='luxury-tag';tag.textContent=index===0?'New Arrival':index===1?'Boutique Pick':index===2?'Trending':'Curated';card.prepend(tag);
      }
    });
  }
  const cardObs=new MutationObserver(decorateCards);

  // Floating perfume bottle doubles as a tasteful easter egg.
  function perfume(){
    if($('#floatingPerfume'))return;const b=document.createElement('button');b.id='floatingPerfume';b.className='floating-perfume';b.setAttribute('aria-label','Boutique sparkle');b.textContent='F';
    b.addEventListener('click',()=>burst(28,b.getBoundingClientRect().left,b.getBoundingClientRect().top));document.body.appendChild(b);
  }

  // Desktop glitter cursor, throttled.
  let last=0;document.addEventListener('pointermove',e=>{if(reduced||innerWidth<900||Date.now()-last<90)return;last=Date.now();if(Math.random()>.48)return;const p=document.createElement('i');p.className='lux-particle';p.textContent=Math.random()>.5?'✦':'·';p.style.left=e.clientX+'px';p.style.top=e.clientY+'px';p.style.setProperty('--dx',(-10+Math.random()*20)+'px');document.body.appendChild(p);setTimeout(()=>p.remove(),950)});
  function burst(n,x=innerWidth/2,y=innerHeight/2){if(reduced)return;for(let i=0;i<n;i++){const p=document.createElement('i');p.className='lux-particle';p.textContent=i%4===0?'♡':'✦';p.style.left=(x+Math.random()*40)+'px';p.style.top=(y+Math.random()*20)+'px';p.style.fontSize=(8+Math.random()*11)+'px';p.style.setProperty('--dx',(-55+Math.random()*110)+'px');document.body.appendChild(p);setTimeout(()=>p.remove(),1000)}}

  // Princess Mode: 10 clicks on the brand. 18 clicks gives a second birthday message.
  let logoClicks=0, clickTimer;function princessMode(){const brand=$('.brand');if(!brand)return;brand.addEventListener('click',()=>{logoClicks++;clearTimeout(clickTimer);clickTimer=setTimeout(()=>logoClicks=0,3500);if(logoClicks===10){document.body.classList.toggle('princess-mode');notice(document.body.classList.contains('princess-mode')?'♕ Princess Mode Activated ✦':'Princess Mode tucked away ♡');burst(55,innerWidth/2,90);chime('success')}if(logoClicks===18){notice('🎀 Happy 18th Birthday, Femke! ♡');burst(80,innerWidth/2,90);logoClicks=0}})}
  function notice(text){const n=document.createElement('div');n.className='princess-toast';n.textContent=text;document.body.appendChild(n);setTimeout(()=>n.remove(),3200)}

  // Replace standard reserve success with a short gift reveal; watches the existing toast.
  function watchReservationSuccess(){
    const toast=$('#toast');if(!toast)return;new MutationObserver(()=>{if(/gereserveerd/i.test(toast.textContent||'')) reserveReveal();}).observe(toast,{childList:true,characterData:true,subtree:true});
  }
  let revealOpen=false;function reserveReveal(){if(revealOpen)return;revealOpen=true;chime('success');const o=document.createElement('div');o.className='reserve-celebration';o.innerHTML=`<div class="gift-reveal"><div class="ribbon-box"></div><p class="eyebrow">RESERVED WITH LOVE</p><h3>Perfect choice ♡</h3><p>Your boutique pick is officially reserved for Femke’s 18th.</p><button class="btn primary">Continue shopping ✦</button></div>`;document.body.appendChild(o);burst(40,innerWidth/2,innerHeight/2);const close=()=>{o.remove();revealOpen=false};o.addEventListener('click',e=>{if(e.target===o||e.target.closest('button'))close()});setTimeout(close,6200)}

  // Small boutique quote on home, rotated each session.
  function boutiqueQuote(){const hero=$('.hero-copy');if(!hero||$('#boutiqueQuote'))return;const quotes=['Pretty things make happy hearts.','Every gift tells a little story.','Elegance, wrapped with a bow.','Main character gifting starts here.'];const q=document.createElement('p');q.id='boutiqueQuote';q.style.cssText='margin-top:20px;font-family:Parisienne,cursive;font-size:26px;color:#b06f8c;opacity:.82';q.textContent='“'+quotes[Math.floor(Math.random()*quotes.length)]+'”';hero.appendChild(q)}

  function init(){renameBrandLanguage();buildIntro();ambient();soundButton();buildCollectionRail();perfume();princessMode();boutiqueQuote();decorateCards();const main=$('main');if(main)cardObs.observe(main,{childList:true,subtree:true});watchReservationSuccess();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
