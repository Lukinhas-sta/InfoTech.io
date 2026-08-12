
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
  const GROUPS=7;
  const MID=Math.floor(GROUPS/2);

  const centerLeft=(track,item)=>item.offsetLeft-(track.clientWidth-item.offsetWidth)/2;
  const centerItem=(track,item,behavior='smooth')=>{
    if(!item)return;
    track.scrollTo({left:centerLeft(track,item),behavior});
  };
  const nearestPhysical=(track,items)=>{
    const center=track.scrollLeft+track.clientWidth/2;
    let best=0,bestDist=Infinity;
    items.forEach((item,i)=>{
      const c=item.offsetLeft+item.offsetWidth/2;
      const d=Math.abs(c-center);
      if(d<bestDist){best=i;bestDist=d}
    });
    return best;
  };
  const logicalOf=item=>Number(item?.dataset?.loopIndex||0);

  function inertClone(node,logical){
    const clone=node.cloneNode(true);
    clone.dataset.loopClone='true';
    clone.dataset.loopIndex=String(logical);
    clone.removeAttribute('id');
    clone.setAttribute('aria-hidden','true');
    clone.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));
    clone.querySelectorAll('a,button,input,select,textarea,[tabindex]').forEach(x=>x.setAttribute('tabindex','-1'));
    return clone;
  }

  function buildInfiniteRunway(track,originals){
    originals.forEach((item,i)=>item.dataset.loopIndex=String(i));
    const frag=document.createDocumentFragment();
    for(let g=0;g<GROUPS;g++){
      originals.forEach((item,i)=>frag.appendChild(g===MID?item:inertClone(item,i)));
    }
    track.replaceChildren(frag);
    return [...track.children];
  }

  function enableMouseMomentum(track,onStart,onEnd){
    let down=false,startX=0,startScroll=0,lastX=0,lastT=0,velocity=0,raf=0,moved=false;
    const stop=()=>{if(raf){cancelAnimationFrame(raf);raf=0}};
    track.addEventListener('pointerdown',e=>{
      if(e.pointerType!=='mouse'||e.button!==0)return;
      stop();down=true;moved=false;startX=e.clientX;lastX=e.clientX;startScroll=track.scrollLeft;lastT=performance.now();velocity=0;
      track.classList.add('is-dragging');track.setPointerCapture?.(e.pointerId);onStart?.();
    });
    track.addEventListener('pointermove',e=>{
      if(!down||e.pointerType!=='mouse')return;
      const now=performance.now(),dx=e.clientX-startX,dt=Math.max(8,now-lastT);
      if(Math.abs(dx)>3)moved=true;
      track.scrollLeft=startScroll-dx;
      velocity=(lastX-e.clientX)/dt;lastX=e.clientX;lastT=now;
      e.preventDefault();
    });
    const release=()=>{
      if(!down)return;down=false;track.classList.remove('is-dragging');
      let v=velocity*22;
      const glide=()=>{
        v*=.935;
        if(Math.abs(v)<.16){raf=0;onEnd?.();return}
        track.scrollLeft+=v;raf=requestAnimationFrame(glide);
      };
      if(Math.abs(v)>.35)raf=requestAnimationFrame(glide); else onEnd?.();
      if(moved){
        const block=ev=>{ev.preventDefault();ev.stopPropagation();track.removeEventListener('click',block,true)};
        track.addEventListener('click',block,true);
      }
    };
    track.addEventListener('pointerup',release);track.addEventListener('pointercancel',release);
  }

  function makeDots(host,count,getLogical,goLogical,selector){
    const dots=host.querySelector?.(selector) || (host.nextElementSibling?.matches?.(selector)?host.nextElementSibling:null);
    if(!dots)return ()=>{};
    dots.innerHTML='';
    for(let i=0;i<count;i++){
      const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',`Ir para item ${i+1}`);
      b.addEventListener('click',()=>goLogical(i));dots.appendChild(b);
    }
    return ()=>[...dots.children].forEach((b,i)=>{
      const active=i===getLogical();b.classList.toggle('active',active);b.setAttribute('aria-current',active?'true':'false');
    });
  }

  function setupInfinite({track,originals,host,dotsSelector,autoplay=0,onVisual}){
    if(!track||originals.length<2)return;
    const count=originals.length;
    const physical=buildInfiniteRunway(track,originals);
    let activeLogical=0,timer=0,idleTimer=0,visualRaf=0,interacting=false;

    const clearAuto=()=>{if(timer){clearTimeout(timer);timer=0}};
    const schedule=()=>{
      clearAuto();
      if(reduced||document.hidden||interacting||autoplay<=0)return;
      timer=setTimeout(()=>goDelta(1),autoplay);
    };
    const updateVisual=()=>{
      if(visualRaf)return;
      visualRaf=requestAnimationFrame(()=>{
        visualRaf=0;
        onVisual?.(physical);
        const p=nearestPhysical(track,physical);activeLogical=logicalOf(physical[p]);updateDots();
      });
    };
    const normalize=()=>{
      const p=nearestPhysical(track,physical);
      const item=physical[p];
      const logical=logicalOf(item);
      activeLogical=logical;
      const group=Math.floor(p/count);
      if(group!==MID){
        const target=physical[MID*count+logical];
        if(target){
          // Preserve the exact viewport position so the teleport is invisible.
          const delta=target.offsetLeft-item.offsetLeft;
          track.scrollLeft+=delta;
        }
      }
      updateVisual();schedule();
    };
    const settleSoon=()=>{
      if(idleTimer)clearTimeout(idleTimer);
      idleTimer=setTimeout(normalize,180);
    };
    const goDelta=delta=>{
      const p=nearestPhysical(track,physical);
      const target=physical[Math.max(0,Math.min(physical.length-1,p+delta))];
      centerItem(track,target,'smooth');
      activeLogical=logicalOf(target);updateDots();schedule();
    };
    const goLogical=logical=>{
      const p=nearestPhysical(track,physical);
      let best=null,bestDist=Infinity;
      physical.forEach((item,i)=>{
        if(logicalOf(item)!==logical)return;
        const d=Math.abs(i-p);if(d<bestDist){bestDist=d;best=item}
      });
      centerItem(track,best,'smooth');activeLogical=logical;updateDots();schedule();
    };
    const getLogical=()=>activeLogical;
    const updateDots=makeDots(host,count,getLogical,goLogical,dotsSelector);

    track.addEventListener('scroll',()=>{updateVisual();settleSoon()},{passive:true});
    track.addEventListener('touchstart',()=>{interacting=true;clearAuto()},{passive:true});
    track.addEventListener('touchend',()=>{interacting=false;settleSoon()},{passive:true});
    track.addEventListener('touchcancel',()=>{interacting=false;settleSoon()},{passive:true});
    track.addEventListener('pointerenter',()=>{if(matchMedia('(hover:hover)').matches){interacting=true;clearAuto()}},{passive:true});
    track.addEventListener('pointerleave',()=>{if(matchMedia('(hover:hover)').matches){interacting=false;schedule()}},{passive:true});
    enableMouseMomentum(track,()=>{interacting=true;clearAuto()},()=>{interacting=false;settleSoon()});
    document.addEventListener('visibilitychange',schedule);
    addEventListener('resize',()=>{normalize()},{passive:true});
    track.addEventListener('keydown',e=>{
      if(e.key==='ArrowLeft'){e.preventDefault();goDelta(-1)}
      if(e.key==='ArrowRight'){e.preventDefault();goDelta(1)}
    });
    track.tabIndex=0;
    track._loopNext=()=>goDelta(1);
    track._loopPrev=()=>goDelta(-1);
    track._loopGo=goLogical;

    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const first=physical[MID*count];
      centerItem(track,first,'auto');updateVisual();schedule();
    }));
    addEventListener('load',()=>{const first=physical[MID*count+activeLogical]; if(first) centerItem(track,first,'auto')},{once:true});
  }

  $$('[data-carousel]').forEach(root=>{
    const track=root.querySelector('.coverflow-stage');
    const originals=$$(':scope > [data-carousel-slide]',track);
    if(!track||originals.length<2)return;
    root.querySelectorAll('[data-carousel-prev],[data-carousel-next],.carousel-arrow').forEach(x=>x.remove());
    const visual=physical=>{
      const center=track.scrollLeft+track.clientWidth/2;
      physical.forEach(slide=>{
        const c=slide.offsetLeft+slide.offsetWidth/2;
        const unit=Math.max(1,slide.offsetWidth*1.03);
        const d=(c-center)/unit,abs=Math.min(2.5,Math.abs(d));
        const scale=Math.max(.72,1-abs*.15),y=abs*16,rot=Math.max(-12,Math.min(12,-d*8));
        slide.style.transform=`translateY(${y}px) scale(${scale}) rotateY(${rot}deg)`;
        slide.style.opacity=String(Math.max(.20,1-abs*.34));
        slide.style.filter=abs<.48?'none':`saturate(${Math.max(.58,1-abs*.18)}) brightness(${Math.max(.62,1-abs*.13)})`;
        slide.style.zIndex=String(30-Math.round(abs*5));
        const active=Math.abs(d)<.5;slide.classList.toggle('is-active',active);
        if(!slide.dataset.loopClone)slide.setAttribute('aria-hidden',String(!active));
      });
    };
    setupInfinite({track,originals,host:root,dotsSelector:'[data-carousel-dots]',autoplay:Number(root.dataset.autoplay||5000),onVisual:visual});
  });

  $$('[data-snap-carousel]').forEach(track=>{
    const originals=[...track.children].filter(x=>x.matches('article,a,.card,.process-step'));
    if(originals.length<2)return;
    setupInfinite({track,originals,host:track.parentElement||track,dotsSelector:'[data-snap-dots]',autoplay:Number(track.dataset.autoplay||5000)});
  });

  $$('[data-scroll-next]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const track=document.querySelector(btn.dataset.scrollNext);if(!track)return;
      if(typeof track._loopNext==='function'){track._loopNext();return}
      const items=[...track.children];if(!items.length)return;
      const p=nearestPhysical(track,items);centerItem(track,items[(p+1)%items.length]);
    });
  });
})();
