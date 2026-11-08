(function(root){'use strict';
function assert(ok,message){if(!ok)throw Error(message);}
function unique(rows,key){const seen=new Set();for(const r of rows){const k=key(r);assert(k&&!seen.has(k),'식별자 누락 또는 중복');seen.add(k);}}
function parse(d){
 if(d?.type==='FeatureCollection'){
 assert(Array.isArray(d.features)&&d.features.length,'진출입로 목록 없음');
 for(const f of d.features){const p=f.properties,c=f.geometry?.coordinates;assert(f.type==='Feature'&&f.geometry?.type==='Point'&&Array.isArray(c)&&c.length===2&&c.every(Number.isFinite)&&c[0]>=124&&c[0]<=132&&c[1]>=33&&c[1]<=39,'좌표 또는 Point 형식 오류');assert(p&&['source_id','kapt_code','entrance_number','source_date','verification_status'].every(k=>typeof p[k]==='string'&&p[k].trim()),'진출입로 출처·식별자 누락');}
 unique(d.features,f=>[f.properties.source_id,f.properties.kapt_code,f.properties.entrance_number].join(':'));
 return {kind:'access',label:'긴급차량 진출입로',count:d.features.length,data:d};
 }
 if(d?.status==='review_only'&&Array.isArray(d.complexes)&&Array.isArray(d.buildings)){
 assert(typeof d.source_date==='string','부동산원 기준일 누락');assert(d.complexes.length,'단지 목록 없음');
 unique(d.complexes,c=>typeof c['단지고유번호']==='string'?c['단지고유번호'].trim():'');
 const ids=new Set(d.complexes.map(c=>c['단지고유번호'].trim()));
 for(const b of d.buildings)assert(typeof b['단지고유번호']==='string'&&ids.has(b['단지고유번호'].trim()),'동의 단지 식별자 불일치');
 return {kind:'reb',label:'부동산원 단지·동 식별정보',count:d.complexes.length,data:d};
 }
 assert(d?.schemaVersion===1&&typeof d.generatedAt==='string'&&Array.isArray(d.complexes)&&Array.isArray(d.errors),'지원하지 않는 자료 형식');
 unique(d.complexes,c=>typeof c?.kaptCode==='string'?c.kaptCode.trim():'');
 for(const c of d.complexes)assert(c.facilities&&typeof c.facilities==='object'&&!Array.isArray(c.facilities)&&Object.values(c.facilities).every(f=>f&&typeof f==='object'&&f.scope==='complex'&&f.unitVerified===false),'시설 적용 범위 오류');
 return {kind:'kapt',label:'K-apt API 수집',count:d.complexes.length,data:d};
}
function link(kapt,access,reb,rebId){const entrances=access?access.features.filter(f=>f.properties.kapt_code===kapt.kaptCode):[];const complex=reb?.complexes.find(c=>c['단지고유번호'].trim()===String(rebId).trim());return {kaptCode:kapt.kaptCode,entrances,reb:complex?{complex,buildings:reb.buildings.filter(b=>b['단지고유번호'].trim()===complex['단지고유번호'].trim()),sourceDate:reb.source_date}:null};}
const api={parse,link};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SafehomePublicData=api;
})(typeof globalThis!=='undefined'?globalThis:this);
