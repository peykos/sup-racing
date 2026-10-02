// Visual and physical coastline share one declarative source. Ellipse guards keep boards off dry land.
export const COASTS = Object.freeze([
 {x:26,z:52,s:1.7,yaw:.12}, {x:-50,z:-135,s:1.5,yaw:.12},
 {x:-94,z:54,s:2.0,yaw:.4}, {x:146,z:99,s:2.1,yaw:-.3},
 {x:22,z:196,s:2.4,yaw:.2}, {x:-180,z:192,s:3.8,yaw:.8},
 {x:205,z:-118,s:3.0,yaw:1.0}
]);
export function resolveShoreContact(race){
 if(race.state!=='racing')return;
 for(const r of race.racers)for(const p of COASTS){
  const rx=p.s*16.5,rz=p.s*10.7,dx=r.x-p.x,dz=r.z-p.z;
  const d=Math.hypot(dx/rx,dz/rz);
  if(d<1){const a=Math.atan2(dz/rz,dx/rx);r.x=p.x+Math.cos(a)*rx*1.015;r.z=p.z+Math.sin(a)*rz*1.015;r.speed*=.7;if(!r.id)race.say('Ρηχά νερά — γύρισε στη διαδρομή.');}
 }
}
