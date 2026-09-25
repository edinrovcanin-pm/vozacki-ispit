import fitz, re, json, os
OUT='../public/img'; os.makedirs(OUT,exist_ok=True)
AREAS={'o1':'Poznavanje propisa o sigurnosti saobraćaja','o2':'Saobraćajni znakovi','o3':'Saobraćajne situacije (raskrsnice)','o4':'Prva pomoć'}

def lines_of(p):
    L=[]
    for b in p.get_text("dict")["blocks"]:
        if b['type']!=0: continue
        for l in b['lines']:
            t="".join(s['text'] for s in l['spans'])
            if not t.strip(): continue
            sp=[s for s in l['spans'] if s['text'].strip()]
            x0,y0,x1,y1=l['bbox']
            L.append(dict(x0=x0,y0=y0,x1=x1,y1=y1,yc=(y0+y1)/2,t=t,color=sp[0]['color'],
                bold=sum(len(s['text'].strip()) for s in sp if ('Bold' in s['font']) or (s['flags']&16))*2>sum(len(s['text'].strip()) for s in sp), spans=sp))
    for l in L:
        l['qn']=None
        if l['spans'][0]['color']==0xffffff and re.fullmatch(r'\s*\d+\s*',l['spans'][0]['text']):
            l['qn']=int(l['spans'][0]['text']); l['rest']="".join(s['text'] for s in l['spans'][1:])
    L.sort(key=lambda l:(round(l['y0'])-(10 if l['qn'] else 0),l['x0']))
    return L

def clean(s):
    s=re.sub(r'\s+',' ',s).strip()
    return s

def parse_main(key):
    d=fitz.open(key+'.pdf'); qs=[]; cur=None
    for pi,p in enumerate(d):
        L=lines_of(p)
        diag=[]
        for dr in p.get_drawings():
            if dr.get('color')!=(0,0,0): continue
            for it in dr['items']:
                if it[0]=='l':
                    a,b=it[1],it[2]
                    if abs(a.x-b.x)>3 and abs(a.y-b.y)>3: diag.append((min(a.x,b.x),min(a.y,b.y),max(a.x,b.x),max(a.y,b.y)))
        qn=[l for l in L if l['qn']]
        qx=min([l['x0'] for l in qn],default=(45 if key=='o1' else 72))
        page_qs=[]
        for l in L:
            if l['qn']:
                cur=dict(area=key,n=l['qn'],page=pi+1,y=l['y0'],qlines=[l['rest']] if l['rest'].strip() else [],digits=[],alines=[],cats='',imgs=[],pageref=pi)
                qs.append(cur); page_qs.append(cur); continue
            if cur is None: continue
            if l['color']==0xff0000 or l['color']>>16>0xc0 and (l['color']&0xffff)<0x4040:
                cur['cats']+=l['t']; continue
            if l['y0']>725 and l['x0']>540 and re.fullmatch(r'\s*\d+\s*',l['t']): continue  # page number
            m=re.match(r'^\s*(\d{1,2})(?:\s+(.*))?$',l['t'])
            if m and l['x0']<qx+15 and not l['bold']:
                yc=l['yc']+pi*2000
                mark=any(x0<qx+20 and y0-2<=l['yc']<=y1+2 for x0,y0,x1,y1 in diag)
                cur['digits'].append(dict(n=int(m.group(1)),yc=yc,ok=mark,pi=pi))
                if m.group(2) and m.group(2).strip(): cur['alines'].append((yc,m.group(2)))
                continue
            if l['x0']<qx+15: continue
            yc=l['yc']+pi*2000
            first=cur['digits'][0]['yc'] if cur['digits'] else None
            if l['bold'] and not cur['digits']:
                cur['qlines'].append(l['t'])
            else:
                cur['alines'].append((yc,l['t'],l['y0']+pi*2000))
        # images
        for img in p.get_images(full=True):
            xref=img[0]
            for r in p.get_image_rects(xref):
                cands=[q for q in page_qs if q['y']<=r.y0+25]
                tgt=cands[-1] if cands else (qs[-len(page_qs)-1] if len(qs)>len(page_qs) else None)
                if tgt and not any(abs(r.x0-o.x0)<1 and abs(r.y0-o.y0)<1 for _,o,_p in tgt['imgs']): tgt['imgs'].append((xref,r,pi))
    # post-process
    out=[]
    doc=fitz.open(key+'.pdf')
    for q in qs:
        ans={}
        for dg in q['digits']: ans[dg['n']]=dict(t=[],ok=dg['ok'],yc=dg['yc'])
        for a in q['alines']:
            yc,t=a[0],a[1]
            if not ans: continue
            n=min(ans,key=lambda k:abs(ans[k]['yc']-yc))
            ans[n]['t'].append(t)
        qtext=clean(' '.join(q['qlines']))
        # non-bold question lines fallback: alines above first digit
        answers=[dict(t=clean(' '.join(v['t'])),ok=v['ok']) for k,v in sorted(ans.items())]
        imgs=[]
        if len(q['imgs'])>1:
            u=fitz.Rect(q['imgs'][0][1])
            for _,r,_p in q['imgs'][1:]: u|=r
            pg=doc[q['imgs'][0][2]]
            pix=pg.get_pixmap(clip=u+(-4,-4,4,4),dpi=220)
            fn=f"{key}-{q['n']:03d}.jpg"; pix.save(os.path.join(OUT,fn),jpg_quality=85)
            imgs.append(dict(src='img/'+fn,w=pix.width,h=pix.height)); q['imgs']=[]
        for i,(xref,r,_p) in enumerate(q['imgs']):
            fn=f"{key}-{q['n']:03d}{'' if i==0 else '-'+str(i)}.jpg"
            pix=fitz.Pixmap(doc,xref)
            if pix.alpha or pix.n>3:
                pix=fitz.Pixmap(fitz.csRGB,pix) if pix.colorspace and pix.colorspace.n!=3 else pix
                if pix.alpha: pix=fitz.Pixmap(pix,0)
            if pix.colorspace is None or pix.colorspace.n!=3: pix=fitz.Pixmap(fitz.csRGB,pix)
            pix.save(os.path.join(OUT,fn),jpg_quality=85) if hasattr(pix,'save') else None
            imgs.append(dict(src='img/'+fn,w=pix.width,h=pix.height,ar=round(r.width/r.height,3)))
        cats=[c for c in re.split(r'[,\s]+',q['cats'].split('-')[0]) if c in ('A','B','C','D','T')]
        cats=list(dict.fromkeys(cats))
        out.append(dict(id=f"{key}-{q['n']}",area=key,n=q['n'],page=q['page'],q=qtext,a=answers,cat=cats,img=imgs,multi=('više tačnih' in qtext) or sum(a['ok'] for a in answers)>1))
    return out

def parse_o4():
    d=fitz.open('o4.pdf'); groups=[]; texts=[]; qnums=[]; qtext=[]
    for pi,p in enumerate(d):
        for l in lines_of(p):
            if pi==0 and l['y0']<97: continue
            if l['y0']>760: continue
            if l['x0']<100:
                if re.fullmatch(r'\s*\d+\s*',l['t']): qnums.append((pi,l['yc'],int(l['t'])))
                continue
            if l['x0']<285: qtext.append((pi,l['yc'],l['t'])); continue
            if l['x0']<312 and re.fullmatch(r'\s*[ABCD]\s*',l['t']):
                if l['t'].strip()=='A': groups.append(dict(ans=[],q=[],n=None))
                groups[-1]['ans'].append(dict(L=l['t'].strip(),pi=pi,yc=l['yc'],ok=l['bold'],t=[])); continue
            texts.append((pi,l['yc'],l['t']))
    allans=[a for g in groups for a in g['ans']]
    for pi,yc,t in texts:
        c=[a for a in allans if a['pi']==pi]
        min(c,key=lambda a:abs(a['yc']-yc))['t'].append(t)
    def grp(pi,yc):
        best=None;bd=1e9
        for g in groups:
            ys=[a['yc'] for a in g['ans'] if a['pi']==pi]
            if not ys: continue
            dd=0 if min(ys)-8<=yc<=max(ys)+8 else min(abs(y-yc) for y in ys)
            if dd<bd: bd=dd;best=g
        return best
    for pi,yc,n in qnums: grp(pi,yc)['n']=n
    for pi,yc,t in qtext: grp(pi,yc)['q'].append(t)
    return [dict(id=f"o4-{g['n']}",area='o4',n=g['n'],page=g['ans'][0]['pi']+1,q=clean(' '.join(g['q'])),
            a=[dict(t=clean(' '.join(a['t'])),ok=a['ok']) for a in g['ans']],cat=[],img=[],multi=False) for g in groups]

allq=[]
for k in ['o1','o2','o3']: allq+=parse_main(k)
allq+=parse_o4()
json.dump(allq,open('questions.json','w'),ensure_ascii=False,indent=1)
from collections import Counter
for k in AREAS:
    qq=[q for q in allq if q['area']==k]
    print(k,len(qq),'noOK',[q['n'] for q in qq if not any(a['ok'] for a in q['a'])][:30],
      'fewAns',[q['n'] for q in qq if len(q['a'])<2][:20],'noQ',[q['n'] for q in qq if not q['q']][:20],
      'emptyAns',[q['n'] for q in qq if any(not a['t'] for a in q['a'])][:20],
      'dupN',[n for n,c in Counter(q['n'] for q in qq).items() if c>1][:10],
      'imgs',sum(len(q['img']) for q in qq),'multiImg',[q['n'] for q in qq if len(q['img'])>1][:10],
      'seqgap',[ (a['n'],b['n']) for a,b in zip(qq,qq[1:]) if b['n']!=a['n']+1][:10])
