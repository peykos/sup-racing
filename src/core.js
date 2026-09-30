// Deterministic, renderer-independent SUP race simulation. Units: metres / seconds.
export const COURSE = Object.freeze([
  {x:0,z:10}, {x:-48,z:82}, {x:50,z:138},
  {x:92,z:48}, {x:35,z:-52}, {x:0,z:-95}
]);
export const START = {x:0,z:-95};
export const COLORS = ['#adffce','#ff795e','#ae9aff','#ffd66f','#69c8ff'];
export const NAMES = ['ΕΣΥ','NOVA','KAI','LUNA','RIO'];
export const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export const angleDiff = (a,b) => Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export const courseLength = () => COURSE.reduce((n,p,i)=>n+distance(p,i?COURSE[i-1]:START),0);
export function waveAt(x,z,t,rough=1) {
  return rough*(.21*Math.sin(x*.085+z*.052+t*1.2)+.12*Math.sin(z*.16-x*.035-t*1.55)+.065*Math.sin(x*.3+z*.22+t*2.1));
}
export function formatTime(t) {
  if (!Number.isFinite(t)) return '—';
  const s=Math.max(0,t); return `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}.${Math.floor(s%1*10)}`;
}
export class Race {
  constructor(options={}) { this.options={laps:2,difficulty:'race',sea:'calm',...options}; this.reset(); }
  reset(options={}) {
    Object.assign(this.options,options);
    this.options.laps=[1,2,3].includes(Number(this.options.laps))?Number(this.options.laps):2;
    if (!['cruise','race','pro'].includes(this.options.difficulty)) this.options.difficulty='race';
    if (!['calm','swell'].includes(this.options.sea)) this.options.sea='calm';
    this.state='menu'; this.previousState='menu'; this.time=0; this.clock=0; this.countdown=3;
    this.events=[]; this.message=''; this.messageUntil=0; this.perfect=0; this.strokes=0; this.combo=0;
    this.racers=NAMES.map((name,i)=>({id:i,name,x:[0,-5,5,-10,10][i],z:-88-i*.75,
      heading:0,speed:0,energy:100,passed:0,next:0,finishedAt:null,lastStroke:-10,
      lastSide:i%2?1:-1,strokeCount:0,quality:'',draft:false,boosting:false,hitUntil:0,
      nextAIStroke:.25+i*.15,collisionUntil:0}));
    return this;
  }
  get player(){return this.racers[0];}
  get target(){return COURSE[this.player.next];}
  get roughness(){return this.options.sea==='swell'?1.8:.75;}
  get lap(){return Math.min(this.options.laps,Math.floor(this.player.passed/COURSE.length)+1);}
  get totalDistance(){return courseLength()*this.options.laps;}
  get progress(){return clamp(this.player.passed/(COURSE.length*this.options.laps),0,1);}
  start(){this.reset(this.options);this.state='countdown';this.events.push({type:'start'});}
  pause(){if(['racing','countdown'].includes(this.state)){this.previousState=this.state;this.state='paused';}}
  resume(){if(this.state==='paused')this.state=this.previousState;}
  say(text,duration=2){this.message=text;this.messageUntil=this.clock+duration;}
  stroke(side, racer=this.player, automatic=false) {
    if(this.state!=='racing'||racer.finishedAt!==null)return false;
    const interval=this.time-racer.lastStroke;
    if(interval<.34)return false;
    side=side<0?-1:1;
    const perfect=!automatic && Math.abs(interval-.82)<.17;
    const alternated=side!==racer.lastSide;
    const efficiency=clamp(racer.energy/35,.46,1);
    racer.speed=clamp(racer.speed+(perfect?1.30:1.04)*efficiency*(alternated?1:.92),0,8.8);
    racer.heading-=side*(alternated?.011:.033);
    racer.lastSide=side;racer.lastStroke=this.time;racer.strokeCount++;
    racer.energy=clamp(racer.energy-(racer.boosting?6:2.5),0,100);
    racer.quality=perfect?'perfect':automatic?'steady':'stroke';
    if(racer.id===0){
      this.strokes++;
      if(perfect){this.perfect++;this.combo++;this.say(`ΤΕΛΕΙΟΣ ΡΥΘΜΟΣ${this.combo>1?' ×'+this.combo:''}`,1);}
      else this.combo=0;
      this.events.push({type:'stroke',side,perfect});
    }
    return true;
  }
  order(){
    return [...this.racers].sort((a,b)=>{
      if(a.finishedAt!==null||b.finishedAt!==null){
        if(a.finishedAt===null)return 1;if(b.finishedAt===null)return -1;
        return a.finishedAt-b.finishedAt;
      }
      return (b.passed-a.passed)*10000+distance(a,COURSE[a.next])-distance(b,COURSE[b.next]);
    });
  }
  get place(){return this.order().findIndex(r=>r.id===0)+1;}
  step(delta,input={}) {
    if(!Number.isFinite(delta)||delta<=0)return;
    const dt=Math.min(delta,.05);
    if(this.state==='paused')return;
    this.clock+=dt;
    if(this.state==='countdown'){
      this.countdown-=dt;
      if(this.countdown<=0){this.state='racing';this.say('ΠΑΜΕ! Κράτα τον ρυθμό.',2);this.events.push({type:'go'});}
      return;
    }
    if(this.state!=='racing')return;
    this.time+=dt;
    for(const r of this.racers){
      if(r.finishedAt!==null){r.speed*=Math.exp(-dt*2);continue;}
      let steer=clamp(input.steer||0,-1,1);
      let sprint=!!input.sprint;
      if(r.id){
        const target=COURSE[r.next];
        const desired=Math.atan2(target.x-r.x,target.z-r.z);
        steer=clamp(angleDiff(desired,r.heading)*2.4,-1,1);
        sprint=false;
        if(this.time>=r.nextAIStroke){
          this.stroke(-r.lastSide,r,true);
          const base={cruise:1.26,race:1.04,pro:.86}[this.options.difficulty];
          r.nextAIStroke=this.time+base+.055*r.id+.05*Math.sin(this.time*.43+r.id);
        }
        if(Math.abs(angleDiff(desired,r.heading))>1.1)r.speed*=Math.exp(-dt*.38);
      }else if(input.auto&&this.time-r.lastStroke>=.89)this.stroke(-r.lastSide,r,true);
      r.boosting=sprint&&r.energy>8&&this.time-r.lastStroke<1.25;
      r.energy=clamp(r.energy+(r.boosting?-18:6)*dt,0,100);
      r.heading+=steer*dt*(.40+Math.min(r.speed,5)*.115)*(r.boosting?.84:1);
      r.heading=angleDiff(r.heading,0);
      const sx=Math.sin(r.heading),sz=Math.cos(r.heading);
      r.draft=this.racers.some(other=>{
        const dx=other.x-r.x,dz=other.z-r.z,d=Math.hypot(dx,dz);
        return other.id!==r.id&&d>2&&d<12&&(dx*sx+dz*sz)/d>.96;
      });
      const drag=(.105*r.speed+.016*r.speed*r.speed)*(r.draft?.72:1);
      r.speed=clamp(r.speed+((r.boosting?1.25:0)-drag)*dt,0,r.boosting?8.6:7.2);
      const swell=this.options.sea==='swell'?.09*Math.sin(this.time*1.2+r.z*.16):0;
      r.x+=(sx*r.speed+swell)*dt;r.z+=sz*r.speed*dt;
      if(r.x<-180||r.x>180||r.z<-175||r.z>200){
        r.x=clamp(r.x,-180,180);r.z=clamp(r.z,-175,200);r.speed*=.94;
        if(!r.id)this.say('Γύρισε προς την πράσινη σημαδούρα.');
      }
      if(distance(r,COURSE[r.next])<11){
        r.passed++;r.next=r.passed%COURSE.length;
        if(r.passed===COURSE.length*this.options.laps){
          r.finishedAt=this.time;
          if(!r.id){this.state='finished';this.events.push({type:'finish'});}
        }else if(!r.id){
          this.events.push({type:'checkpoint',index:r.passed});
          this.say(r.next===0?`ΓΥΡΟΣ ${this.lap} — ΠΑΜΕ!`:'ΣΗΜΑΔΟΥΡΑ ✓  + λίγη ανάσα',1.7);
          r.energy=clamp(r.energy+7,0,100);
        }
      }
      for(let i=0;i<COURSE.length;i++){
        const b=COURSE[i],d=distance(r,b);
        if(d<1.5){
          const dx=r.x-b.x,dz=r.z-b.z;
          r.x=b.x+(d>.001?dx/d:1)*1.65;r.z=b.z+(d>.001?dz/d:0)*1.65;
          if(this.time>r.hitUntil){
            r.speed*=.62;r.hitUntil=this.time+1;
            if(!r.id){this.say('Επαφή με σημαδούρα — άνοιξε τη στροφή!');this.events.push({type:'hit'});}
          }
        }
      }
    }
    for(let i=0;i<this.racers.length;i++)for(let j=i+1;j<this.racers.length;j++){
      const a=this.racers[i],b=this.racers[j],d=distance(a,b);
      if(d<1.05&&this.time>a.collisionUntil&&this.time>b.collisionUntil){
        const dx=d>.001?(a.x-b.x)/d:1,dz=d>.001?(a.z-b.z)/d:0;
        a.x+=dx*.6;a.z+=dz*.6;b.x-=dx*.6;b.z-=dz*.6;
        a.speed*=.88;b.speed*=.88;a.collisionUntil=b.collisionUntil=this.time+1;
      }
    }
  }
  snapshot(){return {state:this.state,time:this.time,lap:this.lap,place:this.place,options:{...this.options},
    countdown:this.countdown,strokes:this.strokes,perfect:this.perfect,progress:this.progress,
    player:{...this.player},racers:this.racers.map(r=>({...r}))};}
}
