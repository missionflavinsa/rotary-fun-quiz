'use client'

import { useState } from 'react'
import { Settings, Shield, Bell, Database, Save, Check } from 'lucide-react'
import { motion } from 'framer-motion'

export default function SettingsPage() {
    const [saved, setSaved] = useState(false)
    const [settings, setSettings] = useState({
        quizDuration: 30,
        pointsPerQuestion: 10,
        enableAI: true,
        enableNotifications: true,
        maxStudentsPerGame: 50
    })

    const handleSave = () => {
        // In a real app, save to database
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    return (
        <div className="p-6 max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                    Settings
                </h1>
                <p className="text-gray-500 mt-1">Configure your quiz platform</p>
            </div>

            <div className="space-y-6">
                {/* General Settings */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                >
                    <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <Settings className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">General Settings</h2>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Default Quiz Duration (seconds)
                                </label>
                                <input
                                    type="number"
                                    value={settings.quizDuration}
                                    onChange={(e) => setSettings({ ...settings, quizDuration: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Points Per Question
                                </label>
                                <input
                                    type="number"
                                    value={settings.pointsPerQuestion}
                                    onChange={(e) => setSettings({ ...settings, pointsPerQuestion: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Max Students Per Game
                                </label>
                                <input
                                    type="number"
                                    value={settings.maxStudentsPerGame}
                                    onChange={(e) => setSettings({ ...settings, maxStudentsPerGame: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Feature Toggles */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                >
                    <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Shield className="w-5 h-5 text-purple-600" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">Features</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div>
                                <p className="font-medium text-gray-900">AI Question Generation</p>
                                <p className="text-sm text-gray-500">Generate questions using Gemini/OpenAI</p>
                            </div>
                            <button
                                onClick={() => setSettings({ ...settings, enableAI: !settings.enableAI })}
                                className={`relative w-12 h-6 rounded-full transition-colors ${settings.enableAI ? 'bg-indigo-600' : 'bg-gray-300'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.enableAI ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div>
                                <p className="font-medium text-gray-900">Email Notifications</p>
                                <p className="text-sm text-gray-500">Send emails for game completions</p>
                            </div>
                            <button
                                onClick={() => setSettings({ ...settings, enableNotifications: !settings.enableNotifications })}
                                className={`relative w-12 h-6 rounded-full transition-colors ${settings.enableNotifications ? 'bg-indigo-600' : 'bg-gray-300'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.enableNotifications ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Database Info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                >
                    <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                            <Database className="w-5 h-5 text-emerald-600" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">Database</h2>
                    </div>
                    <div className="p-6">
                        <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm text-gray-600">
                                <span className="font-medium">Provider:</span> Supabase (PostgreSQL)
                            </p>
                            <p className="text-sm text-gray-600 mt-2">
                                <span className="font-medium">Status:</span>{' '}
                                <span className="text-emerald-600">Connected</span>
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition ${saved
                                ? 'bg-emerald-500 text-white'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                    >
                        {saved ? (
                            <>
                                <Check className="w-5 h-5" />
                                Saved!
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Save Settings
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
