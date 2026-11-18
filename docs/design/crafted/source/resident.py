from kit import *

def home(overlay='', say='Kumusta, Juan! Ask me about clearances, hearings or office hours.', pet=None):
    hdr=f'''<div style="display: flex; align-items: center; gap: 10px"><img src="/_blob/LOGO_ID" alt="BarangayHub 360" style="width: 30px; height: 30px; object-fit: contain"><p style="margin: 0; flex: 1; font-size: 13px; font-weight: 700; color: #FFFFFF">Brgy. Don Andres Soriano</p>{iconbtn(svgl('bell',18),'Notifications, 2 unread')}</div>
<div><p style="margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; color: rgba(255,255,255,0.75)">WEDNESDAY, NOV 18</p><p style="margin: 4px 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.6px; color: #FFFFFF">Magandang gabi, Juan.</p></div>'''
    track=card(f'''<div style="display: flex; align-items: center"><span style="font-size: 12px; font-weight: 700; color: {GREEN}">Tanod on the way · about 5 min</span><a href="#" style="margin-left: auto; font-size: 13px; font-weight: 700">Track</a></div>
<p style="margin: 6px 0 10px; font-size: 15px; font-weight: 800; color: {INK}">Streetlight out on Mabini Street</p>{progress(3)}
<div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 11px; color: {MUTED}"><span>Received</span><span>Assigned</span><span style="color: {GREEN}; font-weight: 700">On the way</span><span>Resolved</span></div>''','14px','box-shadow: 0 12px 28px -18px rgba(26,24,48,0.5)')
    ready=card(f'<div style="display: flex; align-items: center; gap: 10px"><span style="color: {GREEN}; display: flex">{ico("documents",20)}</span><span style="flex: 1"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}">Your barangay clearance is ready</span><span style="display: block; font-size: 12px; color: {MUTED}">Pick it up at the hall. Bring a valid ID.</span></span></div>','12px 14px')
    svc=[('documents','Request a document','Clearance, residency, indigency'),('tickets','Ask the barangay','Chat with an official'),('blotter','My cases','Lupon hearings and status'),('announcements','Announcements','News and alerts from the hall')]
    sv=card(''.join(row(f'<a href="#" style="display: flex; align-items: center; gap: 12px"><span style="color: {PD}; display: flex">{ico(n,20)}</span><span style="flex: 1"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}">{l}</span><span style="display: block; font-size: 12px; color: {MUTED}">{s}</span></span><span style="color: {MUTED}">{svgl("chev",16)}</span></a>', i==0, '12px 14px') for i,(n,l,s) in enumerate(svc)))
    hot=[('Barangay hall','Tap to call',PD),('Police','911',PD),('Fire (BFP)','Tap to call',RED),('Ambulance','Tap to call',PD)]
    hh=card('<div style="display: grid; grid-template-columns: 1fr 1fr">'+''.join(f'<a href="#" style="display: flex; align-items: center; gap: 10px; padding: 11px 14px; {"border-left: 1px solid "+LINE+";" if i%2 else ""} {"border-top: 1px solid "+LINE+";" if i>1 else ""}"><span style="color: {c}; display: flex">{svgl("phone",17,2)}</span><span style="min-width: 0"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}">{l}</span><span style="display: block; font-size: 12px; color: {MUTED}">{n}</span></span></a>' for i,(l,n,c) in enumerate(hot))+'</div>')
    return phone('Resident: home' if not overlay else 'Resident: Tarsi chat open', hdr, track+sv+f'<div>{label("EMERGENCY HOTLINES")}{hh}</div>', 'Home', band_h=236, say=say, pet=pet, overlay=overlay)

def report_category():
    hdr=phone_top('Report an incident', sub='Step 1 of 2 · What happened?')
    cats=[('fire','Fire','BFP leads · RA 9514'),('medical','Medical','Ambulance and first aid'),('flood','Flood','Rising water, blocked drains'),('violence','Violence','Fights, threats, abuse'),('theft','Theft','Stolen property, break-ins'),('noise','Noise','Karaoke, loud parties'),('traffic','Traffic','Accidents, blocked roads'),('infrastructure','Infrastructure','Streetlights, roads, wires'),('garbage','Garbage','Missed collection, dumping'),('animals','Animals','Strays, bites'),('drugs','Drugs','Suspected drug activity'),('other','Something else','Describe it yourself')]
    items=''.join(f'''<button type="button" style="all: unset; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 12px; background: #FFFFFF; border: {"2px solid "+PD if n=="infrastructure" else "1px solid "+LINE}; cursor: pointer"><span style="color: {RED if n in ('fire','medical','violence') else PD}; display: flex">{ico(n,22,n=="infrastructure","currentColor","#FFFFFF")}</span><span style="font-size: 13px; font-weight: 800; color: {INK}">{l}</span><span style="font-size: 11px; color: {MUTED}; line-height: 1.35">{s}</span></button>''' for n,l,s in cats)
    emer=f'<div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: {REDBG}; color: {RED}"><span style="display: flex">{svgl("phone",16,2)}</span><span style="flex: 1; font-size: 12px; font-weight: 700">Life in danger? Call 911 first.</span><a href="#" style="font-size: 12px; font-weight: 800; color: {RED}">Call</a></div>'
    grid=f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">{items}</div>'
    foot=f'<div style="padding: 12px 16px 20px; background: #FFFFFF; border-top: 1px solid {LINE}; position: relative; z-index: 2">{btn("Continue","primary",full=True,large=True)}</div>'
    return phone('Resident: report, choose type', hdr, emer+grid, None, band_h=96, footer=foot)

def report_details():
    hdr=phone_top('Report an incident', sub='Step 2 of 2 · Details and location')
    chosen=f'<div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: #FFFFFF; border: 1px solid {LINE}"><span style="color: {PD}; display: flex">{ico("infrastructure",20)}</span><span style="flex: 1; font-size: 14px; font-weight: 700; color: {INK}">Infrastructure</span><a href="#" style="font-size: 13px; font-weight: 700">Change</a></div>'
    t=field('Short title','Streetlight out on Mabini Street')
    d=field('What did you see?','The streetlight in front of the chapel has been off since Monday. The corner is very dark at night.',area=True,h=64)
    photos=f'''<div><span style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 700; color: {INK}">Photos <span style="font-weight: 500; color: {MUTED}">· optional</span></span><div style="display: flex; gap: 8px">
<span style="width: 72px; height: 72px; border-radius: 10px; background: repeating-linear-gradient(135deg, #E6E4EF 0 8px, #EFEEF5 8px 16px); display: flex; align-items: flex-end; justify-content: flex-end; padding: 4px; box-sizing: border-box"><span style="font-size: 10px; font-weight: 700; color: {MUTED}">photo</span></span>
<button type="button" aria-label="Add photo" style="all: unset; box-sizing: border-box; width: 72px; height: 72px; border-radius: 10px; border: 1.5px dashed #CFCBE3; color: {PD}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer">{svgl("camera",20)}<span style="font-size: 11px; font-weight: 700">Add</span></button></div></div>'''
    loc=f'''<div><span style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 700; color: {INK}">Location</span>{card(f'<div style="position: relative">{flat_map(120,[(180,100,PD,9)],route=False)}<span style="position: absolute; left: 10px; bottom: 10px">{btn("Use my location","secondary",svgl("target",15),small=True)}</span></div>'+row(f'<p style="margin: 0; font-size: 13px; font-weight: 700; color: {INK}">Mabini St. near the chapel, Purok 2</p><p style="margin: 2px 0 0; font-size: 12px; color: {GREEN}">Inside Don Andres Soriano · GPS accurate to 12 m</p>', pad="10px 14px"))}</div>'''
    foot=f'<div style="padding: 12px 16px 20px; background: #FFFFFF; border-top: 1px solid {LINE}; position: relative; z-index: 2; display: flex; flex-direction: column; gap: 8px"><p style="margin: 0; font-size: 12px; color: {MUTED}; text-align: center">Saved on your phone if you lose signal. It sends when you are back online.</p>{btn("Send report","danger",full=True,large=True)}</div>'
    return phone('Resident: report, details', hdr, chosen+t+d+photos+loc, None, band_h=96, footer=foot)

def my_reports():
    hdr=phone_top('My reports', back=False, right=iconbtn(svgl('search',18),'Search'))+segmented(['Active · 1','Resolved · 6'],0,True)
    items=[('infrastructure','Streetlight out on Mabini Street','Reported today, 6:12 PM','Tanod on the way','ok',3),
           ('noise','Loud karaoke past midnight','Reported Nov 14','Resolved · rate the response','brand',4),
           ('garbage','Garbage not collected on Rizal Street','Reported Nov 9','Resolved','quiet',4),
           ('flood','Clogged drain near the market','Reported Oct 30','Resolved','quiet',4)]
    rows=''.join(row(f'''<a href="#" style="display: flex; gap: 12px"><span style="color: {PD}; display: flex; padding-top: 2px">{ico(n,20)}</span><span style="flex: 1; min-width: 0"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}">{ti}</span><span style="display: block; margin-top: 2px; font-size: 12px; color: {MUTED}">{when}</span><span style="display: block; margin-top: 6px">{status(st,tone)}</span>{('<span style="display: block; margin-top: 8px">'+progress(p)+'</span>') if p<4 else ''}</span><span style="color: {MUTED}; padding-top: 2px">{svgl("chev",16)}</span></a>''', i==0, '14px') for i,(n,ti,when,st,tone,p) in enumerate(items))
    return phone('Resident: my reports', hdr, card(rows), 'Reports', band_h=128)

def report_detail():
    hdr=phone_top('Streetlight out on Mabini Street', sub='Report #BH-2026-0412', right=iconbtn(svgl('dots',18),'More'))
    mp=card(f'<div style="position: relative">{flat_map(150)}<span style="position: absolute; left: 10px; top: 10px; display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 8px; background: #FFFFFF; font-size: 12px; font-weight: 700; color: {GREEN}"><span style="width: 7px; height: 7px; border-radius: 50%; background: {GREEN}"></span>Pedro is 400 m away</span></div>')
    steps=[('Received','6:12 PM','Your report reached the barangay',True),('Assigned','6:15 PM','Kgd. Maria Santos sent Pedro Bautista',True),('On the way','6:16 PM','About 5 minutes away',True),('Resolved','','You can rate the response here',False)]
    tl=''.join(f'''<div style="display: flex; gap: 12px"><div style="display: flex; flex-direction: column; align-items: center"><span style="width: 12px; height: 12px; border-radius: 50%; background: {GREEN if d else '#FFFFFF'}; border: 2px solid {GREEN if d else LINE}; box-sizing: border-box"></span>{'' if i==3 else f'<span style="flex: 1; width: 2px; background: {GREEN if i<2 else LINE}; min-height: 26px"></span>'}</div><div style="padding-bottom: 12px; margin-top: -3px"><p style="margin: 0; font-size: 14px; font-weight: 700; color: {INK if d else MUTED}">{s} <span style="font-weight: 500; color: {MUTED}">{tm}</span></p><p style="margin: 2px 0 0; font-size: 12px; color: {MUTED}">{x}</p></div></div>''' for i,(s,tm,x,d) in enumerate(steps))
    prog=card(f'<div style="padding: 14px 16px 2px">{tl}</div>')
    resp=card(f'<div style="display: flex; align-items: center; gap: 12px">{avatar("PB",40,GREENBG,GREEN,12)}<span style="flex: 1"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}">Pedro Bautista</span><span style="display: block; font-size: 12px; color: {MUTED}">Barangay tanod · on duty</span></span>{iconbtn(svgl("phone",17,2),"Call Pedro","plain")}</div>','12px 14px')
    info=card(f'<p style="margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: {MUTED}">YOUR REPORT</p><p style="margin: 6px 0 0; font-size: 14px; line-height: 1.55; color: {BODY}">The streetlight in front of the chapel has been off since Monday. The corner is very dark at night.</p><p style="margin: 8px 0 0; font-size: 12px; color: {MUTED}">Infrastructure · Mabini St., Purok 2 · 1 photo</p>','14px 16px')
    return phone('Resident: report detail', hdr, mp+prog+resp+info, 'Reports', band_h=96)

def ticket_chat():
    hdr=phone_top('Water bill dispute with neighbor', sub='Ticket · in progress · Kgd. Maria Santos', right=iconbtn(svgl('dots',18),'More'))
    def msg(text, mine, who='', time=''):
        if mine:
            return f'<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px"><div style="max-width: 78%; padding: 10px 12px; border-radius: 14px 14px 4px 14px; background: {PD}; color: #FFFFFF; font-size: 14px; line-height: 1.5">{text}</div><span style="font-size: 11px; color: {MUTED}">{time} · Seen</span></div>'
        return f'<div style="display: flex; gap: 8px; align-items: flex-end">{avatar("MS",28,SOFT,PD,8)}<div style="display: flex; flex-direction: column; gap: 4px; max-width: 78%"><span style="font-size: 11px; font-weight: 700; color: {MUTED}">{who}</span><div style="padding: 10px 12px; border-radius: 14px 14px 14px 4px; background: #FFFFFF; border: 1px solid {LINE}; color: {INK}; font-size: 14px; line-height: 1.5">{text}</div><span style="font-size: 11px; color: {MUTED}">{time}</span></div></div>'
    thread=f'''<div style="display: flex; flex-direction: column; gap: 14px; padding-top: 34px">
<p style="margin: 0; align-self: center; padding: 3px 10px; border-radius: 999px; background: #FFFFFF; border: 1px solid {LINE}; font-size: 11px; font-weight: 700; color: {MUTED}">TODAY</p>
{msg("Magandang hapon po. Our neighbor's water line runs through our yard and it is leaking onto our side. Can the barangay help us talk to them?",True,time="2:04 PM")}
{msg("Magandang hapon, Juan. Yes, we can set a meeting. Are you free on Saturday morning at the barangay hall?",False,"Kgd. Maria Santos","2:31 PM")}
{msg("Saturday 9 AM works for us. Salamat po.",True,time="2:40 PM")}
{msg("Noted. I've set it for Saturday, 9:00 AM. Please bring photos of the leak if you have them.",False,"Kgd. Maria Santos","3:02 PM")}
<div style="align-self: center; display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 10px; background: #FFFFFF; border: 1px solid {LINE}; font-size: 12px; color: {BODY}"><span style="color: {PD}; display: flex">{ico("calendar",16)}</span>Meeting set · Sat, Nov 21 · 9:00 AM</div></div>'''
    comp=f'''<div style="padding: 10px 12px 20px; background: #FFFFFF; border-top: 1px solid {LINE}; display: flex; align-items: center; gap: 8px; position: relative; z-index: 2">{iconbtn(svgl("clip",18),"Attach","plain",44)}
<label style="flex: 1; display: flex; align-items: center; height: 44px; padding: 0 14px; box-sizing: border-box; border-radius: 12px; background: {BG}; border: 1px solid {LINE}"><input type="text" aria-label="Message" placeholder="Write a message" style="all: unset; flex: 1; font-size: 14px; color: {INK}"></label>
<button type="button" aria-label="Send" style="all: unset; width: 44px; height: 44px; border-radius: 12px; background: {PD}; color: #FFFFFF; display: flex; align-items: center; justify-content: center; cursor: pointer">{svgl("send",18)}</button></div>'''
    return phone('Resident: ticket chat', hdr, thread, None, band_h=74, footer=comp)

def documents():
    hdr=phone_top('My documents', back=False)+f'<div style="display: flex">{btn("Request a document","white",svgl("plus",16),full=True)}</div>'
    reqs=[('Barangay clearance','DOC-2026-0187 · Employment','Ready for pickup','ok','Bring a valid ID to the hall.'),
          ('Certificate of residency','DOC-2026-0179 · School','Processing','info','Due by Nov 19, per the Citizen\'s Charter.'),
          ('Certificate of indigency','DOC-2026-0152 · Medical assistance','Released Nov 3','quiet','')]
    rows=''.join(row(f'<a href="#" style="display: flex; gap: 12px"><span style="color: {PD}; display: flex; padding-top: 2px">{ico("documents",20)}</span><span style="flex: 1"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}">{t}</span><span style="display: block; font-size: 12px; color: {MUTED}">{sub}</span><span style="display: block; margin-top: 6px">{status(st,tone)}</span>{f"<span style=\'display: block; margin-top: 4px; font-size: 12px; color: {BODY}\'>{n}</span>" if n else ""}</span><span style="color: {MUTED}">{svgl("chev",16)}</span></a>', i==0, '14px') for i,(t,sub,st,tone,n) in enumerate(reqs))
    note=f'<p style="margin: 0; font-size: 12px; line-height: 1.5; color: {MUTED}">Processing times follow the barangay\'s Citizen\'s Charter (RA 11032). You\'ll get a notification when a document is ready.</p>'
    return phone('Resident: my documents', hdr, card(rows)+note, 'Docs', band_h=136)

def document_request():
    hdr=phone_top('Request a document', sub='Choose a document and tell us why')
    types=[('Barangay clearance','For jobs, IDs, permits','1 working day','₱50',True),('Certificate of residency','Proof you live here','1 working day','Free',False),('Certificate of indigency','For medical or financial aid','Same day','Free',False),('Business clearance','For a new or renewed permit','3 working days','₱300',False)]
    opts=''.join(f'''<label style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; background: #FFFFFF; border: {('2px solid '+PD) if sel else ('1px solid '+LINE)}; cursor: pointer"><input type="radio" name="doc" {"checked" if sel else ""} aria-label="{t}" style="accent-color: {PD}; width: 18px; height: 18px; margin: 0"><span style="flex: 1"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}">{t}</span><span style="display: block; font-size: 12px; color: {MUTED}">{d}</span></span><span style="text-align: right"><span style="display: block; font-size: 13px; font-weight: 800; color: {INK}">{fee}</span><span style="display: block; font-size: 11px; color: {MUTED}">{tm}</span></span></label>''' for t,d,tm,fee,sel in types)
    fee_note=f'<p style="margin: 0; font-size: 11px; color: {MUTED}">Fees shown are examples. Each barangay sets its own.</p>'
    purpose=field('Purpose','Employment requirement')
    foot=f'<div style="padding: 12px 16px 20px; background: #FFFFFF; border-top: 1px solid {LINE}; position: relative; z-index: 2">{btn("Submit request","primary",full=True,large=True)}</div>'
    return phone('Resident: request a document', hdr, f'<div style="display: flex; flex-direction: column; gap: 8px">{opts}</div>'+fee_note+purpose, None, band_h=96, footer=foot)

def announcements():
    hdr=phone_top('Announcements', back=False)+segmented(['All','Alerts','Events'],0,True)
    items=[('warn','Advisory','Water interruption on Saturday','No water from 9 AM to 3 PM in Purok 1–3 while the main line is repaired. Store water on Friday night.','Today, 8:00 AM',True),
           ('brand','Event','Free anti-rabies vaccination','Bring your dogs and cats to the barangay hall on Nov 28, 8 AM to 12 NN.','Yesterday',False),
           ('danger','Alert','Typhoon signal no. 1 over Cebu','Secure loose items and keep your phones charged. Evacuation centers are on standby.','Nov 12',False),
           ('quiet','Notice','Barangay assembly on Nov 30','The second semester assembly is at the covered court, 2 PM.','Nov 10',False)]
    rows=''.join(row(f'<a href="#" style="display: block">{tag(k,tone)}<span style="display: block; margin-top: 8px; font-size: 15px; font-weight: 800; color: {INK}">{t}</span><span style="display: block; margin-top: 4px; font-size: 13px; line-height: 1.5; color: {BODY}">{b}</span><span style="display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 12px; color: {MUTED}">{"<span style=\'width: 7px; height: 7px; border-radius: 50%; background: "+PD+"\'></span>" if new else ""}{when}</span></a>', i==0, '14px 16px') for i,(tone,k,t,b,when,new) in enumerate(items))
    return phone('Resident: announcements', hdr, card(rows), 'Home', band_h=128)

def cases():
    hdr=phone_top('My cases', sub='Katarungang Pambarangay')
    stages=['Filed','Mediation','Conciliation','Settled']
    st=''.join(f'<span style="flex: 1; text-align: center; font-size: 11px; font-weight: {800 if i==1 else 600}; color: {PD if i==1 else MUTED}">{s}</span>' for i,s in enumerate(stages))
    c1=card(f'''<div style="display: flex; align-items: center"><span style="font-size: 12px; font-weight: 700; color: {MUTED}">KP-2026-0003</span><span style="margin-left: auto">{tag("Mediation","brand")}</span></div>
<p style="margin: 6px 0 0; font-size: 16px; font-weight: 800; color: {INK}">Juan Dela Cruz v. Ramon Cruz</p><p style="margin: 2px 0 12px; font-size: 13px; color: {MUTED}">Boundary fence dispute</p>{progress(2,4,PD)}<div style="display: flex; margin-top: 6px">{st}</div>''','14px 16px')
    hearing=card(f'''<div style="display: flex; gap: 12px"><span style="width: 52px; flex-shrink: 0; text-align: center; padding: 6px 0; border-radius: 10px; background: {SOFT}"><span style="display: block; font-size: 11px; font-weight: 800; color: {PD}">NOV</span><span style="display: block; font-size: 22px; font-weight: 800; color: {INK}">21</span></span><span style="flex: 1"><span style="display: block; font-size: 14px; font-weight: 800; color: {INK}">Mediation hearing</span><span style="display: block; font-size: 13px; color: {BODY}">Saturday, 9:00 AM · Lupon room</span><span style="display: block; margin-top: 4px; font-size: 12px; color: {MUTED}">Bring the lot survey documents.</span></span></div>''','14px 16px')
    law=card(f'<p style="margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: {MUTED}">WHAT HAPPENS NEXT</p><p style="margin: 6px 0 0; font-size: 13px; line-height: 1.55; color: {BODY}">The Punong Barangay has 15 days from the first hearing to help you settle (RA 7160, Sec. 410). If it isn\'t settled, the case goes to the Pangkat for conciliation.</p>','14px 16px')
    return phone('Resident: my cases', hdr, c1+hearing+law, 'Home', band_h=96)

def tarsi_chat(h=640, pad_x=16, convo=None, chip_list=None):
    def b(t,mine):
        return (f'<div style="align-self: flex-end; max-width: 80%; padding: 10px 12px; border-radius: 14px 14px 4px 14px; background: {PD}; color: #FFFFFF; font-size: 14px; line-height: 1.5">{t}</div>' if mine else
                f'<div style="display: flex; gap: 8px; align-items: flex-end"><span style="flex-shrink: 0">{pet(28,"idle",anim=False,ground=False)}</span><div style="max-width: 82%; padding: 11px 13px; border-radius: 14px 14px 14px 4px; background: {BG}; color: {INK}; font-size: 14px; line-height: 1.55">{t}</div></div>')
    chips=''.join(f'<button type="button" style="all: unset; flex-shrink: 0; height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid {LINE}; font-size: 12px; font-weight: 700; color: {PD}; cursor: pointer; display: inline-flex; align-items: center">{t}</button>' for t in (chip_list or ['Office hours','Report a problem','My hearing date','Indigency requirements']))
    msgs=convo(b) if convo else f'''{b("Kumusta, Juan! I'm Tarsi. I can answer questions about barangay services, your reports and your documents.",False)}
{b("What do I need for a barangay clearance?",True)}
{b("You'll need:<br>• a valid ID with your address<br>• your cedula (community tax certificate)<br>• the purpose, e.g. employment<br><br>Most clearances are released within 1 working day.",False)}
<div style="display: flex; gap: 8px; padding-left: 36px">{btn("Request a clearance","secondary",ico("documents",16),small=True)}</div>'''
    head=f'''<div style="display: flex; align-items: center; gap: 10px; padding: 16px {pad_x}px 12px; border-bottom: 1px solid {LINE}"><span style="flex: 1"><span style="display: block; font-size: 16px; font-weight: 800; color: {INK}">Tarsi</span><span style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: {MUTED}"><span style="width: 7px; height: 7px; border-radius: 50%; background: {GREEN}"></span>Barangay helper · answers about services</span></span>
<button type="button" aria-label="Start over" style="all: unset; width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: {MUTED}; cursor: pointer">{svgl("edit",16)}</button><button type="button" aria-label="Close" style="all: unset; width: 34px; height: 34px; border-radius: 10px; background: {BG}; display: flex; align-items: center; justify-content: center; color: {INK}; cursor: pointer">{svgl("x",16,2.2)}</button></div>'''
    body=f'<div style="flex: 1; min-height: 0; overflow: hidden; padding: 14px {pad_x}px; display: flex; flex-direction: column; gap: 12px">{msgs}</div>'
    foot=f'''<div style="padding: 0 {pad_x}px"><div style="display: flex; gap: 6px; overflow: hidden; padding-bottom: 10px">{chips}</div></div>
<div style="padding: 10px {pad_x}px 18px; border-top: 1px solid {LINE}; display: flex; align-items: center; gap: 8px"><label style="flex: 1; display: flex; align-items: center; height: 44px; padding: 0 14px; box-sizing: border-box; border-radius: 12px; background: {BG}; border: 1px solid {LINE}"><input type="text" aria-label="Ask Tarsi" placeholder="Ask Tarsi anything about the barangay" style="all: unset; flex: 1; min-width: 0; font-size: 14px; color: {INK}"></label><button type="button" aria-label="Send" style="all: unset; width: 44px; height: 44px; border-radius: 12px; background: {PD}; color: #FFFFFF; display: flex; align-items: center; justify-content: center; cursor: pointer">{svgl("send",18)}</button></div>
<p style="margin: 0; padding: 0 {pad_x}px 12px; font-size: 11px; color: {MUTED}">Tarsi can make mistakes. For emergencies, call 911.</p>'''
    return head+body+foot

def assistant():
    sheet=f'''<div style="position: absolute; inset: 0; z-index: 10; background: rgba(26,24,48,0.42)"></div>
<div style="position: absolute; left: 0; right: 0; bottom: 0; height: 650px; z-index: 11; background: #FFFFFF; border-radius: 22px 22px 0 0; display: flex; flex-direction: column; box-shadow: 0 -20px 40px -20px rgba(10,8,40,0.4)">
<span style="position: absolute; right: 22px; top: -60px">{pet(64,"talk")}</span>
<span style="display: block; width: 40px; height: 4px; border-radius: 2px; background: {LINE}; margin: 8px auto 0"></span>
{tarsi_chat()}</div>'''
    return home(overlay=sheet, say=None, pet=False)

SCREENS=[('Main','Home',home),('R02-Report-Type','Report: choose type',report_category),('R03-Report-Details','Report: details and location',report_details),
         ('R04-My-Reports','My reports',my_reports),('R05-Report-Detail','Report detail and tracking',report_detail),('R06-Ticket-Chat','Ticket conversation',ticket_chat),
         ('R07-Documents','My documents',documents),('R08-Document-Request','Request a document',document_request),('R09-Announcements','Announcements',announcements),
         ('R10-Cases','My cases (Lupon)',cases),('R11-Assistant','Tarsi chat (open)',assistant)]
if __name__=='__main__':
    for f,t,fn in SCREENS:
        open(f'project/{f}.dc.html','w').write(fn())
    print('resident ok', len(SCREENS))
