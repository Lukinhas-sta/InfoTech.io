
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

  const nearestIndex=(track,items)=>{
    const center=track.scrollLeft+track.clientWidth/2;
    let best=0,bestDist=Infinity;
    items.forEach((item,i)=>{
      const c=item.offsetLeft+item.offsetWidth/2;
      const d=Math.abs(c-center);
      if(d<bestDist){best=i;bestDist=d}
    });
    return best;
  };
  const centerItem=(track,item,behavior='smooth')=>{
    if(!item)return;
    const left=item.offsetLeft-(track.clientWidth-item.offsetWidth)/2;
    track.scrollTo({left,behavior});
  };
  const buildDots=(root,items,getIndex,go)=>{
    const dots=root.querySelector('[data-carousel-dots], [data-snap-dots]') || root.nextElementSibling?.matches?.('[data-snap-dots]')&&root.nextElementSibling;
    if(!dots)return ()=>{};
    dots.innerHTML='';
    items.forEach((_,i)=>{
      const b=document.createElement('button');
      b.type='button';b.setAttribute('aria-label',`Ir para item ${i+1}`);
      b.addEventListener('click',()=>go(i));dots.appendChild(b);
    });
    return ()=>[...dots.children].forEach((b,i)=>{
      const active=i===getIndex();b.classList.toggle('active',active);b.setAttribute('aria-current',active?'true':'false');
    });
  };

  function enableMouseMomentum(track,onInteract){
    let down=false,startX=0,startScroll=0,lastX=0,lastT=0,velocity=0,raf=0,moved=false;
    const stopInertia=()=>{if(raf){cancelAnimationFrame(raf);raf=0}};
    track.addEventListener('pointerdown',e=>{
      if(e.pointerType!=='mouse'||e.button!==0)return;
      stopInertia();down=true;moved=false;startX=e.clientX;lastX=e.clientX;startScroll=track.scrollLeft;lastT=performance.now();velocity=0;
      track.classList.add('is-dragging');track.setPointerCapture?.(e.pointerId);onInteract?.();
    });
    track.addEventListener('pointermove',e=>{
      if(!down||e.pointerType!=='mouse')return;
      const now=performance.now(),dx=e.clientX-startX;
      if(Math.abs(dx)>3)moved=true;
      track.scrollLeft=startScroll-dx;
      const dt=Math.max(8,now-lastT);velocity=(lastX-e.clientX)/dt;lastX=e.clientX;lastT=now;
      e.preventDefault();
    });
    const release=e=>{
      if(!down)return;down=false;track.classList.remove('is-dragging');
      let v=velocity*18;
      const glide=()=>{
        v*=.92;
        if(Math.abs(v)<.22){raf=0;return}
        track.scrollLeft+=v;raf=requestAnimationFrame(glide);
      };
      if(Math.abs(v)>.4)raf=requestAnimationFrame(glide);
      if(moved){
        const blocker=ev=>{ev.preventDefault();ev.stopPropagation();track.removeEventListener('click',blocker,true)};
        track.addEventListener('click',blocker,true);
      }
      onInteract?.();
    };
    track.addEventListener('pointerup',release);track.addEventListener('pointercancel',release);
  }

  $$('[data-carousel]').forEach(root=>{
    const track=root.querySelector('.coverflow-stage');
    const slides=$$('[data-carousel-slide]',root);
    if(!track||slides.length<2)return;
    let active=0,timer=0,scrollTimer=0;
    root.querySelectorAll('[data-carousel-prev],[data-carousel-next],.carousel-arrow').forEach(x=>x.remove());
    track.tabIndex=0;

    const updateVisual=()=>{
      const center=track.scrollLeft+track.clientWidth/2;
      slides.forEach((slide,i)=>{
        const c=slide.offsetLeft+slide.offsetWidth/2;
        const unit=Math.max(1,slide.offsetWidth*1.03);
        const d=(c-center)/unit,abs=Math.min(2.35,Math.abs(d));
        const scale=Math.max(.72,1-abs*.15);
        const y=abs*16;
        const rot=Math.max(-12,Math.min(12,-d*8));
        slide.style.transform=`translateY(${y}px) scale(${scale}) rotateY(${rot}deg)`;
        slide.style.opacity=String(Math.max(.24,1-abs*.34));
        slide.style.filter=abs<.48?'none':`saturate(${Math.max(.58,1-abs*.18)}) brightness(${Math.max(.62,1-abs*.13)})`;
        slide.style.zIndex=String(20-Math.round(abs*4));
        slide.classList.toggle('is-active',Math.abs(d)<.5);
        slide.setAttribute('aria-hidden',String(Math.abs(d)>=.72));
      });
      active=nearestIndex(track,slides);updateDots();
    };
    const go=i=>{active=(i+slides.length)%slides.length;centerItem(track,slides[active]);schedule()};
    const get=()=>active;
    const updateDots=buildDots(root,slides,get,go);
    const schedule=()=>{
      if(timer)clearTimeout(timer);timer=0;
      if(reduced||document.hidden)return;
      const delay=Number(root.dataset.autoplay||5000);
      if(delay>0)timer=setTimeout(()=>go(active+1),delay);
    };
    track.addEventListener('scroll',()=>{
      updateVisual();if(scrollTimer)clearTimeout(scrollTimer);
      scrollTimer=setTimeout(()=>{active=nearestIndex(track,slides);updateDots();schedule()},140);
    },{passive:true});
    track.addEventListener('touchstart',schedule,{passive:true});track.addEventListener('touchend',schedule,{passive:true});
    track.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();go(active-1)}if(e.key==='ArrowRight'){e.preventDefault();go(active+1)}});
    enableMouseMomentum(track,schedule);
    document.addEventListener('visibilitychange',schedule);
    addEventListener('resize',()=>{centerItem(track,slides[active],'auto');updateVisual()},{passive:true});
    requestAnimationFrame(()=>{centerItem(track,slides[0],'auto');updateVisual();schedule()});
  });

  $$('[data-snap-carousel]').forEach(track=>{
    const items=[...track.children].filter(x=>x.matches('article,a,.card,.process-step'));
    if(items.length<2)return;
    let active=0,timer=0,scrollTimer=0;
    const go=i=>{active=(i+items.length)%items.length;centerItem(track,items[active]);schedule()};
    const get=()=>active;
    const dots=(track.parentElement?.querySelector('[data-snap-dots]'));
    let updateDots=()=>{};
    if(dots){
      dots.innerHTML='';items.forEach((_,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',`Ir para item ${i+1}`);b.addEventListener('click',()=>go(i));dots.appendChild(b)});
      updateDots=()=>[...dots.children].forEach((b,i)=>{b.classList.toggle('active',i===active);b.setAttribute('aria-current',i===active?'true':'false')});
    }
    const schedule=()=>{
      if(timer)clearTimeout(timer);timer=0;
      if(reduced||document.hidden)return;
      const delay=Number(track.dataset.autoplay||0);
      if(delay>0)timer=setTimeout(()=>go(active+1),delay);
    };
    track.addEventListener('scroll',()=>{if(scrollTimer)clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{active=nearestIndex(track,items);updateDots();schedule()},130)},{passive:true});
    track.addEventListener('touchstart',schedule,{passive:true});track.addEventListener('touchend',schedule,{passive:true});
    enableMouseMomentum(track,schedule);updateDots();schedule();
  });

  $$('[data-scroll-next]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const track=document.querySelector(btn.dataset.scrollNext);if(!track)return;
      const items=[...track.children];if(!items.length)return;
      const current=nearestIndex(track,items);centerItem(track,items[(current+1)%items.length]);
    });
  });
})();
