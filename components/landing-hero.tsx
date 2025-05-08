"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AudioVisualizer } from "@/components/audio-visualizer"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"

export function LandingHero() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <div className="relative pt-20 pb-16 md:pt-32 md:pb-24">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center text-center space-y-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Connect Through <span className="gradient-text">Voice</span>
            </h1>
            <p className="mt-4 text-xl text-muted-foreground max-w-2xl">
              Talk with strangers who share your mood. No video, no text, just authentic voice conversations.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="relative h-32 md:h-40 bg-primary/10 rounded-lg overflow-hidden border border-primary/20">
              <AudioVisualizer isActive={true} />
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-lg font-medium text-primary">Voice-only connections</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <Link href="/talk">
              <Button size="lg" className="text-md px-8">
                Start Talking
              </Button>
            </Link>
            <Link href="/about">
              <Button size="lg" variant="outline" className="text-md px-8">
                Learn More
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
