import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function LandingTestimonials() {
  const testimonials = [
    {
      quote:
        "I've had some of the most meaningful conversations of my life on Whisper. There's something special about connecting just through voice.",
      author: "Alex K.",
      initial: "A",
      location: "New York, USA",
    },
    {
      quote:
        "As someone with social anxiety, Whisper has been a game-changer. I can connect with people without the pressure of video or in-person interaction.",
      author: "Samantha T.",
      initial: "S",
      location: "London, UK",
    },
    {
      quote:
        "I was feeling lonely during the pandemic, and Whisper helped me feel connected again. The voice-only format creates such authentic conversations.",
      author: "Miguel R.",
      initial: "M",
      location: "Madrid, Spain",
    },
  ]

  return (
    <div className="py-16 md:py-24 bg-primary/5">
      <div className="container px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">What Our Users Say</h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Thousands of people are making meaningful connections every day
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="bg-card border-none">
              <CardContent className="pt-6">
                <p className="text-lg italic">"{testimonial.quote}"</p>
              </CardContent>
              <CardFooter className="flex items-center space-x-4 pt-4 border-t">
                <Avatar>
                  <AvatarFallback className="bg-primary/20 text-primary">{testimonial.initial}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.location}</p>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
