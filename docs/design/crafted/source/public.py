from kit import *
from tanod import switch
PAGE='public'

def check(on=True):
    return f'<span style="width: 20px; height: 20px; border-radius: 6px; box-sizing: border-box; flex-shrink: 0; display: flex; align-items: center; justify-content: center; {"background: "+PD+"; color: #FFFFFF" if on else "border: 2px solid #CFCBE3"}">{svgl("check",14,2.6) if on else ""}</span>'

def logo_row(name_color='#FFFFFF', sub=None):
    s=f'<span style="display: block; font-size: 12px; color: rgba(255,255,255,0.8)">{sub}</span>' if sub else ''
    return f'<div style="display: flex; align-items: center; gap: 10px"><img src="/_blob/LOGO_ID" alt="" style="width: 34px; height: 34px; object-fit: contain"><span><span style="display: block; font-size: 15px; font-weight: 800; color: {name_color}">BarangayHub 360</span>{s}</span></div>'

def mini_phone():
    trk=card(f'''<span style="display: block; font-size: 11px; font-weight: 700; color: {GREEN}">Tanod on the way · about 5 min</span><span style="display: block; margin: 4px 0 8px; font-size: 13px; font-weight: 800; color: {INK}">Streetlight out on Mabini Street</span>{progress(3)}''','12px','box-shadow: 0 12px 28px -18px rgba(26,24,48,0.5)')
    sv=card(''.join(row(f'<span style="display: flex; align-items: center; gap: 10px"><span style="color: {PD}; display: flex">{ico(n,18)}</span><span style="font-size: 12px; font-weight: 700; color: {INK}">{l}</span></span>',i==0,'10px 12px') for i,(n,l) in enumerate([('documents','Request a document'),('tickets','Ask the barangay'),('blotter','My cases')])))
    ann=card(f'<span style="display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; color: {MUTED}">ANNOUNCEMENT · 2 H AGO</span><span style="display: block; margin-top: 4px; font-size: 12px; font-weight: 800; color: {INK}">Water interruption on Saturday</span><span style="display: block; margin-top: 2px; font-size: 11px; color: {BODY}">Purok 1 to 3, 9 AM to 3 PM</span>','10px 12px')
    return f'''<div style="width: 300px; height: 560px; border-radius: 40px; background: #12103A; padding: 10px; box-sizing: border-box; box-shadow: 0 40px 80px -30px rgba(10,8,40,0.7)"><div style="position: relative; width: 100%; height: 100%; border-radius: 31px; overflow: hidden; background: {BG}">
<div style="position: absolute; left: 0; right: 0; top: 0; height: 240px">{band(8,4,solid=170,fade=70)}</div>
<div style="position: relative; padding: 22px 14px; display: flex; flex-direction: column; gap: 12px">
<p style="margin: 0; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: rgba(255,255,255,0.75)">WEDNESDAY, NOV 18</p><p style="margin: -6px 0 6px; font-size: 20px; font-weight: 800; color: #FFFFFF">Magandang gabi, Juan.</p>{trk}{sv}{ann}</div></div></div>'''

def landing():
    nav=f'''<div style="display: flex; align-items: center; gap: 28px">{logo_row()}<nav style="display: flex; gap: 24px; margin-left: 24px">{''.join(f'<a href="#" style="font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.88)">{t}</a>' for t in ['Features','How it works','For barangays','Help'])}</nav><span style="margin-left: auto; display: flex; gap: 8px">{btn("Sign in","onband")}{btn("Get started","white")}</span></div>'''
    hero=f'''<div style="display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 40px; align-items: center; margin-top: 56px"><div>
<p style="margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.1em; color: rgba(255,255,255,0.75)">FOR RESIDENTS, OFFICIALS AND TANODS</p>
<h1 style="margin: 14px 0 0; font-size: 60px; line-height: 1.04; font-weight: 800; letter-spacing: -2px; color: #FFFFFF">Your barangay,<br>one tap away.</h1>
<p style="margin: 18px 0 0; max-width: 520px; font-size: 17px; line-height: 1.6; color: rgba(255,255,255,0.88)">Report a problem and watch help arrive. Request a clearance without the long line. Hear from your barangay the moment something happens.</p>
<div style="display: flex; gap: 10px; margin-top: 28px">{btn("Create a free account","white",large=True)}{btn("Report an emergency","onband",svgl("phone",17,2),large=True)}</div>
<p style="margin: 18px 0 0; font-size: 13px; color: rgba(255,255,255,0.75)">Works on any phone browser. Install it like an app.</p></div>
<div style="display: flex; justify-content: center; margin-bottom: -150px">{mini_phone()}</div></div>'''
    feats=[('incidents','Report and track','Send a report with a photo and your location. See when a tanod is assigned and on the way.'),
           ('documents','Documents without the line','Request a clearance, residency or indigency certificate. Pick it up when it says ready.'),
           ('announcements','Hear it first','Water interruptions, typhoon alerts and events, sent straight to your phone.'),
           ('blotter','Lupon cases, in the open','Follow your Katarungang Pambarangay case and its hearing dates.'),
           ('tickets','Talk to the barangay','Ask a question and get an answer from an official, in one thread.'),
           ('map','Built for responders','Officials dispatch from a live map. Tanods get the route on their phone.')]
    fg=''.join(f'<div style="padding: 22px 24px; {"border-left: 1px solid "+LINE if i%3 else ""}; {"border-top: 1px solid "+LINE if i>2 else ""}"><span style="color: {PD}; display: flex">{ico(n,26)}</span><h3 style="margin: 14px 0 6px; font-size: 16px; font-weight: 800; color: {INK}">{t}</h3><p style="margin: 0; font-size: 14px; line-height: 1.6; color: {BODY}">{d}</p></div>' for i,(n,t,d) in enumerate(feats))
    steps=[('1','Sign up','Create an account with your name, purok and mobile number.'),('2','Get verified','An official checks you live in the barangay. Usually the same day.'),('3','Use it','Report, request and receive alerts from one app.')]
    st=''.join(f'<div style="display: flex; gap: 14px"><span style="width: 32px; height: 32px; border-radius: 50%; background: {SOFT}; color: {PD}; font-size: 14px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0">{n}</span><span><span style="display: block; font-size: 15px; font-weight: 800; color: {INK}">{t}</span><span style="display: block; margin-top: 4px; font-size: 14px; line-height: 1.55; color: {BODY}">{d}</span></span></div>' for n,t,d in steps)
    off=f'''<section style="position: relative; overflow: hidden; border-radius: 16px; padding: 32px 36px; display: flex; align-items: center; gap: 24px"><div style="position: absolute; inset: 0">{band(10,7)}</div><div style="position: relative; flex: 1"><h2 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.6px; color: #FFFFFF">Run a barangay? Bring it online.</h2><p style="margin: 8px 0 0; font-size: 15px; color: rgba(255,255,255,0.88)">Apply with your barangay resolution. We review it and send your officials their invite codes.</p></div><span style="position: relative">{btn("Request access","white",large=True)}</span></section>'''
    body=f'''<div style="width: 1440px; height: 1600px; box-sizing: border-box; font-family: Sora, system-ui, sans-serif; background: {BG}; position: relative; overflow: hidden">
<div style="position: absolute; left: 0; right: 0; top: 0; height: 800px">{band(22,3,solid=600,fade=200)}</div>
<div style="position: relative; z-index: 1; max-width: 1180px; margin: 0 auto; padding: 22px 0">{nav}{hero}</div>
<div style="position: relative; z-index: 1; max-width: 1180px; margin: 0 auto; padding: 170px 0 0; display: flex; flex-direction: column; gap: 56px">
<div><p style="margin: 0 0 6px; font-size: 13px; font-weight: 700; letter-spacing: 0.1em; color: {PD}">WHAT YOU CAN DO</p><h2 style="margin: 0 0 22px; font-size: 32px; font-weight: 800; letter-spacing: -0.8px; color: {INK}">Everything the barangay hall does,<br>now on your phone.</h2>{card(f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr))">{fg}</div>')}</div>
<div style="display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 40px"><div><p style="margin: 0 0 6px; font-size: 13px; font-weight: 700; letter-spacing: 0.1em; color: {PD}">HOW IT WORKS</p><h2 style="margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.8px; color: {INK}">Three steps, then you're in.</h2></div><div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px">{st}</div></div>
{off}
<footer style="display: flex; align-items: center; gap: 20px; padding: 22px 0 30px; border-top: 1px solid {LINE}">{logo_row(INK)}<span style="font-size: 13px; color: {MUTED}">A capstone project · Data handled under RA 10173</span><span style="margin-left: auto; display: flex; gap: 20px">{''.join(f'<a href="#" style="font-size: 13px; color: {BODY}">{t}</a>' for t in ['Privacy','Terms','Help'])}</span></footer></div></div>'''
    return page('Landing', 1440, 1600, body)

AUTH_SHADOW='box-shadow: 0 30px 60px -28px rgba(10,8,40,0.55), 0 2px 6px rgba(10,8,40,0.08)'
def emer_note(light=True):
    return f'<p style="margin: 0; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; color: rgba(255,255,255,0.85)"><span style="display: flex">{svgl("phone",15,2)}</span>Life in danger? Call 911 first.</p>'

def auth_desk(title, form, width=440, below=''):
    body=f'''<div style="width: 1440px; height: 900px; position: relative; overflow: hidden; font-family: Sora, system-ui, sans-serif; display: flex; flex-direction: column">
<div style="position: absolute; inset: 0">{band(30,6)}</div>
<div style="position: relative; padding: 24px 40px; display: flex; align-items: center">{logo_row()}<a href="#" style="margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.88)">{svgl("back",16)}Back to home</a></div>
<div style="position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px">
<section style="width: {width}px; box-sizing: border-box; background: #FFFFFF; border-radius: 16px; padding: 32px; {AUTH_SHADOW}">{form}</section>{below}</div>
<div style="position: relative; padding: 0 0 26px">{emer_note()}</div></div>'''
    return page(title, 1440, 900, body)

def card_title(h, p, step=None):
    st=f'<p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; color: {PD}">{step}</p>' if step else ''
    return f'{st}<h2 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.6px; color: {INK}">{h}</h2><p style="margin: 6px 0 22px; font-size: 14px; line-height: 1.5; color: {MUTED}">{p}</p>'

def white_link(html):
    return f'<p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.88); text-align: center">{html}</p>'

def signin_form(gap=14):
    return f'''<div style="display: flex; flex-direction: column; gap: {gap}px">{field("Email","juan.delacruz@email.com","",svgl("mail",16),"email")}{field("Password","••••••••••","",svgl("lock",16),"password")}
<div style="display: flex; align-items: center"><label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: {BODY}">{check(True)}Keep me signed in</label><a href="#" style="margin-left: auto; font-size: 13px; font-weight: 700">Forgot password?</a></div>
{btn("Sign in","primary",full=True,large=True)}</div>'''

def signin_desk():
    form=card_title('Sign in','Magandang gabi. Use the email you signed up with.')+signin_form()+f'<p style="margin: 22px 0 0; padding-top: 18px; border-top: 1px solid {LINE}; font-size: 14px; color: {BODY}; text-align: center">New here? <a href="#" style="font-weight: 700">Create an account</a></p>'
    return auth_desk('Sign in (desktop)', form, below=white_link('Barangay officials: <a href="#" style="font-weight: 700; color: #FFFFFF; text-decoration: underline">request access</a>'))

ROLES=[('resident','Resident','Live in the barangay. Sign up on your own; an official verifies you.',True,''),
       ('official','Barangay official','Captain, kagawad or secretary. Needs an invite code.',False,'Invite code'),
       ('tanods','Tanod','Respond to reports on duty. Needs an invite code.',False,'Invite code')]
def role_opts(pad=14):
    return ''.join(f'''<button type="button" style="all: unset; box-sizing: border-box; display: flex; gap: 12px; padding: {pad}px; border-radius: 12px; background: {SOFT if on else '#FFFFFF'}; border: {"2px solid "+PD if on else "1px solid "+LINE}; cursor: pointer"><span style="color: {PD}; display: flex; padding-top: 2px">{ico(n,22,on,"currentColor",SOFT if on else "#FFFFFF")}</span><span style="flex: 1"><span style="display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 800; color: {INK}">{t}{tag(b,"quiet") if b else ""}</span><span style="display: block; margin-top: 4px; font-size: 13px; line-height: 1.5; color: {BODY}">{d}</span></span><span style="width: 20px; height: 20px; border-radius: 50%; box-sizing: border-box; border: {"6px solid "+PD if on else "2px solid #CFCBE3"}; flex-shrink: 0; background: #FFFFFF"></span></button>''' for n,t,d,on,b in ROLES)

def sel(l,v):
    return f'<label style="display: block; min-width: 0"><span style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 700; color: {INK}">{l}</span><span style="display: flex; align-items: center; height: 46px; padding: 0 14px; box-sizing: border-box; border-radius: 10px; background: #FFFFFF; border: 1px solid {LINE}; font-size: 14px; color: {INK}"><span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{v}</span><span style="color: {MUTED}; display: flex">{svgl("down",15)}</span></span></label>'
CONSENT=f'<label style="display: flex; gap: 10px; font-size: 12px; line-height: 1.5; color: {BODY}">{check(True)}<span>I agree to the <a href="#" style="font-weight: 700">privacy notice</a>. My data is used only by my barangay (RA 10173).</span></label>'

def register_desk():
    form=card_title('Create an account','Free for residents of partner barangays.','STEP 2 OF 3 · YOUR DETAILS')+f'''<div style="display: flex; flex-direction: column; gap: 14px"><div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px">{field("Full name","Juan Dela Cruz")}{field("Mobile number","","09XX XXX XXXX",svgl("phone",16),"tel")}</div>
{field("Email","juan.delacruz@email.com","",svgl("mail",16),"email")}<div style="display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 12px">{sel("Barangay","Don Andres Soriano, City of Toledo")}{sel("Purok","Purok 2")}</div>{CONSENT}
<div style="display: flex; gap: 10px">{btn("Back","secondary",large=True)}<span style="flex: 1; display: flex">{btn("Continue","primary",full=True,large=True)}</span></div></div>'''
    return auth_desk('Register (desktop)', form, width=560, below=white_link('Have an account? <a href="#" style="font-weight: 700; color: #FFFFFF; text-decoration: underline">Sign in</a>'))

def request_access():
    form=card_title('Request access','For Punong Barangays and secretaries. We review every application.')+f'''<div style="display: flex; flex-direction: column; gap: 12px"><div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px">{field("Barangay","","Brgy. name")}{field("City or municipality","","e.g. City of Toledo")}</div>
<div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px">{field("Your full name","","As on your ID")}{field("Position","Punong Barangay")}</div>{field("Work email","","name@email.com",svgl("mail",16),"email")}
<div><span style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 700; color: {INK}">Barangay resolution and ID</span><div style="display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 10px; border: 1.5px dashed #CFCBE3"><span style="color: {PD}; display: flex">{svgl("upload",20)}</span><span style="flex: 1; font-size: 13px; color: {BODY}">Drop PDFs or photos here, or <a href="#" style="font-weight: 700">browse</a></span><span style="font-size: 12px; color: {MUTED}">Up to 10 MB</span></div></div>
<label style="display: flex; gap: 10px; font-size: 13px; line-height: 1.5; color: {BODY}">{check(False)}I confirm I am authorized to apply for this barangay.</label>
{btn("Submit application","primary",full=True,large=True)}</div>'''
    return auth_desk('Request access (desktop)', form, width=600)

def auth_phone(title, inner, below='', top=None, pad='22px 18px'):
    top = top or logo_row()
    body=f'''<div style="width: 390px; height: 844px; box-sizing: border-box; position: relative; overflow: hidden; font-family: Sora, system-ui, sans-serif; display: flex; flex-direction: column">
<div style="position: absolute; inset: 0">{band(26,5)}</div>
<div style="position: relative; padding: 18px 16px 0">{top}</div>
<div style="position: relative; flex: 1; padding: 0 16px; display: flex; flex-direction: column; justify-content: center; gap: 16px">
<section style="background: #FFFFFF; border-radius: 16px; padding: {pad}; {AUTH_SHADOW}">{inner}</section>{below}</div>
<div style="position: relative; padding: 0 0 22px">{emer_note()}</div></div>'''
    return page(title, 390, 844, body)

def back_top(label_):
    return f'<div style="display: flex; align-items: center; gap: 10px">{iconbtn(svgl("back",18),"Back")}<span style="font-size: 15px; font-weight: 700; color: #FFFFFF">{label_}</span></div>'

def signin_phone():
    inner=card_title('Sign in','Magandang gabi. Use the email you signed up with.')+signin_form(12)
    return auth_phone('Sign in (phone)', inner, white_link('New here? <a href="#" style="font-weight: 700; color: #FFFFFF; text-decoration: underline">Create an account</a>'))

def register_role():
    inner=card_title('Who are you?','Pick the one that fits. You can\'t change this later.','STEP 1 OF 3')+f'<div style="display: flex; flex-direction: column; gap: 10px">{role_opts(12)}</div><div style="margin-top: 16px">{btn("Continue","primary",full=True,large=True)}</div>'
    return auth_phone('Register: who are you', inner, white_link('Have an account? <a href="#" style="font-weight: 700; color: #FFFFFF; text-decoration: underline">Sign in</a>'), back_top('Create an account'), '20px 16px')

def register_details():
    inner=card_title('Your details','We use these to verify you live in the barangay.','STEP 2 OF 3')+f'''<div style="display: flex; flex-direction: column; gap: 12px">{field("Full name","Juan Dela Cruz")}{field("Mobile number","","09XX XXX XXXX",svgl("phone",16),"tel")}{field("Email","juan.delacruz@email.com","",svgl("mail",16),"email")}
<div style="display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 10px">{sel("Barangay","Don Andres Soriano")}{sel("Purok","Purok 2")}</div>{CONSENT}{btn("Continue","primary",full=True,large=True)}</div>'''
    return auth_phone('Register: your details', inner, '', back_top('Create an account'), '20px 16px')

def reset():
    inner=card_title('Forgot your password?','We will email you a link to set a new one.')+f'''<div style="display: flex; flex-direction: column; gap: 14px">{field("Email","juan.delacruz@email.com","",svgl("mail",16),"email")}{btn("Send reset link","primary",full=True,large=True)}
<div style="display: flex; gap: 10px; padding: 12px; border-radius: 10px; background: {GREENBG}"><span style="color: {GREEN}; display: flex; padding-top: 1px">{svgl("check",17,2.4)}</span><span style="font-size: 13px; line-height: 1.5; color: {BODY}"><b style="color: {INK}">Check your email.</b> If an account uses this address, a link is on its way. It works for 1 hour.</span></div></div>'''
    return auth_phone('Reset password', inner, white_link('<a href="#" style="font-weight: 700; color: #FFFFFF">Back to sign in</a>'), back_top('Reset password'))

def offline():
    hot=card(''.join(row(f'<a href="#" style="display: flex; align-items: center; gap: 10px"><span style="color: {c}; display: flex">{svgl("phone",17,2)}</span><span style="flex: 1; font-size: 14px; font-weight: 700; color: {INK}">{l}</span><span style="font-size: 13px; font-weight: 600; color: {MUTED}">{n}</span></a>', i==0, '11px 14px') for i,(l,n,c) in enumerate([('Emergency','911',RED),('Barangay hall','Tap to call',PD),('Fire (BFP)','Tap to call',RED)])))
    works=card(''.join(row(f'<div style="display: flex; gap: 10px"><span style="color: {GREEN}; display: flex; padding-top: 1px">{svgl("check",17,2.4)}</span><span style="font-size: 13px; line-height: 1.5; color: {BODY}">{t}</span></div>', i==0, '10px 14px') for i,t in enumerate(['Write a report now. It sends when you are back online.','Open documents and announcements you already viewed.','Call hotlines. Calls do not need data.'])))
    queued=card(f'<div style="display: flex; align-items: center; gap: 10px"><span style="color: {AMBER}; display: flex">{svgl("clock",18)}</span><span style="flex: 1"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}">1 report waiting to send</span><span style="display: block; font-size: 12px; color: {MUTED}">Streetlight out on Mabini Street</span></span></div>','12px 14px')
    hdr=f'{logo_row()}<div style="margin-top: 18px; display: flex; align-items: center; gap: 12px"><span style="color: #FFFFFF; display: flex">{svgl("wifi",30,2)}</span><span><span style="display: block; font-size: 26px; font-weight: 800; letter-spacing: -0.6px; color: #FFFFFF">You\'re offline</span><span style="display: block; font-size: 14px; color: rgba(255,255,255,0.88)">Some things still work.</span></span></div>'
    foot=f'<div style="padding: 12px 16px 20px; background: #FFFFFF; border-top: 1px solid {LINE}; position: relative; z-index: 2">{btn("Try again","primary",full=True,large=True)}</div>'
    return phone('Offline', hdr, queued+works+f'<div>{label("HOTLINES")}{hot}</div>', None, band_h=176, footer=foot)

def profile():
    hdr=phone_top('My profile', right=iconbtn(svgl('edit',17),'Edit profile'))+f'<div style="display: flex; align-items: center; gap: 14px; margin-top: 4px">{avatar("JD",64,"#FFFFFF",PD,18)}<span><span style="display: block; font-size: 20px; font-weight: 800; color: #FFFFFF">Juan Dela Cruz</span><span style="display: inline-flex; align-items: center; gap: 6px; margin-top: 4px; height: 24px; padding: 0 8px; border-radius: 6px; background: rgba(20,17,80,0.28); font-size: 12px; font-weight: 700; color: #FFFFFF">{svgl("check",13,2.6)}Verified resident</span></span></div>'
    info=card(''.join(row(f'<div style="display: flex; align-items: center; gap: 12px"><span style="width: 96px; font-size: 13px; color: {MUTED}">{a}</span><span style="flex: 1; font-size: 14px; font-weight: 600; color: {INK}">{b}</span></div>', i==0, '12px 14px') for i,(a,b) in enumerate([('Barangay','Don Andres Soriano'),('Purok','Purok 2'),('Mobile','09XX XXX XXXX'),('Email','juan.delacruz@email.com'),('Member since','October 2026')])))
    acts=card(''.join(row(f'<a href="#" style="display: flex; align-items: center; gap: 12px"><span style="color: {PD}; display: flex">{ic}</span><span style="flex: 1; font-size: 14px; font-weight: 700; color: {INK}">{t}</span><span style="color: {MUTED}">{svgl("chev",16)}</span></a>', i==0, '12px 14px') for i,(ic,t) in enumerate([(svgl('sun',18),'Settings'),(ico('ai',18),'Help and FAQ'),(svgl('lock',18),'Privacy and my data')])))
    out=f'<div style="display: flex">{btn("Sign out","secondary",svgl("logout",16),full=True)}</div>'
    return phone('Profile', hdr, info+acts+out, 'Home', band_h=180)

def settings():
    def sw(t,s,on,lock=False):
        r=f'<span style="font-size: 12px; font-weight: 700; color: {MUTED}">Always on</span>' if lock else switch(on)
        return f'<div style="display: flex; align-items: center; gap: 12px"><span style="flex: 1"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}">{t}</span><span style="display: block; font-size: 12px; color: {MUTED}">{s}</span></span>{r}</div>'
    gh=lambda t: f'<p style="margin: 0; padding: 12px 14px 0; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: {MUTED}">{t}</p>'
    notif=card(gh('NOTIFICATIONS')+''.join(row(x,i==0,'12px 14px') for i,x in enumerate([sw('Report updates','When a tanod is assigned or arrives',True),sw('Ticket replies','When an official answers you',True),sw('Announcements','News and events from the barangay',False),sw('Emergency alerts','Typhoons, floods and evacuations',True,True)])))
    look=card(f'<div style="display: flex; flex-direction: column; gap: 12px"><span style="font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: {MUTED}">APPEARANCE</span><span style="font-size: 14px; font-weight: 700; color: {INK}">Theme</span>{segmented(["Light","Dark","System"],2)}<span style="font-size: 14px; font-weight: 700; color: {INK}">Language</span>{segmented(["English","Cebuano","Filipino"],0)}</div>','14px')
    acct=card(gh('ACCOUNT')+''.join(row(f'<a href="#" style="display: flex; align-items: center; gap: 12px"><span style="flex: 1; font-size: 14px; font-weight: 700; color: {c}">{t}</span><span style="color: {MUTED}">{svgl("chev",16)}</span></a>', i==0, '12px 14px') for i,(t,c) in enumerate([('Change password',INK),('Sign out of other devices',INK),('Delete my account',RED)])))
    return phone('Settings', phone_top('Settings'), notif+look+acct, None, band_h=66)

def help_page():
    hdr=phone_top('Help')+f'<label style="display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 14px; box-sizing: border-box; border-radius: 12px; background: #FFFFFF; color: {MUTED}">{svgl("search",17)}<input type="search" aria-label="Search help" placeholder="Search questions" style="all: unset; flex: 1; font-size: 14px; color: {INK}"></label>'
    faq=[('How long does a clearance take?',True,'Most are released within 1 working day. Simple requests follow the Citizen\'s Charter time (RA 11032). You get a notification when it is ready.'),('Why do I need to be verified?',False,''),('Can I report for someone else?',False,''),('What happens after I report?',False,''),('How do I change my purok?',False,'')]
    fq=card(f'<p style="margin: 0; padding: 12px 14px 0; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: {MUTED}">COMMON QUESTIONS</p>'+''.join(row(f'<div style="display: flex; align-items: center; gap: 12px"><span style="flex: 1; font-size: 14px; font-weight: 700; color: {INK}">{q}</span><span style="color: {MUTED}; display: flex; transform: rotate({180 if o else 0}deg)">{svgl("down",16)}</span></div>'+(f'<p style="margin: 8px 0 0; font-size: 13px; line-height: 1.55; color: {BODY}">{a}</p>' if o else ''), i==0, '13px 14px') for i,(q,o,a) in enumerate(faq)))
    contact=card(row(f'<a href="#" style="display: flex; align-items: center; gap: 12px"><span style="color: {PD}; display: flex">{ico("tickets",20)}</span><span style="flex: 1"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}">Ask the barangay</span><span style="display: block; font-size: 12px; color: {MUTED}">Open a ticket · usually answered the same day</span></span><span style="color: {MUTED}">{svgl("chev",16)}</span></a>',True,'12px 14px')+row(f'<a href="#" style="display: flex; align-items: center; gap: 12px"><span style="color: {PD}; display: flex">{ico("ai",20)}</span><span style="flex: 1"><span style="display: block; font-size: 14px; font-weight: 700; color: {INK}">Ask the assistant</span><span style="display: block; font-size: 12px; color: {MUTED}">Quick answers about services</span></span><span style="color: {MUTED}">{svgl("chev",16)}</span></a>',False,'12px 14px')+row(f'<a href="#" style="display: flex; align-items: center; gap: 12px"><span style="color: {PD}; display: flex">{svgl("phone",19,2)}</span><span style="flex: 1; font-size: 14px; font-weight: 700; color: {INK}">Call the hall</span><span style="font-size: 13px; font-weight: 600; color: {MUTED}">Tap to call</span></a>',False,'12px 14px'))
    return phone('Help', hdr, fq+f'<div>{label("STILL STUCK?")}{contact}</div>', None, band_h=128)

SCREENS=[('P01-Landing','Landing page',landing,1440,1600),('P02-Sign-In-Desktop','Sign in (desktop)',signin_desk,1440,900),('P02b-Register-Desktop','Create an account (desktop)',register_desk,1440,900),('P03-Request-Access','Request access (barangays)',request_access,1440,900),
         ('P04-Sign-In','Sign in (phone)',signin_phone,390,844),('P05-Register-Role','Register: who are you',register_role,390,844),('P06-Register-Details','Register: details',register_details,390,844),
         ('P07-Reset-Password','Reset password',reset,390,844),('P08-Offline','Offline',offline,390,844),('P09-Profile','Profile',profile,390,844),
         ('P10-Settings','Settings',settings,390,844),('P11-Help','Help',help_page,390,844)]
if __name__=='__main__':
    for f,t,fn,w,h in SCREENS:
        open(f'project/{f}.dc.html','w').write(fn())
    print('public ok', len(SCREENS))
