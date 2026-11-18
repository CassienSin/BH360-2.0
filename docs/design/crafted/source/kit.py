"""BH360 'Crafted' design kit: one source for every screen on the canvas."""
import json, sys
sys.path.insert(0, '/home/claude/icons')
from icons import ICONS

LOGO = '/_blob/7ce583db6ec2dd0910b44bfb85beb803'
# ---- tokens ----
INK='#1A1830'; BODY='#4A4763'; MUTED='#6B6884'; LINE='#E7E5F0'; BG='#F6F5FA'
P='#5B54E8'; PD='#4A43D4'; PDD='#2E2A8C'; SOFT='#EFEDFC'
RED='#D92D4B'; REDBG='#FDECEF'; GREEN='#14834F'; GREENBG='#E7F6EE'; AMBER='#B45309'; AMBERBG='#FEF4E2'; BLUE='#2563EB'; BLUEBG='#EAF1FE'
TONES={'danger':(RED,REDBG),'ok':(GREEN,GREENBG),'warn':(AMBER,AMBERBG),'info':(BLUE,BLUEBG),'brand':(PD,SOFT),'quiet':(MUTED,'#F0EFF5')}
FONT='<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"><link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">'
CSS='''body{margin:0}
a{color:#4A43D4;text-decoration:none}a:hover{color:#2E2A8C}
@keyframes weave{from{background-position:0 0,0 0}to{background-position:56px 56px,-56px 56px}}
@keyframes drift{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:.8;transform:translateY(-12px)}}
@keyframes ping{0%{box-shadow:0 0 0 0 rgba(217,45,75,.45)}100%{box-shadow:0 0 0 10px rgba(217,45,75,0)}}
.weave{animation:weave 40s linear infinite}
.dot{animation:drift 6s ease-in-out infinite}
.ping{animation:ping 1.8s ease-out infinite}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes squash{0%,100%{transform:scaleX(1);opacity:.9}50%{transform:scaleX(.82);opacity:.6}}
@keyframes blink{0%,90%,100%{transform:scaleY(1)}93%{transform:scaleY(.08)}}
@keyframes wave{0%,100%{transform:rotate(0)}25%{transform:rotate(-16deg)}75%{transform:rotate(12deg)}}
@keyframes mpulse{0%{transform:scale(.6);opacity:.55}100%{transform:scale(1.7);opacity:0}}
.mpulse{transform-box:fill-box;transform-origin:center;animation:mpulse 2s ease-out infinite}
@keyframes pop{0%{opacity:0;transform:translateY(6px) scale(.96)}100%{opacity:1;transform:none}}
.pet-bob{animation:bob 3.2s ease-in-out infinite}
.pet-shadow{transform-box:fill-box;transform-origin:center;animation:squash 3.2s ease-in-out infinite}
.pet-eye{transform-box:fill-box;transform-origin:center;animation:blink 5s infinite}
.pet-wave{transform-box:fill-box;transform-origin:20% 90%;animation:wave 1.6s ease-in-out infinite}
.pet-say{animation:pop .35s ease-out both .6s}
@media (prefers-reduced-motion: reduce){.weave,.dot,.ping,.pet-bob,.pet-shadow,.pet-eye,.pet-wave,.pet-say,.mpulse{animation:none}}'''

def page(title, w, h, body):
    props={"$preview":{"width":w,"height":h}}
    body=body.replace('/_blob/LOGO_ID', LOGO)
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
{FONT}
<style>
{CSS}
</style>
</helmet>
{body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{json.dumps(props)}'>
class Component extends DCLogic {{
  renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
'''

# ---- icons ----
def ico(name, size=20, active=False, color='currentColor', knock='#FFFFFF', sw=1.75):
    out=[]
    for kind,on,d in ICONS[name][1]:
        if kind=='body':
            out.append(f'<path d="{d}" fill="{color}" stroke="{color}" style="fill-opacity: {1 if active else 0.16}"></path>')
        elif kind=='line':
            out.append(f'<path d="{d}" fill="none" stroke="{knock if (active and on) else color}"></path>')
        else:
            out.append(f'<path d="{d}" fill="{knock if (active and on) else color}" stroke="none"></path>')
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" aria-hidden="true" '
            f'style="display: block; flex-shrink: 0; stroke-width: {sw}; stroke-linecap: round; stroke-linejoin: round">'+''.join(out)+'</svg>')
L={  # simple line glyphs for generic UI
 'search':'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20.5 20.5L16 16','clock':'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 7.5V12l3 2',
 'arrow':'M5 12h14M13 6l6 6-6 6','back':'M15 6l-6 6 6 6','chev':'M9 6l6 6-6 6','down':'M6 9l6 6 6-6','logout':'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10',
 'phone':'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z','camera':'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 10.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z',
 'plus':'M12 5v14M5 12h14','x':'M6 6l12 12M18 6L6 18','check':'M5 12.5l4.5 4.5L19 7.5','send':'M4 12l16-8-6 16-2-7z','clip':'M20 11l-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7',
 'filter':'M4 6h16M7 12h10M10 18h4','target':'M12 3v3M12 18v3M3 12h3M18 12h3M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10z','dots':'M5 12h.01M12 12h.01M19 12h.01',
 'edit':'M4 20h4L19 9l-4-4L4 16zM14 6l4 4','download':'M12 4v11M7 10l5 5 5-5M5 20h14','eye':'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
 'lock':'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V8a4 4 0 0 1 8 0v3','mail':'M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM3.5 7l8.5 6 8.5-6',
 'star':'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z','route':'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7',
 'wifi':'M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19h.01','sun':'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
 'bell':'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0','globe':'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18',
 'copy':'M9 9h10v11H9zM5 15V4h10',
 'layers':'M12 4l9 5-9 5-9-5zM3 14l9 5 9-5','minus':'M5 12h14','play':'M8 5l11 7-11 7z','pause':'M8 5v14M16 5v14',
 'ruler':'M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2','expand':'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
 'nav':'M12 3l7 18-7-4-7 4z','undo':'M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2','pen':'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
 'turnleft':'M17 20v-7a4 4 0 0 0-4-4H6M10 5L6 9l4 4','fit':'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5M9 12h6','key':'M15 4a5 5 0 1 1-4.5 7.2L4 18v2h3v-2h2v-2h2l1.2-1.2A5 5 0 0 1 15 4z','upload':'M12 20V9M7 14l5-5 5 5M5 4h14',
}
def svgl(name, size=18, sw=1.9, color='currentColor'):
    return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" aria-hidden="true" style="display: block; flex-shrink: 0; stroke-width: {sw}; stroke-linecap: round; stroke-linejoin: round"><path d="{L[name]}"></path></svg>'

# ---- brand band ----
def band(ndots=14, seed=1, dark=False, solid=None, fade=0):
    """solid=None: fills its box (panels, banners). solid=N: purple for N px, then eases into the page colour over `fade` px."""
    c0,c1 = ('#17143E','#221D5C') if dark else ('#4F48DC','#5B54E8')
    shade = 'rgba(23,20,62,0.6)' if dark else 'rgba(74,67,212,0.55)'
    total = (solid or 0) + fade
    dots=''.join(f'<span class="dot" style="position: absolute; left: {(i*37+11+seed*7)%100}%; top: {(i*53+5+seed*3)%(100 if solid is None else 92)}%; width: {(i%3)+2}px; height: {(i%3)+2}px; border-radius: 50%; background: rgba(255,255,255,0.7); animation-delay: {(i*0.41)%6:.2f}s"></span>' for i in range(ndots))
    if solid is None:
        base=f'linear-gradient(180deg, {c0} 0%, {c1} 100%)'
        shade_box='inset: 0'; mask=''
    else:
        pg = '#0F0D24' if dark else BG
        # eased blend: stays purple, softens through lavender, lands on the page colour
        base=(f'linear-gradient(180deg, {c0} 0px, {c1} {solid}px, '
              f'color-mix(in srgb, {c1} 82%, {pg}) {solid+fade*0.18:.0f}px, '
              f'color-mix(in srgb, {c1} 55%, {pg}) {solid+fade*0.42:.0f}px, '
              f'color-mix(in srgb, {c1} 26%, {pg}) {solid+fade*0.68:.0f}px, '
              f'color-mix(in srgb, {c1} 8%, {pg}) {solid+fade*0.88:.0f}px, {pg} {total}px)')
        shade_box=f'left: 0; right: 0; top: 0; height: {solid}px'
        mask=f'-webkit-mask-image: linear-gradient(180deg, #000 {solid}px, transparent {total}px); mask-image: linear-gradient(180deg, #000 {solid}px, transparent {total}px);'
    sh = f'<div style="position: absolute; {shade_box}; background: linear-gradient(180deg, rgba(0,0,0,0) 40%, {shade} 100%)"></div>' if solid is None else f'<div style="position: absolute; {shade_box}; background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(74,67,212,0.25) 100%)"></div>'
    return f'''<div aria-hidden="true" style="position: absolute; inset: 0; overflow: hidden; background: {base}">
<div class="weave" style="position: absolute; inset: 0; opacity: {0.07 if dark else 0.11}; background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.9) 0 2px, transparent 2px 14px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.9) 0 2px, transparent 2px 14px); background-size: 56px 56px, 56px 56px; {mask}"></div>
{sh}<div style="position: absolute; inset: 0; {mask}">{dots}</div></div>'''

# ---- Tarsi, the assistant pet (an original tarsier, Bohol's big-eyed primate) ----
PET_BODY='#5B54E8'; PET_DARK='#4A43D4'; PET_FACE='#F3F1FE'; PET_EAR='#C7C3F8'; PET_BELLY='#DCD8FB'
def pet(size=64, state='idle', badge=False, anim=True, ground=True):
    a = anim
    ex,ey={'think':(1.8,-2.2)}.get(state,(0,0))
    if state=='sleep':
        eye=f'<path d="M22.5 40 Q30 46 37.5 40 M42.5 40 Q50 46 57.5 40" fill="none" stroke="{INK}" stroke-width="2.6" stroke-linecap="round"></path>'
    else:
        pr = 6.4 if state=='alert' else 5.2
        eye=''.join(f'<g class="{"pet-eye" if a else ""}"><circle cx="{cx}" cy="39" r="10" fill="#FFFFFF"></circle><circle cx="{cx}" cy="39" r="10" fill="none" stroke="{PET_DARK}" stroke-width="1.6"></circle><circle cx="{cx+ex*0.6}" cy="{39+ey*0.6}" r="7.6" fill="#8E88F2"></circle><circle cx="{cx+ex}" cy="{39+ey}" r="{pr}" fill="{INK}"></circle><circle cx="{cx+2.6+ex}" cy="{35.8+ey}" r="2.2" fill="#FFFFFF"></circle><circle cx="{cx-2.4+ex}" cy="{42+ey}" r="1" fill="#FFFFFF"></circle></g>' for cx in (30,50))
    mouth={'talk':f'<ellipse cx="40" cy="53" rx="3.2" ry="2.6" fill="{INK}"></ellipse><ellipse cx="40" cy="54.2" rx="1.9" ry="1.1" fill="#F59BB4"></ellipse>',
           'sleep':f'<path d="M37.5 53 Q40 54.2 42.5 53" fill="none" stroke="{INK}" stroke-width="1.6" stroke-linecap="round"></path>',
           'alert':f'<ellipse cx="40" cy="53" rx="2" ry="2.3" fill="{INK}"></ellipse>'}.get(state,f'<path d="M37 52 Q40 55 43 52" fill="none" stroke="{INK}" stroke-width="1.6" stroke-linecap="round"></path>')
    pads=lambda x,y: ''.join(f'<circle cx="{x+dx}" cy="{y}" r="1.7" fill="{PET_EAR}"></circle>' for dx in (-2.8,0,2.8))
    rhand = (f'<g class="{"pet-wave" if a else ""}"><path d="M52 63 L60 49" stroke="{PET_BODY}" stroke-width="6" stroke-linecap="round"></path><ellipse cx="61" cy="46" rx="5" ry="5.6" fill="{PET_DARK}"></ellipse>{pads(61,42)}</g>'
             if state=='wave' else f'<ellipse cx="53" cy="65" rx="4.6" ry="5" fill="{PET_DARK}"></ellipse>{pads(53,69)}')
    extra=''
    if state=='think':
        extra=f'<circle cx="73" cy="38" r="2" fill="{MUTED}"></circle><circle cx="78" cy="30" r="2.8" fill="{MUTED}"></circle>'
    if state=='sleep':
        extra=f'<text x="66" y="36" font-family="Sora, sans-serif" font-size="11" font-weight="800" fill="{MUTED}">z</text><text x="73" y="28" font-family="Sora, sans-serif" font-size="8" font-weight="800" fill="{MUTED}">z</text>'
    bd=f'<circle cx="68" cy="10" r="6" fill="{RED}" stroke="#FFFFFF" stroke-width="2.5"></circle>' if badge else ''
    sh=f'<ellipse class="{"pet-shadow" if a else ""}" cx="40" cy="82" rx="17" ry="2.6" fill="rgba(26,24,48,0.16)"></ellipse>' if ground else ''
    return f'''<svg width="{size}" height="{size*84//80}" viewBox="0 0 80 84" aria-hidden="true" style="display: block; overflow: visible">{sh}<g class="{"pet-bob" if a else ""}">
<path d="M55 73 C 70 76, 77 64, 73 50" fill="none" stroke="{PET_BODY}" stroke-width="2.4" stroke-linecap="round"></path><ellipse cx="72.6" cy="47" rx="3" ry="5" fill="{PET_DARK}" transform="rotate(-12 72.6 47)"></ellipse>
<ellipse cx="40" cy="65" rx="15" ry="12.5" fill="{PET_BODY}"></ellipse><ellipse cx="40" cy="67" rx="8.5" ry="7.5" fill="{PET_BELLY}"></ellipse>
<ellipse cx="31" cy="77.5" rx="7" ry="3.4" fill="{PET_DARK}"></ellipse><ellipse cx="49" cy="77.5" rx="7" ry="3.4" fill="{PET_DARK}"></ellipse>
<ellipse cx="14" cy="17" rx="9" ry="13" fill="{PET_BODY}" transform="rotate(-28 14 17)"></ellipse><ellipse cx="66" cy="17" rx="9" ry="13" fill="{PET_BODY}" transform="rotate(28 66 17)"></ellipse>
<ellipse cx="14.8" cy="18" rx="5" ry="8.5" fill="{PET_EAR}" transform="rotate(-28 14.8 18)"></ellipse><ellipse cx="65.2" cy="18" rx="5" ry="8.5" fill="{PET_EAR}" transform="rotate(28 65.2 18)"></ellipse>
<ellipse cx="40" cy="39" rx="27" ry="23" fill="{PET_BODY}"></ellipse><ellipse cx="40" cy="41.5" rx="23" ry="18.5" fill="{PET_FACE}"></ellipse>
{eye}<path d="M38.4 48.2 Q40 50 41.6 48.2 Z" fill="{PDD}"></path>{mouth}
<ellipse cx="20.5" cy="50" rx="3" ry="1.9" fill="#F59BB4" opacity="0.55"></ellipse><ellipse cx="59.5" cy="50" rx="3" ry="1.9" fill="#F59BB4" opacity="0.55"></ellipse>
<ellipse cx="27" cy="65" rx="4.6" ry="5" fill="{PET_DARK}"></ellipse>{pads(27,69)}{rhand}{extra}{bd}</g></svg>'''

def pet_float(bottom=84, right=10, say=None, state=None, size=64, badge=False):
    st = state or ('wave' if say else 'idle')
    bubble = f'<span class="pet-say" style="position: absolute; right: {size+4}px; bottom: {size-14}px; width: max-content; max-width: 200px; padding: 9px 12px; border-radius: 14px 14px 4px 14px; background: #FFFFFF; border: 1px solid {LINE}; box-shadow: 0 10px 24px -14px rgba(26,24,48,0.45); font-size: 13px; line-height: 1.4; color: {INK}">{say}</span>' if say else ''
    return f'<div style="position: absolute; right: {right}px; bottom: {bottom}px; z-index: 6">{bubble}<button type="button" aria-label="Ask Tarsi, the barangay assistant" style="all: unset; display: block; cursor: pointer; filter: drop-shadow(0 6px 10px rgba(26,24,48,0.18))">{pet(size, st, badge)}</button></div>'

# ---- primitives ----
def btn(label, kind='secondary', icon=None, small=False, full=False, large=False):
    h=34 if small else (52 if large else 40)
    st={'primary':f'background: {PD}; color: #FFFFFF; border: 1px solid {PD};',
        'danger':f'background: {RED}; color: #FFFFFF; border: 1px solid {RED};',
        'secondary':f'background: #FFFFFF; color: {INK}; border: 1px solid {LINE};',
        'ghost':f'background: transparent; color: {PD}; border: 1px solid transparent;',
        'onband':'background: rgba(20,17,80,0.28); color: #FFFFFF; border: 1px solid transparent;',
        'white':f'background: #FFFFFF; color: {PD}; border: 1px solid #FFFFFF;'}[kind]
    ic=f'<span style="display: flex">{icon}</span>' if icon else ''
    w='width: 100%; justify-content: center;' if full else ''
    return f'<button type="button" style="all: unset; box-sizing: border-box; height: {h}px; padding: 0 {12 if small else 16}px; border-radius: {12 if large else 10}px; display: inline-flex; align-items: center; gap: 8px; font-size: {15 if large else 13}px; font-weight: 700; cursor: pointer; white-space: nowrap; {w} {st}">{ic}{label}</button>'
def iconbtn(icon, label, kind='onband', size=40):
    st={'onband':'background: rgba(20,17,80,0.28); color: #FFFFFF;','plain':f'background: #FFFFFF; color: {INK}; border: 1px solid {LINE};'}[kind]
    return f'<button type="button" aria-label="{label}" style="all: unset; box-sizing: border-box; width: {size}px; height: {size}px; border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; {st}">{icon}</button>'
def tag(text, tone='quiet'):
    fg,bg=TONES[tone]
    return f'<span style="justify-self: start; display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 6px; background: {bg}; color: {fg}; font-size: 12px; font-weight: 700; white-space: nowrap">{text}</span>'
def status(text, tone='quiet'):
    fg,_=TONES[tone]
    return f'<span style="justify-self: start; min-width: 0; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: {fg}; white-space: nowrap"><span style="width: 7px; height: 7px; border-radius: 50%; background: {fg}"></span>{text}</span>'
def card(inner, pad='0', extra=''):
    return f'<section style="background: #FFFFFF; border: 1px solid {LINE}; border-radius: 14px; overflow: hidden; padding: {pad}; {extra}">{inner}</section>'
def card_head(title, right='', sub=None):
    s=f'<p style="margin: 2px 0 0; font-size: 12px; color: {MUTED}">{sub}</p>' if sub else ''
    return f'<div style="display: flex; align-items: center; gap: 10px; padding: 14px 18px"><div style="flex: 1; min-width: 0"><h2 style="margin: 0; font-size: 15px; font-weight: 800; color: {INK}">{title}</h2>{s}</div>{right}</div>'
def row(inner, first=False, pad='12px 18px', extra=''):
    return f'<div style="padding: {pad}; {"" if first else "border-top: 1px solid "+LINE+";"} {extra}">{inner}</div>'
def label(text):
    return f'<p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: {MUTED}">{text}</p>'
def field(lab, value='', placeholder='', icon=None, kind='text', area=False, h=None):
    ic=f'<span style="color: {MUTED}; display: flex">{icon}</span>' if icon else ''
    val=f'value="{value}"' if value else ''
    if area:
        ctl=f'<textarea aria-label="{lab}" placeholder="{placeholder}" style="all: unset; flex: 1; font-size: 14px; line-height: 1.55; color: {INK}; min-height: {h or 88}px; white-space: pre-wrap">{value}</textarea>'
        box=f'display: flex; gap: 10px; padding: 12px 14px;'
    else:
        ctl=f'<input type="{kind}" aria-label="{lab}" {val} placeholder="{placeholder}" style="all: unset; flex: 1; min-width: 0; font-size: 14px; color: {INK}">'
        box=f'display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 14px;'
    return f'<label style="display: block"><span style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 700; color: {INK}">{lab}</span><span style="{box} box-sizing: border-box; border-radius: 10px; background: #FFFFFF; border: 1px solid {LINE}">{ic}{ctl}</span></label>'
def segmented(items, active=0, onband=False):
    if onband:
        return '<div style="display: flex; gap: 4px; padding: 4px; border-radius: 12px; background: rgba(20,17,80,0.28)">'+''.join(f'<button type="button" style="all: unset; flex: 1; text-align: center; height: 34px; line-height: 34px; border-radius: 9px; font-size: 13px; font-weight: 700; cursor: pointer; {"background: #FFFFFF; color: "+PD if i==active else "color: rgba(255,255,255,0.9)"}">{t}</button>' for i,t in enumerate(items))+'</div>'
    return f'<div style="display: inline-flex; gap: 4px; padding: 4px; border-radius: 12px; background: #EFEEF5">'+''.join(f'<button type="button" style="all: unset; padding: 0 14px; height: 32px; line-height: 32px; border-radius: 9px; font-size: 13px; font-weight: 700; cursor: pointer; {"background: #FFFFFF; color: "+INK+"; box-shadow: 0 1px 2px rgba(26,24,48,0.1)" if i==active else "color: "+MUTED}">{t}</button>' for i,t in enumerate(items))+'</div>'
def avatar(ini, size=32, bg=SOFT, fg=PD, radius=8):
    return f'<span style="width: {size}px; height: {size}px; border-radius: {radius}px; background: {bg}; color: {fg}; font-size: {int(size*0.4)}px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0">{ini}</span>'
def progress(n, total=4, color=GREEN):
    return '<div style="display: flex; gap: 4px">'+''.join(f'<span style="flex: 1; height: 4px; border-radius: 2px; background: {color if i<n else LINE}"></span>' for i in range(total))+'</div>'
def flat_map(h=200, pins=None, dark=False, route=True):
    bg='#1F1B4D' if dark else '#F1F0F7'; blk='rgba(255,255,255,0.05)' if dark else '#E6E4EF'; road='rgba(255,255,255,0.12)' if dark else '#FFFFFF'; water='rgba(96,165,250,0.25)' if dark else '#D6E3F6'
    pins = pins if pins is not None else [(120,150,RED,9),(270,40,PD,7),(60,40,AMBER,7),(235,100,GREEN,6)]
    blocks=''.join(f'<rect x="{x}" y="{y}" width="{w}" height="{hh}" rx="3" fill="{blk}"></rect>' for x,y,w,hh in [(10,10,100,52),(124,10,96,52),(234,10,116,52),(10,76,64,56),(88,76,132,56),(234,76,116,56),(10,146,150,44),(174,146,176,44)])
    ph=''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" stroke="#FFFFFF" stroke-width="3"></circle>' for x,y,c,r in pins)
    rt=f'<path d="M235 100 L268 44" stroke="{GREEN}" stroke-width="2" stroke-dasharray="4 4"></path>' if route else ''
    return f'''<svg width="100%" height="{h}" viewBox="0 0 360 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="display: block"><rect width="360" height="200" fill="{bg}"></rect>{blocks}
<path d="M-10 170 C 70 140, 130 190, 210 160 S 320 130, 380 150" fill="none" stroke="{water}" stroke-width="12"></path>
<path d="M0 69 H360 M0 139 H360 M117 0 V200 M227 0 V200" fill="none" stroke="{road}" stroke-width="6"></path>{rt}{ph}</svg>'''

# ---- shells ----
OFFICIAL_NAV=[('MAIN',[('dashboard','Dashboard'),('incidents','Incidents'),('announcements','Announcements')]),
              ('MANAGE',[('tickets','Tickets','2'),('documents','Documents'),('verifications','Verifications','2'),('blotter','Blotter / Lupon','1'),('tanods','Tanods'),('users','Users')]),
              ('TOOLS',[('map','Incident map'),('calendar','Calendar'),('analytics','Analytics')])]
ADMIN_NAV=[('PLATFORM',[('verifications','Applications','3'),('incidents','All incidents'),('users','Invite codes'),('dashboard','Barangays'),('resident','Users')])]
def sidebar(active, nav=OFFICIAL_NAV, who=('A','Aljho Balongcas','Barangay Official','#F97316'), place='Don Andres Soriano'):
    nh=''
    for g,items in nav:
        nh+=f'<p style="margin: 14px 10px 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: {MUTED}">{g}</p>'
        for it in items:
            n,l=it[0],it[1]; c=it[2] if len(it)>2 else None
            a = l==active
            st=f'background: {SOFT}; color: {PD};' if a else f'color: {BODY};'
            cnt=f'<span style="margin-left: auto; font-size: 12px; font-weight: 700; color: {RED if n=="blotter" else MUTED}; font-variant-numeric: tabular-nums">{c}</span>' if c else ''
            nh+=f'<a href="#" style="display: flex; align-items: center; gap: 11px; height: 36px; padding: 0 10px; border-radius: 8px; {st}">{ico(n,18,a,"currentColor","#FFFFFF")}<span style="font-size: 14px; font-weight: {700 if a else 500}">{l}</span>{cnt}</a>'
    ini,name,role,col=who
    return f'''<aside style="width: 232px; flex-shrink: 0; box-sizing: border-box; background: #FFFFFF; border-right: 1px solid {LINE}; padding: 16px 12px; display: flex; flex-direction: column">
<div style="display: flex; align-items: center; gap: 10px; padding: 2px 6px 8px"><img src="/_blob/LOGO_ID" alt="BarangayHub 360" style="width: 32px; height: 32px; object-fit: contain">
<div><p style="margin: 0; font-size: 14px; font-weight: 800; color: {INK}">BarangayHub 360</p><p style="margin: 0; font-size: 12px; color: {MUTED}">{place}</p></div></div>
<nav aria-label="Main" style="flex: 1">{nh}</nav>
<div style="display: flex; align-items: center; gap: 10px; padding: 10px 6px 0; border-top: 1px solid {LINE}">{avatar(ini,32,col,'#FFFFFF')}
<div style="flex: 1; min-width: 0"><p style="margin: 0; font-size: 13px; font-weight: 700; color: {INK}">{name}</p><p style="margin: 0; font-size: 12px; color: {MUTED}">{role}</p></div>
<button type="button" aria-label="Sign out" style="all: unset; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; color: {MUTED}; cursor: pointer">{svgl('logout',16)}</button></div></aside>'''

def desktop(title, eyebrow, heading, sub, actions, content, active, band_h=196, nav=OFFICIAL_NAV, who=None, place='Don Andres Soriano', w=1440, h=900, search='Search reports, residents…', pet=None, overlay=''):
    show = pet if pet is not None else (nav is OFFICIAL_NAV)
    pf = pet_float(22, 26) if show else ''
    who = who or ('A','Aljho Balongcas','Barangay Official','#F97316')
    top=f'''<div style="display: flex; align-items: center; gap: 10px">
<p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.85)">{place}{', City of Toledo' if place=='Don Andres Soriano' else ''} · updated 7:46 PM</p>
<label style="margin-left: auto; display: flex; align-items: center; gap: 10px; width: 300px; height: 38px; padding: 0 12px; box-sizing: border-box; border-radius: 10px; background: rgba(20,17,80,0.28); color: rgba(255,255,255,0.85); font-size: 13px">{svgl('search',16)}<span style="flex: 1">{search}</span><kbd style="font-family: ui-monospace, monospace; font-size: 11px; color: rgba(255,255,255,0.8)">Ctrl K</kbd><input type="search" aria-label="Search" style="width: 1px; opacity: 0; border: 0; padding: 0"></label>
<button type="button" aria-label="Notifications, 3 unread" style="all: unset; position: relative; width: 38px; height: 38px; box-sizing: border-box; border-radius: 10px; background: rgba(20,17,80,0.28); color: #FFFFFF; display: flex; align-items: center; justify-content: center; cursor: pointer">{svgl('bell',18)}<span style="position: absolute; top: 7px; right: 7px; width: 8px; height: 8px; border-radius: 50%; background: #FB7185"></span></button></div>'''
    head=f'''<div style="display: flex; align-items: flex-end; gap: 16px"><div style="flex: 1; min-width: 0">
<p style="margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; color: rgba(255,255,255,0.75)">{eyebrow}</p>
<h1 style="margin: 6px 0 0; font-size: 28px; font-weight: 800; letter-spacing: -0.7px; color: #FFFFFF">{heading}</h1>
{f'<p style="margin: 6px 0 0; font-size: 14px; color: rgba(255,255,255,0.88)">{sub}</p>' if sub else ''}</div>
<div style="display: flex; gap: 8px">{actions}</div></div>'''
    return page(title, w, h, f'''<div style="width: {w}px; height: {h}px; box-sizing: border-box; display: flex; font-family: Sora, system-ui, sans-serif; background: {BG}; overflow: hidden">
{sidebar(active, nav, who, place)}
<div style="flex: 1; min-width: 0; position: relative">
<div style="position: absolute; left: 0; right: 0; top: 0; height: {band_h+120}px">{band(14,2,solid=band_h,fade=120)}</div>
<div style="position: relative; z-index: 1; padding: 18px 28px; display: flex; flex-direction: column; gap: 20px">
{top}
{head}
{content}
</div>{pf}{overlay}</div></div>''')

FADE_PH=84
RES_TABS=[('home','Home'),('incidents','Reports'),(None,None),('documents','Docs'),('resident','Me')]
TANOD_TABS=[('home','Duty'),('incidents','Assigned'),('map','Map'),('performance','Stats')]
def tabbar(active, tabs=RES_TABS, center=True):
    tb=''
    for n,l in tabs:
        if n is None:
            tb+=f'<a href="#" style="flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 3px; margin-top: -22px"><span style="width: 54px; height: 54px; border-radius: 50%; background: {RED}; color: #FFFFFF; display: flex; align-items: center; justify-content: center; border: 4px solid #FFFFFF; box-shadow: 0 6px 14px -6px rgba(217,45,75,0.7)">{ico("incidents",24,True,"#FFFFFF",RED)}</span><span style="font-size: 11px; font-weight: 800; color: {RED}">Report</span></a>'
        else:
            a=l==active
            tb+=f'<a href="#" style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 0; color: {PD if a else MUTED}">{ico(n,22,a,"currentColor","#FFFFFF")}<span style="font-size: 11px; font-weight: {800 if a else 600}">{l}</span></a>'
    return f'<nav aria-label="Main" style="display: flex; align-items: flex-start; padding: 6px 8px 16px; background: #FFFFFF; border-top: 1px solid {LINE}; position: relative; z-index: 3">{tb}</nav>'

def phone(title, header, content, tab=None, tabs=RES_TABS, band_h=200, scroll_pad='0', footer='', bg=BG, pet=None, say=None, overlay=''):
    tb = tabbar(tab, tabs) if tab else ''
    show = pet if pet is not None else (bool(tab) and tabs is RES_TABS)
    pf = pet_float(84 if tb else 96, say=say) if show else ''
    return page(title, 390, 844, f'''<div style="width: 390px; height: 844px; box-sizing: border-box; position: relative; overflow: hidden; font-family: Sora, system-ui, sans-serif; background: {bg}; display: flex; flex-direction: column">
<div style="position: absolute; left: 0; right: 0; top: 0; height: {band_h+FADE_PH}px">{band(12,5,solid=band_h,fade=FADE_PH)}</div>
<div style="position: relative; z-index: 1; padding: 16px 16px {scroll_pad}; display: flex; flex-direction: column; gap: 14px; flex: 1; min-height: 0; overflow: hidden">
{header}
{content}
</div>{footer}{tb}{pf}{overlay}</div>''')

def phone_top(title, back=True, right='', sub=None):
    b = iconbtn(svgl('back',18),'Back') if back else f'<img src="/_blob/LOGO_ID" alt="BarangayHub 360" style="width: 30px; height: 30px; object-fit: contain">'
    s=f'<p style="margin: 2px 0 0; font-size: 12px; color: rgba(255,255,255,0.8)">{sub}</p>' if sub else ''
    return f'<div style="display: flex; align-items: center; gap: 10px">{b}<div style="flex: 1; min-width: 0"><p style="margin: 0; font-size: 17px; font-weight: 800; color: #FFFFFF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{title}</p>{s}</div>{right}</div>'
