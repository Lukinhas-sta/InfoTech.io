
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

  $$('[data-carousel]').forEach(root=>{
    const slides=$$('[data-carousel-slide]',root);
    const prev=root.querySelector('[data-carousel-prev]');
    const next=root.querySelector('[data-carousel-next]');
    const dotsRoot=root.querySelector('[data-carousel-dots]');
    if(slides.length<2)return;
    let index=0, timer=null, startX=0, dragging=false;
    const wrap=n=>(n+slides.length)%slides.length;
    const signedDistance=(i,current)=>{
      let d=i-current;
      const half=slides.length/2;
      if(d>half)d-=slides.length;
      if(d<-half)d+=slides.length;
      return d;
    };
    const render=()=>{
      slides.forEach((slide,i)=>{
        const d=signedDistance(i,index), abs=Math.abs(d);
        const visible=abs<=2;
        const x=d*68;
        const scale=abs===0?1:abs===1?.84:.69;
        const rotate=d===0?0:(d<0?9:-9);
        slide.style.transform=`translateX(${x}%) scale(${scale}) rotateY(${rotate}deg)`;
        slide.style.opacity=visible?String(abs===0?1:abs===1?.58:.18):'0';
        slide.style.filter=abs===0?'none':`saturate(${abs===1?.78:.5}) brightness(${abs===1?.72:.56})`;
        slide.style.zIndex=String(10-abs);
        slide.classList.toggle('is-active',d===0);
        slide.setAttribute('aria-hidden',String(d!==0));
        slide.tabIndex=d===0?0:-1;
      });
      if(dotsRoot){
        [...dotsRoot.children].forEach((d,i)=>{
          d.classList.toggle('active',i===index);
          d.setAttribute('aria-current',i===index?'true':'false');
        });
      }
    };
    const go=n=>{index=wrap(n);render();restart()};
    if(dotsRoot){
      slides.forEach((_,i)=>{
        const b=document.createElement('button');
        b.type='button';b.setAttribute('aria-label',`Ir para item ${i+1}`);
        b.addEventListener('click',()=>go(i));dotsRoot.appendChild(b);
      });
    }
    prev?.addEventListener('click',()=>go(index-1));
    next?.addEventListener('click',()=>go(index+1));
    root.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')go(index-1);if(e.key==='ArrowRight')go(index+1)});
    root.addEventListener('pointerdown',e=>{startX=e.clientX;dragging=true;root.setPointerCapture?.(e.pointerId)});
    root.addEventListener('pointerup',e=>{if(!dragging)return;dragging=false;const dx=e.clientX-startX;if(Math.abs(dx)>45)go(index+(dx<0?1:-1))});
    root.addEventListener('pointercancel',()=>{dragging=false});
    const delay=Number(root.dataset.autoplay||0);
    const stop=()=>{if(timer){clearInterval(timer);timer=null}};
    const start=()=>{if(!reduced&&delay>0&&!timer)timer=setInterval(()=>{index=wrap(index+1);render()},delay)};
    const restart=()=>{stop();start()};
    root.addEventListener('mouseenter',stop);root.addEventListener('mouseleave',start);
    root.addEventListener('focusin',stop);root.addEventListener('focusout',start);
    document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
    render();start();
  });
})();
