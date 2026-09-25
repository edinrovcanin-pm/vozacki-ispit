import fitz,sys
d=fitz.open(sys.argv[1]); p=d[int(sys.argv[2])]
for b in p.get_text("dict")["blocks"]:
    if b['type']==1: print("IMG",[round(v) for v in b['bbox']]); continue
    for l in b['lines']:
        t="".join(s['text'] for s in l['spans'])
        s=l['spans'][0]
        print([round(v) for v in l['bbox']], hex(s['color']), s['font'][:14], repr(t[:70]))
X=[]
for dr in p.get_drawings():
    for it in dr['items']:
        if it[0]=='l':
            a,b=it[1],it[2]
            if abs(a.x-b.x)>3 and abs(a.y-b.y)>3: X.append((round(a.x),round(a.y),round(b.x),round(b.y),dr.get('color')))
print("DIAG",X)
print("IMGS",[ (i[0],p.get_image_rects(i[0])) for i in p.get_images()])
