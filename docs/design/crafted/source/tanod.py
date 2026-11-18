from kit import *
PAGE='tanod'

def switch(on=True):
    return f'<span role="switch" aria-checked="{"true" if on else "false"}" style="width: 44px; height: 26px; border-radius: 13px; background: {GREEN if on else "#CFCBE3"}; position: relative; flex-shrink: 0; display: inline-block"><span style="position: absolute; top: 3px; {"right" if on else "left"}: 3px; width: 20px; height: 20px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 1px 2px rgba(0,0,0,0.2)"></span></span>'

def tall_map(h=600, route=True, pins=None, me=(150,420)):
    blocks=''.join(f'<rect x="{x}" y="{y}" width="{w}" height="{hh}" rx="4" fill="#E6E4EF"></rect>' for x,y,w,hh in
        [(c*125+14+(r%2)*10, r*118+14, 98-((c+r)%3)*14, 88) for r in range(6) for c in range(3)])
    pins = pins if pins is not None else [(268,140,RED,11),(60,250,AMBER,9),(300,520,PD,9)]
    ph=''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" stroke="#FFFFFF" stroke-width="3.5"></circle>' for x,y,c,r in pins)
    rt=f'<path d="M{me[0]} {me[1]} L 120 {me[1]} L 120 228 L 245 228 L 245 140 L 258 140" fill="none" stroke="{PD}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>' if route else ''
    mine=f'<circle cx="{me[0]}" cy="{me[1]}" r="22" fill="{GREEN}" opacity="0.16"></circle><circle cx="{me[0]}" cy="{me[1]}" r="9" fill="{GREEN}" stroke="#FFFFFF" stroke-width="3.5"></circle>'
    return f'''<svg width="100%" height="{h}" viewBox="0 0 390 {h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="display: block"><rect width="390" height="{h}" fill="#F1F0F7"></rect>{blocks}
<path d="M-20 330 C 90 290, 170 360, 260 320 S 380 280, 420 300" fill="none" stroke="#D6E3F6" stroke-width="20"></path>
<path d="M0 110 H390 M0 228 H390 M0 346 H390 M0 464 H390 M120 0 V{h} M245 0 V{h}" fill="none" stroke="#FFFFFF" stroke-width="9"></path>
<path d="M0 228 H390 M120 0 V{h}" fill="none" stroke="#DCD8F7" stroke-width="4"></path>{rt}<circle cx="268" cy="140" r="30" fill="{RED}" opacity="0.12"></circle>{ph}{mine}</svg>'''

def duty():
    hdr=f'''<div style="display: flex; align-items: center; gap: 10px"><img src="/_blob/LOGO_ID" alt="BarangayHub 360" style="width: 30px; height: 30px; object-fit: contain"><p style="margin: 0; flex: 1; font-size: 13px; font-weight: 700; color: #FFFFFF">Tanod · Don Andres Soriano</p>{iconbtn(svgl('bell',18),'Notifications, 1 unread')}</div>
<div><p style="margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; color: rgba(255,255,255,0.75)">NIGHT SHIFT · 6 PM TO 6 AM</p><p style="margin: 4px 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.6px; color: #FFFFFF">Magandang gabi, Pedro.</p></div>
<div style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; background: rgba(20,17,80,0.28)"><span style="flex: 1"><span style="display: block; font-size: 14px; font-weight: 700; color: #FFFFFF">On duty</span><span style="display: block; font-size: 12px; color: rgba(255,255,255,0.8)">Sharing location with the barangay · 3h 12m</span></span>{switch(True)}</div>'''
    cur=card(f'''<div style="padding: 14px 16px 12px"><div style="display: flex; align-items: center; gap: 8px">{tag("Critical","danger")}<span style="font-size: 12px; color: {MUTED}">Assigned 4 min ago by Kgd. Maria Santos</span></div>
<div style="display: flex; gap: 12px; margin-top: 10px"><span style="color: {RED}; display: flex; padding-top: 2px">{ico("flood",22)}</span><span style="flex: 1"><span style="display: block; font-size: 16px; font-weight: 800; color: {INK}">Flooding near the creek</span><span style="display: block; margin-top: 2px; font-size: 13px; color: {BODY}">Riverside, behind the chapel · 350 m</span></span></div></div>
<div style="position: relative">{flat_map(110,[(268,80,RED,9),(150,128,GREEN,8)],route=False)}</div>
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px 16px 14px">{btn("Navigate","secondary",svgl("route",16),full=True)}{btn("I'm on the way","primary",full=True)}</div>''','0','box-shadow: 0 12px 28px -18px rgba(26,24,48,0.5)')
    q=[('noise','Loud karaoke past midnight','Purok 3 · 900 m','Waiting','warn'),('animals','Stray dogs near the school','Purok 1 · 1.2 km','Waiting','quiet')]
    queue=card(card_head('Up next','<a href="#" style="font-size: 13px; font-weight: 700">See all</a>')+''.join(row(f'<a href="#" style="display: flex; align-items: center; gap: 12px"><span style="color: {PD}; display: flex">{ico(n,20)}</span><span style="flex: 1; min-width: 0"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}">{t}</span><span style="display: block; font-size: 12px; color: {MUTED}">{s}</span></span>{status(st,tone)}</a>', False, '12px 16px') for n,t,s,st,tone in q))
    shift=card(f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr))">'+''.join(f'<div style="padding: 12px 14px; {"border-left: 1px solid "+LINE if i else ""}"><span style="display: block; font-size: 20px; font-weight: 800; color: {INK}">{v}</span><span style="display: block; font-size: 11px; color: {MUTED}">{l}</span></div>' for i,(v,l) in enumerate([('3','handled tonight'),('6 min','avg. response'),('4.8','resident rating')]))+'</div>')
    return phone('Tanod: duty home', hdr, cur+queue+shift, 'Duty', TANOD_TABS, band_h=262)

def assigned():
    hdr=phone_top('Assigned to me', back=False, right=iconbtn(svgl('filter',18),'Filter'))+segmented(['Active · 3','Done today · 4'],0,True)
    items=[('flood','Flooding near the creek','Riverside · 350 m','On the way','ok','Critical','danger'),
           ('noise','Loud karaoke past midnight','Purok 3 · 900 m · 25 min ago','Waiting','warn','Normal','quiet'),
           ('animals','Stray dogs near the school','Purok 1 · 1.2 km · 1 h ago','Waiting','quiet','Low','quiet')]
    rows=''.join(row(f'''<a href="#" style="display: flex; gap: 12px"><span style="color: {RED if pt=='danger' else PD}; display: flex; padding-top: 2px">{ico(n,20)}</span><span style="flex: 1; min-width: 0"><span style="display: flex; align-items: center; gap: 8px"><span style="flex: 1; font-size: 14px; font-weight: 700; color: {INK}">{t}</span>{tag(p,pt) if pt=='danger' else ''}</span><span style="display: block; margin-top: 2px; font-size: 12px; color: {MUTED}">{s}</span><span style="display: block; margin-top: 6px">{status(st,tone)}</span></span><span style="color: {MUTED}; padding-top: 2px">{svgl("chev",16)}</span></a>''', i==0, '14px') for i,(n,t,s,st,tone,p,pt) in enumerate(items))
    done=[('infrastructure','Streetlight out on Mabini Street','Resolved 7:02 PM · 9 min'),('garbage','Burning trash on Rizal Street','Resolved 6:40 PM · 12 min')]
    drows=''.join(row(f'<div style="display: flex; align-items: center; gap: 12px"><span style="color: {GREEN}; display: flex">{svgl("check",18,2.2)}</span><span style="flex: 1"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}">{t}</span><span style="display: block; font-size: 12px; color: {MUTED}">{s}</span></span></div>', i==0, '12px 14px') for i,(n,t,s) in enumerate(done))
    return phone('Tanod: assigned list', hdr, card(rows)+f'<div>{label("EARLIER TONIGHT")}{card(drows)}</div>', 'Assigned', TANOD_TABS, band_h=128)

def assignment():
    hdr=phone_top('Flooding near the creek', sub='BH-2026-0418 · Critical', right=iconbtn(svgl('dots',18),'More'))
    mp=card(f'<div style="position: relative">{tall_map(250, pins=[(268,140,RED,11)], me=(40,228))}<span style="position: absolute; left: 10px; top: 10px; display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border-radius: 8px; background: #FFFFFF; font-size: 12px; font-weight: 800; color: {INK}; box-shadow: 0 2px 6px rgba(26,24,48,0.12)">350 m · about 4 min walk</span><span style="position: absolute; right: 10px; bottom: 10px">{btn("Open in Maps","secondary",svgl("route",15),small=True)}</span></div>')
    steps=['Assigned','On the way','On scene','Resolved']
    pipe=card(f'{progress(2,4,GREEN)}<div style="display: flex; margin-top: 6px">'+''.join(f'<span style="flex: 1; text-align: center; font-size: 11px; font-weight: {800 if i==1 else 600}; color: {GREEN if i<2 else MUTED}">{s}</span>' for i,s in enumerate(steps))+'</div>','12px 14px')
    info=card(f'<p style="margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: {MUTED}">WHAT THE RESIDENT SAID</p><p style="margin: 6px 0 0; font-size: 14px; line-height: 1.55; color: {BODY}">Water from the creek is reaching the houses behind the chapel. Knee-deep at the corner. Two families with kids.</p><p style="margin: 8px 0 0; font-size: 12px; color: {MUTED}">Flood · Riverside · 2 photos · 4 min ago</p>','14px 16px')
    who=card(row(f'<div style="display: flex; align-items: center; gap: 12px">{avatar("JD",36,SOFT,PD,10)}<span style="flex: 1"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}">Juan Dela Cruz</span><span style="display: block; font-size: 12px; color: {MUTED}">Reporter · Tap to call</span></span>{iconbtn(svgl("phone",17,2),"Call reporter","plain")}</div>',True,'12px 14px')+row(f'<div style="display: flex; align-items: center; gap: 12px">{avatar("MS",36,SOFT,PD,10)}<span style="flex: 1"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}">Kgd. Maria Santos</span><span style="display: block; font-size: 12px; color: {MUTED}">Dispatcher · on the radio</span></span>{iconbtn(svgl("phone",17,2),"Call dispatcher","plain")}</div>',False,'12px 14px'))
    foot=f'<div style="padding: 12px 16px 20px; background: #FFFFFF; border-top: 1px solid {LINE}; position: relative; z-index: 2; display: flex; gap: 8px">{btn("Need backup","secondary",large=True)}<span style="flex: 1; display: flex">{btn("I\'ve arrived","primary",full=True,large=True)}</span></div>'
    return phone('Tanod: assignment and route', hdr, mp+pipe+info+who, None, band_h=96, footer=foot)

def resolve():
    hdr=phone_top('Close the report', sub='Flooding near the creek · on scene 22 min')
    outs=[('Resolved on site',True),('Referred to BFP / PNP / MDRRMO',False),('Couldn\'t find it',False),('False report',False)]
    oc=card(f'<p style="margin: 0; padding: 12px 14px 4px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: {MUTED}">OUTCOME</p>'+''.join(row(f'<label style="display: flex; align-items: center; gap: 12px; cursor: pointer"><span style="width: 20px; height: 20px; border-radius: 50%; box-sizing: border-box; border: {"6px solid "+PD if on else "2px solid #CFCBE3"}; flex-shrink: 0"></span><span style="font-size: 14px; font-weight: {700 if on else 600}; color: {INK}">{t}</span></label>', i==0, '12px 14px') for i,(t,on) in enumerate(outs)))
    notes=field('What did you do?','Helped two families move to the covered court. Cleared the drain at the corner with the residents. Water is going down.',area=True,h=72)
    photos=f'''<div><span style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 700; color: {INK}">Photos of the scene</span><div style="display: flex; gap: 8px">{''.join('<span style="width: 72px; height: 72px; border-radius: 10px; background: repeating-linear-gradient(135deg, #E6E4EF 0 8px, #EFEEF5 8px 16px)"></span>' for _ in range(2))}<button type="button" aria-label="Add photo" style="all: unset; box-sizing: border-box; width: 72px; height: 72px; border-radius: 10px; border: 1.5px dashed #CFCBE3; color: {PD}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer">{svgl("camera",20)}<span style="font-size: 11px; font-weight: 700">Add</span></button></div></div>'''
    fu=card(f'<div style="display: flex; align-items: center; gap: 12px"><span style="flex: 1"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}">Needs follow-up</span><span style="display: block; font-size: 12px; color: {MUTED}">Ask an official to check again in the morning</span></span>{switch(True)}</div>','12px 14px')
    foot=f'<div style="padding: 12px 16px 20px; background: #FFFFFF; border-top: 1px solid {LINE}; position: relative; z-index: 2; display: flex; flex-direction: column; gap: 8px"><p style="margin: 0; font-size: 12px; color: {MUTED}; text-align: center">The resident is notified and can rate the response.</p>{btn("Mark as resolved","primary",svgl("check",17,2.2),full=True,large=True)}</div>'
    return phone('Tanod: resolve', hdr, oc+notes+photos+fu, None, band_h=66, footer=foot)

def tmap():
    body=f'''<div style="width: 390px; height: 844px; box-sizing: border-box; position: relative; overflow: hidden; font-family: Sora, system-ui, sans-serif; background: {BG}; display: flex; flex-direction: column">
<div style="position: absolute; inset: 0">{tall_map(844, route=True, pins=[(268,140,RED,11),(60,250,AMBER,9),(300,520,PD,9),(330,700,PD,8)])}</div>
<div style="position: relative; z-index: 2; padding: 16px; display: flex; gap: 8px; align-items: center"><span style="flex: 1; display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 14px; border-radius: 12px; background: #FFFFFF; border: 1px solid {LINE}; box-shadow: 0 4px 12px -6px rgba(26,24,48,0.25); color: {MUTED}">{svgl("search",17)}<span style="font-size: 14px">Search a street or purok</span></span>{iconbtn(svgl("target",18),"Center on me","plain",44)}</div>
<div style="position: relative; z-index: 2; padding: 0 16px; display: flex; gap: 6px">{''.join(f'<span style="display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border-radius: 8px; background: #FFFFFF; border: 1px solid {LINE}; font-size: 12px; font-weight: 700; color: {INK}"><span style="width: 8px; height: 8px; border-radius: 50%; background: {c}"></span>{t}</span>' for t,c in [('Mine · 1',RED),('Open · 3',PD),('Noise',AMBER)])}</div>
<div style="flex: 1"></div>
<div style="position: relative; z-index: 2; margin: 0 12px 10px; background: #FFFFFF; border-radius: 16px; border: 1px solid {LINE}; box-shadow: 0 16px 32px -16px rgba(26,24,48,0.45); padding: 8px 16px 14px">
<span style="display: block; width: 36px; height: 4px; border-radius: 2px; background: {LINE}; margin: 0 auto 10px"></span>
<div style="display: flex; align-items: center; gap: 8px">{tag("Critical","danger")}<span style="font-size: 12px; color: {MUTED}">Your assignment · 350 m</span></div>
<p style="margin: 8px 0 2px; font-size: 16px; font-weight: 800; color: {INK}">Flooding near the creek</p><p style="margin: 0 0 12px; font-size: 13px; color: {BODY}">Riverside, behind the chapel</p>
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">{btn("Details","secondary",full=True)}{btn("I've arrived","primary",full=True)}</div></div>
{tabbar('Map',TANOD_TABS)}</div>'''
    return page('Tanod: map', 390, 844, body)

def stats():
    hdr=phone_top('My performance', back=False, sub='November 2026 · sample data')+segmented(['This week','This month'],1,True)
    k=[('28','Resolved'),('6 min','Avg. response'),('92%','Within target'),('4.8','Resident rating')]
    kp=f'<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">'+''.join(card(f'<span style="display: block; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: {INK}">{v}</span><span style="display: block; margin-top: 2px; font-size: 12px; color: {MUTED}">{l}</span>','12px 14px') for v,l in k)+'</div>'
    days=[('M',4),('T',6),('W',3),('T',7),('F',5),('S',9),('S',2)]
    mx=9
    bars=''.join(f'<div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px"><span style="font-size: 11px; font-weight: 700; color: {INK if i==5 else MUTED}">{v}</span><span style="width: 100%; max-width: 26px; height: {int(v/mx*96)}px; border-radius: 6px 6px 2px 2px; background: {PD if i==5 else "#CFCBF6"}"></span><span style="font-size: 11px; color: {MUTED}">{d}</span></div>' for i,(d,v) in enumerate(days))
    chart=card(card_head('Reports handled','<span style="font-size: 12px; color: '+MUTED+'">Last 7 days</span>')+f'<div style="display: flex; align-items: flex-end; gap: 8px; height: 140px; padding: 0 18px 14px">{bars}</div>')
    cats=[('noise','Noise',11),('infrastructure','Infrastructure',7),('flood','Flood',4),('animals','Animals',3)]
    cb=card(card_head('By type')+''.join(row(f'<div style="display: flex; align-items: center; gap: 10px"><span style="color: {PD}; display: flex">{ico(n,18)}</span><span style="width: 104px; font-size: 13px; font-weight: 600; color: {INK}">{l}</span><span style="flex: 1; height: 6px; border-radius: 3px; background: {SOFT}"><span style="display: block; width: {int(v/11*100)}%; height: 6px; border-radius: 3px; background: {PD}"></span></span><span style="width: 22px; text-align: right; font-size: 13px; font-weight: 700; color: {INK}">{v}</span></div>', False, '10px 18px') for n,l,v in cats))
    return phone('Tanod: performance', hdr, kp+chart+cb, 'Stats', TANOD_TABS, band_h=146)

SCREENS=[('T01-Duty','Duty home',duty,390,844),('T02-Assigned','Assigned list',assigned,390,844),('T03-Assignment','Assignment and route',assignment,390,844),
         ('T04-Resolve','Close the report',resolve,390,844),('T05-Map','Duty map',tmap,390,844),('T06-Stats','My performance',stats,390,844)]
if __name__=='__main__':
    for f,t,fn,w,h in SCREENS:
        open(f'project/{f}.dc.html','w').write(fn())
    print('tanod ok', len(SCREENS))
