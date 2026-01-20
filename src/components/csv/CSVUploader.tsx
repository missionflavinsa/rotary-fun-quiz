'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Download, FileText, CheckCircle, XCircle, AlertTriangle, Loader2, X } from 'lucide-react'

interface CSVUploaderProps {
    type: 'questions' | 'students'
    teacherId?: string
    onSuccess?: () => void
}

interface UploadResult {
    success: number
    failed: number
    errors: string[]
}

export function CSVUploader({ type, teacherId, onSuccess }: CSVUploaderProps) {
    const [isDragOver, setIsDragOver] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [result, setResult] = useState<UploadResult | null>(null)
    const [showErrors, setShowErrors] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file && file.name.endsWith('.csv')) {
            await uploadFile(file)
        }
    }, [type, teacherId])

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            await uploadFile(file)
        }
    }

    const uploadFile = async (file: File) => {
        setIsUploading(true)
        setResult(null)

        const formData = new FormData()
        formData.append('file', file)
        if (teacherId) {
            formData.append('teacherId', teacherId)
        }

        try {
            const res = await fetch(`/api/csv/upload/${type}`, {
                method: 'POST',
                body: formData
            })

            const data = await res.json()

            if (res.ok) {
                setResult(data)
                if (data.success > 0 && onSuccess) {
                    onSuccess()
                }
            } else {
                setResult({
                    success: 0,
                    failed: 1,
                    errors: [data.error || 'Upload failed']
                })
            }
        } catch (error) {
            setResult({
                success: 0,
                failed: 1,
                errors: ['Network error. Please try again.']
            })
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const downloadTemplate = () => {
        window.location.href = `/api/csv/templates/${type}`
    }

    const downloadExport = () => {
        window.location.href = `/api/csv/export/${type}`
    }

    return (
        <div className="space-y-4">
            {/* Action Buttons */}
            <div className="flex gap-3 flex-wrap">
                <button
                    onClick={downloadTemplate}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition text-sm font-medium"
                >
                    <Download className="w-4 h-4" />
                    Download Template
                </button>
                <button
                    onClick={downloadExport}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition text-sm font-medium"
                >
                    <FileText className="w-4 h-4" />
                    Export Existing Data
                </button>
            </div>

            {/* Drop Zone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                    relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                    ${isDragOver
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }
                `}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                />

                {isUploading ? (
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                        <p className="text-gray-600">Uploading and processing...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <Upload className={`w-10 h-10 ${isDragOver ? 'text-indigo-500' : 'text-gray-400'}`} />
                        <div>
                            <p className="text-gray-700 font-medium">
                                Drop CSV file here or click to browse
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                                Upload {type} in bulk using CSV format
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Results */}
            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`rounded-xl p-4 ${result.failed === 0
                            ? 'bg-green-500/20 border border-green-500/30'
                            : result.success === 0
                                ? 'bg-red-500/20 border border-red-500/30'
                                : 'bg-yellow-500/20 border border-yellow-500/30'
                            }`}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                                {result.failed === 0 ? (
                                    <CheckCircle className="w-6 h-6 text-green-400 mt-0.5" />
                                ) : result.success === 0 ? (
                                    <XCircle className="w-6 h-6 text-red-400 mt-0.5" />
                                ) : (
                                    <AlertTriangle className="w-6 h-6 text-yellow-400 mt-0.5" />
                                )}
                                <div>
                                    <p className="font-medium text-gray-800">
                                        {result.success} {type} imported successfully
                                        {result.failed > 0 && `, ${result.failed} failed`}
                                    </p>
                                    {result.errors.length > 0 && (
                                        <button
                                            onClick={() => setShowErrors(!showErrors)}
                                            className="text-sm text-gray-500 hover:text-gray-700 mt-1"
                                        >
                                            {showErrors ? 'Hide' : 'Show'} {result.errors.length} error(s)
                                        </button>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => setResult(null)}
                                className="text-gray-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {showErrors && result.errors.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                                <ul className="space-y-1 text-sm text-gray-600 max-h-40 overflow-y-auto">
                                    {result.errors.map((err, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <span className="text-red-500">•</span>
                                            {err}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
