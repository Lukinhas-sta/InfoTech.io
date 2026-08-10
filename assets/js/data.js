(function(){
  const KEYS={
    settings:'rass_v4_settings',services:'rass_v4_services',jewelry:'rass_v4_jewelry',appointments:'rass_v4_appointments',quotes:'rass_v4_quotes',
    clients:'rass_v4_clients',gallery:'rass_v4_gallery',promotions:'rass_v4_promotions',staff:'rass_v4_staff',blocked:'rass_v4_blocked',
    transactions:'rass_v4_transactions',notifications:'rass_v4_notifications',trash:'rass_v4_trash'
  };
  const old={settings:'rass_v2_settings',services:'rass_v2_services',jewelry:'rass_v2_jewelry',appointments:'rass_v2_appointments',quotes:'rass_v2_quotes'};
  const deep=v=>JSON.parse(JSON.stringify(v));
  const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k));return v??deep(f);}catch{return deep(f)}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const uid=p=>globalThis.crypto?.randomUUID?globalThis.crypto.randomUUID():`${p}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const nowIso=()=>new Date().toISOString();

  const defaults={
    settings:{
      studioName:'Rass Studio',instagram:'@rassstudio_',instagramUrl:'https://www.instagram.com/rassstudio_?igsh=MTJhN3l2cXhnZG14bQ==',whatsapp:'5515991799866',
      location:'Cerquilho — SP',hours:'Atendimento com hora marcada',workDays:[2,3,4,5,6],startHour:9,endHour:18,interval:60,
      siteOpen:true,siteNotice:'',lowStockThreshold:2,
      heroEyebrow:'PIERCING · NAIL DESIGN · JOIAS',heroLine1:'Rass Studio.',heroLine2:'Seu estilo.',heroLine3:'Sua expressão.',heroSubtitle:'Body piercing e nail design em um studio feito para cuidar dos detalhes que fazem você se sentir você.',
      heroPrimary:'assets/images/helix.jpg',heroSecondary:'assets/images/nails-fibra.jpg',showJewelry:true,showGallery:true,showFaq:true
    },
    services:[
      {id:'srv_nostril',type:'Piercing',name:'Nostril',category:'Rosto',price:80,duration:30,active:true,featured:true,description:'Clássico e delicado, valoriza o rosto com um detalhe discreto e cheio de personalidade.',image:'assets/images/nostril.jpg'},
      {id:'srv_tragus',type:'Piercing',name:'Trágus',category:'Orelha',price:90,duration:35,active:true,featured:true,description:'Uma escolha elegante para quem quer destacar a orelha de forma sutil.',image:'assets/images/tragus.jpg'},
      {id:'srv_lobulo',type:'Piercing',name:'Lóbulo / Orelha',category:'Orelha',price:60,duration:30,active:true,featured:false,description:'Do básico ao sofisticado. Ideal para primeiro ou novos furos e composições.',image:'assets/images/lobulo.jpg'},
      {id:'srv_umbigo',type:'Piercing',name:'Umbigo',category:'Corpo',price:120,duration:40,active:true,featured:true,description:'Um clássico marcante, com escolha de joia e posicionamento alinhados ao seu estilo.',image:'assets/images/umbigo.jpg'},
      {id:'srv_sobrancelha',type:'Piercing',name:'Sobrancelha',category:'Rosto',price:90,duration:35,active:true,featured:false,description:'Atitude e personalidade no olhar, com acabamento moderno e versátil.',image:'assets/images/sobrancelha.jpg'},
      {id:'srv_industrial',type:'Piercing',name:'Industrial / Transversal',category:'Orelha',price:120,duration:45,active:true,featured:true,description:'Visual forte e estiloso com duas perfurações conectadas por uma única joia.',image:'assets/images/industrial.jpg'},
      {id:'srv_labret',type:'Piercing',name:'Labret / Lábio',category:'Rosto',price:100,duration:35,active:true,featured:false,description:'Destaque para os lábios com uma proposta moderna e personalizada.',image:'assets/images/labret.jpg'},
      {id:'srv_helix',type:'Piercing',name:'Hélix / Cartilagem',category:'Orelha',price:90,duration:35,active:true,featured:true,description:'Perfeito para criar composições delicadas ou mais marcantes na orelha.',image:'assets/images/helix.jpg'},
      {id:'srv_fibra',type:'Unhas',name:'Alongamento em fibra',category:'Nail Design',price:0,duration:120,active:true,featured:true,description:'Alongamento com estrutura leve e elegante, construído para personalizar comprimento e formato.',image:'assets/images/nails-fibra.jpg'},
      {id:'srv_f1',type:'Unhas',name:'Molde F1',category:'Nail Design',price:0,duration:120,active:true,featured:true,description:'Técnica de alongamento com molde F1 para acabamento alinhado, moderno e personalizado.',image:'assets/images/nails-f1.jpg'},
      {id:'srv_banho_gel',type:'Unhas',name:'Banho em gel',category:'Nail Design',price:0,duration:90,active:true,featured:true,description:'Camada de gel para reforçar a unha natural, trazendo resistência, brilho e acabamento impecável.',image:'assets/images/nails-gel.jpg'}
    ],
    jewelry:[
      {id:'j1',name:'Ponto de Luz 3mm',category:'Labret',material:'Titânio',price:60,qty:5,active:true,description:'Modelo minimalista com brilho delicado para diferentes composições.',image:'assets/images/joia-ponto-luz.svg'},
      {id:'j2',name:'Argola Clicker',category:'Argola',material:'Titânio',price:80,qty:3,active:true,description:'Argola prática, limpa e versátil para diferentes regiões.',image:'assets/images/joia-clicker.svg'},
      {id:'j3',name:'Labret Basic',category:'Labret',material:'Titânio',price:50,qty:7,active:true,description:'Peça básica e confortável, ótima para composições minimalistas.',image:'assets/images/joia-labret.svg'},
      {id:'j4',name:'Banana Umbigo',category:'Umbigo',material:'Titânio',price:70,qty:2,active:true,description:'Modelo curvo clássico para piercing de umbigo.',image:'assets/images/joia-banana.svg'},
      {id:'j5',name:'Barra Industrial',category:'Industrial',material:'Aço cirúrgico',price:60,qty:4,active:true,description:'Barra reta para composição industrial/transversal.',image:'assets/images/joia-industrial.svg'},
      {id:'j6',name:'Curva com detalhe',category:'Curvos',material:'Titânio',price:75,qty:0,active:true,description:'Peça curva com detalhe visual para uma composição mais marcante.',image:'assets/images/joia-curva.svg'}
    ],
    gallery:[
      {id:'g1',type:'Piercing',title:'Trágus',image:'assets/images/tragus.jpg',active:true,featured:true},
      {id:'g2',type:'Piercing',title:'Nostril',image:'assets/images/nostril.jpg',active:true,featured:true},
      {id:'g3',type:'Piercing',title:'Labret',image:'assets/images/labret.jpg',active:true,featured:false},
      {id:'g4',type:'Piercing',title:'Umbigo',image:'assets/images/umbigo.jpg',active:true,featured:true},
      {id:'g5',type:'Piercing',title:'Sobrancelha',image:'assets/images/sobrancelha.jpg',active:true,featured:false},
      {id:'g6',type:'Piercing',title:'Industrial',image:'assets/images/industrial.jpg',active:true,featured:true},
      {id:'g7',type:'Unhas',title:'Alongamento em fibra',image:'assets/images/nails-fibra.jpg',active:true,featured:true,credit:'Foto demonstrativa · Pexels'},
      {id:'g8',type:'Unhas',title:'Molde F1',image:'assets/images/nails-f1.jpg',active:true,featured:true,credit:'Foto demonstrativa · Pexels'},
      {id:'g9',type:'Unhas',title:'Banho em gel',image:'assets/images/nails-gel.jpg',active:true,featured:true,credit:'Foto demonstrativa · Pexels'}
    ],
    promotions:[],
    staff:[{id:'staff_raquel',name:'Raquel',specialties:['Piercing','Unhas'],active:true,phone:'',notes:'Responsável pelo studio.'}],
    appointments:[],quotes:[],clients:[],blocked:[],transactions:[],notifications:[],trash:[]
  };

  function migrate(){
    if(localStorage.getItem(KEYS.settings))return;
    const hasOld=localStorage.getItem(old.settings)||localStorage.getItem(old.services)||localStorage.getItem(old.jewelry);
    if(!hasOld)return;
    const s=read(old.settings,defaults.settings);
    write(KEYS.settings,{...deep(defaults.settings),...s});
    const oldSrv=read(old.services,[]).map(x=>({...x,type:x.type||'Piercing',active:x.active!==false,featured:!!x.featured}));
    write(KEYS.services,[...oldSrv,...deep(defaults.services.filter(x=>x.type==='Unhas'))]);
    write(KEYS.jewelry,read(old.jewelry,defaults.jewelry).map(x=>({...x,active:x.active!==false})));
    write(KEYS.appointments,read(old.appointments,[]));
    write(KEYS.quotes,read(old.quotes,[]));
  }
  function seed(){
    migrate();
    Object.entries(defaults).forEach(([name,val])=>{const key=KEYS[name];if(key&&!localStorage.getItem(key))write(key,val)});
  }
  seed();

  let remoteHooks={onSet:null,onRemove:null};
  function setRemoteHooks(hooks={}){remoteHooks={...remoteHooks,...hooks}}
  function get(name){return read(KEYS[name],defaults[name]??[])}
  function set(name,val,options={}){write(KEYS[name],val);if(options.remote!==false&&typeof remoteHooks.onSet==='function')remoteHooks.onSet(name,val);return val}
  function update(name,fn){const v=get(name);const next=fn(v)||v;set(name,next);return next}
  function push(name,item){const arr=get(name);arr.push(item);set(name,arr);return item}
  function remove(name,id,trash=true){const arr=get(name);const idx=arr.findIndex(x=>x.id===id);if(idx<0)return null;const [item]=arr.splice(idx,1);set(name,arr,{remote:false});if(typeof remoteHooks.onRemove==='function')remoteHooks.onRemove(name,id,item);if(trash){const t=get('trash');t.unshift({id:uid('trash'),entity:name,deletedAt:nowIso(),item});set('trash',t,{remote:false})}return item}
  function notify(title,message,kind='info',meta={}){const arr=get('notifications');arr.unshift({id:uid('n'),title,message,kind,meta,read:false,createdAt:nowIso()});set('notifications',arr);return arr[0]}
  function upsertClient({name,phone,email='',notes=''}){
    const norm=String(phone||'').replace(/\D/g,'');if(!name&&!norm)return null;
    const arr=get('clients');let c=arr.find(x=>norm&&String(x.phone||'').replace(/\D/g,'')===norm);
    if(c){c.name=name||c.name;c.email=email||c.email;c.lastSeen=nowIso();if(notes&&!c.notes)c.notes=notes;}
    else{c={id:uid('cli'),name:name||'Cliente',phone,email,notes,lastSeen:nowIso(),createdAt:nowIso()};arr.push(c)}
    set('clients',arr);return c;
  }
  window.RassData={KEYS,defaults,get,set,update,push,remove,uid,nowIso,deep,notify,upsertClient,setRemoteHooks};
})();
