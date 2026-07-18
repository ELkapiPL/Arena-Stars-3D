(() => {
'use strict';
window.__arenaBuild='arena-mobile-fullscreen-layout-v20';

const canvas = document.getElementById('game');
const earlyMobileHint=((navigator.maxTouchPoints||0)>0&&matchMedia('(pointer: coarse)').matches)||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const gl = canvas.getContext('webgl2', {antialias:!earlyMobileHint, alpha:false, powerPreference:'high-performance', desynchronized:true});
const errorBox = document.getElementById('error');
if (!gl) {
  errorBox.style.display = 'block';
  errorBox.innerHTML = '<h2>Ta przeglądarka nie obsługuje WebGL 2.</h2><p>Uruchom grę w aktualnym Chrome, Edge lub Firefox i upewnij się, że akceleracja sprzętowa jest włączona.</p>';
  return;
}

const $ = id => document.getElementById(id);
const ui = {
  overlay:$('overlay'), lobbyView:$('lobbyView'), gameOverView:$('gameOverView'), playBtn:$('playBtn'), retryBtn:$('retryBtn'), lobbyBtn:$('lobbyBtn'),
  score:$('score'), wave:$('wave'), kills:$('kills'), coins:$('coins'), trophies:$('trophies'), healthText:$('healthText'), healthFill:$('healthFill'), ammoText:$('ammoText'), ammoFill:$('ammoFill'),
  superText:$('superText'), superFill:$('superFill'), hyperText:$('hyperText'), hyperFill:$('hyperFill'), finalScore:$('finalScore'), finalKills:$('finalKills'), finalCoins:$('finalCoins'), finalTrophies:$('finalTrophies'),
  savedTrophies:$('savedTrophies'), savedPoints:$('savedPoints'), savedCoins:$('savedCoins'), skinNotice:$('skinNotice'), versionOneBtn:$('versionOneBtn'), versionNotice:$('versionNotice'), rankingBody:$('rankingBody'), rankingPosition:$('rankingPosition'), rankingLive:$('rankingLive'), rankingTotal:$('rankingTotal'), nicknameInput:$('nicknameInput'), saveNameBtn:$('saveNameBtn'), onlineStatus:$('onlineStatus'), onlineHudCount:$('onlineHudCount'), modeBtn:$('modeBtn'), modeMenu:$('modeMenu'), soloModeOption:$('soloModeOption'), duelModeOption:$('duelModeOption'), duelQueueView:$('duelQueueView'), duelQueueText:$('duelQueueText'), duelCancelBtn:$('duelCancelBtn'), duelOpponentName:$('duelOpponentName'), duelOpponentHp:$('duelOpponentHp'), hudModeText:$('hudModeText'), gameOverTitle:$('gameOverTitle'), gameOverBadge:$('gameOverBadge'), endStats:$('endStats'),
  crosshair:$('crosshair'), centerMsg:$('centerMsg'), mobileControls:$('mobileControls'), mobileMoveStick:$('mobileMoveStick'), mobileMoveKnob:$('mobileMoveKnob'), mobileAttackStick:$('mobileAttackStick'), mobileAttackKnob:$('mobileAttackKnob'), mobileSuperBtn:$('mobileSuperBtn'), mobileHyperBtn:$('mobileHyperBtn'), rotatePhoneOverlay:$('rotatePhoneOverlay'), rotateLockBtn:$('rotateLockBtn'), mobileFullscreenGate:$('mobileFullscreenGate'), mobileFullscreenStartBtn:$('mobileFullscreenStartBtn'), mobileFullscreenTitle:$('mobileFullscreenTitle'), mobileFullscreenText:$('mobileFullscreenText'), lobbyFullscreenBtn:$('lobbyFullscreenBtn'), passOpenBtn:$('passOpenBtn'), passOverlay:$('passOverlay'), passCloseBtn:$('passCloseBtn'), passGrid:$('passGrid'), passPointsText:$('passPointsText'), passTierBadge:$('passTierBadge'), passProgressFill:$('passProgressFill'), passNextText:$('passNextText'), passBuyVipBtn:$('passBuyVipBtn'), passBuyVipPlusBtn:$('passBuyVipPlusBtn'), passClaimAllBtn:$('passClaimAllBtn'), passMessage:$('passMessage'), storeOpenBtn:$('storeOpenBtn'), storeOverlay:$('storeOverlay'), storeCloseBtn:$('storeCloseBtn'), coinShopMessage:$('coinShopMessage'),
  upgradeButtons:[...document.querySelectorAll('[data-upgrade]')],
  persistentLevelEls:[...document.querySelectorAll('[data-persistent-level]')],
  skinCards:[...document.querySelectorAll('[data-skin]')],
  storeTabs:[...document.querySelectorAll('[data-store-tab]')],
  storePanes:[...document.querySelectorAll('[data-store-pane]')],
  coinPackButtons:[...document.querySelectorAll('[data-coin-pack]')]
};

// ---------- Minimalna matematyka 3D ----------
const M4 = {
  create(){ return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); },
  identity(o){ o.set([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); return o; },
  multiply(o,a,b){
    const a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15];
    let b0=b[0],b1=b[1],b2=b[2],b3=b[3]; o[0]=b0*a00+b1*a10+b2*a20+b3*a30; o[1]=b0*a01+b1*a11+b2*a21+b3*a31; o[2]=b0*a02+b1*a12+b2*a22+b3*a32; o[3]=b0*a03+b1*a13+b2*a23+b3*a33;
    b0=b[4];b1=b[5];b2=b[6];b3=b[7]; o[4]=b0*a00+b1*a10+b2*a20+b3*a30; o[5]=b0*a01+b1*a11+b2*a21+b3*a31; o[6]=b0*a02+b1*a12+b2*a22+b3*a32; o[7]=b0*a03+b1*a13+b2*a23+b3*a33;
    b0=b[8];b1=b[9];b2=b[10];b3=b[11]; o[8]=b0*a00+b1*a10+b2*a20+b3*a30; o[9]=b0*a01+b1*a11+b2*a21+b3*a31; o[10]=b0*a02+b1*a12+b2*a22+b3*a32; o[11]=b0*a03+b1*a13+b2*a23+b3*a33;
    b0=b[12];b1=b[13];b2=b[14];b3=b[15]; o[12]=b0*a00+b1*a10+b2*a20+b3*a30; o[13]=b0*a01+b1*a11+b2*a21+b3*a31; o[14]=b0*a02+b1*a12+b2*a22+b3*a32; o[15]=b0*a03+b1*a13+b2*a23+b3*a33; return o;
  },
  perspective(o,fovy,aspect,near,far){ const f=1/Math.tan(fovy/2),nf=1/(near-far); o.set([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]); return o; },
  lookAt(o,e,c,u){
    let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2]; let l=Math.hypot(zx,zy,zz)||1; zx/=l;zy/=l;zz/=l;
    let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx; l=Math.hypot(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;
    const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
    o.set([xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0, -(xx*e[0]+xy*e[1]+xz*e[2]),-(yx*e[0]+yy*e[1]+yz*e[2]),-(zx*e[0]+zy*e[1]+zz*e[2]),1]); return o;
  },
  translate(o,a,v){ const x=v[0],y=v[1],z=v[2]; if(o!==a)o.set(a); o[12]=a[0]*x+a[4]*y+a[8]*z+a[12];o[13]=a[1]*x+a[5]*y+a[9]*z+a[13];o[14]=a[2]*x+a[6]*y+a[10]*z+a[14];o[15]=a[3]*x+a[7]*y+a[11]*z+a[15];return o; },
  scale(o,a,v){ const x=v[0],y=v[1],z=v[2];o[0]=a[0]*x;o[1]=a[1]*x;o[2]=a[2]*x;o[3]=a[3]*x;o[4]=a[4]*y;o[5]=a[5]*y;o[6]=a[6]*y;o[7]=a[7]*y;o[8]=a[8]*z;o[9]=a[9]*z;o[10]=a[10]*z;o[11]=a[11]*z;o[12]=a[12];o[13]=a[13];o[14]=a[14];o[15]=a[15];return o; },
  rotateY(o,a,r){ const s=Math.sin(r),c=Math.cos(r),a00=a[0],a01=a[1],a02=a[2],a03=a[3],a20=a[8],a21=a[9],a22=a[10],a23=a[11]; if(o!==a){o[4]=a[4];o[5]=a[5];o[6]=a[6];o[7]=a[7];o[12]=a[12];o[13]=a[13];o[14]=a[14];o[15]=a[15];} o[0]=a00*c-a20*s;o[1]=a01*c-a21*s;o[2]=a02*c-a22*s;o[3]=a03*c-a23*s;o[8]=a00*s+a20*c;o[9]=a01*s+a21*c;o[10]=a02*s+a22*c;o[11]=a03*s+a23*c;return o; },
  invert(o,a){
    const a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15];
    const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
    let det=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;if(!det)return null;det=1/det;
    o[0]=(a11*b11-a12*b10+a13*b09)*det;o[1]=(a02*b10-a01*b11-a03*b09)*det;o[2]=(a31*b05-a32*b04+a33*b03)*det;o[3]=(a22*b04-a21*b05-a23*b03)*det;
    o[4]=(a12*b08-a10*b11-a13*b07)*det;o[5]=(a00*b11-a02*b08+a03*b07)*det;o[6]=(a32*b02-a30*b05-a33*b01)*det;o[7]=(a20*b05-a22*b02+a23*b01)*det;
    o[8]=(a10*b10-a11*b08+a13*b06)*det;o[9]=(a01*b08-a00*b10-a03*b06)*det;o[10]=(a30*b04-a31*b02+a33*b00)*det;o[11]=(a21*b02-a20*b04-a23*b00)*det;
    o[12]=(a11*b07-a10*b09-a12*b06)*det;o[13]=(a00*b09-a01*b07+a02*b06)*det;o[14]=(a31*b01-a30*b03-a32*b00)*det;o[15]=(a20*b03-a21*b01+a22*b00)*det;return o;
  },
  transformPoint(m,x,y,z,w=1){ return [m[0]*x+m[4]*y+m[8]*z+m[12]*w,m[1]*x+m[5]*y+m[9]*z+m[13]*w,m[2]*x+m[6]*y+m[10]*z+m[14]*w,m[3]*x+m[7]*y+m[11]*z+m[15]*w]; }
};

function shader(type,src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)); return s; }
const program=gl.createProgram();
gl.attachShader(program,shader(gl.VERTEX_SHADER,`#version 300 es
precision highp float;layout(location=0)in vec3 aPos;layout(location=1)in vec3 aNormal;uniform mat4 uModel;uniform mat4 uViewProj;out vec3 vNormal;out vec3 vWorld;void main(){vec4 w=uModel*vec4(aPos,1.0);vWorld=w.xyz;vNormal=normalize(mat3(uModel)*aNormal);gl_Position=uViewProj*w;}`));
gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`#version 300 es
precision highp float;in vec3 vNormal;in vec3 vWorld;uniform vec4 uColor;uniform vec3 uLightDir;out vec4 outColor;void main(){float d=max(dot(normalize(vNormal),normalize(-uLightDir)),0.0);float hemi=.54+.22*normalize(vNormal).y;float light=hemi+d*.42;float fog=smoothstep(30.0,58.0,length(vWorld.xz));vec3 col=uColor.rgb*light;col=mix(col,vec3(.10,.17,.28),fog*.38);outColor=vec4(col,uColor.a);}`));
gl.linkProgram(program); if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
const loc={model:gl.getUniformLocation(program,'uModel'),vp:gl.getUniformLocation(program,'uViewProj'),color:gl.getUniformLocation(program,'uColor'),light:gl.getUniformLocation(program,'uLightDir')};

class Mesh{
  constructor(pos,nor,idx){this.count=idx.length;this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);const data=new Float32Array(pos.length+nor.length);for(let i=0,j=0;i<pos.length;i+=3){data[j++]=pos[i];data[j++]=pos[i+1];data[j++]=pos[i+2];data[j++]=nor[i];data[j++]=nor[i+1];data[j++]=nor[i+2];}gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);const eb=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,eb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(idx),gl.STATIC_DRAW);gl.bindVertexArray(null);}
  draw(){gl.bindVertexArray(this.vao);gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_SHORT,0);}
}
function cubeMesh(){const p=[],n=[],i=[];const faces=[[[0,0,1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],[[0,0,-1],[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],[[1,0,0],[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]],[[-1,0,0],[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]],[[0,1,0],[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]],[[0,-1,0],[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]];for(const f of faces){const b=p.length/3;for(let k=1;k<5;k++){p.push(...f[k]);n.push(...f[0]);}i.push(b,b+1,b+2,b,b+2,b+3);}return new Mesh(p,n,i);}
function sphereMesh(seg=14,rings=9){const p=[],n=[],i=[];for(let y=0;y<=rings;y++){const v=y/rings,phi=v*Math.PI;for(let x=0;x<=seg;x++){const u=x/seg,th=u*Math.PI*2;const sx=Math.sin(phi)*Math.cos(th),sy=Math.cos(phi),sz=Math.sin(phi)*Math.sin(th);p.push(sx,sy,sz);n.push(sx,sy,sz);}}for(let y=0;y<rings;y++)for(let x=0;x<seg;x++){const a=y*(seg+1)+x,b=a+seg+1;i.push(a,a+1,b,b,a+1,b+1);}return new Mesh(p,n,i);}
function cylinderMesh(seg=16){const p=[],n=[],i=[];for(let y=0;y<2;y++)for(let s=0;s<=seg;s++){const a=s/seg*Math.PI*2,x=Math.cos(a),z=Math.sin(a);p.push(x,y?1:-1,z);n.push(x,0,z);}for(let s=0;s<seg;s++){const a=s,b=s+1,c=(seg+1)+s,d=c+1;i.push(a,c,b,b,c,d);}let top=p.length/3;p.push(0,1,0);n.push(0,1,0);let bot=p.length/3;p.push(0,-1,0);n.push(0,-1,0);for(let s=0;s<seg;s++){const a=s+seg+1,b=a+1;i.push(top,b,a);i.push(bot,s,s+1);}return new Mesh(p,n,i);}
const mesh={cube:cubeMesh(),sphere:sphereMesh(earlyMobileHint?10:14,earlyMobileHint?7:9),cyl:cylinderMesh(earlyMobileHint?12:16)};
const model=M4.create(),view=M4.create(),proj=M4.create(),viewProj=M4.create(),invVP=M4.create();
function draw(m,x,y,z,sx,sy,sz,rot,color,alpha=1){M4.identity(model);M4.translate(model,model,[x,y,z]);if(rot)M4.rotateY(model,model,rot);M4.scale(model,model,[sx,sy,sz]);gl.uniformMatrix4fv(loc.model,false,model);gl.uniform4f(loc.color,color[0],color[1],color[2],alpha);m.draw();}

// ---------- Świat gry ----------
const ARENA=18;
const keys={}; let mouse={x:innerWidth/2,y:innerHeight/2,down:false,worldX:0,worldZ:-4};

// ---------- Telefon / tablet ----------
const deviceQuery=new URLSearchParams(location.search);
const forcedMobile=deviceQuery.get('mobile')==='1';
const forcedDesktop=deviceQuery.get('desktop')==='1';
const coarsePointer=matchMedia('(pointer: coarse)');
const isMobileDevice=!forcedDesktop&&(forcedMobile||((navigator.maxTouchPoints||0)>0&&coarsePointer.matches)||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
const mobileInput={moveX:0,moveZ:0,aimX:0,aimY:-1,movePointer:null,attackPointer:null};
let mobilePortraitBlocked=false;
let pendingMobileGameStart=null;
let fullscreenGateBusy=false;
let pendingMobileGateMode='game';
const settleWithin=(value,ms,fallback=false)=>Promise.race([Promise.resolve(value).catch(()=>fallback),new Promise(resolve=>setTimeout(()=>resolve(fallback),ms))]);
function resetMobileInput(){mobileInput.moveX=0;mobileInput.moveZ=0;mobileInput.movePointer=null;mobileInput.attackPointer=null;mouse.down=false;ui.mobileMoveKnob?.style.setProperty('transform','translate(-50%,-50%)');ui.mobileAttackKnob?.style.setProperty('transform','translate(-50%,-50%)');ui.mobileAttackStick?.classList.remove('firing');}
function setArenaVisualViewportVars(){
  const viewport=window.visualViewport;
  const height=Math.max(240,Math.round(viewport?.height||window.innerHeight||document.documentElement.clientHeight||0));
  const width=Math.max(320,Math.round(viewport?.width||window.innerWidth||document.documentElement.clientWidth||0));
  const left=Math.max(0,Math.round(viewport?.offsetLeft||0));
  const top=Math.max(0,Math.round(viewport?.offsetTop||0));
  document.documentElement.style.setProperty('--arena-visual-height',`${height}px`);
  document.documentElement.style.setProperty('--arena-visual-width',`${width}px`);
  document.documentElement.style.setProperty('--arena-visual-left',`${left}px`);
  document.documentElement.style.setProperty('--arena-visual-top',`${top}px`);
  return {width,height,left,top};
}
function refreshMobileViewportLayout(){
  if(!isMobileDevice)return;
  setArenaVisualViewportVars();
  const portrait=(window.visualViewport?.height||innerHeight)>(window.visualViewport?.width||innerWidth);
  mobilePortraitBlocked=portrait;
  document.body.classList.add('mobile-device');
  document.body.classList.toggle('mobile-portrait',portrait);
  if(portrait)resetMobileInput();
  try{resize();}catch(_){}
}
function waitForStableMobileViewport(maxWait=1300){
  if(!isMobileDevice)return Promise.resolve();
  return new Promise(resolve=>{
    const started=performance.now();
    let last='',stableCount=0;
    const check=()=>{
      const v=window.visualViewport;
      const state=[
        Math.round(v?.width||innerWidth||0),
        Math.round(v?.height||innerHeight||0),
        Math.round(v?.offsetLeft||0),
        Math.round(v?.offsetTop||0)
      ].join(':');
      if(state===last)stableCount++;else{last=state;stableCount=0;}
      refreshMobileViewportLayout();
      if(stableCount>=3||performance.now()-started>=maxWait){
        refreshMobileViewportLayout();
        resolve();
      }else setTimeout(check,70);
    };
    check();
  });
}

function scheduleMobileViewportRefresh(){
  if(!isMobileDevice)return;
  const burst=[0,40,120,260,520,900];
  burst.forEach(ms=>setTimeout(()=>refreshMobileViewportLayout(),ms));
  requestAnimationFrame(()=>refreshMobileViewportLayout());
  requestAnimationFrame(()=>requestAnimationFrame(()=>refreshMobileViewportLayout()));
}
function updateMobileOrientation(){
  if(!isMobileDevice)return;
  refreshMobileViewportLayout();
}
function mobileFullscreenActive(){return !!(document.fullscreenElement||document.webkitFullscreenElement);}
function fullscreenSupported(){
  const root=document.documentElement;
  return !!(root.requestFullscreen||root.webkitRequestFullscreen||root.msRequestFullscreen);
}
async function requestMobileFullscreen(){
  if(!isMobileDevice)return true;
  const root=document.documentElement;
  try{
    if(!mobileFullscreenActive()){
      const fn=root.requestFullscreen||root.webkitRequestFullscreen||root.msRequestFullscreen;
      if(!fn)return false;
      let request=null;
      try{request=fn.call(root,{navigationUI:'hide'});}catch(_){try{request=fn.call(root);}catch(__){request=null;}}
      if(request&&typeof request.then==='function')await settleWithin(request,850,false);
    }
  }catch(_){}
  const active=mobileFullscreenActive();
  document.body.classList.toggle('mobile-fullscreen',active);
  scheduleMobileViewportRefresh();
  return active;
}
async function requestLandscapeOrientation(fullscreen=false){
  if(!isMobileDevice)return true;
  let fullscreenResult=true;
  if(fullscreen)fullscreenResult=await settleWithin(requestMobileFullscreen(),1100,false);
  try{
    if(screen.orientation?.lock){
      const lock=screen.orientation.lock('landscape');
      if(lock&&typeof lock.then==='function')await settleWithin(lock,450,false);
    }
  }catch(_){}
  updateMobileOrientation();
  return fullscreenResult;
}
function hideMobileFullscreenGate(){
  ui.mobileFullscreenGate?.classList.remove('open');
  ui.mobileFullscreenGate?.setAttribute('aria-hidden','true');
}
function showMobileFullscreenGate(startCallback=null,mode='game'){
  pendingMobileGameStart=startCallback;
  pendingMobileGateMode=mode;
  if(ui.mobileFullscreenTitle)ui.mobileFullscreenTitle.textContent=mode==='lobby'?'Pełny ekran lobby':'Pełny ekran gry';
  if(ui.mobileFullscreenText)ui.mobileFullscreenText.textContent=mode==='lobby'?'Dotknij przycisku, aby ukryć pasek przeglądarki i korzystać z lobby na całym ekranie.':'Dotknij przycisku, aby ukryć pasek przeglądarki i uruchomić arenę na całym ekranie.';
  if(ui.mobileFullscreenStartBtn)ui.mobileFullscreenStartBtn.textContent=mode==='lobby'?'WEJDŹ DO LOBBY NA PEŁNYM EKRANIE':'URUCHOM GRĘ NA PEŁNYM EKRANIE';
  ui.mobileFullscreenGate?.classList.add('open');
  ui.mobileFullscreenGate?.setAttribute('aria-hidden','false');
}
async function continueFromMobileFullscreenGate(event){
  event?.preventDefault?.();
  event?.stopPropagation?.();
  if(fullscreenGateBusy)return;
  fullscreenGateBusy=true;
  const callback=pendingMobileGameStart;
  const mode=pendingMobileGateMode;
  pendingMobileGameStart=null;
  if(ui.mobileFullscreenStartBtn){
    ui.mobileFullscreenStartBtn.disabled=true;
    ui.mobileFullscreenStartBtn.textContent=mode==='lobby'?'DOPASOWYWANIE EKRANU…':'URUCHAMIANIE…';
  }
  try{
    const orientationTask=requestLandscapeOrientation(true);
    if(mode==='game'){
      hideMobileFullscreenGate();
      callback?.();
    }
    await settleWithin(orientationTask,1350,false);
    await waitForStableMobileViewport(1400);
    scheduleMobileViewportRefresh();
    if(mode==='lobby'){
      callback?.();
      hideMobileFullscreenGate();
    }
  }finally{
    hideMobileFullscreenGate();
    scheduleMobileViewportRefresh();
    fullscreenGateBusy=false;
    if(ui.mobileFullscreenStartBtn){
      ui.mobileFullscreenStartBtn.disabled=false;
      ui.mobileFullscreenStartBtn.textContent=mode==='game'?'URUCHOM GRĘ NA PEŁNYM EKRANIE':'WEJDŹ DO LOBBY NA PEŁNYM EKRANIE';
    }
  }
}

function setStickPosition(stick,knob,clientX,clientY){
  const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.34;
  let dx=clientX-cx,dy=clientY-cy,dist=Math.hypot(dx,dy);
  if(dist>max){dx=dx/dist*max;dy=dy/dist*max;dist=max;}
  knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
  const strength=Math.min(1,dist/max),dead=.10;
  if(strength<dead)return {x:0,y:0,strength:0};
  return {x:dx/max,y:dy/max,strength};
}
function updateMobileAimScreen(){
  if(!isMobileDevice)return;
  const reach=Math.max(130,Math.min(innerWidth*.34,innerHeight*.72));
  mouse.x=innerWidth/2+mobileInput.aimX*reach;
  mouse.y=innerHeight/2+mobileInput.aimY*reach;
}
function setupMobileControls(){
  if(!isMobileDevice)return;
  document.body.classList.add('mobile-device');
  const move=ui.mobileMoveStick,moveKnob=ui.mobileMoveKnob,attack=ui.mobileAttackStick,attackKnob=ui.mobileAttackKnob;
  const moveUpdate=e=>{if(e.pointerId!==mobileInput.movePointer)return;const v=setStickPosition(move,moveKnob,e.clientX,e.clientY);mobileInput.moveX=v.x;mobileInput.moveZ=v.y;e.preventDefault();};
  move?.addEventListener('pointerdown',e=>{if(mobileInput.movePointer!==null)return;mobileInput.movePointer=e.pointerId;move.setPointerCapture(e.pointerId);moveUpdate(e);e.preventDefault();});
  move?.addEventListener('pointermove',moveUpdate);
  const endMove=e=>{if(e.pointerId!==mobileInput.movePointer)return;mobileInput.movePointer=null;mobileInput.moveX=0;mobileInput.moveZ=0;moveKnob.style.transform='translate(-50%,-50%)';e.preventDefault();};
  move?.addEventListener('pointerup',endMove);move?.addEventListener('pointercancel',endMove);move?.addEventListener('lostpointercapture',endMove);

  const attackUpdate=e=>{if(e.pointerId!==mobileInput.attackPointer)return;const v=setStickPosition(attack,attackKnob,e.clientX,e.clientY);if(v.strength>.10){mobileInput.aimX=v.x;mobileInput.aimY=v.y;}mouse.down=true;updateMobileAimScreen();e.preventDefault();};
  attack?.addEventListener('pointerdown',e=>{if(mobileInput.attackPointer!==null)return;mobileInput.attackPointer=e.pointerId;attack.setPointerCapture(e.pointerId);attack.classList.add('firing');attackUpdate(e);playerShoot();e.preventDefault();});
  attack?.addEventListener('pointermove',attackUpdate);
  const endAttack=e=>{if(e.pointerId!==mobileInput.attackPointer)return;mobileInput.attackPointer=null;mouse.down=false;attack.classList.remove('firing');attackKnob.style.transform='translate(-50%,-50%)';e.preventDefault();};
  attack?.addEventListener('pointerup',endAttack);attack?.addEventListener('pointercancel',endAttack);attack?.addEventListener('lostpointercapture',endAttack);

  const mobilePowerPress=(button,action,vibration)=>{
    let last=0;
    const run=e=>{e?.preventDefault();e?.stopPropagation();const now=performance.now();if(now-last<220)return;last=now;action();updateUI();if(navigator.vibrate&&vibration)navigator.vibrate(vibration);};
    button?.addEventListener('pointerdown',run,{passive:false});
    button?.addEventListener('touchstart',run,{passive:false});
    button?.addEventListener('click',run);
  };
  mobilePowerPress(ui.mobileSuperBtn,superAttack,25);
  mobilePowerPress(ui.mobileHyperBtn,activateHyper,[25,25,25]);
  ui.rotateLockBtn?.addEventListener('click',()=>requestLandscapeOrientation(true));
  ui.lobbyFullscreenBtn?.addEventListener('click',async e=>{e.preventDefault();await requestLandscapeOrientation(true);hideMobileFullscreenGate();});
  ui.mobileFullscreenStartBtn?.addEventListener('click',continueFromMobileFullscreenGate,{passive:false});
  const fullscreenChanged=()=>{document.body.classList.toggle('mobile-fullscreen',mobileFullscreenActive());scheduleMobileViewportRefresh();};
  document.addEventListener('fullscreenchange',fullscreenChanged,{passive:true});
  document.addEventListener('webkitfullscreenchange',fullscreenChanged,{passive:true});
  addEventListener('resize',updateMobileOrientation,{passive:true});
  addEventListener('orientationchange',()=>setTimeout(updateMobileOrientation,120),{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)resetMobileInput();});
  document.addEventListener('touchmove',e=>{if(running&&!document.body.classList.contains('lobby-mode'))e.preventDefault();},{passive:false});
  updateMobileOrientation();
}
const BASE_HP=150,BASE_SPEED=8.2,BASE_FIRE_COOLDOWN=.19,MAG_SIZE=30,RELOAD_TIME=1.5,UPGRADE_COSTS=[100,200,400,800,1600];
const SUPER_CHARGE_MULTIPLIER=.4; // ładowanie jest o 60% wolniejsze
const HYPER_CHARGE_RATIO=3,HYPER_DURATION=9,HYPER_SPEED_MULT=1.05,HYPER_FIRE_MULT=1.04,HYPER_DAMAGE_MULT=.93;
const COSMIC_SKIN_COST=1250,VERSION_ONE_COST=150,VERSION_ONE_SPEED=1.03,VERSION_ONE_FIRE=1.02,VERSION_ONE_HP=1.10;
const SAVE_KEY='arenaStars3D_save_v3';
const PLAYER_ID_KEY='arenaStars3D_online_player_id_v1';
const NICKNAME_KEY='arenaStars3D_nickname_permanent_v1';
const LEGACY_SAVE_KEYS=['arenaStars3D_save_v3','arenaStars3D_save_v2','arenaStars3D_save_v1','arenaStars3D_save'];
function safePlayerName(value){const text=String(value||'Gracz').trim().replace(/[<>\r\n\t]/g,'').replace(/\s+/g,' ');return (text.slice(0,18)||'Gracz');}
function readNicknameCookie(){try{const item=document.cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith('arenaStars3D_nickname='));return item?safePlayerName(decodeURIComponent(item.slice(item.indexOf('=')+1))):'';}catch(_){return '';}}
function loadPermanentNickname(){
  try{
    const direct=safePlayerName(localStorage.getItem(NICKNAME_KEY)||'');
    if(direct&&direct!=='Gracz')return direct;
    const cookie=readNicknameCookie();if(cookie&&cookie!=='Gracz')return cookie;
    for(const key of LEGACY_SAVE_KEYS){try{const raw=localStorage.getItem(key);if(!raw)continue;const data=JSON.parse(raw);const name=safePlayerName(data?.name||'');if(name&&name!=='Gracz')return name;}catch(_){}}
  }catch(_){}
  return '';
}
function persistNickname(value){
  const name=safePlayerName(value),existing=loadPermanentNickname();
  if(name==='Gracz'&&existing&&existing!=='Gracz')return existing;
  try{localStorage.setItem(NICKNAME_KEY,name);}catch(_){}
  try{document.cookie=`arenaStars3D_nickname=${encodeURIComponent(name)}; Max-Age=157680000; Path=/; SameSite=Lax`;}catch(_){}
  return name;
}
function safeUpgradeLevel(value){return Math.max(0,Math.min(UPGRADE_COSTS.length,Math.floor(Number(value)||0)));}
function loadProgress(){
  try{
    const raw=localStorage.getItem(SAVE_KEY),data=raw?JSON.parse(raw):{},saved=data.upgrades||{},permanentName=loadPermanentNickname();
    const arenaOwned=data.ownedSkins?.arena_vip_plus===true||data.data?.arenaVipPlusSkinOwned===true;
    const ownedSkins={classic:true,cosmic:data.ownedSkins?.cosmic===true,arena_vip_plus:arenaOwned};
    const requestedSkin=['classic','cosmic','arena_vip_plus'].includes(data.skin)?data.skin:'classic';
    return {
      name:safePlayerName(permanentName||data.name),
      trophies:Math.max(0,Number(data.trophies)||0),
      points:Math.max(0,Number(data.points)||0),
      coins:Math.max(0,Number(data.coins)||0),
      skin:(requestedSkin==='cosmic'&&ownedSkins.cosmic)||(requestedSkin==='arena_vip_plus'&&ownedSkins.arena_vip_plus)?requestedSkin:'classic',
      ownedSkins,
      heroVersion1:data.heroVersion1===true,
      mode:typeof data.mode==='string'&&data.mode?data.mode:'solo',
      adminRevision:Math.max(0,Number(data.adminRevision)||0),
      revision:Math.max(0,Number(data.revision)||0),
      dataVersion:Math.max(1,Number(data.dataVersion)||1),
      data:data.data&&typeof data.data==='object'?data.data:{},
      upgrades:{move:safeUpgradeLevel(saved.move),fire:safeUpgradeLevel(saved.fire),hp:safeUpgradeLevel(saved.hp)}
    };
  }catch(_){return {name:'Gracz',trophies:0,points:0,coins:0,skin:'classic',ownedSkins:{classic:true,cosmic:false,arena_vip_plus:false},heroVersion1:false,mode:'solo',adminRevision:0,revision:0,dataVersion:1,data:{},upgrades:{move:0,fire:0,hp:0}};}
}
let profile=loadProgress();
profile.name=persistNickname(profile.name);
let profileDirty=false,profileSyncBusy=false,profileChangeSeq=0,lastConfigRevision=0,backgroundSyncBusy=false;
const CLIENT_VERSION='chat-render-fixed-v17';
function saveProgress(markDirty=true){try{profile.name=persistNickname(profile.name);localStorage.setItem(SAVE_KEY,JSON.stringify(profile));if(markDirty){profileDirty=true;profileChangeSeq++;}}catch(_){} }
function getPlayerId(){
  try{let id=localStorage.getItem(PLAYER_ID_KEY);if(!id){id=(crypto.randomUUID?crypto.randomUUID():`gracz-${Date.now()}-${Math.random().toString(16).slice(2)}`);localStorage.setItem(PLAYER_ID_KEY,id);}return id;}
  catch(_){return `gracz-${Date.now()}-${Math.random().toString(16).slice(2)}`;}
}
let playerId=getPlayerId();
window.__arenaPlayerId=playerId;
let ownerFreeShop=false;
function shopCost(value){return ownerFreeShop?0:Math.max(0,Number(value)||0);}

const DEFAULT_CLIENT_CONFIG={survivalBotLevel:5,duelBotLevel:5,duelBotWaitSeconds:30,duelHpMultiplier:3.5,duelMaxRounds:3,duelWinsToTakeMatch:2,duelWinCoins:25,duelWinTrophies:10,duelWinPoints:2000,duelDrawCoins:5,duelDrawTrophies:4,duelDrawPoints:500,soloEnabled:true,duelEnabled:true,announcement:'',profanityBanMinutes:120,banEscalationMultiplier:1.5,sqlSyncSeconds:2.5,customModes:[]};
let gameConfig={...DEFAULT_CLIENT_CONFIG};
function modeDefinition(id){if(id==='solo')return {id:'solo',name:'PRZETRWANIE',base:'solo',enabled:gameConfig.soloEnabled!==false};if(id==='duel')return {id:'duel',name:'POJEDYNKI',base:'duel',enabled:gameConfig.duelEnabled!==false};return (gameConfig.customModes||[]).find(m=>m.id===id&&m.enabled!==false)||null;}
function selectedModeBase(){return modeDefinition(selectedMode)?.base||'solo';}
function renderCustomModes(){
  if(!ui.modeMenu)return;ui.modeMenu.querySelectorAll('[data-custom-mode]').forEach(el=>el.remove());
  if(ui.soloModeOption)ui.soloModeOption.style.display=gameConfig.soloEnabled===false?'none':'';
  if(ui.duelModeOption)ui.duelModeOption.style.display=gameConfig.duelEnabled===false?'none':'';
  for(const mode of gameConfig.customModes||[]){if(mode.enabled===false)continue;const b=document.createElement('button');b.className='modeOption';b.dataset.customMode=mode.id;b.innerHTML=`<span class="modeIcon">${mode.base==='duel'?'⚔️':'🤖'}</span><span><span class="modeName">${escapeRankingName(mode.name)}</span><span class="modeDesc">${escapeRankingName(mode.description||'Tryb administratora')}</span></span>`;b.addEventListener('click',()=>{selectedMode=mode.id;profile.mode=mode.id;saveProgress();updateModeUI();toggleModeMenu(false);});ui.modeMenu.appendChild(b);}
  const def=modeDefinition(selectedMode);if(!def||def.enabled===false){selectedMode=gameConfig.soloEnabled!==false?'solo':'duel';profile.mode=selectedMode;saveProgress();}
}
function applyGameConfig(config){gameConfig={...DEFAULT_CLIENT_CONFIG,...(config||{})};gameConfig.customModes=Array.isArray(gameConfig.customModes)?gameConfig.customModes:[];renderCustomModes();updateModeUI();const note=document.querySelector('.saveNote');if(note&&gameConfig.announcement)note.textContent=gameConfig.announcement;if(sqlSyncStarted)scheduleSqlSync(false);}
async function fetchGameConfig(){try{const data=await api('/api/config');if(data.config)applyGameConfig(data.config);if(Number(data.configRevision)>=0)lastConfigRevision=Number(data.configRevision)||lastConfigRevision;}catch(_){}}

let rankingRows=[],rankingCenterOnNextRender=true,onlineConnected=false,onlineCount=0,rankingBusy=false,myRankingPosition=null,totalPlayers=0,rankingFailures=0;
function isLobbyVisible(){return document.body.classList.contains('lobby-mode')&&ui.lobbyView&&ui.lobbyView.style.display!=='none';}
function escapeRankingName(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function setOnlineStatus(text,state=''){
  if(ui.onlineStatus){ui.onlineStatus.textContent=text;ui.onlineStatus.classList.toggle('ok',state==='ok');ui.onlineStatus.classList.toggle('bad',state==='bad');}
  if(ui.rankingLive)ui.rankingLive.textContent=state==='ok'?`${onlineCount} ONLINE`:(state==='bad'?'OFFLINE':'ŁĄCZENIE...');
  if(ui.onlineHudCount)ui.onlineHudCount.textContent=onlineCount;
  // Mecz jest solo, więc chwilowa awaria rankingu nie może blokować przycisku Graj.
  if(ui.playBtn)ui.playBtn.disabled=false;
  if(ui.retryBtn)ui.retryBtn.disabled=false;
}
async function api(path,options={}){
  const controller=new AbortController();
  const {timeoutMs=10000,...fetchOptions}=options;
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(path,{cache:'no-store',headers:{'Content-Type':'application/json',...(fetchOptions.headers||{})},signal:controller.signal,...fetchOptions});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(data.error||`HTTP ${response.status}`);error.status=response.status;error.data=data;if(response.status===423&&typeof showAccountBan==='function')showAccountBan(data);throw error;}
    return data;
  }finally{clearTimeout(timeout);}
}
function renderRanking(){
  if(!ui.rankingBody)return;
  const rows=Array.isArray(rankingRows)?rankingRows.slice(0,200):[];
  if(ui.rankingPosition)ui.rankingPosition.textContent=myRankingPosition?`#${myRankingPosition.toLocaleString('pl-PL')}`:'—';
  if(ui.rankingTotal)ui.rankingTotal.textContent=`Wszystkich graczy: ${Math.max(0,totalPlayers).toLocaleString('pl-PL')}`;
  if(!rows.length){ui.rankingBody.innerHTML='<div class="rankingEmpty">Brak zapisanych graczy.<br>Pierwszy profil pojawi się po połączeniu z serwerem.</div>';return;}
  ui.rankingBody.innerHTML=rows.map((r,i)=>`<div class="rankingRow${r.id===playerId?' playerRow':''}" data-rank="${i+1}"><span class="rankingPlace">#${i+1}</span><span class="rankingName">${escapeRankingName(r.id===playerId?`${r.name} (TY)`:r.name)}</span><span class="rankingPoints">${Math.max(0,Math.floor(r.points||0)).toLocaleString('pl-PL')} ⭐</span></div>`).join('');
  const playerRow=ui.rankingBody.querySelector('.playerRow');
  if(playerRow&&isLobbyVisible()&&rankingCenterOnNextRender){playerRow.scrollIntoView({block:'center'});rankingCenterOnNextRender=false;}
}

function handleRankingFailure(){
  rankingFailures++;
  if(rankingFailures<3){
    setOnlineStatus('Ponowne łączenie z rankingiem…','');
    return;
  }
  onlineConnected=false;
  onlineCount=0;
  setOnlineStatus('Ranking chwilowo niedostępny — gra działa solo','bad');
}

async function syncProfile(force=true){
  if(profileSyncBusy||(!force&&!profileDirty))return;
  profileSyncBusy=true;
  const sentSeq=profileChangeSeq;
  try{
    const data=await api('/api/profile',{method:'POST',body:JSON.stringify({playerId,name:profile.name,points:profile.points,trophies:profile.trophies,coins:profile.coins,upgrades:profile.upgrades,skin:profile.skin,cosmicOwned:profile.ownedSkins?.cosmic===true,heroVersion1:profile.heroVersion1===true,adminRevision:profile.adminRevision||0,revision:profile.revision||0,dataVersion:profile.dataVersion||1,data:{...(profile.data||{}),mode:profile.mode},clientVersion:CLIENT_VERSION})});
    if(data.profile){
      const remote=data.profile,forced=Number(remote.adminRevision||0)>Number(profile.adminRevision||0);
      profile.name=persistNickname(remote.name||profile.name);
      if(forced){profile.points=Number(remote.points)||0;profile.trophies=Number(remote.trophies)||0;profile.coins=Number(remote.coins)||0;profile.upgrades={move:safeUpgradeLevel(remote.upgrades?.move),fire:safeUpgradeLevel(remote.upgrades?.fire),hp:safeUpgradeLevel(remote.upgrades?.hp)};const arenaOwned=ownerFreeShop||remote.arenaSkinOwned===true||remote.data?.arenaVipPlusSkinOwned===true;profile.ownedSkins={classic:true,cosmic:remote.cosmicOwned===true,arena_vip_plus:arenaOwned};profile.heroVersion1=remote.heroVersion1===true;profile.skin=remote.skin==='arena_vip_plus'&&arenaOwned?'arena_vip_plus':(remote.skin==='cosmic'&&profile.ownedSkins.cosmic?'cosmic':'classic');}
      else{profile.points=Math.max(profile.points,Number(remote.points)||0);profile.trophies=Math.max(profile.trophies,Number(remote.trophies)||0);profile.coins=Math.max(profile.coins,Number(remote.coins)||0);}
      profile.adminRevision=Math.max(Number(profile.adminRevision)||0,Number(remote.adminRevision)||0);profile.revision=Math.max(Number(profile.revision)||0,Number(remote.revision)||0);profile.dataVersion=Math.max(Number(profile.dataVersion)||1,Number(remote.dataVersion)||1);profile.data={...(profile.data||{}),...(remote.data||{})};if(remote.data?.mode)profile.mode=remote.data.mode;walletCoins=profile.coins;saveProgress(false);updateLobby();
    }
    if(sentSeq===profileChangeSeq)profileDirty=false;
    rankingRows=Array.isArray(data.players)?data.players:rankingRows;myRankingPosition=Number(data.position)||null;totalPlayers=Math.max(0,Number(data.totalPlayers)||0);rankingFailures=0;onlineConnected=true;onlineCount=Math.max(1,Number(data.online)||1);setOnlineStatus(`Połączono jako ${profile.name}`,'ok');renderRanking();
  }catch(_){handleRankingFailure();}
  finally{profileSyncBusy=false;}
}
async function backgroundDataSync(){
  if(backgroundSyncBusy||!authFinished||document.hidden)return;
  backgroundSyncBusy=true;
  try{
    if(profileDirty){await syncProfile(false);return;}
    const data=await api(`/api/sync?profileRevision=${encodeURIComponent(profile.revision||0)}&configRevision=${encodeURIComponent(lastConfigRevision||0)}`,{timeoutMs:8000});
    if(data.profile&&Number(data.profile.revision||0)>Number(profile.revision||0)){applyServerProfile(data.profile);updateLobby();}
    if(data.config){applyGameConfig(data.config);lastConfigRevision=Number(data.configRevision)||lastConfigRevision;}
    if(Number(data.online)>=0){onlineCount=Number(data.online)||0;setOnlineStatus(`Połączono jako ${profile.name}`,'ok');}
    return true;
  }catch(_){/* synchronizacja w tle spróbuje ponownie; gra lokalna nie jest blokowana */return false;}
  finally{backgroundSyncBusy=false;}
}
async function fetchRanking(){
  if(rankingBusy)return;rankingBusy=true;
  try{
    const data=await api(`/api/leaderboard?playerId=${encodeURIComponent(playerId)}`);
    rankingRows=Array.isArray(data.players)?data.players:[];
    myRankingPosition=Number(data.position)||null;
    totalPlayers=Math.max(0,Number(data.totalPlayers)||0);
    rankingFailures=0;onlineConnected=true;onlineCount=Math.max(0,Number(data.online)||0);setOnlineStatus(`Połączono jako ${profile.name} • mecze solo`,'ok');renderRanking();
  }
  catch(_){handleRankingFailure();}
  finally{rankingBusy=false;}
}
function saveOnlineName(){
  if(currentAccount){if(ui.nicknameInput)ui.nicknameInput.value=currentAccount.username;return;}
  if(!ui.nicknameInput)return;profile.name=persistNickname(ui.nicknameInput.value);ui.nicknameInput.value=profile.name;saveProgress();rankingCenterOnNextRender=true;syncProfile().then(fetchRanking);
}
setInterval(()=>{if(!document.hidden&&isLobbyVisible())fetchRanking();},5000);
let sqlSyncTimer=0,sqlSyncFailures=0,sqlSyncStarted=false;
function sqlSyncBaseMs(){return Math.max(1000,Math.min(60000,(Number(gameConfig.sqlSyncSeconds)||2.5)*1000));}
function scheduleSqlSync(immediate=false){
  clearTimeout(sqlSyncTimer);sqlSyncStarted=true;
  const gameplaySlowdown=(duelActive||running)?1.8:1;
  const failureSlowdown=Math.min(5,1+sqlSyncFailures*0.75);
  const delay=immediate?80:Math.round(sqlSyncBaseMs()*gameplaySlowdown*failureSlowdown);
  sqlSyncTimer=setTimeout(async()=>{let ok=false;try{ok=(await backgroundDataSync())!==false;}catch(_){ok=false;}sqlSyncFailures=ok?0:Math.min(6,sqlSyncFailures+1);scheduleSqlSync(false);},delay);
}
addEventListener('online',()=>{sqlSyncFailures=0;scheduleSqlSync(true);syncProfile(false);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleSqlSync(true);});

function updateModeUI(){
  if(!ui.modeBtn)return;const def=modeDefinition(selectedMode);const solo=selectedMode==='solo',duel=selectedMode==='duel';ui.modeBtn.textContent=def?`${def.name} ${def.base==='duel'?'⚔':'🤖'}`:'TRYBY ▾';ui.modeBtn.classList.toggle('selected',!!def);ui.soloModeOption?.classList.toggle('selected',solo);ui.duelModeOption?.classList.toggle('selected',duel);ui.modeMenu?.querySelectorAll('[data-custom-mode]').forEach(el=>el.classList.toggle('selected',el.dataset.customMode===selectedMode));
}
function toggleModeMenu(force){
  if(!ui.modeMenu)return;
  const open=typeof force==='boolean'?force:!ui.modeMenu.classList.contains('open');
  ui.modeMenu.classList.toggle('open',open);
}
function chooseSoloMode(){
  selectedMode='solo';profile.mode='solo';saveProgress();updateModeUI();toggleModeMenu(false);
}
function chooseDuelMode(){
  selectedMode='duel';profile.mode='duel';saveProgress();updateModeUI();toggleModeMenu(false);
}

// W pojedynku obaj gracze korzystają z jednego, wspólnego układu świata.
// Kąt 0 wskazuje +Z, a kamera obu osób patrzy zawsze w kierunku -Z.
function normalizeDuelAngle(value){
  const a=Number(value);
  if(!Number.isFinite(a))return 0;
  return Math.atan2(Math.sin(a),Math.cos(a));
}
function duelAngleDelta(from,to){return Math.atan2(Math.sin(to-from),Math.cos(to-from));}
function smoothDuelAngle(from,to,t){return normalizeDuelAngle(from+duelAngleDelta(from,to)*t);}

function duelPlayerSettings(){
  const versionOwned=profile.heroVersion1===true;
  const maxHp=Math.round((BASE_HP+20*(profile.upgrades.hp||0))*(versionOwned?VERSION_ONE_HP:1));
  const speed=BASE_SPEED*Math.pow(1.10,profile.upgrades.move||0)*(versionOwned?VERSION_ONE_SPEED:1);
  const fireCooldown=BASE_FIRE_COOLDOWN/(Math.pow(1.07,profile.upgrades.fire||0)*(versionOwned?VERSION_ONE_FIRE:1));
  return {playerId,name:profile.name,skin:profile.skin,maxHp,speed,fireCooldown};
}
function duelModeLabel(){return duelLocalBotMode?'Pojedynek z botem':'Pojedynek 1v1';}
function updateDuelRoundHud(){
  if(ui.hudModeText)ui.hudModeText.textContent=`${duelModeLabel()} • RUNDA ${duelRound}/${Number(gameConfig.duelMaxRounds)||3} • ${duelYourWins}:${duelOpponentWins}${duelRoundDraws?` • REMISY ${duelRoundDraws}`:''}`;
}
function setDuelQueueText(text){if(ui.duelQueueText)ui.duelQueueText.textContent=text;}
function clearDuelTimers(){
  clearTimeout(duelJoinTimer);duelJoinTimer=0;
  clearInterval(duelNetworkTimer);duelNetworkTimer=0;
  duelNetworkBusy=false;
}
function stopDuelSession(notify=true){
  const oldMatch=duelMatchId;
  clearDuelTimers();
  duelSearching=false;duelActive=false;duelEnded=false;duelMatchId='';duelOpponent=null;duelServerBullets=[];duelPredictedBullets=[];duelShotQueue=[];duelVisualHitSeqs.clear();duelMatchStatus='';duelStartIn=0;duelStartDeadline=0;duelNetworkFailures=0;duelFrameSeq=0;duelLocalBotMode=false;duelBotBullets=[];duelBotTurnTimer=0;duelBotShotTimer=.8;duelBotStrafe=1;duelBotStuck=0;duelBotReveal=0;duelRound=1;duelYourWins=0;duelOpponentWins=0;duelRoundDraws=0;duelRoundEventSeq=0;duelRoundResolving=false;duelMirrorView=false;duelShotFlushBusy=false;clearTimeout(duelShotFlushTimer);duelShotFlushTimer=0;
  document.body.classList.remove('duel-mode');
  if(location.hash==='#pojedynki')history.replaceState(null,'',location.pathname+location.search);
  if(notify&&(oldMatch||playerId)){
    const body=JSON.stringify({playerId,matchId:oldMatch});
    if(navigator.sendBeacon){try{navigator.sendBeacon('/api/duel/leave',new Blob([body],{type:'application/json'}));}catch(_){}}
    else api('/api/duel/leave',{method:'POST',body}).catch(()=>{});
  }
}
async function requestDuelJoin(){
  if(!duelSearching)return;
  try{
    const data=await api('/api/duel/join',{method:'POST',body:JSON.stringify(duelPlayerSettings())});
    duelNetworkFailures=0;
    if(!duelSearching)return;
    if(data.status==='waiting'){
      const left=Math.max(0,Math.ceil(Number(data.waitRemaining??30)));setDuelQueueText(`Szukam prawdziwego gracza online… ${left} s. Jeśli nikt nie dołączy, rozpoczniesz pojedynek z botem.`);
      duelJoinTimer=setTimeout(requestDuelJoin,900);
      return;
    }
    if(data.matchId){beginDuelMatch(data);return;}
    throw new Error('Nieprawidłowa odpowiedź serwera');
  }catch(_){
    duelNetworkFailures++;
    setDuelQueueText(duelNetworkFailures<3?'Ponowne łączenie z serwerem pojedynków…':'Serwer pojedynków chwilowo nie odpowiada. Próba ponownie za chwilę.');
    duelJoinTimer=setTimeout(requestDuelJoin,1800);
  }
}
function startDuelQueue(){
  if(duelSearching||duelActive)return;
  chooseDuelMode();
  if(running&&!duelActive)commitRun();
  reset();running=false;duelSearching=true;duelEnded=false;duelNetworkFailures=0;duelMatchId='';duelOpponent=null;duelServerBullets=[];duelPredictedBullets=[];duelShotQueue=[];duelVisualHitSeqs.clear();duelLocalShotSeq=0;duelFrameSeq=0;duelStartDeadline=0;duelLocalBotMode=false;duelBotBullets=[];duelBotTurnTimer=0;duelBotShotTimer=.8;duelBotStrafe=Math.random()<.5?-1:1;duelBotStuck=0;duelBotReveal=0;duelRound=1;duelYourWins=0;duelOpponentWins=0;duelRoundDraws=0;duelRoundEventSeq=0;duelRoundResolving=false;duelMirrorView=false;duelShotFlushBusy=false;clearTimeout(duelShotFlushTimer);duelShotFlushTimer=0;
  document.body.classList.add('lobby-mode');document.body.classList.remove('duel-mode');
  ui.lobbyView.style.display='none';ui.gameOverView.style.display='none';ui.duelQueueView.style.display='grid';ui.overlay.style.display='block';
  setDuelQueueText('Łączenie z kolejką pojedynków 1v1…');
  requestDuelJoin();
}
function cancelDuelQueue(){
  stopDuelSession(true);showLobby(false);
}
function beginDuelMatch(data){
  clearTimeout(duelJoinTimer);duelJoinTimer=0;duelSearching=false;duelActive=true;duelEnded=false;duelMatchId=data.matchId;duelNetworkFailures=0;
  reset();running=true;document.body.classList.add('arena-playing');document.body.classList.remove('lobby-mode');document.body.classList.add('duel-mode');
  ui.duelQueueView.style.display='none';ui.lobbyView.style.display='block';ui.gameOverView.style.display='none';ui.overlay.style.display='none';
  if(ui.hudModeText)ui.hudModeText.textContent='Pojedynek 1v1';
  history.replaceState(null,'','#pojedynki');
  processDuelState(data,true);last=performance.now();
  // HTTP/1.1 utrzymuje połączenie, a 70 ms daje płynniejszy ruch bez zalewania serwera.
  clearInterval(duelNetworkTimer);if(!duelLocalBotMode)duelNetworkTimer=setInterval(sendDuelFrame,85);
}
function processDuelState(data,initial=false){
  if(!data||data.matchId!==duelMatchId)return;
  const receivedAt=performance.now(),sampleDt=Math.max(.04,Math.min(.5,(receivedAt-duelLastStateAt)/1000));duelLastStateAt=receivedAt;
  const incomingStatus=data.status||duelMatchStatus;
  const incomingStart=Math.max(0,Number(data.startIn)||0);
  if(incomingStatus==='countdown'){
    const proposedDeadline=receivedAt+incomingStart*1000;
    if(!duelStartDeadline||initial||Math.abs(proposedDeadline-duelStartDeadline)>650)duelStartDeadline=proposedDeadline;
    duelStartIn=Math.max(0,(duelStartDeadline-receivedAt)/1000);
  }else{
    duelStartDeadline=0;duelStartIn=0;
  }
  duelMatchStatus=incomingStatus;
  const nextRound=Math.max(1,Math.min(3,Number(data.round)||duelRound||1));
  const nextEventSeq=Math.max(0,Number(data.roundEventSeq)||0);
  const roundChanged=nextRound!==duelRound||nextEventSeq>duelRoundEventSeq;
  duelRound=nextRound;duelYourWins=Math.max(0,Number(data.yourWins)||0);duelOpponentWins=Math.max(0,Number(data.opponentWins)||0);duelRoundDraws=Math.max(0,Number(data.roundDraws)||0);
  if(roundChanged){
    duelServerBullets=[];duelPredictedBullets=[];duelBotBullets=[];duelShotQueue=[];duelVisualHitSeqs.clear();
    if(player){player.ammo=MAG_SIZE;player.reload=0;player.fire=0;}
    if(nextEventSeq>duelRoundEventSeq){
      if(data.roundResult==='draw')showMessage('REMIS RUNDY!');
      else if(data.roundResult===playerId)showMessage('WYGRYWASZ RUNDĘ!');
      else if(data.roundResult)showMessage('PRZECIWNIK WYGRYWA RUNDĘ');
    }
  }
  duelRoundEventSeq=nextEventSeq;
  const ackShotSeq=Math.max(0,Number(data.ackShotSeq)||0);
  if(ackShotSeq>0)duelShotQueue=duelShotQueue.filter(shot=>shot.seq>ackShotSeq);
  const previousBullets=new Map(duelServerBullets.map(b=>[b.id,b]));
  const predictedBySeq=new Map(duelPredictedBullets.map(b=>[b.clientSeq,b]));
  const incomingBullets=Array.isArray(data.bullets)?data.bullets:[];
  const activeOwnSeqs=new Set(incomingBullets.filter(b=>b.ownerId===playerId&&Number(b.clientSeq)>0).map(b=>Number(b.clientSeq)));
  duelServerBullets=incomingBullets.filter(b=>!(b.ownerId===playerId&&duelVisualHitSeqs.has(Number(b.clientSeq)))).map(b=>{
    const old=previousBullets.get(b.id),pred=predictedBySeq.get(Number(b.clientSeq)),x=Number(b.x)||0,z=Number(b.z)||0;
    return {...b,targetX:x,targetZ:z,renderX:old?.renderX??pred?.x??x,renderZ:old?.renderZ??pred?.z??z,vx:Number(b.vx)||0,vz:Number(b.vz)||0,sampleAt:receivedAt};
  });
  duelPredictedBullets=duelPredictedBullets.filter(b=>{
    if(activeOwnSeqs.has(b.clientSeq))return false;
    if(b.clientSeq<=ackShotSeq&&receivedAt-b.createdAt>260)return false;
    return true;
  });
  const list=Array.isArray(data.players)?data.players:[],me=list.find(p=>p.id===playerId),other=list.find(p=>p.id!==playerId);
  if(initial&&other?.isBot){duelLocalBotMode=true;duelServerBullets=[];duelBotBullets=[];duelBotTurnTimer=.45;duelBotShotTimer=.75;duelBotStrafe=Math.random()<.5?-1:1;duelBotStuck=0;duelBotReveal=0;}
  if(me&&player){
    if(initial)duelMirrorView=Number(me.z)<0;
    const sx=Number(me.x),sz=Number(me.z),err=Number.isFinite(sx)&&Number.isFinite(sz)?Math.hypot(sx-player.x,sz-player.z):0;
    // Pozycja lokalnego gracza jest przewidywana natychmiast w przeglądarce.
    // Serwer poprawia ją tylko przy dużym, rzeczywistym rozjechaniu, zamiast
    // ciągle ciągnąć postać do starej pozycji z poprzedniej odpowiedzi HTTP.
    if(initial||err>6.0){
      player.x=Number.isFinite(sx)?sx:0;player.z=Number.isFinite(sz)?sz:0;resolveDuelEntity(player);
    }else if(err>2.75){
      const correction=Math.min(.22,.10+(err-2.75)*.035);
      player.x+=(sx-player.x)*correction;player.z+=(sz-player.z)*correction;resolveDuelEntity(player);
    }
    player.netX=player.x;player.netZ=player.z;
    const serverAngle=normalizeDuelAngle(me.angle);
    if(initial||Math.abs(duelAngleDelta(player.angle,serverAngle))>2.6)player.angle=serverAngle;
    player.hp=Math.max(0,Number(me.hp)||0);player.maxHp=Math.max(1,Number(me.maxHp)||player.maxHp);player.inBush=!!me.inBush;
  }
  if(other){
    const hidden=duelLocalBotMode?false:other.hidden===true;
    if(!duelOpponent||duelOpponent.id!==other.id){
      const tx=Number(other.x)||0,tz=Number(other.z)||0,ta=normalizeDuelAngle(other.angle);
      duelOpponent={...other,hidden,renderX:tx,renderZ:tz,renderAngle:ta,targetX:tx,targetZ:tz,targetAngle:ta,vx:Number(other.vx)||0,vz:Number(other.vz)||0,sampleAt:receivedAt};
    }else if(duelLocalBotMode){
      duelOpponent.name=other.name||duelOpponent.name;duelOpponent.skin=other.skin||duelOpponent.skin;duelOpponent.isBot=true;duelOpponent.hidden=false;
    }else if(hidden){
      Object.assign(duelOpponent,{id:other.id,name:other.name,skin:other.skin,hp:other.hp,maxHp:other.maxHp,isBot:other.isBot,hidden:true,inBush:true,sampleAt:receivedAt});
    }else{
      const targetX=Number(other.x)||0,targetZ=Number(other.z)||0,targetAngle=normalizeDuelAngle(other.angle);
      Object.assign(duelOpponent,other,{hidden:false,targetX,targetZ,targetAngle,vx:Number(other.vx)||((targetX-duelOpponent.targetX)/sampleDt),vz:Number(other.vz)||((targetZ-duelOpponent.targetZ)/sampleDt),sampleAt:receivedAt});
      if(Math.hypot(targetX-duelOpponent.renderX,targetZ-duelOpponent.renderZ)>5){duelOpponent.renderX=targetX;duelOpponent.renderZ=targetZ;duelOpponent.renderAngle=targetAngle;}
    }
  }else duelOpponent=null;
  if(duelLocalBotMode&&duelOpponent&&player){
    Object.assign(duelOpponent,{skin:profile.skin,speed:player.speed,fireCooldown:player.fireCooldown,ammo:Number.isFinite(duelOpponent.ammo)?duelOpponent.ammo:MAG_SIZE,reload:Number.isFinite(duelOpponent.reload)?duelOpponent.reload:0,fire:Number.isFinite(duelOpponent.fire)?duelOpponent.fire:0,super:Number.isFinite(duelOpponent.super)?duelOpponent.super:0,hyper:Number.isFinite(duelOpponent.hyper)?duelOpponent.hyper:0,hyperActive:Number.isFinite(duelOpponent.hyperActive)?duelOpponent.hyperActive:0});
  }
  updateDuelRoundHud();
  if(ui.duelOpponentName)ui.duelOpponentName.textContent=other?(other.hidden?'PRZECIWNIK W KRZAKACH':`${other.name.toUpperCase()}${other.isBot?' • BOT':''}`):'OCZEKIWANIE NA PRZECIWNIKA';
  if(ui.duelOpponentHp)ui.duelOpponentHp.textContent=other?`${Math.max(0,other.hp)} / ${other.maxHp} HP`:'—';
  updateUI();
  if(data.status==='finished'&&!duelLocalBotMode)finishDuel(data);
}
async function sendDuelFrame(){
  if(!duelActive||!duelMatchId||!player||duelNetworkBusy)return;
  duelNetworkBusy=true;const sentAt=performance.now(),seq=++duelFrameSeq;
  const pendingShots=duelShotQueue.slice(0,4).map(shot=>({seq:shot.seq,angle:shot.angle,clientTime:shot.clientTime}));
  try{
    const data=await api('/api/duel/action',{method:'POST',timeoutMs:2500,body:JSON.stringify({matchId:duelMatchId,playerId,x:player.x,z:player.z,angle:normalizeDuelAngle(player.angle),shots:pendingShots,seq})});
    const rtt=performance.now()-sentAt;duelRtt=duelRtt?duelRtt*.82+rtt*.18:rtt;
    duelNetworkFailures=0;processDuelState(data,false);
  }catch(_){
    duelNetworkFailures++;
    if(duelNetworkFailures===3)showMessage('PONOWNE ŁĄCZENIE…');
    if(duelNetworkFailures>18&&!duelEnded){finishDuel({winnerId:null,reason:'Utracono połączenie z serwerem pojedynku.'});}
  }finally{duelNetworkBusy=false;}
}

function scheduleDuelShotFlush(delay=0){
  if(duelLocalBotMode||!duelActive||!duelMatchId)return;
  clearTimeout(duelShotFlushTimer);
  duelShotFlushTimer=setTimeout(flushDuelShots,delay);
}
async function flushDuelShots(){
  duelShotFlushTimer=0;
  if(duelShotFlushBusy||duelLocalBotMode||!duelActive||!duelMatchId||!duelShotQueue.length)return;
  duelShotFlushBusy=true;
  const batch=duelShotQueue.slice(0,6).map(shot=>({seq:shot.seq,angle:shot.angle,clientTime:shot.clientTime}));
  try{
    const data=await api('/api/duel/shoot',{method:'POST',timeoutMs:1800,body:JSON.stringify({matchId:duelMatchId,playerId,shots:batch})});
    const ack=Math.max(0,Number(data.ackShotSeq)||0);
    if(ack>0)duelShotQueue=duelShotQueue.filter(shot=>shot.seq>ack);
  }catch(_){
    // Ruch nadal działa; strzały zostają w kolejce i zostaną wysłane ponownie.
  }finally{
    duelShotFlushBusy=false;
    if(duelShotQueue.length)scheduleDuelShotFlush(18);
  }
}
function duelChargeEntity(entity,baseAmount){
  if(!entity)return;
  const amount=Math.max(0,Number(baseAmount)||0)*SUPER_CHARGE_MULTIPLIER;
  entity.super=Math.min(100,Math.max(0,Number(entity.super)||0)+amount);
  if((entity.hyperActive||0)<=0)entity.hyper=Math.min(100,Math.max(0,Number(entity.hyper)||0)+amount/HYPER_CHARGE_RATIO);
  if(entity===player)updateUI();
}
function duelBulletColor(entity,isBot=false){
  if((entity?.hyperActive||0)>0)return [.35,1,.92];
  if(entity?.skin==='cosmic')return [.78,.38,1];
  return isBot?[1,.25,.48]:[.24,.85,1];
}
function duelPlayerShoot(){
  if(!duelActive||duelMatchStatus!=='playing'||!player||player.fire>0||player.reload>0)return;
  if(player.ammo<=0){startReload();return;}
  const hyper=(player.hyperActive||0)>0;
  player.fire=player.fireCooldown/(hyper?HYPER_FIRE_MULT:1);player.ammo--;
  const a=normalizeDuelAngle(player.angle),clientSeq=++duelLocalShotSeq,createdAt=performance.now(),clientTime=Date.now();
  if(!duelLocalBotMode){duelShotQueue.push({seq:clientSeq,angle:a,createdAt,clientTime});scheduleDuelShotFlush(0);}
  duelPredictedBullets.push({clientSeq,createdAt,x:player.x+Math.sin(a)*1.05,z:player.z+Math.cos(a)*1.05,vx:Math.sin(a)*18,vz:Math.cos(a)*18,life:2.4,damage:22,color:duelBulletColor(player,false),owner:'player'});
  burst(player.x+Math.sin(player.angle),player.z+Math.cos(player.angle),duelBulletColor(player,false),5,2.7);
  if(player.ammo<=0)startReload();else updateUI();
}
function localBotDamagePlayer(amount){
  if(!duelActive||duelEnded||!player)return;
  if((player.hyperActive||0)>0)amount*=HYPER_DAMAGE_MULT;
  player.hp=Math.max(0,player.hp-amount);shake=Math.max(shake,.28);burst(player.x,player.z,[1,.18,.28],10,4.8);updateUI();
}
function spawnLocalDuelRadial(owner,isBot,pulse,total){
  if(!owner)return;const ox=owner.renderX??owner.x,oz=owner.renderZ??owner.z,color=duelBulletColor(owner,isBot);
  const target=isBot?duelBotBullets:duelPredictedBullets;
  for(let i=0;i<24;i++){
    const a=i/24*Math.PI*2,entry={x:ox+Math.sin(a)*1.0,z:oz+Math.cos(a)*1.0,vx:Math.sin(a)*14,vz:Math.cos(a)*14,life:2.5,damage:28,color,superShot:true,owner:isBot?'bot':'player'};
    if(!isBot){entry.clientSeq=++duelLocalShotSeq;entry.createdAt=performance.now();}
    target.push(entry);
  }
  burst(ox,oz,color,30,8);if(!isBot)showMessage(total>1?`HIPER SUPER ${pulse}/${total}!`:'SUPER!');
}
function duelUseSuper(owner,isBot=false){
  if(!owner||(owner.super||0)<100)return false;owner.super=0;
  const pulses=(owner.hyperActive||0)>0?3:1;
  spawnLocalDuelRadial(owner,isBot,1,pulses);
  if(pulses>1){
    setTimeout(()=>{if(duelActive&&!duelEnded)spawnLocalDuelRadial(owner,isBot,2,3);},170);
    setTimeout(()=>{if(duelActive&&!duelEnded)spawnLocalDuelRadial(owner,isBot,3,3);},340);
  }
  return true;
}
function duelActivateHyper(owner,isBot=false){
  if(!owner||(owner.hyper||0)<100||(owner.hyperActive||0)>0)return false;
  owner.hyper=0;owner.hyperActive=HYPER_DURATION;
  const ox=owner.renderX??owner.x,oz=owner.renderZ??owner.z;burst(ox,oz,[.25,1,.82],40,10);
  if(!isBot)showMessage('HIPERDOŁADOWANIE: 9 SEKUND!');
  return true;
}
function resetLocalDuelRound(){
  if(!player||!duelOpponent)return;
  player.x=0;player.z=12;player.angle=Math.PI;player.netX=0;player.netZ=12;player.hp=player.maxHp;player.ammo=MAG_SIZE;player.reload=0;player.fire=0;
  Object.assign(duelOpponent,{x:0,z:-12,renderX:0,renderZ:-12,targetX:0,targetZ:-12,angle:0,renderAngle:0,targetAngle:0,hp:duelOpponent.maxHp,hidden:false,vx:0,vz:0,ammo:MAG_SIZE,reload:0,fire:0});
  duelPredictedBullets=[];duelServerBullets=[];duelBotBullets=[];duelShotQueue=[];duelVisualHitSeqs.clear();
  duelBotShotTimer=.8;duelBotTurnTimer=.4;duelBotStuck=0;duelBotReveal=0;duelRoundResolving=false;
  duelMatchStatus='countdown';duelStartIn=3;duelStartDeadline=performance.now()+3000;updateDuelRoundHud();updateUI();
}
function resolveLocalDuelRound(){
  if(!duelLocalBotMode||duelRoundResolving||duelEnded||duelMatchStatus!=='playing'||!player||!duelOpponent)return;
  const playerDead=player.hp<=0,botDead=duelOpponent.hp<=0;if(!playerDead&&!botDead)return;duelRoundResolving=true;
  let winnerId=null;if(playerDead&&!botDead){duelOpponentWins++;winnerId=duelOpponent.id||'bot';showMessage('PRZEGRANA RUNDA');}
  else if(botDead&&!playerDead){duelYourWins++;winnerId=playerId;showMessage('WYGRANA RUNDA!');}
  else{duelRoundDraws++;showMessage('REMIS RUNDY!');}
  duelRoundEventSeq++;
  if(duelYourWins>=2){finishDuel({winnerId:playerId,reason:'Wygrałeś dwie rundy.',yourWins:duelYourWins,opponentWins:duelOpponentWins,roundDraws:duelRoundDraws});return;}
  if(duelOpponentWins>=2){finishDuel({winnerId:duelOpponent.id||'bot',reason:'Przeciwnik wygrał dwie rundy.',yourWins:duelYourWins,opponentWins:duelOpponentWins,roundDraws:duelRoundDraws});return;}
  if(duelRound>=3){finishDuel({winnerId:null,reason:'Po trzech rundach nikt nie wygrał dwóch rund.',yourWins:duelYourWins,opponentWins:duelOpponentWins,roundDraws:duelRoundDraws});return;}
  duelRound++;resetLocalDuelRound();
}
function spawnLocalBotBullet(){
  const bot=duelOpponent;if(!bot||!player||bot.fire>0||bot.reload>0)return false;
  if((bot.ammo??MAG_SIZE)<=0){bot.reload=RELOAD_TIME;bot.fire=0;return false;}
  const ox=bot.renderX??bot.x,oz=bot.renderZ??bot.z;
  const a=normalizeDuelAngle(Math.atan2(player.x-ox,player.z-oz)+(.025*(Math.random()*2-1)));
  const hyper=(bot.hyperActive||0)>0;
  bot.fire=bot.fireCooldown/(hyper?HYPER_FIRE_MULT:1);bot.ammo--;
  duelBotBullets.push({x:ox+Math.sin(a)*1.05,z:oz+Math.cos(a)*1.05,vx:Math.sin(a)*18,vz:Math.cos(a)*18,life:2.4,damage:22,color:duelBulletColor(bot,true),owner:'bot'});
  duelBotReveal=.9;burst(ox+Math.sin(a),oz+Math.cos(a),duelBulletColor(bot,true),4,2.3);
  if(bot.ammo<=0){bot.reload=RELOAD_TIME;bot.fire=0;}
  return true;
}
function updateLocalDuelBot(dt){
  const bot=duelOpponent;if(!duelLocalBotMode||!bot||!player||duelMatchStatus!=='playing'||duelEnded)return;
  bot.hidden=false;bot.isBot=true;bot.r=DUEL_RADIUS;bot.maxHp=Math.max(1,Number(bot.maxHp)||player.maxHp);bot.hp=Math.max(0,Number(bot.hp)||0);
  // Bot jest kopią gracza: te same ulepszenia, skórka, ruch, szybkostrzelność, magazynek i moce.
  bot.skin=profile.skin;bot.speed=player.speed;bot.fireCooldown=player.fireCooldown;
  if(!Number.isFinite(bot.ammo))bot.ammo=MAG_SIZE;if(!Number.isFinite(bot.reload))bot.reload=0;if(!Number.isFinite(bot.fire))bot.fire=0;
  if(!Number.isFinite(bot.super))bot.super=0;if(!Number.isFinite(bot.hyper))bot.hyper=0;if(!Number.isFinite(bot.hyperActive))bot.hyperActive=0;
  bot.fire=Math.max(0,bot.fire-dt);
  if(bot.reload>0){bot.reload=Math.max(0,bot.reload-dt);if(bot.reload===0)bot.ammo=MAG_SIZE;}
  if(bot.hyperActive>0)bot.hyperActive=Math.max(0,bot.hyperActive-dt);
  if(bot.hyper>=100&&bot.hyperActive<=0)duelActivateHyper(bot,true);
  let ox=Number(bot.renderX??bot.x)||0,oz=Number(bot.renderZ??bot.z)||-12;
  const dx=player.x-ox,dz=player.z-oz,dist=Math.max(.001,Math.hypot(dx,dz)),nx=dx/dist,nz=dz/dist;
  duelBotTurnTimer-=dt;if(duelBotTurnTimer<=0){duelBotTurnTimer=.65+Math.random()*.75;duelBotStrafe=Math.random()<.5?-1:1;}
  let wantX,wantZ;if(dist>9.2){wantX=nx;wantZ=nz;}else if(dist<4.8){wantX=-nx;wantZ=-nz;}else{wantX=-nz*duelBotStrafe+nx*.12;wantZ=nx*duelBotStrafe+nz*.12;const l=Math.hypot(wantX,wantZ)||1;wantX/=l;wantZ/=l;}
  const base=Math.atan2(wantX,wantZ),offsets=[0,.38,-.38,.78,-.78,1.25,-1.25,Math.PI],moveSpeed=bot.speed*((bot.hyperActive||0)>0?HYPER_SPEED_MULT:1);let best=null;
  for(const off of offsets){const a=base+off,mx=Math.sin(a),mz=Math.cos(a),cand={x:ox+mx*moveSpeed*dt,z:oz+mz*moveSpeed*dt,r:DUEL_RADIUS};resolveDuelEntity(cand);const moved=Math.hypot(cand.x-ox,cand.z-oz),newDist=Math.hypot(player.x-cand.x,player.z-cand.z);let score=moved*30-Math.abs(newDist-7.0)*.09;if(duelLineBlocked(cand.x,cand.z,player.x,player.z,.08))score-=.18;if(!best||score>best.score)best={score,x:cand.x,z:cand.z};}
  const oldX=ox,oldZ=oz;if(best){ox=best.x;oz=best.z;}const moved=Math.hypot(ox-oldX,oz-oldZ);duelBotStuck=moved<.002?duelBotStuck+dt:Math.max(0,duelBotStuck-dt*2);
  if(duelBotStuck>.25){duelBotStuck=0;duelBotStrafe*=-1;const escape={x:ox-nz*duelBotStrafe*1.0,z:oz+nx*duelBotStrafe*1.0,r:DUEL_RADIUS};resolveDuelEntity(escape);ox=escape.x;oz=escape.z;}
  bot.x=bot.targetX=bot.renderX=ox;bot.z=bot.targetZ=bot.renderZ=oz;bot.vx=(ox-oldX)/Math.max(dt,.001);bot.vz=(oz-oldZ)/Math.max(dt,.001);bot.angle=bot.targetAngle=bot.renderAngle=normalizeDuelAngle(Math.atan2(player.x-ox,player.z-oz));bot.inBush=duelPointInBush(ox,oz);
  duelBotReveal=Math.max(0,duelBotReveal-dt);bot.hidden=bot.inBush&&duelBotReveal<=0&&dist>4.5;
  // Używa superataku na bliskim dystansie, dokładnie z tym samym potrójnym superem podczas hiperdoładowania.
  if(bot.super>=100&&dist<7.2&&!duelLineBlocked(ox,oz,player.x,player.z,.17))duelUseSuper(bot,true);
  if(dist<16.5&&!duelLineBlocked(ox,oz,player.x,player.z,.17))spawnLocalBotBullet();
  for(let i=duelBotBullets.length-1;i>=0;i--){const b=duelBotBullets[i],x0=b.x,z0=b.z,x1=x0+b.vx*dt,z1=z0+b.vz*dt;b.life-=dt;const wt=duelFirstWallHit(x0,z0,x1,z1,.18),ht=duelSegmentCircleHit(x0,z0,x1,z1,player.x,player.z,DUEL_RADIUS+.20);if(ht!==null&&(wt===null||ht<=wt)){b.x=x0+(x1-x0)*ht;b.z=z0+(z1-z0)*ht;burst(b.x,b.z,b.color||[1,.25,.48],6,3);duelBotBullets.splice(i,1);localBotDamagePlayer(b.damage);duelChargeEntity(bot,3.5);continue;}if(wt!==null||b.life<=0){if(wt!==null)burst(x0+(x1-x0)*wt,z0+(z1-z0)*wt,b.color||[1,.25,.48],4,2);duelBotBullets.splice(i,1);continue;}b.x=x1;b.z=z1;}
  if(ui.duelOpponentHp)ui.duelOpponentHp.textContent=`${Math.max(0,Math.ceil(bot.hp))} / ${bot.maxHp} HP`;
}
function updateDuel(dt){
  if(!duelActive||!player)return;
  if(isMobileDevice&&mobilePortraitBlocked){mouse.down=false;return;}
  player.fire=Math.max(0,player.fire-dt);
  if(player.reload>0){player.reload=Math.max(0,player.reload-dt);if(player.reload===0){player.ammo=MAG_SIZE;showMessage('AMUNICJA GOTOWA!');}updateUI();}
  if((player.hyperActive||0)>0){player.hyperActive=Math.max(0,player.hyperActive-dt);if(player.hyperActive===0)showMessage('HIPERDOŁADOWANIE ZAKOŃCZONE');updateUI();}
  if(duelMatchStatus==='countdown'){
    const nowMs=performance.now();
    if(!duelStartDeadline)duelStartDeadline=nowMs+Math.max(0,duelStartIn)*1000;
    duelStartIn=Math.max(0,(duelStartDeadline-nowMs)/1000);
    if(duelStartIn<=0.03){
      // Awaryjny start lokalny: nawet gdy jedna odpowiedź HTTP zaginie, licznik nie zatrzyma się na „1”.
      duelMatchStatus='playing';duelStartIn=0;duelStartDeadline=0;showMessage('START!');
    }else{
      const n=Math.max(1,Math.ceil(duelStartIn));showMessage(`START ZA ${n}`);
    }
  }else if(duelMatchStatus==='playing'){
    let dx=isMobileDevice?mobileInput.moveX:(keys.KeyD?1:0)-(keys.KeyA?1:0),dz=isMobileDevice?mobileInput.moveZ:(keys.KeyS?1:0)-(keys.KeyW?1:0);
    if(duelMirrorView){dx=-dx;dz=-dz;}
    const len=Math.hypot(dx,dz);
    if(len){
      dx/=len;dz/=len;
      const moveSpeed=player.speed*((player.hyperActive||0)>0?HYPER_SPEED_MULT:1);
      moveDuelEntity(player,dx*moveSpeed*dt,dz*moveSpeed*dt);
    }
    player.inBush=duelPointInBush(player.x,player.z);
    player.angle=normalizeDuelAngle(Math.atan2(mouse.worldX-player.x,mouse.worldZ-player.z));if(mouse.down)duelPlayerShoot();
  }
  if(duelLocalBotMode)updateLocalDuelBot(dt);
  if(duelOpponent&&!duelOpponent.hidden&&!duelLocalBotMode){
    // Krótka predykcja prędkości kompensuje ping, a interpolacja usuwa skoki pakietów.
    const age=Math.min(.80,Math.max(0,(performance.now()-(duelOpponent.sampleAt||performance.now()))/1000));
    const predictedX=duelOpponent.targetX+(duelOpponent.vx||0)*age,predictedZ=duelOpponent.targetZ+(duelOpponent.vz||0)*age;
    const follow=1-Math.exp(-10*dt),turn=1-Math.exp(-15*dt);
    duelOpponent.renderX+=(predictedX-duelOpponent.renderX)*follow;
    duelOpponent.renderZ+=(predictedZ-duelOpponent.renderZ)*follow;
    duelOpponent.renderAngle=smoothDuelAngle(duelOpponent.renderAngle,duelOpponent.targetAngle,turn);
  }
  for(const b of duelServerBullets){
    b.renderX+=(b.vx||0)*dt;b.renderZ+=(b.vz||0)*dt;
    const blend=1-Math.exp(-10*dt);b.renderX+=(b.targetX-b.renderX)*blend;b.renderZ+=(b.targetZ-b.renderZ)*blend;
  }
  for(let i=duelPredictedBullets.length-1;i>=0;i--){
    const b=duelPredictedBullets[i],x0=b.x,z0=b.z,x1=x0+b.vx*dt,z1=z0+b.vz*dt;b.life-=dt;
    const wallT=duelFirstWallHit(x0,z0,x1,z1,.18);let hitT=null;
    if(duelOpponent&&!duelOpponent.hidden){const ox=duelOpponent.renderX??duelOpponent.x,oz=duelOpponent.renderZ??duelOpponent.z;hitT=duelSegmentCircleHit(x0,z0,x1,z1,ox,oz,DUEL_RADIUS+.22);}
    if(hitT!==null&&(wallT===null||hitT<=wallT)){
      b.x=x0+(x1-x0)*hitT;b.z=z0+(z1-z0)*hitT;burst(b.x,b.z,profile.skin==='arena_vip_plus'?[1,.35,.72]:(profile.skin==='cosmic'?[.78,.38,1]:[.24,.85,1]),7,3.4);
      if(duelLocalBotMode&&duelOpponent){let damage=b.damage||22;if((duelOpponent.hyperActive||0)>0)damage*=HYPER_DAMAGE_MULT;duelOpponent.hp=Math.max(0,duelOpponent.hp-damage);duelChargeEntity(player,3.5);duelBotReveal=.9;if(ui.duelOpponentHp)ui.duelOpponentHp.textContent=`${Math.ceil(duelOpponent.hp)} / ${duelOpponent.maxHp} HP`;}
      else{duelVisualHitSeqs.add(b.clientSeq);duelChargeEntity(player,3.5);}
      duelPredictedBullets.splice(i,1);continue;
    }
    if(wallT!==null||b.life<=0){if(wallT!==null)burst(x0+(x1-x0)*wallT,z0+(z1-z0)*wallT,profile.skin==='arena_vip_plus'?[1,.35,.72]:(profile.skin==='cosmic'?[.78,.38,1]:[.24,.85,1]),4,2);duelPredictedBullets.splice(i,1);continue;}
    b.x=x1;b.z=z1;
  }
  resolveLocalDuelRound();
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=10*dt;p.vx*=.97;p.vz*=.97;if(p.y<.05){p.y=.05;p.vy*=-.25;}if(p.life<=0)particles.splice(i,1);}
  shake=Math.max(0,shake-dt);if(messageClock>0){messageClock-=dt;if(messageClock<=0)ui.centerMsg.style.opacity='0';}
}
function finishDuel(data){
  if(duelEnded)return;const endedMatchId=duelMatchId;duelEnded=true;running=false;duelActive=false;clearDuelTimers();
  if(endedMatchId){api('/api/duel/leave',{method:'POST',body:JSON.stringify({playerId,matchId:endedMatchId})}).catch(()=>{});}duelMatchId='';duelLocalBotMode=false;duelBotBullets=[];
  duelYourWins=Math.max(0,Number(data.yourWins??duelYourWins)||0);duelOpponentWins=Math.max(0,Number(data.opponentWins??duelOpponentWins)||0);duelRoundDraws=Math.max(0,Number(data.roundDraws??duelRoundDraws)||0);
  const won=data.winnerId===playerId,lost=!!data.winnerId&&data.winnerId!==playerId,draw=!data.winnerId;
  const rewardCoins=won?Number(gameConfig.duelWinCoins||25):(draw?Number(gameConfig.duelDrawCoins||5):0),rewardTrophies=won?Number(gameConfig.duelWinTrophies||10):(draw?Number(gameConfig.duelDrawTrophies||4):0),rewardPoints=won?Number(gameConfig.duelWinPoints??2000):(draw?Number(gameConfig.duelDrawPoints??500):0);
  if(rewardCoins||rewardTrophies||rewardPoints){profile.coins=Math.max(0,Math.floor(profile.coins+rewardCoins));profile.trophies=Math.max(0,Math.floor(profile.trophies+rewardTrophies));profile.points=Math.max(0,Math.floor(profile.points+rewardPoints));walletCoins=profile.coins;saveProgress();updateLobby();syncProfile().catch(()=>{});}recordMatchResult({mode:'duel',result:won?'win':(lost?'loss':'draw'),pointsDelta:rewardPoints,trophiesDelta:rewardTrophies,coinsDelta:rewardCoins,durationSeconds:0,details:{yourWins:duelYourWins,opponentWins:duelOpponentWins,roundDraws:duelRoundDraws,opponent:duelOpponent?.name||'Przeciwnik'}});
  if(ui.gameOverBadge)ui.gameOverBadge.textContent='KONIEC POJEDYNKU • NAJLEPSZY Z 3 RUND';
  if(ui.gameOverTitle)ui.gameOverTitle.innerHTML=won?'ZWYCIĘSTWO!':(lost?'PRZEGRANA':'REMIS!');
  const opponentName=duelOpponent?.name||'Przeciwnik';
  if(ui.endStats)ui.endStats.innerHTML=`<div class="endStat">Rundy<span>${duelYourWins}:${duelOpponentWins}</span></div><div class="endStat">Remisy rund<span>${duelRoundDraws}</span></div><div class="endStat">Przeciwnik<span>${escapeRankingName(opponentName)}</span></div><div class="endStat">Nagroda<span>${rewardPoints} ⭐ • ${rewardCoins} 🪙 • ${rewardTrophies} 🏆</span></div>`;
  const reason=data.reason||'Pojedynek został zakończony.';ui.gameOverView.querySelector('p').textContent=`${reason} ${won?`Otrzymujesz ${rewardPoints} punktów, ${rewardCoins} monet i ${rewardTrophies} pucharków.`:(draw?`Otrzymujesz ${rewardPoints} punktów, ${rewardCoins} monet i ${rewardTrophies} pucharki.`:'')}`.trim();
  ui.duelQueueView.style.display='none';ui.lobbyView.style.display='none';ui.gameOverView.style.display='grid';ui.gameOverView.scrollTop=0;document.body.classList.remove('arena-playing');document.body.classList.add('lobby-mode','result-mode');document.body.classList.remove('duel-mode');ui.overlay.style.display='block';requestAnimationFrame(()=>{ui.gameOverView.scrollTop=0;});
}

function updateLobby(){
  ui.savedTrophies.textContent=Math.floor(profile.trophies).toLocaleString('pl-PL');
  ui.savedPoints.textContent=Math.floor(profile.points).toLocaleString('pl-PL');
  ui.savedCoins.textContent=Math.floor(profile.coins).toLocaleString('pl-PL');
  if(isLobbyVisible())renderRanking();updateModeUI();
  if(ui.nicknameInput&&document.activeElement!==ui.nicknameInput)ui.nicknameInput.value=profile.name;
  if(ui.versionOneBtn){
    const owned=profile.heroVersion1===true,cost=shopCost(VERSION_ONE_COST);
    ui.versionOneBtn.textContent=owned?'AKTYWNA ✓':(cost===0?'ODBLOKUJ ZA DARMO':'ODBLOKUJ ZA 150 🪙');
    ui.versionOneBtn.disabled=owned;
    ui.versionOneBtn.classList.toggle('affordable',!owned&&(cost===0||profile.coins>=cost));
    const priceLabel=document.querySelector('.versionPrice');if(priceLabel)priceLabel.textContent=cost===0?'Cena dla właściciela: ZA DARMO':'Cena: 150 monet 🪙';
  }
  const ownerBadge=document.getElementById('ownerFreeBadge');if(ownerBadge)ownerBadge.style.display=ownerFreeShop?'block':'none';
  for(const el of ui.persistentLevelEls){const type=el.dataset.persistentLevel;el.textContent=`Poziom ${profile.upgrades[type]||0}/5`;}
  for(const card of ui.skinCards){
    const skin=card.dataset.skin,owned=skin==='classic'||profile.ownedSkins?.[skin]===true,selected=owned&&skin===profile.skin;
    const cosmicCost=shopCost(COSMIC_SKIN_COST);card.classList.toggle('selected',selected);card.classList.toggle('locked',!owned);card.classList.toggle('affordable',!owned&&skin==='cosmic'&&(cosmicCost===0||profile.coins>=cosmicCost));
    const state=card.querySelector('.skinState');
    if(selected)state.textContent='WYBRANO';
    else if(owned)state.textContent='WYBIERZ';
    else if(skin==='cosmic'&&shopCost(COSMIC_SKIN_COST)===0)state.textContent='ODBLOKUJ • ZA DARMO';
    else if(skin==='cosmic'&&profile.coins>=COSMIC_SKIN_COST)state.textContent='ODBLOKUJ • 1250 🪙';
    else if(skin==='arena_vip_plus')state.textContent='🔒 VIP+ POZIOM 20';
    else state.textContent='🔒 1250 🪙';
    if(skin==='cosmic'){const price=card.querySelector('.skinPrice');if(price)price.textContent=shopCost(COSMIC_SKIN_COST)===0?'Cena dla właściciela: ZA DARMO':'Cena: 1250 monet';}
  }
}
let skinNoticeTimer=0;
function setSkinNotice(text,good=false){
  if(!ui.skinNotice)return;clearTimeout(skinNoticeTimer);ui.skinNotice.textContent=text;ui.skinNotice.classList.toggle('good',good);
  skinNoticeTimer=setTimeout(()=>{ui.skinNotice.textContent='';ui.skinNotice.classList.remove('good');},3200);
}
function selectSkin(skin){
  if(!['classic','cosmic','arena_vip_plus'].includes(skin))return;
  if(skin==='arena_vip_plus'&&profile.ownedSkins?.arena_vip_plus!==true){setSkinNotice('Ta skórka jest nagrodą z 20. poziomu Arena Karnetu VIP+.');return;}
  if(skin==='cosmic'&&profile.ownedSkins?.cosmic!==true){
    const cost=shopCost(COSMIC_SKIN_COST);if(profile.coins<cost){setSkinNotice(`Brakuje ${(cost-profile.coins).toLocaleString('pl-PL')} monet.`);return;}
    profile.coins-=cost;walletCoins=profile.coins;profile.ownedSkins={...(profile.ownedSkins||{}),classic:true,cosmic:true};profile.skin='cosmic';saveProgress();updateLobby();setSkinNotice(cost===0?'Kosmiczny Strażnik odblokowany za darmo!':'Kosmiczny Strażnik odblokowany za 1250 monet!',true);return;
  }
  profile.skin=skin;saveProgress();updateLobby();setSkinNotice(skin==='cosmic'?'Wybrano Kosmicznego Strażnika.':(skin==='arena_vip_plus'?'Wybrano Neonowego Władcę Areny.':'Wybrano Błękitnego Bohatera.'),true);
}
let versionNoticeTimer=0;
function setVersionNotice(text,good=false){
  if(!ui.versionNotice)return;clearTimeout(versionNoticeTimer);ui.versionNotice.textContent=text;ui.versionNotice.classList.toggle('good',good);
  versionNoticeTimer=setTimeout(()=>{ui.versionNotice.textContent='';ui.versionNotice.classList.remove('good');},3200);
}
function buyVersionOne(){
  if(profile.heroVersion1===true){setVersionNotice('Lepsza wersja I jest już aktywna.',true);return;}
  const cost=shopCost(VERSION_ONE_COST);if(profile.coins<cost){setVersionNotice(`Brakuje ${cost-profile.coins} monet.`);return;}
  profile.coins-=cost;walletCoins=profile.coins;profile.heroVersion1=true;saveProgress();updateLobby();setVersionNotice(cost===0?'Lepsza wersja I odblokowana za darmo!':'Lepsza wersja I odblokowana! Kolor bez zmian.',true);
}
let upgrades={...profile.upgrades};
let running=false,runCommitted=false,last=performance.now(),score=0,wave=1,kills=0,walletCoins=profile.coins,runCoins=0,trophies=0,survivalTime=0,waveClock=0,spawnClock=0,shake=0,messageClock=0;
let player,enemies=[],bullets=[],particles=[],stars=[],pickups=[],coins=[];
let selectedMode=profile.mode||'solo',duelSearching=false,duelActive=false,duelEnded=false,duelMatchId='',duelOpponent=null,duelServerBullets=[],duelPredictedBullets=[],duelShotQueue=[],duelVisualHitSeqs=new Set(),duelLocalShotSeq=0,duelNetworkBusy=false,duelNetworkTimer=0,duelJoinTimer=0,duelNetworkFailures=0,duelMatchStatus='',duelStartIn=0,duelStartDeadline=0,duelLastStateAt=performance.now(),duelRtt=0,duelFrameSeq=0,duelLocalBotMode=false,duelBotBullets=[],duelBotTurnTimer=0,duelBotShotTimer=.8,duelBotStrafe=1,duelBotStuck=0,duelBotReveal=0,duelRound=1,duelYourWins=0,duelOpponentWins=0,duelRoundDraws=0,duelRoundEventSeq=0,duelRoundResolving=false,duelMirrorView=false,duelShotFlushBusy=false,duelShotFlushTimer=0;
queueMicrotask(()=>{try{scheduleSqlSync(false);}catch(error){console.error('SQL sync startup error',error);}});
window.__arenaDebug=()=>({duelActive,duelLocalBotMode,duelMatchStatus,duelRound,duelYourWins,duelOpponentWins,duelRoundDraws,player:player?{x:player.x,z:player.z,hp:player.hp}:null,opponent:duelOpponent?{x:duelOpponent.renderX??duelOpponent.x,z:duelOpponent.renderZ??duelOpponent.z,hp:duelOpponent.hp,hidden:duelOpponent.hidden,isBot:duelOpponent.isBot}:null,playerBullets:duelPredictedBullets.length,botBullets:duelBotBullets.length,botAmmo:duelOpponent?.ammo,botReload:duelOpponent?.reload,botSuper:duelOpponent?.super,botHyper:duelOpponent?.hyper,botHyperActive:duelOpponent?.hyperActive,mirrorView:duelMirrorView,shotQueue:duelShotQueue.length,shotFlushBusy:duelShotFlushBusy});

const obstacles=[
  {x:-6,z:-5,w:3.6,d:2.3,h:1.7,c:[.43,.29,.21]}, {x:6,z:5,w:3.6,d:2.3,h:1.7,c:[.43,.29,.21]},
  {x:-7,z:6,w:2.4,d:4.2,h:1.5,c:[.30,.36,.44]}, {x:7,z:-6,w:2.4,d:4.2,h:1.5,c:[.30,.36,.44]},
  {x:0,z:0,w:3.1,d:3.1,h:1.4,c:[.42,.34,.18]}, {x:-12,z:0,w:2.2,d:5.2,h:1.3,c:[.27,.38,.32]}, {x:12,z:0,w:2.2,d:5.2,h:1.3,c:[.27,.38,.32]}
];
const bushes=[[-13,-11],[-11,-12],[-10,11],[-13,10],[11,12],[13,10],[10,-12],[13,-10],[-2,-12],[2,12]];
// Szybka arena 1v1: tylko dwie ściany i cztery niewielkie pola krzaków.
// Układ jest symetryczny, więc żaden gracz nie ma przewagi po stronie startowej.
const DUEL_ARENA_SIZE=17.5,DUEL_RADIUS=.75;
const duelWalls=[
  {x:-5.4,z:0,w:3.4,d:1.7,h:1.45,c:[.32,.36,.48]},
  {x: 5.4,z:0,w:3.4,d:1.7,h:1.45,c:[.32,.36,.48]}
];
const duelBushes=[
  {x:-10.2,z:-5.7,r:1.85},{x:-10.2,z:5.7,r:1.85},
  {x: 10.2,z:-5.7,r:1.85},{x: 10.2,z:5.7,r:1.85}
];
function duelPointInBush(x,z){return duelBushes.some(b=>(x-b.x)*(x-b.x)+(z-b.z)*(z-b.z)<b.r*b.r);}
function duelHitsWall(x,z,r=.12){
  if(Math.abs(x)>DUEL_ARENA_SIZE-r||Math.abs(z)>DUEL_ARENA_SIZE-r)return true;
  return duelWalls.some(o=>x>o.x-o.w/2-r&&x<o.x+o.w/2+r&&z>o.z-o.d/2-r&&z<o.z+o.d/2+r);
}
function duelSegmentCircleHit(x0,z0,x1,z1,cx,cz,r){
  const dx=x1-x0,dz=z1-z0,fx=x0-cx,fz=z0-cz,a=dx*dx+dz*dz;
  if(a<1e-9)return fx*fx+fz*fz<=r*r?0:null;
  const b=2*(fx*dx+fz*dz),c=fx*fx+fz*fz-r*r,d=b*b-4*a*c;if(d<0)return null;
  const root=Math.sqrt(d),t1=(-b-root)/(2*a),t2=(-b+root)/(2*a);
  if(t1>=0&&t1<=1)return t1;if(t2>=0&&t2<=1)return t2;return null;
}
function duelSegmentAabbHit(x0,z0,x1,z1,minX,maxX,minZ,maxZ){
  const dx=x1-x0,dz=z1-z0;let enter=0,leave=1;
  for(const [start,delta,low,high] of [[x0,dx,minX,maxX],[z0,dz,minZ,maxZ]]){
    if(Math.abs(delta)<1e-9){if(start<low||start>high)return null;continue;}
    let a=(low-start)/delta,b=(high-start)/delta;if(a>b){const t=a;a=b;b=t;}
    enter=Math.max(enter,a);leave=Math.min(leave,b);if(enter>leave)return null;
  }
  return enter>=0&&enter<=1?enter:null;
}
function duelFirstWallHit(x0,z0,x1,z1,r=.16){
  let best=null;
  for(const o of duelWalls){const t=duelSegmentAabbHit(x0,z0,x1,z1,o.x-o.w/2-r,o.x+o.w/2+r,o.z-o.d/2-r,o.z+o.d/2+r);if(t!==null&&(best===null||t<best))best=t;}
  if(Math.abs(x1)>DUEL_ARENA_SIZE-r||Math.abs(z1)>DUEL_ARENA_SIZE-r){if(best===null||1<best)best=1;}
  return best;
}
function duelLineBlocked(x0,z0,x1,z1,r=.12){return duelFirstWallHit(x0,z0,x1,z1,r)!==null;}
function resolveDuelEntity(ent){
  const r=Number(ent.r)||DUEL_RADIUS;
  ent.x=Math.max(-DUEL_ARENA_SIZE+r,Math.min(DUEL_ARENA_SIZE-r,ent.x));
  ent.z=Math.max(-DUEL_ARENA_SIZE+r,Math.min(DUEL_ARENA_SIZE-r,ent.z));
  for(const o of duelWalls){
    const minX=o.x-o.w/2-r,maxX=o.x+o.w/2+r,minZ=o.z-o.d/2-r,maxZ=o.z+o.d/2+r;
    if(ent.x>minX&&ent.x<maxX&&ent.z>minZ&&ent.z<maxZ){
      const dl=Math.abs(ent.x-minX),dr=Math.abs(maxX-ent.x),dt=Math.abs(ent.z-minZ),db=Math.abs(maxZ-ent.z),m=Math.min(dl,dr,dt,db);
      if(m===dl)ent.x=minX;else if(m===dr)ent.x=maxX;else if(m===dt)ent.z=minZ;else ent.z=maxZ;
    }
  }
}
// Ruch osiami osobno pozwala płynnie ślizgać się wzdłuż ściany zamiast
// zakleszczać postać na narożniku przy ruchu po skosie.
function moveDuelEntity(ent,dx,dz){
  const r=Number(ent.r)||DUEL_RADIUS;
  const nextX=Math.max(-DUEL_ARENA_SIZE+r,Math.min(DUEL_ARENA_SIZE-r,ent.x+dx));
  if(!duelHitsWall(nextX,ent.z,r))ent.x=nextX;
  const nextZ=Math.max(-DUEL_ARENA_SIZE+r,Math.min(DUEL_ARENA_SIZE-r,ent.z+dz));
  if(!duelHitsWall(ent.x,nextZ,r))ent.z=nextZ;
}
function reset(){
  upgrades={...profile.upgrades};runCommitted=false;walletCoins=profile.coins;runCoins=0;
  const versionOwned=profile.heroVersion1===true;
  const maxHp=Math.round((BASE_HP+20*upgrades.hp)*(versionOwned?VERSION_ONE_HP:1));
  player={x:0,z:11,hp:maxHp,maxHp,r:0.75,speed:BASE_SPEED*Math.pow(1.10,upgrades.move)*(versionOwned?VERSION_ONE_SPEED:1),fireCooldown:BASE_FIRE_COOLDOWN/(Math.pow(1.07,upgrades.fire)*(versionOwned?VERSION_ONE_FIRE:1)),angle:Math.PI,fire:0,ammo:MAG_SIZE,reload:0,inv:0,super:0,hyper:0,hyperActive:0,regen:0};
  enemies=[];bullets=[];particles=[];stars=[];pickups=[];coins=[];score=0;wave=1;kills=0;trophies=0;survivalTime=0;waveClock=0;spawnClock=.4;shake=0;updateUI();showMessage('FALA 1');
}
function recordMatchResult(payload){if(!currentAccount)return;api('/api/match/result',{method:'POST',body:JSON.stringify({...payload,clientVersion:CLIENT_VERSION})}).catch(()=>{});}
function commitRun(){
  if(runCommitted)return;runCommitted=true;
  const pointsDelta=Math.max(0,Math.floor(score)),trophiesDelta=Math.max(0,Math.floor(trophies)),coinsDelta=Math.max(0,Math.floor(runCoins));
  profile.points+=pointsDelta;profile.trophies+=trophiesDelta;profile.coins=Math.max(0,Math.floor(walletCoins));
  saveProgress();updateLobby();syncProfile().then(fetchRanking);
  recordMatchResult({mode:'solo',result:'finished',pointsDelta,trophiesDelta,coinsDelta,durationSeconds:survivalTime,details:{kills,wave,score}});
}
function showLobby(leaveDuel=true){if(leaveDuel&&(duelActive||duelSearching||duelMatchId))stopDuelSession(true);running=false;resetMobileInput();hideMobileFullscreenGate();pendingMobileGameStart=null;document.body.classList.remove('arena-playing','result-mode');rankingCenterOnNextRender=true;document.body.classList.add('lobby-mode');document.body.classList.remove('duel-mode');ui.lobbyView.style.display='block';ui.duelQueueView.style.display='none';ui.gameOverView.style.display='none';ui.overlay.style.display='grid';if(ui.hudModeText)ui.hudModeText.textContent='Online';if(ui.gameOverBadge)ui.gameOverBadge.textContent='KONIEC MECZU • POSTĘP ZAPISANY';if(ui.gameOverTitle)ui.gameOverTitle.innerHTML='ROBOTY CIĘ<br>POKONAŁY';updateLobby();fetchRanking();if(isMobileDevice)scheduleMobileViewportRefresh();}
function startSoloGame(){if(running)commitRun();reset();running=true;document.body.classList.add('arena-playing');document.body.classList.remove('lobby-mode','result-mode');document.body.classList.remove('duel-mode');ui.lobbyView.style.display='block';ui.gameOverView.style.display='none';updateUI();ui.overlay.style.display='none';last=performance.now();}
function startSelectedGameNow(){
  resetMobileInput();
  const base=selectedModeBase();
  if(base==='solo'&&gameConfig.soloEnabled!==false){startSoloGame();return;}
  if(base==='duel'&&gameConfig.duelEnabled!==false){startDuelQueue();return;}
  showMessage('TEN TRYB JEST WYŁĄCZONY');
  toggleModeMenu(true);
}
async function startGame(){
  if(!isMobileDevice){startSelectedGameNow();return;}
  if(mobilePortraitBlocked){
    await requestLandscapeOrientation(false);
    return;
  }
  const active=await requestLandscapeOrientation(true);
  if(active||!fullscreenSupported()){
    startSelectedGameNow();
    return;
  }
  showMobileFullscreenGate(startSelectedGameNow);
}
function gameOver(){running=false;commitRun();if(ui.gameOverBadge)ui.gameOverBadge.textContent='KONIEC MECZU • POSTĘP ZAPISANY';if(ui.gameOverTitle)ui.gameOverTitle.innerHTML='ROBOTY CIĘ<br>POKONAŁY';if(ui.endStats)ui.endStats.innerHTML='<div class="endStat">Punkty ⭐<span id="finalScore">0</span></div><div class="endStat">Pokonani 🤖<span id="finalKills">0</span></div><div class="endStat">Monety 🪙<span id="finalCoins">0</span></div><div class="endStat">Pucharki 🏆<span id="finalTrophies">0</span></div>';ui.finalScore=$('finalScore');ui.finalKills=$('finalKills');ui.finalCoins=$('finalCoins');ui.finalTrophies=$('finalTrophies');ui.finalScore.textContent=score;ui.finalKills.textContent=kills;ui.finalCoins.textContent=runCoins;ui.finalTrophies.textContent=trophies;ui.gameOverView.querySelector('p').textContent='Wybierz następną akcję.';ui.lobbyView.style.display='none';ui.gameOverView.style.display='grid';ui.gameOverView.scrollTop=0;document.body.classList.remove('arena-playing');document.body.classList.add('lobby-mode','result-mode');ui.overlay.style.display='block';requestAnimationFrame(()=>{ui.gameOverView.scrollTop=0;});}
function showMessage(t){ui.centerMsg.textContent=t;ui.centerMsg.style.opacity='1';messageClock=1.4;}
function updateUI(){
  ui.score.textContent=score;ui.wave.textContent=wave;ui.kills.textContent=kills;ui.coins.textContent=walletCoins;ui.trophies.textContent=trophies;
  const hp=Math.max(0,Math.ceil(player?.hp||0));ui.healthText.textContent=`${hp} / ${player?.maxHp||BASE_HP}`;ui.healthFill.style.width=`${Math.max(0,(player?.hp||0)/(player?.maxHp||BASE_HP)*100)}%`;
  const reloading=(player?.reload||0)>0;ui.ammoText.textContent=reloading?`PRZEŁADOWANIE ${player.reload.toFixed(1).replace('.',',')} s`:`${player?.ammo??MAG_SIZE} / ${MAG_SIZE}`;ui.ammoFill.style.width=reloading?`${Math.max(0,1-player.reload/RELOAD_TIME)*100}%`:`${Math.max(0,(player?.ammo??MAG_SIZE)/MAG_SIZE*100)}%`;ui.ammoFill.classList.toggle('reloading',reloading);
  ui.superText.textContent=`${Math.floor(player?.super||0)}%`;ui.superFill.style.width=`${Math.min(100,player?.super||0)}%`;
  const hyperActive=(player?.hyperActive||0)>0,hyperValue=hyperActive?Math.min(HYPER_DURATION,player.hyperActive):(player?.hyper||0);
  ui.hyperText.textContent=hyperActive?`${player.hyperActive.toFixed(1)} s`:`${Math.floor(hyperValue)}%`;
  ui.hyperFill.style.width=hyperActive?`${player.hyperActive/HYPER_DURATION*100}%`:`${Math.min(100,hyperValue)}%`;
  ui.hyperFill.classList.toggle('active',hyperActive);
  if(ui.mobileSuperBtn){const superValue=Math.max(0,Math.min(100,player?.super||0));ui.mobileSuperBtn.style.setProperty('--charge',`${superValue*3.6}deg`);ui.mobileSuperBtn.classList.toggle('ready',superValue>=100);ui.mobileSuperBtn.setAttribute('aria-label',superValue>=100?'Superatak gotowy':'Superatak '+Math.floor(superValue)+' procent');}
  if(ui.mobileHyperBtn){const hyperCharge=Math.max(0,Math.min(100,player?.hyper||0));ui.mobileHyperBtn.style.setProperty('--charge',`${hyperCharge*3.6}deg`);ui.mobileHyperBtn.classList.toggle('ready',hyperCharge>=100&&!hyperActive);ui.mobileHyperBtn.classList.toggle('active',hyperActive);ui.mobileHyperBtn.setAttribute('aria-label',hyperActive?'Hiperdoładowanie aktywne':(hyperCharge>=100?'Hiperdoładowanie gotowe':'Hiperdoładowanie '+Math.floor(hyperCharge)+' procent'));}
  for(const button of ui.upgradeButtons){
    const type=button.dataset.upgrade,level=upgrades[type]||0,cost=shopCost(UPGRADE_COSTS[level]);
    const levelEl=button.querySelector('[data-level]'),costEl=button.querySelector('[data-cost]');
    levelEl.textContent=`${level}/5`;
    costEl.textContent=level>=UPGRADE_COSTS.length?'MAX':(cost===0?'ZA DARMO':`${cost} 🪙`);
    button.disabled=!running||level>=UPGRADE_COSTS.length;
    button.classList.toggle('affordable',running&&level<UPGRADE_COSTS.length&&(cost===0||walletCoins>=cost));
  }
}
function buyUpgrade(type){
  if(duelActive)return;
  if(!running||!(type in upgrades))return;
  const level=upgrades[type];
  if(level>=UPGRADE_COSTS.length){showMessage('MAKSYMALNY POZIOM');return;}
  const cost=shopCost(UPGRADE_COSTS[level]);
  if(walletCoins<cost){showMessage(`BRAKUJE ${cost-walletCoins} MONET`);return;}
  walletCoins-=cost;upgrades[type]++;profile.coins=walletCoins;profile.upgrades[type]=upgrades[type];saveProgress();updateLobby();
  if(type==='move'){
    player.speed=BASE_SPEED*Math.pow(1.10,upgrades.move)*(profile.heroVersion1===true?VERSION_ONE_SPEED:1);
    showMessage(`RUCH: POZIOM ${upgrades.move}`);
  }else if(type==='fire'){
    player.fireCooldown=BASE_FIRE_COOLDOWN/(Math.pow(1.07,upgrades.fire)*(profile.heroVersion1===true?VERSION_ONE_FIRE:1));
    showMessage(`STRZAŁ: POZIOM ${upgrades.fire}`);
  }else{
    const oldMax=player.maxHp;
    player.maxHp=Math.round((BASE_HP+20*upgrades.hp)*(profile.heroVersion1===true?VERSION_ONE_HP:1));
    player.hp=Math.min(player.maxHp,player.hp+(player.maxHp-oldMax));
    showMessage(`ŻYCIE: ${player.maxHp}`);
  }
  burst(player.x,player.z,[1,.78,.08],18,6);updateUI();
}
function rnd(a,b){return a+Math.random()*(b-a)}
function dist2(a,b){const x=a.x-b.x,z=a.z-b.z;return x*x+z*z}
function resolve(ent){ent.x=Math.max(-ARENA+ent.r,Math.min(ARENA-ent.r,ent.x));ent.z=Math.max(-ARENA+ent.r,Math.min(ARENA-ent.r,ent.z));for(const o of obstacles){const minX=o.x-o.w/2-ent.r,maxX=o.x+o.w/2+ent.r,minZ=o.z-o.d/2-ent.r,maxZ=o.z+o.d/2+ent.r;if(ent.x>minX&&ent.x<maxX&&ent.z>minZ&&ent.z<maxZ){const dl=Math.abs(ent.x-minX),dr=Math.abs(maxX-ent.x),dt=Math.abs(ent.z-minZ),db=Math.abs(maxZ-ent.z),m=Math.min(dl,dr,dt,db);if(m===dl)ent.x=minX;else if(m===dr)ent.x=maxX;else if(m===dt)ent.z=minZ;else ent.z=maxZ;}}}
function hitsWall(x,z,r=.12){if(Math.abs(x)>ARENA-r||Math.abs(z)>ARENA-r)return true;return obstacles.some(o=>x>o.x-o.w/2-r&&x<o.x+o.w/2+r&&z>o.z-o.d/2-r&&z<o.z+o.d/2+r);}
// Sprawdza, czy prosta droga przecina ścianę. Roboty używają tego do wybierania objazdu.
function segmentBlocked(ax,az,bx,bz,r=.15){const d=Math.hypot(bx-ax,bz-az),steps=Math.max(1,Math.ceil(d/.32));for(let i=1;i<=steps;i++){const t=i/steps;if(hitsWall(ax+(bx-ax)*t,az+(bz-az)*t,r))return true;}return false;}
function chooseWaypoint(e,tx,tz){let best=null,bestCost=Infinity;for(const o of obstacles){const pad=e.r+.48;const corners=[[o.x-o.w/2-pad,o.z-o.d/2-pad],[o.x+o.w/2+pad,o.z-o.d/2-pad],[o.x-o.w/2-pad,o.z+o.d/2+pad],[o.x+o.w/2+pad,o.z+o.d/2+pad]];for(const c of corners){const [cx,cz]=c;if(hitsWall(cx,cz,e.r+.06)||segmentBlocked(e.x,e.z,cx,cz,e.r+.05))continue;const first=Math.hypot(cx-e.x,cz-e.z),second=Math.hypot(tx-cx,tz-cz);let cost=first+second;if(segmentBlocked(cx,cz,tx,tz,e.r+.05))cost+=3.5;const turnX=cx-e.x,turnZ=cz-e.z,goalX=tx-e.x,goalZ=tz-e.z;const turnLen=Math.hypot(turnX,turnZ)||1,goalLen=Math.hypot(goalX,goalZ)||1;cost+=(1-(turnX*goalX+turnZ*goalZ)/(turnLen*goalLen))*.55;if(cost<bestCost){bestCost=cost;best={x:cx,z:cz};}}}return best;}
function enemyDirection(e,tx,tz,dt){e.navTime=Math.max(0,(e.navTime||0)-dt);const directBlocked=segmentBlocked(e.x,e.z,tx,tz,e.r+.08);if(!directBlocked){e.navTime=0;}else if(e.navTime<=0||Math.hypot(e.navX-e.x,e.navZ-e.z)<.65||segmentBlocked(e.x,e.z,e.navX,e.navZ,e.r+.04)){const wp=chooseWaypoint(e,tx,tz);if(wp){e.navX=wp.x;e.navZ=wp.z;e.navTime=.85;}}
  let gx=directBlocked&&e.navTime>0?e.navX:tx,gz=directBlocked&&e.navTime>0?e.navZ:tz,dx=gx-e.x,dz=gz-e.z,l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
  if(hitsWall(e.x+dx*.48,e.z+dz*.48,e.r+.04)){const base=Math.atan2(dx,dz),side=e.avoidSide||1;let best=null,bestCost=Infinity;for(const off of [side*.55,-side*.55,side*1.0,-side*1.0,side*1.45,-side*1.45]){const a=base+off,cx=Math.sin(a),cz=Math.cos(a);if(hitsWall(e.x+cx*.62,e.z+cz*.62,e.r+.03))continue;const cost=Math.hypot(tx-(e.x+cx),tz-(e.z+cz));if(cost<bestCost){bestCost=cost;best=[cx,cz];}}if(best){dx=best[0];dz=best[1];}}
  return [dx,dz];}
function burst(x,z,color,count=12,power=5){const maxParticles=isMobileDevice?110:240,actual=isMobileDevice?Math.max(2,Math.ceil(count*.62)):count;if(particles.length>maxParticles)particles.splice(0,particles.length-maxParticles);for(let i=0;i<actual&&particles.length<maxParticles;i++){const a=Math.random()*Math.PI*2,s=rnd(power*.35,power);particles.push({x,y:rnd(.25,1.1),z,vx:Math.cos(a)*s,vy:rnd(1.5,5),vz:Math.sin(a)*s,life:rnd(.35,.75),size:rnd(.06,.16),color});}}
function spawnEnemy(){
  let a=Math.random()*Math.PI*2,x=Math.cos(a)*(ARENA-1),z=Math.sin(a)*(ARENA-1);if(Math.hypot(x-player.x,z-player.z)<10){a+=Math.PI;x=Math.cos(a)*(ARENA-1);z=Math.sin(a)*(ARENA-1);}
  const roll=Math.random(),type=wave>=4&&roll<.22?'tank':(wave>=2&&roll<.60?'shooter':'chaser');
  const cfg=type==='tank'?{hp:95+wave*10,speed:2.4,r:1.0,color:[.64,.18,.77],damage:24,level:3,coinReward:8}:type==='shooter'?{hp:42+wave*5,speed:3.4,r:.72,color:[1,.35,.18],damage:12,level:2,coinReward:3}:{hp:48+wave*6,speed:4.4,r:.72,color:[.94,.16,.25],damage:15,level:1,coinReward:1};
  const adminLevel=Math.max(1,Math.min(10,Number(gameConfig.survivalBotLevel)||5)),factor=.7+adminLevel*.06;cfg.hp=Math.round(cfg.hp*factor);cfg.speed*=.82+adminLevel*.036;cfg.damage=Math.round(cfg.damage*(.75+adminLevel*.05));
  enemies.push({x,z,type,level:cfg.level,coinReward:cfg.coinReward,hp:cfg.hp,maxHp:cfg.hp,speed:cfg.speed,r:cfg.r,color:cfg.color,damage:cfg.damage,angle:0,fire:rnd(.5,1.8),hit:0,navX:x,navZ:z,navTime:0,stuck:0,escapeTime:0,avoidSide:Math.random()<.5?-1:1});
}
function shoot(owner,x,z,angle,speed,damage,color,size=.18,spread=0){angle+=rnd(-spread,spread);bullets.push({owner,x,y:.72,z,vx:Math.sin(angle)*speed,vz:Math.cos(angle)*speed,life:2.2,damage,color,size});}
function startReload(){if(!running||!player||player.reload>0||player.ammo>=MAG_SIZE)return;player.reload=RELOAD_TIME;player.fire=0;showMessage('PRZEŁADOWANIE...');updateUI();}
function playerShoot(){if(duelActive){duelPlayerShoot();return;}if(!running||player.fire>0||player.reload>0)return;if(player.ammo<=0){startReload();return;}const hyper=(player.hyperActive||0)>0;player.fire=player.fireCooldown/(hyper?HYPER_FIRE_MULT:1);player.ammo--;const cosmic=profile.skin==='cosmic',shotColor=hyper?[.35,1,.92]:(cosmic?[.78,.38,1]:[.24,.85,1]),flashColor=hyper?[1,.95,.35]:(cosmic?[.35,1,1]:[.35,.9,1]);shoot('player',player.x+Math.sin(player.angle)*1.05,player.z+Math.cos(player.angle)*1.05,player.angle,18,22,shotColor,.21,.025);burst(player.x+Math.sin(player.angle),player.z+Math.cos(player.angle),flashColor,4,2.5);if(player.ammo<=0)startReload();else updateUI();}
function addCharge(baseAmount){if(!player)return;const amount=Math.max(0,Number(baseAmount)||0)*SUPER_CHARGE_MULTIPLIER;player.super=Math.min(100,Math.max(0,Number(player.super)||0)+amount);if((player.hyperActive||0)<=0)player.hyper=Math.min(100,Math.max(0,Number(player.hyper)||0)+amount/HYPER_CHARGE_RATIO);updateUI();}
function superPulse(pulse,total){if(!running||!player)return;const color=total>1?[.25,1,.88]:[1,.35,.93];for(let i=0;i<24;i++)shoot('player',player.x,player.z,i/24*Math.PI*2,14,28,color,.24,0);for(const e of enemies){const d=Math.hypot(e.x-player.x,e.z-player.z);if(d<5.5){e.hp-=45;const k=(5.5-d)/5.5;e.x+=(e.x-player.x)/(d||1)*k*3;e.z+=(e.z-player.z)/(d||1)*k*3;}}burst(player.x,player.z,color,32,9);shake=Math.max(shake,.55);if(total>1)showMessage(`HIPER SUPER ${pulse}/${total}!`);}
function superAttack(){if(duelActive){if(duelLocalBotMode&&duelMatchStatus==='playing'){duelUseSuper(player,false);updateUI();}else showMessage('SUPER ONLINE BĘDZIE DODANY PÓŹNIEJ');return;}if(!running||player.super<100)return;player.super=0;player.inv=.6;const pulses=(player.hyperActive||0)>0?3:1,caster=player;if(pulses===1){showMessage('SUPER!');superPulse(1,1);}else{/* Liczba fal jest ustalana w chwili użycia. Koniec hiperdoładowania nie anuluje fal 2 i 3. */superPulse(1,3);setTimeout(()=>{if(running&&player===caster)superPulse(2,3);},170);setTimeout(()=>{if(running&&player===caster)superPulse(3,3);},340);}updateUI();}
function activateHyper(){if(duelActive){if(duelLocalBotMode&&duelMatchStatus==='playing'){duelActivateHyper(player,false);updateUI();}else showMessage('HIPER ONLINE BĘDZIE DODANY PÓŹNIEJ');return;}if(!running||!player||player.hyper<100||player.hyperActive>0)return;player.hyper=0;player.hyperActive=HYPER_DURATION;player.inv=Math.max(player.inv,.45);showMessage('HIPERDOŁADOWANIE: 9 SEKUND!');burst(player.x,player.z,[.25,1,.82],40,10);shake=.4;updateUI();}
function spawnCoins(x,z,count){for(let i=0;i<count;i++){const a=(i/count)*Math.PI*2+rnd(-.3,.3),power=rnd(1.8,4.2);coins.push({x,z,r:.22,vx:Math.cos(a)*power,vz:Math.sin(a)*power,t:rnd(0,6.28),life:25});}}
function enemyDeath(e){score+=e.type==='tank'?350:e.type==='shooter'?180:120;kills++;addCharge(e.type==='tank'?18:10);burst(e.x,e.z,e.color,e.type==='tank'?24:15,e.type==='tank'?8:5);spawnCoins(e.x,e.z,e.coinReward||1);stars.push({x:e.x,z:e.z,y:.45,t:Math.random()*6.28,life:10});if(kills%7===0)pickups.push({x:e.x,z:e.z,type:'heal',life:14,t:0});updateUI();}
function damagePlayer(d){if(player.inv>0)return;if((player.hyperActive||0)>0)d*=HYPER_DAMAGE_MULT;player.hp-=d;player.inv=.55;player.regen=4;shake=.35;burst(player.x,player.z,[1,.15,.2],16,6);updateUI();if(player.hp<=0)gameOver();}

function update(dt){
  if(!running)return;
  if(isMobileDevice&&mobilePortraitBlocked){mouse.down=false;return;}
  if(duelActive){updateDuel(dt);return;}
  survivalTime+=dt;const earnedTrophies=Math.floor(survivalTime/4);if(earnedTrophies>trophies){trophies=earnedTrophies;showMessage(`PUCHAREK ${trophies} 🏆`);updateUI();}
  player.fire=Math.max(0,player.fire-dt);if(player.reload>0){player.reload=Math.max(0,player.reload-dt);if(player.reload===0){player.ammo=MAG_SIZE;showMessage('AMUNICJA GOTOWA!');}updateUI();}player.inv=Math.max(0,player.inv-dt);player.regen=Math.max(0,player.regen-dt);const wasHyper=(player.hyperActive||0)>0;if(wasHyper){player.hyperActive=Math.max(0,player.hyperActive-dt);updateUI();if(player.hyperActive===0)showMessage('HIPERDOŁADOWANIE ZAKOŃCZONE');}if(player.regen<=0&&player.hp<player.maxHp){player.hp=Math.min(player.maxHp,player.hp+5*dt);updateUI();}
  let dx=isMobileDevice?mobileInput.moveX:(keys.KeyD?1:0)-(keys.KeyA?1:0),dz=isMobileDevice?mobileInput.moveZ:(keys.KeyS?1:0)-(keys.KeyW?1:0),l=Math.hypot(dx,dz);if(l){dx/=l;dz/=l;const moveSpeed=player.speed*((player.hyperActive||0)>0?HYPER_SPEED_MULT:1);player.x+=dx*moveSpeed*dt;player.z+=dz*moveSpeed*dt;resolve(player);}
  player.angle=Math.atan2(mouse.worldX-player.x,mouse.worldZ-player.z);if(mouse.down)playerShoot();
  waveClock+=dt;const target=Math.min(4+wave*2,22);spawnClock-=dt;if(spawnClock<=0&&enemies.length<target){spawnEnemy();spawnClock=Math.max(.35,1.35-wave*.055)*rnd(.75,1.2);}if(waveClock>24){wave++;waveClock=0;showMessage(`FALA ${wave}`);player.hp=Math.min(player.maxHp,player.hp+18);updateUI();}

  for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];e.fire-=dt;e.hit=Math.max(0,e.hit-dt);let vx=player.x-e.x,vz=player.z-e.z,d=Math.hypot(vx,vz)||1;vx/=d;vz/=d;e.angle=Math.atan2(vx,vz);let move=1;if(e.type==='shooter'){if(d<6)move=-.65;else if(d<10)move=.35;if(e.fire<=0&&d<15){shoot('enemy',e.x+vx*.9,e.z+vz*.9,e.angle,9+wave*.12,e.damage,[1,.55,.12],.2,.08);e.fire=Math.max(.65,1.65-wave*.035)*rnd(.8,1.2);}}else if(e.type==='tank'&&d<1.65){move=0;if(e.fire<=0){damagePlayer(e.damage);e.fire=1.05;}}else if(e.type==='chaser'&&d<1.45){move=0;if(e.fire<=0){damagePlayer(e.damage);e.fire=.85;}}
    const oldX=e.x,oldZ=e.z;
    if(move!==0){let goalX=move>0?player.x:e.x-vx*8,goalZ=move>0?player.z:e.z-vz*8;let dir=enemyDirection(e,goalX,goalZ,dt),mx=dir[0],mz=dir[1];
      if(e.escapeTime>0){e.escapeTime-=dt;mx=-vz*e.avoidSide;mz=vx*e.avoidSide;if(hitsWall(e.x+mx*.65,e.z+mz*.65,e.r+.03)){e.avoidSide*=-1;mx=-vz*e.avoidSide;mz=vx*e.avoidSide;}}
      e.x+=mx*e.speed*Math.abs(move)*dt;e.z+=mz*e.speed*Math.abs(move)*dt;resolve(e);
    }
    for(const o of enemies){if(o===e)continue;const sx=e.x-o.x,sz=e.z-o.z,sd=Math.hypot(sx,sz),min=e.r+o.r;if(sd>0&&sd<min){e.x+=sx/sd*(min-sd)*.25;e.z+=sz/sd*(min-sd)*.25;}}
    resolve(e);
    const wanted=e.speed*Math.abs(move)*dt,moved=Math.hypot(e.x-oldX,e.z-oldZ);if(move!==0&&wanted>.001&&moved<wanted*.16)e.stuck=(e.stuck||0)+dt;else e.stuck=Math.max(0,(e.stuck||0)-dt*2);if(e.stuck>.28){e.stuck=0;e.escapeTime=.5;e.avoidSide*=-1;e.navTime=0;}
    if(e.hp<=0){enemyDeath(e);enemies.splice(i,1);}
  }

  for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.x+=b.vx*dt;b.z+=b.vz*dt;b.life-=dt;if(b.life<=0||hitsWall(b.x,b.z,b.size)){if(b.life>0)burst(b.x,b.z,b.color,4,2);bullets.splice(i,1);continue;}if(b.owner==='player'){let hit=false;for(const e of enemies){const rr=e.r+b.size;if((b.x-e.x)**2+(b.z-e.z)**2<rr*rr){e.hp-=b.damage;e.hit=.12;addCharge(3.5);burst(b.x,b.z,b.color,5,3);score+=5;updateUI();hit=true;break;}}if(hit){bullets.splice(i,1);continue;}}else if(b.owner==='enemy'){const rr=player.r+b.size;if((b.x-player.x)**2+(b.z-player.z)**2<rr*rr){damagePlayer(b.damage);bullets.splice(i,1);continue;}}}
  for(let i=stars.length-1;i>=0;i--){const s=stars[i];s.life-=dt;s.t+=dt*3;if((s.x-player.x)**2+(s.z-player.z)**2<2.2){score+=75;addCharge(8);burst(s.x,s.z,[1,.85,.1],10,4);stars.splice(i,1);updateUI();}else if(s.life<=0)stars.splice(i,1);}
  for(let i=pickups.length-1;i>=0;i--){const p=pickups[i];p.life-=dt;p.t+=dt*4;if((p.x-player.x)**2+(p.z-player.z)**2<2.1){player.hp=Math.min(player.maxHp,player.hp+35);burst(p.x,p.z,[.25,1,.45],14,5);pickups.splice(i,1);updateUI();}else if(p.life<=0)pickups.splice(i,1);}
  for(let i=coins.length-1;i>=0;i--){const c=coins[i];c.life-=dt;c.t+=dt*5;const dx=player.x-c.x,dz=player.z-c.z,d=Math.hypot(dx,dz)||1;if(d<3.6){const pull=(3.7-d)*8;c.vx+=dx/d*pull*dt;c.vz+=dz/d*pull*dt;}c.x+=c.vx*dt;c.z+=c.vz*dt;c.vx*=Math.pow(.10,dt);c.vz*=Math.pow(.10,dt);resolve(c);if(d<1.25){walletCoins++;runCoins++;profile.coins=walletCoins;saveProgress();score+=15;burst(c.x,c.z,[1,.78,.08],8,3.5);coins.splice(i,1);updateUI();updateLobby();}else if(c.life<=0)coins.splice(i,1);}
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=10*dt;p.vx*=.97;p.vz*=.97;if(p.y<.05){p.y=.05;p.vy*=-.25;}if(p.life<=0)particles.splice(i,1);}
  shake=Math.max(0,shake-dt);if(messageClock>0){messageClock-=dt;if(messageClock<=0)ui.centerMsg.style.opacity='0';}
}

function screenToGround(cx,cy){const r=canvas.getBoundingClientRect(),x=(cx-r.left)/r.width*2-1,y=1-(cy-r.top)/r.height*2;const near=M4.transformPoint(invVP,x,y,-1,1),far=M4.transformPoint(invVP,x,y,1,1);for(const p of [near,far]){p[0]/=p[3];p[1]/=p[3];p[2]/=p[3];}const dy=far[1]-near[1],t=Math.abs(dy)<1e-5?0:-near[1]/dy;mouse.worldX=near[0]+(far[0]-near[0])*t;mouse.worldZ=near[2]+(far[2]-near[2])*t;}
function resize(){const dprLimit=isMobileDevice?1.22:1.75,dpr=Math.min(devicePixelRatio||1,dprLimit),w=Math.floor(innerWidth*dpr),h=Math.floor(innerHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}M4.perspective(proj,Math.PI/3,w/h,.1,100);}
function healthBar(x,z,hp,maxHp,y=2.2,width=1.25){draw(mesh.cube,x,y,z,width,.075,.08,0,[.16,.12,.16]);const f=Math.max(0,hp/maxHp);draw(mesh.cube,x-(width*(1-f)),y+.01,z,width*f,.08,.085,0,f>.45?[.2,.95,.35]:[1,.25,.18]);}
function render(){
  resize();const sx=shake?rnd(-shake,shake)*.35:0,sz=shake?rnd(-shake,shake)*.35:0;const focusX=player?.x||0,focusZ=player?.z||0;
  // Każdy gracz widzi własną postać od dołu ekranu. Druga strona dostaje
  // lustrzany widok areny: kamera obraca się o 180 stopni, a sterowanie
  // jest odwracane w updateDuel, więc W zawsze oznacza ruch w górę ekranu.
  if(duelActive&&duelMirrorView)M4.lookAt(view,[focusX-sx,20,focusZ-15-sz],[focusX,0,focusZ+1],[0,1,0]);
  else M4.lookAt(view,[focusX+sx,20,focusZ+15+sz],[focusX,0,focusZ-1],[0,1,0]);
  M4.multiply(viewProj,proj,view);M4.invert(invVP,viewProj);if(isMobileDevice)updateMobileAimScreen();screenToGround(mouse.x,mouse.y);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.clearColor(.08,.14,.24,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.uniformMatrix4fv(loc.vp,false,viewProj);gl.uniform3f(loc.light,.45,-1,.35);
  // podłoże i delikatna kratka
  draw(mesh.cube,0,-.45,0,20,.45,20,0,[.20,.49,.38]);
  const floorStep=isMobileDevice?6:4,floorHalf=floorStep*.46;for(let x=-18+floorStep/2;x<18;x+=floorStep)for(let z=-18+floorStep/2;z<18;z+=floorStep)draw(mesh.cube,x,-.015,z,floorHalf,.02,floorHalf,0,(Math.round((x+z)/floorStep)%2===0)?[.24,.57,.43]:[.22,.53,.40]);
  // granice
  draw(mesh.cube,0,.45,-19,20,.9,.55,0,[.18,.23,.35]);draw(mesh.cube,0,.45,19,20,.9,.55,0,[.18,.23,.35]);draw(mesh.cube,-19,.45,0,.55,.9,20,0,[.18,.23,.35]);draw(mesh.cube,19,.45,0,.55,.9,20,0,[.18,.23,.35]);
  if(!duelActive)for(const o of obstacles){draw(mesh.cube,o.x,o.h/2-.02,o.z,o.w/2,o.h/2,o.d/2,0,o.c);draw(mesh.cube,o.x,o.h+.05,o.z,o.w*.43,.08,o.d*.43,0,[Math.min(1,o.c[0]+.12),Math.min(1,o.c[1]+.12),Math.min(1,o.c[2]+.12)]);}
  if(duelActive)for(const o of duelWalls){draw(mesh.cube,o.x,o.h/2-.02,o.z,o.w/2,o.h/2,o.d/2,0,o.c);draw(mesh.cube,o.x,o.h+.04,o.z,o.w*.43,.07,o.d*.42,0,[.48,.53,.68]);}
  if(!duelActive)for(const b of bushes){for(let k=0;k<5;k++){const a=k/5*Math.PI*2;draw(mesh.sphere,b[0]+Math.cos(a)*.55,.45,b[1]+Math.sin(a)*.55,.7,.55,.7,0,[.08,.48,.22]);}}
  if(duelActive)for(const b of duelBushes){for(let k=0;k<7;k++){const a=k/7*Math.PI*2,r=k%2?.75:.42;draw(mesh.sphere,b.x+Math.cos(a)*r,.43,b.z+Math.sin(a)*r,.72,.53,.72,0,[.06,.48,.20],.90);}draw(mesh.sphere,b.x,.45,b.z,.82,.56,.82,0,[.08,.56,.24],.88);}
  if(!duelActive)for(const s of stars){const bob=Math.sin(s.t)*.15;draw(mesh.sphere,s.x,.55+bob,s.z,.36,.15,.36,s.t,[1,.85,.12]);draw(mesh.sphere,s.x,.55+bob,s.z,.15,.42,.15,s.t,[1,.65,.05]);}
  if(!duelActive)for(const p of pickups){const bob=Math.sin(p.t)*.13;draw(mesh.cube,p.x,.55+bob,p.z,.42,.42,.42,p.t*.5,[.2,.95,.4]);draw(mesh.cube,p.x,.57+bob,p.z,.12,.47,.13,0,[1,1,1]);draw(mesh.cube,p.x,.57+bob,p.z,.47,.12,.13,0,[1,1,1]);}
  if(!duelActive)for(const c of coins){const bob=Math.sin(c.t)*.12,pulse=1+Math.sin(c.t*1.7)*.08;draw(mesh.cyl,c.x,.42+bob,c.z,.30*pulse,.075,.30*pulse,c.t,[1,.72,.04]);draw(mesh.cyl,c.x,.50+bob,c.z,.19*pulse,.018,.19*pulse,-c.t,[1,.92,.28]);}
  // gracz i wybrana skórka z lobby
  if(player){
    const blink=player.inv>0&&Math.floor(player.inv*18)%2===0,cosmic=profile.skin==='cosmic',arenaVip=profile.skin==='arena_vip_plus',anim=performance.now()*.002;
    const hyperOn=(player.hyperActive||0)>0;
    draw(mesh.cyl,player.x,.12,player.z,hyperOn?1.18:.95,.05,hyperOn?1.18:.95,0,hyperOn?[.22,1,.82]:(player.super>=100?[1,.3,.9]:(cosmic?[.48,.18,.88]:[.12,.55,.95])),.8);
    if(hyperOn){const pulse=1+Math.sin(anim*5)*.08;draw(mesh.sphere,player.x,.82,player.z,.92*pulse,1.02*pulse,.92*pulse,0,[.25,1,.82],.16);}
    if(!blink){
      if(arenaVip){
        draw(mesh.sphere,player.x,.82,player.z,.74,.84,.74,0,[.52,.10,.74]);
        draw(mesh.sphere,player.x,.84,player.z,.56,.67,.56,0,[1,.22,.38]);
        draw(mesh.sphere,player.x,.98,player.z,.48,.30,.48,0,[1,.92,.20],.75);
        draw(mesh.cube,player.x+Math.sin(player.angle)*.76,.82,player.z+Math.cos(player.angle)*.76,.20,.20,.64,player.angle,[.20,.05,.34]);
        for(let k=0;k<3;k++){const a=anim*1.8+k*Math.PI*2/3;draw(mesh.sphere,player.x+Math.sin(a)*1.05,.72+k*.17,player.z+Math.cos(a)*1.05,.10,.18,.10,0,k===0?[1,.92,.18]:(k===1?[1,.22,.58]:[.25,.95,1]));}
        draw(mesh.sphere,player.x,.82,player.z,.82,.92,.82,0,[1,.35,.75],.16);
      }else if(cosmic){
        draw(mesh.sphere,player.x,.82,player.z,.72,.82,.72,0,[.22,.10,.48]);
        draw(mesh.sphere,player.x,.84,player.z,.53,.66,.53,0,[.42,.20,.82]);
        draw(mesh.sphere,player.x,.90,player.z,.62,.43,.62,0,[.25,.95,1],.35);
        draw(mesh.cube,player.x+Math.sin(player.angle)*.75,.82,player.z+Math.cos(player.angle)*.75,.18,.18,.62,player.angle,[.12,.04,.30]);
        draw(mesh.sphere,player.x+Math.sin(anim)*1.02,.93,player.z+Math.cos(anim)*1.02,.11,.11,.11,0,[1,.55,.95]);
        draw(mesh.sphere,player.x+Math.sin(anim+2.1)*1.02,.62,player.z+Math.cos(anim+2.1)*1.02,.09,.09,.09,0,[.25,1,1]);
        draw(mesh.sphere,player.x+Math.sin(anim+4.2)*1.02,1.13,player.z+Math.cos(anim+4.2)*1.02,.08,.08,.08,0,[1,.9,.25]);
        draw(mesh.sphere,player.x,.82,player.z,.79,.88,.79,0,[.68,.38,1],.14);
      }else{
        draw(mesh.sphere,player.x,.82,player.z,.72,.82,.72,0,[.12,.55,1]);draw(mesh.sphere,player.x,.82,player.z,.49,.62,.49,0,[.18,.75,1]);draw(mesh.cube,player.x+Math.sin(player.angle)*.75,.82,player.z+Math.cos(player.angle)*.75,.18,.18,.62,player.angle,[.12,.18,.28]);draw(mesh.sphere,player.x,.82,player.z,.78,.86,.78,0,[.5,.85,1],.13);
      }
    }
    healthBar(player.x,player.z,player.hp,player.maxHp,2.05,1.25);
  }
  if(duelActive&&duelOpponent&&!duelOpponent.hidden){
    const o=duelOpponent,ox=o.renderX??o.x,oz=o.renderZ??o.z,oa=o.renderAngle??normalizeDuelAngle(o.angle),cosmic=o.skin==='cosmic',arenaVip=o.skin==='arena_vip_plus',anim=performance.now()*.002;
    draw(mesh.cyl,ox,.12,oz,.98,.05,.98,0,[1,.25,.55],.8);
    if(arenaVip){draw(mesh.sphere,ox,.82,oz,.74,.84,.74,0,[.58,.08,.60]);draw(mesh.sphere,ox,.84,oz,.56,.67,.56,0,[1,.22,.32]);draw(mesh.sphere,ox,.98,oz,.48,.30,.48,0,[1,.88,.18],.72);draw(mesh.cube,ox+Math.sin(oa)*.76,.82,oz+Math.cos(oa)*.76,.20,.20,.64,oa,[.24,.04,.28]);for(let k=0;k<3;k++){const a=anim*1.8+k*Math.PI*2/3;draw(mesh.sphere,ox+Math.sin(a)*1.05,.72+k*.17,oz+Math.cos(a)*1.05,.10,.18,.10,0,k===0?[1,.92,.18]:(k===1?[1,.22,.58]:[.25,.95,1]));}draw(mesh.sphere,ox,.82,oz,.82,.92,.82,0,[1,.35,.62],.15);}
    else if(cosmic){draw(mesh.sphere,ox,.82,oz,.72,.82,.72,0,[.43,.10,.48]);draw(mesh.sphere,ox,.84,oz,.53,.66,.53,0,[.78,.20,.68]);draw(mesh.sphere,ox,.90,oz,.62,.43,.62,0,[1,.42,.85],.32);draw(mesh.cube,ox+Math.sin(oa)*.75,.82,oz+Math.cos(oa)*.75,.18,.18,.62,oa,[.30,.04,.20]);draw(mesh.sphere,ox+Math.sin(anim)*1.02,.93,oz+Math.cos(anim)*1.02,.11,.11,.11,0,[1,.72,.25]);}
    else{draw(mesh.sphere,ox,.82,oz,.72,.82,.72,0,[.93,.18,.42]);draw(mesh.sphere,ox,.82,oz,.49,.62,.49,0,[1,.37,.58]);draw(mesh.cube,ox+Math.sin(oa)*.75,.82,oz+Math.cos(oa)*.75,.18,.18,.62,oa,[.28,.10,.18]);draw(mesh.sphere,ox,.82,oz,.78,.86,.78,0,[1,.55,.70],.13);}
    healthBar(ox,oz,o.hp,o.maxHp,2.05,1.25);
  }
  if(!duelActive)for(const e of enemies){draw(mesh.cyl,e.x,.11,e.z,e.r*1.18,.04,e.r*1.18,0,e.color,.65);const c=e.hit>0?[1,1,1]:e.color;draw(mesh.sphere,e.x,e.r*.95,e.z,e.r,e.r*1.05,e.r,0,c);draw(mesh.sphere,e.x,e.r*1.14,e.z,e.r*.62,e.r*.63,e.r*.62,0,[Math.min(1,c[0]+.22),Math.min(1,c[1]+.22),Math.min(1,c[2]+.22)]);if(e.type==='shooter')draw(mesh.cube,e.x+Math.sin(e.angle)*e.r*.95,e.r*.95,e.z+Math.cos(e.angle)*e.r*.95,.16,.16,.58,e.angle,[.18,.16,.19]);if(e.type==='tank'){draw(mesh.cube,e.x,e.r*1.05,e.z,e.r*.95,.24,e.r*.95,0,[.25,.11,.31]);}for(let lv=0;lv<(e.level||1);lv++)draw(mesh.sphere,e.x+(lv-((e.level||1)-1)/2)*.24,e.r*2.28,e.z,.08,.08,.08,0,[1,.78,.12]);healthBar(e.x,e.z,e.hp,e.maxHp,e.r*2.35,e.r*.9);}
  if(duelActive){for(const b of duelServerBullets){const mine=b.ownerId===playerId,c=mine?(profile.skin==='arena_vip_plus'?[1,.35,.72]:(profile.skin==='cosmic'?[.78,.38,1]:[.24,.85,1])):[1,.25,.48];draw(mesh.sphere,b.renderX??b.x,.72,b.renderZ??b.z,.21,.21,.21,0,c);}for(const b of duelBotBullets)draw(mesh.sphere,b.x,.72,b.z,.21,.21,.21,0,b.color||[1,.25,.48]);const pc=profile.skin==='arena_vip_plus'?[1,.35,.72]:(profile.skin==='cosmic'?[.78,.38,1]:[.24,.85,1]);for(const b of duelPredictedBullets)draw(mesh.sphere,b.x,.72,b.z,.20,.20,.20,0,b.color||pc,.78);}else for(const b of bullets)draw(mesh.sphere,b.x,b.y,b.z,b.size,b.size,b.size,0,b.color);
  for(const p of particles)draw(mesh.cube,p.x,p.y,p.z,p.size,p.size,p.size,0,p.color,Math.max(0,p.life*2));
}
let lastRenderedFrame=0;const targetFrameMs=isMobileDevice?1000/45:1000/60;function loop(now){requestAnimationFrame(loop);if(document.hidden||!running){last=now;lastRenderedFrame=now;return;}if(now-lastRenderedFrame<targetFrameMs)return;const dt=Math.min(.033,(now-last)/1000);last=now;lastRenderedFrame=now;update(dt);render();}requestAnimationFrame(loop);

setupMobileControls();

addEventListener('keydown',e=>{keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='KeyQ'&&!e.repeat)superAttack();if(e.code==='KeyE'&&!e.repeat)activateHyper();if(e.code==='KeyR'&&!e.repeat&&running)startGame();if(e.code==='Digit1'&&!e.repeat)buyUpgrade('move');if(e.code==='Digit2'&&!e.repeat)buyUpgrade('fire');if(e.code==='Digit3'&&!e.repeat)buyUpgrade('hp');});
addEventListener('keyup',e=>keys[e.code]=false);
canvas.addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;ui.crosshair.style.left=e.clientX+'px';ui.crosshair.style.top=e.clientY+'px';});
canvas.addEventListener('mousedown',e=>{if(e.button===0){mouse.down=true;playerShoot();}});addEventListener('mouseup',e=>{if(e.button===0)mouse.down=false;});canvas.addEventListener('contextmenu',e=>e.preventDefault());
if(ui.versionOneBtn)ui.versionOneBtn.addEventListener('click',buyVersionOne);
if(ui.saveNameBtn)ui.saveNameBtn.addEventListener('click',saveOnlineName);
if(ui.nicknameInput){ui.nicknameInput.value=profile.name;ui.nicknameInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveOnlineName();}});}
if(ui.modeBtn)ui.modeBtn.addEventListener('click',e=>{e.stopPropagation();toggleModeMenu();});
if(ui.soloModeOption)ui.soloModeOption.addEventListener('click',chooseSoloMode);
if(ui.duelModeOption)ui.duelModeOption.addEventListener('click',chooseDuelMode);
if(ui.duelCancelBtn)ui.duelCancelBtn.addEventListener('click',cancelDuelQueue);
document.addEventListener('click',e=>{if(ui.modeMenu&&!ui.modeMenu.contains(e.target)&&e.target!==ui.modeBtn)toggleModeMenu(false);});
ui.playBtn?.addEventListener('click',startGame);
ui.retryBtn?.addEventListener('click',startGame);
ui.lobbyBtn?.addEventListener('click',showLobby);
for(const button of ui.upgradeButtons)button.addEventListener('click',()=>buyUpgrade(button.dataset.upgrade));
for(const card of ui.skinCards){card.addEventListener('click',()=>selectSkin(card.dataset.skin));card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectSkin(card.dataset.skin);}});}





// ---------- Sklep: pakiety monet i skiny ----------
let coinShopCatalog=null;
function setCoinShopMessage(text='',bad=false){
  if(!ui.coinShopMessage)return;
  ui.coinShopMessage.textContent=text;
  ui.coinShopMessage.classList.toggle('good',!bad&&!!text);
  ui.coinShopMessage.style.color=bad?'#ff9aac':'';
}
function switchStoreTab(tab='coins'){
  const wanted=tab==='skins'?'skins':'coins';
  for(const button of ui.storeTabs){const active=button.dataset.storeTab===wanted;button.classList.toggle('active',active);button.setAttribute('aria-selected',active?'true':'false');}
  for(const pane of ui.storePanes)pane.classList.toggle('active',pane.dataset.storePane===wanted);
}
function storeOpen(open=true,tab='coins'){
  if(!ui.storeOverlay)return;
  ui.storeOverlay.classList.toggle('open',open);
  ui.storeOverlay.setAttribute('aria-hidden',open?'false':'true');
  if(open){switchStoreTab(tab);setCoinShopMessage('');loadCoinShopCatalog();}
}
function renderCoinShopCatalog(catalog){
  coinShopCatalog=catalog;
  const products=new Map((catalog?.packages||[]).map(product=>[product.id,product]));
  for(const button of ui.coinPackButtons){
    const product=products.get(button.dataset.coinPack);
    if(!product)continue;
    button.textContent=`KUP ZA ${product.pricePln} ZŁ`;
    button.classList.toggle('unconfigured',!product.paymentConfigured);
    button.dataset.paymentUrl=product.paymentUrl||'';
    button.setAttribute('aria-label',`${Number(product.coins).toLocaleString('pl-PL')} monet za ${product.pricePln} zł`);
  }
}
async function loadCoinShopCatalog(){
  try{renderCoinShopCatalog(await api('/api/shop/catalog'));}
  catch(e){setCoinShopMessage(e?.message||'Nie udało się wczytać sklepu.',true);}
}
function buyCoinPackage(packageId){
  const product=(coinShopCatalog?.packages||[]).find(item=>item.id===packageId);
  if(!product){setCoinShopMessage('Oferta nie została jeszcze wczytana.',true);loadCoinShopCatalog();return;}
  if(!product.paymentUrl){setCoinShopMessage('Ta płatność nie jest jeszcze podłączona. Administrator musi dodać link płatniczy w Renderze.',true);return;}
  window.open(product.paymentUrl,'_blank','noopener,noreferrer');
  setCoinShopMessage(`Otwarto płatność: ${Number(product.coins).toLocaleString('pl-PL')} monet za ${product.pricePln} zł.`,false);
}
ui.storeOpenBtn?.addEventListener('click',()=>storeOpen(true,'coins'));
ui.storeCloseBtn?.addEventListener('click',()=>storeOpen(false));
ui.storeOverlay?.addEventListener('click',event=>{if(event.target===ui.storeOverlay)storeOpen(false);});
for(const tab of ui.storeTabs)tab.addEventListener('click',()=>switchStoreTab(tab.dataset.storeTab));
for(const button of ui.coinPackButtons)button.addEventListener('click',()=>buyCoinPackage(button.dataset.coinPack));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&ui.storeOverlay?.classList.contains('open'))storeOpen(false);});


// ---------- Konta użytkowników, sesje i czat ----------
const authUI={overlay:$('authOverlay'),card:$('authCard'),banCard:$('banCard'),msg:$('authMsg'),registerUser:$('registerUsername'),registerEmail:$('registerEmail'),registerPassword:$('registerPassword'),registerBtn:$('registerBtn'),loginUser:$('loginUsername'),loginPassword:$('loginPassword'),loginBtn:$('loginBtn'),banReason:$('banReason'),banUntil:$('banUntil'),accountUsername:$('accountUsername'),logout:$('accountLogoutBtn')};
const chatUI={overlay:$('chatOverlay'),open:$('chatOpenBtn'),close:$('chatCloseBtn'),users:$('chatUsers'),search:$('chatSearch'),header:$('chatHeader'),messages:$('chatMessages'),input:$('chatInput'),send:$('chatSendBtn'),status:$('chatStatus'),badge:$('chatBadge'),modeAll:$('chatModeAll'),modePrivate:$('chatModePrivate'),publicInfo:$('chatPublicInfo'),privatePicker:$('chatPrivatePicker')};
let currentAccount=null,authFinished=false,chatMode='broadcast',chatRecipientId='',chatRecipientName='',chatPollTimer=0,chatKnownLast=0,chatUnread=0;
function authMessage(text,bad=false){if(authUI.msg){authUI.msg.textContent=text||'';authUI.msg.style.color=bad?'#ff9aac':'#ffe08a';authUI.msg.classList.toggle('authError',bad);}}
function showAccountBan(data){if(!authUI.overlay)return;authUI.overlay.classList.remove('hidden');authUI.card.style.display='none';authUI.banCard.style.display='block';authUI.banReason.textContent=data.banReason||'Blokada konta';const until=Number(data.bannedUntil)||0;authUI.banUntil.textContent=until?`Koniec blokady: ${new Date(until*1000).toLocaleString('pl-PL')}`:'Blokada aktywna';}
function setAuthPane(name){document.querySelectorAll('.authTab').forEach(x=>x.classList.toggle('active',x.dataset.authTab===name));document.querySelectorAll('.authPane').forEach(x=>x.classList.toggle('active',x.dataset.authPane===name));authMessage('');}
function applyServerProfile(serverProfile){if(!serverProfile)return;const mergedData={...(profile.data||{}),...(serverProfile.data||{})};const arenaOwned=serverProfile.arenaSkinOwned===true||mergedData.arenaVipPlusSkinOwned===true;profile={...profile,...serverProfile,data:mergedData,ownedSkins:{classic:true,cosmic:serverProfile.cosmicOwned===true,arena_vip_plus:arenaOwned},heroVersion1:serverProfile.heroVersion1===true,upgrades:{...profile.upgrades,...(serverProfile.upgrades||{})}};if(serverProfile.data?.mode)profile.mode=serverProfile.data.mode;if(profile.skin==='arena_vip_plus'&&!arenaOwned)profile.skin='classic';walletCoins=profile.coins||0;saveProgress(false);}
async function completeAccountLogin(data){
  currentAccount=data?.account;
  if(!currentAccount)return;
  const accountId=currentAccount.playerId||currentAccount.id;
  if(accountId&&accountId!==playerId){
    playerId=accountId;
    window.__arenaPlayerId=playerId;
    try{localStorage.setItem(PLAYER_ID_KEY,accountId);}catch(_){}
  }
  ownerFreeShop=currentAccount.ownerBenefits===true;
  if(ownerFreeShop){
    profile.data={...(profile.data||{}),arenaVipPlusSkinOwned:true,arenaPassTier:'vip_plus'};
    profile.ownedSkins={...(profile.ownedSkins||{}),classic:true,arena_vip_plus:true};
  }
  const adminButton=$('adminOpenBtn');
  if(adminButton){adminButton.hidden=!ownerFreeShop;adminButton.style.display=ownerFreeShop?'':'none';}
  profile.name=safePlayerName(currentAccount.username);
  persistNickname(profile.name);
  applyServerProfile(data.profile);
  if(ui.nicknameInput){ui.nicknameInput.value=profile.name;ui.nicknameInput.disabled=true;}
  if(ui.saveNameBtn){ui.saveNameBtn.disabled=true;ui.saveNameBtn.textContent='NAZWA KONTA';}
  if(authUI.accountUsername)authUI.accountUsername.textContent=currentAccount.username;
  if(currentAccount.emailRequired){
    authFinished=false;
    authUI.overlay.classList.remove('hidden');
    authUI.card.style.display='block';
    authUI.banCard.style.display='none';
    window.ArenaAccountUI?.requireEmail?.(currentAccount);
    return;
  }
  authUI.overlay.classList.add('hidden');
  authUI.card.style.display='block';
  authUI.banCard.style.display='none';
  authFinished=true;
  updateLobby();
  syncProfile().then(fetchRanking).catch(()=>{});
  startChatPolling();
  if(isMobileDevice){
    scheduleMobileViewportRefresh();
    if(!mobileFullscreenActive())setTimeout(()=>{scheduleMobileViewportRefresh();showMobileFullscreenGate(null,'lobby');},420);
  }
}
function setDatabaseGuard(text=''){
  const box=$('databaseGuardMessage');
  if(box){box.hidden=!text;box.textContent=text||'';}
  const blocked=!!text;
  for(const id of ['registerBtn','loginBtn','resetRequestBtn']){
    const button=$(id);
    if(button)button.disabled=blocked;
  }
}
async function verifyPersistentDatabase(){
  try{
    const response=await fetch('/api/health',{cache:'no-store',credentials:'same-origin'});
    const status=await response.json().catch(()=>({}));
    if(status.sqlRequired&&status.persistent!==true){
      const text=status.error||'Baza Neon SQL nie jest podłączona.';
      setDatabaseGuard(`DANE KONTA NIE ZOSTANĄ UTWORZONE\n${text}`);
      authMessage('Administrator musi ponownie podłączyć DATABASE_URL w Renderze.',true);
      authUI.overlay.classList.remove('hidden');
      return false;
    }
    setDatabaseGuard('');
    return true;
  }catch(e){
    setDatabaseGuard('Nie można sprawdzić połączenia z pamięcią SQL.');
    authMessage('Serwer bazy danych nie odpowiada.',true);
    authUI.overlay.classList.remove('hidden');
    return false;
  }
}
async function authBootstrap(){
  if(!(await verifyPersistentDatabase()))return;
  try{
    const data=await api('/api/auth/status');
    if(data.authenticated){
      if(data.account?.banned){showAccountBan(data.account);return;}
      await completeAccountLogin(data);
    }else authUI.overlay.classList.remove('hidden');
  }catch(e){
    authMessage(e?.message||'Serwer kont nie odpowiada. Odśwież stronę za chwilę.',true);
  }
}
window.addEventListener('arena-auth-success',event=>{
  completeAccountLogin(event.detail||window.__arenaPendingAuth||{}).catch(()=>authMessage('Nie udało się wczytać profilu po zalogowaniu.',true));
});
if(window.__arenaPendingAuth){
  queueMicrotask(()=>completeAccountLogin(window.__arenaPendingAuth).catch(()=>authMessage('Nie udało się wczytać profilu po zalogowaniu.',true)));
}

let authBusy=false;
function setAuthButtonBusy(button,busy,label){
  if(!button)return;
  button.disabled=busy;
  button.innerHTML=busy?`<span class="authSpinner"></span>${label}`:label;
}
async function authSubmit(kind){
  if(authBusy)return;
  const register=kind==='register';
  const userInput=register?authUI.registerUser:authUI.loginUser;
  const passInput=register?authUI.registerPassword:authUI.loginPassword;
  const button=register?authUI.registerBtn:authUI.loginBtn;
  const normalLabel=register?'UTWÓRZ KONTO':'ZALOGUJ SIĘ';
  const username=(userInput?.value||'').trim();
  const password=passInput?.value||'';
  if(!username){authMessage('Wpisz nazwę konta.',true);userInput?.focus();return;}
  if(!password){authMessage('Wpisz hasło do konta.',true);passInput?.focus();return;}
  if(register&&password.length<6){authMessage('Hasło nowego konta musi mieć minimum 6 znaków.',true);passInput?.focus();return;}
  authBusy=true;
  setAuthButtonBusy(button,true,register?'TWORZENIE…':'LOGOWANIE…');
  authMessage('Łączenie z bazą kont. Pierwsze połączenie po uśpieniu serwera może potrwać kilkanaście sekund…');
  try{
    const data=await api(register?'/api/auth/register':'/api/auth/login',{
      method:'POST',
      body:JSON.stringify({username,password,email:register?(authUI.registerEmail?.value||'').trim():undefined,playerId}),
      timeoutMs:35000
    });
    authMessage('Zalogowano. Wczytywanie profilu…');
    await completeAccountLogin(data);
  }catch(e){
    let message=e?.message||'Nie udało się zalogować.';
    if(e?.name==='AbortError'||/abort|timeout/i.test(message))message='Serwer odpowiada zbyt długo. Poczekaj 10 sekund i kliknij ZALOGUJ SIĘ ponownie.';
    else if(e?.status===404)message='Takie konto nie istnieje. Kliknij UTWÓRZ KONTO, jeżeli chcesz je założyć.';
    else if(e?.status===401)message='Nieprawidłowe hasło do tego konta.';
    else if(e?.status===503||e?.status===500)message='Baza kont chwilowo nie odpowiada. Poczekaj kilka sekund i spróbuj ponownie.';
    authMessage(message,true);
  }finally{
    authBusy=false;
    setAuthButtonBusy(button,false,normalLabel);
  }
}
document.querySelectorAll('.authTab').forEach(x=>x.addEventListener('click',event=>{event.preventDefault();setAuthPane(x.dataset.authTab);}));
authUI.registerBtn?.addEventListener('click',event=>{event.preventDefault();authSubmit('register');});
authUI.loginBtn?.addEventListener('click',event=>{event.preventDefault();authSubmit('login');});
authUI.registerPassword?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();authSubmit('register');}});
authUI.loginPassword?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();authSubmit('login');}});
authUI.logout?.addEventListener('click',async()=>{await api('/api/auth/logout',{method:'POST',body:'{}'}).catch(()=>{});location.reload();});

function chatEscape(value){return escapeRankingName(String(value||''));}
function setChatMode(mode){
  chatMode=mode==='private'?'private':'broadcast';
  chatUI.modeAll?.classList.toggle('active',chatMode==='broadcast');
  chatUI.modePrivate?.classList.toggle('active',chatMode==='private');
  if(chatUI.publicInfo)chatUI.publicInfo.hidden=chatMode!=='broadcast';
  if(chatUI.privatePicker)chatUI.privatePicker.hidden=chatMode!=='private';
  if(chatMode==='broadcast'){
    chatRecipientId='';
    chatRecipientName='';
    if(chatUI.input)chatUI.input.placeholder='Napisz wiadomość na cały serwer...';
  }else{
    if(chatUI.input)chatUI.input.placeholder=chatRecipientId?`Napisz prywatnie do ${chatRecipientName}...`:'Najpierw wybierz odbiorcę...';
    loadChatUsers();
  }
  updateChatHeader();
}
function updateChatHeader(){
  if(!chatUI.header)return;
  chatUI.header.textContent=chatMode==='broadcast'
    ?'🌍 Piszesz na cały serwer'
    :(chatRecipientId?`🔒 Prywatnie do: ${chatRecipientName}`:'🔒 Wybierz jedną osobę — może być offline');
}
async function loadChatUsers(){
  if(!currentAccount||!chatUI.users||chatMode!=='private')return;
  try{
    const r=await api(`/api/chat/users?q=${encodeURIComponent(chatUI.search?.value||'')}`);
    const users=r.users||[];
    chatUI.users.innerHTML=users.map(u=>`<label class="chatUser${u.online?' online':''}${chatRecipientId===u.id?' selected':''}" data-chat-user="${u.id}" data-chat-name="${chatEscape(u.username)}"><input type="radio" name="chatRecipient" ${chatRecipientId===u.id?'checked':''}><span class="chatUserName">${chatEscape(u.username)}</span></label>`).join('')||'<div class="adminHint">Nie znaleziono takiego konta.</div>';
    chatUI.users.querySelectorAll('[data-chat-user]').forEach(row=>{
      row.addEventListener('click',()=>{
        chatRecipientId=row.dataset.chatUser||'';
        chatRecipientName=row.querySelector('.chatUserName')?.textContent||'';
        chatUI.users.querySelectorAll('.chatUser').forEach(x=>x.classList.toggle('selected',x===row));
        chatUI.users.querySelectorAll('input[type="radio"]').forEach(x=>x.checked=x.closest('.chatUser')===row);
        if(chatUI.input)chatUI.input.placeholder=`Napisz prywatnie do ${chatRecipientName}...`;
        updateChatHeader();
      });
    });
    updateChatHeader();
  }catch(e){
    chatUI.status.textContent='Nie udało się pobrać listy kont.';
  }
}
function renderChat(messages){
  if(!chatUI.messages)return;
  const list=Array.isArray(messages)?messages:[];
  const atBottom=chatUI.messages.scrollTop+chatUI.messages.clientHeight>=chatUI.messages.scrollHeight-60;
  chatUI.messages.innerHTML=list.map(message=>{
    const mine=String(message.senderId||'')===String(playerId||'');
    const recipients=Array.isArray(message.recipients)?message.recipients:[];
    const recipientNames=recipients.map(item=>item?.username||'').filter(Boolean).join(', ');
    const sender=chatEscape(message.sender||'Gracz');
    const direction=mine
      ?`TY → ${message.broadcast?'WSZYSCY':chatEscape(recipientNames||'PRYWATNIE')}`
      :`${sender} → ${message.broadcast?'WSZYSCY':'TY'}`;
    const timestamp=Number(message.createdAt)||0;
    const time=timestamp
      ?new Date(timestamp*1000).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})
      :'';
    return `<div class="chatMessage${mine?' mine':''}"><div class="chatMeta">${direction}${time?` • ${time}`:''}</div>${chatEscape(message.body||'')}</div>`;
  }).join('')||'<div class="adminHint">Nie ma jeszcze wiadomości. Napisz pierwszą wiadomość na cały serwer.</div>';
  if(atBottom||list.length<=1)chatUI.messages.scrollTop=chatUI.messages.scrollHeight;
  const last=Math.max(...list.map(item=>Number(item.id)||0),0);
  const overlayOpen=chatUI.overlay?.classList.contains('open')===true;
  if(!overlayOpen&&last>chatKnownLast&&chatKnownLast>0){
    chatUnread+=1;
    if(chatUI.badge){chatUI.badge.style.display='inline-grid';chatUI.badge.textContent=String(chatUnread);}
  }
  chatKnownLast=Math.max(chatKnownLast,last);
}

let chatSessionRepairBusy=false;
async function repairChatSession(){
  if(chatSessionRepairBusy)return false;
  chatSessionRepairBusy=true;
  try{
    const status=await api('/api/auth/status',{timeoutMs:15000});
    if(status.authenticated){
      currentAccount=status.account;
      applyServerProfile(status.profile);
      return true;
    }
    currentAccount=null;authFinished=false;
    authMessage('Sesja wygasła. Zaloguj się ponownie, aby korzystać z czatu.',true);
    authUI.overlay?.classList.remove('hidden');
    return false;
  }catch(_){return false;}
  finally{chatSessionRepairBusy=false;}
}
async function loadChatMessages(retry=true){
  if(!currentAccount)return;
  try{
    const r=await api('/api/chat/messages',{timeoutMs:15000});
    renderChat(r.messages||[]);
    if(chatUI.status?.textContent==='Czat chwilowo niedostępny.'||chatUI.status?.textContent==='Łączenie z czatem…')chatUI.status.textContent='';
  }catch(e){
    if(e.status===423)return;
    if(e.status===401&&retry&&await repairChatSession())return loadChatMessages(false);
    console.error('Błąd czatu:',e);chatUI.status.textContent=e?.status? (e?.message||'Czat chwilowo niedostępny.') : 'Naprawiono interfejs czatu. Odśwież stronę, jeśli komunikat nadal się wyświetla.';
  }
}
function startChatPolling(){clearInterval(chatPollTimer);loadChatUsers();loadChatMessages();chatPollTimer=setInterval(()=>{if(!document.hidden){loadChatMessages();if(chatUI.overlay.classList.contains('open'))loadChatUsers();}},2500);}
chatUI.open?.addEventListener('click',()=>{
  chatUI.overlay.classList.add('open');
  chatUnread=0;
  chatUI.badge.style.display='none';
  chatUI.status.textContent='Łączenie z czatem…';
  setChatMode('broadcast');
  loadChatMessages();
});
chatUI.close?.addEventListener('click',()=>chatUI.overlay.classList.remove('open'));
chatUI.modeAll?.addEventListener('click',()=>setChatMode('broadcast'));
chatUI.modePrivate?.addEventListener('click',()=>setChatMode('private'));
chatUI.search?.addEventListener('input',()=>loadChatUsers());
chatUI.send?.addEventListener('click',async()=>{
  const body=chatUI.input.value.trim();
  if(!body){chatUI.status.textContent='Wpisz wiadomość.';return;}
  const broadcast=chatMode==='broadcast';
  if(!broadcast&&!chatRecipientId){
    chatUI.status.textContent='Wybierz jedną osobę. Może być offline.';
    return;
  }
  try{
    await api('/api/chat/send',{
      method:'POST',
      body:JSON.stringify({
        recipients:broadcast?[]:[chatRecipientId],
        broadcast,
        body
      })
    });
    chatUI.input.value='';
    chatUI.status.textContent=broadcast
      ?'Wiadomość wysłana na cały serwer.'
      :`Wiadomość prywatna wysłana do ${chatRecipientName}.`;
    await loadChatMessages();
  }catch(e){
    if(e.status===401&&await repairChatSession()){
      chatUI.status.textContent='Sesja czatu została odświeżona. Kliknij WYŚLIJ ponownie.';
    }else{
      chatUI.status.textContent=e.message||'Nie udało się wysłać.';
    }
  }
});
chatUI.input?.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey){
    e.preventDefault();
    chatUI.send.click();
  }
});


// ---------- Panel administratora ----------

// ---------- Arena Karnet: bezpłatny, VIP i VIP+ ----------
let arenaPassState=null,arenaPassBusy=false;
function passTierRank(tier){return {free:0,vip:1,vip_plus:2}[tier]||0;}
function setPassMessage(text='',bad=false){if(!ui.passMessage)return;ui.passMessage.textContent=text;ui.passMessage.style.color=bad?'#ff94aa':'#ffdf83';}
function passOpen(open=true){if(!ui.passOverlay)return;ui.passOverlay.classList.toggle('open',open);ui.passOverlay.setAttribute('aria-hidden',open?'false':'true');if(open){setPassMessage('');loadArenaPass();}}
function passRewardCard(reward,track){
  if(!reward)return `<div class="passReward ${track} empty"><span class="passRewardIcon">—</span><span class="passRewardName">Brak nagrody</span></div>`;
  let state='ZABLOKOWANE',disabled=true;
  if(reward.claimed)state='ODEBRANO';
  else if(!reward.access)state=track==='vip'?'WYMAGA VIP / VIP+':'WYMAGA VIP+';
  else if(!reward.unlocked)state='ZA MAŁO PUNKTÓW';
  else if(reward.claimable){state='ODBIERZ';disabled=false;}
  const classes=['passReward',track,reward.claimed?'claimed':'',reward.claimable?'claimable':'',(!reward.access||!reward.unlocked)?'locked':''].filter(Boolean).join(' ');
  return `<div class="${classes}"><span class="passRewardIcon">${reward.icon||'🎁'}</span><span class="passRewardName">${escapeRankingName(reward.label||'Nagroda')}</span><span class="passRewardState">${state}</span><button type="button" data-pass-track="${track}" data-pass-level="${reward.key?.split(':').pop()||''}"${disabled?' disabled':''}>ODBIERZ</button></div>`;
}
function renderArenaPass(state){
  arenaPassState=state;if(!state||!ui.passGrid)return;
  const tier=state.tier||'free',tierLabels={free:'BEZPŁATNY',vip:'VIP',vip_plus:'VIP+'};
  ui.passPointsText.textContent=`${Math.floor(state.trophies||0).toLocaleString('pl-PL')} pucharków`;
  ui.passTierBadge.textContent=state.ownerBenefits?'VIP+ • WŁAŚCICIEL':tierLabels[tier];ui.passTierBadge.className=`passTierBadge ${tier}`;
  const premiumLevel=Math.min(20,Number(state.premiumLevel)||0),progress=premiumLevel>=20?100:Math.max(0,Math.min(100,((Number(state.trophies)||0)%40)/40*100));ui.passProgressFill.style.width=`${progress}%`;
  ui.passNextText.textContent=premiumLevel>=20?'Wszystkie poziomy karnetu odblokowane.':`Następny poziom: ${(Number(state.nextPremium)||40).toLocaleString('pl-PL')} pucharków • poziom: ${Number(state.freeLevel)||0}/20`;
  ui.passBuyVipBtn.disabled=passTierRank(tier)>=1;ui.passBuyVipPlusBtn.disabled=passTierRank(tier)>=2;
  ui.passBuyVipBtn.textContent=passTierRank(tier)>=1?'VIP AKTYWNY':'ARENA KARNET VIP • 13 ZŁ';ui.passBuyVipPlusBtn.textContent=passTierRank(tier)>=2?'VIP+ AKTYWNY':'ARENA KARNET VIP+ • 21 ZŁ';
  ui.passClaimAllBtn.disabled=!state.claimableCount;ui.passClaimAllBtn.textContent=state.claimableCount?`ODBIERZ WSZYSTKIE (${state.claimableCount})`:'BRAK NAGRÓD DO ODEBRANIA';
  ui.passGrid.innerHTML=(state.levels||[]).map(row=>`<div class="passLevelColumn"><div class="passLevelHead"><span>POZIOM</span><strong>${row.level}</strong><small>${Number(row.premiumThreshold).toLocaleString('pl-PL')} 🏆</small></div>${passRewardCard(row.free,'free')}${passRewardCard(row.vip,'vip')}${passRewardCard(row.vip_plus,'vip_plus')}</div>`).join('');
  ui.passGrid.querySelectorAll('[data-pass-track]').forEach(button=>button.addEventListener('click',()=>claimArenaPass({track:button.dataset.passTrack,level:Number(button.dataset.passLevel)})));
}
async function loadArenaPass(){if(arenaPassBusy||!currentAccount)return;arenaPassBusy=true;try{const state=await api('/api/pass/status');renderArenaPass(state);}catch(e){setPassMessage(e?.message||'Nie udało się wczytać Arena Karnetu.',true);}finally{arenaPassBusy=false;}}
async function claimArenaPass(payload){if(arenaPassBusy)return;arenaPassBusy=true;setPassMessage('Odbieranie nagrody…');try{const result=await api('/api/pass/claim',{method:'POST',body:JSON.stringify(payload)});if(result.profile)applyServerProfile(result.profile);renderArenaPass(result.pass);updateLobby();setPassMessage(`Odebrano ${result.claimed||1} nagrodę/nagrody.`);syncProfile(false).catch(()=>{});}catch(e){setPassMessage(e?.message||'Nie udało się odebrać nagrody.',true);}finally{arenaPassBusy=false;}}
function openArenaPassPayment(tier){const urls=arenaPassState?.paymentUrls||{},url=urls[tier];if(url){window.open(url,'_blank','noopener,noreferrer');setPassMessage('Po opłaceniu administrator aktywuje karnet na Twoim koncie.');}else setPassMessage('Płatność nie jest jeszcze podłączona. Administrator musi ustawić link płatniczy w Renderze.',true);}
ui.passOpenBtn?.addEventListener('click',()=>passOpen(true));ui.passCloseBtn?.addEventListener('click',()=>passOpen(false));ui.passOverlay?.addEventListener('click',e=>{if(e.target===ui.passOverlay)passOpen(false);});ui.passClaimAllBtn?.addEventListener('click',()=>claimArenaPass({claimAll:true}));ui.passBuyVipBtn?.addEventListener('click',()=>openArenaPassPayment('vip'));ui.passBuyVipPlusBtn?.addEventListener('click',()=>openArenaPassPayment('vip_plus'));

const adminUI={overlay:$('adminOverlay'),open:$('adminOpenBtn'),loginCard:$('adminLoginCard'),dashboard:$('adminDashboard'),loginClose:$('adminLoginClose'),close:$('adminCloseBtn'),logout:$('adminLogoutBtn'),password:$('adminPasswordInput'),login:$('adminLoginBtn'),forgot:$('adminForgotBtn'),passwordArea:$('adminPasswordArea'),recoveryArea:$('adminRecoveryArea'),recovery:$('adminRecoveryInput'),recoverBtn:$('adminRecoveryBtn'),back:$('adminBackToPassword'),loginMsg:$('adminLoginMsg'),playerId:$('adminPlayerId'),deployStatus:$('adminDeployStatus'),databaseStatus:$('adminDatabaseStatus'),settingsMsg:$('adminSettingsMsg'),playerMsg:$('adminPlayerMsg'),modesMsg:$('adminModesMsg'),deployMsg:$('adminDeployMsg')};
let adminConfig=null,adminSelectedPlayer=null;
function adminMsg(el,text,bad=false){if(!el)return;el.textContent=text||'';el.classList.toggle('bad',bad);}
function adminOpen(show=true){adminUI.overlay?.classList.toggle('open',show);adminUI.overlay?.setAttribute('aria-hidden',show?'false':'true');if(show)adminCheckStatus();}
async function adminCheckStatus(){try{const s=await api('/api/admin/status');adminUI.playerId.textContent=playerId;adminUI.deployStatus.textContent=s.deploymentConfigured?`WDROŻENIA GOTOWE • ${s.repo||''}`:'BRAK KONFIGURACJI GITHUB';adminUI.deployStatus.className=`adminStatusPill ${s.deploymentConfigured?'ok':'bad'}`;if(s.authorized){await adminShowDashboard();}else{adminUI.loginCard.style.display='block';adminUI.dashboard.style.display='none';if(!s.configured)adminMsg(adminUI.loginMsg,'Najpierw ustaw ADMIN_PASSWORD i ADMIN_RECOVERY_CODE w Renderze.',true);else if(!s.accountMatches)adminMsg(adminUI.loginMsg,'To ID konta nie zgadza się z ADMIN_PLAYER_ID.',true);else adminMsg(adminUI.loginMsg,'');}}catch(e){adminMsg(adminUI.loginMsg,'Serwer panelu nie odpowiada.',true);}}
async function adminAuth(kind){const path=kind==='recovery'?'/api/admin/recover':'/api/admin/login',body={playerId,[kind==='recovery'?'code':'password']:kind==='recovery'?adminUI.recovery.value:adminUI.password.value};try{const r=await api(path,{method:'POST',body:JSON.stringify(body)});if(r.ok)await adminShowDashboard();}catch(e){adminMsg(adminUI.loginMsg,'Nieprawidłowe dane albo konto nie ma dostępu.',true);}}
async function adminRefreshDatabaseStatus(){
  try{
    const s=await api('/api/database/status');
    if(adminUI.databaseStatus){
      adminUI.databaseStatus.textContent=`SQL OK • ${Number(s.accounts||0).toLocaleString('pl-PL')} KONT • ${Number(s.players||0).toLocaleString('pl-PL')} PROFILI`;
      adminUI.databaseStatus.className='adminStatusPill ok';
      adminUI.databaseStatus.title=`Wiadomości: ${s.messages||0}, mecze: ${s.matches||0}, schemat: v${s.schemaVersion||0}`;
    }
  }catch(e){
    if(adminUI.databaseStatus){
      adminUI.databaseStatus.textContent='SQL NIEDOSTĘPNY';
      adminUI.databaseStatus.className='adminStatusPill bad';
      adminUI.databaseStatus.title=e?.message||'Błąd bazy danych';
    }
  }
}
async function adminShowDashboard(){adminUI.loginCard.style.display='none';adminUI.dashboard.style.display='block';await adminRefreshDatabaseStatus();await adminLoadConfig();await adminSearchPlayers('');await adminSearchAccounts('');}
function n(id){return Number($(id)?.value)||0;}function c(id){return !!$(id)?.checked;}
function fillAdminConfig(cfg){adminConfig=cfg;const map={cfgSurvivalBot:'survivalBotLevel',cfgDuelBot:'duelBotLevel',cfgBotWait:'duelBotWaitSeconds',cfgHpMultiplier:'duelHpMultiplier',cfgRounds:'duelMaxRounds',cfgWins:'duelWinsToTakeMatch',cfgWinCoins:'duelWinCoins',cfgWinTrophies:'duelWinTrophies',cfgWinPoints:'duelWinPoints',cfgDrawCoins:'duelDrawCoins',cfgDrawTrophies:'duelDrawTrophies',cfgDrawPoints:'duelDrawPoints',cfgProfanityBanMinutes:'profanityBanMinutes',cfgSqlSyncSeconds:'sqlSyncSeconds'};for(const [id,key] of Object.entries(map))if($(id))$(id).value=cfg[key];$('cfgSoloEnabled').checked=cfg.soloEnabled!==false;$('cfgDuelEnabled').checked=cfg.duelEnabled!==false;$('cfgAnnouncement').value=cfg.announcement||'';renderAdminModes();}
async function adminLoadConfig(){try{const r=await api('/api/admin/config');fillAdminConfig(r.config);}catch(e){adminMsg(adminUI.settingsMsg,'Nie udało się pobrać ustawień.',true);}}
function collectAdminConfig(){return {...adminConfig,survivalBotLevel:n('cfgSurvivalBot'),duelBotLevel:n('cfgDuelBot'),duelBotWaitSeconds:n('cfgBotWait'),duelHpMultiplier:n('cfgHpMultiplier'),duelMaxRounds:n('cfgRounds'),duelWinsToTakeMatch:n('cfgWins'),duelWinCoins:n('cfgWinCoins'),duelWinTrophies:n('cfgWinTrophies'),duelWinPoints:n('cfgWinPoints'),duelDrawCoins:n('cfgDrawCoins'),duelDrawTrophies:n('cfgDrawTrophies'),duelDrawPoints:n('cfgDrawPoints'),profanityBanMinutes:n('cfgProfanityBanMinutes'),sqlSyncSeconds:n('cfgSqlSyncSeconds'),soloEnabled:c('cfgSoloEnabled'),duelEnabled:c('cfgDuelEnabled'),announcement:$('cfgAnnouncement').value,customModes:adminConfig?.customModes||[]};}
async function adminSaveConfig(){try{const r=await api('/api/admin/config',{method:'POST',body:JSON.stringify({config:collectAdminConfig()})});fillAdminConfig(r.config);applyGameConfig(r.config);adminMsg(adminUI.settingsMsg,'Ustawienia zapisane dla wszystkich graczy.');}catch(e){adminMsg(adminUI.settingsMsg,'Nie udało się zapisać ustawień.',true);}}
async function adminSearchPlayers(q){try{const r=await api(`/api/admin/players?q=${encodeURIComponent(q||'')}`),box=$('adminPlayerList');box.innerHTML=(r.players||[]).map(p=>`<div class="adminPlayerRow" data-player="${p.id}"><span><b>${escapeRankingName(p.name)}</b><small>${p.id}</small></span><span>${p.points.toLocaleString('pl-PL')} ⭐<br>${p.trophies.toLocaleString('pl-PL')} 🏆</span></div>`).join('')||'<div class="adminHint">Brak wyników.</div>';box.querySelectorAll('[data-player]').forEach(el=>el.onclick=()=>adminSelectPlayer((r.players||[]).find(p=>p.id===el.dataset.player)));}catch(e){adminMsg(adminUI.playerMsg,'Nie udało się pobrać graczy.',true);}}
function adminSelectPlayer(p){if(!p)return;adminSelectedPlayer=p;$('editPlayerId').value=p.id;$('editPlayerName').value=p.name;$('editPoints').value=p.points;$('editTrophies').value=p.trophies;$('editCoins').value=p.coins;$('editMove').value=p.upgrades?.move||0;$('editFire').value=p.upgrades?.fire||0;$('editHp').value=p.upgrades?.hp||0;$('editSkin').value=p.skin||'classic';$('editPassTier').value=p.arenaPassTier||p.data?.arenaPassTier||'free';$('editCosmic').checked=p.cosmicOwned===true;$('editArenaSkin').checked=p.arenaSkinOwned===true||p.data?.arenaVipPlusSkinOwned===true;$('editVersion').checked=p.heroVersion1===true;}
async function adminSavePlayer(){if(!adminSelectedPlayer){adminMsg(adminUI.playerMsg,'Najpierw wybierz gracza.',true);return;}const body={playerId:$('editPlayerId').value,name:$('editPlayerName').value,points:n('editPoints'),trophies:n('editTrophies'),coins:n('editCoins'),upgrades:{move:n('editMove'),fire:n('editFire'),hp:n('editHp')},skin:$('editSkin').value,cosmicOwned:c('editCosmic'),arenaPassTier:$('editPassTier').value,arenaSkinOwned:c('editArenaSkin'),heroVersion1:c('editVersion')};try{const r=await api('/api/admin/player',{method:'POST',body:JSON.stringify(body)});adminSelectedPlayer=r.player;adminSelectPlayer(r.player);adminMsg(adminUI.playerMsg,'Profil zapisany. Gracz otrzyma zmiany przy następnej synchronizacji.');await adminSearchPlayers($('adminPlayerSearch').value);}catch(e){adminMsg(adminUI.playerMsg,'Nie udało się zapisać profilu.',true);}}
function renderAdminModes(){const box=$('adminModesList');box.innerHTML='';for(const mode of adminConfig?.customModes||[]){const row=document.createElement('div');row.className='adminModeRow';row.dataset.modeId=mode.id;row.innerHTML=`<input class="modeNameInput" value="${escapeRankingName(mode.name)}"><select class="modeBaseInput"><option value="solo"${mode.base==='solo'?' selected':''}>Przetrwanie</option><option value="duel"${mode.base==='duel'?' selected':''}>Pojedynki</option></select><label class="adminCheck"><input class="modeEnabledInput" type="checkbox"${mode.enabled!==false?' checked':''}> Aktywny</label><button class="adminDanger modeDeleteBtn">USUŃ</button><textarea class="modeDescInput" placeholder="Opis">${escapeRankingName(mode.description||'')}</textarea>`;row.querySelector('.modeDeleteBtn').onclick=()=>{adminConfig.customModes=adminConfig.customModes.filter(m=>m.id!==mode.id);renderAdminModes();};box.appendChild(row);}}
function collectAdminModes(){return [...document.querySelectorAll('#adminModesList .adminModeRow')].map((row,i)=>({id:row.dataset.modeId||`tryb-${Date.now()}-${i}`,name:row.querySelector('.modeNameInput').value,description:row.querySelector('.modeDescInput').value,base:row.querySelector('.modeBaseInput').value,enabled:row.querySelector('.modeEnabledInput').checked}));}
async function adminSaveModes(){adminConfig.customModes=collectAdminModes();try{const r=await api('/api/admin/config',{method:'POST',body:JSON.stringify({config:{...collectAdminConfig(),customModes:adminConfig.customModes}})});fillAdminConfig(r.config);applyGameConfig(r.config);adminMsg(adminUI.modesMsg,'Tryby zapisane i widoczne dla wszystkich.');}catch(e){adminMsg(adminUI.modesMsg,'Nie udało się zapisać trybów.',true);}}
function adminAddMode(){adminConfig.customModes=adminConfig.customModes||[];adminConfig.customModes.push({id:`tryb-${Date.now()}`,name:'Nowy tryb',description:'Wariant utworzony przez administratora',base:'solo',enabled:true});renderAdminModes();}
function adminFilesChanged(){
  const file=$('adminFiles')?.files?.[0];
  if(!file){$('adminFileList').textContent='Nie wybrano paczki ZIP.';return;}
  if(!file.name.toLowerCase().endsWith('.zip')){$('adminFileList').textContent='Wybierz plik z rozszerzeniem .zip.';return;}
  $('adminFileList').textContent=`ZIP: ${file.name} • ${(file.size/1024/1024).toFixed(2)} MB`;
}
async function adminDeploy(){
  const file=$('adminFiles')?.files?.[0];
  if(!file||!file.name.toLowerCase().endsWith('.zip')){adminMsg(adminUI.deployMsg,'Wybierz jedną paczkę ZIP.',true);return;}
  if(file.size>40*1024*1024){adminMsg(adminUI.deployMsg,'ZIP jest większy niż 40 MB.',true);return;}
  adminMsg(adminUI.deployMsg,'Wysyłanie ZIP-a, sprawdzanie plików i tworzenie commita…');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),180000);
  try{
    const message=$('adminCommitMessage').value||'Aktualizacja gry z panelu administratora';
    const encodedMessage=btoa(unescape(encodeURIComponent(message))).replace(/=+$/,'');
    const response=await fetch('/api/admin/deploy-zip',{
      method:'POST',
      credentials:'same-origin',
      cache:'no-store',
      signal:controller.signal,
      headers:{
        'Content-Type':'application/zip',
        'X-File-Name':encodeURIComponent(file.name),
        'X-Commit-Message-B64':encodedMessage
      },
      body:file
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(data.error||`HTTP ${response.status}`);error.status=response.status;throw error;}
    adminMsg(adminUI.deployMsg,`Gotowe. Rozpakowano i wgrano: ${(data.files||[]).join(', ')}. Commit ${String(data.commit||'').slice(0,8)}. Render rozpocznie wdrożenie.`);
  }catch(e){
    const msg=e?.name==='AbortError'?'Wysyłanie trwało zbyt długo. Sprawdź połączenie i spróbuj ponownie.':(e.message||'Aktualizacja ZIP nie powiodła się.');
    adminMsg(adminUI.deployMsg,msg,true);
  }finally{clearTimeout(timer);}
}

let adminSelectedAccount=null;
async function adminSearchAccounts(q=''){try{const r=await api(`/api/admin/accounts?q=${encodeURIComponent(q)}`),box=$('adminAccountList');box.innerHTML=(r.accounts||[]).map(a=>`<div class="adminPlayerRow" data-account="${a.id}"><span><b>${chatEscape(a.username)}</b><small>${a.id}</small></span><span>${a.banned?'⛔ ZBANOWANY':'✅ AKTYWNY'}<br><small>Bany: ${Number(a.banCount)||0}</small></span></div>`).join('')||'<div class="adminHint">Brak kont.</div>';box.querySelectorAll('[data-account]').forEach(el=>el.onclick=()=>adminSelectAccount((r.accounts||[]).find(a=>a.id===el.dataset.account)));}catch(e){$('adminBanMsg').textContent='Nie udało się pobrać kont.';}}
function adminSelectAccount(a){if(!a)return;adminSelectedAccount=a;$('banAccountId').value=a.id;$('banAccountName').value=a.username;$('banAccountStatus').textContent=a.banned?`Zbanowany do ${new Date(a.bannedUntil*1000).toLocaleString('pl-PL')} • ${a.banReason} • liczba banów: ${Number(a.banCount)||0}`:`Konto aktywne • liczba wcześniejszych banów: ${Number(a.banCount)||0}`;}
async function adminBanAccount(){if(!adminSelectedAccount)return;const seconds=Math.max(1,Number($('banDuration').value)||1)*60;try{const r=await api('/api/admin/ban',{method:'POST',body:JSON.stringify({accountId:adminSelectedAccount.id,durationSeconds:seconds,reason:$('banReasonInput').value})});adminSelectAccount(r.account);$('adminBanMsg').textContent=`Konto zbanowane. Zastosowany mnożnik: ×${Number(r.account?.banMultiplier||1).toFixed(2)}.`;await adminSearchAccounts($('adminAccountSearch').value);}catch(e){$('adminBanMsg').textContent=e.message;}}
async function adminUnbanAccount(){if(!adminSelectedAccount)return;try{const r=await api('/api/admin/unban',{method:'POST',body:JSON.stringify({accountId:adminSelectedAccount.id})});adminSelectAccount(r.account);$('adminBanMsg').textContent='Konto odblokowane.';await adminSearchAccounts($('adminAccountSearch').value);}catch(e){$('adminBanMsg').textContent=e.message;}}
$('adminAccountSearchBtn')?.addEventListener('click',()=>adminSearchAccounts($('adminAccountSearch').value));$('adminBanBtn')?.addEventListener('click',adminBanAccount);$('adminUnbanBtn')?.addEventListener('click',adminUnbanAccount);

adminUI.open?.addEventListener('click',()=>adminOpen(true));adminUI.loginClose?.addEventListener('click',()=>adminOpen(false));adminUI.close?.addEventListener('click',()=>adminOpen(false));adminUI.login?.addEventListener('click',()=>adminAuth('password'));adminUI.recoverBtn?.addEventListener('click',()=>adminAuth('recovery'));adminUI.forgot?.addEventListener('click',()=>{adminUI.passwordArea.style.display='none';adminUI.recoveryArea.style.display='block';});adminUI.back?.addEventListener('click',()=>{adminUI.passwordArea.style.display='block';adminUI.recoveryArea.style.display='none';});adminUI.logout?.addEventListener('click',async()=>{await api('/api/admin/logout',{method:'POST',body:'{}'}).catch(()=>{});adminUI.dashboard.style.display='none';adminUI.loginCard.style.display='block';});
document.querySelectorAll('.adminTab').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('.adminTab').forEach(x=>x.classList.toggle('active',x===tab));document.querySelectorAll('.adminPane').forEach(p=>p.classList.toggle('active',p.dataset.adminPane===tab.dataset.adminTab));}));
$('adminSaveSettings')?.addEventListener('click',adminSaveConfig);$('adminSearchBtn')?.addEventListener('click',()=>adminSearchPlayers($('adminPlayerSearch').value));$('adminSavePlayer')?.addEventListener('click',adminSavePlayer);$('adminAddMode')?.addEventListener('click',adminAddMode);$('adminSaveModes')?.addEventListener('click',adminSaveModes);$('adminFiles')?.addEventListener('change',adminFilesChanged);$('adminDeployBtn')?.addEventListener('click',adminDeploy);

if(ui.crosshair){ui.crosshair.style.left=mouse.x+'px';ui.crosshair.style.top=mouse.y+'px';}
addEventListener('beforeunload',()=>{if(duelActive||duelSearching||duelMatchId)stopDuelSession(true);else if(running)commitRun();else{profile.coins=walletCoins;saveProgress();}});
fetchGameConfig();setInterval(()=>{if(!document.hidden)fetchGameConfig();},15000);updateModeUI();reset();showLobby();authBootstrap();
})();
