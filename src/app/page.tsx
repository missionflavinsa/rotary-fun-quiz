'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, GraduationCap, Trophy, Users, Sparkles, Zap, Target } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-white overflow-hidden relative">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-1/4 -right-20 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-pink-600/10 rounded-full blur-[150px]"></div>

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjAyIiBkPSJNMCAwaDYwdjYwSDB6Ii8+PHBhdGggZD0iTTYwIDBIMHY2MCIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utb3BhY2l0eT0iLjAzIi8+PC9nPjwvc3ZnPg==')] opacity-50"></div>

        {/* Floating particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.3, 0.8, 0.3]
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="relative z-10">
        <nav className="container mx-auto px-6 py-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/10 backdrop-blur rounded-xl border border-white/10">
              <Trophy className="w-6 h-6 text-yellow-400" />
            </div>
            <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-300">
              Rotary Fun Quiz
            </span>
          </div>
          <Link
            href="/login"
            className="px-5 py-2 bg-white/10 backdrop-blur hover:bg-white/20 rounded-full text-sm font-medium transition border border-white/10"
          >
            Admin Login
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <div className="relative z-10 container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-lg border border-white/20 rounded-full px-4 py-2 mb-8">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium">Interactive Learning Platform</span>
            </div>

            {/* Main Title */}
            <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-white">
                Make Learning
              </span>
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 via-pink-300 to-purple-300">
                Fun & Exciting
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-300 max-w-2xl mx-auto mb-12">
              Spin the wheel, answer questions, earn rewards!
              Transform your classroom into an engaging quiz arena.
            </p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/game" className="group">
              <div className="px-10 py-5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full font-bold text-xl hover:shadow-2xl hover:shadow-purple-500/30 transition transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3">
                <Zap className="w-6 h-6" />
                Start Quiz Game
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </motion.div>
        </div>

        {/* Feature Cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto"
        >
          {[
            {
              icon: Users,
              title: 'Fair Selection',
              description: 'Randomized wheel spin ensures every student gets equal opportunity to participate.',
              color: 'from-indigo-500 to-purple-600'
            },
            {
              icon: Trophy,
              title: 'Rewards & Levels',
              description: 'Earn points for correct answers and unlock exciting gifts as you level up.',
              color: 'from-yellow-500 to-orange-600'
            },
            {
              icon: Target,
              title: 'AI-Powered Questions',
              description: 'Questions from your database plus AI-generated ones for endless variety.',
              color: 'from-pink-500 to-rose-600'
            }
          ].map((feature, idx) => (
            <motion.div
              key={idx}
              whileHover={{ y: -5, scale: 1.02 }}
              className="p-6 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 hover:border-white/20 transition group"
            >
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition`}>
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 mt-20">
        <div className="container mx-auto px-6 py-8 text-center">
          <p className="text-slate-500 text-sm">
            Developed by <span className="text-white font-medium">Mr. Austin Royster</span> • Built with ❤️ for Education
          </p>
        </div>
      </footer>
    </div>
  )
}
