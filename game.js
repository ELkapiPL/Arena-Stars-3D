(() => {
'use strict';

const canvas = document.getElementById('game');
const gl = canvas.getContext('webgl2', {antialias:true, alpha:false});
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
  crosshair:$('crosshair'), centerMsg:$('centerMsg'),
  upgradeButtons:[...document.querySelectorAll('[data-upgrade]')],
  persistentLevelEls:[...document.querySelectorAll('[data-persistent-level]')],
  skinCards:[...document.querySelectorAll('[data-skin]')]
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
const mesh={cube:cubeMesh(),sphere:sphereMesh(),cyl:cylinderMesh()};
const model=M4.create(),view=M4.create(),proj=M4.create(),viewProj=M4.create(),invVP=M4.create();
function draw(m,x,y,z,sx,sy,sz,rot,color,alpha=1){M4.identity(model);M4.translate(model,model,[x,y,z]);if(rot)M4.rotateY(model,model,rot);M4.scale(model,model,[sx,sy,sz]);gl.uniformMatrix4fv(loc.model,false,model);gl.uniform4f(loc.color,color[0],color[1],color[2],alpha);m.draw();}

// ---------- Świat gry ----------
const ARENA=18;
const keys={}; let mouse={x:innerWidth/2,y:innerHeight/2,down:false,worldX:0,worldZ:-4};
const BASE_HP=150,BASE_SPEED=8.2,BASE_FIRE_COOLDOWN=.19,MAG_SIZE=30,RELOAD_TIME=1.5,UPGRADE_COSTS=[100,200,400,800,1600];
const SUPER_CHARGE_MULTIPLIER=.4; // ładowanie jest o 60% wolniejsze
const HYPER_CHARGE_RATIO=3,HYPER_DURATION=9,HYPER_SPEED_MULT=1.05,HYPER_FIRE_MULT=1.04,HYPER_DAMAGE_MULT=.93;
const COSMIC_SKIN_COST=1250,VERSION_ONE_COST=150,VERSION_ONE_SPEED=1.03,VERSION_ONE_FIRE=1.02,VERSION_ONE_HP=1.10;
const SAVE_KEY='arenaStars3D_save_v3';
const PLAYER_ID_KEY='arenaStars3D_online_player_id_v1';
function safePlayerName(value){const text=String(value||'Gracz').trim().replace(/[<>\r\n\t]/g,'').replace(/\s+/g,' ');return (text.slice(0,18)||'Gracz');}
function safeUpgradeLevel(value){return Math.max(0,Math.min(UPGRADE_COSTS.length,Math.floor(Number(value)||0)));}
function loadProgress(){
  try{
    const raw=localStorage.getItem(SAVE_KEY),data=raw?JSON.parse(raw):{},saved=data.upgrades||{};
    const ownedSkins={classic:true,cosmic:data.ownedSkins?.cosmic===true};
    const requestedSkin=data.skin==='cosmic'?'cosmic':'classic';
    return {
      name:safePlayerName(data.name),
      trophies:Math.max(0,Number(data.trophies)||0),
      points:Math.max(0,Number(data.points)||0),
      coins:Math.max(0,Number(data.coins)||0),
      skin:requestedSkin==='cosmic'&&ownedSkins.cosmic?'cosmic':'classic',
      ownedSkins,
      heroVersion1:data.heroVersion1===true,
      mode:data.mode==='duel'?'duel':'solo',
      upgrades:{move:safeUpgradeLevel(saved.move),fire:safeUpgradeLevel(saved.fire),hp:safeUpgradeLevel(saved.hp)}
    };
  }catch(_){return {name:'Gracz',trophies:0,points:0,coins:0,skin:'classic',ownedSkins:{classic:true,cosmic:false},heroVersion1:false,mode:'solo',upgrades:{move:0,fire:0,hp:0}};}
}
let profile=loadProgress();
function saveProgress(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(profile));}catch(_){} }
function getPlayerId(){
  try{let id=localStorage.getItem(PLAYER_ID_KEY);if(!id){id=(crypto.randomUUID?crypto.randomUUID():`gracz-${Date.now()}-${Math.random().toString(16).slice(2)}`);localStorage.setItem(PLAYER_ID_KEY,id);}return id;}
  catch(_){return `gracz-${Date.now()}-${Math.random().toString(16).slice(2)}`;}
}
const playerId=getPlayerId();
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
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    return await response.json();
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

async function syncProfile(){
  try{
    const data=await api('/api/profile',{method:'POST',body:JSON.stringify({playerId,name:profile.name,points:profile.points,trophies:profile.trophies})});
    if(data.profile){
      profile.name=safePlayerName(data.profile.name||profile.name);
      profile.points=Math.max(profile.points,Number(data.profile.points)||0);
      profile.trophies=Math.max(profile.trophies,Number(data.profile.trophies)||0);
      saveProgress();updateLobby();
    }
    rankingRows=Array.isArray(data.players)?data.players:rankingRows;
    myRankingPosition=Number(data.position)||null;
    totalPlayers=Math.max(0,Number(data.totalPlayers)||0);
    rankingFailures=0;onlineConnected=true;onlineCount=Math.max(1,Number(data.online)||1);setOnlineStatus(`Połączono jako ${profile.name} • mecze solo`,'ok');renderRanking();
  }catch(_){handleRankingFailure();}
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
  if(!ui.nicknameInput)return;profile.name=safePlayerName(ui.nicknameInput.value);ui.nicknameInput.value=profile.name;saveProgress();rankingCenterOnNextRender=true;syncProfile().then(fetchRanking);
}
setInterval(()=>{if(!document.hidden)fetchRanking();},5000);

function updateModeUI(){
  if(!ui.modeBtn)return;
  const duel=selectedMode==='duel',solo=selectedMode==='solo';
  ui.modeBtn.textContent=duel?'POJEDYNKI ⚔':(solo?'PRZETRWANIE 🤖':'TRYBY ▾');
  ui.modeBtn.classList.toggle('selected',duel||solo);
  ui.soloModeOption?.classList.toggle('selected',solo);
  ui.duelModeOption?.classList.toggle('selected',duel);
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
function setDuelQueueText(text){if(ui.duelQueueText)ui.duelQueueText.textContent=text;}
function clearDuelTimers(){
  clearTimeout(duelJoinTimer);duelJoinTimer=0;
  clearInterval(duelNetworkTimer);duelNetworkTimer=0;
  duelNetworkBusy=false;
}
function stopDuelSession(notify=true){
  const oldMatch=duelMatchId;
  clearDuelTimers();
  duelSearching=false;duelActive=false;duelEnded=false;duelMatchId='';duelOpponent=null;duelServerBullets=[];duelPredictedBullets=[];duelShotQueue=[];duelVisualHitSeqs.clear();duelMatchStatus='';duelStartIn=0;duelStartDeadline=0;duelNetworkFailures=0;duelFrameSeq=0;duelLocalBotMode=false;duelBotBullets=[];duelBotTurnTimer=0;duelBotShotTimer=.8;duelBotStrafe=1;duelBotStuck=0;duelBotReveal=0;
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
  reset();running=false;duelSearching=true;duelEnded=false;duelNetworkFailures=0;duelMatchId='';duelOpponent=null;duelServerBullets=[];duelPredictedBullets=[];duelShotQueue=[];duelVisualHitSeqs.clear();duelLocalShotSeq=0;duelFrameSeq=0;duelStartDeadline=0;duelLocalBotMode=false;duelBotBullets=[];duelBotTurnTimer=0;duelBotShotTimer=.8;duelBotStrafe=Math.random()<.5?-1:1;duelBotStuck=0;duelBotReveal=0;
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
  reset();running=true;document.body.classList.remove('lobby-mode');document.body.classList.add('duel-mode');
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
    const sx=Number(me.x),sz=Number(me.z),err=Number.isFinite(sx)&&Number.isFinite(sz)?Math.hypot(sx-player.x,sz-player.z):0;
    if(initial||err>3.2){player.x=sx||0;player.z=sz||0;player.netX=player.x;player.netZ=player.z;}
    else if(err>.65){player.netX=sx;player.netZ=sz;}
    const serverAngle=normalizeDuelAngle(me.angle);
    if(initial||Math.abs(duelAngleDelta(player.angle,serverAngle))>1.9)player.angle=serverAngle;
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
  if(ui.hudModeText)ui.hudModeText.textContent=other?.isBot?'Pojedynek z botem':'Pojedynek 1v1';
  if(ui.duelOpponentName)ui.duelOpponentName.textContent=other?(other.hidden?'PRZECIWNIK W KRZAKACH':`${other.name.toUpperCase()}${other.isBot?' • BOT':''}`):'OCZEKIWANIE NA PRZECIWNIKA';
  if(ui.duelOpponentHp)ui.duelOpponentHp.textContent=other?`${Math.max(0,other.hp)} / ${other.maxHp} HP`:'—';
  updateUI();
  if(data.status==='finished'&&!duelLocalBotMode)finishDuel(data);
}
async function sendDuelFrame(){
  if(!duelActive||!duelMatchId||!player||duelNetworkBusy)return;
  duelNetworkBusy=true;const sentAt=performance.now(),seq=++duelFrameSeq;
  const pendingShots=duelShotQueue.slice(0,1).map(shot=>({seq:shot.seq,angle:shot.angle}));
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
function duelPlayerShoot(){
  if(!duelActive||duelMatchStatus!=='playing'||!player||player.fire>0||player.reload>0)return;
  if(player.ammo<=0){startReload();return;}
  player.fire=player.fireCooldown;player.ammo--;
  const a=normalizeDuelAngle(player.angle),clientSeq=++duelLocalShotSeq,createdAt=performance.now();
  if(!duelLocalBotMode)duelShotQueue.push({seq:clientSeq,angle:a,createdAt});
  duelPredictedBullets.push({clientSeq,createdAt,x:player.x+Math.sin(a)*1.05,z:player.z+Math.cos(a)*1.05,vx:Math.sin(a)*18,vz:Math.cos(a)*18,life:2.4,damage:22});
  const color=profile.skin==='cosmic'?[.78,.38,1]:[.24,.85,1];
  burst(player.x+Math.sin(player.angle),player.z+Math.cos(player.angle),color,5,2.7);
  if(player.ammo<=0)startReload();else updateUI();
}
function localBotDamagePlayer(amount){
  if(!duelActive||duelEnded||!player)return;player.hp=Math.max(0,player.hp-amount);shake=Math.max(shake,.28);burst(player.x,player.z,[1,.18,.28],10,4.8);updateUI();
  if(player.hp<=0)finishDuel({winnerId:duelOpponent?.id||'bot',reason:'Bot Arenowy wygrał pojedynek.'});
}
function spawnLocalBotBullet(){
  if(!duelOpponent||!player)return;const ox=duelOpponent.renderX??duelOpponent.x,oz=duelOpponent.renderZ??duelOpponent.z;
  const a=normalizeDuelAngle(Math.atan2(player.x-ox,player.z-oz)+(.035*(Math.random()*2-1)));
  duelBotBullets.push({x:ox+Math.sin(a)*1.05,z:oz+Math.cos(a)*1.05,vx:Math.sin(a)*15.5,vz:Math.cos(a)*15.5,life:2.6,damage:18});
  duelBotReveal=.9;burst(ox+Math.sin(a),oz+Math.cos(a),[1,.28,.48],4,2.3);
}
function updateLocalDuelBot(dt){
  const bot=duelOpponent;if(!duelLocalBotMode||!bot||!player||duelMatchStatus!=='playing'||duelEnded)return;
  bot.hidden=false;bot.isBot=true;bot.r=DUEL_RADIUS;bot.maxHp=Math.max(1,Number(bot.maxHp)||150);bot.hp=Math.max(0,Number(bot.hp)||0);
  let ox=Number(bot.renderX??bot.x)||0,oz=Number(bot.renderZ??bot.z)||-12;
  const dx=player.x-ox,dz=player.z-oz,dist=Math.max(.001,Math.hypot(dx,dz)),nx=dx/dist,nz=dz/dist;
  duelBotTurnTimer-=dt;if(duelBotTurnTimer<=0){duelBotTurnTimer=.65+Math.random()*.75;duelBotStrafe=Math.random()<.5?-1:1;}
  let wantX,wantZ;if(dist>9.2){wantX=nx;wantZ=nz;}else if(dist<4.8){wantX=-nx;wantZ=-nz;}else{wantX=-nz*duelBotStrafe+nx*.12;wantZ=nx*duelBotStrafe+nz*.12;const l=Math.hypot(wantX,wantZ)||1;wantX/=l;wantZ/=l;}
  const base=Math.atan2(wantX,wantZ),offsets=[0,.38,-.38,.78,-.78,1.25,-1.25,Math.PI];let best=null;
  for(const off of offsets){const a=base+off,mx=Math.sin(a),mz=Math.cos(a),cand={x:ox+mx*5.25*dt,z:oz+mz*5.25*dt,r:DUEL_RADIUS};resolveDuelEntity(cand);const moved=Math.hypot(cand.x-ox,cand.z-oz),newDist=Math.hypot(player.x-cand.x,player.z-cand.z);let score=moved*30-Math.abs(newDist-7.0)*.09;if(duelLineBlocked(cand.x,cand.z,player.x,player.z,.08))score-=.18;if(!best||score>best.score)best={score,x:cand.x,z:cand.z};}
  const oldX=ox,oldZ=oz;if(best){ox=best.x;oz=best.z;}const moved=Math.hypot(ox-oldX,oz-oldZ);duelBotStuck=moved<.002?duelBotStuck+dt:Math.max(0,duelBotStuck-dt*2);
  if(duelBotStuck>.25){duelBotStuck=0;duelBotStrafe*=-1;const escape={x:ox-nz*duelBotStrafe*1.0,z:oz+nx*duelBotStrafe*1.0,r:DUEL_RADIUS};resolveDuelEntity(escape);ox=escape.x;oz=escape.z;}
  bot.x=bot.targetX=bot.renderX=ox;bot.z=bot.targetZ=bot.renderZ=oz;bot.vx=(ox-oldX)/Math.max(dt,.001);bot.vz=(oz-oldZ)/Math.max(dt,.001);bot.angle=bot.targetAngle=bot.renderAngle=normalizeDuelAngle(Math.atan2(player.x-ox,player.z-oz));bot.inBush=duelPointInBush(ox,oz);
  duelBotReveal=Math.max(0,duelBotReveal-dt);bot.hidden=bot.inBush&&duelBotReveal<=0&&dist>4.5;
  duelBotShotTimer-=dt;if(duelBotShotTimer<=0&&dist<16.5&&!duelLineBlocked(ox,oz,player.x,player.z,.17)){duelBotShotTimer=.62+Math.random()*.28;spawnLocalBotBullet();}
  for(let i=duelBotBullets.length-1;i>=0;i--){const b=duelBotBullets[i],x0=b.x,z0=b.z,x1=x0+b.vx*dt,z1=z0+b.vz*dt;b.life-=dt;const wt=duelFirstWallHit(x0,z0,x1,z1,.18),ht=duelSegmentCircleHit(x0,z0,x1,z1,player.x,player.z,DUEL_RADIUS+.20);if(ht!==null&&(wt===null||ht<=wt)){b.x=x0+(x1-x0)*ht;b.z=z0+(z1-z0)*ht;burst(b.x,b.z,[1,.25,.48],6,3);duelBotBullets.splice(i,1);localBotDamagePlayer(b.damage);continue;}if(wt!==null||b.life<=0){if(wt!==null)burst(x0+(x1-x0)*wt,z0+(z1-z0)*wt,[1,.25,.48],4,2);duelBotBullets.splice(i,1);continue;}b.x=x1;b.z=z1;}
  if(ui.duelOpponentHp)ui.duelOpponentHp.textContent=`${Math.max(0,Math.ceil(bot.hp))} / ${bot.maxHp} HP`;
}
function updateDuel(dt){
  if(!duelActive||!player)return;
  player.fire=Math.max(0,player.fire-dt);
  if(player.reload>0){player.reload=Math.max(0,player.reload-dt);if(player.reload===0){player.ammo=MAG_SIZE;showMessage('AMUNICJA GOTOWA!');}updateUI();}
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
    let dx=(keys.KeyD?1:0)-(keys.KeyA?1:0),dz=(keys.KeyS?1:0)-(keys.KeyW?1:0),len=Math.hypot(dx,dz);
    if(len){dx/=len;dz/=len;player.x+=dx*player.speed*dt;player.z+=dz*player.speed*dt;resolveDuelEntity(player);}
    // Serwer koryguje tylko większe odchylenia. Małe różnice ignorujemy, aby nie było gumowania ruchu.
    if(Number.isFinite(player.netX)&&Number.isFinite(player.netZ)){
      const err=Math.hypot(player.netX-player.x,player.netZ-player.z);
      if(err>.65){const correction=1-Math.exp(-3.0*dt);player.x+=(player.netX-player.x)*correction;player.z+=(player.netZ-player.z)*correction;resolveDuelEntity(player);}else{player.netX=player.x;player.netZ=player.z;}
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
      b.x=x0+(x1-x0)*hitT;b.z=z0+(z1-z0)*hitT;burst(b.x,b.z,profile.skin==='cosmic'?[.78,.38,1]:[.24,.85,1],7,3.4);
      if(duelLocalBotMode&&duelOpponent){duelOpponent.hp=Math.max(0,duelOpponent.hp-(b.damage||22));duelBotReveal=.9;if(ui.duelOpponentHp)ui.duelOpponentHp.textContent=`${Math.ceil(duelOpponent.hp)} / ${duelOpponent.maxHp} HP`;if(duelOpponent.hp<=0){duelPredictedBullets.splice(i,1);finishDuel({winnerId:playerId,reason:'Pokonałeś Bota Arenowego.'});break;}}
      else duelVisualHitSeqs.add(b.clientSeq);
      duelPredictedBullets.splice(i,1);continue;
    }
    if(wallT!==null||b.life<=0){if(wallT!==null)burst(x0+(x1-x0)*wallT,z0+(z1-z0)*wallT,profile.skin==='cosmic'?[.78,.38,1]:[.24,.85,1],4,2);duelPredictedBullets.splice(i,1);continue;}
    b.x=x1;b.z=z1;
  }
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=10*dt;p.vx*=.97;p.vz*=.97;if(p.y<.05){p.y=.05;p.vy*=-.25;}if(p.life<=0)particles.splice(i,1);}
  shake=Math.max(0,shake-dt);if(messageClock>0){messageClock-=dt;if(messageClock<=0)ui.centerMsg.style.opacity='0';}
}
function finishDuel(data){
  if(duelEnded)return;const endedMatchId=duelMatchId,wasLocalBot=duelLocalBotMode;duelEnded=true;running=false;duelActive=false;clearDuelTimers();
  if(endedMatchId){api('/api/duel/leave',{method:'POST',body:JSON.stringify({playerId,matchId:endedMatchId})}).catch(()=>{});}duelMatchId='';duelLocalBotMode=false;duelBotBullets=[];
  const won=data.winnerId===playerId,lost=data.winnerId&&data.winnerId!==playerId;
  if(ui.gameOverBadge)ui.gameOverBadge.textContent='KONIEC POJEDYNKU • TRYB ONLINE 1V1';
  if(ui.gameOverTitle)ui.gameOverTitle.innerHTML=won?'ZWYCIĘSTWO!':(lost?'PRZEGRANA':'KONIEC MECZU');
  const opponentName=duelOpponent?.name||'Przeciwnik';
  if(ui.endStats)ui.endStats.innerHTML=`<div class="endStat">Tryb<span>1V1</span></div><div class="endStat">Przeciwnik<span>${escapeRankingName(opponentName)}</span></div><div class="endStat">Twoje życie<span>${Math.max(0,Math.ceil(player?.hp||0))}</span></div><div class="endStat">Wynik<span>${won?'WYGRANA':(lost?'PRZEGRANA':'REMIS')}</span></div>`;
  const reason=data.reason||'Pojedynek został zakończony.';ui.gameOverView.querySelector('p').textContent=reason;
  ui.duelQueueView.style.display='none';ui.lobbyView.style.display='none';ui.gameOverView.style.display='grid';document.body.classList.add('lobby-mode');document.body.classList.remove('duel-mode');ui.overlay.style.display='block';
}

function updateLobby(){
  ui.savedTrophies.textContent=Math.floor(profile.trophies).toLocaleString('pl-PL');
  ui.savedPoints.textContent=Math.floor(profile.points).toLocaleString('pl-PL');
  ui.savedCoins.textContent=Math.floor(profile.coins).toLocaleString('pl-PL');
  if(isLobbyVisible())renderRanking();updateModeUI();
  if(ui.nicknameInput&&document.activeElement!==ui.nicknameInput)ui.nicknameInput.value=profile.name;
  if(ui.versionOneBtn){
    const owned=profile.heroVersion1===true;
    ui.versionOneBtn.textContent=owned?'AKTYWNA ✓':'ODBLOKUJ ZA 150 🪙';
    ui.versionOneBtn.disabled=owned;
    ui.versionOneBtn.classList.toggle('affordable',!owned&&profile.coins>=VERSION_ONE_COST);
  }
  for(const el of ui.persistentLevelEls){const type=el.dataset.persistentLevel;el.textContent=`Poziom ${profile.upgrades[type]||0}/5`;}
  for(const card of ui.skinCards){
    const skin=card.dataset.skin,owned=skin==='classic'||profile.ownedSkins?.[skin]===true,selected=owned&&skin===profile.skin;
    card.classList.toggle('selected',selected);card.classList.toggle('locked',!owned);card.classList.toggle('affordable',!owned&&skin==='cosmic'&&profile.coins>=COSMIC_SKIN_COST);
    const state=card.querySelector('.skinState');
    if(selected)state.textContent='WYBRANO';
    else if(owned)state.textContent='WYBIERZ';
    else if(skin==='cosmic'&&profile.coins>=COSMIC_SKIN_COST)state.textContent='ODBLOKUJ • 1250 🪙';
    else state.textContent='🔒 1250 🪙';
  }
}
let skinNoticeTimer=0;
function setSkinNotice(text,good=false){
  if(!ui.skinNotice)return;clearTimeout(skinNoticeTimer);ui.skinNotice.textContent=text;ui.skinNotice.classList.toggle('good',good);
  skinNoticeTimer=setTimeout(()=>{ui.skinNotice.textContent='';ui.skinNotice.classList.remove('good');},3200);
}
function selectSkin(skin){
  if(!['classic','cosmic'].includes(skin))return;
  if(skin==='cosmic'&&profile.ownedSkins?.cosmic!==true){
    if(profile.coins<COSMIC_SKIN_COST){setSkinNotice(`Brakuje ${(COSMIC_SKIN_COST-profile.coins).toLocaleString('pl-PL')} monet.`);return;}
    profile.coins-=COSMIC_SKIN_COST;walletCoins=profile.coins;profile.ownedSkins={...(profile.ownedSkins||{}),classic:true,cosmic:true};profile.skin='cosmic';saveProgress();updateLobby();setSkinNotice('Kosmiczny Strażnik odblokowany za 1250 monet!',true);return;
  }
  profile.skin=skin;saveProgress();updateLobby();setSkinNotice(skin==='cosmic'?'Wybrano Kosmicznego Strażnika.':'Wybrano Błękitnego Bohatera.',true);
}
let versionNoticeTimer=0;
function setVersionNotice(text,good=false){
  if(!ui.versionNotice)return;clearTimeout(versionNoticeTimer);ui.versionNotice.textContent=text;ui.versionNotice.classList.toggle('good',good);
  versionNoticeTimer=setTimeout(()=>{ui.versionNotice.textContent='';ui.versionNotice.classList.remove('good');},3200);
}
function buyVersionOne(){
  if(profile.heroVersion1===true){setVersionNotice('Lepsza wersja I jest już aktywna.',true);return;}
  if(profile.coins<VERSION_ONE_COST){setVersionNotice(`Brakuje ${VERSION_ONE_COST-profile.coins} monet.`);return;}
  profile.coins-=VERSION_ONE_COST;walletCoins=profile.coins;profile.heroVersion1=true;saveProgress();updateLobby();setVersionNotice('Lepsza wersja I odblokowana! Kolor bez zmian.',true);
}
let upgrades={...profile.upgrades};
let running=false,runCommitted=false,last=performance.now(),score=0,wave=1,kills=0,walletCoins=profile.coins,runCoins=0,trophies=0,survivalTime=0,waveClock=0,spawnClock=0,shake=0,messageClock=0;
let player,enemies=[],bullets=[],particles=[],stars=[],pickups=[],coins=[];
let selectedMode=profile.mode==='duel'?'duel':'solo',duelSearching=false,duelActive=false,duelEnded=false,duelMatchId='',duelOpponent=null,duelServerBullets=[],duelPredictedBullets=[],duelShotQueue=[],duelVisualHitSeqs=new Set(),duelLocalShotSeq=0,duelNetworkBusy=false,duelNetworkTimer=0,duelJoinTimer=0,duelNetworkFailures=0,duelMatchStatus='',duelStartIn=0,duelStartDeadline=0,duelLastStateAt=performance.now(),duelRtt=0,duelFrameSeq=0,duelLocalBotMode=false,duelBotBullets=[],duelBotTurnTimer=0,duelBotShotTimer=.8,duelBotStrafe=1,duelBotStuck=0,duelBotReveal=0;
window.__arenaDebug=()=>({duelActive,duelLocalBotMode,duelMatchStatus,player:player?{x:player.x,z:player.z,hp:player.hp}:null,opponent:duelOpponent?{x:duelOpponent.renderX??duelOpponent.x,z:duelOpponent.renderZ??duelOpponent.z,hp:duelOpponent.hp,hidden:duelOpponent.hidden,isBot:duelOpponent.isBot}:null,playerBullets:duelPredictedBullets.length,botBullets:duelBotBullets.length});

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
function reset(){
  upgrades={...profile.upgrades};runCommitted=false;walletCoins=profile.coins;runCoins=0;
  const versionOwned=profile.heroVersion1===true;
  const maxHp=Math.round((BASE_HP+20*upgrades.hp)*(versionOwned?VERSION_ONE_HP:1));
  player={x:0,z:11,hp:maxHp,maxHp,r:0.75,speed:BASE_SPEED*Math.pow(1.10,upgrades.move)*(versionOwned?VERSION_ONE_SPEED:1),fireCooldown:BASE_FIRE_COOLDOWN/(Math.pow(1.07,upgrades.fire)*(versionOwned?VERSION_ONE_FIRE:1)),angle:Math.PI,fire:0,ammo:MAG_SIZE,reload:0,inv:0,super:0,hyper:0,hyperActive:0,regen:0};
  enemies=[];bullets=[];particles=[];stars=[];pickups=[];coins=[];score=0;wave=1;kills=0;trophies=0;survivalTime=0;waveClock=0;spawnClock=.4;shake=0;updateUI();showMessage('FALA 1');
}
function commitRun(){
  if(runCommitted)return;runCommitted=true;
  profile.points+=Math.max(0,Math.floor(score));profile.trophies+=Math.max(0,Math.floor(trophies));profile.coins=Math.max(0,Math.floor(walletCoins));
  saveProgress();updateLobby();syncProfile().then(fetchRanking);
}
function showLobby(leaveDuel=true){if(leaveDuel&&(duelActive||duelSearching||duelMatchId))stopDuelSession(true);running=false;rankingCenterOnNextRender=true;document.body.classList.add('lobby-mode');document.body.classList.remove('duel-mode');ui.lobbyView.style.display='block';ui.duelQueueView.style.display='none';ui.gameOverView.style.display='none';ui.overlay.style.display='grid';if(ui.hudModeText)ui.hudModeText.textContent='Online';if(ui.gameOverBadge)ui.gameOverBadge.textContent='KONIEC MECZU • POSTĘP ZAPISANY';if(ui.gameOverTitle)ui.gameOverTitle.innerHTML='ROBOTY CIĘ<br>POKONAŁY';updateLobby();fetchRanking();}
function startSoloGame(){if(running)commitRun();reset();running=true;document.body.classList.remove('lobby-mode');document.body.classList.remove('duel-mode');ui.lobbyView.style.display='block';ui.gameOverView.style.display='none';updateUI();ui.overlay.style.display='none';last=performance.now();}
function startGame(){if(selectedMode==='solo'){startSoloGame();return;}if(selectedMode==='duel'){startDuelQueue();return;}toggleModeMenu(true);}
function gameOver(){running=false;commitRun();if(ui.gameOverBadge)ui.gameOverBadge.textContent='KONIEC MECZU • POSTĘP ZAPISANY';if(ui.gameOverTitle)ui.gameOverTitle.innerHTML='ROBOTY CIĘ<br>POKONAŁY';if(ui.endStats)ui.endStats.innerHTML='<div class="endStat">Punkty ⭐<span id="finalScore">0</span></div><div class="endStat">Pokonani 🤖<span id="finalKills">0</span></div><div class="endStat">Monety 🪙<span id="finalCoins">0</span></div><div class="endStat">Pucharki 🏆<span id="finalTrophies">0</span></div>';ui.finalScore=$('finalScore');ui.finalKills=$('finalKills');ui.finalCoins=$('finalCoins');ui.finalTrophies=$('finalTrophies');ui.finalScore.textContent=score;ui.finalKills.textContent=kills;ui.finalCoins.textContent=runCoins;ui.finalTrophies.textContent=trophies;ui.gameOverView.querySelector('p').textContent='Wybierz następną akcję.';ui.lobbyView.style.display='none';ui.gameOverView.style.display='grid';document.body.classList.add('lobby-mode');ui.overlay.style.display='block';}
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
  for(const button of ui.upgradeButtons){
    const type=button.dataset.upgrade,level=upgrades[type]||0,cost=UPGRADE_COSTS[level];
    const levelEl=button.querySelector('[data-level]'),costEl=button.querySelector('[data-cost]');
    levelEl.textContent=`${level}/5`;
    costEl.textContent=level>=UPGRADE_COSTS.length?'MAX':`${cost} 🪙`;
    button.disabled=!running||level>=UPGRADE_COSTS.length;
    button.classList.toggle('affordable',running&&level<UPGRADE_COSTS.length&&walletCoins>=cost);
  }
}
function buyUpgrade(type){
  if(duelActive)return;
  if(!running||!(type in upgrades))return;
  const level=upgrades[type];
  if(level>=UPGRADE_COSTS.length){showMessage('MAKSYMALNY POZIOM');return;}
  const cost=UPGRADE_COSTS[level];
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
function burst(x,z,color,count=12,power=5){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=rnd(power*.35,power);particles.push({x,y:rnd(.25,1.1),z,vx:Math.cos(a)*s,vy:rnd(1.5,5),vz:Math.sin(a)*s,life:rnd(.35,.75),size:rnd(.06,.16),color});}}
function spawnEnemy(){
  let a=Math.random()*Math.PI*2,x=Math.cos(a)*(ARENA-1),z=Math.sin(a)*(ARENA-1);if(Math.hypot(x-player.x,z-player.z)<10){a+=Math.PI;x=Math.cos(a)*(ARENA-1);z=Math.sin(a)*(ARENA-1);}
  const roll=Math.random(),type=wave>=4&&roll<.22?'tank':(wave>=2&&roll<.60?'shooter':'chaser');
  const cfg=type==='tank'?{hp:95+wave*10,speed:2.4,r:1.0,color:[.64,.18,.77],damage:24,level:3,coinReward:8}:type==='shooter'?{hp:42+wave*5,speed:3.4,r:.72,color:[1,.35,.18],damage:12,level:2,coinReward:3}:{hp:48+wave*6,speed:4.4,r:.72,color:[.94,.16,.25],damage:15,level:1,coinReward:1};
  enemies.push({x,z,type,level:cfg.level,coinReward:cfg.coinReward,hp:cfg.hp,maxHp:cfg.hp,speed:cfg.speed,r:cfg.r,color:cfg.color,damage:cfg.damage,angle:0,fire:rnd(.5,1.8),hit:0,navX:x,navZ:z,navTime:0,stuck:0,escapeTime:0,avoidSide:Math.random()<.5?-1:1});
}
function shoot(owner,x,z,angle,speed,damage,color,size=.18,spread=0){angle+=rnd(-spread,spread);bullets.push({owner,x,y:.72,z,vx:Math.sin(angle)*speed,vz:Math.cos(angle)*speed,life:2.2,damage,color,size});}
function startReload(){if(!running||!player||player.reload>0||player.ammo>=MAG_SIZE)return;player.reload=RELOAD_TIME;player.fire=0;showMessage('PRZEŁADOWANIE...');updateUI();}
function playerShoot(){if(duelActive){duelPlayerShoot();return;}if(!running||player.fire>0||player.reload>0)return;if(player.ammo<=0){startReload();return;}const hyper=(player.hyperActive||0)>0;player.fire=player.fireCooldown/(hyper?HYPER_FIRE_MULT:1);player.ammo--;const cosmic=profile.skin==='cosmic',shotColor=hyper?[.35,1,.92]:(cosmic?[.78,.38,1]:[.24,.85,1]),flashColor=hyper?[1,.95,.35]:(cosmic?[.35,1,1]:[.35,.9,1]);shoot('player',player.x+Math.sin(player.angle)*1.05,player.z+Math.cos(player.angle)*1.05,player.angle,18,22,shotColor,.21,.025);burst(player.x+Math.sin(player.angle),player.z+Math.cos(player.angle),flashColor,4,2.5);if(player.ammo<=0)startReload();else updateUI();}
function addCharge(baseAmount){if(!player)return;const amount=baseAmount*SUPER_CHARGE_MULTIPLIER;player.super=Math.min(100,player.super+amount);if((player.hyperActive||0)<=0)player.hyper=Math.min(100,player.hyper+amount/HYPER_CHARGE_RATIO);}
function superPulse(pulse,total){if(!running||!player)return;const color=total>1?[.25,1,.88]:[1,.35,.93];for(let i=0;i<24;i++)shoot('player',player.x,player.z,i/24*Math.PI*2,14,28,color,.24,0);for(const e of enemies){const d=Math.hypot(e.x-player.x,e.z-player.z);if(d<5.5){e.hp-=45;const k=(5.5-d)/5.5;e.x+=(e.x-player.x)/(d||1)*k*3;e.z+=(e.z-player.z)/(d||1)*k*3;}}burst(player.x,player.z,color,32,9);shake=Math.max(shake,.55);if(total>1)showMessage(`HIPER SUPER ${pulse}/${total}!`);}
function superAttack(){if(duelActive){showMessage('SUPER NIEDOSTĘPNY W 1V1');return;}if(!running||player.super<100)return;player.super=0;player.inv=.6;const pulses=(player.hyperActive||0)>0?3:1,caster=player;if(pulses===1){showMessage('SUPER!');superPulse(1,1);}else{/* Liczba fal jest ustalana w chwili użycia. Koniec hiperdoładowania nie anuluje fal 2 i 3. */superPulse(1,3);setTimeout(()=>{if(running&&player===caster)superPulse(2,3);},170);setTimeout(()=>{if(running&&player===caster)superPulse(3,3);},340);}updateUI();}
function activateHyper(){if(duelActive){showMessage('HIPER NIEDOSTĘPNY W 1V1');return;}if(!running||!player||player.hyper<100||player.hyperActive>0)return;player.hyper=0;player.hyperActive=HYPER_DURATION;player.inv=Math.max(player.inv,.45);showMessage('HIPERDOŁADOWANIE: 9 SEKUND!');burst(player.x,player.z,[.25,1,.82],40,10);shake=.4;updateUI();}
function spawnCoins(x,z,count){for(let i=0;i<count;i++){const a=(i/count)*Math.PI*2+rnd(-.3,.3),power=rnd(1.8,4.2);coins.push({x,z,r:.22,vx:Math.cos(a)*power,vz:Math.sin(a)*power,t:rnd(0,6.28),life:25});}}
function enemyDeath(e){score+=e.type==='tank'?350:e.type==='shooter'?180:120;kills++;addCharge(e.type==='tank'?18:10);burst(e.x,e.z,e.color,e.type==='tank'?24:15,e.type==='tank'?8:5);spawnCoins(e.x,e.z,e.coinReward||1);stars.push({x:e.x,z:e.z,y:.45,t:Math.random()*6.28,life:10});if(kills%7===0)pickups.push({x:e.x,z:e.z,type:'heal',life:14,t:0});updateUI();}
function damagePlayer(d){if(player.inv>0)return;if((player.hyperActive||0)>0)d*=HYPER_DAMAGE_MULT;player.hp-=d;player.inv=.55;player.regen=4;shake=.35;burst(player.x,player.z,[1,.15,.2],16,6);updateUI();if(player.hp<=0)gameOver();}

function update(dt){
  if(!running)return;
  if(duelActive){updateDuel(dt);return;}
  survivalTime+=dt;const earnedTrophies=Math.floor(survivalTime/4);if(earnedTrophies>trophies){trophies=earnedTrophies;showMessage(`PUCHAREK ${trophies} 🏆`);updateUI();}
  player.fire=Math.max(0,player.fire-dt);if(player.reload>0){player.reload=Math.max(0,player.reload-dt);if(player.reload===0){player.ammo=MAG_SIZE;showMessage('AMUNICJA GOTOWA!');}updateUI();}player.inv=Math.max(0,player.inv-dt);player.regen=Math.max(0,player.regen-dt);const wasHyper=(player.hyperActive||0)>0;if(wasHyper){player.hyperActive=Math.max(0,player.hyperActive-dt);updateUI();if(player.hyperActive===0)showMessage('HIPERDOŁADOWANIE ZAKOŃCZONE');}if(player.regen<=0&&player.hp<player.maxHp){player.hp=Math.min(player.maxHp,player.hp+5*dt);updateUI();}
  let dx=(keys.KeyD?1:0)-(keys.KeyA?1:0),dz=(keys.KeyS?1:0)-(keys.KeyW?1:0),l=Math.hypot(dx,dz);if(l){dx/=l;dz/=l;const moveSpeed=player.speed*((player.hyperActive||0)>0?HYPER_SPEED_MULT:1);player.x+=dx*moveSpeed*dt;player.z+=dz*moveSpeed*dt;resolve(player);}
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
function resize(){const dpr=Math.min(devicePixelRatio||1,2),w=Math.floor(innerWidth*dpr),h=Math.floor(innerHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}M4.perspective(proj,Math.PI/3,w/h,.1,100);}
function healthBar(x,z,hp,maxHp,y=2.2,width=1.25){draw(mesh.cube,x,y,z,width,.075,.08,0,[.16,.12,.16]);const f=Math.max(0,hp/maxHp);draw(mesh.cube,x-(width*(1-f)),y+.01,z,width*f,.08,.085,0,f>.45?[.2,.95,.35]:[1,.25,.18]);}
function render(){
  resize();const sx=shake?rnd(-shake,shake)*.35:0,sz=shake?rnd(-shake,shake)*.35:0;const focusX=player?.x||0,focusZ=player?.z||0;
  // Kamera ma identyczną orientację świata dla pierwszego i drugiego gracza.
  // Nie obracamy jej o 180 stopni po przeciwnej stronie areny.
  M4.lookAt(view,[focusX+sx,20,focusZ+15+sz],[focusX,0,focusZ-1],[0,1,0]);M4.multiply(viewProj,proj,view);M4.invert(invVP,viewProj);screenToGround(mouse.x,mouse.y);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.clearColor(.08,.14,.24,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.uniformMatrix4fv(loc.vp,false,viewProj);gl.uniform3f(loc.light,.45,-1,.35);
  // podłoże i delikatna kratka
  draw(mesh.cube,0,-.45,0,20,.45,20,0,[.20,.49,.38]);
  for(let x=-16;x<=16;x+=4)for(let z=-16;z<=16;z+=4)draw(mesh.cube,x,-.015,z,1.86,.02,1.86,0,((x+z)/4)%2===0?[.24,.57,.43]:[.22,.53,.40]);
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
    const blink=player.inv>0&&Math.floor(player.inv*18)%2===0,cosmic=profile.skin==='cosmic',anim=performance.now()*.002;
    const hyperOn=(player.hyperActive||0)>0;
    draw(mesh.cyl,player.x,.12,player.z,hyperOn?1.18:.95,.05,hyperOn?1.18:.95,0,hyperOn?[.22,1,.82]:(player.super>=100?[1,.3,.9]:(cosmic?[.48,.18,.88]:[.12,.55,.95])),.8);
    if(hyperOn){const pulse=1+Math.sin(anim*5)*.08;draw(mesh.sphere,player.x,.82,player.z,.92*pulse,1.02*pulse,.92*pulse,0,[.25,1,.82],.16);}
    if(!blink){
      if(cosmic){
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
    const o=duelOpponent,ox=o.renderX??o.x,oz=o.renderZ??o.z,oa=o.renderAngle??normalizeDuelAngle(o.angle),cosmic=o.skin==='cosmic',anim=performance.now()*.002;
    draw(mesh.cyl,ox,.12,oz,.98,.05,.98,0,[1,.25,.55],.8);
    if(cosmic){draw(mesh.sphere,ox,.82,oz,.72,.82,.72,0,[.43,.10,.48]);draw(mesh.sphere,ox,.84,oz,.53,.66,.53,0,[.78,.20,.68]);draw(mesh.sphere,ox,.90,oz,.62,.43,.62,0,[1,.42,.85],.32);draw(mesh.cube,ox+Math.sin(oa)*.75,.82,oz+Math.cos(oa)*.75,.18,.18,.62,oa,[.30,.04,.20]);draw(mesh.sphere,ox+Math.sin(anim)*1.02,.93,oz+Math.cos(anim)*1.02,.11,.11,.11,0,[1,.72,.25]);}
    else{draw(mesh.sphere,ox,.82,oz,.72,.82,.72,0,[.93,.18,.42]);draw(mesh.sphere,ox,.82,oz,.49,.62,.49,0,[1,.37,.58]);draw(mesh.cube,ox+Math.sin(oa)*.75,.82,oz+Math.cos(oa)*.75,.18,.18,.62,oa,[.28,.10,.18]);draw(mesh.sphere,ox,.82,oz,.78,.86,.78,0,[1,.55,.70],.13);}
    healthBar(ox,oz,o.hp,o.maxHp,2.05,1.25);
  }
  if(!duelActive)for(const e of enemies){draw(mesh.cyl,e.x,.11,e.z,e.r*1.18,.04,e.r*1.18,0,e.color,.65);const c=e.hit>0?[1,1,1]:e.color;draw(mesh.sphere,e.x,e.r*.95,e.z,e.r,e.r*1.05,e.r,0,c);draw(mesh.sphere,e.x,e.r*1.14,e.z,e.r*.62,e.r*.63,e.r*.62,0,[Math.min(1,c[0]+.22),Math.min(1,c[1]+.22),Math.min(1,c[2]+.22)]);if(e.type==='shooter')draw(mesh.cube,e.x+Math.sin(e.angle)*e.r*.95,e.r*.95,e.z+Math.cos(e.angle)*e.r*.95,.16,.16,.58,e.angle,[.18,.16,.19]);if(e.type==='tank'){draw(mesh.cube,e.x,e.r*1.05,e.z,e.r*.95,.24,e.r*.95,0,[.25,.11,.31]);}for(let lv=0;lv<(e.level||1);lv++)draw(mesh.sphere,e.x+(lv-((e.level||1)-1)/2)*.24,e.r*2.28,e.z,.08,.08,.08,0,[1,.78,.12]);healthBar(e.x,e.z,e.hp,e.maxHp,e.r*2.35,e.r*.9);}
  if(duelActive){for(const b of duelServerBullets){const mine=b.ownerId===playerId,c=mine?(profile.skin==='cosmic'?[.78,.38,1]:[.24,.85,1]):[1,.25,.48];draw(mesh.sphere,b.renderX??b.x,.72,b.renderZ??b.z,.21,.21,.21,0,c);}for(const b of duelBotBullets)draw(mesh.sphere,b.x,.72,b.z,.21,.21,.21,0,[1,.25,.48]);const pc=profile.skin==='cosmic'?[.78,.38,1]:[.24,.85,1];for(const b of duelPredictedBullets)draw(mesh.sphere,b.x,.72,b.z,.20,.20,.20,0,pc,.78);}else for(const b of bullets)draw(mesh.sphere,b.x,b.y,b.z,b.size,b.size,b.size,0,b.color);
  for(const p of particles)draw(mesh.cube,p.x,p.y,p.z,p.size,p.size,p.size,0,p.color,Math.max(0,p.life*2));
}
function loop(now){const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);render();requestAnimationFrame(loop);}requestAnimationFrame(loop);

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
ui.playBtn.addEventListener('click',startGame);
ui.retryBtn.addEventListener('click',startGame);
ui.lobbyBtn.addEventListener('click',showLobby);
for(const button of ui.upgradeButtons)button.addEventListener('click',()=>buyUpgrade(button.dataset.upgrade));
for(const card of ui.skinCards){card.addEventListener('click',()=>selectSkin(card.dataset.skin));card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectSkin(card.dataset.skin);}});}
ui.crosshair.style.left=mouse.x+'px';ui.crosshair.style.top=mouse.y+'px';
addEventListener('beforeunload',()=>{if(duelActive||duelSearching||duelMatchId)stopDuelSession(true);else if(running)commitRun();else{profile.coins=walletCoins;saveProgress();}});
updateModeUI();reset();showLobby();syncProfile().then(fetchRanking);
})();
