'use client'
import { useEffect, useRef, useState, useMemo } from 'react'

const SENSORS_REL = [
  { x: 0.2, y: 0.3 },
  { x: 0.8, y: 0.25 },
  { x: 0.5, y: 0.8 },
]

const VS_SOURCE = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const FS_SOURCE = `
  precision mediump float;
  uniform vec2 u_resolution;
  uniform vec2 u_sensors[3];
  uniform vec2 u_source;

  void main() {
      // Convert to physical pixels from top-left
      vec2 frag = gl_FragCoord.xy;
      frag.y = u_resolution.y - frag.y;

      // Scale everything by resolution width to be device-agnostic [0..1] horizontally
      vec2 uv = frag / u_resolution.x;
      vec2 source = u_source / u_resolution.x;
      vec2 s0 = u_sensors[0] / u_resolution.x;
      vec2 s1 = u_sensors[1] / u_resolution.x;
      vec2 s2 = u_sensors[2] / u_resolution.x;

      float d0 = distance(source, s0);
      float d1 = distance(source, s1);
      float d2 = distance(source, s2);

      // True TDOAs relative to sensor 0
      float t1 = d1 - d0;
      float t2 = d2 - d0;

      // Pixel TDOAs
      float pd0 = distance(uv, s0);
      float pd1 = distance(uv, s1);
      float pd2 = distance(uv, s2);

      float pt1 = pd1 - pd0;
      float pt2 = pd2 - pd0;

      // Errors
      float e1 = pt1 - t1;
      float e2 = pt2 - t2;
      float error = (e1*e1 + e2*e2);

      // Map error to heatmap value
      float val = exp(-error / 0.0003);

      // Cross-correlation isochrone lines (hyperbolas)
      float line1 = exp(-e1*e1 / 0.00004);
      float line2 = exp(-e2*e2 / 0.00004);
      float t3 = d2 - d1;
      float pt3 = pd2 - pd1;
      float line3 = exp(-(pt3 - t3)*(pt3 - t3) / 0.00004);

      float lines = max(line1, max(line2, line3)) * 0.35;

      vec3 bg = vec3(10.0/255.0, 22.0/255.0, 40.0/255.0); // ocean-dark
      vec3 teal = vec3(78.0/255.0, 205.0/255.0, 196.0/255.0); // #4ecdc4
      vec3 white = vec3(1.0);

      vec3 color = mix(bg, teal, val + lines);
      color = mix(color, white, pow(val, 5.0)); // hot white center

      gl_FragColor = vec4(color, 1.0);
  }
`

export default function LocalisationDemo() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<{ gl: WebGLRenderingContext, program: WebGLProgram, locs: any } | null>(null)
  
  const [sourceRel, setSourceRel] = useState({ x: 0.65, y: 0.45 })
  const [dim, setDim] = useState({ w: 0, h: 0 })
  const [interacted, setInteracted] = useState(false)

  // Handle resizing
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDim({ w: width, h: height })
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Init WebGL
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false })
    if (!gl) return

    const vs = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vs, VS_SOURCE)
    gl.compileShader(vs)

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fs, FS_SOURCE)
    gl.compileShader(fs)

    const program = gl.createProgram()!
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,  1, 1
    ]), gl.STATIC_DRAW)

    const posLoc = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    glRef.current = {
      gl,
      program,
      locs: {
        u_resolution: gl.getUniformLocation(program, 'u_resolution'),
        u_source: gl.getUniformLocation(program, 'u_source'),
        u_sensors: gl.getUniformLocation(program, 'u_sensors'),
      }
    }
  }, [])

  // Render frame
  useEffect(() => {
    if (!glRef.current || dim.w === 0) return
    const { gl, program, locs } = glRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    canvasRef.current!.width = dim.w * dpr
    canvasRef.current!.height = dim.h * dpr
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

    gl.useProgram(program)
    gl.uniform2f(locs.u_resolution, dim.w * dpr, dim.h * dpr)
    gl.uniform2f(locs.u_source, sourceRel.x * dim.w * dpr, sourceRel.y * dim.h * dpr)

    const sensorsFlat = new Float32Array(6)
    SENSORS_REL.forEach((s, i) => {
      sensorsFlat[i * 2] = s.x * dim.w * dpr
      sensorsFlat[i * 2 + 1] = s.y * dim.h * dpr
    })
    gl.uniform2fv(locs.u_sensors, sensorsFlat)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }, [dim, sourceRel])

  // Interactions
  const handlePointerDown = (e: React.PointerEvent) => {
    setInteracted(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    updateSource(e)
  }
  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.buttons > 0) updateSource(e)
  }
  const updateSource = (e: React.PointerEvent) => {
    const rect = containerRef.current!.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    setSourceRel({ x, y })
  }

  // Derived positions for SVG overlays
  const sensors = SENSORS_REL.map(s => ({ x: s.x * dim.w, y: s.y * dim.h }))
  const source = { x: sourceRel.x * dim.w, y: sourceRel.y * dim.h }

  // TDOA Math (assuming 1 unit = 1 pixel, c = 343 "pixels"/s just for display scaling)
  const dists = sensors.map(s => Math.hypot(s.x - source.x, s.y - source.y))
  const minDist = Math.min(...dists)
  const tdoas = dists.map(d => ((d - minDist) / 343.0) * 1000) // ms relative to first arrival

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-[60vh] min-h-[450px] max-h-[800px] bg-ocean-dark rounded-2xl overflow-hidden border border-white/10 shadow-2xl touch-none cursor-crosshair"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {sensors.map((s, i) => (
          <line 
            key={i} 
            x1={source.x} y1={source.y} 
            x2={s.x} y2={s.y} 
            stroke="#4ecdc4" strokeWidth="1.5" strokeOpacity="0.3" strokeDasharray="4 4" 
          />
        ))}
      </svg>

      {sensors.map((s, i) => {
        const midX = (source.x + s.x) / 2
        const midY = (source.y + s.y) / 2
        return (
          <div key={i} className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2" style={{ left: midX, top: midY }}>
            <div className="bg-ocean-dark/80 backdrop-blur-md text-brand-100 font-mono text-[10px] sm:text-xs px-2 py-1 rounded border border-white/10 shadow-lg whitespace-nowrap">
              Δt: +{tdoas[i].toFixed(1)} ms
            </div>
          </div>
        )
      })}

      {sensors.map((s, i) => (
        <div key={`s-${i}`} className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none" style={{ left: s.x, top: s.y }}>
          <div className="w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.7)] border-2 border-ocean-dark" />
          <span className="mt-1.5 text-[10px] text-white/80 font-mono font-medium drop-shadow-md">S{i+1}</span>
        </div>
      ))}

      <div className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: source.x, top: source.y }}>
        <div className="w-5 h-5 bg-[#4ecdc4] rounded-full shadow-[0_0_20px_#4ecdc4] border-2 border-ocean-dark" />
        <div className="absolute inset-0 rounded-full border border-[#4ecdc4] animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
      </div>

      {!interacted && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-white/90 text-sm px-6 py-2.5 rounded-full border border-white/20 pointer-events-none animate-pulse whitespace-nowrap drop-shadow-xl">
          Click or drag to move the sound source
        </div>
      )}
    </div>
  )
}