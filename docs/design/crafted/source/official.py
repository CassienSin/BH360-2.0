from kit import *
PAGE='official'
def th(cols, labels):
    return f'<div style="display: grid; grid-template-columns: {cols}; gap: 14px; padding: 10px 18px; border-top: 1px solid {LINE}; background: #FAFAFD; font-size: 12px; font-weight: 700; color: {MUTED}">'+''.join(f'<span>{l}</span>' for l in labels)+'</div>'
def tr(cols, cells, extra=''):
    return f'<div style="display: grid; grid-template-columns: {cols}; gap: 14px; align-items: center; padding: 11px 18px; border-top: 1px solid {LINE}; {extra}">'+''.join(cells)+'</div>'
def t2(a,b): return f'<span style="min-width: 0"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{a}</span><span style="display: block; font-size: 12px; color: {MUTED}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{b}</span></span>'
def tx(a,c=BODY,w=500): return f'<span style="font-size: 13px; font-weight: {w}; color: {c}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{a}</span>'
def toolbar(left, right=''):
    return f'<div style="display: flex; align-items: center; gap: 10px; padding: 12px 18px">{left}<span style="margin-left: auto; display: flex; gap: 8px">{right}</span></div>'
def searchbox(ph, w=260):
    return f'<label style="display: flex; align-items: center; gap: 8px; width: {w}px; height: 36px; padding: 0 12px; box-sizing: border-box; border-radius: 10px; border: 1px solid {LINE}; color: {MUTED}; font-size: 13px">{svgl("search",15)}<input type="search" aria-label="{ph}" placeholder="{ph}" style="all: unset; flex: 1; font-size: 13px; color: {INK}"></label>'
def select(lbl):
    return f'<button type="button" style="all: unset; box-sizing: border-box; height: 36px; padding: 0 12px; border-radius: 10px; border: 1px solid {LINE}; display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: {BODY}; cursor: pointer">{lbl}<span style="color: {MUTED}">{svgl("down",14)}</span></button>'

def dashboard(overlay='', pet=None):
    stats=[('Unassigned reports','0',None,'2 this month'),('Tanods on duty','1 of 2',GREEN,'Pedro on a call'),('Tickets to reply','2',None,'oldest 3 h'),('Documents waiting','0',None,'all within deadline'),('Residents to verify','2',None,'oldest today'),('Overdue KP case','1',RED,'2 days past')]
    cells=''.join(f'''<a href="#" style="flex: 1; min-width: 0; padding: 14px 16px; {'border-left: 1px solid '+LINE if i else ''}"><span style="display: block; font-size: 12px; font-weight: 600; color: {MUTED}; white-space: nowrap">{l}</span><span style="display: block; margin-top: 6px; font-size: 24px; font-weight: 800; letter-spacing: -0.6px; font-variant-numeric: tabular-nums; color: {c or (MUTED if v=='0' else INK)}">{v}</span><span style="display: block; margin-top: 2px; font-size: 12px; color: {c if c==RED else MUTED}">{s}</span></a>''' for i,(l,v,c,s) in enumerate(stats))
    strip=f'<div style="display: flex; background: #FFFFFF; border: 1px solid {LINE}; border-radius: 14px; box-shadow: 0 1px 2px rgba(26,24,48,0.05), 0 12px 28px -18px rgba(26,24,48,0.35)">{cells}</div>'
    rows=[('blotter','Case KP-2026-0003 · mediation','Ramon Cruz v. Juan Dela Cruz','Overdue 2 days',RED,btn('Review','danger',small=True)),
          ('tickets','Streetlight out on Mabini Street','Ticket · Juan Dela Cruz','Waiting 3 h',AMBER,btn('Reply',small=True)),
          ('tickets','Garbage not collected on Rizal Street','Ticket · Ana Reyes','Waiting 1 h',MUTED,btn('Reply',small=True)),
          ('verifications','Maria Lopez','Verification · Purok 4','Signed up today',MUTED,btn('Verify',small=True)),
          ('verifications','Jose Santos','Verification · Purok 1','Signed up yesterday',MUTED,btn('Verify',small=True))]
    cols='22px minmax(0, 1fr) 130px 84px'
    rh=''.join(tr(cols,[f'<span style="color: {MUTED}; display: flex">{ico(n,18)}</span>',t2(a,b),f'<span style="font-size: 12px; font-weight: 700; color: {c}">{w}</span>',f'<span style="justify-self: end">{bt}</span>']) for n,a,b,w,c,bt in rows)
    att=card(card_head('Waiting on you <span style="font-weight: 700; color: '+MUTED+'; font-size: 13px">&nbsp;5</span>','<a href="#" style="font-size: 13px; font-weight: 700">View all</a>')+rh)
    today=[('9:00 AM','Mediation hearing','KP-2026-0003 · Lupon room'),('2:00 PM','Clearance pickups','3 documents ready at the hall'),('Sat','Water interruption','Purok 1–3, 9 AM to 3 PM')]
    td=card(card_head('Today')+''.join(row(f'<div style="display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 12px"><span style="font-size: 12px; font-weight: 800; color: {PD}">{a}</span>{t2(b,c)}</div>',pad='10px 18px') for a,b,c in today))
    legend=''.join(f'<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: {BODY}"><span style="width: 8px; height: 8px; border-radius: 50%; background: {c}"></span>{l}</span>' for l,c in [('Critical',RED),('Open',PD),('Noise',AMBER),('Tanod',GREEN)])
    mp=card(card_head('Map','<a href="#" style="font-size: 13px; font-weight: 700">Open full map</a>')+f'<div style="border-top: 1px solid {LINE}; border-bottom: 1px solid {LINE}">{flat_map(200)}</div><div style="display: flex; gap: 14px; padding: 10px 18px">{legend}</div>'+row(f'<div style="display: flex; align-items: center; gap: 10px"><span style="width: 8px; height: 8px; border-radius: 50%; background: {RED}"></span><span style="flex: 1; font-size: 13px; color: {INK}"><b>Flooding near the creek</b> · Riverside · 4 min ago</span>{btn("Dispatch","primary",small=True)}</div>',pad='10px 18px'))
    tan=card(card_head('Tanods',f'<span style="font-size: 13px; font-weight: 700; color: {GREEN}">1 of 2 on duty</span>')+''.join(row(f'<div style="display: flex; align-items: center; gap: 12px">{avatar(i,30)}{t2(n,"")}<span style="margin-left: auto">{status(s,tone)}</span></div>',pad='10px 18px') for i,n,s,tone in [('PB','Pedro Bautista','Responding','ok'),('RG','Ramon Garcia','Off duty','quiet')]))
    content=f'''{strip}<div style="display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); gap: 16px; align-items: start"><div style="display: flex; flex-direction: column; gap: 16px">{att}{td}</div><div style="display: flex; flex-direction: column; gap: 16px">{mp}{tan}</div></div>'''
    acts=btn('Open map','onband',ico('map',17))+btn('New announcement','white',ico('announcements',17))
    return desktop('Official: dashboard','WEDNESDAY, NOVEMBER 18','Magandang gabi, Aljho.','One case is overdue. Two tickets and two verifications are waiting on you.',acts,content,'Dashboard',band_h=236,overlay=overlay,pet=pet)

def incidents():
    tabs=segmented(['Active · 4','Unassigned · 1','Resolved','All'],0)
    tb=toolbar(tabs+searchbox('Search reports'), select('All categories')+select('Any priority')+btn('Export','secondary',svgl('download',15),small=False))
    cols='96px minmax(0, 1.6fr) 120px minmax(0, 1fr) 96px 150px 110px'
    data=[('Critical','danger','Flooding near the creek','Report #BH-2026-0415','flood','Flood','Riverside','4 min ago','Unassigned','danger',btn('Dispatch','primary',small=True)),
          ('High','warn','Loud karaoke past midnight','Report #BH-2026-0414','noise','Noise','Purok 3, Mabini St.','25 min ago','Ramon Garcia','info',btn('Open',small=True)),
          ('Medium','quiet','Streetlight out on Mabini Street','Report #BH-2026-0412','infrastructure','Infrastructure','Purok 2','1 h ago','Pedro Bautista · on the way','ok',btn('Open',small=True)),
          ('Medium','quiet','Stray dogs near the school','Report #BH-2026-0409','animals','Animals','Purok 1','3 h ago','Pedro Bautista','info',btn('Open',small=True)),
          ('Low','quiet','Garbage not collected on Rizal Street','Report #BH-2026-0401','garbage','Garbage','Purok 4','Yesterday','Resolved','quiet',btn('Open',small=True)),
          ('High','warn','Fallen wire across Rizal Street','Report #BH-2026-0398','infrastructure','Infrastructure','Purok 4','Yesterday','Resolved','quiet',btn('Open',small=True)),
          ('Medium','quiet','Motorcycle blocking the chapel driveway','Report #BH-2026-0396','traffic','Traffic','Purok 2','Nov 16','Resolved','quiet',btn('Open',small=True))]
    rows=''.join(tr(cols,[tag(p,pt),t2(a,sub),f'<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: {BODY}"><span style="color: {MUTED}; display: flex">{ico(cn,16)}</span>{cl}</span>',tx(loc),tx(when,MUTED),status(st,stt),f'<span style="justify-self: end">{bt}</span>'],f'background: {"#FFF7F8" if p=="Critical" else "#FFFFFF"};') for p,pt,a,sub,cn,cl,loc,when,st,stt,bt in data)
    pager=f'<div style="display: flex; align-items: center; padding: 12px 18px; border-top: 1px solid {LINE}; font-size: 13px; color: {MUTED}">Showing 7 of 128 reports<span style="margin-left: auto; display: flex; gap: 8px">{btn("Previous",small=True)}{btn("Next",small=True)}</span></div>'
    content=card(tb+th(cols,['Priority','Report','Category','Location','Reported','Status','']) + rows + pager)
    acts=btn('Open map','onband',ico('map',17))+btn('Log a walk-in report','white',svgl('plus',16))
    return desktop('Official: incidents','INCIDENTS','Reports from residents','Priorities follow the law behind each category. Critical reports stay at the top.',acts,content,'Incidents')

def incident_detail():
    left=card(f'''<div style="height: 220px; background: repeating-linear-gradient(135deg, #E6E4EF 0 10px, #EFEEF5 10px 20px); display: flex; align-items: flex-end; padding: 12px; box-sizing: border-box"><span style="font-size: 12px; font-weight: 700; color: {MUTED}; background: #FFFFFF; padding: 4px 8px; border-radius: 6px">Photo from reporter · 1 of 2</span></div>
<div style="padding: 16px 18px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; gap: 8px">{tag("Critical","danger")}{tag("Flood","info")}{tag("Unassigned","quiet")}</div>
<p style="margin: 0; font-size: 14px; line-height: 1.6; color: {BODY}">Water from the creek is rising fast and is already ankle-deep on the road near the bridge. Two houses near the bank have children inside.</p>
<p style="margin: 0; font-size: 12px; color: {MUTED}">Reported by Ana Reyes · 0917 ··· 4521 · 7:42 PM · near the bridge, Riverside</p></div>
<div style="margin: 0 18px 16px; padding: 12px 14px; border-radius: 10px; background: {BLUEBG}"><p style="margin: 0; font-size: 12px; font-weight: 800; color: {BLUE}">WHO LEADS · RA 10121</p><p style="margin: 4px 0 0; font-size: 13px; line-height: 1.5; color: {INK}">Disaster response: the barangay DRRM committee leads; alert the city DRRMO if water keeps rising.</p></div>''')
    tl=card(card_head('Activity')+''.join(row(f'<div style="display: grid; grid-template-columns: 70px minmax(0, 1fr); gap: 12px"><span style="font-size: 12px; font-weight: 700; color: {MUTED}">{a}</span><span style="font-size: 13px; color: {INK}">{b}</span></div>',pad='10px 18px') for a,b in [('7:42 PM','Report received from Ana Reyes, with 2 photos'),('7:43 PM','Marked critical: flood near homes'),('7:44 PM','Push alert sent to 2 officials and 2 tanods')]))
    ranked=[('PB','Pedro Bautista','On duty · 650 m · ~3 min by road','Best match',True),('RG','Ramon Garcia','Off duty · 1.8 km','',False)]
    disp=card(card_head('Dispatch a tanod','',sub='Ranked by road travel time')+''.join(row(f'<div style="display: flex; align-items: center; gap: 12px">{avatar(i,36,GREENBG if on else SOFT,GREEN if on else PD,10)}<span style="flex: 1; min-width: 0"><span style="display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: {INK}">{n}{tag(best,"ok") if best else ""}</span><span style="display: block; font-size: 12px; color: {MUTED}">{s}</span></span>{btn("Dispatch","primary" if on else "secondary",small=True)}</div>',pad='12px 18px') for i,n,s,best,on in ranked))
    mp=card(f'<div style="position: relative">{flat_map(230,[(120,150,RED,10),(235,100,GREEN,7)])}<span style="position: absolute; left: 12px; top: 12px">{btn("Get directions","secondary",svgl("route",15),small=True)}</span></div>'+row(f'<p style="margin: 0; font-size: 13px; color: {INK}"><b>Near the bridge, Riverside</b> · 10.3812, 123.6391</p><p style="margin: 2px 0 0; font-size: 12px; color: {GREEN}">Inside Don Andres Soriano</p>',pad='10px 18px'))
    content=f'<div style="display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 16px; align-items: start"><div style="display: flex; flex-direction: column; gap: 16px">{left}{tl}</div><div style="display: flex; flex-direction: column; gap: 16px">{mp}{disp}</div></div>'
    acts=btn('Back','onband',svgl('back',16))+btn('Mark resolved','white',svgl('check',16))
    return desktop('Official: incident detail','REPORT #BH-2026-0415 · 4 MIN AGO','Flooding near the creek','Riverside · reported by Ana Reyes',acts,content,'Incidents')

def tickets():
    lst=[('Water bill dispute with neighbor','Juan Dela Cruz · Purok 2','3:02 PM','Waiting on you','warn',True),('Streetlight out on Mabini Street','Juan Dela Cruz','12:10 PM','Waiting 3 h','warn',False),('Garbage not collected on Rizal Street','Ana Reyes','11:30 AM','Waiting 1 h','quiet',False),('Request for street signage','Lito Ramos','Yesterday','Closed','quiet',False)]
    left=card(toolbar(searchbox('Search tickets',220),select('Open'))+''.join(f'<a href="#" style="display: block; padding: 12px 18px; border-top: 1px solid {LINE}; {"background: "+SOFT+";" if sel else ""}"><span style="display: flex; align-items: center"><span style="flex: 1; min-width: 0; font-size: 14px; font-weight: 700; color: {INK}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{a}</span><span style="font-size: 12px; color: {MUTED}">{w}</span></span><span style="display: block; font-size: 12px; color: {MUTED}">{b}</span><span style="display: block; margin-top: 6px">{status(s,t)}</span></a>' for a,b,w,s,t,sel in lst),'0','align-self: stretch')
    def msg(text, mine, who, time):
        if mine:
            return f'<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px"><div style="max-width: 70%; padding: 10px 12px; border-radius: 14px 14px 4px 14px; background: {PD}; color: #FFFFFF; font-size: 14px; line-height: 1.5">{text}</div><span style="font-size: 11px; color: {MUTED}">You · {time}</span></div>'
        return f'<div style="display: flex; gap: 8px; align-items: flex-end">{avatar("JD",28,"#FDE7D2","#B45309",8)}<div style="display: flex; flex-direction: column; gap: 4px; max-width: 70%"><div style="padding: 10px 12px; border-radius: 14px 14px 14px 4px; background: {BG}; border: 1px solid {LINE}; color: {INK}; font-size: 14px; line-height: 1.5">{text}</div><span style="font-size: 11px; color: {MUTED}">{who} · {time}</span></div></div>'
    conv=card(f'''<div style="display: flex; align-items: center; gap: 12px; padding: 14px 18px"><div style="flex: 1"><h2 style="margin: 0; font-size: 16px; font-weight: 800; color: {INK}">Water bill dispute with neighbor</h2><p style="margin: 2px 0 0; font-size: 12px; color: {MUTED}">Juan Dela Cruz · Purok 2 · verified resident · opened today 2:04 PM</p></div>{select("In progress")}{btn("Move to blotter",small=False)}</div>
<div style="border-top: 1px solid {LINE}; padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; height: 404px; box-sizing: border-box; overflow: hidden">
{msg("Magandang hapon po. Our neighbor's water line runs through our yard and it is leaking onto our side. Can the barangay help us talk to them?",False,"Juan Dela Cruz","2:04 PM")}
{msg("Magandang hapon, Juan. Yes, we can set a meeting. Are you free on Saturday morning at the barangay hall?",True,"","2:31 PM")}
{msg("Saturday 9 AM works for us. Salamat po.",False,"Juan Dela Cruz","2:40 PM")}
{msg("Noted. I've set it for Saturday, 9:00 AM. Please bring photos of the leak if you have them.",True,"","3:02 PM")}</div>
<div style="border-top: 1px solid {LINE}; padding: 12px 18px; display: flex; gap: 8px; align-items: center">{iconbtn(svgl("clip",17),"Attach","plain",40)}<label style="flex: 1; display: flex; align-items: center; height: 40px; padding: 0 12px; box-sizing: border-box; border-radius: 10px; border: 1px solid {LINE}"><input type="text" aria-label="Reply" placeholder="Reply to Juan" style="all: unset; flex: 1; font-size: 14px; color: {INK}"></label>{btn("Schedule meeting",icon=ico("calendar",16))}{btn("Send","primary",svgl("send",15))}</div>''')
    content=f'<div style="display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 16px; align-items: start">{left}{conv}</div>'
    return desktop('Official: tickets','TICKETS','Conversations with residents','2 tickets are waiting on a reply.','',content,'Tickets')

def documents():
    tabs=segmented(['New · 2','Processing · 3','Ready · 1','Released'],1)
    cols='minmax(0, 1.4fr) minmax(0, 1fr) 140px 150px 170px'
    data=[('Certificate of residency','DOC-2026-0179 · School','Juan Dela Cruz','Due in 6 h','warn','Nov 18, 9:10 AM',btn('Mark ready','primary',small=True)),
          ('Barangay clearance','DOC-2026-0190 · Employment','Ana Reyes','Due tomorrow','quiet','Nov 18, 1:45 PM',btn('Mark ready',small=True)),
          ('Business clearance','DOC-2026-0171 · Sari-sari store','Lito Ramos','Overdue 1 day','danger','Nov 14, 10:02 AM',btn('Mark ready','danger',small=True))]
    rows=''.join(tr(cols,[t2(a,b),tx(c,INK,600),status(d,dt),tx(e,MUTED),f'<span style="justify-self: end; display: flex; gap: 6px">{btn("Open",small=True)}{f}</span>']) for a,b,c,d,dt,e,f in data)
    sla=f'<div style="padding: 12px 18px; border-top: 1px solid {LINE}; font-size: 12px; color: {MUTED}">Deadlines come from your Citizen\'s Charter under RA 11032. Overdue requests are flagged to the Punong Barangay.</div>'
    content=card(toolbar(tabs+searchbox('Search requests'),select('All documents')+btn('Charter settings',small=False))+th(cols,['Request','Resident','Deadline','Requested',''])+rows+sla)
    return desktop('Official: documents','DOCUMENT REQUESTS','Clearances and certificates','3 in progress. 1 is past its Citizen\'s Charter deadline.','',content,'Documents')

def verifications():
    def person(ini,n,purok,when,addr,doc,sel):
        return f'<a href="#" style="display: flex; gap: 12px; padding: 12px 18px; border-top: 1px solid {LINE}; {"background: "+SOFT+";" if sel else ""}">{avatar(ini,36,SOFT,PD,10)}<span style="flex: 1; min-width: 0"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}">{n}</span><span style="display: block; font-size: 12px; color: {MUTED}">{purok} · {when}</span></span></a>'
    lst=card(card_head('Waiting · 2')+person('ML','Maria Lopez','Purok 4','signed up today','','',True)+person('JS','Jose Santos','Purok 1','signed up yesterday','','',False),'0','align-self: stretch')
    idph=f'<div style="height: 200px; border-radius: 12px; background: repeating-linear-gradient(135deg, #E6E4EF 0 10px, #EFEEF5 10px 20px); display: flex; align-items: flex-end; padding: 10px; box-sizing: border-box"><span style="font-size: 12px; font-weight: 700; color: {MUTED}; background: #FFFFFF; padding: 4px 8px; border-radius: 6px">Uploaded ID · PhilSys card</span></div>'
    facts=''.join(f'<div style="display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 12px; padding: 10px 0; border-top: 1px solid {LINE}"><span style="font-size: 13px; color: {MUTED}">{a}</span><span style="font-size: 13px; font-weight: 600; color: {INK}">{b}</span></div>' for a,b in [('Full name','Maria Santos Lopez'),('Address on ID','Blk 4 Lot 12, Purok 4, Don Andres Soriano'),('Address given','Purok 4, near the covered court'),('Phone','0917 ··· 8834 · confirmed'),('Matches','Address on ID matches this barangay')])
    detail=card(f'''<div style="padding: 16px 18px; display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 20px">{idph}<div><h2 style="margin: 0; font-size: 18px; font-weight: 800; color: {INK}">Maria Lopez</h2><p style="margin: 2px 0 10px; font-size: 13px; color: {MUTED}">Signed up today, 1:20 PM</p>{facts}</div></div>
<div style="margin: 0 18px; padding: 12px 14px; border-radius: 10px; background: {GREENBG}; font-size: 13px; color: {GREEN}; font-weight: 600">The ID address is inside Don Andres Soriano.</div>
<div style="display: flex; gap: 8px; padding: 16px 18px; align-items: center"><span style="font-size: 12px; color: {MUTED}">Verifying confirms she lives here (RA 7160, Sec. 394). She can then request documents.</span><span style="margin-left: auto; display: flex; gap: 8px">{btn("Not a resident")}{btn("Ask for another ID")}{btn("Verify resident","primary",svgl("check",16))}</span></div>''')
    content=f'<div style="display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 16px; align-items: start">{lst}{detail}</div>'
    return desktop('Official: verifications','VERIFICATIONS','Confirm who lives here','2 residents are waiting.','',content,'Verifications')

SCREENS=[('O01-Dashboard','Dashboard',dashboard,1440,900),('O02-Incidents','Incidents',incidents,1440,900),('O03-Incident-Detail','Incident detail and dispatch',incident_detail,1440,900),
         ('O04-Tickets','Tickets',tickets,1440,900),('O05-Documents','Document requests',documents,1440,900),('O06-Verifications','Verifications',verifications,1440,900)]
if __name__=='__main__':
    for f,t,fn,w,h in SCREENS: open(f'project/{f}.dc.html','w').write(fn())
    print('official ok', len(SCREENS))

# ---------------- batch 3 ----------------
def blotter():
    tabs=segmented(['Open · 4','Settled','Certified to file action','All'],0)
    cols='120px minmax(0, 1.6fr) 130px 170px 150px 70px'
    data=[('KP-2026-0003','Juan Dela Cruz v. Ramon Cruz','Boundary fence dispute','Mediation','brand','Overdue 2 days','danger','Nov 21, 9:00 AM'),
          ('KP-2026-0005','Ana Reyes v. Lito Ramos','Unpaid debt, ₱8,000','Mediation','brand','6 days left','quiet','Nov 20, 2:00 PM'),
          ('KP-2026-0002','Pedro Lim v. Rosa Tan','Noise and harassment','Conciliation','warn','Day 9 of 15','quiet','Nov 19, 10:00 AM'),
          ('KP-2026-0006','Maria Lopez v. Jose Santos','Damage to property','Filed','quiet','Summons due Nov 20','quiet','To schedule')]
    rows=''.join(tr(cols,[tx(a,MUTED,700),t2(b,c),tag(d,dt),status(e,et),tx(f,BODY),f'<span style="justify-self: end">{btn("Open",small=True)}</span>'],f'background: {"#FFF7F8" if et=="danger" else "#FFFFFF"};') for a,b,c,d,dt,e,et,f in data)
    steps=[('1','Mediation','Punong Barangay, 15 days from the first meeting'),('2','Conciliation','Pangkat, 15 days, can be extended by 15'),('3','No settlement','Certificate to file action is issued'),('4','Settled','Either party can repudiate within 10 days')]
    rules=card(card_head('Katarungang Pambarangay timeline','<span style="font-size: 12px; color: '+MUTED+'">RA 7160, Secs. 410 to 418</span>')+'<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid '+LINE+'">'+''.join(f'<div style="padding: 12px 18px; {"border-left: 1px solid "+LINE if i else ""}"><span style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 800; color: {PD}"><span style="width: 22px; height: 22px; border-radius: 50%; background: {SOFT}; display: flex; align-items: center; justify-content: center; font-size: 12px">{n}</span>{a}</span><span style="display: block; margin-top: 6px; font-size: 13px; color: {BODY}">{b}</span></div>' for i,(n,a,b) in enumerate(steps))+'</div>')
    content=card(toolbar(tabs+searchbox("Search cases",220),btn("Export",icon=svgl("download",15)))+th(cols,["Case","Parties","Stage","Deadline","Next hearing",""])+rows)+rules
    return desktop('Official: blotter and Lupon','BLOTTER / LUPON','Barangay justice cases','1 case is past its deadline. 3 hearings this week.',btn('File a complaint','white',svgl('plus',16)),content,'Blotter / Lupon')

def tanods():
    roster=[('PB','Pedro Bautista','Responding · Riverside','ok','On since 6:00 PM','42 resolved · 6 min avg'),('RG','Ramon Garcia','Off duty · back 6:00 AM','quiet','Last shift ended 6:00 PM','38 resolved · 8 min avg')]
    rh=''.join(row(f'<div style="display: grid; grid-template-columns: 40px minmax(0, 1fr) 160px 180px 110px; gap: 14px; align-items: center">{avatar(i,40,GREENBG if st=="ok" else SOFT,GREEN if st=="ok" else PD,12)}{t2(n,shift)}{status(s,st)}{tx(perf,MUTED)}<span style="justify-self: end">{btn("Message" if st=="ok" else "Profile",small=True)}</span></div>',pad='12px 18px') for i,n,s,st,shift,perf in roster)
    days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    sched=[('Pedro Bautista',['Night','Night','Night','Off','Off','Day','Day']),('Ramon Garcia',['Day','Day','Day','Night','Night','Off','Off'])]
    def cell(v):
        c={'Day':(SOFT,PD),'Night':('#E7E5F7',PDD),'Off':('#F3F2F7',MUTED)}[v]
        return f'<span style="height: 36px; border-radius: 8px; background: {c[0]}; color: {c[1]}; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center">{v}</span>'
    grid=f'<div style="padding: 0 18px 16px"><div style="display: grid; grid-template-columns: 160px repeat(7, minmax(0, 1fr)); gap: 6px; font-size: 12px; font-weight: 700; color: {MUTED}"><span></span>'+''.join(f'<span style="text-align: center; {"color: "+PD if d=="Wed" else ""}">{d}</span>' for d in days)+'</div>'+''.join(f'<div style="display: grid; grid-template-columns: 160px repeat(7, minmax(0, 1fr)); gap: 6px; margin-top: 6px; align-items: center"><span style="font-size: 13px; font-weight: 700; color: {INK}">{n}</span>'+''.join(cell(v) for v in vs)+'</div>' for n,vs in sched)+f'<p style="margin: 12px 0 0; font-size: 12px; color: {MUTED}">Day 6 AM–6 PM · Night 6 PM–6 AM. One tanod is always on duty.</p></div>'
    content=card(card_head('Roster',f'<span style="font-size: 13px; font-weight: 700; color: {GREEN}">1 of 2 on duty</span>')+rh)+card(card_head('This week\'s schedule',btn('Edit schedule',small=True))+grid)
    return desktop('Official: tanods','TANOD MANAGEMENT','Your tanods','Pedro is responding to a flood report in Riverside.',btn('Invite a tanod','white',svgl('plus',16)),content,'Tanods')

def users():
    tabs=segmented(['Residents · 214','Officials · 3','Tanods · 2'],0)
    cols='minmax(0, 1.8fr) 100px 120px 120px 64px'
    data=[('JD','Juan Dela Cruz','0917 ··· 1182','Purok 2','Verified','ok','Oct 2, 2026'),('ML','Maria Lopez','0917 ··· 8834','Purok 4','Waiting','warn','Today'),('AR','Ana Reyes','0918 ··· 4521','Riverside','Verified','ok','Sep 14, 2026'),('LR','Lito Ramos','0920 ··· 7710','Purok 1','Verified','ok','Aug 30, 2026'),('JS','Jose Santos','0915 ··· 2290','Purok 1','Waiting','warn','Yesterday')]
    rows=''.join(tr(cols,[f'<span style="display: flex; align-items: center; gap: 10px">{avatar(i,30)}{t2(n,ph)}</span>',tx(p),status(s,st),tx(d,MUTED),f'<span style="justify-self: end">{btn("Open",small=True)}</span>']) for i,n,ph,p,s,st,d in data)
    users=card(toolbar(tabs+searchbox('Search people',220),select('Any purok'))+th(cols,['Name','Purok','Status','Joined',''])+rows)
    codes=card(card_head('Invite codes','',sub='Share with new officials and tanods')+''.join(row(f'<div style="display: flex; align-items: center; gap: 10px"><span style="font-family: ui-monospace, monospace; font-size: 14px; font-weight: 700; color: {INK}; letter-spacing: 0.06em">{c}</span>{tag(r,"brand")}<span style="margin-left: auto; font-size: 12px; color: {MUTED}">{u}</span>{iconbtn(svgl("copy",15),"Copy code","plain",34)}</div>',pad='10px 18px') for c,r,u in [('DAS-OFF-7Q4K','Official','Unused'),('DAS-TAN-2M9X','Tanod','Unused'),('DAS-TAN-8P3L','Tanod','Used by Ramon')])+f'<div style="display: flex; gap: 8px; padding: 12px 18px; border-top: 1px solid {LINE}">{btn("New official code",small=True,icon=svgl("plus",14))}{btn("New tanod code",small=True,icon=svgl("plus",14))}</div>')
    content=f'<div style="display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 16px; align-items: start">{users}{codes}</div>'
    return desktop('Official: users','USER MANAGEMENT','People in your barangay','214 residents, 3 officials and 2 tanods.','',content,'Users')

def announcements():
    items=[('warn','Advisory','Water interruption on Saturday','Published today, 8:00 AM','Sent to 219 people · 164 read'),('brand','Event','Free anti-rabies vaccination','Published yesterday','Sent to 219 people · 188 read'),('danger','Alert','Typhoon signal no. 1 over Cebu','Nov 12','Push alert · 219 people · 205 read'),('quiet','Notice','Barangay assembly on Nov 30','Scheduled for Nov 25, 8:00 AM','Not sent yet')]
    rows=''.join(row(f'<div style="display: grid; grid-template-columns: 90px minmax(0, 1fr) 240px 120px; gap: 14px; align-items: center">{tag(k,tone)}{t2(t,w)}{tx(r,MUTED)}<span style="justify-self: end; display: flex; gap: 6px">{btn("Edit",small=True)}</span></div>',pad='12px 18px') for tone,k,t,w,r in items)
    content=card(toolbar(segmented(['All','Alerts','Scheduled'],0)+searchbox('Search announcements',240))+rows)
    return desktop('Official: announcements','ANNOUNCEMENTS','Keep everyone informed','Every resident, official and tanod gets these, with push alerts for urgent ones.',btn('New announcement','white',svgl('plus',16)),content,'Announcements')

def announcement_new():
    form=card(f'''<div style="padding: 18px; display: flex; flex-direction: column; gap: 16px">
<div><span style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 700; color: {INK}">Type</span>{segmented(['Notice','Advisory','Event','Alert'],1)}</div>
{field('Title','Water interruption on Saturday')}
{field('Message','No water from 9 AM to 3 PM in Purok 1–3 while the main line is repaired. Store water on Friday night.',area=True,h=90)}
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">{field('Who gets it','Purok 1, 2 and 3 · 142 people')}{field('Send','Now')}</div>
<label style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: {INK}"><input type="checkbox" checked aria-label="Send a push alert" style="accent-color: {PD}; width: 18px; height: 18px; margin: 0">Also send a push alert to their phones</label>
<p style="margin: 0; font-size: 12px; color: {MUTED}">You'll have 60 seconds to undo after publishing.</p></div>
<div style="display: flex; gap: 8px; justify-content: flex-end; padding: 14px 18px; border-top: 1px solid {LINE}">{btn("Save draft")}{btn("Publish","primary",svgl("send",15))}</div>''')
    pv=f'''<div style="width: 300px; margin: 0 auto; border-radius: 28px; background: #1A1830; padding: 10px"><div style="border-radius: 20px; background: linear-gradient(180deg, #2A2770, #4A43D4); padding: 18px 14px; height: 300px; box-sizing: border-box">
<p style="margin: 0 0 12px; text-align: center; font-size: 34px; font-weight: 300; color: #FFFFFF">7:46</p>
<div style="border-radius: 14px; background: rgba(255,255,255,0.92); padding: 10px 12px"><div style="display: flex; align-items: center; gap: 6px"><img src="/_blob/LOGO_ID" alt="" style="width: 16px; height: 16px"><span style="font-size: 11px; font-weight: 700; color: {MUTED}">BH360 · now</span></div><p style="margin: 4px 0 0; font-size: 13px; font-weight: 800; color: {INK}">Advisory: Water interruption on Saturday</p><p style="margin: 2px 0 0; font-size: 12px; color: {BODY}">No water from 9 AM to 3 PM in Purok 1–3 while the main line is repaired.</p></div></div></div>'''
    prev=card(card_head('Preview','',sub='How it shows on a resident\'s phone')+f'<div style="padding: 0 18px 18px">{pv}</div>')
    content=f'<div style="display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 16px; align-items: start">{form}{prev}</div>'
    return desktop('Official: new announcement','ANNOUNCEMENTS','New announcement','',btn('Cancel','onband'),content,'Announcements',pet=False)

def calendar():
    weeks=[[None,None,None,None,None,None,1],[2,3,4,5,6,7,8],[9,10,11,12,13,14,15],[16,17,18,19,20,21,22],[23,24,25,26,27,28,29],[30,None,None,None,None,None,None]]
    ev={18:[('Clearance pickups','quiet')],19:[('Conciliation · KP-0002','warn')],20:[('Mediation · KP-0005','brand')],21:[('Mediation · KP-0003','brand'),('Water interruption','warn')],25:[('Assembly notice','quiet')],28:[('Anti-rabies drive','ok')],30:[('Barangay assembly','brand')]}
    hd=''.join(f'<span style="padding: 8px 10px; font-size: 12px; font-weight: 700; color: {MUTED}">{d}</span>' for d in ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])
    cells=''
    for w in weeks:
        for d in w:
            if d is None: cells+=f'<span style="min-height: 96px; border-top: 1px solid {LINE}; background: #FAFAFD"></span>'; continue
            today = d==18
            es=''.join(f'<span style="display: block; margin-top: 4px; padding: 3px 6px; border-radius: 5px; background: {TONES[t][1]}; color: {TONES[t][0]}; font-size: 11px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{e}</span>' for e,t in ev.get(d,[]))
            num=f'<span style="display: inline-flex; width: 24px; height: 24px; border-radius: 50%; align-items: center; justify-content: center; {"background: "+PD+"; color: #FFFFFF;" if today else "color: "+INK+";"} font-size: 12px; font-weight: 700">{d}</span>'
            cells+=f'<span style="min-height: 96px; padding: 6px 8px; box-sizing: border-box; border-top: 1px solid {LINE}; min-width: 0">{num}{es}</span>'
    grid=f'<div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr))">{hd}{cells}</div>'
    head=toolbar(f'<span style="display: flex; gap: 6px">{iconbtn(svgl("back",16),"Previous month","plain",36)}{iconbtn(svgl("chev",16),"Next month","plain",36)}</span><h2 style="margin: 0 0 0 6px; font-size: 16px; font-weight: 800; color: {INK}">November 2026</h2>',segmented(['Month','Week','List'],0))
    content=card(head+grid)
    return desktop('Official: calendar','CALENDAR','Hearings, pickups and events','3 hearings and 2 events this week.',btn('New appointment','white',svgl('plus',16)),content,'Calendar',h=1000)

def full_map():
    import map as incident_map  # the redesigned command map lives in map.py
    return incident_map.live()

def analytics():
    cats=[('Noise',14),('Infrastructure',11),('Garbage',9),('Flood',6),('Animals',5),('Traffic',4),('Theft',2)]
    mx=14
    bars=''.join(f'<div style="display: grid; grid-template-columns: 120px minmax(0, 1fr) 30px; gap: 10px; align-items: center; padding: 5px 0"><span style="font-size: 13px; color: {BODY}">{c}</span><span style="height: 12px; border-radius: 4px; background: {SOFT}"><span style="display: block; height: 12px; width: {int(v/mx*100)}%; border-radius: 4px; background: {PD}"></span></span><span style="font-size: 13px; font-weight: 700; color: {INK}; text-align: right">{v}</span></div>' for c,v in cats)
    bycat=card(card_head('Reports by category','<span style="font-size: 12px; color: '+MUTED+'">Last 30 days · 51 total</span>')+f'<div style="padding: 0 18px 14px">{bars}</div>')
    vals=[6,9,7,12,8,10,14,11,9,13,15,12]
    pts=' '.join(f'{20+i*50},{170-v*9}' for i,v in enumerate(vals))
    resp=[12,11,11,10,9,10,9,8,9,8,7,7]
    pts2=' '.join(f'{20+i*50},{170-r*9}' for i,r in enumerate(resp))
    weeks=''.join(f'<text x="{20+i*50}" y="192" font-size="11" fill="{MUTED}" text-anchor="middle">W{i+1}</text>' for i in range(12))
    trend=card(card_head('Reports and response time','<span style="display: flex; gap: 12px; font-size: 12px; color: '+BODY+'"><span><b style="color: '+PD+'">—</b> Reports per week</span><span><b style="color: '+GREEN+'">—</b> Avg. response (min)</span></span>')+f'<div style="padding: 0 18px 12px"><svg width="100%" height="200" viewBox="0 0 600 200" aria-label="Weekly reports rising from 6 to 12 while average response time falls from 12 to 7 minutes" role="img"><path d="M20 170 H580 M20 125 H580 M20 80 H580 M20 35 H580" stroke="{LINE}" stroke-width="1"></path><polyline points="{pts}" fill="none" stroke="{PD}" stroke-width="2.5" stroke-linejoin="round"></polyline><polyline points="{pts2}" fill="none" stroke="{GREEN}" stroke-width="2.5" stroke-dasharray="6 4"></polyline>{weeks}</svg></div>')
    hot=card(card_head('Hotspots')+''.join(row(f'<div style="display: flex; align-items: center; gap: 10px"><span style="font-size: 13px; font-weight: 800; color: {MUTED}; width: 18px">{i+1}</span>{t2(a,b)}<span style="margin-left: auto; font-size: 13px; font-weight: 800; color: {INK}">{n}</span></div>',pad='10px 18px') for i,(a,b,n) in enumerate([('Purok 3, Mabini St.','Mostly noise, at night','12'),('Riverside','Flooding after heavy rain','7'),('Purok 2','Streetlights, garbage','6')])))
    ai=card(f'''<div style="padding: 16px 18px"><div style="display: flex; align-items: center; gap: 8px"><span style="color: {PD}; display: flex">{ico("analytics",18)}</span><h2 style="margin: 0; font-size: 15px; font-weight: 800; color: {INK}">Summary for the barangay</h2><span style="margin-left: auto; font-size: 12px; color: {MUTED}">Generated Nov 18 · AI, check before sharing</span></div>
<p style="margin: 10px 0 0; font-size: 14px; line-height: 1.6; color: {BODY}">Reports rose this month, mainly late-night noise in Purok 3. Response times improved from 12 to 7 minutes. Riverside flooded twice after heavy rain; consider clearing the creek drain before the next typhoon. One Lupon case passed its deadline.</p>
<div style="display: flex; gap: 8px; margin-top: 12px">{btn("Regenerate",small=True)}{btn("Download PDF",small=True,icon=svgl("download",14))}</div></div>''')
    stats=[('Reports',"51",'+18% vs Oct'),('Avg. response','7 min','down from 12'),('Resolved','46','90%'),('Ratings','4.6 / 5','31 ratings')]
    strip=f'<div style="display: flex; background: #FFFFFF; border: 1px solid {LINE}; border-radius: 14px">'+''.join(f'<div style="flex: 1; padding: 14px 16px; {"border-left: 1px solid "+LINE if i else ""}"><span style="display: block; font-size: 12px; font-weight: 600; color: {MUTED}">{a}</span><span style="display: block; margin-top: 6px; font-size: 24px; font-weight: 800; color: {INK}">{b}</span><span style="display: block; font-size: 12px; color: {GREEN if "down" in c or "+" in c or "%" in c else MUTED}">{c}</span></div>' for i,(a,b,c) in enumerate(stats))+'</div>'
    content=strip+f'<div style="display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 16px; align-items: start"><div style="display: flex; flex-direction: column; gap: 16px">{trend}{ai}</div><div style="display: flex; flex-direction: column; gap: 16px">{bycat}{hot}</div></div>'
    return desktop('Official: analytics','ANALYTICS · NOVEMBER 2026','How the barangay is doing','Sample data for the design.',btn('Last 30 days','onband',svgl('down',15))+btn('Export','white',svgl('download',15)),content,'Analytics',h=1000)

SCREENS += [('O07-Blotter','Blotter / Lupon',blotter,1440,900),('O08-Tanods','Tanods and schedule',tanods,1440,900),('O09-Users','Users and invite codes',users,1440,900),
            ('O10-Announcements','Announcements',announcements,1440,900),('O11-Announcement-New','New announcement',announcement_new,1440,900),
            ('O12-Calendar','Calendar',calendar,1440,1000),('O13-Map','Incident map',full_map,1440,900),('O14-Analytics','Analytics',analytics,1440,1000)]
if __name__=='__main__':
    for f,t,fn,w,h in SCREENS[6:]: open(f'project/{f}.dc.html','w').write(fn())
    print('batch3 ok')
