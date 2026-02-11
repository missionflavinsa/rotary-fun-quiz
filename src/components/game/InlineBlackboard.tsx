'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Pencil, Eraser, Trash2, ZoomIn, ZoomOut, ChevronDown, ChevronUp, Square, Circle, Minus, MousePointer2, Check, X, Move, ArrowDownUp } from 'lucide-react'

interface InlineBlackboardProps {
    isOpen: boolean
    onClose: () => void
    studentName?: string
}

const BOARD_BG = '#000000'
const COLORS = [
    '#FFFFFF', '#FFD93D', '#FF8C42', '#FF6B6B',
    '#F78FB3', '#9B59B6', '#74B9FF', '#55EFC4'
]

export function InlineBlackboard({ isOpen, onClose, studentName }: InlineBlackboardProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [tool, setTool] = useState<'pen' | 'eraser' | 'line' | 'rectangle' | 'circle' | 'select'>('pen')
    const [color, setColor] = useState('#FFFFFF')
    const [brushSize, setBrushSize] = useState(3)
    const [zoom, setZoom] = useState(1)
    const [isExpanded, setIsExpanded] = useState(true)
    const lastTouchDistance = useRef<number | null>(null)
    const currentMousePos = useRef<{ x: number, y: number } | null>(null)

    // Canvas Size State
    const [canvasHeight, setCanvasHeight] = useState(300)
    const [isResizing, setIsResizing] = useState(false)

    // Shape/Selection drawing state
    const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null)
    const [savedImageData, setSavedImageData] = useState<ImageData | null>(null)
    const [hasInitialized, setHasInitialized] = useState(false)

    // Persistence State
    const contentRef = useRef<ImageData | null>(null)

    // Selection State
    const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

    // Floating Image State (Visual Dragging)
    // We store the dataURL for the detailed image, and pure x/y for the DOM element
    const [floatingImage, setFloatingImage] = useState<{
        x: number;
        y: number;
        w: number;
        h: number;
        dataUrl: string;
        originalData: ImageData;
    } | null>(null)
    const [isDraggingFloating, setIsDraggingFloating] = useState(false)
    const dragStartOffset = useRef<{ x: number, y: number } | null>(null)

    // Initialize canvas
    const initCanvas = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return

        ctx.fillStyle = BOARD_BG
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Restore content if exists
        if (contentRef.current) {
            ctx.putImageData(contentRef.current, 0, 0)
        }
    }, [])

    // Resize handling (persistence)
    useEffect(() => {
        if (isOpen) {
            // When height changes, React clears canvas. We must restore.
            // We rely on contentRef being up-to-date from handleResizeMouseDown or handleEnd
            initCanvas()
        }
    }, [canvasHeight, isOpen, initCanvas])

    const getPosition = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        if (!canvas) return { x: 0, y: 0 }
        const rect = canvas.getBoundingClientRect()
        let clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
        let clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
        return {
            x: (clientX - rect.left) / zoom,
            y: (clientY - rect.top) / zoom
        }
    }

    const clearSelectionUI = useCallback(() => {
        setSelectionRect(null)
        setShapeStart(null)
        setSavedImageData(null)
        setFloatingImage(null)
        setIsDraggingFloating(false)
        dragStartOffset.current = null
    }, [])

    const placeFloatingImage = useCallback(() => {
        if (!floatingImage) return
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!ctx || !canvas) return

        ctx.putImageData(floatingImage.originalData, floatingImage.x, floatingImage.y)
        // Update content ref after placing
        contentRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)

        clearSelectionUI()
    }, [floatingImage, clearSelectionUI])

    // --- Interaction Handlers ---

    // 1. Mouse Down
    const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const pos = getPosition(e)
        // Note: Floating image drag is handled by the DOM element's handlers, not canvas
        // BUT if user clicks outside floating image on canvas, we place it.
        if (floatingImage) {
            placeFloatingImage()
            return
        }

        // If clicking outside selection, clear selection
        if (selectionRect) {
            clearSelectionUI()
        }

        setIsDrawing(true)
        currentMousePos.current = pos

        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!ctx || !canvas) return

        if (tool === 'select' || tool === 'line' || tool === 'rectangle' || tool === 'circle') {
            setSavedImageData(ctx.getImageData(0, 0, canvas.width, canvas.height))
            setShapeStart(pos)
            setSelectionRect(null)
        } else {
            ctx.beginPath()
            ctx.moveTo(pos.x, pos.y)
        }
    }

    // 2. Mouse Move
    const handleMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return
        const pos = getPosition(e)
        currentMousePos.current = pos

        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!ctx || !canvas) return

        if (tool === 'pen' || tool === 'eraser') {
            ctx.lineTo(pos.x, pos.y)
            ctx.strokeStyle = tool === 'pen' ? color : BOARD_BG
            ctx.lineWidth = tool === 'pen' ? brushSize : brushSize * 3
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.stroke()
        } else if (shapeStart && savedImageData) {
            ctx.putImageData(savedImageData, 0, 0) // Clear preview
            const w = pos.x - shapeStart.x
            const h = pos.y - shapeStart.y

            ctx.save()
            if (tool === 'select') {
                ctx.strokeStyle = '#FFFFFF'
                ctx.lineWidth = 1
                ctx.setLineDash([5, 5])
                ctx.strokeRect(shapeStart.x, shapeStart.y, w, h)
            } else {
                ctx.beginPath()
                ctx.strokeStyle = color
                ctx.lineWidth = brushSize
                ctx.lineCap = 'round'
                if (tool === 'line') {
                    ctx.moveTo(shapeStart.x, shapeStart.y)
                    ctx.lineTo(pos.x, pos.y)
                } else if (tool === 'rectangle') {
                    ctx.rect(shapeStart.x, shapeStart.y, w, h)
                } else if (tool === 'circle') {
                    const radius = Math.sqrt(Math.pow(w, 2) + Math.pow(h, 2))
                    ctx.arc(shapeStart.x, shapeStart.y, radius, 0, Math.PI * 2)
                }
                ctx.stroke()
            }
            ctx.restore()
        }
    }

    // 3. Mouse Up
    const handleEnd = () => {
        setIsDrawing(false)

        // Save state after drawing
        const canvas = canvasRef.current
        if (canvas) {
            const ctx = canvas.getContext('2d')
            if (ctx) {
                contentRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
            }
        }

        if (floatingImage) return

        if (tool === 'select' && shapeStart && currentMousePos.current) {
            const w = currentMousePos.current.x - shapeStart.x
            const h = currentMousePos.current.y - shapeStart.y
            const params = {
                x: w < 0 ? currentMousePos.current.x : shapeStart.x,
                y: h < 0 ? currentMousePos.current.y : shapeStart.y,
                w: Math.abs(w),
                h: Math.abs(h)
            }

            if (params.w > 5 && params.h > 5) {
                setSelectionRect(params)
                if (savedImageData && canvasRef.current) {
                    canvasRef.current.getContext('2d')?.putImageData(savedImageData, 0, 0)
                }
                return
            }
        }
        setShapeStart(null)
        setSavedImageData(null)
        currentMousePos.current = null
    }

    // Selection Actions
    const deleteSelection = () => {
        if (!selectionRect || !savedImageData) return
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!ctx || !canvas) return

        ctx.putImageData(savedImageData, 0, 0)
        ctx.fillStyle = BOARD_BG
        ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h)

        // Update hash
        contentRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)

        clearSelectionUI()
    }

    const moveSelection = () => {
        if (!selectionRect || !savedImageData) return
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!ctx || !canvas) return

        ctx.putImageData(savedImageData, 0, 0)
        const data = ctx.getImageData(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h)

        // Generate Data URL for the floating DOM element
        const tmp = document.createElement('canvas')
        tmp.width = selectionRect.w
        tmp.height = selectionRect.h
        tmp.getContext('2d')?.putImageData(data, 0, 0)
        const dataUrl = tmp.toDataURL()

        // Erase source
        ctx.fillStyle = BOARD_BG
        ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h)

        // Update hash (erased state)
        contentRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)

        setFloatingImage({
            x: selectionRect.x,
            y: selectionRect.y,
            w: selectionRect.w,
            h: selectionRect.h,
            dataUrl,
            originalData: data
        })

        setSelectionRect(null)
        setShapeStart(null)
        setSavedImageData(null)
    }

    // Floating Element dragging - pure DOM logic
    // We attach these specifically to the floating div
    const startDragFloating = (e: React.MouseEvent | React.TouchEvent) => {
        // e.preventDefault() // prevent scroll
        setIsDraggingFloating(true)
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
        dragStartOffset.current = { x: clientX, y: clientY }
    }

    // We need window listeners for dragging to be smooth outside strict bounds, 
    // but simpler to just track on the container or window.

    useEffect(() => {
        const handleWindowMove = (e: MouseEvent | TouchEvent) => {
            if (!isDraggingFloating || !floatingImage || !dragStartOffset.current) return

            const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY

            // Calculate delta in screen pixels
            const dx = clientX - dragStartOffset.current.x
            const dy = clientY - dragStartOffset.current.y

            // Convert screen pixel delta to zoomed canvas units? 
            // IMPORTANT: floatingImage.x is in CANVAS COORDINATES (zoomed).
            // Movement in pixels needs to be divided by zoom.

            setFloatingImage(prev => prev ? {
                ...prev,
                x: prev.x + (dx / zoom),
                y: prev.y + (dy / zoom)
            } : null)

            dragStartOffset.current = { x: clientX, y: clientY }
        }

        const handleWindowUp = () => {
            if (isDraggingFloating) {
                setIsDraggingFloating(false)
            }
        }

        if (isDraggingFloating) {
            window.addEventListener('mousemove', handleWindowMove)
            window.addEventListener('mouseup', handleWindowUp)
            window.addEventListener('touchmove', handleWindowMove)
            window.addEventListener('touchend', handleWindowUp)
        }
        return () => {
            window.removeEventListener('mousemove', handleWindowMove)
            window.removeEventListener('mouseup', handleWindowUp)
            window.removeEventListener('touchmove', handleWindowMove)
            window.removeEventListener('touchend', handleWindowUp)
        }
    }, [isDraggingFloating, floatingImage, zoom])


    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        // Always stop propagation to prevent parent panel scroll sync
        e.stopPropagation()
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            const delta = e.deltaY > 0 ? -0.1 : 0.1
            setZoom(prev => Math.min(2, Math.max(0.5, prev + delta)))
        }
    }

    // Resize Handle (Height)
    const handleResizeMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()

        // Capture current state BEFORE resize starts
        const canvas = canvasRef.current
        if (canvas) {
            const ctx = canvas.getContext('2d')
            if (ctx) {
                contentRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
            }
        }

        setIsResizing(true)
        const startY = e.clientY
        const startH = canvasHeight

        const handleMove = (ev: MouseEvent) => {
            const newH = startH + (ev.clientY - startY)
            setCanvasHeight(Math.max(150, Math.min(newH, 1500)))
        }
        const handleUp = () => {
            document.removeEventListener('mousemove', handleMove)
            document.removeEventListener('mouseup', handleUp)
            setIsResizing(false)
        }
        document.addEventListener('mousemove', handleMove)
        document.addEventListener('mouseup', handleUp)
    }

    if (!isOpen) return null

    return (
        <div className="mt-4 pb-2 rounded-xl border border-amber-600/50 bg-[#0a0a0a] shadow-2xl relative mb-6">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-amber-900/60 border-b border-amber-700/50 rounded-t-xl">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-amber-100">
                        📝 {studentName ? `${studentName}'s Scratchpad` : 'Scratchpad'}
                    </span>
                    <span className="text-[10px] text-amber-200/50 px-2 py-0.5 bg-black/20 rounded">
                        {Math.round(canvasHeight)}px Height
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 hover:bg-amber-800/50 rounded transition">
                        {isExpanded ? <ChevronUp className="w-3 h-3 text-amber-200/80" /> : <ChevronDown className="w-3 h-3 text-amber-200/80" />}
                    </button>
                    <button onClick={onClose} className="text-amber-200/60 hover:text-amber-200 text-xs px-2 py-0.5 rounded hover:bg-red-500/30 transition">✕</button>
                </div>
            </div>

            <div style={{ display: isExpanded ? 'block' : 'none' }}>
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-slate-900 border-b border-white/10 text-white">
                    <div className="flex gap-0.5 bg-slate-800 rounded-lg p-0.5">
                        <button onClick={() => setTool('pen')} className={`p-1.5 rounded transition ${tool === 'pen' ? 'bg-indigo-600 text-white' : 'text-white/60 hover:text-white'}`}><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setTool('eraser')} className={`p-1.5 rounded transition ${tool === 'eraser' ? 'bg-indigo-600 text-white' : 'text-white/60 hover:text-white'}`}><Eraser className="w-4 h-4" /></button>
                        <button onClick={() => setTool('line')} className={`p-1.5 rounded transition ${tool === 'line' ? 'bg-indigo-600 text-white' : 'text-white/60 hover:text-white'}`}><Minus className="w-4 h-4" /></button>
                        <button onClick={() => setTool('rectangle')} className={`p-1.5 rounded transition ${tool === 'rectangle' ? 'bg-indigo-600 text-white' : 'text-white/60 hover:text-white'}`}><Square className="w-4 h-4" /></button>
                        <button onClick={() => setTool('circle')} className={`p-1.5 rounded transition ${tool === 'circle' ? 'bg-indigo-600 text-white' : 'text-white/60 hover:text-white'}`}><Circle className="w-4 h-4" /></button>
                        <div className="w-px bg-white/10 mx-1"></div>
                        <button onClick={() => setTool('select')} className={`p-1.5 rounded transition ${tool === 'select' ? 'bg-indigo-600 text-white' : 'text-white/60 hover:text-white'}`} title="Select & Move"><MousePointer2 className="w-4 h-4" /></button>
                    </div>

                    <div className="flex gap-1 ml-2">
                        {COLORS.map(c => (
                            <button key={c} onClick={() => setColor(c)} className={`w-5 h-5 rounded-full border-2 transition ${color === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                        ))}
                    </div>

                    <select value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="ml-2 text-xs bg-slate-800 text-slate-200 rounded px-2 py-1 border border-white/10 outline-none">
                        <option value={2}>Fine</option>
                        <option value={4}>Med</option>
                        <option value={8}>Bold</option>
                    </select>

                    <div className="flex items-center gap-1 ml-auto">
                        <button onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))} className="p-1.5 text-white/60 hover:text-white transition"><ZoomOut className="w-4 h-4" /></button>
                        <span className="text-xs text-white/50">{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(prev => Math.min(2, prev + 0.25))} className="p-1.5 text-white/60 hover:text-white transition"><ZoomIn className="w-4 h-4" /></button>
                    </div>

                    <button onClick={initCanvas} className="ml-2 flex items-center gap-1 px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium transition"><Trash2 className="w-3 h-3" /> Clear</button>
                </div>

                {/* Canvas Area */}
                <div
                    className="relative overflow-hidden bg-black custom-scrollbar transition-all duration-75 ease-out"
                    style={{ height: canvasHeight, overscrollBehavior: 'contain', isolation: 'isolate' }}
                >
                    <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                        <canvas
                            ref={canvasRef}
                            width={500}
                            height={canvasHeight}
                            onMouseDown={handleStart}
                            onMouseMove={handleMove}
                            onMouseUp={handleEnd}
                            onMouseLeave={handleEnd}
                            onWheel={handleWheel}
                            onTouchStart={handleStart}
                            onTouchMove={handleMove}
                            onTouchEnd={handleEnd}
                            className={`${tool === 'eraser' ? 'cursor-cell' : tool === 'select' ? 'cursor-crosshair' : 'cursor-crosshair'}`}
                            style={{ touchAction: 'none' }}
                        />

                        {/* Selection UI */}
                        {selectionRect && (
                            <div
                                className="absolute border-2 border-dashed border-white/80 bg-white/5 flex items-start justify-center animate-pulse"
                                style={{
                                    left: selectionRect.x,
                                    top: selectionRect.y,
                                    width: selectionRect.w,
                                    height: selectionRect.h,
                                    pointerEvents: 'none'
                                }}
                            >
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1 bg-slate-800 rounded-lg p-1 shadow-lg pointer-events-auto border border-white/10">
                                    <button onClick={deleteSelection} className="p-1.5 text-red-400 hover:bg-white/10 rounded" title="Delete Area"><Trash2 className="w-4 h-4" /></button>
                                    <button onClick={moveSelection} className="p-1.5 text-blue-400 hover:bg-white/10 rounded" title="Move Area"><Move className="w-4 h-4" /></button>
                                    <button onClick={clearSelectionUI} className="p-1.5 text-white/60 hover:bg-white/10 rounded" title="Cancel"><X className="w-4 h-4" /></button>
                                </div>
                            </div>
                        )}

                        {/* Floating Draggable Element (DOM Based) */}
                        {floatingImage && (
                            <div
                                className="absolute cursor-move shadow-2xl border-2 border-green-500/50 hover:border-green-400"
                                style={{
                                    left: floatingImage.x,
                                    top: floatingImage.y,
                                    width: floatingImage.w,
                                    height: floatingImage.h,
                                    backgroundImage: `url(${floatingImage.dataUrl})`,
                                    backgroundSize: 'contain',
                                    zIndex: 50,
                                    transform: isDraggingFloating ? 'scale(1.02)' : 'none',
                                    opacity: isDraggingFloating ? 0.9 : 1
                                }}
                                onMouseDown={startDragFloating}
                                onTouchStart={startDragFloating}
                            >
                                <div className="absolute -top-8 right-0 flex gap-1 bg-slate-800 rounded-lg p-1 shadow-lg border border-green-500/30">
                                    <button onClick={placeFloatingImage} className="flex items-center gap-1 px-2 py-0.5 text-green-400 hover:bg-white/10 rounded text-xs font-bold" title="Place"><Check className="w-3 h-3" /> Place</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Resize Footer */}
                <div
                    className="h-6 bg-slate-900/90 border-t border-white/5 flex items-center justify-center cursor-ns-resize hover:bg-slate-800 transition"
                    onMouseDown={handleResizeMouseDown}
                >
                    <ArrowDownUp className="w-3 h-3 text-white/30" />
                </div>
            </div>
        </div>
    )
}
