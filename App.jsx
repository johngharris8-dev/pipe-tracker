import React, { useState, useRef, useEffect } from "react";

const C={bg:"#0a0e14",surface:"#111720",card:"#161e2a",border:"#1e2d3d",accent:"#00c9a7",warn:"#f59e0b",danger:"#ef4444",ok:"#22c55e",text:"#e2e8f0",muted:"#64748b",dim:"#94a3b8"};
const F={mono:"'JetBrains Mono','Courier New',monospace",sans:"'DM Sans',sans-serif",display:"'Barlow Condensed',sans-serif"};

// -- Constants ----------------------------------------------------------------
const SDR_RATIO={"SDR 6":6,"SDR 7.3":7.3,"SDR 9":9,"SDR 11":11,"SDR 13.5":13.5,"SDR 17":17,"SDR 21":21,"SDR 26":26,"SDR 32.5":32.5,"SDR 41":41};
const SDR_P={"SDR 6":"High","SDR 7.3":"High","SDR 9":"High","SDR 11":"Med-high","SDR 13.5":"Med","SDR 17":"Med","SDR 21":"Med-low","SDR 26":"Low","SDR 32.5":"Low","SDR 41":"Very low"};
const SDR_OPTIONS=Object.keys(SDR_RATIO);
const LINING=["Rubber","Ceramic Tiles"];
const CLOCK=["12 oclock","3 oclock","6 oclock","9 oclock"];

const DN_SIZES=[
  {label:"DN 15",od:21.3},{label:"DN 20",od:26.9},{label:"DN 25",od:33.7},{label:"DN 32",od:42.4},
  {label:"DN 40",od:48.3},{label:"DN 50",od:60.3},{label:"DN 65",od:76.1},{label:"DN 80",od:88.9},
  {label:"DN 100",od:114.3},{label:"DN 125",od:139.7},{label:"DN 150",od:168.3},{label:"DN 200",od:219.1},
  {label:"DN 250",od:273.0},{label:"DN 300",od:323.9},{label:"DN 350",od:355.6},{label:"DN 400",od:406.4},
  {label:"DN 450",od:457.0},{label:"DN 500",od:508.0},{label:"DN 600",od:610.0},{label:"DN 700",od:711.0},
  {label:"DN 800",od:813.0},{label:"DN 900",od:914.0},{label:"DN 1000",od:1016.0},
];
const NPS_SIZES=[
  {label:"NPS 1/2",od:0.840},{label:"NPS 3/4",od:1.050},{label:"NPS 1",od:1.315},{label:"NPS 1-1/4",od:1.660},
  {label:"NPS 1-1/2",od:1.900},{label:"NPS 2",od:2.375},{label:"NPS 2-1/2",od:2.875},{label:"NPS 3",od:3.500},
  {label:"NPS 4",od:4.500},{label:"NPS 5",od:5.563},{label:"NPS 6",od:6.625},{label:"NPS 8",od:8.625},
  {label:"NPS 10",od:10.75},{label:"NPS 12",od:12.75},{label:"NPS 14",od:14.00},{label:"NPS 16",od:16.00},
  {label:"NPS 18",od:18.00},{label:"NPS 20",od:20.00},{label:"NPS 24",od:24.00},{label:"NPS 30",od:30.00},
];
const HDPE_OD=[20,25,32,40,50,63,75,90,110,125,140,160,180,200,225,250,280,315,355,400,450,500,560,630,710,800,900,1000,1200];

// -- Helpers ------------------------------------------------------------------
function getSteelOpts(unit){return unit==="mm"?DN_SIZES:NPS_SIZES;}
function calcWall(sdr,od){return(!sdr||!od)?"":( od/SDR_RATIO[sdr]).toFixed(1);}
function uid(){return Date.now()+Math.random();}
function today(){return new Date().toISOString().split("T")[0];}
function getMin(v){return v.length?Math.min(...v):null;}
function getAvg(v){return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;}
function getLoss(nom,min){return nom>0&&min!=null?((nom-min)/nom)*100:0;}
function allVals(spots){return(spots||[]).flatMap(s=>(s.readings||[]).filter(r=>r.value!=null).map(r=>r.value));}
function getStatus(nom,spots){
  const v=allVals(spots);if(!v.length)return"ok";
  const l=getLoss(nom,getMin(v));return l>=30?"critical":l>=15?"warning":"ok";
}
// Circumferential angle in radians: 12oclock=-PI/2, 3oclock=0, 6oclock=PI/2, 9oclock=PI
function circumAngle(label){
  const m={"12 oclock":-Math.PI/2,"Top":-Math.PI/2,"3 oclock":0,"6 oclock":Math.PI/2,"Bottom":Math.PI/2,"9 oclock":Math.PI};
  return m[label]!==undefined?m[label]:0;
}
// Axial 0-1 fraction along pipe
function axialFrac(axialLabel,weldRegistry){
  if(axialLabel==="Inlet stub")return 0.08;
  if(axialLabel==="Outlet stub")return 0.92;
  if(weldRegistry&&weldRegistry[axialLabel]!==undefined)return weldRegistry[axialLabel];
  return 0.5;
}
// Metres <-> fraction helpers (display only clamped, stored exact)
function mToFrac(m,L){if(!L)return 0.5;return Math.max(0.05,Math.min(0.95,parseFloat(m)/L));}
function mToFracExact(m,L){if(!L)return 0.5;return parseFloat(m)/L;}
function fracToM(f,L){return L?(f*L).toFixed(2):"--";}
function sortWelds(welds){return [...welds].sort((a,b)=>(a.metres||0)-(b.metres||0)).map((w,i)=>({...w,label:"Weld "+(i+1)}));}

// -- QR Code ------------------------------------------------------------------
function makeQRMatrix(text,size=21){
  let hash=0;for(let i=0;i<text.length;i++){hash=(hash*31+text.charCodeAt(i))>>>0;}
  const mat=[];
  for(let r=0;r<size;r++){mat[r]=[];for(let cc=0;cc<size;cc++){
    const inF=(r<7&&cc<7)||(r<7&&cc>=size-7)||(r>=size-7&&cc<7);
    if(inF){const fr=r<7?r:r-(size-7),fc=cc<7?cc:cc-(size-7);mat[r][cc]=(fr===0||fr===6||fc===0||fc===6||( fr>=2&&fr<=4&&fc>=2&&fc<=4))?1:0;}
    else{mat[r][cc]=((hash^(r*size+cc)*2654435761)>>>0)%2;}
  }}return mat;
}
function QRCode({value,size=120}){
  const mat=makeQRMatrix(value);const n=mat.length;const cell=size/n;
  return(<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{background:"#fff",borderRadius:4}}>
    <rect width={size} height={size} fill="#fff"/>
    {mat.map((row,r)=>row.map((bit,cc)=>bit?(<rect key={r+"-"+cc} x={cc*cell} y={r*cell} width={cell} height={cell} fill="#000"/>):null))}
  </svg>);
}

// -- TRUE CYLINDRICAL 3D PIPE GRAPHIC ----------------------------------------
// Uses perspective projection of a cylinder:
// - Pipe runs left-to-right along the X axis
// - Cylinder cross-section is an ellipse (minor axis = ry, major axis = rY)
// - Spots are projected onto the cylinder surface
function Pipe3D({spots,nominal,welds,pipeLength,onSpotClick,selectedSpot,unit}){
  const W=340,H=200;
  // Pipe cylinder in SVG space
  const cxL=55,cxR=W-30; // left/right centre x of end ellipses
  const cy=H/2;           // vertical centre
  const rX=14;            // horizontal radius of end ellipse (foreshortened)
  const rY=38;            // vertical radius (true radius shown)
  const pW=cxR-cxL;

  const weldList=welds||[];
  const weldRegistry=Object.fromEntries(weldList.map(w=>[w.label,mToFracExact(w.metres||0,pipeLength||1)]));

  // Map a spot to SVG (x,y) using cylinder projection
  function spotXY(spot){
    const frac=axialFrac(spot.axialLabel,weldRegistry);
    const angle=circumAngle(spot.circumLabel);
    const sx=cxL+frac*pW;
    // On the cylinder face: x offset from ellipse (perspective foreshortening)
    const sy=cy+rY*Math.sin(angle);
    return{x:sx,y:sy,angle};
  }
  function dotColor(spot){
    const r=(spot.readings||[]).filter(r=>r.value!=null);
    if(!r.length)return C.muted;
    const v=r[r.length-1].value;
    const l=getLoss(nominal,v);
    return l>=30?C.danger:l>=15?C.warn:C.ok;
  }

  // Draw cylinder using gradient-like layered ellipses and lines
  // Body is a rounded-rect with ellipse caps
  const bodyTop=cy-rY,bodyBot=cy+rY;

  // Highlight and shadow strips to give cylindrical feel
  // Highlight at top (12 oclock), shadow at sides
  const strips=[
    {y:bodyTop,h:rY*0.35,opacity:0.18,fill:"#fff"},   // top highlight
    {y:cy-rY*0.1,h:rY*0.2,opacity:0.06,fill:"#fff"},  // secondary
    {y:cy+rY*0.55,h:rY*0.45,opacity:0.25,fill:"#000"},// bottom shadow
  ];

  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",maxHeight:200,display:"block"}}>
      {/* ---- PIPE BODY ---- */}
      {/* Main cylinder body - dark fill */}
      <rect x={cxL} y={bodyTop} width={pW} height={rY*2} fill="#0b2030" stroke="none"/>

      {/* Cylindrical shading strips */}
      {strips.map((s,i)=>(
        <rect key={i} x={cxL} y={s.y} width={pW} height={s.h}
          fill={s.fill} opacity={s.opacity}/>
      ))}

      {/* Wall thickness rim - top */}
      <rect x={cxL} y={bodyTop} width={pW} height={7} fill={C.accent+"40"} stroke="none"/>
      {/* Wall thickness rim - bottom */}
      <rect x={cxL} y={bodyBot-7} width={pW} height={7} fill={C.accent+"20"} stroke="none"/>

      {/* Left end cap (ellipse) - backface */}
      <ellipse cx={cxL} cy={cy} rx={rX} ry={rY} fill="#071824" stroke={C.border} strokeWidth={1}/>
      {/* Left end cap inner bore */}
      <ellipse cx={cxL} cy={cy} rx={rX*0.55} ry={rY*0.55} fill="#020a10" stroke={C.border+"88"} strokeWidth={0.5}/>

      {/* Top and bottom edge lines (seam lines of cylinder) */}
      <line x1={cxL} y1={bodyTop} x2={cxR} y2={bodyTop} stroke={C.accent+"99"} strokeWidth={1.5}/>
      <line x1={cxL} y1={bodyBot} x2={cxR} y2={bodyBot} stroke={C.border} strokeWidth={1}/>

      {/* Right end cap (ellipse) - frontface */}
      <ellipse cx={cxR} cy={cy} rx={rX} ry={rY} fill="#0d2535" stroke={C.border} strokeWidth={1.5}/>
      {/* Right end cap inner bore */}
      <ellipse cx={cxR} cy={cy} rx={rX*0.55} ry={rY*0.55} fill="#020a10" stroke={C.border+"88"} strokeWidth={0.5}/>

      {/* Flange rings */}
      <ellipse cx={cxL+8} cy={cy} rx={rX*0.7} ry={rY+3} fill="none" stroke={C.border+"cc"} strokeWidth={3}/>
      <ellipse cx={cxR-8} cy={cy} rx={rX*0.7} ry={rY+3} fill="none" stroke={C.border+"cc"} strokeWidth={3}/>

      {/* Centre axis line */}
      <line x1={cxL} y1={cy} x2={cxR} y2={cy} stroke={C.accent+"22"} strokeWidth={1} strokeDasharray="5 4"/>

      {/* Weld lines */}
      {weldList.map((w,wi)=>{
        const f=pipeLength?mToFracExact(w.metres||0,pipeLength):w.frac||0.5;
        const wx=cxL+Math.max(0.02,Math.min(0.98,f))*pW;
        const mLbl=w.metres!=null?Number(parseFloat(w.metres).toFixed(2)).toString()+"m":"";
        return(
          <g key={wi}>
            <line x1={wx} y1={bodyTop-4} x2={wx} y2={bodyBot+4}
              stroke={C.warn+"cc"} strokeWidth={2} strokeDasharray="3 2"/>
            <rect x={wx-1} y={bodyTop-2} width={2} height={rY*2+4}
              fill={C.warn+"44"}/>
            <text x={wx} y={bodyTop-8} textAnchor="middle" fontSize={7}
              fill={C.warn} fontFamily={F.mono}>{w.label}{mLbl?" "+mLbl:""}</text>
          </g>
        );
      })}

      {/* Axial labels */}
      <text x={cxL} y={bodyBot+14} textAnchor="middle" fontSize={7} fill={C.muted} fontFamily={F.mono}>Inlet</text>
      <text x={cxR} y={bodyBot+14} textAnchor="middle" fontSize={7} fill={C.muted} fontFamily={F.mono}>Outlet</text>

      {/* Clock position reference markers (small ticks on right end cap) */}
      {CLOCK.map(lbl=>{
        const angle=circumAngle(lbl);
        const mx=cxR+rX*Math.cos(angle)*0.9;
        const my=cy+rY*Math.sin(angle)*0.9;
        return(<circle key={lbl} cx={mx} cy={my} r={2} fill={C.border} opacity={0.6}/>);
      })}

      {/* Measurement spots - sorted so back-of-pipe renders first */}
      {(spots||[])
        .map(spot=>({spot,angle:circumAngle(spot.circumLabel)}))
        .sort((a,b)=>Math.cos(a.angle)-Math.cos(b.angle))
        .map(({spot})=>{
          const{x,y,angle}=spotXY(spot);
          const col=dotColor(spot);
          const sel=selectedSpot===spot.id;
          const rr=(spot.readings||[]).filter(r=>r.value!=null);
          const last=rr.length?rr[rr.length-1].value:null;
          // Spots on back of pipe (9oclock side) are dimmer
          const isBack=Math.sin(angle)>0.7&&Math.cos(angle)<0;
          const opacity=isBack?0.5:1;
          return(
            <g key={spot.id} onClick={()=>onSpotClick&&onSpotClick(spot.id)}
              style={{cursor:"pointer",opacity}}>
              {sel&&<circle cx={x} cy={y} r={15} fill={col+"18"} stroke={col+"44"} strokeWidth={1}/>}
              <circle cx={x} cy={y} r={sel?11:8}
                fill={col+(sel?"ee":"99")} stroke={sel?"#fff":col} strokeWidth={sel?2:1}/>
              {last!=null&&(
                <text x={x} y={y+1} textAnchor="middle" dominantBaseline="middle"
                  fontSize={sel?7:6} fill="#fff" fontFamily={F.mono} fontWeight="700">
                  {last.toFixed(1)}
                </text>
              )}
              {sel&&(
                <text x={x} y={y+22} textAnchor="middle" fontSize={6.5}
                  fill={col} fontFamily={F.mono}>{spot.name}</text>
              )}
            </g>
          );
        })}

      <text x={W-4} y={H-2} fontSize={6} fill={C.muted} fontFamily={F.mono} textAnchor="end">
        {unit} -- tap spot
      </text>
    </svg>
  );
}

// -- Weld Placer --------------------------------------------------------------
function WeldPlacer({onPlace,currentMetres,pipeLength,label}){
  const W=300,H=72,pL=28,pR=W-28,pT=14,pB=H-18,midY=(pT+pB)/2,pW=pR-pL;
  const svgRef=useRef();
  const[manualM,setManualM]=useState(currentMetres!=null&&currentMetres>0?String(currentMetres):"");

  function handleClick(e){
    const rect=svgRef.current.getBoundingClientRect();
    const frac=Math.max(0.02,Math.min(0.98,(e.clientX-rect.left)/rect.width));
    const m=pipeLength?parseFloat((frac*pipeLength).toFixed(3)):frac;
    setManualM(pipeLength?m.toString():"");
    onPlace(m,frac);
  }
  function handleManual(val){
    setManualM(val);
    const m=parseFloat(val);
    if(!isNaN(m)&&m>=0){
      const f=pipeLength?Math.max(0.02,Math.min(0.98,m/pipeLength)):0.5;
      onPlace(m,f);
    }
  }
  const cf=currentMetres!=null&&pipeLength?Math.max(0.02,Math.min(0.98,currentMetres/pipeLength)):0;
  const wx=cf>0?pL+cf*pW:null;

  return(
    <div style={{marginTop:8,marginBottom:4}}>
      <div style={{fontSize:9,color:C.warn,fontFamily:F.mono,marginBottom:4,letterSpacing:1}}>
        {label} -- TAP PIPE OR ENTER METRES FROM INLET STUB FLANGE FACE
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        style={{width:"100%",height:"auto",maxHeight:72,cursor:"crosshair",display:"block"}}
        onClick={handleClick}>
        {/* Pipe body */}
        <rect x={pL} y={pT} width={pW} height={pB-pT} fill="#0d1f30" stroke={C.border} strokeWidth={1.5} rx={3}/>
        <rect x={pL} y={pT} width={pW} height={5} fill={C.accent+"33"}/>
        <rect x={pL} y={pB-5} width={pW} height={5} fill={C.accent+"15"}/>
        {/* Flanges */}
        <rect x={pL-4} y={pT-3} width={7} height={pB-pT+6} fill={C.border} rx={1}/>
        <rect x={pR-3} y={pT-3} width={7} height={pB-pT+6} fill={C.border} rx={1}/>
        {/* Centre line */}
        <line x1={pL} y1={midY} x2={pR} y2={midY} stroke={C.accent+"22"} strokeWidth={1} strokeDasharray="4 3"/>
        {/* Distance ticks */}
        {pipeLength&&[0.25,0.5,0.75].map(t=>{
          const tx=pL+t*pW;
          return(<g key={t}>
            <line x1={tx} y1={pB} x2={tx} y2={pB+3} stroke={C.muted} strokeWidth={1}/>
            <text x={tx} y={H-2} textAnchor="middle" fontSize={6} fill={C.muted+"88"} fontFamily={F.mono}>{(t*pipeLength).toFixed(1)}</text>
          </g>);
        })}
        {/* End labels */}
        <text x={pL} y={H-2} textAnchor="middle" fontSize={6.5} fill={C.muted} fontFamily={F.mono}>{pipeLength?"0m":"Inlet"}</text>
        <text x={pR} y={H-2} textAnchor="middle" fontSize={6.5} fill={C.muted} fontFamily={F.mono}>{pipeLength?pipeLength+"m":"Outlet"}</text>
        {/* Weld marker */}
        {wx&&(<g>
          <line x1={wx} y1={pT-2} x2={wx} y2={pB+2} stroke={C.warn} strokeWidth={2} strokeDasharray="3 2"/>
          <circle cx={wx} cy={midY} r={4} fill={C.warn} stroke="#fff" strokeWidth={1}/>
          <text x={wx} y={pT-5} textAnchor="middle" fontSize={7} fill={C.warn} fontFamily={F.mono}>
            {pipeLength&&currentMetres!=null?Number(parseFloat(currentMetres).toFixed(2)).toString()+"m":label||"WELD"}
          </text>
        </g>)}
      </svg>
      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:5}}>
        <div style={{fontSize:9,color:C.muted,fontFamily:F.mono}}>Distance from inlet stub flange face:</div>
        <input type="number" value={manualM} onChange={e=>handleManual(e.target.value)}
          placeholder={pipeLength?"0 - "+pipeLength+" m":"metres"}
          style={{width:80,background:C.bg,border:`1px solid ${C.warn}55`,borderRadius:6,
            padding:"5px 8px",color:C.warn,fontFamily:F.mono,fontSize:12,outline:"none"}}
          onFocus={e=>e.target.style.borderColor=C.warn}
          onBlur={e=>e.target.style.borderColor=C.warn+"55"}/>
        <div style={{fontSize:9,color:C.muted,fontFamily:F.mono}}>m</div>
      </div>
    </div>
  );
}

// -- Trend Chart --------------------------------------------------------------
function TrendChart({readings,nominal,label,turnHistory}){
  const safe=(readings||[]).filter(r=>r.value!=null);
  if(!safe.length)return(<div style={{fontSize:10,color:C.muted,fontFamily:F.mono,padding:"6px 0"}}>No readings</div>);
  const W=280,H=70,pad=8,topPad=14;
  const vals=safe.map(r=>r.value);
  const minV=Math.min(...vals,nominal)*0.93,maxV=Math.max(...vals,nominal)*1.05;
  const toX=i=>pad+(i/(Math.max(vals.length-1,1)))*(W-pad*2);
  const toY=v=>topPad+(H-topPad-pad)-((v-minV)/(maxV-minV||1))*(H-topPad-pad*2);
  const nomY=toY(nominal);
  const path=vals.map((v,i)=>(i===0?"M":"L")+toX(i).toFixed(1)+","+toY(v).toFixed(1)).join(" ");
  const fill=path+" L"+toX(vals.length-1).toFixed(1)+","+H+" L"+pad+","+H+" Z";
  const lastC=getLoss(nominal,vals[vals.length-1])>=30?C.danger:getLoss(nominal,vals[vals.length-1])>=15?C.warn:C.accent;
  const turns=(turnHistory||[]).map(t=>{
    let best=0,bestDiff=Infinity;
    safe.forEach((r,i)=>{const d=Math.abs(new Date(r.date)-new Date(t.date));if(d<bestDiff){bestDiff=d;best=i;}});
    return{x:toX(best),label:t.bottomPosition,date:t.date};
  });
  return(
    <div style={{background:C.bg,borderRadius:8,padding:"7px 10px",marginBottom:8}}>
      {label?<div style={{fontSize:8,color:C.muted,fontFamily:F.mono,marginBottom:2,letterSpacing:1}}>{label}</div>:null}
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",maxHeight:70}}>
        {turns.map((t,i)=>(
          <g key={i}>
            <line x1={t.x} y1={topPad} x2={t.x} y2={H-10} stroke={C.accent+"88"} strokeWidth={1} strokeDasharray="2 3"/>
            <text x={t.x} y={topPad-2} textAnchor="middle" fontSize={5.5} fill={C.accent} fontFamily={F.mono}>R:{t.label}</text>
          </g>
        ))}
        <line x1={pad} y1={nomY} x2={W-pad} y2={nomY} stroke={C.muted} strokeWidth={1} strokeDasharray="3 3"/>
        <text x={W-pad} y={nomY-2} fontSize={5.5} fill={C.muted} fontFamily={F.mono} textAnchor="end">NOM</text>
        <path d={fill} fill={lastC+"14"}/>
        <path d={path} fill="none" stroke={lastC} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
        {vals.map((v,i)=>{const col=getLoss(nominal,v)>=30?C.danger:getLoss(nominal,v)>=15?C.warn:C.ok;return(<circle key={i} cx={toX(i)} cy={toY(v)} r={3} fill={col} stroke={C.bg} strokeWidth={1}/>);})}
        {safe.map((r,i)=>(<text key={i} x={toX(i)} y={H-1} textAnchor="middle" fontSize={5.5} fill={C.muted} fontFamily={F.mono}>{r.date?r.date.slice(5):""}</text>))}
      </svg>
      {turns.length>0&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:3}}>
          {turns.map((t,i)=>(<span key={i} style={{fontSize:8,fontFamily:F.mono,color:C.accent,background:C.accent+"15",borderRadius:4,padding:"2px 5px"}}>R{i+1}: {t.label} at bottom ({t.date})</span>))}
        </div>
      )}
    </div>
  );
}

// -- Shared UI ----------------------------------------------------------------
function Badge({status}){
  const m={ok:[C.ok,"GOOD"],warning:[C.warn,"WARN"],critical:[C.danger,"CRITICAL"]};
  const[col,lbl]=m[status]||m.ok;
  return(<span style={{background:col+"22",color:col,border:`1px solid ${col}44`,borderRadius:4,padding:"2px 8px",fontSize:10,fontFamily:F.mono,fontWeight:700,letterSpacing:1}}>{lbl}</span>);
}
function WallBar({nominal,min}){
  const loss=getLoss(nominal,min),pct=Math.min(100,loss);
  const col=pct>=30?C.danger:pct>=15?C.warn:C.ok;
  return(
    <div style={{marginTop:8}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.muted,fontFamily:F.mono,marginBottom:3}}>
        <span>WALL LOSS</span><span style={{color:col}}>{loss.toFixed(1)}%</span>
      </div>
      <div style={{background:C.border,borderRadius:4,height:6,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${col}88,${col})`,borderRadius:4,transition:"width 0.5s"}}/>
      </div>
    </div>
  );
}
function PhotoBtn({onAdd,size=44}){
  const ref=useRef();
  return(<>
    <button onClick={e=>{e.stopPropagation();ref.current.click();}}
      style={{width:size,height:size,borderRadius:8,border:`1px dashed ${C.accent}66`,background:C.accent+"0d",color:C.accent,fontSize:size>40?16:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:F.mono}}>
      CAM
    </button>
    <input ref={ref} type="file" accept="image/*" capture="environment" style={{display:"none"}}
      onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>onAdd(ev.target.result);r.readAsDataURL(f);e.target.value="";}}/>
  </>);
}

// -- Material Fields (shared between Add and Edit) ----------------------------
function MatFields({form,setForm,inputStyle}){
  const ls={fontSize:10,color:C.muted,fontFamily:F.mono,letterSpacing:1,marginBottom:5,display:"block"};
  const isHDPE=form.material==="HDPE";
  const steelOpts=getSteelOpts(form.unit);
  function steelChange(label,od){setForm({...form,diameter:label,od});}
  function hdpeOd(od){const n=parseFloat(od);const t=form.sdr&&n?calcWall(form.sdr,n):form.nominalThickness;setForm({...form,diameter:"OD "+od+"mm",od:n||null,nominalThickness:form.sdr&&n?t:form.nominalThickness});}
  function sdrChange(sdr){const t=sdr&&form.od?calcWall(sdr,form.od):form.nominalThickness;setForm({...form,sdr,nominalThickness:t});}
  return(
    <div style={{background:C.bg,border:`1px solid ${C.accent}33`,borderRadius:8,padding:"12px 12px 8px",marginBottom:12}}>
      {isHDPE&&(<>
        <div style={{fontSize:10,color:C.accent,fontFamily:F.mono,marginBottom:8,background:C.accent+"0d",border:`1px solid ${C.accent}33`,borderRadius:6,padding:"6px 10px"}}>HDPE: actual OD (ISO 4427) -- wall = OD / SDR</div>
        <span style={ls}>HDPE OD (mm)</span>
        <select style={{...inputStyle,marginBottom:8,borderColor:C.accent+"55"}} value={form.od||""} onChange={e=>hdpeOd(e.target.value)}>
          <option value="">Select OD...</option>
          {HDPE_OD.map(od=><option key={od} value={od}>OD {od} mm</option>)}
        </select>
        {form.od&&<div style={{fontSize:10,color:C.accent,fontFamily:F.mono,marginBottom:8}}>OD = {form.od} mm</div>}
        <span style={ls}>SDR RATING</span>
        <select style={{...inputStyle,marginBottom:8,borderColor:C.accent+"55"}} value={form.sdr||""} onChange={e=>sdrChange(e.target.value)}>
          <option value="">Select SDR...</option>
          {SDR_OPTIONS.map(s=><option key={s} value={s}>{s} -- {SDR_P[s]}</option>)}
        </select>
        {form.sdr&&form.od&&<div style={{fontSize:10,color:C.ok,fontFamily:F.mono,marginBottom:4,background:C.ok+"0d",border:`1px solid ${C.ok}33`,borderRadius:6,padding:"6px 10px"}}>Wall = {form.od} / {SDR_RATIO[form.sdr]} = {calcWall(form.sdr,form.od)} mm</div>}
      </>)}
      {!isHDPE&&(<>
        <span style={ls}>DIAMETER ({form.unit==="mm"?"DN metric":"NPS imperial"})</span>
        <select style={{...inputStyle,marginBottom:8,borderColor:C.accent+"55"}} value={form.diameter||""}
          onChange={e=>{const o=steelOpts.find(d=>d.label===e.target.value);if(o)steelChange(o.label,o.od);else setForm({...form,diameter:"",od:null});}}>
          <option value="">Select diameter...</option>
          {steelOpts.map(d=><option key={d.label} value={d.label}>{d.label} -- OD {d.od}{form.unit==="mm"?"mm":"in"}</option>)}
        </select>
        {form.od&&<div style={{fontSize:10,color:C.accent,fontFamily:F.mono,marginBottom:8}}>OD = {form.od}{form.unit==="mm"?"mm":"in"}</div>}
      </>)}
      {form.material==="Carbon Steel"&&(<>
        <span style={ls}>INTERNAL LINING</span>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          {["Unlined","Lined"].map(opt=>(
            <button key={opt} onClick={()=>setForm({...form,lined:opt==="Lined",liningMaterial:""})}
              style={{flex:1,padding:"8px 0",borderRadius:7,cursor:"pointer",fontFamily:F.mono,fontSize:11,fontWeight:700,letterSpacing:1,border:`1px solid ${(form.lined?"Lined":"Unlined")===opt?C.accent:C.border}`,background:(form.lined?"Lined":"Unlined")===opt?C.accent+"22":C.card,color:(form.lined?"Lined":"Unlined")===opt?C.accent:C.muted}}>
              {opt.toUpperCase()}
            </button>
          ))}
        </div>
        {form.lined&&(<>
          <span style={ls}>LINING MATERIAL</span>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            {LINING.map(m=>(<button key={m} onClick={()=>setForm({...form,liningMaterial:m})}
              style={{flex:1,padding:"8px 4px",borderRadius:7,cursor:"pointer",fontFamily:F.mono,fontSize:10,fontWeight:700,border:`1px solid ${form.liningMaterial===m?C.warn:C.border}`,background:form.liningMaterial===m?C.warn+"22":C.card,color:form.liningMaterial===m?C.warn:C.muted}}>
              {m.toUpperCase()}
            </button>))}
          </div>
        </>)}
      </>)}
    </div>
  );
}

// -- Weld Manager (reusable) --------------------------------------------------
function WeldManager({welds,setWelds,pipeLength,pipeType}){
  const[newM,setNewM]=useState("");
  function addWeld(){
    const m=parseFloat(newM);
    if(isNaN(m)||m<=0)return;
    if(pipeLength&&m>pipeLength)return;
    const frac=pipeLength?mToFracExact(m,pipeLength):0.5;
    setWelds(sortWelds([...welds,{label:"",metres:m,frac}]));
    setNewM("");
  }
  return(
    <div>
      <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,marginBottom:8,letterSpacing:1}}>WELDS (auto-numbered inlet to outlet)</div>
      {welds.map((w,wi)=>(
        <div key={wi} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <div style={{flex:1,background:C.card,border:`1px solid ${C.warn}44`,borderRadius:8,padding:"8px 12px",fontFamily:F.mono,fontSize:12,color:C.warn}}>
            {w.label} -- {w.metres!=null?Number(parseFloat(w.metres).toFixed(2)).toString()+"m from inlet flange face":""} 
          </div>
          <button onClick={()=>setWelds(sortWelds(welds.filter((_,i)=>i!==wi)))}
            style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,borderRadius:6,padding:"5px 9px",fontFamily:F.mono,fontSize:11,cursor:"pointer"}}>DEL</button>
        </div>
      ))}
      {pipeType==="straight"&&(
        <div>
          <WeldPlacer onPlace={(m,f)=>setNewM(String(m))} currentMetres={newM?parseFloat(newM):null}
            pipeLength={pipeLength} label={"Weld "+(welds.length+1)}/>
          <div style={{display:"flex",gap:8,marginTop:6}}>
            <div style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontFamily:F.mono,fontSize:12,color:C.warn}}>
              {newM?newM+"m from inlet flange face":"Tap pipe above or enter metres"}
            </div>
            <button onClick={addWeld}
              style={{background:C.warn,border:"none",color:"#000",borderRadius:8,padding:"8px 14px",fontFamily:F.mono,fontSize:11,fontWeight:700,cursor:"pointer"}}>
              + ADD
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// -- Enter Measurements Modal -------------------------------------------------
function MeasureModal({pipe,spots,onSave,onClose}){
  const ordered=[
    ...spots.filter(s=>s.axialLabel==="Inlet stub"),
    ...spots.filter(s=>s.axialLabel!=="Inlet stub"&&s.axialLabel!=="Outlet stub").sort((a,b)=>(a.weldFrac||0)-(b.weldFrac||0)),
    ...spots.filter(s=>s.axialLabel==="Outlet stub"),
  ];
  const[vals,setVals]=useState(ordered.map(()=>""));
  const[nas,setNas]=useState(ordered.map(()=>false));
  const inputs=useRef([]);
  function toggleNa(i){const a=[...nas];a[i]=!a[i];setNas(a);const b=[...vals];b[i]=a[i]?"":"";setVals(b);}
  function handleSave(){
    const dt=today();
    const updatedSpots=spots.map(sp=>{
      const idx=ordered.findIndex(o=>o.id===sp.id);
      if(idx===-1)return sp;
      if(nas[idx])return sp;
      const v=parseFloat(vals[idx]);
      if(isNaN(v)||v<=0)return sp;
      return{...sp,readings:[...(sp.readings||[]),{value:v,date:dt}]};
    });
    onSave(updatedSpots);onClose();
  }
  const canSave=ordered.some((_,i)=>nas[i]||(parseFloat(vals[i])>0));
  return(
    <div style={{position:"fixed",inset:0,background:"#000000dd",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,padding:24,maxHeight:"90vh",overflowY:"auto",border:`1px solid ${C.border}`,borderBottom:"none"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 14px"}}/>
        <div style={{fontSize:18,fontWeight:800,color:C.text,fontFamily:F.display,marginBottom:2}}>ENTER MEASUREMENTS</div>
        <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,marginBottom:18}}>{pipe.pipeName} -- {pipe.diameter} -- {today()}</div>
        {ordered.length===0&&<div style={{fontSize:13,color:C.muted,fontFamily:F.mono,textAlign:"center",padding:20}}>No spots defined. Add spots first.</div>}
        {ordered.map((spot,i)=>{
          const rr=(spot.readings||[]).filter(r=>r.value!=null);
          const last=rr.length?rr[rr.length-1].value:null;
          const loss=last!=null?getLoss(pipe.nominalThickness,last):null;
          const col=loss!=null?(loss>=30?C.danger:loss>=15?C.warn:C.ok):C.muted;
          return(
            <div key={spot.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:F.display}}>{spot.name}</div>
                  <div style={{fontSize:9,color:C.muted,fontFamily:F.mono}}>{spot.axialLabel} / {spot.circumLabel}</div>
                </div>
                {last!=null&&<div style={{textAlign:"right"}}>
                  <div style={{fontSize:11,color:col,fontFamily:F.mono}}>Last: {last.toFixed(1)}</div>
                  <div style={{fontSize:9,color:C.muted,fontFamily:F.mono}}>{loss!=null?loss.toFixed(1)+"%":""}</div>
                </div>}
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input ref={el=>inputs.current[i]=el} type="number" value={nas[i]?"":vals[i]} disabled={nas[i]}
                  onChange={e=>{const a=[...vals];a[i]=e.target.value;setVals(a);}}
                  onKeyDown={e=>{if(e.key==="Enter"&&inputs.current[i+1])inputs.current[i+1].focus();}}
                  placeholder={nas[i]?"N/A -- skipped":`Reading (${pipe.unit})`}
                  style={{flex:1,background:C.bg,border:`1px solid ${nas[i]?C.border:C.accent+"55"}`,borderRadius:8,padding:"10px 12px",color:nas[i]?C.muted:C.text,fontFamily:F.mono,fontSize:14,outline:"none",opacity:nas[i]?0.5:1}}/>
                <button onClick={()=>toggleNa(i)} style={{flexShrink:0,padding:"10px 12px",borderRadius:8,cursor:"pointer",fontFamily:F.mono,fontSize:11,fontWeight:700,letterSpacing:0.5,border:`1px solid ${nas[i]?C.warn:C.border}`,background:nas[i]?C.warn+"22":C.card,color:nas[i]?C.warn:C.muted}}>N/A</button>
              </div>
              {vals[i]&&!nas[i]&&parseFloat(vals[i])>0&&(()=>{
                const nl=getLoss(pipe.nominalThickness,parseFloat(vals[i]));
                const nc=nl>=30?C.danger:nl>=15?C.warn:C.ok;
                return(<div style={{fontSize:9,color:nc,fontFamily:F.mono,marginTop:4}}>Wall loss: {nl.toFixed(1)}%{nl>=30?" -- CRITICAL":nl>=15?" -- WARNING":" -- OK"}</div>);
              })()}
            </div>
          );
        })}
        <button onClick={handleSave} disabled={!canSave}
          style={{width:"100%",marginTop:8,background:canSave?C.accent:C.border,color:canSave?"#000":C.muted,border:"none",borderRadius:10,padding:"14px",fontWeight:800,fontFamily:F.display,fontSize:16,cursor:canSave?"pointer":"not-allowed",letterSpacing:1}}>
          SAVE ALL MEASUREMENTS
        </button>
        <button onClick={onClose} style={{width:"100%",marginTop:8,background:"transparent",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px",fontFamily:F.mono,fontSize:12,cursor:"pointer"}}>CANCEL</button>
      </div>
    </div>
  );
}

// -- QR Modal -----------------------------------------------------------------
function QRModal({pipe,onClose}){
  const qrValue="pipe:"+pipe.id;
  return(
    <div style={{position:"fixed",inset:0,background:"#000000dd",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:16,width:"90%",maxWidth:320,padding:28,border:`1px solid ${C.border}`,textAlign:"center"}}>
        <div style={{fontSize:16,fontWeight:800,color:C.text,fontFamily:F.display,marginBottom:4}}>PIPE QR CODE</div>
        <div style={{fontSize:11,color:C.muted,fontFamily:F.mono,marginBottom:16}}>{pipe.pipeName}</div>
        <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><QRCode value={qrValue} size={140}/></div>
        <div style={{fontSize:9,color:C.muted,fontFamily:F.mono,marginBottom:16}}>{qrValue}</div>
        <button onClick={()=>{const w=window.open("","_blank");if(w){w.document.write(`<html><body style="margin:20px;font-family:sans-serif;"><h2>${pipe.pipeName}</h2><p>${pipe.diameter||""} | ${pipe.material||""}</p><p style="font-size:11px;color:#666;">ID: ${qrValue}</p></body></html>`);w.print();w.close();}}}
          style={{width:"100%",background:C.accent,border:"none",color:"#000",borderRadius:10,padding:"12px",fontWeight:800,fontFamily:F.display,fontSize:15,cursor:"pointer",marginBottom:8}}>
          PRINT QR LABEL
        </button>
        <button onClick={onClose} style={{width:"100%",background:"transparent",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px",fontFamily:F.mono,fontSize:12,cursor:"pointer"}}>CLOSE</button>
      </div>
    </div>
  );
}

// -- Scan Modal ---------------------------------------------------------------
function ScanModal({pipes,onFound,onClose}){
  const[input,setInput]=useState("");
  const[error,setError]=useState("");
  function tryFind(val){
    const v=val.trim();
    const id=v.startsWith("pipe:")?parseFloat(v.slice(5)):parseFloat(v);
    const found=pipes.find(p=>p.id===id||String(p.id)===String(id));
    if(found)onFound(found);else setError("No pipe found for: "+v);
  }
  return(
    <div style={{position:"fixed",inset:0,background:"#000000ee",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,padding:24,border:`1px solid ${C.border}`,borderBottom:"none"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{fontSize:18,fontWeight:800,color:C.text,fontFamily:F.display,marginBottom:4}}>SCAN QR CODE</div>
        <div style={{fontSize:11,color:C.muted,fontFamily:F.mono,marginBottom:16}}>Point camera at pipe QR label, or enter the pipe ID manually.</div>
        <div style={{background:"#000",borderRadius:12,height:130,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16,border:`2px solid ${C.accent}44`,position:"relative",overflow:"hidden"}}>
          <div style={{fontSize:11,color:C.muted,fontFamily:F.mono,textAlign:"center"}}>Camera not available in preview.<br/>Use manual entry below.</div>
          {[[0,0],[1,0],[0,1],[1,1]].map(([r,cc],i)=>(
            <div key={i} style={{position:"absolute",top:r?undefined:8,bottom:r?8:undefined,left:cc?undefined:8,right:cc?8:undefined,width:20,height:20,borderTop:r?"none":`2px solid ${C.accent}`,borderBottom:r?`2px solid ${C.accent}`:"none",borderLeft:cc?"none":`2px solid ${C.accent}`,borderRight:cc?`2px solid ${C.accent}`:"none"}}/>
          ))}
        </div>
        <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,marginBottom:8,letterSpacing:1}}>MANUAL ENTRY</div>
        <div style={{display:"flex",gap:8}}>
          <input value={input} onChange={e=>{setInput(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&tryFind(input)}
            placeholder="pipe:1 or just 1"
            style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:F.mono,fontSize:14,outline:"none"}}
            onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
          <button onClick={()=>tryFind(input)} style={{background:C.accent,color:"#000",border:"none",borderRadius:8,padding:"10px 18px",fontWeight:700,fontFamily:F.mono,fontSize:13,cursor:"pointer"}}>GO</button>
        </div>
        {error&&<div style={{fontSize:11,color:C.danger,fontFamily:F.mono,marginTop:8}}>{error}</div>}
        <button onClick={onClose} style={{width:"100%",marginTop:16,background:"transparent",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px",fontFamily:F.mono,fontSize:12,cursor:"pointer"}}>CANCEL</button>
      </div>
    </div>
  );
}

// -- Edit Pipe Modal -----------------------------------------------------------
function EditPipeModal({pipe,onClose,onSave}){
  const[form,setForm]=useState({
    pipeName:pipe.pipeName||"",area:pipe.area||"",location:pipe.location||"",
    diameter:pipe.diameter||"",od:pipe.od||null,nominalThickness:String(pipe.nominalThickness||""),
    material:pipe.material||"Carbon Steel",unit:pipe.unit||"mm",notes:pipe.notes||"",
    lined:pipe.lined||false,liningMaterial:pipe.liningMaterial||"",sdr:pipe.sdr||"",
    pipeType:pipe.pipeType||"straight",pipeLength:pipe.pipeLength?String(pipe.pipeLength):"",
    bendAngle:pipe.bendAngle||"90",
  });
  const[welds,setWelds]=useState(pipe.welds||[]);
  const inputStyle={width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:F.sans,fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:12};
  const isValid=form.pipeName&&form.nominalThickness&&form.area;
  return(
    <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,padding:24,border:`1px solid ${C.border}`,borderBottom:"none",maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{fontSize:20,fontWeight:800,color:C.text,fontFamily:F.display,marginBottom:20}}>EDIT PIPE DETAILS</div>
        <input style={inputStyle} placeholder="Pipe Name *" value={form.pipeName} onChange={e=>setForm({...form,pipeName:e.target.value})}/>
        <input style={inputStyle} placeholder="Area / Zone" value={form.area} onChange={e=>setForm({...form,area:e.target.value})}/>
        <input style={inputStyle} placeholder="Location" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,alignSelf:"center"}}>UNIT:</div>
          {["mm","in"].map(u=>(<button key={u} onClick={()=>setForm({...form,unit:u,diameter:"",od:null})}
            style={{padding:"6px 16px",borderRadius:7,cursor:"pointer",fontFamily:F.mono,fontSize:11,fontWeight:700,border:`1px solid ${form.unit===u?C.accent:C.border}`,background:form.unit===u?C.accent+"22":C.card,color:form.unit===u?C.accent:C.muted}}>{u}</button>))}
        </div>
        <select style={{...inputStyle,borderColor:C.accent+"55"}} value={form.material}
          onChange={e=>setForm({...form,material:e.target.value,sdr:"",lined:false,liningMaterial:"",diameter:"",od:null,nominalThickness:""})}>
          {["Carbon Steel","Stainless 316","Stainless 304","Chrome-Moly","Duplex SS","HDPE","Other"].map(m=><option key={m}>{m}</option>)}
        </select>
        <MatFields form={form} setForm={setForm} inputStyle={inputStyle}/>
        <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,marginBottom:6,letterSpacing:1}}>NOMINAL WALL THICKNESS *</div>
        <input type="number" style={inputStyle} placeholder="Wall thickness" value={form.nominalThickness} onChange={e=>setForm({...form,nominalThickness:e.target.value})}/>
        <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,marginBottom:6,letterSpacing:1}}>PIPE TYPE</div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          {["straight","bend"].map(t=>(<button key={t} onClick={()=>setForm({...form,pipeType:t})}
            style={{flex:1,padding:"10px",borderRadius:8,cursor:"pointer",fontFamily:F.mono,fontSize:12,fontWeight:700,border:`1px solid ${form.pipeType===t?C.accent:C.border}`,background:form.pipeType===t?C.accent+"22":C.card,color:form.pipeType===t?C.accent:C.muted}}>
            {t==="straight"?"STRAIGHT":"BEND"}
          </button>))}
        </div>
        {form.pipeType==="straight"&&(<>
          <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,marginBottom:6,letterSpacing:1}}>PIPE LENGTH (metres)</div>
          <input type="number" style={inputStyle} placeholder="e.g. 6.0" value={form.pipeLength} onChange={e=>setForm({...form,pipeLength:e.target.value})}/>
        </>)}
        {form.pipeType==="bend"&&(
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            {["45","90"].map(a=>(<button key={a} onClick={()=>setForm({...form,bendAngle:a})}
              style={{flex:1,padding:"10px",borderRadius:8,cursor:"pointer",fontFamily:F.mono,fontSize:13,fontWeight:800,border:`1px solid ${form.bendAngle===a?C.warn:C.border}`,background:form.bendAngle===a?C.warn+"22":C.card,color:form.bendAngle===a?C.warn:C.muted}}>
              {a} deg
            </button>))}
          </div>
        )}
        <WeldManager welds={welds} setWelds={setWelds} pipeLength={form.pipeLength?parseFloat(form.pipeLength):null} pipeType={form.pipeType}/>
        <textarea rows={2} style={{...inputStyle,resize:"none",marginTop:12}} placeholder="Notes" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
        <button onClick={()=>{if(isValid){onSave({...pipe,...form,nominalThickness:parseFloat(form.nominalThickness),pipeLength:form.pipeLength?parseFloat(form.pipeLength):null,welds});onClose();}}}
          style={{width:"100%",background:isValid?C.accent:C.border,color:isValid?"#000":C.muted,border:"none",borderRadius:10,padding:"14px",fontWeight:800,fontFamily:F.display,fontSize:16,cursor:isValid?"pointer":"not-allowed",transition:"all 0.2s"}}>
          SAVE CHANGES
        </button>
      </div>
    </div>
  );
}

// -- Pipe Card ----------------------------------------------------------------
function PipeCard({pipe,onClick,onDelete,onMeasure,onQR}){
  const[confirmDel,setConfirmDel]=useState(false);
  const status=getStatus(pipe.nominalThickness,pipe.spots);
  const v=allVals(pipe.spots);const minR=getMin(v);
  const borderCol=status==="critical"?C.danger:status==="warning"?C.warn:C.border;
  return(
    <div style={{background:C.card,border:`1px solid ${borderCol}`,borderRadius:12,padding:16,marginBottom:12,boxShadow:status==="critical"?`0 0 12px ${C.danger}22`:"none"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
        <div style={{flex:1,cursor:"pointer",minWidth:0}} onClick={onClick}>
          <div style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:F.display,letterSpacing:0.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pipe.pipeName}</div>
          <div style={{fontSize:11,color:C.muted,fontFamily:F.mono,marginTop:2}}>
            {pipe.area&&<span style={{color:C.accent+"cc",marginRight:6}}>{pipe.area}</span>}{pipe.location}
          </div>
        </div>
        <div style={{display:"flex",gap:5,alignItems:"center",flexShrink:0}}>
          <Badge status={status}/>
          {confirmDel?(
            <div style={{display:"flex",gap:4}}>
              <button onClick={e=>{e.stopPropagation();onDelete();}} style={{background:C.danger,border:"none",color:"#fff",borderRadius:6,padding:"3px 8px",fontSize:10,fontFamily:F.mono,cursor:"pointer",fontWeight:700}}>YES</button>
              <button onClick={e=>{e.stopPropagation();setConfirmDel(false);}} style={{background:C.border,border:"none",color:C.dim,borderRadius:6,padding:"3px 8px",fontSize:10,fontFamily:F.mono,cursor:"pointer"}}>NO</button>
            </div>
          ):(
            <button onClick={e=>{e.stopPropagation();setConfirmDel(true);}} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,borderRadius:6,padding:"3px 7px",fontSize:11,cursor:"pointer"}}>DEL</button>
          )}
        </div>
      </div>
      <div style={{display:"flex",gap:16,marginTop:12,cursor:"pointer",flexWrap:"wrap"}} onClick={onClick}>
        <div><div style={{fontSize:10,color:C.muted,fontFamily:F.mono}}>DIAMETER</div><div style={{fontSize:12,fontWeight:700,color:C.dim,fontFamily:F.mono,marginTop:2}}>{pipe.diameter||"--"}</div></div>
        <div><div style={{fontSize:10,color:C.muted,fontFamily:F.mono}}>NOM WT</div><div style={{fontSize:18,fontWeight:700,color:C.dim,fontFamily:F.mono}}>{pipe.nominalThickness}<span style={{fontSize:10,marginLeft:2}}>{pipe.unit}</span></div></div>
        <div><div style={{fontSize:10,color:C.muted,fontFamily:F.mono}}>MIN READING</div><div style={{fontSize:18,fontWeight:700,color:status==="critical"?C.danger:C.accent,fontFamily:F.mono}}>{minR!=null?minR.toFixed(1):"--"}<span style={{fontSize:10,marginLeft:2}}>{pipe.unit}</span></div></div>
        <div><div style={{fontSize:10,color:C.muted,fontFamily:F.mono}}>SPOTS</div><div style={{fontSize:18,fontWeight:700,color:C.dim,fontFamily:F.mono}}>{(pipe.spots||[]).length}</div></div>
      </div>
      {v.length>0&&<WallBar nominal={pipe.nominalThickness} min={minR}/>}
      <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
        {pipe.pipeType&&<span style={{background:C.accent+"15",border:`1px solid ${C.accent}33`,borderRadius:6,padding:"3px 8px",fontSize:9,fontFamily:F.mono,color:C.accent}}>{pipe.pipeType==="bend"?(pipe.bendAngle||"90")+" deg BEND":"STRAIGHT"}</span>}
        {pipe.pipeLength&&<span style={{background:C.accent+"15",border:`1px solid ${C.accent}33`,borderRadius:6,padding:"3px 8px",fontSize:9,fontFamily:F.mono,color:C.accent}}>{pipe.pipeLength}m</span>}
        {(pipe.welds||[]).length>0&&<span style={{background:C.warn+"15",border:`1px solid ${C.warn}33`,borderRadius:6,padding:"3px 8px",fontSize:9,fontFamily:F.mono,color:C.warn}}>{pipe.welds.length} weld{pipe.welds.length!==1?"s":""}</span>}
        {pipe.turnsCount>0&&<span style={{background:C.accent+"15",border:`1px solid ${C.accent}33`,borderRadius:6,padding:"3px 8px",fontSize:9,fontFamily:F.mono,color:C.accent}}>Turned x{pipe.turnsCount}</span>}
        {(pipe.changeoutHistory||[]).length>0&&<span style={{background:C.warn+"15",border:`1px solid ${C.warn}33`,borderRadius:6,padding:"3px 8px",fontSize:9,fontFamily:F.mono,color:C.warn}}>{pipe.changeoutHistory.length} changeout{pipe.changeoutHistory.length!==1?"s":""}</span>}
      </div>
      {pipe.notes&&<div style={{marginTop:8,fontSize:11,color:status==="critical"?C.danger:C.warn,fontFamily:F.sans,fontStyle:"italic"}}>{pipe.notes}</div>}
      <div style={{display:"flex",gap:8,marginTop:12}}>
        <button onClick={e=>{e.stopPropagation();onMeasure();}}
          style={{flex:2,background:C.accent,border:"none",color:"#000",borderRadius:8,padding:"10px 8px",fontWeight:800,fontFamily:F.display,fontSize:13,cursor:"pointer",letterSpacing:0.5}}>
          + ENTER MEASUREMENTS
        </button>
        <button onClick={e=>{e.stopPropagation();onQR();}}
          style={{flex:1,background:C.card,border:`1px solid ${C.border}`,color:C.dim,borderRadius:8,padding:"10px 8px",fontFamily:F.mono,fontSize:11,cursor:"pointer"}}>
          QR CODE
        </button>
      </div>
    </div>
  );
}

// -- Detail Modal -------------------------------------------------------------
function DetailModal({pipe,onClose,onSave,onDelete,onEdit}){
  const[spots,setSpots]=useState((pipe.spots||[]).map(s=>({...s,readings:[...(s.readings||[])]})));
  const[notes,setNotes]=useState(pipe.notes||"");
  const[photos,setPhotos]=useState([...(pipe.photos||[])]);
  const[turnsCount,setTurnsCount]=useState(pipe.turnsCount||0);
  const[turnHistory,setTurnHistory]=useState(pipe.turnHistory||[]);
  const[showTurnPicker,setShowTurnPicker]=useState(false);
  const[pendingBottom,setPendingBottom]=useState("");
  const[changeoutHistory]=useState(pipe.changeoutHistory||[]);
  const[confirmDel,setConfirmDel]=useState(false);
  const[confirmCO,setConfirmCO]=useState(false);
  const[coNote,setCoNote]=useState("");
  const[activeTab,setActiveTab]=useState("spots");
  const[selSpotId,setSelSpotId]=useState((pipe.spots||[])[0]?.id||null);
  const[addingSpot,setAddingSpot]=useState(false);
  const[newAxial,setNewAxial]=useState("");
  const[newName,setNewName]=useState("");
  const[newWeldLabel,setNewWeldLabel]=useState("");
  const[newReadVal,setNewReadVal]=useState("");
  const[showMeasure,setShowMeasure]=useState(false);
  const[axialExpanded,setAxialExpanded]=useState({});

  const welds=pipe.welds||[];
  const status=getStatus(pipe.nominalThickness,spots);
  const av=allVals(spots);
  const selSpot=spots.find(s=>s.id===selSpotId);
  const inputStyle={background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 11px",color:C.text,fontFamily:F.mono,fontSize:13,outline:"none",boxSizing:"border-box"};

  function addSpot(){
    if(!newAxial)return;
    const selectedWeld=newAxial==="Weld"?welds.find(w=>w.label===newWeldLabel):null;
    const effectiveAxial=selectedWeld?selectedWeld.label:newAxial;
    const wf=selectedWeld?selectedWeld.frac:undefined;
    const prefix=newName.trim()?newName.trim()+" ":effectiveAxial.replace(" stub","")+" ";
    const newSpots=CLOCK.map((cp,i)=>({id:uid()+i,name:prefix+cp,axialLabel:effectiveAxial,circumLabel:cp,weldFrac:wf,readings:[]}));
    const updated=[...spots,...newSpots];
    setSpots(updated);setSelSpotId(newSpots[0].id);
    setAddingSpot(false);setNewAxial("");setNewName("");setNewWeldLabel("");
  }
  function addReading(){
    const val=parseFloat(newReadVal);
    if(isNaN(val)||val<=0||!selSpot)return;
    setSpots(spots.map(s=>s.id===selSpotId?{...s,readings:[...(s.readings||[]),{value:val,date:today()}]}:s));
    setNewReadVal("");
  }
  function delSpot(id){setSpots(spots.filter(s=>s.id!==id));if(selSpotId===id)setSelSpotId(spots.find(s=>s.id!==id)?.id||null);}
  function doChangeout(){
    const archive={date:today(),notes:coNote,spots:spots.map(s=>({...s,readings:[...(s.readings||[])]}))};
    onSave({...pipe,spots:spots.map(s=>({...s,readings:[]})),notes,photos,turnsCount,turnHistory,changeoutHistory:[...changeoutHistory,archive]});
  }

  const tab=(id,lbl)=>(<button onClick={()=>setActiveTab(id)} style={{flex:1,padding:"8px 2px",background:"transparent",border:"none",borderBottom:`2px solid ${activeTab===id?C.accent:C.border}`,color:activeTab===id?C.accent:C.muted,fontFamily:F.mono,fontSize:9,cursor:"pointer",letterSpacing:1}}>{lbl}</button>);

  return(
    <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,padding:20,maxHeight:"92vh",overflowY:"auto",border:`1px solid ${C.border}`,borderBottom:"none"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 14px"}}/>

        {/* Header with EDIT button */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:19,fontWeight:800,color:C.text,fontFamily:F.display}}>{pipe.pipeName}</div>
            <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,marginTop:1}}>
              {pipe.area&&<span style={{color:C.accent+"cc",marginRight:6}}>{pipe.area}</span>}
              {pipe.location} -- {pipe.diameter}
            </div>
          </div>
          <div style={{display:"flex",gap:5,alignItems:"center",flexShrink:0}}>
            <Badge status={status}/>
            <button onClick={onEdit}
              style={{background:C.accent+"22",border:`1px solid ${C.accent}55`,color:C.accent,borderRadius:7,padding:"4px 10px",fontSize:10,fontFamily:F.mono,cursor:"pointer",fontWeight:700,letterSpacing:0.5}}>
              EDIT
            </button>
            {confirmDel?(
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>{onDelete(pipe.id);onClose();}} style={{background:C.danger,border:"none",color:"#fff",borderRadius:6,padding:"4px 10px",fontSize:11,fontFamily:F.mono,cursor:"pointer",fontWeight:700}}>DEL</button>
                <button onClick={()=>setConfirmDel(false)} style={{background:C.border,border:"none",color:C.dim,borderRadius:6,padding:"4px 10px",fontSize:11,fontFamily:F.mono,cursor:"pointer"}}>X</button>
              </div>
            ):(
              <button onClick={()=>setConfirmDel(true)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>DEL</button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:12}}>
          {[["NOM",pipe.nominalThickness+" "+pipe.unit],["MIN",av.length?getMin(av).toFixed(1)+" "+pipe.unit:"--"],["AVG",av.length?getAvg(av).toFixed(1)+" "+pipe.unit:"--"],["SPOTS",spots.length]].map(([l,v])=>(
            <div key={l} style={{background:C.card,borderRadius:8,padding:"7px 8px",border:`1px solid ${C.border}`}}>
              <div style={{fontSize:8,color:C.muted,fontFamily:F.mono,marginBottom:2}}>{l}</div>
              <div style={{fontSize:11,fontWeight:700,color:C.accent,fontFamily:F.mono}}>{v}</div>
            </div>
          ))}
        </div>
        {av.length>0&&<WallBar nominal={pipe.nominalThickness} min={getMin(av)}/>}

        {/* Turns + Changeout */}
        <div style={{display:"flex",gap:8,marginTop:12,marginBottom:4}}>
          <div style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:9,color:C.muted,fontFamily:F.mono,letterSpacing:1}}>TURNS</div>
              <div style={{fontSize:18,fontWeight:800,fontFamily:F.mono,color:C.accent}}>{turnsCount}</div>
              {turnHistory.length>0&&(
                <div style={{fontSize:8,color:C.muted,fontFamily:F.mono,marginTop:2}}>
                  Last: {turnHistory[turnHistory.length-1].bottomPosition} bot
                </div>
              )}
            </div>
<button onClick={()=>setShowTurnPicker(true)} style={{background:C.accent+"22",border:`1px solid ${C.accent}44`,color:C.accent,borderRadius:8,padding:"6px 12px",fontFamily:F.mono,fontSize:11,fontWeight:700,cursor:"pointer"}}>MARK TURN</button>
          </div>
          <button onClick={()=>setConfirmCO(true)} style={{flex:1,background:C.warn+"18",border:`1px solid ${C.warn}44`,color:C.warn,borderRadius:10,padding:"10px 8px",fontFamily:F.mono,fontSize:11,fontWeight:700,cursor:"pointer",textAlign:"center",lineHeight:1.3}}>CHANGED OUT</button>
        </div>
        {showTurnPicker&&(
          <div style={{background:C.accent+"11",border:`1px solid ${C.accent}44`,borderRadius:10,padding:14,marginTop:8}}>
            <div style={{fontSize:11,color:C.accent,fontFamily:F.mono,fontWeight:700,marginBottom:8}}>SELECT BOTTOM POSITION AFTER ROTATION</div>
            <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,marginBottom:10}}>Which clock position will be at the bottom once the pipe is rotated?</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
              {CLOCK.map(pos=>(
                <button key={pos} onClick={()=>setPendingBottom(pos)}
                  style={{padding:"8px 12px",borderRadius:8,cursor:"pointer",fontFamily:F.mono,fontSize:11,fontWeight:700,
                    border:`1px solid ${pendingBottom===pos?C.accent:C.border}`,
                    background:pendingBottom===pos?C.accent+"33":C.card,
                    color:pendingBottom===pos?C.accent:C.muted,transition:"all 0.15s"}}>
                  {pos}
                </button>
              ))}
            </div>
            {pendingBottom&&(
              <div style={{fontSize:10,color:C.accent,fontFamily:F.mono,marginBottom:10,background:C.accent+"0d",borderRadius:6,padding:"6px 10px"}}>
                After rotation: {pendingBottom} will be at the bottom
              </div>
            )}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{
                if(!pendingBottom)return;
                const entry={date:today(),bottomPosition:pendingBottom,turnNumber:turnsCount+1};
                setTurnHistory([...turnHistory,entry]);
                setTurnsCount(turnsCount+1);
                setShowTurnPicker(false);setPendingBottom("");
              }} disabled={!pendingBottom}
                style={{flex:1,background:pendingBottom?C.accent:C.border,border:"none",color:pendingBottom?"#000":C.muted,borderRadius:8,padding:"10px",fontWeight:800,fontFamily:F.display,fontSize:14,cursor:pendingBottom?"pointer":"not-allowed"}}>
                CONFIRM ROTATION
              </button>
              <button onClick={()=>{setShowTurnPicker(false);setPendingBottom("");}}
                style={{background:C.border,border:"none",color:C.dim,borderRadius:8,padding:"10px 16px",fontFamily:F.mono,fontSize:12,cursor:"pointer"}}>CANCEL</button>
            </div>
          </div>
        )}
        {confirmCO&&(
          <div style={{background:C.warn+"11",border:`1px solid ${C.warn}44`,borderRadius:10,padding:14,marginTop:8}}>
            <div style={{fontSize:11,color:C.warn,fontFamily:F.mono,fontWeight:700,marginBottom:8}}>Confirm changeout -- current readings archived</div>
            <textarea value={coNote} onChange={e=>setCoNote(e.target.value)} rows={2} placeholder="Reason..." style={{...inputStyle,width:"100%",resize:"none",marginBottom:8,fontFamily:F.sans}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={doChangeout} style={{flex:1,background:C.warn,border:"none",color:"#000",borderRadius:8,padding:"10px",fontWeight:800,fontFamily:F.display,fontSize:14,cursor:"pointer"}}>CONFIRM</button>
              <button onClick={()=>setConfirmCO(false)} style={{background:C.border,border:"none",color:C.dim,borderRadius:8,padding:"10px 16px",fontFamily:F.mono,fontSize:12,cursor:"pointer"}}>CANCEL</button>
            </div>
          </div>
        )}

        <button onClick={()=>setShowMeasure(true)} style={{width:"100%",marginTop:12,background:C.accent,border:"none",color:"#000",borderRadius:10,padding:"12px",fontWeight:800,fontFamily:F.display,fontSize:15,cursor:"pointer",letterSpacing:1}}>
          + ENTER MEASUREMENTS
        </button>

        {/* Tabs */}
        <div style={{display:"flex",marginTop:14,marginBottom:12,borderBottom:`1px solid ${C.border}`}}>
          {tab("spots","SPOTS")}{tab("trends","TRENDS")}{tab("history","HISTORY"+(changeoutHistory.length?"("+changeoutHistory.length+")":""))}{tab("photos","PHOTOS")}
        </div>

        {/* SPOTS TAB */}
        {activeTab==="spots"&&(<div>
          <div style={{background:C.card,borderRadius:10,padding:12,marginBottom:14,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:9,color:C.muted,fontFamily:F.mono,letterSpacing:1,marginBottom:6}}>3D MEASUREMENT MAP -- tap a spot</div>
            <Pipe3D spots={spots} nominal={pipe.nominalThickness} welds={welds} pipeLength={pipe.pipeLength} onSpotClick={setSelSpotId} selectedSpot={selSpotId} unit={pipe.unit}/>
          </div>
          <div style={{marginBottom:12}}>
            {/* Grouped spot view: axial sections, each shows 4 clock positions */}
            {(()=>{
              const axialOrder=[];
              spots.forEach(s=>{if(!axialOrder.includes(s.axialLabel))axialOrder.push(s.axialLabel);});
              const sortedAxials=["Inlet stub",...axialOrder.filter(a=>a!=="Inlet stub"&&a!=="Outlet stub"),"Outlet stub"];
              return sortedAxials.map(axLabel=>{
                const axSpots=spots.filter(s=>s.axialLabel===axLabel);
                if(!axSpots.length)return null;
                const isWeld=axLabel.startsWith("Weld");
                const weldM=isWeld?(welds.find(w=>w.label===axLabel)?.metres):null;
                const axVals=axSpots.flatMap(s=>(s.readings||[]).filter(r=>r.value!=null).map(r=>r.value));
                const axMin=getMin(axVals);
                const axLoss=axMin!=null?getLoss(pipe.nominalThickness,axMin):null;
                const axCol=axLoss!=null?(axLoss>=30?C.danger:axLoss>=15?C.warn:C.ok):C.border;
                const isExp=axialExpanded[axLabel]!==false;
                return(
                  <div key={axLabel} style={{background:C.card,border:`1px solid ${axCol}55`,borderRadius:10,marginBottom:8,overflow:"hidden"}}>
                    <button onClick={()=>setAxialExpanded({...axialExpanded,[axLabel]:!isExp})}
                      style={{width:"100%",background:"transparent",border:"none",cursor:"pointer",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left"}}>
                      <div>
                        <span style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:F.display,letterSpacing:0.5}}>{axLabel}</span>
                        {weldM!=null&&<span style={{fontSize:9,color:C.warn,fontFamily:F.mono,marginLeft:8}}>{Number(parseFloat(weldM).toFixed(2)).toString()}m from inlet flange</span>}
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {axMin!=null&&<span style={{fontSize:12,fontFamily:F.mono,color:axCol,fontWeight:700}}>{axMin.toFixed(1)}{pipe.unit}</span>}
                        {axLoss!=null&&<span style={{fontSize:10,fontFamily:F.mono,color:axCol}}>{axLoss.toFixed(1)}%</span>}
                        <span style={{fontSize:12,color:C.muted}}>{isExp?"-":"+"}</span>
                      </div>
                    </button>
                    {isExp&&(
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderTop:`1px solid ${C.border}`}}>
                        {CLOCK.map(cp=>{
                          const spot=axSpots.find(s=>s.circumLabel===cp);
                          if(!spot)return(
                            <div key={cp} style={{padding:"10px 12px",background:C.bg,opacity:0.3,borderRight:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`}}>
                              <div style={{fontSize:8,color:C.muted,fontFamily:F.mono}}>{cp}</div>
                              <div style={{fontSize:14,color:C.muted,fontFamily:F.mono}}>--</div>
                            </div>
                          );
                          const rr=(spot.readings||[]).filter(r=>r.value!=null);
                          const last=rr.length?rr[rr.length-1].value:null;
                          const loss=last!=null?getLoss(pipe.nominalThickness,last):null;
                          const col=loss!=null?(loss>=30?C.danger:loss>=15?C.warn:C.ok):C.muted;
                          const sel=selSpotId===spot.id;
                          return(
                            <button key={cp} onClick={()=>setSelSpotId(sel?null:spot.id)}
                              style={{padding:"10px 12px",background:sel?col+"20":C.bg,border:"none",
                                borderRight:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,
                                cursor:"pointer",textAlign:"left",outline:sel?`2px inset ${col}`:undefined,transition:"background 0.15s"}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                                <div style={{fontSize:8,color:sel?col:C.muted,fontFamily:F.mono,letterSpacing:0.5,fontWeight:sel?700:400}}>{cp}</div>
                                {loss!=null&&<div style={{fontSize:8,color:col,fontFamily:F.mono}}>{loss.toFixed(1)}%</div>}
                              </div>
                              <div style={{fontSize:17,fontWeight:800,color:last!=null?col:C.muted,fontFamily:F.mono,lineHeight:1}}>
                                {last!=null?last.toFixed(1):"--"}
                                {last!=null&&<span style={{fontSize:9,color:C.muted,fontFamily:F.mono,marginLeft:2}}>{pipe.unit}</span>}
                              </div>
                              {rr.length>0&&(
                                <div style={{fontSize:7,color:C.muted,fontFamily:F.mono,marginTop:2}}>{rr.length} reading{rr.length!==1?"s":""}</div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
            <button onClick={()=>setAddingSpot(true)} style={{width:"100%",padding:"8px",borderRadius:8,border:`1px dashed ${C.border}`,background:"transparent",color:C.accent,fontFamily:F.mono,fontSize:10,cursor:"pointer"}}>+ ADD SPOTS</button>
          </div>

          {/* Add spot panel */}
          {addingSpot&&(
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:12}}>
              <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,marginBottom:10,letterSpacing:1}}>ADD MEASUREMENT SPOTS</div>
              <div style={{fontSize:9,color:C.muted,fontFamily:F.mono,marginBottom:5,letterSpacing:1}}>NAME PREFIX (optional)</div>
              <input style={{...inputStyle,width:"100%",boxSizing:"border-box",marginBottom:12}} placeholder="e.g. Inlet, Mid weld..." value={newName} onChange={e=>setNewName(e.target.value)}/>
              <div style={{fontSize:9,color:C.accent,fontFamily:F.mono,marginBottom:5,letterSpacing:1}}>AXIAL POSITION</div>
              <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                {["Inlet stub","Outlet stub",...welds.map(w=>w.label)].map(p=>(
                  <button key={p} onClick={()=>{setNewAxial(p);if(welds.find(w=>w.label===p))setNewWeldLabel(p);}}
                    style={{padding:"7px 12px",borderRadius:7,border:`1px solid ${newAxial===p?C.accent:C.border}`,background:newAxial===p?C.accent+"22":C.bg,color:newAxial===p?C.accent:C.muted,fontFamily:F.mono,fontSize:10,cursor:"pointer",fontWeight:newAxial===p?700:400}}>
                    {p}
                  </button>
                ))}
              </div>
              <div style={{background:C.accent+"0d",border:`1px solid ${C.accent}33`,borderRadius:8,padding:"8px 10px",marginBottom:12}}>
                <div style={{fontSize:9,color:C.accent,fontFamily:F.mono,marginBottom:2}}>4 spots will be created automatically:</div>
                <div style={{fontSize:10,color:C.dim,fontFamily:F.mono}}>12 oclock, 3 oclock, 6 oclock, 9 oclock</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={addSpot} disabled={!newAxial} style={{flex:1,background:newAxial?C.accent:C.border,border:"none",color:newAxial?"#000":C.muted,borderRadius:8,padding:"9px",fontWeight:700,fontFamily:F.mono,fontSize:12,cursor:newAxial?"pointer":"not-allowed"}}>ADD 4 SPOTS</button>
                <button onClick={()=>{setAddingSpot(false);setNewAxial("");setNewName("");setNewWeldLabel("");}} style={{background:C.border,border:"none",color:C.dim,borderRadius:8,padding:"9px 14px",fontFamily:F.mono,fontSize:12,cursor:"pointer"}}>CANCEL</button>
              </div>
            </div>
          )}

          {/* Selected spot detail */}
          {selSpot&&(
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:C.text,fontFamily:F.display}}>{selSpot.name}</div>
                  <div style={{fontSize:9,color:C.muted,fontFamily:F.mono}}>{selSpot.axialLabel} / {selSpot.circumLabel}{selSpot.weldFrac!=null&&pipe.pipeLength?" @ "+fracToM(selSpot.weldFrac,pipe.pipeLength)+"m":""}</div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{fontSize:10,color:C.muted,fontFamily:F.mono}}>{(selSpot.readings||[]).filter(r=>r.value!=null).length} readings</span>
                  <button onClick={()=>delSpot(selSpot.id)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,borderRadius:6,padding:"3px 7px",fontSize:10,cursor:"pointer"}}>DEL</button>
                </div>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
                {(selSpot.readings||[]).length===0&&<span style={{fontSize:11,color:C.muted,fontFamily:F.mono}}>No readings yet</span>}
                {(selSpot.readings||[]).map((r,i)=>{
                  if(r.value==null)return(<div key={i} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 8px",textAlign:"center"}}><div style={{fontSize:11,fontFamily:F.mono,color:C.muted}}>N/A</div><div style={{fontSize:8,color:C.muted,fontFamily:F.mono}}>{r.date}</div></div>);
                  const col=getLoss(pipe.nominalThickness,r.value)>=30?C.danger:getLoss(pipe.nominalThickness,r.value)>=15?C.warn:C.ok;
                  return(<div key={i} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 8px",textAlign:"center"}}><div style={{fontSize:14,fontWeight:700,fontFamily:F.mono,color:col}}>{r.value.toFixed(1)}</div><div style={{fontSize:8,color:C.muted,fontFamily:F.mono}}>{r.date}</div></div>);
                })}
              </div>
              <div style={{display:"flex",gap:8}}>
                <input type="number" value={newReadVal} onChange={e=>setNewReadVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addReading()} placeholder={"Reading ("+pipe.unit+")..."} style={{...inputStyle,flex:1}} onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
                <button onClick={addReading} style={{background:C.accent,color:"#000",border:"none",borderRadius:8,padding:"9px 16px",fontWeight:700,fontFamily:F.mono,fontSize:12,cursor:"pointer"}}>+ ADD</button>
              </div>
            </div>
          )}
        </div>)}

        {/* TRENDS TAB */}
        {activeTab==="trends"&&(<div>
          {spots.length===0&&<div style={{fontSize:12,color:C.muted,fontFamily:F.mono,padding:20,textAlign:"center"}}>No spots yet</div>}
          {spots.map(s=>(<TrendChart key={s.id} readings={s.readings||[]} nominal={pipe.nominalThickness} label={s.name+" ("+( s.axialLabel||"?")+" / "+(s.circumLabel||"?")+")"}/>))}
        </div>)}

        {/* HISTORY TAB */}
        {activeTab==="history"&&(<div>
          <div style={{fontSize:9,color:C.muted,fontFamily:F.mono,letterSpacing:1,marginBottom:12}}>CHANGEOUT HISTORY</div>
          {changeoutHistory.length===0&&<div style={{fontSize:12,color:C.muted,fontFamily:F.mono,padding:"20px 0",textAlign:"center"}}>No changeouts recorded</div>}
          {[...changeoutHistory].reverse().map((h,hi)=>(
            <div key={hi} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <div style={{fontSize:13,fontWeight:700,color:C.warn,fontFamily:F.display}}>Changeout #{changeoutHistory.length-hi}</div>
                <div style={{fontSize:10,color:C.muted,fontFamily:F.mono}}>{h.date}</div>
              </div>
              {h.notes&&<div style={{fontSize:11,color:C.dim,fontFamily:F.sans,fontStyle:"italic",marginBottom:8}}>"{h.notes}"</div>}
              {(h.spots||[]).map(s=>{
                const sv=(s.readings||[]).filter(r=>r.value!=null).map(r=>r.value);const mn=getMin(sv);
                const col=mn!=null?(getLoss(pipe.nominalThickness,mn)>=30?C.danger:getLoss(pipe.nominalThickness,mn)>=15?C.warn:C.ok):C.muted;
                return(<div key={s.id} style={{background:C.bg,borderRadius:6,padding:"6px 10px",marginBottom:6}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:11,fontFamily:F.mono,color:C.dim}}>{s.name||s.label||"Spot"}</span>
                    {mn!=null&&<span style={{fontSize:11,fontFamily:F.mono,color:col}}>min {mn.toFixed(1)} {pipe.unit}</span>}
                  </div>
                  {sv.length>0&&<TrendChart readings={s.readings||[]} nominal={pipe.nominalThickness} label=""/>}
                </div>);
              })}
            </div>
          ))}
        </div>)}

        {/* PHOTOS TAB */}
        {activeTab==="photos"&&(<div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"flex-start",marginBottom:12}}>
            {photos.map((src,i)=>(<div key={i} style={{position:"relative"}}>
              <img src={src} alt="inspection" style={{width:76,height:76,objectFit:"cover",borderRadius:8,border:`1px solid ${C.border}`,display:"block"}}/>
              <button onClick={()=>setPhotos(photos.filter((_,j)=>j!==i))} style={{position:"absolute",top:-6,right:-6,width:20,height:20,borderRadius:"50%",background:C.danger,border:"none",color:"#fff",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>x</button>
            </div>))}
            <PhotoBtn onAdd={src=>setPhotos([...photos,src])} size={76}/>
          </div>
        </div>)}

        <div style={{marginTop:14}}>
          <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,marginBottom:6,letterSpacing:1}}>NOTES</div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Inspection notes..." style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:F.sans,fontSize:13,resize:"none",outline:"none",boxSizing:"border-box"}}/>
        </div>
        <button onClick={()=>onSave({...pipe,spots,notes,photos,turnsCount,turnHistory,changeoutHistory})}
          style={{width:"100%",marginTop:12,background:C.accent,color:"#000",border:"none",borderRadius:10,padding:"14px",fontWeight:800,fontFamily:F.display,fontSize:16,cursor:"pointer",letterSpacing:1}}>
          SAVE INSPECTION
        </button>
      </div>
      {showMeasure&&(<MeasureModal pipe={pipe} spots={spots} onSave={s=>setSpots(s)} onClose={()=>setShowMeasure(false)}/>)}
    </div>
  );
}

// -- Add Pipe Modal ------------------------------------------------------------
function AddPipeModal({onClose,onAdd,existingAreas}){
  const[form,setForm]=useState({pipeName:"",area:"",location:"",diameter:"",od:null,nominalThickness:"",material:"Carbon Steel",unit:"mm",notes:"",lined:false,liningMaterial:"",sdr:"",pipeType:"straight",pipeLength:"",bendAngle:"90"});
  const[welds,setWelds]=useState([]);
  const[customArea,setCustomArea]=useState(existingAreas.length===0);
  const isValid=form.pipeName&&form.nominalThickness&&form.area&&(form.material==="HDPE"?(form.od&&form.sdr):form.diameter)&&(form.material!=="Carbon Steel"||!form.lined||form.liningMaterial);
  const inputStyle={width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:F.sans,fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:12};
  return(
    <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,padding:24,border:`1px solid ${C.border}`,borderBottom:"none",maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 20px"}}/>
        <div style={{fontSize:20,fontWeight:800,color:C.text,fontFamily:F.display,marginBottom:20}}>NEW PIPE / ASSET</div>
        <input style={inputStyle} placeholder="Pipe / Asset Name *" value={form.pipeName} onChange={e=>setForm({...form,pipeName:e.target.value})}/>
        {/* Area */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,marginBottom:8,letterSpacing:1}}>AREA / ZONE *</div>
          {!customArea&&existingAreas.length>0?(
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}}>
              {existingAreas.map(a=>(<button key={a} onClick={()=>setForm({...form,area:a})} style={{padding:"6px 12px",borderRadius:20,border:`1px solid ${form.area===a?C.accent:C.border}`,background:form.area===a?C.accent+"22":C.card,color:form.area===a?C.accent:C.muted,fontSize:11,fontFamily:F.mono,cursor:"pointer"}}>{a}</button>))}
              <button onClick={()=>{setCustomArea(true);setForm({...form,area:"" });}} style={{padding:"6px 12px",borderRadius:20,border:`1px dashed ${C.border}`,background:"transparent",color:C.muted,fontSize:11,fontFamily:F.mono,cursor:"pointer"}}>+ New</button>
            </div>
          ):(
            <>
              <input style={{...inputStyle,marginBottom:4}} placeholder="e.g. Plant North..." value={form.area} onChange={e=>setForm({...form,area:e.target.value})}/>
              {existingAreas.length>0&&<button onClick={()=>{setCustomArea(false);setForm({...form,area:"" });}} style={{background:"transparent",border:"none",color:C.accent,fontSize:11,fontFamily:F.mono,cursor:"pointer",padding:0,marginBottom:8}}>Pick existing area</button>}
            </>
          )}
        </div>
        <input style={inputStyle} placeholder="Location (e.g. Section 2, Node 4)" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,alignSelf:"center"}}>UNIT:</div>
          {["mm","in"].map(u=>(<button key={u} onClick={()=>setForm({...form,unit:u,diameter:"",od:null,nominalThickness:""})} style={{padding:"6px 16px",borderRadius:7,cursor:"pointer",fontFamily:F.mono,fontSize:11,fontWeight:700,border:`1px solid ${form.unit===u?C.accent:C.border}`,background:form.unit===u?C.accent+"22":C.card,color:form.unit===u?C.accent:C.muted}}>{u}</button>))}
        </div>
        <select style={{...inputStyle,borderColor:C.accent+"55"}} value={form.material} onChange={e=>setForm({...form,material:e.target.value,sdr:"",lined:false,liningMaterial:"",diameter:"",od:null,nominalThickness:""})}>
          {["Carbon Steel","Stainless 316","Stainless 304","Chrome-Moly","Duplex SS","HDPE","Other"].map(m=><option key={m}>{m}</option>)}
        </select>
        <MatFields form={form} setForm={setForm} inputStyle={inputStyle}/>
        <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,marginBottom:6,letterSpacing:1}}>NOMINAL WALL THICKNESS *</div>
        <input type="number" style={inputStyle} placeholder={"Wall thickness ("+form.unit+") *"} value={form.nominalThickness} onChange={e=>setForm({...form,nominalThickness:e.target.value})}/>
        {/* Pipe type */}
        <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,marginBottom:6,letterSpacing:1}}>PIPE TYPE *</div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          {["straight","bend"].map(t=>(<button key={t} onClick={()=>setForm({...form,pipeType:t})} style={{flex:1,padding:"10px",borderRadius:8,cursor:"pointer",fontFamily:F.mono,fontSize:12,fontWeight:700,border:`1px solid ${form.pipeType===t?C.accent:C.border}`,background:form.pipeType===t?C.accent+"22":C.card,color:form.pipeType===t?C.accent:C.muted}}>{t==="straight"?"STRAIGHT":"BEND"}</button>))}
        </div>
        {form.pipeType==="straight"&&(<>
          <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,marginBottom:6,letterSpacing:1}}>PIPE LENGTH (metres)</div>
          <input type="number" style={inputStyle} placeholder="e.g. 6.0" value={form.pipeLength} onChange={e=>setForm({...form,pipeLength:e.target.value})}/>
        </>)}
        {form.pipeType==="bend"&&(
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            {["45","90"].map(a=>(<button key={a} onClick={()=>setForm({...form,bendAngle:a})} style={{flex:1,padding:"10px",borderRadius:8,cursor:"pointer",fontFamily:F.mono,fontSize:13,fontWeight:800,border:`1px solid ${form.bendAngle===a?C.warn:C.border}`,background:form.bendAngle===a?C.warn+"22":C.card,color:form.bendAngle===a?C.warn:C.muted}}>{a} deg</button>))}
          </div>
        )}
        <WeldManager welds={welds} setWelds={setWelds} pipeLength={form.pipeLength?parseFloat(form.pipeLength):null} pipeType={form.pipeType}/>
        <textarea rows={2} style={{...inputStyle,resize:"none",marginTop:12}} placeholder="Notes (optional)" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
        <button onClick={()=>{if(isValid){onAdd({...form,nominalThickness:parseFloat(form.nominalThickness),pipeLength:form.pipeLength?parseFloat(form.pipeLength):null,
            spots:(()=>{const pl2=form.pipeLength?parseFloat(form.pipeLength):null;const s=[];const mk=(nm,ax,cx,wf)=>({id:uid(),name:nm,axialLabel:ax,circumLabel:cx,weldFrac:wf,readings:[]});CLOCK.forEach(cp=>s.push(mk("Inlet "+cp,"Inlet stub",cp,undefined)));welds.forEach(w=>{CLOCK.forEach(cp=>s.push(mk(w.label+" "+cp,w.label,cp,w.frac)));});CLOCK.forEach(cp=>s.push(mk("Outlet "+cp,"Outlet stub",cp,undefined)));return s;})(),
            date:today(),id:uid(),photos:[],turnsCount:0,changeoutHistory:[],welds});onClose();}}}
          style={{width:"100%",background:isValid?C.accent:C.border,color:isValid?"#000":C.muted,border:"none",borderRadius:10,padding:"14px",fontWeight:800,fontFamily:F.display,fontSize:16,cursor:isValid?"pointer":"not-allowed",transition:"all 0.2s"}}>
          ADD ASSET
        </button>
      </div>
    </div>
  );
}

// -- Area Manager -------------------------------------------------------------
function AreaManager({areas,pipes,onClose,onDelete,onAdd}){
  const[newName,setNewName]=useState("");const[confirmDel,setConfirmDel]=useState(null);
  function doAdd(){const n=newName.trim();if(n&&!areas.includes(n)){onAdd(n);setNewName("");}}
  return(
    <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,padding:24,border:`1px solid ${C.border}`,borderBottom:"none",maxHeight:"80vh",overflowY:"auto"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 20px"}}/>
        <div style={{fontSize:20,fontWeight:800,color:C.text,fontFamily:F.display,marginBottom:4}}>MANAGE AREAS</div>
        <div style={{fontSize:11,color:C.muted,fontFamily:F.mono,marginBottom:20}}>Deleting unassigns pipes, does not delete them.</div>
        {areas.map(a=>{const cnt=pipes.filter(p=>p.area===a).length;return(
          <div key={a} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:14,fontWeight:700,color:C.text,fontFamily:F.display}}>{a}</div><div style={{fontSize:10,color:C.muted,fontFamily:F.mono}}>{cnt} pipe{cnt!==1?"s":""}</div></div>
            {confirmDel===a?(<div style={{display:"flex",gap:6}}>
              <button onClick={()=>{onDelete(a);setConfirmDel(null);}} style={{background:C.danger,border:"none",color:"#fff",borderRadius:6,padding:"5px 10px",fontSize:11,fontFamily:F.mono,cursor:"pointer",fontWeight:700}}>REMOVE</button>
              <button onClick={()=>setConfirmDel(null)} style={{background:C.border,border:"none",color:C.dim,borderRadius:6,padding:"5px 10px",fontSize:11,fontFamily:F.mono,cursor:"pointer"}}>CANCEL</button>
            </div>):(<button onClick={()=>setConfirmDel(a)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>DEL</button>)}
          </div>
        );})}
        <div style={{marginTop:16}}>
          <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,marginBottom:8,letterSpacing:1}}>ADD NEW AREA</div>
          <div style={{display:"flex",gap:8}}>
            <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doAdd()} placeholder="Area name..." style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:F.sans,fontSize:14,outline:"none"}} onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
            <button onClick={doAdd} style={{background:C.accent,color:"#000",border:"none",borderRadius:8,padding:"10px 16px",fontWeight:700,fontFamily:F.mono,fontSize:13,cursor:"pointer"}}>ADD</button>
          </div>
        </div>
        <button onClick={onClose} style={{width:"100%",marginTop:20,background:C.border,color:C.dim,border:"none",borderRadius:10,padding:"12px",fontWeight:700,fontFamily:F.display,fontSize:15,cursor:"pointer"}}>DONE</button>
      </div>
    </div>
  );
}

// -- Sample Data --------------------------------------------------------------
const ms=(name,ax,cx,vals,wf)=>({id:uid(),name,axialLabel:ax,circumLabel:cx,weldFrac:wf,readings:vals.map((v,i)=>({value:v,date:"2026-0"+(3+i)+"-"+(10+i*5)}))});
const sampleData=[
  {id:1,pipeName:"Main Feed Line A",area:"Plant North",location:"Section 3, Node 7",diameter:"DN 100",od:114.3,nominalThickness:12.7,unit:"mm",date:"2026-04-10",material:"Carbon Steel",lined:true,liningMaterial:"Rubber",notes:"Corrosion on north side",photos:[],turnsCount:1,turnHistory:[{date:"2026-03-15",bottomPosition:"6 oclock",turnNumber:1}],pipeType:"straight",pipeLength:6.0,welds:[{label:"Weld 1",metres:2.52,frac:0.42}],
    spots:[ms("Inlet 12oc","Inlet stub","12 oclock",[12.1,11.8,11.5]),ms("Inlet 3oc","Inlet stub","3 oclock",[12.3,12.0]),ms("Inlet 6oc","Inlet stub","6 oclock",[11.9,11.5,11.2]),ms("Inlet 9oc","Inlet stub","9 oclock",[12.0,11.7]),ms("Weld 1 12oc","Weld 1","12 oclock",[11.5,11.1,10.8],0.42),ms("Weld 1 6oc","Weld 1","6 oclock",[11.3,10.9,10.5],0.42),ms("Outlet 6oc","Outlet stub","6 oclock",[11.8,11.4,11.0]),ms("Outlet 12oc","Outlet stub","12 oclock",[12.0,11.6])],
    changeoutHistory:[]},
  {id:2,pipeName:"Bypass Header",area:"Plant South",location:"Section 1, Node 2",diameter:"DN 80",od:88.9,nominalThickness:9.5,unit:"mm",date:"2026-04-15",material:"Stainless 316",lined:false,liningMaterial:"",notes:"",photos:[],turnsCount:0,turnHistory:[],pipeType:"bend",bendAngle:"90",welds:[],
    spots:[ms("Inlet 12oc","Inlet stub","12 oclock",[9.4,9.3]),ms("Inlet 6oc","Inlet stub","6 oclock",[9.5,9.2,9.0]),ms("Outlet 12oc","Outlet stub","12 oclock",[9.3,9.1]),ms("Outlet 6oc","Outlet stub","6 oclock",[9.2,9.0])],
    changeoutHistory:[]},
  {id:3,pipeName:"Cooling Return",area:"Utility Block",location:"Section 5, Node 11",diameter:"DN 50",od:60.3,nominalThickness:7.0,unit:"mm",date:"2026-04-20",material:"Carbon Steel",lined:false,liningMaterial:"",notes:"URGENT: Below minimum",photos:[],turnsCount:0,turnHistory:[],pipeType:"straight",pipeLength:3.0,welds:[],
    spots:[ms("Inlet 12oc","Inlet stub","12 oclock",[5.2,5.0,4.8]),ms("Inlet 6oc","Inlet stub","6 oclock",[5.0,4.8,4.5]),ms("Outlet 12oc","Outlet stub","12 oclock",[4.9,4.6,4.3]),ms("Outlet 6oc","Outlet stub","6 oclock",[4.8,4.5,4.2])],
    changeoutHistory:[{date:"2026-01-15",notes:"Previous spool replaced",spots:[ms("Inlet 6oc","Inlet stub","6 oclock",[6.1,5.5,4.9]),ms("Outlet 6oc","Outlet stub","6 oclock",[5.8,5.2,4.5])]}]},
  {id:4,pipeName:"Steam Supply",area:"Plant North",location:"Section 2, Node 4",diameter:"DN 150",od:168.3,nominalThickness:15.0,unit:"mm",date:"2026-04-22",material:"Chrome-Moly",lined:false,liningMaterial:"",notes:"",photos:[],turnsCount:0,turnHistory:[],pipeType:"straight",pipeLength:8.0,welds:[],
    spots:[ms("Inlet 12oc","Inlet stub","12 oclock",[14.8,14.9]),ms("Inlet 6oc","Inlet stub","6 oclock",[15.0,14.8]),ms("Outlet 12oc","Outlet stub","12 oclock",[14.9,14.7]),ms("Outlet 6oc","Outlet stub","6 oclock",[14.8,14.6])],
    changeoutHistory:[]},
  {id:5,pipeName:"HDPE Feed Main",area:"Utility Block",location:"Section 6, Node 2",diameter:"OD 110mm",od:110,nominalThickness:10.0,unit:"mm",date:"2026-04-25",material:"HDPE",sdr:"SDR 11",notes:"",photos:[],turnsCount:0,turnHistory:[],pipeType:"straight",pipeLength:5.0,welds:[],
    spots:[ms("Inlet 12oc","Inlet stub","12 oclock",[10.2,10.0]),ms("Inlet 6oc","Inlet stub","6 oclock",[10.3,10.1]),ms("Outlet 12oc","Outlet stub","12 oclock",[10.1,9.9]),ms("Outlet 6oc","Outlet stub","6 oclock",[10.0,9.8])],
    changeoutHistory:[]},
];


// -- TRIGGER POINT HELPERS ----------------------------------------------------
function getTriggerStatus(pipe,triggerRules){
  const rules=triggerRules||[];
  const rule=rules.find(r=>r.material===pipe.material&&(!r.diameter||r.diameter===pipe.diameter)&&(!r.sdr||r.sdr===pipe.sdr));
  if(!rule)return null;
  const v=allVals(pipe.spots||[]);
  if(!v.length)return null;
  const mn=getMin(v);
  if(mn<=rule.changeout)return{action:"changeout",color:C.danger,label:"CHANGEOUT",min:mn,rule};
  if(mn<=rule.rotate)return{action:"rotate",color:C.warn,label:"ROTATE",min:mn,rule};
  return{action:"ok",color:C.ok,label:"OK",min:mn,rule};
}

// -- SETTINGS MODAL -----------------------------------------------------------
function SettingsModal({triggerRules,setTriggerRules,pipes,onClose,onExport,onImportClick}){
  const[newRule,setNewRule]=useState({material:"Carbon Steel",diameter:"",sdr:"",good:"",rotate:"",changeout:""});
  const mats=["Carbon Steel","Stainless 316","Stainless 304","Chrome-Moly","Duplex SS","HDPE","Other"];
  const isValid=newRule.material&&newRule.rotate&&newRule.changeout;
  function addRule(){
    if(!isValid)return;
    setTriggerRules([...triggerRules,{...newRule,rotate:parseFloat(newRule.rotate),changeout:parseFloat(newRule.changeout),good:newRule.good?parseFloat(newRule.good):null}]);
    setNewRule({material:"Carbon Steel",diameter:"",sdr:"",good:"",rotate:"",changeout:""});
  }
  const inputS={background:C.card,border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px",color:C.text,fontFamily:F.mono,fontSize:12,outline:"none",boxSizing:"border-box"};
  return(
    <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,padding:24,border:`1px solid ${C.border}`,borderBottom:"none",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 20px"}}/>
        <div style={{fontSize:20,fontWeight:800,color:C.text,fontFamily:F.display,marginBottom:4}}>SETTINGS</div>
        <div style={{fontSize:11,color:C.muted,fontFamily:F.mono,marginBottom:20}}>Configure trigger points and data management.</div>

        <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:F.display,marginBottom:12,letterSpacing:0.5}}>TRIGGER POINTS</div>
        <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,marginBottom:12}}>
          Set wall thickness thresholds per material/diameter/SDR. When min reading falls below a threshold, the pipe card updates automatically.
        </div>

        {triggerRules.map((r,ri)=>(
          <div key={ri} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:12,marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:C.text,fontFamily:F.mono}}>{r.material}{r.diameter?" / "+r.diameter:""}{r.sdr?" / "+r.sdr:""}</div>
                <div style={{display:"flex",gap:10,marginTop:6}}>
                  {r.good&&<span style={{fontSize:10,fontFamily:F.mono,color:C.ok}}>Good: &gt;{r.good}mm</span>}
                  <span style={{fontSize:10,fontFamily:F.mono,color:C.warn}}>Rotate: &lt;{r.rotate}mm</span>
                  <span style={{fontSize:10,fontFamily:F.mono,color:C.danger}}>Changeout: &lt;{r.changeout}mm</span>
                </div>
              </div>
              <button onClick={()=>setTriggerRules(triggerRules.filter((_,i)=>i!==ri))} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,borderRadius:6,padding:"4px 8px",fontSize:10,cursor:"pointer"}}>DEL</button>
            </div>
          </div>
        ))}

        <div style={{background:C.card,border:`1px solid ${C.accent}33`,borderRadius:10,padding:14,marginTop:8,marginBottom:20}}>
          <div style={{fontSize:10,color:C.accent,fontFamily:F.mono,marginBottom:10,letterSpacing:1}}>ADD TRIGGER RULE</div>
          <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
            <select style={{...inputS,flex:2}} value={newRule.material} onChange={e=>setNewRule({...newRule,material:e.target.value})}>
              {mats.map(m=><option key={m}>{m}</option>)}
            </select>
          </div>
          <div style={{display:"flex",gap:6,marginBottom:8}}>
            <input style={{...inputS,flex:1}} placeholder="Diameter (opt)" value={newRule.diameter} onChange={e=>setNewRule({...newRule,diameter:e.target.value})}/>
            <input style={{...inputS,flex:1}} placeholder="SDR (opt)" value={newRule.sdr} onChange={e=>setNewRule({...newRule,sdr:e.target.value})}/>
          </div>
          <div style={{fontSize:9,color:C.muted,fontFamily:F.mono,marginBottom:6}}>THRESHOLDS (mm) -- leave Good blank to auto</div>
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            <div style={{flex:1}}>
              <div style={{fontSize:8,color:C.ok,fontFamily:F.mono,marginBottom:3}}>GOOD ABOVE</div>
              <input type="number" style={{...inputS,width:"100%",borderColor:C.ok+"44"}} placeholder="e.g. 30" value={newRule.good} onChange={e=>setNewRule({...newRule,good:e.target.value})}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:8,color:C.warn,fontFamily:F.mono,marginBottom:3}}>ROTATE BELOW</div>
              <input type="number" style={{...inputS,width:"100%",borderColor:C.warn+"44"}} placeholder="e.g. 20" value={newRule.rotate} onChange={e=>setNewRule({...newRule,rotate:e.target.value})}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:8,color:C.danger,fontFamily:F.mono,marginBottom:3}}>CHANGEOUT BELOW</div>
              <input type="number" style={{...inputS,width:"100%",borderColor:C.danger+"44"}} placeholder="e.g. 10" value={newRule.changeout} onChange={e=>setNewRule({...newRule,changeout:e.target.value})}/>
            </div>
          </div>
          <button onClick={addRule} disabled={!isValid} style={{width:"100%",background:isValid?C.accent:C.border,color:isValid?"#000":C.muted,border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontFamily:F.mono,fontSize:12,cursor:isValid?"pointer":"not-allowed"}}>
            + ADD RULE
          </button>
        </div>

        <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:F.display,marginBottom:12,letterSpacing:0.5}}>DATA MANAGEMENT</div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <button onClick={onExport} style={{flex:1,background:"#1a4a6e22",border:"1px solid #1a4a6e88",color:"#4a9fd4",borderRadius:10,padding:"12px 8px",fontFamily:F.mono,fontSize:11,fontWeight:700,cursor:"pointer"}}>
            DOWNLOAD TEMPLATE
          </button>
          <button onClick={onImportClick} style={{flex:1,background:C.ok+"22",border:`1px solid ${C.ok}66`,color:C.ok,borderRadius:10,padding:"12px 8px",fontFamily:F.mono,fontSize:11,fontWeight:700,cursor:"pointer"}}>
            IMPORT DATA
          </button>
        </div>
        <div style={{fontSize:9,color:C.muted,fontFamily:F.mono,marginBottom:4}}>Download Template: saves a blank CSV with the correct column headers ready to fill in.</div>
        <div style={{fontSize:9,color:C.muted,fontFamily:F.mono,marginBottom:20}}>Import Data: select a filled-in CSV to load pipes into the app.</div>

        <button onClick={onClose} style={{width:"100%",background:C.border,color:C.dim,border:"none",borderRadius:10,padding:"12px",fontWeight:700,fontFamily:F.display,fontSize:15,cursor:"pointer"}}>DONE</button>
      </div>
    </div>
  );
}

// -- EXCEL EXPORT / IMPORT ----------------------------------------------------
function exportToCSV(pipes){
  // Downloads a blank template CSV with headers + one example row so users know the format
  const rows=[];
  rows.push(["PipeID","PipeName","Area","Location","Material","Diameter","NominalWT","Unit","PipeType","PipeLength","BendAngle","SDR","Lined","LiningMaterial","Welds","TurnsCount","Notes","Date","SpotName","AxialLabel","CircumLabel","ReadingDate","ReadingValue"]);
  // One example row showing the expected format
  rows.push(["1","Main Header","Plant North","Section 1 Node 2","Carbon Steel","DN 100","12.7","mm","straight","6.0","","","No","","Weld 1:2.5m","0","Example pipe","2026-04-29","Inlet 12 oclock","Inlet stub","12 oclock","2026-04-29","12.1"]);
  rows.push(["1","Main Header","Plant North","Section 1 Node 2","Carbon Steel","DN 100","12.7","mm","straight","6.0","","","No","","Weld 1:2.5m","0","Example pipe","2026-04-29","Inlet 6 oclock","Inlet stub","6 oclock","2026-04-29","11.9"]);
  // Intentionally no more data - user fills in their own pipes below these example rows
  const note = ["# Instructions: Fill in one row per reading. Same PipeID groups rows into one pipe.","","","","","","","","","","","","","","","","","","","","","",""];
  rows.unshift(note);
  const escape=v=>{const s=String(v==null?"":v);return s.indexOf(",")>=0?String.fromCharCode(34)+s+String.fromCharCode(34):s;};
  const csv=rows.map(r=>r.map(escape).join(",")).join(String.fromCharCode(10));
  // Use data URI for maximum compatibility in sandboxed environments
  const encoded="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);
  const a=document.createElement("a");
  a.href=encoded;a.download="pipe_inspection_"+today()+".csv";
  document.body.appendChild(a);a.click();document.body.removeChild(a);
}

function importFromCSV(text,existingPipes){
  const lines=text.trim().split(String.fromCharCode(10));
  if(lines.length<2)return existingPipes;
  const header=lines[0].split(",");
  const col=name=>header.indexOf(name);
  const pipeMap={};
  for(let i=1;i<lines.length;i++){
    // Simple CSV parse (handles quoted fields)
    const row=[];let cur="",inQ=false;
    for(const ch of lines[i]){
      if(ch===String.fromCharCode(34)){inQ=!inQ;}
      else if(ch===","&&!inQ){row.push(cur);cur="";}
      else cur+=ch;
    }
    row.push(cur);
    const get=name=>row[col(name)]||"";
    const pid=get("PipeID");
    if(!pid)continue;
    if(!pipeMap[pid]){
      pipeMap[pid]={id:parseFloat(pid)||uid(),pipeName:get("PipeName"),area:get("Area"),location:get("Location"),
        material:get("Material"),diameter:get("Diameter"),nominalThickness:parseFloat(get("NominalWT"))||0,
        unit:get("Unit")||"mm",pipeType:get("PipeType")||"straight",
        pipeLength:get("PipeLength")?parseFloat(get("PipeLength")):null,
        bendAngle:get("BendAngle")||"90",sdr:get("SDR")||"",
        lined:get("Lined")==="Yes",liningMaterial:get("LiningMaterial")||"",
        turnsCount:parseInt(get("TurnsCount"))||0,notes:get("Notes")||"",date:get("Date")||today(),
        welds:(get("Welds")?get("Welds").split(";").filter(Boolean).map((ws,i)=>{const parts=ws.split(":");const m=parseFloat((parts[1]||"0").replace("m",""));return{label:"Weld "+(i+1),metres:m,frac:0.5};}):[]),
        spots:[],photos:[],changeoutHistory:[]};
    }
    const sName=get("SpotName");const rDate=get("ReadingDate");const rVal=get("ReadingValue");
    if(sName){
      let spot=pipeMap[pid].spots.find(s=>s.name===sName&&s.axialLabel===get("AxialLabel")&&s.circumLabel===get("CircumLabel"));
      if(!spot){
        spot={id:uid(),name:sName,axialLabel:get("AxialLabel"),circumLabel:get("CircumLabel"),weldFrac:undefined,readings:[]};
        pipeMap[pid].spots.push(spot);
      }
      if(rDate&&rVal!==""){
        const v=parseFloat(rVal);
        if(!isNaN(v))spot.readings.push({value:v,date:rDate});
      }
    }
  }
  return Object.values(pipeMap);
}

// -- PDF REPORT ---------------------------------------------------------------
function PDFReport({pipes,triggerRules,onClose}){
  // Compute wear rate (mm per day between first and last reading)
  function wearRate(spots){
    const allR=(spots||[]).flatMap(s=>(s.readings||[]).filter(r=>r.value!=null).map(r=>({...r,spotName:s.name})));
    if(allR.length<2)return null;
    const sorted=allR.sort((a,b)=>new Date(a.date)-new Date(b.date));
    const first=sorted[0],last=sorted[sorted.length-1];
    const days=(new Date(last.date)-new Date(first.date))/(1000*86400);
    if(days<=0)return null;
    return((first.value-last.value)/days);
  }

  const critical=pipes.filter(p=>getStatus(p.nominalThickness,p.spots)==="critical")
    .map(p=>({...p,minVal:getMin(allVals(p.spots)),loss:getLoss(p.nominalThickness,getMin(allVals(p.spots)))}))
    .sort((a,b)=>b.loss-a.loss).slice(0,10);

  const needsRotation=pipes.filter(p=>{
    const ts=getTriggerStatus(p,triggerRules);
    return ts&&ts.action==="rotate";
  }).concat(pipes.filter(p=>p.turnsCount===0&&getStatus(p.nominalThickness,p.spots)==="warning"&&!triggerRules.length));

  const wearRates=pipes.map(p=>({pipe:p,rate:wearRate(p.spots)}))
    .filter(x=>x.rate!=null&&x.rate>0)
    .sort((a,b)=>b.rate-a.rate).slice(0,10);

  function downloadReport(){
    // Builds a self-contained HTML report and downloads it.
    // Open the downloaded file in any browser, then File > Print > Save as PDF.
    const fmt=(v)=>v!=null?parseFloat(v).toFixed(2):"--";
    const ts=new Date().toLocaleString();

    function tRow(cells,header,warn,danger,alt){
      const bg=header?"#1a4a6e":danger?"#fdf2f2":warn?"#fff9ee":alt?"#f5f8fc":"#fff";
      const fc=header?"#fff":"#333";
      return "<tr style=\"background:"+bg+";\">"+cells.map(c=>"<td style=\"padding:5px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;color:"+fc+(header?";font-weight:600;":";")+"\">"+( c==null?"--":c)+"</td>").join("")+"</tr>";
    }

    let h="<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Pipe Inspection Report</title>";
    h+="<style>@media print{@page{size:A4;margin:15mm}}body{font-family:Arial,sans-serif;margin:20px;color:#222;font-size:12px;}";
    h+=".hdr{background:#0a6e5c;color:#fff;padding:14px 16px;}.hdr h1{margin:0;font-size:16px;letter-spacing:.3px}.hdr p{margin:4px 0 0;font-size:10px;color:#a0d4c8}";
    h+=".sum{display:flex;margin:12px 0}.sum .box{flex:1;padding:10px 12px;border:1px solid #e5e7eb}.sum .n{font-size:20px;font-weight:600}.sum .l{font-size:9px;color:#888;letter-spacing:.5px}";
    h+="h2{font-size:13px;margin:18px 0 6px;padding-bottom:4px;border-bottom:2px solid currentColor}";
    h+=".crit{color:#a32d2d}.warn{color:#854f0b}.ok{color:#0f6e56}";
    h+="table{width:100%;border-collapse:collapse;margin-bottom:14px}th{background:#1a4a6e;color:#fff;padding:5px 8px;text-align:left;font-size:11px}td{padding:5px 8px;border-bottom:1px solid #e5e7eb;font-size:11px}tr:nth-child(even){background:#f8f8f8}";
    h+=".footer{margin-top:30px;padding-top:8px;border-top:1px solid #ddd;font-size:9px;color:#aaa;display:flex;justify-content:space-between}";
    h+="</style></head><body>";

    h+="<div class=\"hdr\"><h1>PIPE WALL THICKNESS INSPECTION REPORT</h1><p>Generated: "+ts+" &nbsp;|&nbsp; Total assets: "+pipes.length+"</p></div>";

    h+="<div class=\"sum\">";
    [[critical.length,"CRITICAL","#fdf2f2","#a32d2d"],[needsRotation.length,"TURN REQUIRED","#fff9ee","#854f0b"],[wearRates.length,"WEAR TRENDS","#f0faf6","#0f6e56"],[pipes.length,"TOTAL PIPES","#f0f4ff","#185fa5"]].forEach(([n,l,bg,col])=>{
      h+="<div class=\"box\" style=\"background:"+bg+"\"><div class=\"n\" style=\"color:"+col+"\">"+n+"</div><div class=\"l\">"+l+"</div></div>";
    });
    h+="</div>";

    h+="<h2 class=\"crit\">Top 10 critical pipes (highest wall loss)</h2>";
    if(!critical.length){h+="<p style=\"color:#888\">No critical pipes found.</p>";}
    else{
      h+="<table><thead><tr><th>#</th><th>Pipe name</th><th>Area</th><th>Material</th><th>Diameter</th><th>Nominal WT</th><th>Min reading</th><th>Wall loss</th></tr></thead><tbody>";
      critical.forEach((p,i)=>{
        const rc=p.loss>=30?"color:#a32d2d;font-weight:600":"color:#854f0b;font-weight:600";
        h+="<tr style=\"background:"+(i%2?"#fff":"#fdf5f5")+";\"><td>"+( i+1)+"</td><td style=\"font-weight:500\">"+p.pipeName+"</td><td>"+( p.area||"--")+"</td><td>"+p.material+"</td><td>"+(p.diameter||"--")+"</td><td>"+p.nominalThickness+" "+p.unit+"</td><td style=\""+rc+"\">"+fmt(p.minVal)+" "+p.unit+"</td><td style=\""+rc+"\">"+fmt(p.loss)+"%</td></tr>";
      });
      h+="</tbody></table>";
    }

    h+="<h2 class=\"warn\">Pipes requiring rotation / turning</h2>";
    if(!needsRotation.length){h+="<p style=\"color:#888\">No pipes currently require rotation.</p>";}
    else{
      h+="<table><thead><tr><th>Pipe name</th><th>Area</th><th>Material</th><th>Min reading</th><th>Turns done</th><th>Status</th></tr></thead><tbody>";
      needsRotation.forEach((p,i)=>{
        const mn=getMin(allVals(p.spots));
        h+="<tr style=\"background:"+(i%2?"#fff":"#fff9ee")+";\"><td style=\"font-weight:500\">"+p.pipeName+"</td><td>"+(p.area||"--")+"</td><td>"+p.material+"</td><td style=\"color:#854f0b;font-weight:600\">"+fmt(mn)+" "+p.unit+"</td><td>"+(p.turnsCount||0)+"</td><td><span style=\"background:#faeeda;color:#854f0b;padding:2px 7px;border-radius:3px;font-size:10px;font-weight:600\">TURN REQUIRED</span></td></tr>";
      });
      h+="</tbody></table>";
    }

    h+="<h2 class=\"ok\">Fastest wearing pipes (top 10 by wear rate)</h2>";
    if(!wearRates.length){h+="<p style=\"color:#888\">Need at least 2 dated readings per pipe to calculate wear rate.</p>";}
    else{
      h+="<table><thead><tr><th>#</th><th>Pipe name</th><th>Area</th><th>Material</th><th>Wear rate</th><th>Min reading</th><th>Wall loss</th></tr></thead><tbody>";
      wearRates.forEach(({pipe:p,rate},i)=>{
        const mn=getMin(allVals(p.spots));
        const loss=getLoss(p.nominalThickness,mn);
        const rc=loss>=30?"color:#a32d2d;font-weight:600":"color:#854f0b;font-weight:600";
        h+="<tr style=\"background:"+(i%2?"#fff":"#f5fff8")+";\"><td>"+(i+1)+"</td><td style=\"font-weight:500\">"+p.pipeName+"</td><td>"+(p.area||"--")+"</td><td>"+p.material+"</td><td style=\"color:#854f0b;font-weight:600\">"+fmt(rate)+" "+p.unit+"/day</td><td>"+fmt(mn)+" "+p.unit+"</td><td style=\""+rc+"\">"+fmt(loss)+"%</td></tr>";
      });
      h+="</tbody></table>";
    }

    h+="<div class=\"footer\"><span>Pipe Wall Thickness Tracker -- Confidential Inspection Data</span><span>"+ts+"</span></div>";
    h+="</body></html>";

    const encoded="data:text/html;charset=utf-8,"+encodeURIComponent(h);
    const a=document.createElement("a");
    a.href=encoded;
    a.download="pipe_inspection_report_"+today()+".html";
    document.body.appendChild(a);a.click();document.body.removeChild(a);
  }

  // Preview stats
  return(
    <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,padding:24,border:`1px solid ${C.border}`,borderBottom:"none",maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{fontSize:20,fontWeight:800,color:C.text,fontFamily:F.display,marginBottom:4}}>PDF REPORT</div>
        <div style={{fontSize:11,color:C.muted,fontFamily:F.mono,marginBottom:16}}>Summary of inspection data across all {pipes.length} assets.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
          {[["CRITICAL",critical.length,C.danger],["ROTATE",needsRotation.length,C.warn],["WEAR DATA",wearRates.length,C.accent]].map(([l,n,col])=>(
            <div key={l} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px"}}>
              <div style={{fontSize:18,fontWeight:800,fontFamily:F.mono,color:col}}>{n}</div>
              <div style={{fontSize:9,color:C.muted,fontFamily:F.mono,letterSpacing:1}}>{l}</div>
            </div>
          ))}
        </div>
        {critical.length>0&&(<>
          <div style={{fontSize:11,color:C.danger,fontFamily:F.mono,fontWeight:700,marginBottom:8,letterSpacing:1}}>TOP CRITICAL PIPES</div>
          {critical.slice(0,5).map((p,i)=>(
            <div key={p.id} style={{display:"flex",justifyContent:"space-between",background:C.card,borderRadius:8,padding:"8px 12px",marginBottom:6,border:`1px solid ${C.danger}33`}}>
              <div><span style={{fontFamily:F.mono,fontSize:10,color:C.muted,marginRight:6}}>#{i+1}</span><span style={{fontFamily:F.display,fontSize:13,color:C.text}}>{p.pipeName}</span></div>
              <span style={{fontFamily:F.mono,fontSize:11,color:C.danger}}>{p.loss.toFixed(1)}% loss</span>
            </div>
          ))}
        </>)}
        {wearRates.length>0&&(<>
          <div style={{fontSize:11,color:C.warn,fontFamily:F.mono,fontWeight:700,marginBottom:8,marginTop:12,letterSpacing:1}}>FASTEST WEARING</div>
          {wearRates.slice(0,3).map(({pipe:p,rate})=>(
            <div key={p.id} style={{display:"flex",justifyContent:"space-between",background:C.card,borderRadius:8,padding:"8px 12px",marginBottom:6,border:`1px solid ${C.warn}33`}}>
              <span style={{fontFamily:F.display,fontSize:13,color:C.text}}>{p.pipeName}</span>
              <span style={{fontFamily:F.mono,fontSize:11,color:C.warn}}>{rate.toFixed(4)} {p.unit}/day</span>
            </div>
          ))}
        </>)}
        <button onClick={downloadReport} style={{width:"100%",marginTop:20,background:C.danger,border:"none",color:"#fff",borderRadius:10,padding:"14px",fontWeight:800,fontFamily:F.display,fontSize:16,cursor:"pointer",letterSpacing:1}}>
          DOWNLOAD REPORT
        </button>
        <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,marginTop:8,textAlign:"center"}}>Opens as HTML -- use File &gt; Print &gt; Save as PDF in your browser</div>
        <button onClick={onClose} style={{width:"100%",marginTop:8,background:"transparent",color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px",fontFamily:F.mono,fontSize:12,cursor:"pointer"}}>CLOSE</button>
      </div>
    </div>
  );
}


// -- Alerts Modal -------------------------------------------------------------
function AlertsModal({pipes,triggerRules,onClose,onSelect}){
  const critical=pipes.filter(p=>getStatus(p.nominalThickness,p.spots)==="critical");
  const warning=pipes.filter(p=>getStatus(p.nominalThickness,p.spots)==="warning");
  const triggered=pipes.filter(p=>{
    const ts=getTriggerStatus(p,triggerRules);
    return ts&&(ts.action==="changeout"||ts.action==="rotate");
  });

  function PipeAlertRow({p,badge,badgeColor}){
    const v=allVals(p.spots);
    const mn=getMin(v);
    const loss=getLoss(p.nominalThickness,mn);
    return(
      <div onClick={()=>onSelect(p)} style={{background:C.card,border:`1px solid ${badgeColor}44`,borderRadius:10,
        padding:"12px 14px",marginBottom:8,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:F.display,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.pipeName}</div>
          <div style={{fontSize:10,color:C.muted,fontFamily:F.mono,marginTop:1}}>
            {p.area&&<span style={{color:C.accent+"cc",marginRight:6}}>{p.area}</span>}{p.diameter}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0,marginLeft:10}}>
          <span style={{background:badgeColor+"22",color:badgeColor,border:`1px solid ${badgeColor}44`,borderRadius:4,padding:"2px 8px",fontSize:10,fontFamily:F.mono,fontWeight:700}}>{badge}</span>
          {mn!=null&&<span style={{fontSize:11,fontFamily:F.mono,color:badgeColor}}>{mn.toFixed(1)} {p.unit} / {loss.toFixed(1)}%</span>}
        </div>
      </div>
    );
  }

  const total=critical.length+warning.length;
  return(
    <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.surface,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,padding:24,border:`1px solid ${C.border}`,borderBottom:"none",maxHeight:"88vh",overflowY:"auto"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{fontSize:20,fontWeight:800,color:C.text,fontFamily:F.display,marginBottom:4}}>ALERTS</div>
        <div style={{fontSize:11,color:C.muted,fontFamily:F.mono,marginBottom:20}}>
          {total>0?total+" pipe"+(total!==1?"s require":"  requires")+" attention.":"All pipes are within acceptable limits."}
        </div>

        {critical.length>0&&(
          <>
            <div style={{fontSize:11,color:C.danger,fontFamily:F.mono,fontWeight:700,marginBottom:10,letterSpacing:1,display:"flex",alignItems:"center",gap:8}}>
              <span>CRITICAL -- CHANGEOUT REQUIRED</span>
              <span style={{background:C.danger+"22",borderRadius:10,padding:"2px 8px",fontSize:10}}>{critical.length}</span>
            </div>
            {critical.map(p=><PipeAlertRow key={p.id} p={p} badge="CRITICAL" badgeColor={C.danger}/>)}
          </>
        )}

        {warning.length>0&&(
          <>
            <div style={{fontSize:11,color:C.warn,fontFamily:F.mono,fontWeight:700,marginBottom:10,marginTop:critical.length?16:0,letterSpacing:1,display:"flex",alignItems:"center",gap:8}}>
              <span>WARNING -- TURNING REQUIRED</span>
              <span style={{background:C.warn+"22",borderRadius:10,padding:"2px 8px",fontSize:10}}>{warning.length}</span>
            </div>
            {warning.map(p=><PipeAlertRow key={p.id} p={p} badge="TURN REQ" badgeColor={C.warn}/>)}
          </>
        )}

        {triggered.length>0&&(
          <>
            <div style={{fontSize:11,color:C.warn,fontFamily:F.mono,fontWeight:700,marginBottom:10,marginTop:16,letterSpacing:1,display:"flex",alignItems:"center",gap:8}}>
              <span>TRIGGER RULE ACTIVE</span>
              <span style={{background:C.warn+"22",borderRadius:10,padding:"2px 8px",fontSize:10}}>{triggered.length}</span>
            </div>
            {triggered.map(p=>{
              const ts=getTriggerStatus(p,triggerRules);
              return<PipeAlertRow key={p.id} p={p} badge={ts.label} badgeColor={ts.color}/>;
            })}
          </>
        )}

        {total===0&&triggered.length===0&&(
          <div style={{textAlign:"center",padding:40}}>
            <div style={{fontSize:32,marginBottom:12}}>OK</div>
            <div style={{fontSize:13,color:C.ok,fontFamily:F.mono}}>No alerts at this time.</div>
          </div>
        )}

        <button onClick={onClose} style={{width:"100%",marginTop:20,background:C.border,color:C.dim,border:"none",borderRadius:10,padding:"12px",fontWeight:700,fontFamily:F.display,fontSize:15,cursor:"pointer"}}>
          CLOSE
        </button>
      </div>
    </div>
  );
}

// -- localStorage helpers -----------------------------------------------------
// -- Supabase config (edit these two lines) -----------------------------------
const SUPABASE_URL="https://skfmtshibkfpwgwxscql.supabase.co";
const SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrZm10c2hpYmtmcHdnd3hzY3FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDQ2OTIsImV4cCI6MjA5MzAyMDY5Mn0.uK3b45fOqPnICRTSaT8alkmmCn72qDsaUTy9z0MxA4Y";
// Lightweight Supabase REST client - no npm package needed
const sb={
  _h:{"apikey":SUPABASE_KEY,"Authorization":"Bearer "+SUPABASE_KEY,"Content-Type":"application/json"},
  from(table){
    const base=SUPABASE_URL+"/rest/v1/"+table;
    const h=this._h;
    return{
      async upsert(data){
        try{
          const r=await fetch(base,{method:"POST",headers:{...h,"Prefer":"resolution=merge-duplicates"},body:JSON.stringify(data)});
          return{error:r.ok?null:await r.text()};
        }catch(e){return{error:e.message};}
      },
      async selectAll(){
        try{
          const r=await fetch(base+"?select=*",{headers:h});
          return r.ok?{data:await r.json(),error:null}:{data:null,error:await r.text()};
        }catch(e){return{data:null,error:e.message};}
      },
      async delete(id){
        try{
          const r=await fetch(base+"?id=eq."+encodeURIComponent(id),{method:"DELETE",headers:h});
          return{error:r.ok?null:await r.text()};
        }catch(e){return{error:e.message};}
      }
    };
  }
};

const STORAGE_KEYS={pipes:"pwt_pipes",areas:"pwt_areas",rules:"pwt_rules"};
function loadFromStorage(key,fallback){
  try{
    const raw=localStorage.getItem(key);
    if(raw===null)return fallback;
    return JSON.parse(raw);
  }catch(e){return fallback;}
}
function saveToStorage(key,value){
  try{localStorage.setItem(key,JSON.stringify(value));}
  catch(e){console.warn("localStorage save failed:",e);}
}

// -- Sync indicator -----------------------------------------------------------
function SyncIndicator(){
  const[online,setOnline]=React.useState(navigator.onLine);
  React.useEffect(()=>{
    const on=()=>setOnline(true);
    const off=()=>setOnline(false);
    window.addEventListener("online",on);
    window.addEventListener("offline",off);
    return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off);};
  },[]);
  return(
    <div style={{background:"#0d1520",borderBottom:"1px solid #1e2d3d",padding:"3px 16px",display:"flex",alignItems:"center",gap:6}}>
      <div style={{width:6,height:6,borderRadius:"50%",background:online?C.ok:C.warn,boxShadow:online?"0 0 4px "+C.ok:"none"}}/>
      <span style={{fontSize:9,color:online?C.ok:C.warn,fontFamily:F.mono,letterSpacing:0.5}}>
        {online?"ONLINE - data syncing to cloud":"OFFLINE - changes saved locally, will sync when online"}
      </span>
    </div>
  );
}

// -- App Root -----------------------------------------------------------------
export default function App(){
  const[pipes,setPipesRaw]=useState(()=>loadFromStorage(STORAGE_KEYS.pipes,sampleData));
  const[customAreas,setCustomAreasRaw]=useState(()=>loadFromStorage(STORAGE_KEYS.areas,[]));
  const[triggerRules,setTriggerRulesRaw]=useState(()=>loadFromStorage(STORAGE_KEYS.rules,[
    {material:"HDPE",diameter:"OD 560mm",sdr:"SDR 11",good:30,rotate:20,changeout:10},
  ]));

  // Wrap setters to auto-save to localStorage on every change
  function setPipes(val){
    const next=typeof val==="function"?val(pipes):val;
    saveToStorage(STORAGE_KEYS.pipes,next);setPipesRaw(next);
    if(navigator.onLine)next.forEach(p=>{sb.from("pipes").upsert({id:String(p.id),data:p,updated_at:new Date().toISOString()});});
  }
  function setCustomAreas(val){const next=typeof val==="function"?val(customAreas):val;saveToStorage(STORAGE_KEYS.areas,next);setCustomAreasRaw(next);}

  // On load: pull latest pipes from Supabase and merge with local data
  useEffect(()=>{
    if(!navigator.onLine)return;
    sb.from("pipes").selectAll().then(({data,error})=>{
      if(error||!data||!data.length)return;
      const remote=data.filter(r=>r.data&&r.data.id).map(r=>({...r.data,_syncedAt:r.updated_at}));
      if(!remote.length)return;
      // Merge: keep local version if newer, remote if newer
      const localMap=Object.fromEntries((loadFromStorage(STORAGE_KEYS.pipes,[])).map(p=>[String(p.id),p]));
      remote.forEach(rp=>{
        const lp=localMap[String(rp.id)];
        const rts=new Date(rp._syncedAt||0).getTime();
        const lts=lp?new Date(lp._syncedAt||0).getTime():0;
        if(!lp||rts>lts)localMap[String(rp.id)]=rp;
      });
      const merged=Object.values(localMap);
      saveToStorage(STORAGE_KEYS.pipes,merged);
      setPipesRaw(merged);
    });
  },[]);
  function setTriggerRules(val){const next=typeof val==="function"?val(triggerRules):val;saveToStorage(STORAGE_KEYS.rules,next);setTriggerRulesRaw(next);}
  const[selected,setSelected]=useState(null);
  const[editPipe,setEditPipe]=useState(null);
  const[addOpen,setAddOpen]=useState(false);
  const[areaOpen,setAreaOpen]=useState(false);
  const[scanOpen,setScanOpen]=useState(false);
  const[settingsOpen,setSettingsOpen]=useState(false);
  const[reportOpen,setReportOpen]=useState(false);
  const[alertsOpen,setAlertsOpen]=useState(false);
  const[qrPipe,setQrPipe]=useState(null);
  const[measurePipe,setMeasurePipe]=useState(null);
  const[importRef]=useState({current:null});
  const[search,setSearch]=useState("");
  const[statusFilter,setStatusFilter]=useState("all");
  const[areaFilter,setAreaFilter]=useState("all");

  const areas=[...new Set([...pipes.map(p=>p.area).filter(Boolean),...customAreas])].sort();
  const filtered=pipes.filter(p=>{
    const q=search.toLowerCase();
    return(p.pipeName.toLowerCase().includes(q)||(p.location||"").toLowerCase().includes(q)||(p.area||"").toLowerCase().includes(q))&&
      (statusFilter==="all"||getStatus(p.nominalThickness,p.spots)===statusFilter)&&
      (areaFilter==="all"||p.area===areaFilter);
  });
  const grouped=areaFilter==="all"?
    (()=>{const g={};areas.forEach(a=>{g[a]=filtered.filter(p=>p.area===a);});const na=filtered.filter(p=>!p.area);if(na.length)g["Unassigned"]=na;return g;})()
    :{[areaFilter]:filtered};
  const counts={
    critical:pipes.filter(p=>getStatus(p.nominalThickness,p.spots)==="critical").length,
    warning:pipes.filter(p=>getStatus(p.nominalThickness,p.spots)==="warning").length,
    ok:pipes.filter(p=>getStatus(p.nominalThickness,p.spots)==="ok").length,
  };
  function save(updated){setPipes(pipes.map(p=>p.id===updated.id?updated:p));setSelected(null);}
  function del(id){
    const next=pipes.filter(p=>p.id!==id);
    saveToStorage(STORAGE_KEYS.pipes,next);setPipesRaw(next);
    sb.from("pipes").delete(String(id));
    if(selected?.id===id)setSelected(null);
  }
  function delArea(name){setPipes(pipes.map(p=>p.area===name?{...p,area:""}:p));setCustomAreas(customAreas.filter(a=>a!==name));if(areaFilter===name)setAreaFilter("all");}
  function handleExport(){exportToCSV(pipes);}
  function handleImport(e){
    const f=e.target.files[0];if(!f)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const imported=importFromCSV(ev.target.result,pipes);
      if(imported.length)setPipes(imported);
    };
    reader.readAsText(f);e.target.value="";
  }

  return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:F.sans,maxWidth:480,margin:"0 auto",position:"relative"}}>
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;800&family=DM+Sans:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      <SyncIndicator/>
      {/* Header */}
      <div style={{padding:"48px 20px 16px",background:`linear-gradient(180deg,${C.surface},${C.bg})`,borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:11,color:C.accent,fontFamily:F.mono,letterSpacing:2,marginBottom:4}}>UT INSPECTION</div>
            <div style={{fontSize:28,fontWeight:800,fontFamily:F.display,letterSpacing:1,lineHeight:1}}>PIPE WALL<br/>THICKNESS</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setScanOpen(true)} style={{background:C.surface,border:`1px solid ${C.accent}55`,color:C.accent,borderRadius:10,width:44,height:44,fontSize:13,cursor:"pointer",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.mono}}>QR</button>
            <button onClick={()=>setAddOpen(true)} style={{background:C.accent,border:"none",color:"#000",borderRadius:10,width:44,height:44,fontSize:22,cursor:"pointer",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:16}}>
          {[["CRITICAL",counts.critical,C.danger,"critical"],["TURN REQ",counts.warning,C.warn,"warning"],["GOOD",counts.ok,C.ok,"ok"]].map(([label,count,color,key])=>(
            <div key={key} onClick={()=>setStatusFilter(statusFilter===key?"all":key)} style={{background:statusFilter===key?color+"22":C.card,border:`1px solid ${statusFilter===key?color:C.border}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",transition:"all 0.2s"}}>
              <div style={{fontSize:20,fontWeight:800,fontFamily:F.mono,color}}>{count}</div>
              <div style={{fontSize:9,fontFamily:F.mono,color:C.muted,letterSpacing:1}}>{label}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Search + areas */}
      <div style={{padding:"12px 20px 0"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search pipes, areas, locations..." style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontFamily:F.sans,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
        <div style={{display:"flex",gap:6,marginTop:10,overflowX:"auto",paddingBottom:6,alignItems:"center"}}>
          <button onClick={()=>setAreaFilter("all")} style={{flexShrink:0,padding:"5px 12px",borderRadius:20,border:`1px solid ${areaFilter==="all"?C.accent:C.border}`,background:areaFilter==="all"?C.accent+"22":C.card,color:areaFilter==="all"?C.accent:C.muted,fontSize:11,fontFamily:F.mono,cursor:"pointer",whiteSpace:"nowrap"}}>ALL</button>
          {areas.map(a=>(<button key={a} onClick={()=>setAreaFilter(areaFilter===a?"all":a)} style={{flexShrink:0,padding:"5px 12px",borderRadius:20,border:`1px solid ${areaFilter===a?C.accent:C.border}`,background:areaFilter===a?C.accent+"22":C.card,color:areaFilter===a?C.accent:C.muted,fontSize:11,fontFamily:F.mono,cursor:"pointer",whiteSpace:"nowrap"}}>{a}</button>))}
          <button onClick={()=>setAreaOpen(true)} style={{flexShrink:0,padding:"5px 10px",borderRadius:20,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:11,fontFamily:F.mono,cursor:"pointer",whiteSpace:"nowrap"}}>Areas</button>
        </div>
      </div>
      {/* Pipe list */}
      <div style={{padding:"12px 20px 100px"}}>
        {filtered.length===0?<div style={{textAlign:"center",padding:40,color:C.muted,fontFamily:F.mono,fontSize:13}}>NO ASSETS FOUND</div>:
          Object.entries(grouped).map(([area,areaPipes])=>{
            if(!areaPipes.length)return null;
            return(<div key={area}>
              {areaFilter==="all"&&(<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,marginTop:6}}>
                <div style={{fontSize:10,fontFamily:F.mono,color:C.accent,letterSpacing:2,fontWeight:700,whiteSpace:"nowrap"}}>{area.toUpperCase()}</div>
                <div style={{flex:1,height:1,background:C.border}}/>
                <div style={{fontSize:10,fontFamily:F.mono,color:C.muted,whiteSpace:"nowrap"}}>{areaPipes.length} pipe{areaPipes.length!==1?"s":""}</div>
              </div>)}
              {areaPipes.map(pipe=>(<PipeCard key={pipe.id} pipe={pipe} onClick={()=>setSelected(pipe)} onDelete={()=>del(pipe.id)} onMeasure={()=>setMeasurePipe(pipe)} onQR={()=>setQrPipe(pipe)}/>))}
            </div>);
          })
        }
      </div>
      {/* PDF Report button in header area */}
      <div style={{padding:"0 20px 4px",display:"flex",justifyContent:"flex-end"}}>
        <button onClick={()=>setReportOpen(true)}
          style={{background:C.danger+"22",border:`1px solid ${C.danger}44`,color:C.danger,borderRadius:8,padding:"6px 14px",fontFamily:F.mono,fontSize:10,fontWeight:700,cursor:"pointer",letterSpacing:0.5}}>
          PDF REPORT
        </button>
      </div>
      {/* Bottom nav */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-around",padding:"10px 0 24px"}}>
        <div style={{textAlign:"center",cursor:"pointer"}}><div style={{fontSize:9,fontFamily:F.mono,color:C.accent,letterSpacing:1}}>DASHBOARD</div></div>
        <div style={{textAlign:"center",cursor:"pointer"}} onClick={()=>setAlertsOpen(true)}><div style={{fontSize:9,fontFamily:F.mono,color:counts.critical+counts.warning>0?C.danger:C.muted,letterSpacing:1}}>ALERTS{counts.critical+counts.warning>0?" ("+(counts.critical+counts.warning)+")":""}</div></div>
        <div style={{textAlign:"center",cursor:"pointer"}} onClick={()=>setReportOpen(true)}><div style={{fontSize:9,fontFamily:F.mono,color:C.muted,letterSpacing:1}}>REPORT</div></div>
        <div style={{textAlign:"center",cursor:"pointer"}} onClick={()=>setSettingsOpen(true)}><div style={{fontSize:9,fontFamily:F.mono,color:C.muted,letterSpacing:1}}>SETTINGS</div></div>
      </div>
      {/* Modals */}
      {selected&&<DetailModal pipe={selected} onClose={()=>setSelected(null)} onSave={save} onDelete={del} onEdit={()=>{setEditPipe(selected);setSelected(null);}}/>}
      {editPipe&&<EditPipeModal pipe={editPipe} onClose={()=>setEditPipe(null)} onSave={updated=>{save(updated);setEditPipe(null);}}/>}
      {addOpen&&<AddPipeModal onClose={()=>setAddOpen(false)} onAdd={p=>setPipes([...pipes,p])} existingAreas={areas}/>}
      {areaOpen&&<AreaManager areas={areas} pipes={pipes} onClose={()=>setAreaOpen(false)} onDelete={delArea} onAdd={n=>{if(!customAreas.includes(n))setCustomAreas([...customAreas,n]);}}/>}
      {qrPipe&&<QRModal pipe={qrPipe} onClose={()=>setQrPipe(null)}/>}
      {scanOpen&&<ScanModal pipes={pipes} onFound={p=>{setScanOpen(false);setSelected(p);}} onClose={()=>setScanOpen(false)}/>}
      {measurePipe&&<MeasureModal pipe={measurePipe} spots={measurePipe.spots||[]} onSave={spots=>{ setPipes(pipes.map(p=>p.id===measurePipe.id?{...p,spots}:p));setMeasurePipe(null);}} onClose={()=>setMeasurePipe(null)}/>}
      {settingsOpen&&<SettingsModal triggerRules={triggerRules} setTriggerRules={setTriggerRules} pipes={pipes} onClose={()=>setSettingsOpen(false)} onExport={handleExport} onImportClick={()=>document.getElementById("csv-import-input").click()}/>}
      {reportOpen&&<PDFReport pipes={pipes} triggerRules={triggerRules} onClose={()=>setReportOpen(false)}/> }
      {alertsOpen&&<AlertsModal pipes={pipes} triggerRules={triggerRules} onClose={()=>setAlertsOpen(false)} onSelect={p=>{setAlertsOpen(false);setSelected(p);}}/> }
      <input id="csv-import-input" type="file" accept=".csv,.txt" style={{display:"none"}} onChange={handleImport}/>
    </div>
  );
}
