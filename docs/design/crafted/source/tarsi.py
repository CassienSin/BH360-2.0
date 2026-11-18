from kit import *
import official
from resident import tarsi_chat
PAGE='tarsi'

def official_convo(b):
    return (b("Magandang gabi, Aljho! I can look up rules, draft announcements and summarize what's waiting on you.",False)
        + b("How long does mediation run before it goes to the Pangkat?",True)
        + b("15 days from the first meeting with the Punong Barangay (RA 7160, Sec. 410). Then the Pangkat gets 15 more, extendable by 15.<br><br>KP-2026-0003 is 2 days past the first deadline.",False))

def desktop_open():
    pop=f'''<div style="position: absolute; right: 26px; bottom: 112px; z-index: 12; width: 380px; height: 560px; background: #FFFFFF; border-radius: 16px; border: 1px solid {LINE}; box-shadow: 0 30px 60px -24px rgba(10,8,40,0.45); display: flex; flex-direction: column; overflow: hidden">{tarsi_chat(pad_x=16, convo=official_convo, chip_list=['Summarize my day','Draft an announcement','Overdue cases'])}</div>
{pet_float(22, 26, state='talk')}'''
    return official.dashboard(overlay=pop, pet=False)

def sheet():
    states=[('idle','Idle','Waiting in the corner. Bobs gently, blinks.'),('wave','Hello','Greets once a day on Home.'),('talk','Talking','While an answer streams in.'),
            ('think','Thinking','While Tarsi looks something up.'),('sleep','Resting','Offline, or quiet hours.'),('alert','New answer','A reply came while the chat was closed.')]
    st=''.join(f'<div style="padding: 18px 16px; text-align: center; {"border-left: 1px solid "+LINE if i else ""}"><div style="display: flex; justify-content: center; height: 100px; align-items: flex-end">{pet(92,s,badge=(s=="alert"))}</div><p style="margin: 12px 0 2px; font-size: 14px; font-weight: 800; color: {INK}">{t}</p><p style="margin: 0; font-size: 12px; line-height: 1.45; color: {MUTED}">{d}</p></div>' for i,(s,t,d) in enumerate(states))
    rules=[('Where it lives','Bottom-right, just above the tab bar on phones and in the page corner on desktop. Hidden on forms, chats, the full map and during an emergency report.'),
           ('Saying hello','Once a day on Home, a short bubble. It closes after 6 seconds or on tap. No pop-ups anywhere else.'),
           ('Tap','Opens the chat. On phones Tarsi climbs onto the top of the sheet; on desktop a panel opens above it.'),
           ('Tuck away','Long-press or drag to the edge to hide it. It comes back from Me → Settings.'),
           ('Never','Covers the Report button or hotlines, talks over an emergency, or answers for the barangay on legal matters.'),
           ('Motion','Bob 3.2 s, blink every 5 s, wave on hello. All off with reduced motion.')]
    rl=''.join(row(f'<div style="display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 14px"><span style="font-size: 13px; font-weight: 800; color: {PD}">{a}</span><span style="font-size: 13px; line-height: 1.55; color: {BODY}">{b}</span></div>', i==0, '11px 18px') for i,(a,b) in enumerate(rules))
    sizes=''.join(f'<div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 8px">{pet(z,"idle",anim=False,ground=z>40)}<span style="font-size: 12px; font-weight: 700; color: {MUTED}">{z}px · {u}</span></div>' for z,u in [(28,'chat avatar'),(64,'floating'),(96,'empty states')])
    hero=f'''<section style="position: relative; overflow: hidden; border-radius: 16px; display: grid; grid-template-columns: 300px minmax(0, 1fr); align-items: center; min-height: 300px"><div style="position: absolute; inset: 0">{band(16,9)}</div>
<div style="position: relative; display: flex; justify-content: center; padding-top: 24px">{pet(220,'wave')}</div>
<div style="position: relative; padding: 32px 40px 32px 0"><p style="margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; color: rgba(255,255,255,0.75)">THE BARANGAY ASSISTANT</p><h1 style="margin: 8px 0 0; font-size: 44px; font-weight: 800; letter-spacing: -1.4px; color: #FFFFFF">Meet Tarsi.</h1>
<p style="margin: 12px 0 0; max-width: 560px; font-size: 16px; line-height: 1.6; color: rgba(255,255,255,0.9)">A small Philippine tarsier with big eyes that notice everything. Tarsi sits in the corner of the app and answers questions about services, reports, documents and hearings, in plain words.</p>
<div style="display: flex; gap: 8px; margin-top: 18px">{tag("Same purple as the app","brand")}{tag("Drawn in SVG, no images","brand")}{tag("Placeholder name","brand")}</div></div></section>'''
    body=f'''<div style="width: 1440px; height: 1040px; box-sizing: border-box; padding: 32px 40px; font-family: Sora, system-ui, sans-serif; background: {BG}; display: flex; flex-direction: column; gap: 18px">
{hero}
{card(card_head('States','<span style="font-size: 12px; color: '+MUTED+'">Eyes blink and the body bobs in every state</span>')+f'<div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); border-top: 1px solid {LINE}">{st}</div>')}
<div style="display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: 18px; align-items: start">{card(card_head('How Tarsi behaves')+f'<div style="border-top: 1px solid {LINE}">{rl}</div>')}{card(card_head('Sizes')+f'<div style="display: flex; justify-content: space-around; align-items: flex-end; padding: 18px; border-top: 1px solid {LINE}">{sizes}</div>')}</div></div>'''
    return page('Meet Tarsi', 1440, 1040, body)

SCREENS=[('M01-Meet-Tarsi','Meet Tarsi: states and rules',sheet,1440,1040),('M02-Tarsi-Desktop','Tarsi chat open (official desktop)',desktop_open,1440,900)]
if __name__=='__main__':
    for f,t,fn,w,h in SCREENS:
        open(f'project/{f}.dc.html','w').write(fn())
    print('tarsi ok', len(SCREENS))
