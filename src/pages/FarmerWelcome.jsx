import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useAppDownloadUrl } from "../hooks/useAppDownloadUrl"
import HomeCarousel from "../components/HomeCarousel"
import LearnMore from "../components/LearnMore"
import DiseaseTiles from "../components/DiseaseTiles"
import { FOUND_DISEASES } from "../utils/diseases"
import FarmerHome from "./FarmerHome"
import rowsPhoto from "../assets/auth/farm-pineapple-rows.jpg"
import mistyPhoto from "../assets/auth/farm-misty-field.jpg"
import handpickedPhoto from "../assets/auth/farm-handpicked.jpg"
import sunlitPhoto from "../assets/auth/farm-sunlit-rows.jpg"

const scrollTo = (id) => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
}

// Farmer Home, laid out like a product site: a sliding banner across the top (one slide shows
// the diseases PinePal recognises as photo tiles, each opening its guide), "Learn More"
// opening how PinePal works right under it, and the farmer's own farm below (FarmerHome).
function FarmerWelcome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const downloadUrl = useAppDownloadUrl()
  const firstName = user.full_name?.split(" ")[0] || user.username
  const [learnMore, setLearnMore] = useState(false)

  const slides = [
    {
      image: rowsPhoto,
      label: `Welcome, ${firstName}`,
      title: "Catch Pineapple Diseases Early",
      highlight: "early",
      text: "Scan a fruit and get the diagnosis and what to do next in seconds.",
      action: { label: learnMore ? "Show Less" : "Learn More", onClick: () => setLearnMore((open) => !open) },
    },
    {
      label: "What PinePal recognises",
      title: `${FOUND_DISEASES.length} diseases, one photo away`,
      highlight: `${FOUND_DISEASES.length} diseases`,
      text: "Tap a disease to see what it looks like and how to treat it.",
      action: { label: "Read the Guides", onClick: () => navigate("/guides") },
      visual: (active) => <DiseaseTiles focusable={active} />,
    },
    {
      image: mistyPhoto,
      label: "In the Field",
      title: "Works Even Without Signal",
      highlight: "without signal",
      text: "Scan offline on your phone. Results upload by themselves when you're back online.",
      action: { label: "Get the Mobile App", href: downloadUrl },
    },
    {
      image: handpickedPhoto,
      label: "Treatment",
      title: "Know What to Do Next",
      highlight: "what to do",
      text: "Step-by-step treatment and prevention for every disease PinePal finds.",
      action: { label: "Read the Guides", onClick: () => navigate("/guides") },
    },
    {
      image: sunlitPhoto,
      label: "Your Farm",
      title: "Your Farm at a Glance",
      highlight: "at a glance",
      text: "Scan totals, a map of where you scanned, and your latest results.",
      action: { label: "See My Farm", onClick: () => scrollTo("my-farm") },
    },
  ]

  return (
    <div className="space-y-6 pb-6">
      <div>
        <HomeCarousel slides={slides} label="PinePal highlights" />
        <LearnMore id="learn-more" open={learnMore} />
      </div>

      <div id="my-farm" className="scroll-mt-6">
        <FarmerHome />
      </div>
    </div>
  )
}

export default FarmerWelcome
