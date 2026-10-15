"""One-time asset authoring. Never called by the build; outputs are committed."""
import json, math, pathlib, subprocess, colorsys
ROOT=pathlib.Path(__file__).resolve().parents[1]
TMP=pathlib.Path('/tmp/facet-author'); TMP.mkdir(exist_ok=True)
OUT=ROOT/'public/assets'
def run(tool,*args):
 subprocess.run([tool,*map(str,args)],check=True,stdout=subprocess.DEVNULL)
def write(p,data):
 p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(data))
def color(h,s,v,a=255):
 r,g,b=colorsys.hsv_to_rgb(h,s,v); return '#%02x%02x%02x%02x'%(int(r*255),int(g*255),int(b*255),a)
def line(a,b,c): return {'op':'line','x0':round(a[0]),'y0':round(a[1]),'x1':round(b[0]),'y1':round(b[1]),'color':c}
def poly(pts,c):
 ops=[]
 for y in range(math.ceil(min(p[1] for p in pts)), math.floor(max(p[1] for p in pts))+1):
  xs=[]
  for a,b in zip(pts,pts[1:]+pts[:1]):
   if (a[1]<=y<b[1]) or (b[1]<=y<a[1]): xs.append(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]))
  if len(xs)>1: ops.append(line((math.ceil(min(xs)),y),(math.floor(max(xs)),y),c))
 return ops
def render(ops,path,w=64,h=64,sheet=False):
 log=TMP/'ops.json'; write(log,ops); path.parent.mkdir(parents=True,exist_ok=True)
 run('draw-sheet' if sheet else 'draw','render','--actions',log,'--out',path,'--width',w,'--height',h,'--no-layers')
names=['ruby','amber','citrine','jade','beryl','sapphire','amethyst','prism']
hues=[.98,.065,.145,.39,.49,.62,.77,0]
shapes=[[(32,4),(52,17),(56,38),(32,59),(8,38),(12,17)],[(18,7),(46,7),(59,32),(46,56),(18,56),(5,32)],[(32,3),(58,32),(32,61),(6,32)],[(16,8),(48,8),(55,17),(55,47),(48,56),(16,56),(9,47),(9,17)],[(32,3),(52,16),(58,34),(45,54),(19,54),(6,34),(12,16)],[(18,6),(46,6),(58,23),(51,49),(32,59),(13,49),(6,23)],[(32,3),(55,18),(55,45),(32,60),(9,45),(9,18)],[(32,2),(57,18),(57,46),(32,61),(7,46),(7,18)]]
def gem(k,strain=0,turn=0):
 pts=shapes[k]; cx=32;cy=31
 if turn: pts=[(32+(x-32)*(.77+.23*math.cos(turn)),y) for x,y in pts]
 h=hues[k]; ops=poly(pts,color(h,.8,.24)); inner=[(32+(x-32)*.67,31+(y-31)*.67) for x,y in pts]
 for i,(a,b) in enumerate(zip(pts,pts[1:]+pts[:1])):
  hue=(i/len(pts)+turn*.08)%1 if k==7 else h
  ops+=poly([a,b,inner[(i+1)%len(pts)],inner[i]],color(hue,.45 if k==7 else .7,[.97,.65,.38,.46,.73,.91,.6,.8][i%8]))
 ops+=poly(inner,color(h,.25 if k==7 else .67,.8))
 # asymmetric internal facets, with a deep pavilion and a polished table
 center=(29,29)
 for i in range(len(inner)):
  hue=(i/len(inner)+.1)%1 if k==7 else h
  ops+=poly([inner[i],inner[(i+1)%len(inner)],center],color(hue,.33 if k==7 else .6,[.95,.77,.5,.62,.84,.99,.7,.8][i%8]))
 for i in range(len(pts)):
  ops.append(line(pts[i],pts[(i+1)%len(pts)],color(h,.36,.98 if i<2 or i==len(pts)-1 else .36)))
  ops.append(line(pts[i],inner[i],color(h,.35,.95,150)))
 ops += [line((21,17),(30,13),'#ffffffc0'),line((20,18),(26,16),'#ffffff90')]
 cracks=[[(35,7),(30,23),(37,31),(26,45)],[(12,28),(25,27),(37,31),(45,45),(51,49)],[(30,23),(20,36),(23,52)],[(37,31),(48,24),(52,16)]]
 for crack in cracks[:strain+ (1 if strain==3 else 0)]:
  for a,b in zip(crack,crack[1:]):
   ops.append(line((a[0]+1,a[1]),(b[0]+1,b[1]),'#edfff4ff' if strain==3 else '#d1e8e0dd'));ops.append(line(a,b,'#07151fff'))
 if strain==3:
  ops+=poly([(26,45),(30,43),(28,51)],'#091820ff')
  ops.append(line((16,57),(48,57),'#fff1caff'))
 return ops
for k,name in enumerate(names):
 for s in range(4): render(gem(k,s),OUT/f'gems/{name}-{s}.png')
 if k<7:
  # authored triangular shards accelerate outward, fading into fine fragments
  for f in range(6):
   ops=[]
   for j in range(8):
    ang=j*math.pi/4+.2; d=f*f*1.1; x=32+math.cos(ang)*d; y=32+math.sin(ang)*d+f*1.5
    r=max(1,12-f*1.5);pts=[(x+math.cos(ang+t)*r,y+math.sin(ang+t)*r) for t in [0,2.3,4.1]]
    ops+=poly(pts,color(hues[k],.65,.95 if j%2 else .6,max(20,255-f*36)))
    ops.append(line(pts[0],pts[1],color(hues[k],.15,1,max(20,255-f*38))))
   render(ops,OUT/f'gems/break/{name}/{f}.png',sheet=True)
for f in range(8): render(gem(7,0,f*math.pi/4),OUT/f'gems/prism-turn/{f}.png',sheet=True)
# fine gilt brilliant halo and four-point star inlay
for name in ['brilliant','star']:
 ops=[]
 if name=='brilliant':
  pts=[(32+27*math.cos(i*math.pi/4),32+27*math.sin(i*math.pi/4)) for i in range(8)]
  for a,b in zip(pts,pts[1:]+pts[:1]):ops.append(line(a,b,'#fff4bcff'))
  for x,y in pts: ops+=poly([(x,y-2),(x+2,y),(x,y+2),(x-2,y)],'#fff8d8ff')
 else:
  ops+=poly([(32,5),(37,26),(57,32),(37,38),(32,59),(27,38),(7,32),(27,26)],'#fff3c8ff')
  ops+=poly([(32,16),(34,29),(47,32),(34,35),(32,48),(30,35),(17,32),(30,29)],'#695b8aff')
 render(ops,OUT/f'gems/{name}.png')
# board surround: recessed stone wells, brass rulers, and engraved corner mounts
ops=[]
def rect(x,y,w,h,c):return {'op':'fill_rect','x':x,'y':y,'width':w,'height':h,'color':c}
ops+=[rect(0,0,608,608,'#07151dff'),rect(4,4,600,600,'#9c8254ff'),rect(6,6,596,596,'#1d343eff'),rect(13,13,582,582,'#071921ff')]
for r in range(8):
 for c in range(8):
  x=16+c*72;y=16+r*72
  ops+=[rect(x,y,72,72,'#0b202aff' if (r+c)%2 else '#0d242eff'),line((x,y),(x+71,y),'#233b43ff'),line((x,y),(x,y+71),'#1a333dff')]
for x in [2,590]:
 for y in [2,590]:
  ops +=[rect(x,y,16,16,'#baa271ff'),rect(x+3,y+3,10,10,'#162e38ff'),line((x+4,y+8),(x+12,y+8),'#d5bc83ff')]
render(ops,OUT/'gems/board.png',608,608)
# Particle systems authored by the supplied tool.
for name,count,speed,size,col in [('clear',12,65,2,'#b9efe8'),('flaw',28,110,3,'#ffe6a1'),('cut',22,85,3,'#f8e9be'),('aura',0,9,1.5,'#b9dcf2')]:
 cfg=TMP/f'{name}.json';write(cfg,{'width':128,'height':128,'duration_ms':1200,'fps':30,'seed':42,'actions':str(TMP/f'{name}-ops.json'),'preview':str(TMP/f'{name}.gif'),'system':str(OUT/f'fx/{name}/system.json')})
 run('particle-2d','--config',cfg,'init')
 run('particle-2d','--config',cfg,'add-emitter','--name','sparks','--shape','disc','--radius',22 if name=='aura' else 3,'--x',0,'--y',0,'--rate' if name=='aura' else '--burst',10 if name=='aura' else count,'--lifetime',650,'--speed',speed,'--speed-spread',5,'--cone-angle',180)
 run('particle-2d','--config',cfg,'set-particle','--emitter','sparks','--size-from',size,'--size-to',0,'--opacity-from',.8,'--opacity-to',0,'--color-gradient',col+'@0,#ffffff@0.3,'+col+'@1')
 if name=='aura':run('particle-2d','--config',cfg,'set-timeline','--loop','true')
 run('particle-2d','--config',cfg,'render','--frame',8,'--out',TMP/f'{name}.png')
# Sculpted crystalline cues, one common timbre for the ascending ladder.
def audio_cfg(name,duration=1200,bank=False):
 cfg=TMP/f'audio-{name}.json';write(cfg,{'sample_rate':22050,'channels':'stereo','max_duration_ms':duration,'seed':43,'actions':str(TMP/f'audio-{name}-ops.json'),'preview':str(TMP/f'audio-{name}.png'),'wav':str(OUT/f'audio/{name}.wav'),'mid':str(OUT/f'audio/{name}.mid'),**({'instrument_bank':'gm-lite'} if bank else {})});return cfg
for name,freq,dur in [('select',880,90),('swap',530,160),('refuse',130,170),('land',90,200),('flaw',1900,110),('cut',1400,460),('levelup',660,800),('gameover',440,850)]+[(f'ladder-{i+1}',440*2**(i/12*2),400) for i in range(8)]:
 cfg=audio_cfg(name);run('sfx-synth','--config',cfg,'init')
 for n,m,g in [('body',1,-16),('overtone',2.76,-25)]:
  run('sfx-synth','--config',cfg,'add-voice','--name',n,'--wave','sine','--freq',freq*m,'--dur',dur,'--gain',g)
  run('sfx-synth','--config',cfg,'set-envelope','--voice',n,'--env','pluck')
 if name in ['swap','land','refuse','gameover','levelup']:
  run('sfx-synth','--config',cfg,'set-pitch','--voice','body','--slide-to',freq*(2 if name=='levelup' else .4),'--over',dur)
 if name in ['select','swap','refuse','land','flaw']:
  run('sfx-synth','--config',cfg,'add-voice','--name','contact','--wave','noise','--dur',45 if name!='land' else 100,'--gain',-18 if name=='flaw' else -27)
  run('sfx-synth','--config',cfg,'set-envelope','--voice','contact','--env','pluck')
  run('sfx-synth','--config',cfg,'add-filter','--voice','contact','--type','bandpass','--cutoff',3200 if name=='flaw' else 650,'--resonance',.8)
 if name=='cut' or name.startswith('ladder-'):
  run('sfx-synth','--config',cfg,'add-fm','--voice','body','--modulator',2.76,'--index',.8)
  run('sfx-synth','--config',cfg,'add-reverb','--size',.25,'--mix',.13)
 if name=='levelup':
  for j,pitch in enumerate([880,1108,1320]):
   run('sfx-synth','--config',cfg,'add-voice','--name',f'chime{j}','--wave','sine','--freq',pitch,'--start',90+j*120,'--dur',380,'--gain',-18)
   run('sfx-synth','--config',cfg,'set-envelope','--voice',f'chime{j}','--env','pluck')
 run('sfx-synth','--config',cfg,'render')
cfg=audio_cfg('shatter');run('sfx-sample','--config',cfg,'init')
run('sfx-sample','--config',cfg,'add-sample','--name','debris_glass','--t',0,'--gain',-17,'--fade-out',180)
run('sfx-sample','--config',cfg,'add-sample','--name','impact_metal_dry','--t',0,'--gain',-28,'--trim','0,160','--fade-out',80)
run('sfx-sample','--config',cfg,'render')
# music: eight-bar glass ostinato with a slower marimba foundation
for name,bpm in [('title',100),('play',76)]:
 cfg=audio_cfg(name,26000,True);run('music','--config',cfg,'init');run('music','--config',cfg,'set-tempo','--bpm',bpm)
 for track,instr in [('glass','music_box'),('bass','marimba')]:run('music','--config',cfg,'define-track','--name',track,'--instrument',instr)
 notes=[72,79,76,83,79,76,74,71,69,76,72,79,76,72,71,67]
 for i in range(64):run('music','--config',cfg,'add-note','--track','glass','--pitch',notes[i%16],'--t',i*.5,'--dur',.45,'--velocity',48 if name=='play' else 66)
 for i,n in enumerate([48,48,45,45,53,53,43,43]):
  for j in range(4):run('music','--config',cfg,'add-note','--track','bass','--pitch',n+(12 if j%2 else 0),'--t',i*4+j,'--dur',.8,'--velocity',50)
 run('music','--config',cfg,'set-track-fx','--track','glass','--gain',-5 if name=='play' else -2,'--pan',.2,'--reverb',.2)
 run('music','--config',cfg,'set-track-fx','--track','bass','--gain',-3,'--pan',-.15,'--reverb',.1)
 run('music','--config',cfg,'render')
