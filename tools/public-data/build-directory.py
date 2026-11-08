"""Build a minimal public reference directory; never imports operational units or snapshots."""
import json,re,collections,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2]
source=root/'js/complex-reference-data.js'
hub=root/'private-data/building-hub/latest.json'
d=json.loads(source.read_text().split('=',1)[1].rstrip(';\n'))
h=json.loads(hub.read_text())
def address(v):return re.sub(r'\s+','',re.sub(r'\([^)]*\)','',str(v or '')))
def label(v,suffix):return re.sub(r'\s+','',str(v or '').strip()).removesuffix(suffix)
byaddr=collections.defaultdict(list)
for c in d['complexes']:byaddr[address(c['address'])].append(c['code'])
titles=collections.defaultdict(list)
for result in h['results']:
 if result['operation']=='getBrTitleInfo':
  for r in result['rows']:titles[(address(r.get('newPlatPlc')),label(r.get('dongNm'),'동'))].append(r)
groups=collections.defaultdict(dict);excluded=collections.Counter()
for result in h['results']:
 if result['operation']!='getBrExposInfo':continue
 for r in result['rows']:
  addr=address(r.get('newPlatPlc'));dong=label(r.get('dongNm'),'동');ho=label(r.get('hoNm'),'호');codes=byaddr.get(addr,[]);ts=titles.get((addr,dong),[])
  if len(codes)!=1 or len(ts)!=1:excluded['주소·동 유일대조 불가']+=1;continue
  t=ts[0]
  if t.get('mainPurpsCdNm')!='공동주택' or int(t.get('hhldCnt') or 0)<=0 or int(t.get('hoCnt') or 0)>0:excluded['비주거 또는 혼합용도']+=1;continue
  if not re.fullmatch(r'\d+',dong) or not re.fullmatch(r'\d+호?',str(r.get('hoNm','')).strip()):excluded['동호 표기 추가검토']+=1;continue
  groups[(codes[0],dong)][ho]=str(r['mgmBldrgstPk'])
complexes=[]
for c in d['complexes']:
 fire=c.get('fire') or {};buildings=[]
 for (code,dong),units in sorted(groups.items()):
  if code==c['code']:buildings.append({'dong':dong,'units':sorted(units,key=lambda x:(int(x),x)),'match':'unique_road_address_and_residential_title','source':'건축HUB 전유부','observedAt':h['generatedAt']})
 complexes.append({'code':c['code'],'name':c['name'],'address':c['address'],'fire':{'fields':[None if v is None or str(v).strip() in ('','null','비치 ( null )') else v for v in (fire.get('fields') or [None]*9)],'dataStatus':fire.get('dataStatus','unknown')},'entrances':[],'buildings':buildings})
out={'checkedOn':d['checkedOn'],'fields':d['fields'],'sources':{'complex':'K-apt 공공 API','fire':'https://www.k-apt.go.kr/kaptinfo/openKaptMng.do','units':'건축HUB 건축물대장','unitScope':h['targetLegalDongs']},'complexes':complexes}
(root/'js/complex-directory.js').write_text('window.SAFEHOME_COMPLEX_REFERENCES='+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';\n')
summary={'complexes':len(complexes),'facilityRows':sum(any(v for v in ((c['fire'] or {}).get('fields') or [])) for c in complexes),'unitComplexes':sum(bool(c['buildings'])for c in complexes),'buildings':len(groups),'units':sum(len(v)for v in groups.values()),'excludedRows':dict(excluded),'hubScope':h['targetLegalDongs'],'rawSha256':hashlib.sha256(hub.read_bytes()).hexdigest(),'operationalSnapshotsChanged':False}
(root/'docs/reviews/directory-coverage.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,ensure_ascii=False))
if __name__=='__main__':pass
