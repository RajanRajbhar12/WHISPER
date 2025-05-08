import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Headphones, Lock, Mic, Users } from "lucide-react"

export function LandingFeatures() {
  const features = [
    {
      icon: <Mic className="h-10 w-10 text-primary" />,
      title: "Voice-Only Communication",
      description: "Connect through voice without the pressure of video or text. Just pure, authentic conversation.",
    },
    {
      icon: <Users className="h-10 w-10 text-primary" />,
      title: "Mood-Based Matching",
      description: "Find people who share your current mood, whether you're happy, sad, excited, or just want to talk.",
    },
    {
      icon: <Lock className="h-10 w-10 text-primary" />,
      title: "Private & Secure",
      description: "Your conversations are never recorded or stored. What happens in Whisper, stays in Whisper.",
    },
    {
      icon: <Headphones className="h-10 w-10 text-primary" />,
      title: "High-Quality Audio",
      description: "Crystal clear voice quality so you can hear every nuance of the conversation.",
    },
  ]

  return (
    <div className="py-16 md:py-24">
      <div className="container px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">Why Choose Whisper?</h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Our platform is designed to create meaningful connections through voice
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="border-2 border-primary/10 bg-background/50">
              <CardHeader className="pb-2">
                <div className="mb-2">{feature.icon}</div>
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
