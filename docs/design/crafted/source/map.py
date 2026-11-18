from kit import *
from official import th, tr, t2, tx, toolbar, searchbox, select
from tanod import switch
PAGE='map'

# ---------------- the town (map units, 1000 x 700) ----------------
XS=[180,340,500,660,820]            # vertical streets (lean 20 over the height)
YS=[120,260,400,600]                # horizontal streets (rise 16 over the width)
def vx(x,y): return x+10-20*y/700   # x of vertical street at height y
def hy(y,x): return y-8+16*x/1000   # y of horizontal street at x
BOUNDARY=[(90,70),(330,46),(520,40),(720,70),(900,110),(950,360),(905,520),(860,610),(520,662),(180,620),(70,470),(60,300)]
def poly(pts): return 'M'+' L'.join(f'{x} {y}' for x,y in pts)+' Z'
RIVER='M-20 548 C 140 515, 260 520, 380 540 S 600 568, 720 530 S 900 490, 1020 512'
PUROKS=[('PUROK 1',230,205),('PUROK 2',590,190),('PUROK 3',850,315),('PUROK 4',330,350),('PUROK 5',800,440),('RIVERSIDE',260,580)]
LANDMARKS=[('Barangay hall',600,318,'home'),('Chapel',430,248,'blotter'),('Elementary school',255,105,'documents'),('Market',740,370,'tickets'),('Covered court',585,365,None)]
INCIDENTS=[ # id, cat, title, where, x, y, tone, age
  ('BH-0415','flood','Flooding near the creek','Riverside',494,516,'critical','4 min'),
  ('BH-0414','noise','Loud karaoke past midnight','Purok 3, Mabini St.',745,264,'high','25 min'),
  ('BH-0412','infrastructure','Streetlight out on Mabini St.','Purok 2',612,262,'normal','1 h'),
  ('BH-0409','animals','Stray dogs near the school','Purok 1',262,150,'normal','3 h'),
]
RESOLVED=[(520,458),(503,640),(300,330),(860,420),(420,180),(700,610),(150,420),(830,200),(380,460),(640,150)]
TONEC={'critical':RED,'high':AMBER,'normal':PD,'resolved':'#A9A6BF'}

def _rand(seed):
    s=[seed]
    def r():
        s[0]=(s[0]*1103515245+12345)&0x7fffffff
        return s[0]/0x7fffffff
    return r

def buildings():
    r=_rand(7); out=[]
    xs=[0]+XS+[1000]; ys=[0]+YS+[700]
    for i in range(len(xs)-1):
        for j in range(len(ys)-1):
            x0,x1=xs[i]+14,xs[i+1]-14; y0,y1=ys[j]+14,ys[j+1]-14
            if x1-x0<30 or y1-y0<30: continue
            if 510<=x0<=660 and 270<=y0<=400: continue  # plaza
            yy=y0
            while yy<y1-16:
                xx=x0; h=14+int(r()*14)
                while xx<x1-14:
                    w=16+int(r()*22)
                    w=min(w,x1-xx)
                    cy=yy+h/2
                    if not (500<cy<585):  # river band
                        out.append(f'<rect x="{xx:.0f}" y="{yy:.0f}" width="{w-3:.0f}" height="{h-3:.0f}" rx="2"></rect>')
                    xx+=w+(4 if r()<0.8 else 14)
                yy+=h+5
    return '<g fill="#E4E2EE">'+''.join(out)+'</g>'
BUILD=buildings()

def roads():
    minor=''.join(f'<path d="M{vx(x,0):.0f} 0 L{vx(x,700):.0f} 700"></path>' for x in XS if x!=500)+''.join(f'<path d="M0 {y-8} L1000 {y+8}"></path>' for y in YS if y!=400)
    major=f'<path d="M{vx(500,0):.0f} 0 L{vx(500,700):.0f} 700"></path><path d="M0 392 L1000 408"></path>'
    return (f'<g fill="none" stroke-linecap="round"><g stroke="#DAD7E6" stroke-width="13">{minor}</g><g stroke="#FFFFFF" stroke-width="10">{minor}</g>'
            f'<g stroke="#D3CEF3" stroke-width="19">{major}</g><g stroke="#FFFFFF" stroke-width="15">{major}</g></g>')

def street_labels():
    lab=[('Mabini St.',360,hy(260,360)-0.5,0.9),('National Highway',270,hy(400,270)-0.5,0.9),('Rizal St.',vx(500,170)+0.5,170,-88.4),('Luna St.',vx(820,520)+0.5,520,-88.4)]
    return ''.join(f'<text x="{x:.0f}" y="{y:.0f}" transform="rotate({a} {x:.0f} {y:.0f})" font-size="10.5" font-weight="700" fill="#8C89A6" text-anchor="middle" dominant-baseline="middle" style="paint-order: stroke; stroke: #FFFFFF; stroke-width: 3px">{t}</text>' for t,x,y,a in lab)

def base(dim=True, labels=True, boundary=True, puroks=True, landmarks=True, purok_fill=False):
    land='<rect x="-200" y="-200" width="1400" height="1100" fill="#F1F0F7"></rect>'
    green=f'<rect x="512" y="276" width="146" height="112" rx="10" fill="#E2F1E8"></rect><path d="M900 40 C 960 60, 990 120, 1000 180 L1000 0 L880 0 Z" fill="#E2F1E8"></path><path d="M0 640 C 60 610, 120 650, 160 700 L0 700 Z" fill="#E2F1E8"></path>'
    river=f'<path d="{RIVER}" fill="none" stroke="#CFE0F6" stroke-width="30" stroke-linecap="round"></path><path d="{RIVER}" fill="none" stroke="#DCE8F8" stroke-width="20" stroke-linecap="round"></path>'
    pz=''
    if purok_fill:
        zones=[([(90,70),(330,46),(420,40),(420,260),(60,300)],'#5B54E8'),([(420,40),(720,70),(700,330),(420,330)],'#14834F'),([(720,70),(900,110),(950,360),(700,330)],'#B45309'),([(60,300),(420,260),(420,470),(70,470)],'#2563EB'),([(700,330),(950,360),(905,520),(720,500)],'#D92D4B'),([(70,470),(420,470),(720,500),(905,520),(860,610),(520,662),(180,620)],'#0E7490')]
        pz=''.join(f'<path d="{poly(p)}" fill="{c}" fill-opacity="0.07" stroke="{c}" stroke-opacity="0.5" stroke-width="1.5" stroke-dasharray="3 4"></path>' for p,c in zones)
    dimp=f'<path d="M-200 -200 H1200 V900 H-200 Z {poly(BOUNDARY)}" fill="rgba(46,42,140,0.08)" fill-rule="evenodd"></path>' if dim else ''
    bnd=(f'<path d="{poly(BOUNDARY)}" fill="none" stroke="rgba(91,84,232,0.16)" stroke-width="9" stroke-linejoin="round"></path>'
         f'<path d="{poly(BOUNDARY)}" fill="none" stroke="{PD}" stroke-width="2.2" stroke-dasharray="9 6" stroke-linejoin="round"></path>') if boundary else ''
    pl=''.join(f'<text x="{x}" y="{y}" font-size="11.5" font-weight="800" letter-spacing="1.6" fill="#A19DBC" text-anchor="middle">{t}</text>' for t,x,y in PUROKS) if puroks else ''
    lm=''
    if landmarks:
        for t,x,y,ic in LANDMARKS:
            if ic:
                lm+=f'<g><rect x="{x-11}" y="{y-11}" width="22" height="22" rx="7" fill="#FFFFFF" stroke="{LINE}"></rect><g transform="translate({x-7} {y-7})">{ico(ic,14,False,MUTED)}</g><text x="{x+16}" y="{y+4}" font-size="11" font-weight="700" fill="{BODY}" style="paint-order: stroke; stroke: #F1F0F7; stroke-width: 3px">{t}</text></g>'
            else:
                lm+=f'<text x="{x}" y="{y}" font-size="10.5" font-weight="700" fill="#4E8A68" text-anchor="middle">{t}</text>'
    return land+green+river+pz+BUILD+roads()+(street_labels() if labels else '')+pl+lm+dimp+bnd

def pin(x,y,cat,tone='normal',sel=False,size=1.0):
    c=TONEC[tone]; s=size*(1.25 if sel else 1)
    halo=f'<circle class="mpulse" cx="{x}" cy="{y-21*s:.1f}" r="{18*s:.1f}" fill="{c}" opacity="0.35"></circle>' if tone=='critical' else ''
    ring=f'<circle cx="{x}" cy="{y-21*s:.1f}" r="{21*s:.1f}" fill="none" stroke="{c}" stroke-width="2" opacity="0.35"></circle>' if sel else ''
    d=f'M{x} {y} C {x-3*s:.1f} {y-7*s:.1f}, {x-14*s:.1f} {y-11*s:.1f}, {x-14*s:.1f} {y-21*s:.1f} A {14*s:.1f} {14*s:.1f} 0 1 1 {x+14*s:.1f} {y-21*s:.1f} C {x+14*s:.1f} {y-11*s:.1f}, {x+3*s:.1f} {y-7*s:.1f}, {x} {y} Z'
    g=int(16*s)
    return f'<g>{halo}{ring}<ellipse cx="{x}" cy="{y}" rx="{6*s:.1f}" ry="{2.2*s:.1f}" fill="rgba(26,24,48,0.22)"></ellipse><path d="{d}" fill="{c}" stroke="#FFFFFF" stroke-width="2.5"></path><g transform="translate({x-g/2:.1f} {y-21*s-g/2:.1f})">{ico(cat,g,False,"#FFFFFF")}</g></g>'

def dot(x,y,c='#A9A6BF',r=5):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" stroke="#FFFFFF" stroke-width="2"></circle>'

def tanod(x,y,ini='PB',label=None,heading=None,c=GREEN,off=False):
    cone=f'<path d="M{x} {y} L{x-16} {y-34} A 36 36 0 0 1 {x+16} {y-34} Z" fill="{c}" opacity="0.14" transform="rotate({heading} {x} {y})"></path>' if heading is not None else ''
    lab=f'<g><rect x="{x+16}" y="{y-11}" width="{len(label)*6.4+16:.0f}" height="22" rx="7" fill="#FFFFFF" stroke="{LINE}"></rect><text x="{x+24}" y="{y+4}" font-size="11" font-weight="700" fill="{INK}">{label}</text></g>' if label else ''
    fill='#B9B6CC' if off else c
    return f'<g>{cone}<circle cx="{x}" cy="{y}" r="15" fill="#FFFFFF"></circle><circle cx="{x}" cy="{y}" r="12.5" fill="{fill}"></circle><text x="{x}" y="{y+4}" font-size="10" font-weight="800" fill="#FFFFFF" text-anchor="middle">{ini}</text>{lab}</g>'

def cluster(x,y,n):
    return f'<g><circle cx="{x}" cy="{y}" r="22" fill="{PD}" opacity="0.15"></circle><circle cx="{x}" cy="{y}" r="15" fill="{PD}" stroke="#FFFFFF" stroke-width="2.5"></circle><text x="{x}" y="{y+4.5}" font-size="12" font-weight="800" fill="#FFFFFF" text-anchor="middle">{n}</text></g>'

ROUTE=[(560,404),(vx(500,402),402),(vx(500,516),516)]
def route(pts=ROUTE, c=PD, w=6, dash=False):
    d='M'+' L'.join(f'{x:.0f} {y:.0f}' for x,y in pts)
    if dash:
        return f'<path d="{d}" fill="none" stroke="{c}" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round" stroke-linejoin="round"></path>'
    return f'<path d="{d}" fill="none" stroke="#FFFFFF" stroke-width="{w+5}" stroke-linecap="round" stroke-linejoin="round"></path><path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"></path>'

TRAIL=[(vx(340,120),120),(vx(340,260),hy(260,vx(340,260))),(500,hy(260,500)),(vx(500,330),330),(vx(500,400),401),(560,404)]
def trail():
    d='M'+' L'.join(f'{x:.0f} {y:.0f}' for x,y in TRAIL)
    return f'<path d="{d}" fill="none" stroke="{GREEN}" stroke-width="3" stroke-opacity="0.55" stroke-dasharray="2 5" stroke-linecap="round" stroke-linejoin="round"></path>'

def heat():
    blobs=[(745,250,120,0.55),(500,520,110,0.6),(262,160,80,0.35),(612,262,70,0.3)]
    defs='<defs><radialGradient id="hg"><stop offset="0" stop-color="#D92D4B" stop-opacity="0.75"></stop><stop offset="0.35" stop-color="#F97316" stop-opacity="0.45"></stop><stop offset="0.7" stop-color="#F59E0B" stop-opacity="0.18"></stop><stop offset="1" stop-color="#F59E0B" stop-opacity="0"></stop></radialGradient></defs>'
    return defs+''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="url(#hg)" opacity="{o}"></circle>' for x,y,r,o in blobs)

def gaps():
    defs=f'<defs><pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="{PD}" fill-opacity="0.05"></rect><line x1="0" y1="0" x2="0" y2="10" stroke="{PD}" stroke-opacity="0.35" stroke-width="3"></line></pattern></defs>'
    areas=[[(720,70),(900,110),(935,280),(840,230),(760,190)],[(70,470),(180,450),(230,560),(180,620)]]
    lab=[('No patrol in 14 h',790,150),('No patrol in 9 h',196,530)]
    return defs+''.join(f'<path d="{poly(a)}" fill="url(#hatch)" stroke="{PD}" stroke-opacity="0.5" stroke-dasharray="4 4"></path>' for a in areas)+''.join(f'<g><rect x="{x-58}" y="{y-12}" width="116" height="24" rx="8" fill="#FFFFFF" stroke="{LINE}"></rect><text x="{x}" y="{y+4}" font-size="11" font-weight="700" fill="{PD}" text-anchor="middle">{t}</text></g>' for t,x,y in lab)

def mapsvg(view, layers, w='100%', h='100%', **kw):
    x,y,vw,vh=view
    return f'<svg width="{w}" height="{h}" viewBox="{x} {y} {vw} {vh}" preserveAspectRatio="xMidYMid slice" aria-label="Map of Don Andres Soriano" role="img" style="display: block; font-family: Sora, system-ui, sans-serif">{base(**kw)}{layers}</svg>'

def incident_pins(sel=None, resolved=False, skip=()):
    out=''
    if resolved: out+=''.join(dot(x,y) for x,y in RESOLVED)
    for i,c,t,wh,x,y,tone,age in INCIDENTS:
        if i in skip: continue
        out+=pin(x,y,c,tone,sel==i)
    return out

# ---------------- map chrome ----------------
def mbtn(icon,label,on=False):
    return f'<button type="button" aria-label="{label}" style="all: unset; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: {PD if on else INK}; cursor: pointer; {"background: "+SOFT+";" if on else ""}">{icon}</button>'
def controls(extra=''):
    grp=lambda *b: f'<div style="display: flex; flex-direction: column; background: #FFFFFF; border: 1px solid {LINE}; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px -6px rgba(26,24,48,0.25)">'+f'<span style="height: 1px; background: {LINE}"></span>'.join(b)+'</div>'
    return f'<div style="position: absolute; right: 12px; top: 12px; display: flex; flex-direction: column; gap: 8px">{grp(mbtn(svgl("plus",17),"Zoom in"),mbtn(svgl("minus",17),"Zoom out"))}{grp(mbtn(svgl("fit",17),"Fit to barangay"),mbtn(svgl("target",17),"My location"))}{grp(mbtn(svgl("ruler",16),"Measure distance"),mbtn(svgl("expand",16),"Full screen"))}{extra}</div>'
def chip(t,on=False,icon=None,dotc=None):
    ic=f'<span style="display: flex">{icon}</span>' if icon else ''
    dc=f'<span style="width: 8px; height: 8px; border-radius: 50%; background: {dotc}"></span>' if dotc else ''
    st=f'background: {PD}; color: #FFFFFF; border: 1px solid {PD};' if on else f'background: #FFFFFF; color: {INK}; border: 1px solid {LINE};'
    return f'<button type="button" aria-pressed="{"true" if on else "false"}" style="all: unset; box-sizing: border-box; height: 32px; padding: 0 11px; border-radius: 9px; display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 6px -3px rgba(26,24,48,0.2); {st}">{ic}{dc}{t}</button>'
def layerbar(on=('Reports','Tanods'), extra=''):
    names=[('Reports','incidents'),('Tanods','tanods'),('Heatmap',None),('Patrol gaps',None),('Puroks',None)]
    chips=''.join(chip(n, n in on, ico(i,15,n in on,"currentColor",PD) if i else None) for n,i in names)
    return f'<div style="position: absolute; left: 12px; top: 12px; right: 64px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center">{chip("Layers",False,svgl("layers",15))}<span style="width: 1px; height: 20px; background: {LINE}; margin: 0 2px"></span>{chips}{extra}</div>'
def legend(items=None):
    items = items or [('Critical',RED,'pin'),('High',AMBER,'pin'),('Normal',PD,'pin'),('Resolved','#A9A6BF','dot'),('Tanod',GREEN,'dot')]
    it=''.join(f'<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: {BODY}"><span style="width: {10 if k=="pin" else 9}px; height: {10 if k=="pin" else 9}px; border-radius: {"50% 50% 50% 0; transform: rotate(-45deg)" if k=="pin" else "50%"}; background: {c}"></span>{l}</span>' for l,c,k in items)
    bd=f'<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: {BODY}"><span style="width: 16px; border-top: 2px dashed {PD}"></span>Barangay boundary</span>'
    return f'<div style="position: absolute; left: 12px; bottom: 12px; display: flex; gap: 14px; align-items: center; padding: 8px 12px; border-radius: 10px; background: rgba(255,255,255,0.94); border: 1px solid {LINE}">{it}{bd}</div>'
def scalebar(right=12, bottom=12):
    return f'<div style="position: absolute; right: {right}px; bottom: {bottom}px; display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 8px; background: rgba(255,255,255,0.94); border: 1px solid {LINE}; font-size: 11px; font-weight: 700; color: {BODY}"><span style="width: 64px; height: 6px; border: 2px solid {BODY}; border-top: 0"></span>200 m</div>'

def mapcard(svg, overlay='', h=704):
    return f'<section style="position: relative; height: {h}px; border-radius: 14px; overflow: hidden; border: 1px solid {LINE}; background: #F1F0F7">{svg}{overlay}</section>'

# ---------------- left rail ----------------
def queue(sel='BH-0415'):
    tabs=segmented(['Needs you · 1','Active · 4','Resolved'],1)
    rows=''
    for i,c,t,wh,x,y,tone,age in INCIDENTS:
        st={'BH-0415':('Unassigned','danger'),'BH-0414':('Ramon Garcia','info'),'BH-0412':('Pedro · on the way','ok'),'BH-0409':('Waiting','warn')}[i]
        s=i==sel
        rows+=f'''<a href="#" style="display: flex; gap: 12px; padding: 12px 16px; border-top: 1px solid {LINE}; {"background: "+SOFT+"; box-shadow: inset 3px 0 0 "+PD+";" if s else ""}"><span style="color: {TONEC[tone]}; display: flex; padding-top: 2px">{ico(c,19)}</span><span style="flex: 1; min-width: 0"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{t}</span><span style="display: block; font-size: 12px; color: {MUTED}">{wh} · {age} ago</span><span style="display: block; margin-top: 5px">{status(*st)}</span></span></a>'''
    tz=''.join(f'<div style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-top: 1px solid {LINE}">{avatar(a,28,GREENBG if on else "#F0EFF5",GREEN if on else MUTED,8)}<span style="flex: 1; min-width: 0">{t2(n,s)}</span>{status("On duty","ok") if on else status("Off duty","quiet")}</div>' for a,n,s,on in [('PB','Pedro Bautista','Responding · Rizal St.',True),('RG','Ramon Garcia','Last seen 6:10 PM',False)])
    return card(f'<div style="padding: 12px 16px; display: flex; flex-direction: column; gap: 10px">{tabs}{searchbox("Search reports or streets",306)}</div>'+rows+f'<p style="margin: 0; padding: 12px 16px 6px; border-top: 1px solid {LINE}; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: {MUTED}">TANODS</p>'+tz,'0','height: 704px; display: flex; flex-direction: column')

VIEW=(110,0,800,704)
def window_pill():
    return f'<span style="position: absolute; left: 12px; top: 54px">{chip("Open + resolved in the last 30 days",False,svgl("clock",14))}</span>'

def shell(title, sub, actions, left, mp):
    content=f'<div style="display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 16px">{left}{mp}</div>'
    return desktop(title,'INCIDENT MAP','Don Andres Soriano, live',sub,actions,content,'Incident map',band_h=150,h=900,pet=False)
ACTS=btn('Replay 24 h','onband',svgl('clock',15))+btn('Log a walk-in report','white',svgl('plus',16))

# ---------------- screens ----------------
def live():
    layers=trail()+incident_pins(resolved=True)+tanod(560,404,'PB','Pedro · responding',heading=-90)
    mp=mapcard(mapsvg(VIEW,layers), layerbar()+window_pill()+controls()+legend()+scalebar())
    return shell('Incident map: live','4 active reports · 1 tanod on duty · updated 7:46 PM',ACTS,queue(None),mp)

def dispatch():
    layers=incident_pins(sel='BH-0415',resolved=False)+route(ROUTE,GREEN,5)+tanod(560,404,'PB','Pedro · 4 min',heading=-90)
    resp=[('PB','Pedro Bautista','On duty · 350 m by road',"4 min walk",True),('RG','Ramon Garcia','Off duty · 1.8 km',"9 min by motorbike",False)]
    rr=''.join(f'''<div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-top: 1px solid {LINE}; {"background: "+GREENBG+";" if best else ""}">{avatar(a,34,"#FFFFFF" if best else "#F0EFF5",GREEN if best else MUTED,10)}<span style="flex: 1; min-width: 0"><span style="display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; color: {INK}">{n}{tag("Nearest","ok") if best else ""}</span><span style="display: block; font-size: 12px; color: {MUTED}">{s}</span></span><span style="font-size: 13px; font-weight: 800; color: {GREEN if best else BODY}; white-space: nowrap">{e}</span></div>''' for a,n,s,e,best in resp)
    photos=''.join('<span style="flex: 1; height: 64px; border-radius: 8px; background: repeating-linear-gradient(135deg, #E6E4EF 0 8px, #EFEEF5 8px 16px)"></span>' for _ in range(2))
    drawer=f'''<aside style="position: absolute; right: 12px; top: 12px; bottom: 12px; width: 360px; background: #FFFFFF; border-radius: 14px; border: 1px solid {LINE}; box-shadow: 0 24px 48px -24px rgba(10,8,40,0.45); display: flex; flex-direction: column; overflow: hidden">
<div style="padding: 14px 16px 12px; display: flex; gap: 10px; align-items: flex-start"><span style="flex: 1"><span style="display: flex; gap: 8px; align-items: center">{tag("Critical","danger")}<span style="font-size: 12px; color: {MUTED}">BH-2026-0415 · 4 min ago</span></span><span style="display: block; margin-top: 8px; font-size: 18px; font-weight: 800; color: {INK}">Flooding near the creek</span><span style="display: block; margin-top: 2px; font-size: 13px; color: {BODY}">Riverside, by the Rizal St. bridge · reported by Ana Reyes</span></span>{iconbtn(svgl("x",16,2.2),"Close","plain",32)}</div>
<div style="padding: 0 16px 12px; display: flex; gap: 6px">{photos}</div>
<p style="margin: 0; padding: 0 16px 12px; font-size: 13px; line-height: 1.55; color: {BODY}">Water from the creek is reaching the houses behind the chapel. Knee-deep at the corner. Two families with kids.</p>
<p style="margin: 0; padding: 10px 16px 6px; border-top: 1px solid {LINE}; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: {MUTED}">NEAREST TANODS, BY ROAD</p>{rr}
<div style="padding: 12px 16px; border-top: 1px solid {LINE}; display: flex; flex-direction: column; gap: 10px">{''.join(f'<div style="display: flex; align-items: center; gap: 12px"><span style="flex: 1; font-size: 13px; color: {BODY}">{t}</span>{switch(on)}</div>' for t,on in [('Tell Ana that help is on the way',True),('Send the route to Pedro\'s phone',True)])}</div>
<div style="margin-top: auto; padding: 14px 16px; border-top: 1px solid {LINE}; display: flex; flex-direction: column; gap: 8px">{btn("Dispatch Pedro","primary",svgl("send",15),full=True,large=True)}<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">{btn("Call MDRRMO","secondary",svgl("phone",15,2),full=True)}{btn("Open report","secondary",full=True)}</div><p style="margin: 2px 0 0; font-size: 11px; color: {MUTED}; text-align: center">Road times from OpenRouteService · refreshed 30 s ago</p></div></aside>'''
    mp=mapcard(mapsvg((300,110,800,704),layers), f'<div style="position: absolute; left: 12px; top: 12px">{chip("Layers",False,svgl("layers",15))}</div>'+drawer+f'<div style="position: absolute; left: 12px; bottom: 12px">{scalebar(0,0).replace("position: absolute; right: 0px; bottom: 0px;","")}</div>')
    return shell('Incident map: dispatch','Critical report waiting · Pedro is 4 min away',ACTS,queue('BH-0415'),mp)

def hotspots():
    layers=heat()+gaps()+''.join(dot(x,y,'#8E8AAA',4) for x,y in RESOLVED)+incident_pins()+trail()+tanod(560,404,'PB')
    stats=[('Purok 3','12','Noise · mostly after 10 PM',12),('Riverside','7','Flooding after heavy rain',7),('Purok 2','6','Streetlights, garbage',6),('Purok 1','4','Stray animals',4),('Purok 4','3','Garbage',3),('Purok 5','1','Traffic',1)]
    sr=''.join(f'<div style="padding: 10px 16px; border-top: 1px solid {LINE}"><div style="display: flex; align-items: baseline; gap: 8px"><span style="font-size: 14px; font-weight: 700; color: {INK}">{p}</span><span style="font-size: 12px; color: {MUTED}">{d}</span><span style="margin-left: auto; font-size: 14px; font-weight: 800; color: {INK}">{n}</span></div><div style="margin-top: 6px; height: 6px; border-radius: 3px; background: {SOFT}"><div style="width: {v/12*100:.0f}%; height: 6px; border-radius: 3px; background: {RED if v>=10 else (AMBER if v>=6 else PD)}"></div></div></div>' for p,n,d,v in stats)
    gp=''.join(f'<div style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-top: 1px solid {LINE}"><span style="width: 14px; height: 14px; border-radius: 4px; background: repeating-linear-gradient(45deg, rgba(91,84,232,0.45) 0 2px, rgba(91,84,232,0.08) 2px 5px)"></span><span style="flex: 1">{t2(a,b)}</span>{btn("Plan patrol","secondary",small=True)}</div>' for a,b in [('Purok 3, north of Luna St.','No patrol in 14 h'),('Riverside, west end','No patrol in 9 h')])
    left=card(card_head('Hotspots this month','<span style="font-size: 12px; color: '+MUTED+'">31 reports</span>')+sr+f'<p style="margin: 0; padding: 12px 16px 6px; border-top: 1px solid {LINE}; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: {MUTED}">PATROL GAPS · LAST 12 H</p>'+gp,'0','height: 704px')
    leg=legend([('Many reports',RED,'dot'),('Some',AMBER,'dot'),('Resolved','#8E8AAA','dot')]).replace('Barangay boundary</span></div>','Barangay boundary</span><span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: '+BODY+'"><span style="width: 14px; height: 10px; border-radius: 3px; background: repeating-linear-gradient(45deg, rgba(91,84,232,0.45) 0 2px, rgba(91,84,232,0.08) 2px 5px)"></span>Patrol gap</span></div>')
    mp=mapcard(mapsvg(VIEW,layers,purok_fill=True), layerbar(('Reports','Tanods','Heatmap','Patrol gaps','Puroks'))+f'<span style="position: absolute; left: 12px; top: 54px">{chip("Last 30 days",False,svgl("clock",14))}</span>'+controls()+leg+scalebar())
    return shell('Incident map: hotspots and patrol gaps','Where reports cluster, and where no one has patrolled lately',ACTS,left,mp)

def replay():
    layers=trail()+incident_pins(skip=('BH-0414',))+''.join(dot(x,y) for x,y in RESOLVED[:6])+tanod(vx(500,330),330,'PB','Pedro · 9:40 PM',heading=180)
    ticks=[(0.08,PD),(0.21,'#A9A6BF'),(0.33,'#A9A6BF'),(0.47,PD),(0.58,AMBER),(0.71,'#A9A6BF'),(0.79,RED),(0.83,AMBER)]
    tk=''.join(f'<span style="position: absolute; left: {p*100:.0f}%; top: 4px; width: 4px; height: 14px; margin-left: -2px; border-radius: 2px; background: {c}"></span>' for p,c in ticks)
    hours=''.join(f'<span style="flex: 1; font-size: 11px; color: {MUTED}">{h}</span>' for h in ['8 PM','12 AM','4 AM','8 AM','12 PM','4 PM','8 PM'])
    bar=f'''<div style="position: absolute; left: 12px; right: 12px; bottom: 12px; background: #FFFFFF; border: 1px solid {LINE}; border-radius: 14px; padding: 12px 16px; box-shadow: 0 16px 32px -20px rgba(10,8,40,0.4)">
<div style="display: flex; align-items: center; gap: 12px"><button type="button" aria-label="Pause" style="all: unset; width: 38px; height: 38px; border-radius: 50%; background: {PD}; color: #FFFFFF; display: flex; align-items: center; justify-content: center; cursor: pointer">{svgl("pause",16,2.4)}</button>
<span><span style="display: block; font-size: 16px; font-weight: 800; color: {INK}">Tue, Nov 17 · 9:40 PM</span><span style="display: block; font-size: 12px; color: {MUTED}">Pedro on patrol along Rizal St. · 2 reports open</span></span>
<span style="margin-left: auto; display: flex; gap: 6px">{segmented(["1×","4×","16×"],1)}</span>{btn("Exit replay","secondary",small=True)}</div>
<div style="position: relative; height: 22px; margin-top: 12px; border-radius: 6px; background: {BG}">{tk}<span style="position: absolute; left: 0; top: 0; bottom: 0; width: 7%; border-radius: 6px; background: rgba(91,84,232,0.14)"></span><span style="position: absolute; left: 7%; top: -4px; width: 4px; height: 30px; margin-left: -2px; border-radius: 2px; background: {PD}"></span><span style="position: absolute; left: 7%; top: -9px; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: #FFFFFF; border: 3px solid {PD}; box-sizing: border-box"></span></div>
<div style="display: flex; margin-top: 6px">{hours}</div></div>'''
    ev=[('9:12 PM','incidents','Report: streetlight out on Mabini St.','Resident · Purok 2',PD),('9:15 PM','tanods','Pedro assigned','By Kgd. Maria Santos',GREEN),('9:31 PM','tanods','Pedro starts patrol','Rizal St., heading south',GREEN),('9:40 PM','noise','Report: loud karaoke','Resident · Purok 3',AMBER),('10:02 PM','check','Streetlight report resolved','Pedro · 47 min',MUTED)]
    er=''.join(f'<div style="display: grid; grid-template-columns: 62px 20px minmax(0, 1fr); gap: 8px; align-items: start; padding: 10px 16px; border-top: 1px solid {LINE}; {"opacity: 0.45;" if i==4 else ""}{"background: "+SOFT+";" if i==3 else ""}"><span style="font-size: 12px; font-weight: 700; color: {MUTED}">{t}</span><span style="color: {c}; display: flex">{svgl("check",17,2.2) if ic=="check" else ico(ic,17)}</span>{t2(a,b)}</div>' for i,(t,ic,a,b,c) in enumerate(ev))
    left=card(card_head('Replay · last 24 hours',sub='Events at the playhead are highlighted')+er,'0','height: 704px')
    mp=mapcard(mapsvg(VIEW,layers), layerbar()+controls()+bar)
    return shell('Incident map: 24-hour replay','Replaying Tue, Nov 17 · tanod trails and reports as they happened',btn('Back to live','white',svgl('back',15)),left,mp)

def boundary_editor():
    handles=''.join(f'<circle cx="{x}" cy="{y}" r="7" fill="#FFFFFF" stroke="{PD}" stroke-width="3"></circle>' for x,y in BOUNDARY)
    mids=''.join(f'<circle cx="{(a[0]+b[0])/2:.0f}" cy="{(a[1]+b[1])/2:.0f}" r="4.5" fill="{PD}" opacity="0.35"></circle>' for a,b in zip(BOUNDARY,BOUNDARY[1:]+BOUNDARY[:1]))
    moved=f'<circle cx="905" cy="520" r="11" fill="none" stroke="{PD}" stroke-width="2" opacity="0.5"></circle><path d="M905 520 L940 505" stroke="{PD}" stroke-width="2" stroke-dasharray="3 3"></path><path d="M900 110 L960 330 L905 520" fill="none" stroke="#A9A6BF" stroke-width="1.6" stroke-dasharray="4 4"></path>'
    layers=moved+mids+handles
    zones=[('Purok 1','#5B54E8','Drawn'),('Purok 2','#14834F','Drawn'),('Purok 3','#B45309','Drawn'),('Purok 4','#2563EB','Drawn'),('Purok 5','#D92D4B','Drawn'),('Riverside','#0E7490','Drawn')]
    zr=''.join(f'<div style="display: flex; align-items: center; gap: 10px; padding: 9px 16px; border-top: 1px solid {LINE}"><span style="width: 14px; height: 14px; border-radius: 4px; background: {c}; opacity: 0.8"></span><span style="flex: 1; font-size: 14px; font-weight: 600; color: {INK}">{n}</span><span style="font-size: 12px; color: {MUTED}">{s}</span>{iconbtn(svgl("pen",14),"Edit "+n,"plain",30)}</div>' for n,c,s in zones)
    steps=''.join(f'<div style="display: flex; gap: 10px; padding: 6px 0"><span style="width: 20px; height: 20px; border-radius: 50%; background: {SOFT}; color: {PD}; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0">{i+1}</span><span style="font-size: 13px; line-height: 1.5; color: {BODY}">{t}</span></div>' for i,t in enumerate(['Start from the OpenStreetMap outline.','Drag the white points to match the real boundary. Tap a faint point to add a corner.','Draw purok zones inside it for hotspot stats.']))
    left=card(card_head('Barangay boundary',sub='Used to fit the map, dim the outside and warn about reports outside the barangay.')+f'<div style="padding: 0 16px 12px">{steps}</div><div style="display: flex; gap: 10px; padding: 10px 16px; border-top: 1px solid {LINE}; background: {AMBERBG}"><span style="color: {AMBER}; display: flex">{svgl("edit",16)}</span><span style="font-size: 12px; line-height: 1.5; color: {BODY}"><b style="color: {INK}">1 change not saved.</b> You moved the southeast corner 40 m east.</span></div>'+f'<p style="margin: 0; padding: 12px 16px 6px; border-top: 1px solid {LINE}; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: {MUTED}">PUROK ZONES</p>'+zr+f'<div style="margin-top: auto; padding: 14px 16px; border-top: 1px solid {LINE}; display: flex; flex-direction: column; gap: 8px">{btn("Save boundary","primary",full=True,large=True)}<div style="display: flex; justify-content: space-between">{btn("Undo","ghost",svgl("undo",15),small=True)}{btn("Reset to OpenStreetMap","ghost",small=True)}</div></div>','0','height: 704px; display: flex; flex-direction: column')
    tip=f'<div style="position: absolute; left: 50%; top: 12px; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 10px; background: {INK}; color: #FFFFFF; font-size: 12px; font-weight: 600">{svgl("pen",14)}Editing the boundary · drag points, Esc to stop</div>'
    meta=f'<div style="position: absolute; left: 12px; bottom: 12px; padding: 8px 12px; border-radius: 10px; background: rgba(255,255,255,0.94); border: 1px solid {LINE}; font-size: 12px; color: {BODY}">Area 1.42 km² · Perimeter 5.3 km · Source: OpenStreetMap, adjusted by Aljho</div>'
    mp=mapcard(mapsvg((40,-60,1000,884),layers,purok_fill=True,landmarks=False), tip+controls()+meta+scalebar())
    content=f'<div style="display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 16px">{left}{mp}</div>'
    return desktop('Incident map: boundary editor','INCIDENT MAP · SETTINGS','Barangay boundary and puroks','Only officials can change this. Every change is logged.',btn('Cancel','onband'),content,'Incident map',band_h=150,h=900,pet=False)

# ---------------- phones ----------------
def phone_map(title, view, layers, overlay, tabs_html='', **kw):
    body=f'''<div style="width: 390px; height: 844px; position: relative; overflow: hidden; font-family: Sora, system-ui, sans-serif; background: #F1F0F7">
<div style="position: absolute; inset: 0">{mapsvg(view, layers, **kw)}</div>{overlay}{tabs_html}</div>'''
    return page(title, 390, 844, body)
def floating_top(left, right=''):
    return f'<div style="position: absolute; left: 12px; right: 12px; top: 14px; display: flex; gap: 8px; align-items: center; z-index: 3">{left}{right}</div>'
def fsearch(ph):
    return f'<label style="flex: 1; display: flex; align-items: center; gap: 8px; height: 46px; padding: 0 14px; border-radius: 12px; background: #FFFFFF; border: 1px solid {LINE}; box-shadow: 0 6px 16px -8px rgba(26,24,48,0.3); color: {MUTED}">{svgl("search",17)}<input type="search" aria-label="{ph}" placeholder="{ph}" style="all: unset; flex: 1; min-width: 0; font-size: 14px; color: {INK}"></label>'
def fbtn(icon,label):
    return f'<button type="button" aria-label="{label}" style="all: unset; flex-shrink: 0; width: 46px; height: 46px; border-radius: 12px; background: #FFFFFF; border: 1px solid {LINE}; box-shadow: 0 6px 16px -8px rgba(26,24,48,0.3); display: flex; align-items: center; justify-content: center; color: {INK}; cursor: pointer">{icon}</button>'
def sheet(inner, h, handle=True):
    hd=f'<span style="display: block; width: 40px; height: 4px; border-radius: 2px; background: {LINE}; margin: 8px auto 4px"></span>' if handle else ''
    return f'<div style="position: absolute; left: 0; right: 0; bottom: 0; height: {h}px; background: #FFFFFF; border-radius: 20px 20px 0 0; box-shadow: 0 -16px 36px -18px rgba(10,8,40,0.4); z-index: 4; display: flex; flex-direction: column">{hd}{inner}</div>'

def official_phone():
    layers=incident_pins(sel='BH-0415',resolved=True)+tanod(560,404,'PB',heading=-90)
    top=floating_top(fbtn(svgl("back",18),"Back")+fsearch("Search reports or streets"),fbtn(svgl("layers",18),"Layers"))
    chips=f'<div style="position: absolute; left: 12px; right: 0; top: 70px; display: flex; gap: 6px; overflow: hidden; z-index: 3">{chip("Needs action · 1",True)}{chip("Active · 4")}{chip("Tanods · 1")}{chip("Heatmap")}</div>'
    item=lambda c,t,s,st,tone,b,first=False: f'<div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; {"" if first else "border-top: 1px solid "+LINE}"><span style="color: {TONEC[tone]}; display: flex">{ico(c,20)}</span><span style="flex: 1; min-width: 0"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}">{t}</span><span style="display: block; font-size: 12px; color: {MUTED}">{s}</span><span style="display: block; margin-top: 4px">{status(*st)}</span></span>{b}</div>'
    inner=f'<div style="display: flex; align-items: center; padding: 4px 16px 8px"><span style="font-size: 16px; font-weight: 800; color: {INK}">4 active reports</span><a href="#" style="margin-left: auto; font-size: 13px; font-weight: 700">List view</a></div>'
    inner+=item('flood','Flooding near the creek','Riverside · 4 min ago · Pedro 4 min away',('Unassigned','danger'),'critical',btn("Dispatch","primary",small=True),True)
    inner+=item('noise','Loud karaoke past midnight','Purok 3 · 25 min ago',('Ramon Garcia','info'),'high','')
    inner+=item('infrastructure','Streetlight out on Mabini St.','Purok 2 · 1 h ago',('Pedro · on the way','ok'),'normal','')
    ctl=f'<div style="position: absolute; right: 12px; bottom: 372px; display: flex; flex-direction: column; gap: 8px; z-index: 3">{fbtn(svgl("fit",18),"Fit to barangay")}{fbtn(svgl("target",18),"My location")}</div>'
    return phone_map('Incident map: official phone',(300,120,390,700),layers,top+chips+ctl+sheet(inner,360))

def tanod_nav():
    pts=[(vx(500,516),516),(vx(500,402),402),(560,404)]
    layers=route([(560,404),(vx(500,402),402),(vx(500,516),516)],PD,7)+pin(494,516,'flood','critical',True)
    me=f'<g><circle cx="560" cy="404" r="26" fill="{BLUE}" opacity="0.12"></circle><path d="M560 404 L542 372 A 36 36 0 0 1 578 372 Z" fill="{BLUE}" opacity="0.18" transform="rotate(-90 560 404)"></path><circle cx="560" cy="404" r="11" fill="#FFFFFF"></circle><circle cx="560" cy="404" r="8" fill="{BLUE}"></circle></g>'
    layers+=me
    instr=f'''<div style="position: absolute; left: 12px; right: 12px; top: 14px; z-index: 3; display: flex; gap: 12px; align-items: center; padding: 14px; border-radius: 16px; background: {PDD}; color: #FFFFFF; box-shadow: 0 12px 24px -12px rgba(10,8,40,0.6)"><span style="width: 48px; height: 48px; border-radius: 12px; background: rgba(255,255,255,0.14); display: flex; align-items: center; justify-content: center">{svgl("turnleft",28,2.4)}</span><span style="flex: 1"><span style="display: block; font-size: 22px; font-weight: 800; letter-spacing: -0.4px">60 m</span><span style="display: block; font-size: 14px; color: rgba(255,255,255,0.88)">Turn left onto Rizal St.</span></span></div>
<div style="position: absolute; left: 12px; top: 104px; z-index: 3; padding: 8px 12px; border-radius: 10px; background: #FFFFFF; border: 1px solid {LINE}; font-size: 12px; color: {BODY}">Then straight 290 m to the bridge</div>'''
    ctl=f'<div style="position: absolute; right: 12px; bottom: 300px; display: flex; flex-direction: column; gap: 8px; z-index: 3">{fbtn(svgl("nav",18),"Recenter")}{fbtn(svgl("layers",18),"Layers")}</div>'
    inner=f'''<div style="padding: 6px 16px 16px; display: flex; flex-direction: column; gap: 12px">
<div style="display: flex; align-items: center; gap: 12px"><span style="flex: 1"><span style="display: block; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: {GREEN}">4 min</span><span style="display: block; font-size: 13px; color: {BODY}">350 m walking · arrive 9:48 PM</span></span>{tag("Critical","danger")}</div>
<div style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; background: {BG}"><span style="color: {RED}; display: flex">{ico("flood",20)}</span><span style="flex: 1; min-width: 0">{t2("Flooding near the creek","Riverside, by the Rizal St. bridge")}</span></div>
<div style="display: flex; gap: 8px">{btn("I've arrived","primary",full=True,large=True)}</div>
<div style="display: flex; align-items: center; gap: 8px"><span style="font-size: 12px; color: {MUTED}">Open in</span>{btn("Google Maps","secondary",small=True)}{btn("Waze","secondary",small=True)}<span style="margin-left: auto; font-size: 11px; color: {MUTED}">GPS high accuracy on</span></div></div>'''
    return phone_map('Tanod: navigation',(330,230,390,700),layers,instr+ctl+sheet(inner,286),labels=True)

def resident_search():
    layers=f'<g><circle cx="430" cy="300" r="34" fill="{PD}" opacity="0.10"></circle><circle cx="430" cy="300" r="34" fill="none" stroke="{PD}" stroke-opacity="0.35"></circle></g>'+pin(430,300,'infrastructure','normal',True)
    top=floating_top(fbtn(svgl("back",18),"Back")+fsearch("Search a street, landmark or purok").replace('placeholder="Search a street, landmark or purok"','value="chap" placeholder="Search a street, landmark or purok"'))
    res=[('blotter','Chapel','Mabini St., Purok 2 · 120 m'),('home','Barangay hall','Rizal St. · 260 m'),('documents','Chapel Road elementary annex','Purok 1 · 640 m')]
    rr=''.join(f'<a href="#" style="display: flex; align-items: center; gap: 12px; padding: 11px 14px; {"border-top: 1px solid "+LINE if i else ""}"><span style="color: {PD}; display: flex">{ico(c,18)}</span><span style="flex: 1; min-width: 0">{t2(a,b)}</span></a>' for i,(c,a,b) in enumerate(res))
    drop=f'<div style="position: absolute; left: 12px; right: 12px; top: 68px; z-index: 3; background: #FFFFFF; border: 1px solid {LINE}; border-radius: 12px; box-shadow: 0 16px 32px -18px rgba(10,8,40,0.45); overflow: hidden">{rr}<p style="margin: 0; padding: 8px 14px; border-top: 1px solid {LINE}; font-size: 11px; color: {MUTED}">Results inside Don Andres Soriano first</p></div>'
    inner=f'''<div style="padding: 6px 16px 18px; display: flex; flex-direction: column; gap: 12px">
<p style="margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: {MUTED}">WHERE IS IT?</p>
<div style="display: flex; gap: 12px"><span style="color: {PD}; display: flex; padding-top: 2px">{svgl("target",20)}</span><span style="flex: 1"><span style="display: block; font-size: 15px; font-weight: 800; color: {INK}">Mabini St. near the chapel</span><span style="display: block; font-size: 13px; color: {BODY}">Purok 2, Don Andres Soriano</span><span style="display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 12px; font-weight: 700; color: {GREEN}">{svgl("check",14,2.6)}Inside the barangay · GPS accurate to 12 m</span></span></div>
<p style="margin: 0; font-size: 12px; color: {MUTED}">Drag the map to move the pin, or search above.</p>
{btn("Use this location","primary",full=True,large=True)}</div>'''
    ctl=f'<div style="position: absolute; right: 12px; bottom: 300px; z-index: 3">{fbtn(svgl("target",18),"Use my GPS")}</div>'
    return phone_map('Resident: pick the location',(240,0,390,700),layers,top+drop+ctl+sheet(inner,282))

def resident_outside():
    layers=pin(968,430,'garbage','normal',True)
    top=floating_top(fbtn(svgl("back",18),"Back")+fsearch("Search a street, landmark or purok"))
    inner=f'''<div style="padding: 6px 16px 18px; display: flex; flex-direction: column; gap: 12px">
<div style="display: flex; gap: 12px; padding: 12px; border-radius: 12px; background: {AMBERBG}"><span style="color: {AMBER}; display: flex; padding-top: 1px">{svgl("globe",20)}</span><span><span style="display: block; font-size: 14px; font-weight: 800; color: {INK}">This spot is outside Don Andres Soriano</span><span style="display: block; margin-top: 2px; font-size: 13px; line-height: 1.5; color: {BODY}">About 60 m past the boundary. Your barangay can still see it, but the barangay where it happened may need to act.</span></span></div>
<div style="display: flex; gap: 12px"><span style="color: {MUTED}; display: flex; padding-top: 2px">{svgl("target",20)}</span><span><span style="display: block; font-size: 15px; font-weight: 800; color: {INK}">Luna St. extension</span><span style="display: block; font-size: 13px; color: {BODY}">Outside the barangay boundary</span></span></div>
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">{btn("Move the pin","secondary",full=True,large=True)}{btn("Report anyway","primary",full=True,large=True)}</div></div>'''
    hint=f'<div style="position: absolute; left: 12px; top: 72px; z-index: 3; display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 10px; background: #FFFFFF; border: 1px solid {LINE}; font-size: 12px; color: {BODY}"><span style="width: 16px; border-top: 2px dashed {PD}"></span>Barangay boundary</div>'
    return phone_map('Resident: outside the barangay',(640,150,390,700),layers,top+hint+sheet(inner,300))

SCREENS=[('MAP01-Live','Command map: live',live,1440,900),('MAP02-Dispatch','Command map: dispatch with road times',dispatch,1440,900),
         ('MAP03-Hotspots','Hotspots and patrol gaps',hotspots,1440,900),('MAP04-Replay','24-hour replay',replay,1440,900),
         ('MAP05-Boundary','Boundary and purok editor',boundary_editor,1440,900),
         ('MAP06-Official-Phone','Official map on a phone',official_phone,390,844),('MAP07-Tanod-Nav','Tanod in-app navigation',tanod_nav,390,844),
         ('MAP08-Resident-Pick','Resident: search and pick location',resident_search,390,844),('MAP09-Resident-Outside','Resident: pin outside the barangay',resident_outside,390,844)]
if __name__=='__main__':
    for f,t,fn,w,h in SCREENS:
        open(f'project/{f}.dc.html','w').write(fn())
    print('map ok', len(SCREENS))
