from kit import *
from official import th, tr, t2, tx, toolbar, searchbox, select
PAGE='admin'
WHO=('S','Super Admin','Platform admin',PDD)
def adesk(title, eyebrow, heading, sub, actions, content, active, h=900, band_h=196):
    return desktop(title, eyebrow, heading, sub, actions, content, active, band_h=band_h, nav=ADMIN_NAV, who=WHO, place='All barangays', h=h, search='Search everything…')

def applications():
    tabs=segmented(['Pending · 3','Approved','Declined'],0)
    cols='minmax(0, 1.5fr) minmax(0, 1fr) 120px 110px'
    data=[('Brgy. Poblacion','City of Toledo, Cebu','Hon. R. Villanueva','Today',True),('Brgy. Luray II','City of Toledo, Cebu','Hon. M. Ramos','Yesterday',False),('Brgy. Bato','City of Toledo, Cebu','Hon. A. Lim','Nov 15',False)]
    rows=''.join(tr(cols,[t2(a,b),tx(c),tx(d,MUTED),f'<span style="justify-self: end">{btn("Review","primary" if sel else "secondary",small=True)}</span>'],f'background: {SOFT};' if sel else '') for a,b,c,d,sel in data)
    lst=card(toolbar(tabs+searchbox('Search applications',220))+th(cols,['Barangay','Requested by','Submitted',''])+rows)
    docs=[('Barangay resolution','resolution-2026-14.pdf','ok','Looks valid'),('Official ID of the Punong Barangay','id-front.jpg','ok','Matches the name'),('Proof of office','oath-of-office.pdf','warn','Check the date')]
    dl=''.join(row(f'<div style="display: flex; align-items: center; gap: 12px"><span style="color: {PD}; display: flex">{ico("documents",18)}</span>{t2(a,b)}<span style="margin-left: auto">{status(s,tone)}</span></div>',i==0,'10px 18px') for i,(a,b,tone,s) in enumerate(docs))
    detail=card(card_head('Brgy. Poblacion','<span>'+tag('Pending','warn')+'</span>','City of Toledo, Cebu · submitted today, 3:12 PM')
        +f'<div style="display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid {LINE}">'+''.join(f'<div style="padding: 12px 18px; {"border-left: 1px solid "+LINE if i%2 else ""}; {"border-top: 1px solid "+LINE if i>1 else ""}"><span style="display: block; font-size: 12px; color: {MUTED}">{a}</span><span style="display: block; margin-top: 2px; font-size: 14px; font-weight: 700; color: {INK}">{b}</span></div>' for i,(a,b) in enumerate([('Requested by','Hon. R. Villanueva'),('Role','Punong Barangay'),('Email','Shown after review'),('Purok count','8')]))+'</div>'
        +f'<div style="border-top: 1px solid {LINE}; padding: 12px 18px 4px"><p style="margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: {MUTED}">DOCUMENTS</p></div>'+dl
        +f'<div style="border-top: 1px solid {LINE}; padding: 14px 18px; display: flex; gap: 8px">{btn("Decline","secondary")}{btn("Ask for more info","ghost")}<span style="margin-left: auto">{btn("Approve and send invite","primary",svgl("check",16,2.2))}</span></div>')
    content=f'<div style="display: grid; grid-template-columns: minmax(0, 1fr) 520px; gap: 16px; align-items: start">{lst}{detail}</div>'
    return adesk('Admin: applications','PLATFORM · APPLICATIONS','Barangays asking to join','3 applications are waiting for review. Approving one creates the barangay and an official invite code.','',content,'Applications')

def barangays():
    tabs=segmented(['Active · 2','Suspended','All'],0)
    cols='minmax(0, 1.5fr) 110px 110px 110px 130px 130px 70px'
    data=[('Don Andres Soriano','City of Toledo, Cebu','214','3 · 2','4','Today, 7:46 PM','ok','Active'),('QA test barangay','Test data only','12','1 · 1','0','Today, 6:10 PM','info','Test')]
    rows=''.join(tr(cols,[t2(a,b),tx(c),tx(d),tx(e),tx(f,MUTED),status(s,tone),f'<span style="justify-self: end">{btn("Open",small=True)}</span>']) for a,b,c,d,e,f,tone,s in data)
    tbl=card(toolbar(tabs+searchbox('Search barangays',220),btn('Add barangay','primary',svgl('plus',16))) + th(cols,['Barangay','Residents','Officials · tanods','Open reports','Last activity','Status',''])+rows)
    k=[('Barangays','2'),('Residents','226'),('Reports this month','31'),('Push devices','6')]
    strip=f'<div style="display: flex; background: #FFFFFF; border: 1px solid {LINE}; border-radius: 14px; box-shadow: 0 12px 28px -18px rgba(26,24,48,0.35)">'+''.join(f'<div style="flex: 1; padding: 14px 18px; {"border-left: 1px solid "+LINE if i else ""}"><span style="display: block; font-size: 12px; font-weight: 600; color: {MUTED}">{l}</span><span style="display: block; margin-top: 6px; font-size: 24px; font-weight: 800; letter-spacing: -0.6px; color: {INK}">{v}</span></div>' for i,(l,v) in enumerate(k))+'</div>'
    note=card(f'<div style="display: flex; align-items: center; gap: 12px"><span style="color: {BLUE}; display: flex">{svgl("lock",18)}</span><span style="flex: 1; font-size: 13px; color: {BODY}">Barangay data stays separate. Admins see counts here; opening a barangay is logged.</span><a href="#" style="font-size: 13px; font-weight: 700">View access log</a></div>','12px 18px')
    return adesk('Admin: barangays','PLATFORM · BARANGAYS','Barangays on BarangayHub 360','Sample counts for the design.',btn('Export','white',svgl('download',15)),strip+tbl+note,'Barangays',band_h=236)

def all_incidents():
    tabs=segmented(['Open · 5','Resolved','All'],0)
    cols='96px minmax(0, 1.5fr) minmax(0, 1fr) 110px 110px 120px'
    data=[('BH-0418','flood','Flooding near the creek','Don Andres Soriano · Riverside','Critical','danger','On the way','ok','4 min'),
          ('BH-0417','noise','Loud karaoke past midnight','Don Andres Soriano · Purok 3','Normal','quiet','Waiting','warn','25 min'),
          ('BH-0416','infrastructure','Streetlight out on Mabini St.','Don Andres Soriano · Purok 2','Normal','quiet','On the way','ok','1 h'),
          ('BH-0415','animals','Stray dogs near the school','Don Andres Soriano · Purok 1','Low','quiet','Waiting','warn','1 h'),
          ('QA-0009','other','Test report','QA test barangay','Low','quiet','Waiting','warn','2 h')]
    rows=''.join(tr(cols,[tx(a,MUTED,600),f'<span style="display: flex; align-items: center; gap: 10px; min-width: 0"><span style="color: {RED if pt=="danger" else PD}; display: flex">{ico(n,18)}</span>{t2(t,"")}</span>',tx(b),tag(p,pt),status(s,st),tx(w,MUTED)]) for a,n,t,b,p,pt,s,st,w in data)
    tbl=card(toolbar(tabs+searchbox('Search all reports',240),select('All barangays')+select('All categories'))+th(cols,['Report','Title','Barangay','Priority','Status','Age'])+rows)
    note=f'<p style="margin: 0; font-size: 12px; color: {MUTED}">Read-only. Barangay officials handle dispatch.</p>'
    return adesk('Admin: all incidents','PLATFORM · INCIDENTS','Every report, every barangay','Watch for reports that sit too long. Dispatch stays with each barangay.','',tbl+note,'All incidents')

def invite_codes():
    cols='136px 84px minmax(0, 1fr) 112px 120px 36px'
    data=[('DAS-OFF-7Q4K','Official','Don Andres Soriano','Expires Nov 25','Unused','quiet'),('DAS-TAN-2M9X','Tanod','Don Andres Soriano','Expires Nov 25','Unused','quiet'),('POB-OFF-K81D','Official','Brgy. Poblacion','Expires Nov 30','Sent','info'),('DAS-TAN-8P3L','Tanod','Don Andres Soriano','Used Nov 12','Used by Ramon','ok'),('QA-OFF-0001','Official','QA test barangay','Expired','Expired','warn')]
    rows=''.join(tr(cols,[f'<span style="font-family: ui-monospace, monospace; font-size: 13px; font-weight: 700; color: {INK}">{c}</span>',tag(r,'brand' if r=='Official' else 'quiet'),tx(b),tx(e,MUTED),status(s,tone),f'<span style="justify-self: end; display: flex; gap: 4px">{iconbtn(svgl("copy",15),"Copy code","plain",32)}</span>']) for c,r,b,e,s,tone in data)
    tbl=card(toolbar(segmented(['All · 5','Unused · 2','Used','Expired'],0)+searchbox('Search codes',200))+th(cols,['Code','Role','Barangay','Expiry','Status',''])+rows)
    form=card(card_head('New invite code',sub='Codes work once and expire after 7 days.')+f'<div style="padding: 0 18px 16px; display: flex; flex-direction: column; gap: 12px; border-top: 1px solid {LINE}; padding-top: 14px"><div><span style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 700; color: {INK}">Barangay</span>{select("Don Andres Soriano")}</div><div><span style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 700; color: {INK}">Role</span>{segmented(["Official","Tanod"],0)}</div>{field("Send to (optional)","","name@email.com",svgl("mail",16))}{btn("Create code","primary",svgl("key",16),full=True)}</div>')
    content=f'<div style="display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start">{tbl}{form}</div>'
    return adesk('Admin: invite codes','PLATFORM · INVITE CODES','Invite officials and tanods','Residents sign up on their own. Officials and tanods need a code.','',content,'Invite codes')

def users():
    cols='minmax(0, 1.6fr) 110px minmax(0, 1fr) 110px 120px 70px'
    data=[('AB','Aljho Balongcas','Official','Don Andres Soriano','Active','ok','Today'),('MS','Kgd. Maria Santos','Official','Don Andres Soriano','Active','ok','Today'),('PB','Pedro Bautista','Tanod','Don Andres Soriano','On duty','ok','Now'),('RG','Ramon Garcia','Tanod','Don Andres Soriano','Off duty','quiet','Yesterday'),('JD','Juan Dela Cruz','Resident','Don Andres Soriano','Verified','ok','Today'),('QA','QA Official','Official','QA test barangay','Test','info','2 h ago')]
    rows=''.join(tr(cols,[f'<span style="display: flex; align-items: center; gap: 10px; min-width: 0">{avatar(i,30)}{t2(n,"")}</span>',tag(r,'brand' if r=='Official' else ('ok' if r=='Tanod' else 'quiet')),tx(b),status(s,tone),tx(l,MUTED),f'<span style="justify-self: end">{iconbtn(svgl("dots",16),"More","plain",32)}</span>']) for i,n,r,b,s,tone,l in data)
    tbl=card(toolbar(segmented(['Everyone','Officials','Tanods','Residents'],0)+searchbox('Search people',220),select('All barangays'))+th(cols,['Name','Role','Barangay','Status','Last seen',''])+rows)
    return adesk('Admin: users','PLATFORM · USERS','People across all barangays','Change roles or suspend an account. Every change is logged.','',tbl,'Users')

SCREENS=[('A01-Applications','Applications',applications,1440,900),('A02-Barangays','Barangays',barangays,1440,900),('A03-All-Incidents','All incidents',all_incidents,1440,900),
         ('A04-Invite-Codes','Invite codes',invite_codes,1440,900),('A05-Users','Users',users,1440,900)]
if __name__=='__main__':
    for f,t,fn,w,h in SCREENS:
        open(f'project/{f}.dc.html','w').write(fn())
    print('admin ok', len(SCREENS))
