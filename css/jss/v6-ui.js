
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const menuBtn=$('.menu-mobile'), menu=$('.menu');
  const closeMenu=()=>{menu?.classList.remove('ativo');menuBtn?.setAttribute('aria-expanded','false')};
  menuBtn?.addEventListener('click',e=>{e.stopPropagation();const open=menu?.classList.toggle('ativo');menuBtn.setAttribute('aria-expanded',String(Boolean(open)))});
  document.addEventListener('click',e=>{if(menu && menuBtn && !menu.contains(e.target) && !menuBtn.contains(e.target))closeMenu()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
  $$('.menu a').forEach(a=>a.addEventListener('click',closeMenu));
  const header=$('.site-header');
  const head=()=>header?.classList.toggle('scrolled',scrollY>10);
  addEventListener('scroll',head,{passive:true});head();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items=$$('.reveal');
  if(reduced || !('IntersectionObserver' in window)) items.forEach(x=>x.classList.add('visible'));
  else{
    const io=new IntersectionObserver((entries,o)=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');o.unobserve(e.target)}}),{threshold:.1,rootMargin:'0px 0px -40px'});
    items.forEach((x,i)=>{x.style.setProperty('--delay',`${Math.min(i%4,3)*65}ms`);io.observe(x)});
  }
  $$('[data-year]').forEach(x=>x.textContent=new Date().getFullYear());
  // Compatibilidade com um bug histórico do script antigo de mensagens.
  if(!globalThis.makeId) globalThis.makeId=()=>globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  // Tabs
  $$('[data-tabs]').forEach(root=>{
    const buttons=$$('[data-tab]',root), panels=$$('[data-panel]',root);
    const activate=name=>{
      buttons.forEach(b=>{const active=b.dataset.tab===name;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});
      panels.forEach(p=>p.hidden=p.dataset.panel!==name);
    };
    buttons.forEach(b=>b.addEventListener('click',()=>activate(b.dataset.tab)));
    if(buttons[0])activate(buttons[0].dataset.tab);
  });
  // Password strength
  $$('[data-password-meter]').forEach(input=>{
    const meter=document.getElementById(input.dataset.passwordMeter);
    if(!meter)return;
    const check=()=>{
      const v=input.value||''; let score=0;
      if(v.length>=8)score++; if(v.length>=12)score++; if(/[A-Z]/.test(v)&&/[a-z]/.test(v))score++; if(/\d/.test(v)&&/[^A-Za-z0-9]/.test(v))score++;
      meter.dataset.score=String(score);
    };
    input.addEventListener('input',check);check();
  });
})();

(() => {
  'use strict';
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const prefersHover=matchMedia('(hover:hover) and (pointer:fine)').matches;

  const logicalOf=item=>Number(item?.dataset?.loopIndex||0);
  const itemCenter=(item)=>item.offsetLeft+item.offsetWidth/2;
  const nearestIndex=(track,items)=>{
    const center=track.scrollLeft+track.clientWidth/2;
    let best=0,dist=Infinity;
    for(let i=0;i<items.length;i++){
      const d=Math.abs(itemCenter(items[i])-center);
      if(d<dist){dist=d;best=i}
    }
    return best;
  };
  const centerTo=(track,item,behavior='smooth')=>{
    if(!item)return;
    const left=itemCenter(item)-track.clientWidth/2;
    track.scrollTo({left,behavior:reduced?'auto':behavior});
  };

  function cloneCard(node,index){
    const c=node.cloneNode(true);
    c.dataset.loopClone='true';
    c.dataset.loopIndex=String(index);
    c.removeAttribute('id');
    c.setAttribute('aria-hidden','true');
    c.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));
    c.querySelectorAll('a,button,input,select,textarea,[tabindex]').forEach(x=>x.setAttribute('tabindex','-1'));
    c.querySelectorAll('img').forEach(img=>{img.loading='lazy';img.decoding='async'});
    return c;
  }

  function buildThreeRuns(track,originals){
    originals.forEach((item,i)=>item.dataset.loopIndex=String(i));
    const frag=document.createDocumentFragment();
    originals.forEach((item,i)=>frag.appendChild(cloneCard(item,i)));
    originals.forEach(item=>frag.appendChild(item));
    originals.forEach((item,i)=>frag.appendChild(cloneCard(item,i)));
    track.replaceChildren(frag);
    return [...track.children];
  }

  function addDots(host,count,go){
    const dots=host.querySelector('[data-carousel-dots],[data-snap-dots]') || host.nextElementSibling?.matches?.('[data-snap-dots]') && host.nextElementSibling;
    if(!dots)return {update:()=>{}};
    dots.innerHTML='';
    const buttons=[];
    for(let i=0;i<count;i++){
      const b=document.createElement('button');
      b.type='button'; b.setAttribute('aria-label',`Ir para item ${i+1}`);
      b.addEventListener('click',()=>go(i)); dots.appendChild(b); buttons.push(b);
    }
    return {update:(active)=>buttons.forEach((b,i)=>{const on=i===active;b.classList.toggle('active',on);b.setAttribute('aria-current',on?'true':'false')})};
  }

  function setupLoop(track,originals,host,{autoplay=5000,coverflow=false}={}){
    if(!track||originals.length<2)return;
    const count=originals.length;
    const items=buildThreeRuns(track,originals);
    const middleStart=count;
    let active=0, autoTimer=0, settleTimer=0, visualRaf=0, paused=false, dragging=false;

    const schedule=()=>{
      clearTimeout(autoTimer);
      if(reduced||paused||dragging||document.hidden||autoplay<=0)return;
      autoTimer=setTimeout(()=>step(1),autoplay);
    };

    const goLogical=(logical,behavior='smooth')=>{
      const current=nearestIndex(track,items);
      let target=middleStart+logical;
      // Pick the nearest duplicate so dot navigation never jumps far.
      const candidates=[logical,middleStart+logical,middleStart*2+logical];
      target=candidates.reduce((a,b)=>Math.abs(b-current)<Math.abs(a-current)?b:a,candidates[0]);
      centerTo(track,items[target],behavior);
      active=logical; dots.update(active); schedule();
    };
    const dots=addDots(host,count,(i)=>goLogical(i));

    const paint=()=>{
      visualRaf=0;
      const p=nearestIndex(track,items);
      active=logicalOf(items[p]);
      dots.update(active);
      if(coverflow){
        // Only three visual states; much cheaper than recalculating filters/transforms continuously.
        items.forEach((item,i)=>{
          const delta=Math.max(-2,Math.min(2,i-p));
          item.classList.toggle('is-active',delta===0);
          item.classList.toggle('is-near',Math.abs(delta)===1);
          item.classList.toggle('is-far',Math.abs(delta)>=2);
        });
      }
    };
    const requestPaint=()=>{if(!visualRaf)visualRaf=requestAnimationFrame(paint)};

    const normalize=()=>{
      clearTimeout(settleTimer);
      const p=nearestIndex(track,items);
      const logical=logicalOf(items[p]);
      const group=Math.floor(p/count);
      if(group!==1){
        const source=items[p], target=items[middleStart+logical];
        if(source&&target){
          const relative=(track.scrollLeft + track.clientWidth/2)-itemCenter(source);
          track.scrollLeft=itemCenter(target)+relative-track.clientWidth/2;
        }
      }
      requestPaint(); schedule();
    };
    const settleSoon=()=>{clearTimeout(settleTimer);settleTimer=setTimeout(normalize,120)};

    const step=(dir)=>{
      const p=nearestIndex(track,items);
      const target=items[Math.max(0,Math.min(items.length-1,p+dir))];
      centerTo(track,target,'smooth'); schedule();
    };

    // Native touch scrolling supplies momentum on mobile. We only observe it.
    track.addEventListener('scroll',()=>{requestPaint();settleSoon()},{passive:true});
    if('onscrollend' in window) track.addEventListener('scrollend',normalize,{passive:true});
    track.addEventListener('touchstart',()=>{dragging=true;clearTimeout(autoTimer)},{passive:true});
    track.addEventListener('touchend',()=>{dragging=false;settleSoon()},{passive:true});
    track.addEventListener('touchcancel',()=>{dragging=false;settleSoon()},{passive:true});

    // Lightweight mouse drag + momentum for desktop. Touch remains entirely native.
    if(prefersHover){
      let down=false,startX=0,startScroll=0,lastX=0,lastT=0,velocity=0,momentum=0,moved=false;
      const stopMomentum=()=>{if(momentum){cancelAnimationFrame(momentum);momentum=0}};
      const finish=()=>{
        if(!down)return; down=false; dragging=false; paused=false; track.classList.remove('is-dragging');
        let v=velocity*18;
        const glide=()=>{
          v*=.90;
          if(Math.abs(v)<.22){momentum=0;settleSoon();return}
          track.scrollLeft+=v; momentum=requestAnimationFrame(glide);
        };
        if(Math.abs(v)>.55) momentum=requestAnimationFrame(glide); else settleSoon();
        if(moved){
          const block=e=>{e.preventDefault();e.stopPropagation();track.removeEventListener('click',block,true)};
          track.addEventListener('click',block,true);
        }
      };
      track.addEventListener('pointerdown',e=>{
        if(e.pointerType!=='mouse'||e.button!==0)return;
        stopMomentum(); down=true; dragging=true; moved=false; paused=true; clearTimeout(autoTimer);
        startX=lastX=e.clientX; startScroll=track.scrollLeft; lastT=performance.now(); velocity=0;
        track.classList.add('is-dragging'); track.setPointerCapture?.(e.pointerId);
      });
      track.addEventListener('pointermove',e=>{
        if(!down||e.pointerType!=='mouse')return;
        const now=performance.now(),dx=e.clientX-startX,dt=Math.max(8,now-lastT);
        if(Math.abs(dx)>4)moved=true;
        track.scrollLeft=startScroll-dx;
        velocity=(lastX-e.clientX)/dt; lastX=e.clientX; lastT=now;
        e.preventDefault();
      });
      track.addEventListener('pointerup',finish); track.addEventListener('pointercancel',finish);
      track.addEventListener('pointerleave',()=>{if(!down){paused=false;schedule()}});
      track.addEventListener('pointerenter',()=>{if(!down){paused=true;clearTimeout(autoTimer)}});
    }

    track.addEventListener('keydown',e=>{
      if(e.key==='ArrowLeft'){e.preventDefault();step(-1)}
      if(e.key==='ArrowRight'){e.preventDefault();step(1)}
    });
    track.tabIndex=0;
    track._loopNext=()=>step(1); track._loopPrev=()=>step(-1); track._loopGo=goLogical;
    document.addEventListener('visibilitychange',schedule);
    addEventListener('resize',()=>requestAnimationFrame(normalize),{passive:true});

    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      centerTo(track,items[middleStart],'auto'); paint(); schedule();
    }));
  }

  $$('[data-carousel]').forEach(root=>{
    const track=root.querySelector('.coverflow-stage');
    if(!track)return;
    const originals=$$(':scope > [data-carousel-slide]',track);
    root.querySelectorAll('[data-carousel-prev],[data-carousel-next],.carousel-arrow').forEach(x=>x.remove());
    setupLoop(track,originals,root,{autoplay:Number(root.dataset.autoplay||5000),coverflow:true});
  });

  $$('[data-snap-carousel]').forEach(track=>{
    const originals=[...track.children].filter(x=>x.matches('article,a,.card,.process-step'));
    setupLoop(track,originals,track.parentElement||track,{autoplay:Number(track.dataset.autoplay||5000),coverflow:false});
  });

  $$('[data-scroll-next]').forEach(btn=>btn.addEventListener('click',()=>{
    const track=document.querySelector(btn.dataset.scrollNext);
    if(typeof track?._loopNext==='function')track._loopNext();
  }));
})();
