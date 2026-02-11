'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Pencil, Eraser, Trash2, Circle, Square, Minus, X,
    Maximize2, Minimize2, GripVertical, Move, ZoomIn, ZoomOut
} from 'lucide-react'

interface BlackboardProps {
    isOpen: boolean
    onClose: () => void
}

type Tool = 'pen' | 'eraser' | 'line' | 'rectangle' | 'circle'

const BOARD_BG = '#000000' // Pure black background

const COLORS = [
    { name: 'White', value: '#FFFFFF' },
    { name: 'Yellow', value: '#FFD93D' },
    { name: 'Orange', value: '#FF8C42' },
    { name: 'Red', value: '#FF6B6B' },
    { name: 'Pink', value: '#F78FB3' },
    { name: 'Purple', value: '#9B59B6' },
    { name: 'Blue', value: '#74B9FF' },
    { name: 'Green', value: '#55EFC4' },
]

const BRUSH_SIZES = [
    { name: 'Fine', value: 2 },
    { name: 'Medium', value: 5 },
    { name: 'Thick', value: 10 },
    { name: 'Bold', value: 15 },
]

export function Blackboard({ isOpen, onClose }: BlackboardProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const previewCanvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const [isDrawing, setIsDrawing] = useState(false)
    const [tool, setTool] = useState<Tool>('pen')
    const [color, setColor] = useState('#FFFFFF')
    const [brushSize, setBrushSize] = useState(5)
    const [isMinimized, setIsMinimized] = useState(false)

    // Position and size
    const [position, setPosition] = useState({ x: 100, y: 100 })
    const [size, setSize] = useState({ width: 700, height: 500 })

    // Drag/Resize state
    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 })

    // Shape drawing
    const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null)
    const [savedImageData, setSavedImageData] = useState<ImageData | null>(null)

    // Persist canvas content when minimized
    const [minimizedContent, setMinimizedContent] = useState<string | null>(null)

    // Zoom state
    const [zoom, setZoom] = useState(1)
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
    const lastTouchDistance = useRef<number | null>(null)

    // Initialize canvas with background
    const initCanvas = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.fillStyle = BOARD_BG
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Add subtle grid pattern for chalkboard effect
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'
        ctx.lineWidth = 1
        for (let i = 0; i < canvas.width; i += 20) {
            ctx.beginPath()
            ctx.moveTo(i, 0)
            ctx.lineTo(i, canvas.height)
            ctx.stroke()
        }
        for (let i = 0; i < canvas.height; i += 20) {
            ctx.beginPath()
            ctx.moveTo(0, i)
            ctx.lineTo(canvas.width, i)
            ctx.stroke()
        }
    }, [])

    // Set up canvas when opened or size changes
    useEffect(() => {
        if (!isOpen || isMinimized) return

        const canvas = canvasRef.current
        const previewCanvas = previewCanvasRef.current
        if (!canvas || !previewCanvas) return

        const toolbarHeight = 110 // Approximate toolbar height
        const canvasHeight = size.height - toolbarHeight
        const canvasWidth = size.width

        // Only resize if dimensions actually changed
        if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
            // Save current content
            const ctx = canvas.getContext('2d')
            let imageData: ImageData | null = null
            if (ctx && canvas.width > 0 && canvas.height > 0) {
                imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            }

            // Set new dimensions
            canvas.width = canvasWidth
            canvas.height = canvasHeight
            previewCanvas.width = canvasWidth
            previewCanvas.height = canvasHeight

            // Restore content or initialize
            if (imageData && ctx) {
                ctx.fillStyle = BOARD_BG
                ctx.fillRect(0, 0, canvas.width, canvas.height)
                ctx.putImageData(imageData, 0, 0)
            } else {
                initCanvas()
            }
        }
    }, [isOpen, isMinimized, size, initCanvas])

    // Initial setup and restore from minimize
    useEffect(() => {
        if (isOpen && !isMinimized) {
            const canvas = canvasRef.current
            if (!canvas) {
                setTimeout(initCanvas, 100)
                return
            }

            // Restore content from minimize if available
            if (minimizedContent) {
                const ctx = canvas.getContext('2d')
                if (ctx) {
                    const img = new Image()
                    img.onload = () => {
                        ctx.drawImage(img, 0, 0)
                    }
                    img.src = minimizedContent
                }
            } else {
                setTimeout(initCanvas, 100)
            }
        }
    }, [isOpen, isMinimized, initCanvas, minimizedContent])

    const getMousePosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        if (!canvas) return { x: 0, y: 0 }

        const rect = canvas.getBoundingClientRect()
        // Account for zoom when calculating position
        return {
            x: (e.clientX - rect.left) / zoom,
            y: (e.clientY - rect.top) / zoom
        }
    }

    // Wheel zoom handler
    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        setZoom(prev => Math.min(3, Math.max(0.5, prev + delta)))
    }

    // Pinch-to-zoom handlers for touch devices
    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (e.touches.length === 2) {
            const distance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            )
            lastTouchDistance.current = distance
        }
    }

    const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (e.touches.length === 2 && lastTouchDistance.current) {
            const distance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            )
            const delta = (distance - lastTouchDistance.current) / 200
            setZoom(prev => Math.min(3, Math.max(0.5, prev + delta)))
            lastTouchDistance.current = distance
        }
    }

    const handleTouchEnd = () => {
        lastTouchDistance.current = null
    }

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const pos = getMousePosition(e)
        setIsDrawing(true)

        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!ctx || !canvas) return

        if (tool === 'line' || tool === 'rectangle' || tool === 'circle') {
            // Save current canvas state for shape preview
            setSavedImageData(ctx.getImageData(0, 0, canvas.width, canvas.height))
            setShapeStart(pos)
        } else {
            ctx.beginPath()
            ctx.moveTo(pos.x, pos.y)
        }
    }

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return

        const pos = getMousePosition(e)
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!ctx || !canvas) return

        if (tool === 'pen') {
            ctx.lineTo(pos.x, pos.y)
            ctx.strokeStyle = color
            ctx.lineWidth = brushSize
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.stroke()
        } else if (tool === 'eraser') {
            // Eraser draws with board background color
            ctx.lineTo(pos.x, pos.y)
            ctx.strokeStyle = BOARD_BG
            ctx.lineWidth = brushSize * 3
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.stroke()
        } else if (shapeStart && savedImageData) {
            // Preview shape while dragging
            ctx.putImageData(savedImageData, 0, 0)

            ctx.beginPath()
            ctx.strokeStyle = color
            ctx.lineWidth = brushSize
            ctx.lineCap = 'round'

            if (tool === 'line') {
                ctx.moveTo(shapeStart.x, shapeStart.y)
                ctx.lineTo(pos.x, pos.y)
            } else if (tool === 'rectangle') {
                ctx.rect(
                    shapeStart.x,
                    shapeStart.y,
                    pos.x - shapeStart.x,
                    pos.y - shapeStart.y
                )
            } else if (tool === 'circle') {
                const radius = Math.sqrt(
                    Math.pow(pos.x - shapeStart.x, 2) + Math.pow(pos.y - shapeStart.y, 2)
                )
                ctx.arc(shapeStart.x, shapeStart.y, radius, 0, Math.PI * 2)
            }
            ctx.stroke()
        }
    }

    const stopDrawing = () => {
        setIsDrawing(false)
        setShapeStart(null)
        setSavedImageData(null)
    }

    const clearCanvas = () => {
        initCanvas()
    }

    // Drag handling
    const handleDragStart = (e: React.MouseEvent) => {
        e.preventDefault()
        setIsDragging(true)
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }

    // Resize handling
    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsResizing(true)
        setResizeStart({ x: e.clientX, y: e.clientY, w: size.width, h: size.height })
    }

    // Global mouse events for drag/resize
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({
                    x: Math.max(0, e.clientX - dragStart.x),
                    y: Math.max(0, e.clientY - dragStart.y)
                })
            }
            if (isResizing) {
                const deltaX = e.clientX - resizeStart.x
                const deltaY = e.clientY - resizeStart.y
                setSize({
                    width: Math.max(400, resizeStart.w + deltaX),
                    height: Math.max(350, resizeStart.h + deltaY)
                })
            }
        }

        const handleMouseUp = () => {
            setIsDragging(false)
            setIsResizing(false)
        }

        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
            return () => {
                window.removeEventListener('mousemove', handleMouseMove)
                window.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [isDragging, isResizing, dragStart, resizeStart])

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                ref={containerRef}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed z-50 rounded-2xl border-4 border-amber-900/50 shadow-2xl overflow-hidden"
                style={{
                    left: position.x,
                    top: position.y,
                    width: isMinimized ? 320 : size.width,
                    height: isMinimized ? 52 : size.height,
                    background: 'linear-gradient(145deg, #1a1a1a 0%, #000000 50%, #0a0a0a 100%)'
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-3 py-2 bg-amber-900/80 border-b-2 border-amber-800 cursor-move select-none"
                    onMouseDown={handleDragStart}
                >
                    <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-amber-200/60" />
                        <span className="text-sm font-medium text-amber-100">📝 Blackboard</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => {
                                if (!isMinimized) {
                                    // Save canvas content before minimizing
                                    const canvas = canvasRef.current
                                    if (canvas) {
                                        setMinimizedContent(canvas.toDataURL())
                                    }
                                }
                                setIsMinimized(!isMinimized)
                            }}
                            className="p-1.5 hover:bg-amber-800/50 rounded-lg transition"
                        >
                            {isMinimized ? (
                                <Maximize2 className="w-4 h-4 text-amber-200/80" />
                            ) : (
                                <Minimize2 className="w-4 h-4 text-amber-200/80" />
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-red-500/30 rounded-lg transition"
                        >
                            <X className="w-4 h-4 text-amber-200/80" />
                        </button>
                    </div>
                </div>

                {!isMinimized && (
                    <>
                        {/* Tools */}
                        <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-slate-800/90 border-b border-white/10">
                            {/* Drawing Tools */}
                            <div className="flex items-center gap-1 bg-slate-700/50 rounded-xl p-1">
                                {[
                                    { id: 'pen', icon: Pencil, label: 'Pen' },
                                    { id: 'eraser', icon: Eraser, label: 'Eraser' },
                                    { id: 'line', icon: Minus, label: 'Line' },
                                    { id: 'rectangle', icon: Square, label: 'Rectangle' },
                                    { id: 'circle', icon: Circle, label: 'Circle' },
                                ].map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => setTool(t.id as Tool)}
                                        className={`p-2.5 rounded-lg transition-all ${tool === t.id
                                            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                                            : 'text-white/60 hover:bg-slate-600/50 hover:text-white'
                                            }`}
                                        title={t.label}
                                    >
                                        <t.icon className="w-4 h-4" />
                                    </button>
                                ))}
                            </div>

                            {/* Colors */}
                            <div className="flex items-center gap-1 bg-slate-700/50 rounded-xl p-1.5">
                                {COLORS.map((c) => (
                                    <button
                                        key={c.value}
                                        onClick={() => setColor(c.value)}
                                        className={`w-6 h-6 rounded-full transition-all border-2 ${color === c.value
                                            ? 'border-white scale-110 shadow-lg'
                                            : 'border-transparent hover:scale-105'
                                            }`}
                                        style={{ backgroundColor: c.value }}
                                        title={c.name}
                                    />
                                ))}
                            </div>

                            {/* Brush Size */}
                            <div className="flex items-center gap-1 bg-slate-700/50 rounded-xl p-1.5">
                                {BRUSH_SIZES.map((s) => (
                                    <button
                                        key={s.value}
                                        onClick={() => setBrushSize(s.value)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${brushSize === s.value
                                            ? 'bg-indigo-500 text-white'
                                            : 'text-white/60 hover:bg-slate-600/50 hover:text-white'
                                            }`}
                                    >
                                        {s.name}
                                    </button>
                                ))}
                            </div>

                            {/* Zoom Controls */}
                            <div className="flex items-center gap-1 bg-slate-700/50 rounded-xl p-1.5">
                                <button
                                    onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
                                    className="p-2 rounded-lg text-white/60 hover:bg-slate-600/50 hover:text-white transition"
                                    title="Zoom Out"
                                >
                                    <ZoomOut className="w-4 h-4" />
                                </button>
                                <span className="text-xs text-white/60 min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
                                <button
                                    onClick={() => setZoom(prev => Math.min(3, prev + 0.25))}
                                    className="p-2 rounded-lg text-white/60 hover:bg-slate-600/50 hover:text-white transition"
                                    title="Zoom In"
                                >
                                    <ZoomIn className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setZoom(1)}
                                    className="px-2 py-1 rounded-lg text-xs text-white/60 hover:bg-slate-600/50 hover:text-white transition"
                                    title="Reset Zoom"
                                >
                                    Reset
                                </button>
                            </div>

                            {/* Clear */}
                            <button
                                onClick={clearCanvas}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition ml-auto"
                                title="Clear All"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span className="text-sm font-medium">Clear</span>
                            </button>
                        </div>

                        {/* Canvas Container with Zoom */}
                        <div
                            className="relative overflow-auto"
                            style={{ height: size.height - 110 }}
                        >
                            <div
                                style={{
                                    transform: `scale(${zoom})`,
                                    transformOrigin: 'top left',
                                    width: `${100 / zoom}%`,
                                    height: `${100 / zoom}%`
                                }}
                            >
                                <canvas
                                    ref={canvasRef}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onWheel={handleWheel}
                                    onTouchStart={handleTouchStart}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={handleTouchEnd}
                                    className={`w-full h-full ${tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'}`}
                                />
                            </div>
                            <canvas
                                ref={previewCanvasRef}
                                className="absolute inset-0 pointer-events-none hidden"
                            />
                            {/* Zoom level indicator */}
                            {zoom !== 1 && (
                                <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                    {Math.round(zoom * 100)}% zoom
                                </div>
                            )}
                        </div>

                        {/* Resize Handle */}
                        <div
                            className="absolute bottom-0 right-0 w-8 h-8 cursor-se-resize flex items-end justify-end p-1 group"
                            onMouseDown={handleResizeStart}
                        >
                            <Move className="w-4 h-4 text-amber-400/50 group-hover:text-amber-400 transition rotate-90" />
                        </div>

                        {/* Size indicator */}
                        {isResizing && (
                            <div className="absolute bottom-10 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                {size.width} × {size.height}
                            </div>
                        )}
                    </>
                )}
            </motion.div>
        </AnimatePresence>
    )
}
